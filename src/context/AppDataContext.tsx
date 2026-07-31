/**
 * Centralized Application Data & Bootstrap Context
 * Single source of truth for app initialization, auth state resolution, and shared datasets.
 * Prevents premature fetching, empty-data UI flashes, and duplicate initial queries.
 * @license Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { authStore } from '../lib/authStore';
import { db } from '../lib/db';
import {
  RepairOrder,
  Customer,
  Product,
  RepairPartUsage,
  Invoice,
  Expense,
  Supplier,
  ProductCategory,
  SystemSettings,
  User,
  DBDeviceType,
  DBDeviceModel,
  RepairTemplateItem,
  Partner,
  PartnerLedgerEntry,
  PartnerSettlement,
  PartnerTransaction,
  ActivityLog,
  SettlementAuditLog
} from '../types';

import { fetchOrMigrateRepairOrders, getLocalRepairOrdersBackup, saveLocalRepairOrdersBackup } from '../lib/supabaseRepairOrders';
import { fetchOrMigrateCustomers, getLocalCustomersBackup, saveLocalCustomersBackup } from '../lib/supabaseCustomers';
import { fetchOrMigrateProducts, getLocalProductsBackup, saveLocalProductsBackup, getInventoryMovements } from '../lib/supabaseProducts';
import { fetchOrMigrateRepairPartUsages, getLocalRepairPartUsagesBackup, saveLocalRepairPartUsagesBackup } from '../lib/supabasePartUsages';
import { fetchOrMigrateInvoices, getLocalInvoicesBackup, saveLocalInvoicesBackup } from '../lib/supabaseInvoices';
import { fetchOrMigrateExpenses, getLocalExpensesBackup } from '../lib/supabaseExpenses';
import { fetchOrMigrateSuppliers, getLocalSuppliersBackup } from '../lib/supabaseSuppliers';
import { fetchOrMigrateCategories, getLocalCategoriesBackup } from '../lib/supabaseCategories';
import { fetchOrMigrateStoreSettings, getLocalStoreSettingsBackup } from '../lib/supabaseSettings';
import {
  fetchDeviceTypesFromSupabase,
  fetchDeviceModelsFromSupabase,
  fetchRepairTemplatesFromSupabase,
  getDeviceTypesSync,
  getDeviceModelsSync,
  getRepairTemplatesSync
} from '../lib/supabaseDeviceManager';
import {
  fetchOrMigratePartnerLedger,
  fetchOrMigratePartnerSettlements,
  fetchOrMigratePartnerTransactions,
  getLocalPartnerLedgerBackup,
  getLocalPartnerSettlementsBackup,
  getLocalPartnerTransactionsBackup
} from '../lib/supabasePartnerAccounting';

export type BootstrapState =
  | 'BOOTING'
  | 'AUTH_LOADING'
  | 'AUTH_READY'
  | 'DATA_LOADING'
  | 'APP_READY'
  | 'ERROR';

export interface DatasetState<T> {
  data: T;
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;
}

export interface BootstrapTimeline {
  appMountTime: number;
  authResolvedTime: number | null;
  initialFetchStartTime: number | null;
  datasetCompletionTimes: Record<string, number>;
  appReadyTime: number | null;
}

function createEmptyDataset<T>(initialData: T): DatasetState<T> {
  return {
    data: initialData,
    isLoading: true,
    isLoaded: false,
    error: null
  };
}

function createLoadedDataset<T>(data: T): DatasetState<T> {
  return {
    data,
    isLoading: false,
    isLoaded: true,
    error: null
  };
}

export interface AppDataContextType {
  bootstrapState: BootstrapState;
  bootstrapError: string | null;
  currentUser: User | null;
  hasOwner: boolean;
  timeline: BootstrapTimeline;
  
  // Datasets
  repairOrdersState: DatasetState<RepairOrder[]>;
  customersState: DatasetState<Customer[]>;
  productsState: DatasetState<Product[]>;
  repairPartUsagesState: DatasetState<RepairPartUsage[]>;
  inventoryMovementsState: DatasetState<any[]>;
  invoicesState: DatasetState<Invoice[]>;
  settingsState: DatasetState<SystemSettings>;
  categoriesState: DatasetState<ProductCategory[]>;
  suppliersState: DatasetState<Supplier[]>;
  expensesState: DatasetState<Expense[]>;
  usersState: DatasetState<User[]>;
  deviceTypesState: DatasetState<DBDeviceType[]>;
  deviceModelsState: DatasetState<DBDeviceModel[]>;
  repairTemplatesState: DatasetState<RepairTemplateItem[]>;
  partnersState: DatasetState<Partner[]>;
  partnerLedgerState: DatasetState<PartnerLedgerEntry[]>;
  partnerSettlementsState: DatasetState<PartnerSettlement[]>;
  partnerTransactionsState: DatasetState<PartnerTransaction[]>;
  activityLogsState: DatasetState<ActivityLog[]>;

  // Actions / Refetches
  retryBootstrap: () => Promise<void>;
  handleLoginSuccess: (user: User) => Promise<void>;
  handleLogout: () => Promise<void>;
  
  // Local state update helpers (mutations write to context & Supabase)
  setRepairOrdersData: (updater: RepairOrder[] | ((prev: RepairOrder[]) => RepairOrder[])) => void;
  setCustomersData: (updater: Customer[] | ((prev: Customer[]) => Customer[])) => void;
  setProductsData: (updater: Product[] | ((prev: Product[]) => Product[])) => void;
  setInvoicesData: (updater: Invoice[] | ((prev: Invoice[]) => Invoice[])) => void;
  setPartUsagesData: (updater: RepairPartUsage[] | ((prev: RepairPartUsage[]) => RepairPartUsage[])) => void;
  setSuppliersData: (updater: Supplier[] | ((prev: Supplier[]) => Supplier[])) => void;
  setExpensesData: (updater: Expense[] | ((prev: Expense[]) => Expense[])) => void;
  setCategoriesData: (updater: ProductCategory[] | ((prev: ProductCategory[]) => ProductCategory[])) => void;
  setSettingsData: (updater: SystemSettings | ((prev: SystemSettings) => SystemSettings)) => void;
  setUsersData: (updater: User[] | ((prev: User[]) => User[])) => void;
  setPartnersData: (updater: Partner[] | ((prev: Partner[]) => Partner[])) => void;
  
  // Selective dataset refetch
  refetchDataset: (key: string) => Promise<void>;
}

const AppDataContext = createContext<AppDataContextType | null>(null);

export const AppDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [bootstrapState, setBootstrapState] = useState<BootstrapState>('BOOTING');
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [hasOwner, setHasOwner] = useState<boolean>(true);

  // Performance timeline tracking
  const [timeline, setTimeline] = useState<BootstrapTimeline>({
    appMountTime: performance.now(),
    authResolvedTime: null,
    initialFetchStartTime: null,
    datasetCompletionTimes: {},
    appReadyTime: null
  });

  // Datasets
  const [repairOrdersState, setRepairOrdersState] = useState<DatasetState<RepairOrder[]>>(() => createEmptyDataset([]));
  const [customersState, setCustomersState] = useState<DatasetState<Customer[]>>(() => createEmptyDataset([]));
  const [productsState, setProductsState] = useState<DatasetState<Product[]>>(() => createEmptyDataset([]));
  const [repairPartUsagesState, setRepairPartUsagesState] = useState<DatasetState<RepairPartUsage[]>>(() => createEmptyDataset([]));
  const [inventoryMovementsState, setInventoryMovementsState] = useState<DatasetState<any[]>>(() => createEmptyDataset([]));
  const [invoicesState, setInvoicesState] = useState<DatasetState<Invoice[]>>(() => createEmptyDataset([]));
  const [settingsState, setSettingsState] = useState<DatasetState<SystemSettings>>(() => createEmptyDataset(db.getSettings()));
  const [categoriesState, setCategoriesState] = useState<DatasetState<ProductCategory[]>>(() => createEmptyDataset([]));
  const [suppliersState, setSuppliersState] = useState<DatasetState<Supplier[]>>(() => createEmptyDataset([]));
  const [expensesState, setExpensesState] = useState<DatasetState<Expense[]>>(() => createEmptyDataset([]));
  const [usersState, setUsersState] = useState<DatasetState<User[]>>(() => createEmptyDataset([]));
  const [deviceTypesState, setDeviceTypesState] = useState<DatasetState<DBDeviceType[]>>(() => createEmptyDataset([]));
  const [deviceModelsState, setDeviceModelsState] = useState<DatasetState<DBDeviceModel[]>>(() => createEmptyDataset([]));
  const [repairTemplatesState, setRepairTemplatesState] = useState<DatasetState<RepairTemplateItem[]>>(() => createEmptyDataset([]));
  const [partnersState, setPartnersState] = useState<DatasetState<Partner[]>>(() => createEmptyDataset([]));
  const [partnerLedgerState, setPartnerLedgerState] = useState<DatasetState<PartnerLedgerEntry[]>>(() => createEmptyDataset([]));
  const [partnerSettlementsState, setPartnerSettlementsState] = useState<DatasetState<PartnerSettlement[]>>(() => createEmptyDataset([]));
  const [partnerTransactionsState, setPartnerTransactionsState] = useState<DatasetState<PartnerTransaction[]>>(() => createEmptyDataset([]));
  const [activityLogsState, setActivityLogsState] = useState<DatasetState<ActivityLog[]>>(() => createEmptyDataset([]));

  // Concurrency & generation guards
  const fetchGenIdRef = useRef<number>(0);
  const isInitializingRef = useRef<boolean>(false);

  /**
   * Loads all required business datasets concurrently via Promise.allSettled
   */
  const loadAppData = useCallback(async (user: User) => {
    const fetchStart = performance.now();
    const currentGen = ++fetchGenIdRef.current;

    setBootstrapState('DATA_LOADING');
    setBootstrapError(null);

    setTimeline(prev => ({
      ...prev,
      initialFetchStartTime: fetchStart
    }));

    console.log(`🚀 [Bootstrap] Starting data load generation #${currentGen} for user ${user.fullName} (${user.id})`);

    try {
      const completionTimes: Record<string, number> = {};
      const recordCompletion = (name: string) => {
        completionTimes[name] = Math.round(performance.now() - fetchStart);
      };

      // Run initial required datasets concurrently
      const [
        repairOrdersRes,
        customersRes,
        productsRes,
        usagesRes,
        movementsRes,
        invoicesRes,
        settingsRes,
        categoriesRes,
        suppliersRes,
        expensesRes,
        partnerLedgerRes,
        partnerSettlementsRes,
        partnerTransactionsRes,
        deviceTypesRes,
        deviceModelsRes,
        repairTemplatesRes
      ] = await Promise.all([
        fetchOrMigrateRepairOrders().then(res => { recordCompletion('repairOrders'); return res; }),
        fetchOrMigrateCustomers().then(res => { recordCompletion('customers'); return res; }),
        fetchOrMigrateProducts().then(res => { recordCompletion('products'); return res; }),
        fetchOrMigrateRepairPartUsages().then(res => { recordCompletion('repairPartUsages'); return res; }),
        getInventoryMovements().then(res => { recordCompletion('inventoryMovements'); return res; }),
        fetchOrMigrateInvoices().then(res => { recordCompletion('invoices'); return res; }),
        fetchOrMigrateStoreSettings().then(res => { recordCompletion('settings'); return res; }),
        fetchOrMigrateCategories().then(res => { recordCompletion('categories'); return res; }),
        fetchOrMigrateSuppliers().then(res => { recordCompletion('suppliers'); return res; }),
        fetchOrMigrateExpenses().then(res => { recordCompletion('expenses'); return res; }),
        fetchOrMigratePartnerLedger().then(res => { recordCompletion('partnerLedger'); return res; }),
        fetchOrMigratePartnerSettlements().then(res => { recordCompletion('partnerSettlements'); return res; }),
        fetchOrMigratePartnerTransactions().then(res => { recordCompletion('partnerTransactions'); return res; }),
        fetchDeviceTypesFromSupabase().then(res => { recordCompletion('deviceTypes'); return res; }),
        fetchDeviceModelsFromSupabase().then(res => { recordCompletion('deviceModels'); return res; }),
        fetchRepairTemplatesFromSupabase().then(res => { recordCompletion('repairTemplates'); return res; })
      ]);

      // Guard: Ignore response if a newer fetch was started
      if (fetchGenIdRef.current !== currentGen) {
        console.warn(`⚠️ [Bootstrap] Dropping obsolete fetch results for generation #${currentGen}`);
        return;
      }

      // Check critical data fetching failures
      const criticalFailures: string[] = [];
      if (!repairOrdersRes.success && repairOrdersRes.error && !repairOrdersRes.orders?.length) {
        criticalFailures.push(`أوامر الصيانة: ${repairOrdersRes.error}`);
      }
      if (!customersRes.success && customersRes.error && !customersRes.customers?.length) {
        criticalFailures.push(`العملاء: ${customersRes.error}`);
      }
      if (!productsRes.products) {
        criticalFailures.push(`قطع الغيار/المنتجات: تعذر الاتصال بـ Supabase`);
      }

      if (criticalFailures.length > 0) {
        const errorMsg = `تعذر تحميل البيانات الأولية المطلوبة (${criticalFailures.join(' | ')})`;
        console.error('❌ [Bootstrap] Critical data load failure:', errorMsg);
        setBootstrapError(errorMsg);
        setBootstrapState('ERROR');
        return;
      }

      // Populate datasets cleanly
      const orders = repairOrdersRes.orders || getLocalRepairOrdersBackup();
      const customers = customersRes.customers || getLocalCustomersBackup();
      const products = productsRes.products || getLocalProductsBackup();
      const usages = usagesRes.partUsages || getLocalRepairPartUsagesBackup();
      const movements = movementsRes || [];
      const invoices = invoicesRes.invoices || getLocalInvoicesBackup();
      const settings = settingsRes || getLocalStoreSettingsBackup() || db.getSettings();
      const categories = categoriesRes.categories || getLocalCategoriesBackup();
      const suppliers = suppliersRes.suppliers || getLocalSuppliersBackup();
      const expenses = expensesRes.expenses || getLocalExpensesBackup();
      const pLedger = partnerLedgerRes.ledger || getLocalPartnerLedgerBackup();
      const pSettlements = partnerSettlementsRes.settlements || getLocalPartnerSettlementsBackup();
      const pTransactions = partnerTransactionsRes.transactions || getLocalPartnerTransactionsBackup();
      const devTypes = deviceTypesRes || getDeviceTypesSync();
      const devModels = deviceModelsRes || getDeviceModelsSync();
      const repTemplates = repairTemplatesRes || getRepairTemplatesSync();
      const users = authStore.getUsers() || [];
      const partners = db.getPartners() || [];
      const actLogs = db.getActivityLogs() || [];

      // Save to local backup stores for offline compatibility
      saveLocalRepairOrdersBackup(orders);
      saveLocalCustomersBackup(customers);
      saveLocalProductsBackup(products);
      saveLocalRepairPartUsagesBackup(usages);
      saveLocalInvoicesBackup(invoices);


      setRepairOrdersState(createLoadedDataset(orders));
      setCustomersState(createLoadedDataset(customers));
      setProductsState(createLoadedDataset(products));
      setRepairPartUsagesState(createLoadedDataset(usages));
      setInventoryMovementsState(createLoadedDataset(movements));
      setInvoicesState(createLoadedDataset(invoices));
      setSettingsState(createLoadedDataset(settings));
      setCategoriesState(createLoadedDataset(categories));
      setSuppliersState(createLoadedDataset(suppliers));
      setExpensesState(createLoadedDataset(expenses));
      setPartnerLedgerState(createLoadedDataset(pLedger));
      setPartnerSettlementsState(createLoadedDataset(pSettlements));
      setPartnerTransactionsState(createLoadedDataset(pTransactions));
      setDeviceTypesState(createLoadedDataset(devTypes));
      setDeviceModelsState(createLoadedDataset(devModels));
      setRepairTemplatesState(createLoadedDataset(repTemplates));
      setUsersState(createLoadedDataset(users));
      setPartnersState(createLoadedDataset(partners));
      setActivityLogsState(createLoadedDataset(actLogs));

      const readyTime = performance.now();
      const totalBootstrapMs = Math.round(readyTime - timeline.appMountTime);

      setTimeline(prev => ({
        ...prev,
        datasetCompletionTimes: completionTimes,
        appReadyTime: readyTime
      }));

      console.log(`✅ [Bootstrap] App Ready in ${totalBootstrapMs}ms! Dataset Timings:`, completionTimes);
      setBootstrapState('APP_READY');
    } catch (err: any) {
      console.error('❌ [Bootstrap] Unexpected exception loading app data:', err);
      setBootstrapError(err?.message || 'حدث خطأ غير متوقع أثناء الاتصال بالخادم وقراءة البيانات.');
      setBootstrapState('ERROR');
    }
  }, [timeline.appMountTime]);

  /**
   * Initializes auth session, checks owner status, and triggers data loading
   */
  const initializeAuthAndData = useCallback(async () => {
    if (isInitializingRef.current) return;
    isInitializingRef.current = true;

    setBootstrapState('AUTH_LOADING');
    setBootstrapError(null);

    try {
      // 1. Resolve Auth Session
      const { user, error } = await authStore.validateAndSyncSession();
      const authResolved = performance.now();

      setTimeline(prev => ({
        ...prev,
        authResolvedTime: authResolved
      }));

      if (error && !error.includes('لم يتم العثور')) {
        console.warn('⚠️ [Bootstrap] Auth resolution warning:', error);
      }

      if (user) {
        console.log(`👤 [Bootstrap] Authenticated session active for: ${user.fullName}`);
        setCurrentUser(user);
        setHasOwner(true);
        // User logged in -> proceed to load business data
        await loadAppData(user);
      } else {
        console.log('🔒 [Bootstrap] No active auth session found.');
        setCurrentUser(null);
        // Check if system has an owner
        const ownerStatus = await authStore.checkHasOwnerStatus();
        setHasOwner(ownerStatus.hasOwner);
        setBootstrapState('AUTH_READY');
      }
    } catch (err: any) {
      console.error('❌ [Bootstrap] Exception resolving auth session:', err);
      setBootstrapError(err?.message || 'تعذر التحقق من جلسة تسجيل الدخول.');
      setBootstrapState('ERROR');
    } finally {
      isInitializingRef.current = false;
    }
  }, [loadAppData]);

  // Initial mount trigger
  useEffect(() => {
    initializeAuthAndData();
  }, [initializeAuthAndData]);

  // Single Realtime Subscription or Custom DB Change Handler
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const handleCustomDbChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      const key = customEvent.detail?.key;
      if (!key) return;

      console.log(`🔄 [AppDataProvider] Incremental dataset refresh triggered for key: ${key}`);

      if (key === 'atari_repair_orders') {
        fetchOrMigrateRepairOrders().then(res => {
          if (res.orders) setRepairOrdersState(createLoadedDataset(res.orders));
        });
      } else if (key === 'atari_customers') {
        fetchOrMigrateCustomers().then(res => {
          if (res.customers) setCustomersState(createLoadedDataset(res.customers));
        });
      } else if (key === 'atari_products') {
        fetchOrMigrateProducts().then(res => {
          if (res.products) setProductsState(createLoadedDataset(res.products));
        });
        getInventoryMovements().then(res => {
          setInventoryMovementsState(createLoadedDataset(res));
        });
      } else if (key === 'atari_invoices') {
        fetchOrMigrateInvoices().then(res => {
          if (res.invoices) setInvoicesState(createLoadedDataset(res.invoices));
        });
      } else if (key === 'atari_repair_part_usages') {
        fetchOrMigrateRepairPartUsages().then(res => {
          if (res.partUsages) setRepairPartUsagesState(createLoadedDataset(res.partUsages));
        });
      }
    };

    window.addEventListener('atari_db_changed', handleCustomDbChange);
    return () => {
      window.removeEventListener('atari_db_changed', handleCustomDbChange);
    };
  }, []);

  // Actions
  const retryBootstrap = async () => {
    isInitializingRef.current = false;
    await initializeAuthAndData();
  };

  const handleLoginSuccess = async (user: User) => {
    setCurrentUser(user);
    setHasOwner(true);
    await loadAppData(user);
  };

  const handleLogout = async () => {
    await authStore.logout();
    setCurrentUser(null);
    setRepairOrdersState(createEmptyDataset([]));
    setCustomersState(createEmptyDataset([]));
    setProductsState(createEmptyDataset([]));
    setInvoicesState(createEmptyDataset([]));
    setRepairPartUsagesState(createEmptyDataset([]));
    setBootstrapState('AUTH_READY');
  };

  const refetchDataset = async (key: string) => {
    if (key === 'repairOrders') {
      const res = await fetchOrMigrateRepairOrders();
      if (res.orders) setRepairOrdersState(createLoadedDataset(res.orders));
    } else if (key === 'customers') {
      const res = await fetchOrMigrateCustomers();
      if (res.customers) setCustomersState(createLoadedDataset(res.customers));
    } else if (key === 'products') {
      const res = await fetchOrMigrateProducts();
      if (res.products) setProductsState(createLoadedDataset(res.products));
    } else if (key === 'invoices') {
      const res = await fetchOrMigrateInvoices();
      if (res.invoices) setInvoicesState(createLoadedDataset(res.invoices));
    } else if (key === 'repairPartUsages') {
      const res = await fetchOrMigrateRepairPartUsages();
      if (res.partUsages) setRepairPartUsagesState(createLoadedDataset(res.partUsages));
    }
  };

  // State Updaters for Mutations
  const setRepairOrdersData = (updater: RepairOrder[] | ((prev: RepairOrder[]) => RepairOrder[])) => {
    setRepairOrdersState(prev => {
      const nextData = typeof updater === 'function' ? updater(prev.data) : updater;
      saveLocalRepairOrdersBackup(nextData);
      return createLoadedDataset(nextData);
    });
  };

  const setCustomersData = (updater: Customer[] | ((prev: Customer[]) => Customer[])) => {
    setCustomersState(prev => {
      const nextData = typeof updater === 'function' ? updater(prev.data) : updater;
      saveLocalCustomersBackup(nextData);
      return createLoadedDataset(nextData);
    });
  };

  const setProductsData = (updater: Product[] | ((prev: Product[]) => Product[])) => {
    setProductsState(prev => {
      const nextData = typeof updater === 'function' ? updater(prev.data) : updater;
      saveLocalProductsBackup(nextData);
      return createLoadedDataset(nextData);
    });
  };

  const setInvoicesData = (updater: Invoice[] | ((prev: Invoice[]) => Invoice[])) => {
    setInvoicesState(prev => {
      const nextData = typeof updater === 'function' ? updater(prev.data) : updater;
      saveLocalInvoicesBackup(nextData);
      return createLoadedDataset(nextData);
    });
  };

  const setPartUsagesData = (updater: RepairPartUsage[] | ((prev: RepairPartUsage[]) => RepairPartUsage[])) => {
    setRepairPartUsagesState(prev => {
      const nextData = typeof updater === 'function' ? updater(prev.data) : updater;
      saveLocalRepairPartUsagesBackup(nextData);
      return createLoadedDataset(nextData);
    });
  };

  const setSuppliersData = (updater: Supplier[] | ((prev: Supplier[]) => Supplier[])) => {
    setSuppliersState(prev => {
      const nextData = typeof updater === 'function' ? updater(prev.data) : updater;
      return createLoadedDataset(nextData);
    });
  };

  const setExpensesData = (updater: Expense[] | ((prev: Expense[]) => Expense[])) => {
    setExpensesState(prev => {
      const nextData = typeof updater === 'function' ? updater(prev.data) : updater;
      return createLoadedDataset(nextData);
    });
  };

  const setCategoriesData = (updater: ProductCategory[] | ((prev: ProductCategory[]) => ProductCategory[])) => {
    setCategoriesState(prev => {
      const nextData = typeof updater === 'function' ? updater(prev.data) : updater;
      return createLoadedDataset(nextData);
    });
  };

  const setSettingsData = (updater: SystemSettings | ((prev: SystemSettings) => SystemSettings)) => {
    setSettingsState(prev => {
      const nextData = typeof updater === 'function' ? updater(prev.data) : updater;
      return createLoadedDataset(nextData);
    });
  };

  const setUsersData = (updater: User[] | ((prev: User[]) => User[])) => {
    setUsersState(prev => {
      const nextData = typeof updater === 'function' ? updater(prev.data) : updater;
      return createLoadedDataset(nextData);
    });
  };

  const setPartnersData = (updater: Partner[] | ((prev: Partner[]) => Partner[])) => {
    setPartnersState(prev => {
      const nextData = typeof updater === 'function' ? updater(prev.data) : updater;
      return createLoadedDataset(nextData);
    });
  };

  return (
    <AppDataContext.Provider
      value={{
        bootstrapState,
        bootstrapError,
        currentUser,
        hasOwner,
        timeline,

        repairOrdersState,
        customersState,
        productsState,
        repairPartUsagesState,
        inventoryMovementsState,
        invoicesState,
        settingsState,
        categoriesState,
        suppliersState,
        expensesState,
        usersState,
        deviceTypesState,
        deviceModelsState,
        repairTemplatesState,
        partnersState,
        partnerLedgerState,
        partnerSettlementsState,
        partnerTransactionsState,
        activityLogsState,

        retryBootstrap,
        handleLoginSuccess,
        handleLogout,

        setRepairOrdersData,
        setCustomersData,
        setProductsData,
        setInvoicesData,
        setPartUsagesData,
        setSuppliersData,
        setExpensesData,
        setCategoriesData,
        setSettingsData,
        setUsersData,
        setPartnersData,

        refetchDataset
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
};

export function useAppData(): AppDataContextType {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error('useAppData must be used within an AppDataProvider');
  }
  return context;
}
