/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import { fetchOrMigrateRepairPartUsages, addRepairPartUsageToSupabase } from "../lib/supabasePartUsages";
import { fetchOrMigrateExpenses, addExpenseToSupabase } from "../lib/supabaseExpenses";
import { fetchOrMigratePartnerTransactions, fetchOrMigratePartnerLedger, fetchOrMigratePartnerSettlements } from "../lib/supabasePartnerAccounting";
import {
  db,
  fetchOrMigrateStoreSettings,
  fetchOrMigrateCategories,
  getCategoriesFromSupabase,
  addCategoryToSupabase,
  updateCategoryInSupabase,
  deleteCategoryFromSupabase,
  getLocalCategoriesBackup,
  fetchOrMigrateProducts,
  addProductToSupabase,
  updateProductInSupabase,
  deleteProductFromSupabase,
  withdrawProductForPartner,
  returnProductFromPartner,
  getInventoryMovements,
  getLocalProductsBackup,
  fetchOrMigrateCustomers,
  addCustomerToSupabase,
  updateCustomerInSupabase,
  deleteCustomerFromSupabase,
  getLocalCustomersBackup,
  fetchDeviceTypesFromSupabase,
  addDeviceTypeToSupabase,
  updateDeviceTypeInSupabase,
  deleteDeviceTypeInSupabase,
  getDeviceTypesSync,
  fetchDeviceModelsFromSupabase,
  addDeviceModelToSupabase,
  updateDeviceModelInSupabase,
  deleteDeviceModelInSupabase,
  getDeviceModelsSync,
  fetchRepairTemplatesFromSupabase,
  addRepairTemplateToSupabase,
  updateRepairTemplateInSupabase,
  deleteRepairTemplateInSupabase,
  getRepairTemplatesSync,
  fetchOrMigrateSuppliers,
  addSupplierToSupabase,
  updateSupplierInSupabase,
  deleteSupplierFromSupabase,
  getLocalSuppliersBackup,
  fetchOrMigrateInvoices,
  addInvoiceToSupabase,
  cancelInvoiceInSupabase,
  getLocalInvoicesBackup,
  fetchOrMigrateRepairOrders,
  addRepairOrderToSupabase,
  updateRepairOrderInSupabase,
  deleteRepairOrderFromSupabase,
  getLocalRepairOrdersBackup
} from "../lib/data";
import {
  Customer,
  RepairOrder,
  Product,
  Supplier,
  Invoice,
  Expense,
  User,
  ActivityLog,
  SystemSettings,
  PaymentMethod,
  ProductCategory,
  DBDeviceType,
  DBDeviceModel,
  CommonFault,
  RepairService,
  DefaultPrice,
  ReceivedAccessory,
  DeviceCondition,
  RepairTemplateItem,
  Partner,
  PartnerLedgerEntry,
  PartnerSettlement,
  PartnerSettlementPayment,
  PartnerTransaction,
  RepairPartUsage,
  SettlementAuditLog
} from "../types";

// Global Supabase Realtime channel subscription flag
let realtimeSubscribed = false;

// Global trigger listener
function useDbTrigger(watchedKeys?: string[]) {
  const [trigger, setTrigger] = useState(0);
  const watchedKeysRef = useRef<string[] | undefined>(watchedKeys);
  watchedKeysRef.current = watchedKeys;

  useEffect(() => {
    const normalizeKey = (value?: string) => {
      if (!value) return '';
      return value.startsWith('atari_') ? value : `atari_${value}`;
    };

    const handleDbChange = (event?: Event) => {
      const detail = (event as CustomEvent | undefined)?.detail as any;
      const changedKey = normalizeKey(detail?.key || detail?.table);
      const keys = watchedKeysRef.current;

      if (keys && keys.length > 0) {
        // Scoped listener: only trigger if event matches one of the scoped keys, or if event has no key (e.g. auth event)
        if (!changedKey || keys.some(key => normalizeKey(key) === changedKey)) {
          setTrigger(prev => prev + 1);
        }
      } else {
        // Unscoped listener: only trigger if event has no specific key OR is explicit auth change
        if (!changedKey || event?.type === 'atari_auth_changed') {
          setTrigger(prev => prev + 1);
        }
      }
    };

    window.addEventListener("atari_db_changed", handleDbChange);
    window.addEventListener("atari_auth_changed", handleDbChange);

    // Setup Supabase Realtime Postgres Changes Listener (once)
    if (!realtimeSubscribed && isSupabaseConfigured) {
      try {
        realtimeSubscribed = true;
        supabase
          .channel('public-realtime-db')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public' },
            (payload) => {
              console.log('⚡ Supabase Realtime change event received:', payload.table, payload.eventType);
              window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: payload }));
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              console.log('📡 Subscribed to Supabase Realtime DB changes');
            }
          });
      } catch (err) {
        console.warn("⚠️ Supabase Realtime connection warning:", err);
      }
    }

    return () => {
      window.removeEventListener("atari_db_changed", handleDbChange);
      window.removeEventListener("atari_auth_changed", handleDbChange);
    };
  }, []);

  return trigger;
}

export function useCustomers() {
  const trigger = useDbTrigger(['atari_customers']);
  const [customers, setCustomers] = useState<Customer[]>(getLocalCustomersBackup());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    fetchOrMigrateCustomers()
      .then(res => {
        if (active) {
          setCustomers(res.customers);
          setLoading(false);
          if (!res.success && res.error) {
            setError(res.error);
          } else {
            setError(null);
          }
        }
      })
      .catch(err => {
        if (active) {
          console.warn("⚠️ Error fetching customers from Supabase:", err);
          setError(err?.message || "تعذر الاتصال بـ Supabase لقراءة العملاء");
          setCustomers(getLocalCustomersBackup());
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [trigger]);

  const addCustomer = async (
    customerData: Omit<Customer, "id" | "createdAt" | "balance"> & { balance?: number },
    currentUser?: User
  ) => {
    const newCust = await addCustomerToSupabase(customerData, currentUser);
    setCustomers(prev => {
      const filtered = prev.filter(c => c.id !== newCust.id && c.phone !== newCust.phone);
      return [newCust, ...filtered];
    });
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_customers' } }));
    return newCust;
  };

  const updateCustomer = async (customer: Customer, currentUser?: User) => {
    const updated = await updateCustomerInSupabase(customer, currentUser);
    setCustomers(prev => prev.map(c => c.id === updated.id ? updated : c));
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_customers' } }));
    return updated;
  };

  const deleteCustomer = async (id: string, currentUser?: User) => {
    const res = await deleteCustomerFromSupabase(id, currentUser);
    if (res.success) {
      setCustomers(prev => prev.filter(c => c.id !== id));
      window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_customers' } }));
    }
    return res;
  };

  return { customers, loading, error, addCustomer, updateCustomer, deleteCustomer };
}

export function useRepairOrders() {
  const trigger = useDbTrigger(['atari_repair_orders']);
  const [orders, setOrders] = useState<RepairOrder[]>(getLocalRepairOrdersBackup());
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    fetchOrMigrateRepairOrders()
      .then(res => {
        if (active) {
          setOrders(prev => {
            const mergedMap = new Map<string, RepairOrder>();
            // 1. Put freshly fetched remote/backup orders
            (res.orders || []).forEach(o => mergedMap.set(o.id, o));
            // 2. Preserve any order currently in local memory or localStorage
            const backupLocal = getLocalRepairOrdersBackup();
            backupLocal.forEach(o => {
              if (!mergedMap.has(o.id)) {
                mergedMap.set(o.id, o);
              }
            });
            prev.forEach(o => {
              if (!mergedMap.has(o.id)) {
                mergedMap.set(o.id, o);
              }
            });
            return Array.from(mergedMap.values()).sort((a, b) => {
              return new Date(b.receivedDate || 0).getTime() - new Date(a.receivedDate || 0).getTime();
            });
          });
          setLoading(false);
          if (!res.success && res.error) {
            setError(res.error);
          } else {
            setError(null);
          }
        }
      })
      .catch(err => {
        if (active) {
          console.warn("⚠️ Error fetching repair orders from Supabase:", err);
          setError(err?.message || "تعذر الاتصال بـ Supabase لقراءة أوامر الصيانة");
          setOrders(getLocalRepairOrdersBackup());
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [trigger]);

  const addRepairOrder = async (
    order: Omit<RepairOrder, "id" | "receivedDate" | "trackingToken">,
    currentUser?: User
  ) => {
    const created = await addRepairOrderToSupabase(order, currentUser);
    setOrders(prev => [created, ...prev.filter(o => o.id !== created.id)]);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_repair_orders' } }));
    return created;
  };

  const updateRepairOrder = async (order: RepairOrder, currentUser?: User) => {
    const updated = await updateRepairOrderInSupabase(order, currentUser);
    setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_repair_orders' } }));
    return updated;
  };

  const deleteRepairOrder = async (id: string, currentUser?: User) => {
    const res = await deleteRepairOrderFromSupabase(id, currentUser);
    if (res.success) {
      setOrders(prev => prev.filter(o => o.id !== id));
      window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_repair_orders' } }));
    }
    return res;
  };

  const deliverRepairOrder = async (params: {
    orderId: string;
    paymentNow: number;
    paymentMethod: PaymentMethod | string;
    deliveryNotes?: string;
    currentUser: User;
  }) => {
    const res = db.deliverRepairOrder(params);
    if (res.success && res.order) {
      await updateRepairOrderInSupabase(res.order, params.currentUser).catch(err => {
        console.warn("Could not sync delivery status to Supabase:", err);
      });
      if (res.invoice) {
        await addInvoiceToSupabase(res.invoice, params.currentUser).catch(err => {
          console.warn("Could not sync delivery invoice to Supabase:", err);
        });
      }
      setOrders(prev => prev.map(o => o.id === res.order!.id ? res.order! : o));
      window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_repair_orders' } }));
      window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_invoices' } }));
      window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_customers' } }));
    }
    return res;
  };

  const reopenRepairOrder = async (orderId: string, currentUser: User, reason: string) => {
    const res = db.reopenRepairOrder(orderId, currentUser, reason);
    if (res.success && res.order) {
      await updateRepairOrderInSupabase(res.order, currentUser).catch(err => {
        console.warn("Could not sync reopen status to Supabase:", err);
      });
      setOrders(prev => prev.map(o => o.id === res.order!.id ? res.order! : o));
      window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_repair_orders' } }));
    }
    return res;
  };

  const setRepairOrderLocal = (order: RepairOrder) => {
    setOrders(prev => prev.map(item => item.id === order.id ? order : item));
  };

  return {
    orders,
    loading,
    error,
    setRepairOrderLocal,
    addRepairOrder,
    updateRepairOrder,
    deleteRepairOrder,
    deliverRepairOrder,
    reopenRepairOrder
  };
}

export function useProducts() {
  const trigger = useDbTrigger(['atari_products']);
  const [products, setProducts] = useState<Product[]>(getLocalProductsBackup());
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);

    fetchOrMigrateProducts()
      .then(res => {
        if (active) {
          setProducts(res.products);
          setError(null);
          setLoading(false);
        }
      })
      .catch(err => {
        if (active) {
          console.warn("⚠️ Error fetching products from Supabase:", err);
          setError(err?.message || "تعذر الاتصال بـ Supabase للقراءة");
          setProducts(getLocalProductsBackup());
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [trigger]);

  const addProduct = async (product: Omit<Product, "id">, userId?: string) => {
    const newProd = await addProductToSupabase(product, userId);
    setProducts(prev => [newProd, ...prev.filter(p => p.id !== newProd.id)]);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_products' } }));
    return newProd;
  };

  const updateProduct = async (product: Product, userId?: string, reason?: string) => {
    const updated = await updateProductInSupabase(product, userId, reason);
    setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_products' } }));
    return updated;
  };

  const deleteProduct = async (id: string, currentUser?: any) => {
    const res = await deleteProductFromSupabase(id, currentUser);
    if (res.success) {
      setProducts(prev => prev.filter(p => p.id !== id));
      window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_products' } }));
    }
    return res;
  };

  const withdrawProduct = async (params: {
    productId: string;
    quantity: number;
    partnerId: string;
    notes?: string;
    userId?: string;
  }) => {
    const res = await withdrawProductForPartner(params);
    if (res.success) {
      setProducts(prev =>
        prev.map(p => (p.id === params.productId ? { ...p, quantity: res.newQuantity } : p))
      );
    }
    return res;
  };

  const returnProduct = async (params: {
    productId: string;
    quantity: number;
    partnerId: string;
    notes?: string;
    userId?: string;
  }) => {
    const res = await returnProductFromPartner(params);
    if (res.success) {
      setProducts(prev =>
        prev.map(p => (p.id === params.productId ? { ...p, quantity: res.newQuantity } : p))
      );
    }
    return res;
  };

  const setProductLocal = (product: Product) => {
    setProducts(prev => prev.map(item => item.id === product.id ? product : item));
  };

  return { products, loading, error, setProductLocal, addProduct, updateProduct, deleteProduct, withdrawProduct, returnProduct };
}

export function useInventoryMovements(productId?: string) {
  const trigger = useDbTrigger(['atari_inventory_movements', 'atari_products']);
  const [movements, setMovements] = useState<any[]>(() => db.getInventoryMovements ? db.getInventoryMovements() : []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    requestId.current += 1;
    const currentRequestId = requestId.current;
    let active = true;
    setLoading(true);
    setError(null);

    const loadMovements = async () => {
      console.log('HOOK_INVENTORY_MOVEMENTS_FETCH_START=' + JSON.stringify({ productId }));
      try {
        const movs = await getInventoryMovements(productId);
        console.log('HOOK_INVENTORY_MOVEMENTS_FETCH_SUCCESS=' + JSON.stringify({ productId, dataLength: movs?.length ?? 0 }));
        if (active && currentRequestId === requestId.current) {
          setMovements(movs ?? (db.getInventoryMovements ? db.getInventoryMovements() : []));
          setError(null);
        }
      } catch (err: any) {
        console.log('HOOK_INVENTORY_MOVEMENTS_FETCH_ERROR=' + JSON.stringify({ productId, error: err?.message || String(err) }));
        if (active && currentRequestId === requestId.current) {
          console.warn("⚠️ Error fetching inventory movements:", err);
          setMovements(prev => prev.length > 0 ? prev : (db.getInventoryMovements ? db.getInventoryMovements() : []));
          setError(err?.message || String(err));
        }
      } finally {
        if (active) {
          setLoading(false);
          console.log('HOOK_INVENTORY_MOVEMENTS_LOADING_FALSE=' + JSON.stringify({ productId }));
        }
      }
    };

    loadMovements();

    return () => {
      active = false;
    };
  }, [trigger, productId]);

  useEffect(() => {
    console.log('HOOK_INVENTORY_MOVEMENTS_RENDER=' + JSON.stringify({
      loading,
      dataLength: movements.length
    }));
  }, [loading, movements.length]);

  return { movements, loading, error };
}

export function useSuppliers() {
  const trigger = useDbTrigger(['atari_suppliers']);
  const [suppliers, setSuppliers] = useState<Supplier[]>(getLocalSuppliersBackup());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    fetchOrMigrateSuppliers()
      .then(res => {
        if (active) {
          setSuppliers(res.suppliers);
          setLoading(false);
          if (!res.success && res.error) {
            setError(res.error);
          } else {
            setError(null);
          }
        }
      })
      .catch(err => {
        if (active) {
          console.warn("⚠️ Error fetching suppliers from Supabase:", err);
          setError(err?.message || "تعذر الاتصال بـ Supabase لقراءة الموردين");
          setSuppliers(getLocalSuppliersBackup());
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [trigger]);

  const addSupplier = async (supplier: Omit<Supplier, "id">, currentUser?: User) => {
    const newSupplier = await addSupplierToSupabase(supplier, currentUser);
    setSuppliers(prev => [newSupplier, ...prev.filter(s => s.id !== newSupplier.id)]);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_suppliers' } }));
    return newSupplier;
  };

  const updateSupplier = async (supplier: Supplier, currentUser?: User) => {
    const updated = await updateSupplierInSupabase(supplier, currentUser);
    setSuppliers(prev => prev.map(s => s.id === updated.id ? updated : s));
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_suppliers' } }));
    return updated;
  };

  const deleteSupplier = async (id: string, currentUser?: User) => {
    const res = await deleteSupplierFromSupabase(id, currentUser);
    if (res.success) {
      setSuppliers(prev => prev.filter(s => s.id !== id));
      window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_suppliers' } }));
    }
    return res;
  };

  return { suppliers, loading, error, addSupplier, updateSupplier, deleteSupplier };
}

export function useInvoices() {
  const trigger = useDbTrigger(['atari_invoices']);
  const [invoices, setInvoices] = useState<Invoice[]>(getLocalInvoicesBackup());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    fetchOrMigrateInvoices()
      .then(res => {
        if (active) {
          setInvoices(res.invoices);
          setLoading(false);
          if (!res.success && res.error) {
            setError(res.error);
          } else {
            setError(null);
          }
        }
      })
      .catch(err => {
        if (active) {
          console.warn("⚠️ Error fetching invoices from Supabase:", err);
          setError(err?.message || "تعذر الاتصال بـ Supabase لقراءة الفواتير");
          setInvoices(getLocalInvoicesBackup());
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [trigger]);

  const addInvoice = async (
    invoiceData: Omit<Invoice, "id" | "date"> & { date?: string },
    currentUser?: User
  ) => {
    const newInv = await addInvoiceToSupabase(invoiceData, currentUser);
    setInvoices(prev => [newInv, ...prev.filter(i => i.id !== newInv.id)]);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_invoices' } }));
    return newInv;
  };

  const cancelInvoice = async (invoiceId: string, reason: string, currentUser?: User) => {
    const res = await cancelInvoiceInSupabase(invoiceId, reason, currentUser);
    if (res.success) {
      setInvoices(prev => prev.map(i => i.id === invoiceId ? { ...i, status: 'cancelled', isPaid: false } : i));
      window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_invoices' } }));
    }
    return res;
  };

  return { invoices, loading, error, addInvoice, cancelInvoice };
}

export function useExpenses() {
  const trigger = useDbTrigger(['atari_expenses']);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  useEffect(() => {
    let active = true;
    fetchOrMigrateExpenses().then(res => {
      if (active) setExpenses(res.expenses);
    }).catch(() => {
      if (active) setExpenses(db.getExpenses());
    });
    return () => { active = false; };
  }, [trigger]);

  const addExpense = (expense: Omit<Expense, "id" | "date">) => {
    addExpenseToSupabase(expense);
    const created = db.addExpense(expense);
    setExpenses(prev => [created, ...prev]);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_expenses' } }));
    return created;
  };

  return { expenses, addExpense };
}

export function useSettings() {
  const trigger = useDbTrigger(['atari_settings']);
  const [settings, setSettings] = useState<SystemSettings>(db.getSettings());

  useEffect(() => {
    let active = true;
    setSettings(db.getSettings());

    fetchOrMigrateStoreSettings().then(spSettings => {
      if (active && spSettings) {
        setSettings(spSettings);
      }
    });

    return () => {
      active = false;
    };
  }, [trigger]);

  const updateSettings = (newSettings: SystemSettings) => {
    db.saveSettings(newSettings);
    setSettings(newSettings);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_settings' } }));
  };

  return { settings, updateSettings };
}

export function useCurrentUser() {
  const trigger = useDbTrigger(['atari_auth', 'atari_users']);
  const [user, setUser] = useState<User>(db.getCurrentUser());

  useEffect(() => {
    setUser(db.getCurrentUser());
  }, [trigger]);

  const changeCurrentUser = (newUser: User) => {
    db.setCurrentUser(newUser);
    setUser(newUser);
    window.dispatchEvent(new CustomEvent('atari_auth_changed', { detail: { key: 'atari_auth' } }));
  };

  return { user, changeCurrentUser };
}

export function useUsers() {
  const trigger = useDbTrigger(['atari_users']);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    setUsers(db.getUsers());
  }, [trigger]);

  const addUser = (user: Omit<User, "id">) => {
    const list = db.getUsers();
    const newUser: User = {
      ...user,
      id: `U-${String(list.length + 101).padStart(3, "0")}`
    };
    list.push(newUser);
    db.saveUsers(list);
    db.logActivity("U-101", "أحمد محمد", "إضافة مستخدم", `تم إضافة الموظف الجديد ${newUser.name}`);
    setUsers(prev => [...prev, newUser]);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_users' } }));
    return newUser;
  };

  const updateUser = (user: User) => {
    const list = db.getUsers();
    const index = list.findIndex(u => u.id === user.id);
    if (index !== -1) {
      list[index] = user;
      db.saveUsers(list);
      setUsers(prev => prev.map(u => u.id === user.id ? user : u));
      window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_users' } }));
    }
  };

  return { users, addUser, updateUser };
}

export function useActivityLogs() {
  const trigger = useDbTrigger(['atari_activity_logs']);
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  useEffect(() => {
    setLogs(db.getActivityLogs());
  }, [trigger]);

  return { logs };
}

export function useCategories() {
  const trigger = useDbTrigger(['atari_categories']);
  const [categories, setCategories] = useState<ProductCategory[]>(getLocalCategoriesBackup());
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);

    fetchOrMigrateCategories()
      .then(res => {
        if (active) {
          setCategories(res.categories);
          setError(null);
          setLoading(false);
        }
      })
      .catch(err => {
        if (active) {
          console.warn("⚠️ Error fetching categories from Supabase:", err);
          setError(err?.message || "تعذر الاتصال بـ Supabase للقراءة");
          setCategories(getLocalCategoriesBackup());
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [trigger]);

  const addCategory = async (cat: Omit<ProductCategory, "id">) => {
    const newCat = await addCategoryToSupabase(cat);
    const refreshed = await getCategoriesFromSupabase();
    setCategories(refreshed);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_categories' } }));
    return newCat;
  };

  const updateCategory = async (cat: ProductCategory) => {
    const updated = await updateCategoryInSupabase(cat);
    const refreshed = await getCategoriesFromSupabase();
    setCategories(refreshed);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_categories' } }));
    return updated;
  };

  const deleteCategory = async (id: string, name?: string) => {
    const targetCat = categories.find(c => c.id === id || c.name === name);
    const catName = name || targetCat?.name || '';
    const res = await deleteCategoryFromSupabase(id, catName);
    if (res.success) {
      const refreshed = await getCategoriesFromSupabase();
      setCategories(refreshed);
      window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_categories' } }));
    }
    return res;
  };

  return { categories, loading, error, addCategory, updateCategory, deleteCategory };
}

export function useDeviceTypes() {
  const trigger = useDbTrigger(['atari_device_types']);
  const [deviceTypes, setDeviceTypes] = useState<DBDeviceType[]>(getDeviceTypesSync());

  useEffect(() => {
    fetchDeviceTypesFromSupabase().then(data => {
      setDeviceTypes(data);
    });
  }, [trigger]);

  const addDeviceType = async (dt: Omit<DBDeviceType, "id">) => {
    const created = await addDeviceTypeToSupabase(dt);
    const refreshed = await fetchDeviceTypesFromSupabase();
    setDeviceTypes(refreshed);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_device_types' } }));
    return created;
  };

  const updateDeviceType = async (dt: DBDeviceType) => {
    await updateDeviceTypeInSupabase(dt);
    const refreshed = await fetchDeviceTypesFromSupabase();
    setDeviceTypes(refreshed);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_device_types' } }));
  };

  const deleteDeviceType = async (id: string) => {
    const res = await deleteDeviceTypeInSupabase(id);
    const refreshed = await fetchDeviceTypesFromSupabase();
    setDeviceTypes(refreshed);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_device_types' } }));
    return res;
  };

  return { deviceTypes, addDeviceType, updateDeviceType, deleteDeviceType };
}

export function useDeviceModels() {
  const trigger = useDbTrigger(['atari_device_models']);
  const [deviceModels, setDeviceModels] = useState<DBDeviceModel[]>(getDeviceModelsSync());

  useEffect(() => {
    fetchDeviceModelsFromSupabase().then(data => {
      setDeviceModels(data);
    });
  }, [trigger]);

  const addDeviceModel = async (m: Omit<DBDeviceModel, "id">) => {
    const created = await addDeviceModelToSupabase(m);
    const refreshed = await fetchDeviceModelsFromSupabase();
    setDeviceModels(refreshed);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_device_models' } }));
    return created;
  };

  const updateDeviceModel = async (m: DBDeviceModel) => {
    await updateDeviceModelInSupabase(m);
    const refreshed = await fetchDeviceModelsFromSupabase();
    setDeviceModels(refreshed);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_device_models' } }));
  };

  const deleteDeviceModel = async (id: string) => {
    const res = await deleteDeviceModelInSupabase(id);
    const refreshed = await fetchDeviceModelsFromSupabase();
    setDeviceModels(refreshed);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_device_models' } }));
    return res;
  };

  return { deviceModels, addDeviceModel, updateDeviceModel, deleteDeviceModel };
}

export function useCommonFaults() {
  const trigger = useDbTrigger(['atari_common_faults']);
  const [commonFaults, setCommonFaults] = useState<CommonFault[]>([]);

  useEffect(() => {
    setCommonFaults(db.getCommonFaults());
  }, [trigger]);

  const addCommonFault = (f: Omit<CommonFault, "id">) => {
    const created = db.addCommonFault(f);
    setCommonFaults(db.getCommonFaults());
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_common_faults' } }));
    return created;
  };

  const updateCommonFault = (f: CommonFault) => {
    db.updateCommonFault(f);
    setCommonFaults(db.getCommonFaults());
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_common_faults' } }));
  };

  const deleteCommonFault = (id: string) => {
    const res = db.deleteCommonFault(id);
    setCommonFaults(db.getCommonFaults());
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_common_faults' } }));
    return res;
  };

  return { commonFaults, addCommonFault, updateCommonFault, deleteCommonFault };
}

export function useRepairServices() {
  const trigger = useDbTrigger(['atari_repair_services']);
  const [repairServices, setRepairServices] = useState<RepairService[]>([]);

  useEffect(() => {
    setRepairServices(db.getRepairServices());
  }, [trigger]);

  const addRepairService = (s: Omit<RepairService, "id">) => {
    const created = db.addRepairService(s);
    setRepairServices(db.getRepairServices());
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_repair_services' } }));
    return created;
  };

  const updateRepairService = (s: RepairService) => {
    db.updateRepairService(s);
    setRepairServices(db.getRepairServices());
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_repair_services' } }));
  };

  const deleteRepairService = (id: string) => {
    const res = db.deleteRepairService(id);
    setRepairServices(db.getRepairServices());
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_repair_services' } }));
    return res;
  };

  return { repairServices, addRepairService, updateRepairService, deleteRepairService };
}

export function useDefaultPrices() {
  const trigger = useDbTrigger(['atari_default_prices']);
  const [defaultPrices, setDefaultPrices] = useState<DefaultPrice[]>([]);

  useEffect(() => {
    setDefaultPrices(db.getDefaultPrices());
  }, [trigger]);

  const addDefaultPrice = (p: Omit<DefaultPrice, "id">) => {
    const created = db.addDefaultPrice(p);
    setDefaultPrices(db.getDefaultPrices());
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_default_prices' } }));
    return created;
  };

  const updateDefaultPrice = (p: DefaultPrice) => {
    db.updateDefaultPrice(p);
    setDefaultPrices(db.getDefaultPrices());
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_default_prices' } }));
  };

  const deleteDefaultPrice = (id: string) => {
    const res = db.deleteDefaultPrice(id);
    setDefaultPrices(db.getDefaultPrices());
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_default_prices' } }));
    return res;
  };

  return { defaultPrices, addDefaultPrice, updateDefaultPrice, deleteDefaultPrice };
}

export function useReceivedAccessories() {
  const trigger = useDbTrigger(['atari_received_accessories']);
  const [receivedAccessories, setReceivedAccessories] = useState<ReceivedAccessory[]>([]);

  useEffect(() => {
    setReceivedAccessories(db.getReceivedAccessories());
  }, [trigger]);

  const addReceivedAccessory = (acc: Omit<ReceivedAccessory, "id">) => {
    const created = db.addReceivedAccessory(acc);
    setReceivedAccessories(db.getReceivedAccessories());
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_received_accessories' } }));
    return created;
  };

  const updateReceivedAccessory = (acc: ReceivedAccessory) => {
    db.updateReceivedAccessory(acc);
    setReceivedAccessories(db.getReceivedAccessories());
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_received_accessories' } }));
  };

  const deleteReceivedAccessory = (id: string) => {
    const res = db.deleteReceivedAccessory(id);
    setReceivedAccessories(db.getReceivedAccessories());
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_received_accessories' } }));
    return res;
  };

  return { receivedAccessories, addReceivedAccessory, updateReceivedAccessory, deleteReceivedAccessory };
}

export function useDeviceConditions() {
  const trigger = useDbTrigger(['atari_device_conditions']);
  const [deviceConditions, setDeviceConditions] = useState<DeviceCondition[]>([]);

  useEffect(() => {
    setDeviceConditions(db.getDeviceConditions());
  }, [trigger]);

  const addDeviceCondition = (cond: Omit<DeviceCondition, "id">) => {
    const created = db.addDeviceCondition(cond);
    setDeviceConditions(db.getDeviceConditions());
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_device_conditions' } }));
    return created;
  };

  const updateDeviceCondition = (cond: DeviceCondition) => {
    db.updateDeviceCondition(cond);
    setDeviceConditions(db.getDeviceConditions());
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_device_conditions' } }));
  };

  const deleteDeviceCondition = (id: string) => {
    const res = db.deleteDeviceCondition(id);
    setDeviceConditions(db.getDeviceConditions());
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_device_conditions' } }));
    return res;
  };

  return { deviceConditions, addDeviceCondition, updateDeviceCondition, deleteDeviceCondition };
}

export function useRepairTemplates() {
  const trigger = useDbTrigger(['atari_repair_templates']);
  const [repairTemplates, setRepairTemplates] = useState<RepairTemplateItem[]>(getRepairTemplatesSync());

  useEffect(() => {
    fetchRepairTemplatesFromSupabase().then(data => {
      setRepairTemplates(data);
    });
  }, [trigger]);

  const addRepairTemplateItem = async (item: Omit<RepairTemplateItem, "id">) => {
    const created = await addRepairTemplateToSupabase(item);
    const refreshed = await fetchRepairTemplatesFromSupabase();
    setRepairTemplates(refreshed);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_repair_templates' } }));
    return created;
  };

  const updateRepairTemplateItem = async (item: RepairTemplateItem) => {
    const updated = await updateRepairTemplateInSupabase(item);
    const refreshed = await fetchRepairTemplatesFromSupabase();
    setRepairTemplates(refreshed);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_repair_templates' } }));
    return updated;
  };

  const deleteRepairTemplateItem = async (id: string) => {
    const res = await deleteRepairTemplateInSupabase(id);
    const refreshed = await fetchRepairTemplatesFromSupabase();
    setRepairTemplates(refreshed);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_repair_templates' } }));
    return res;
  };

  return { repairTemplates, addRepairTemplateItem, updateRepairTemplateItem, deleteRepairTemplateItem };
}

export function usePartners() {
  const trigger = useDbTrigger(['atari_partners']);
  const [partners, setPartners] = useState<Partner[]>([]);

  useEffect(() => {
    setPartners(db.getPartners());
  }, [trigger]);

  const updatePartner = (partner: Partner) => {
    db.updatePartner(partner);
    setPartners(db.getPartners());
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_partners' } }));
  };

  return { partners, updatePartner };
}

export function usePartnerLedger() {
  const trigger = useDbTrigger(['atari_partner_ledger']);
  const [ledger, setLedger] = useState<PartnerLedgerEntry[]>([]);

  useEffect(() => {
    let active = true;
    fetchOrMigratePartnerLedger().then(res => {
      if (active) setLedger(res.ledger);
    }).catch(() => {
      if (active) setLedger(db.getPartnerLedger());
    });
    return () => { active = false; };
  }, [trigger]);

  const addLedgerEntry = (entry: Omit<PartnerLedgerEntry, "id" | "createdAt" | "updatedAt">) => {
    const created = db.addPartnerLedgerEntry(entry);
    setLedger(db.getPartnerLedger());
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_partner_ledger' } }));
    return created;
  };

  return { ledger, addLedgerEntry };
}

export function usePartnerSettlements() {
  const trigger = useDbTrigger(['atari_partner_settlements']);
  const [settlements, setSettlements] = useState<PartnerSettlement[]>([]);

  useEffect(() => {
    let active = true;
    fetchOrMigratePartnerSettlements().then(res => {
      if (active) setSettlements(res.settlements);
    }).catch(() => {
      if (active) setSettlements(db.getPartnerSettlements());
    });
    return () => { active = false; };
  }, [trigger]);

  return {
    settlements,
    calculateSettlement: db.calculateSettlement,
    createDraftSettlement: (...args: Parameters<typeof db.createDraftSettlement>) => {
      const res = db.createDraftSettlement(...args);
      setSettlements(db.getPartnerSettlements());
      window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_partner_settlements' } }));
      return res;
    },
    lockSettlement: (...args: Parameters<typeof db.lockSettlement>) => {
      const res = db.lockSettlement(...args);
      setSettlements(db.getPartnerSettlements());
      window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_partner_settlements' } }));
      return res;
    },
    reverseSettlement: (...args: Parameters<typeof db.reverseSettlement>) => {
      const res = db.reverseSettlement(...args);
      setSettlements(db.getPartnerSettlements());
      window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_partner_settlements' } }));
      return res;
    },
    recordSettlementPayment: (...args: Parameters<typeof db.recordSettlementPayment>) => {
      const res = db.recordSettlementPayment(...args);
      setSettlements(db.getPartnerSettlements());
      window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_partner_settlements' } }));
      return res;
    }
  };
}

export function usePartnerTransactions() {
  const trigger = useDbTrigger(['atari_partner_transactions']);
  const [transactions, setTransactions] = useState<PartnerTransaction[]>([]);

  useEffect(() => {
    let active = true;
    fetchOrMigratePartnerTransactions().then(res => {
      if (active) setTransactions(res.transactions);
    }).catch(() => {
      if (active) setTransactions(db.getPartnerTransactions());
    });
    return () => { active = false; };
  }, [trigger]);

  const addTransaction = (tx: Omit<PartnerTransaction, "id" | "createdAt" | "status">) => {
    const created = db.addPartnerTransaction(tx);
    setTransactions(db.getPartnerTransactions());
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_partner_transactions' } }));
    return created;
  };

  const reverseTransaction = (id: string, userId: string, reason: string) => {
    const res = db.reversePartnerTransaction(id, userId, reason);
    setTransactions(db.getPartnerTransactions());
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_partner_transactions' } }));
    return res;
  };

  const deleteDraftTransaction = (id: string, userId: string) => {
    const res = db.deleteDraftPartnerTransaction(id, userId);
    setTransactions(db.getPartnerTransactions());
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_partner_transactions' } }));
    return res;
  };

  return { transactions, addTransaction, reverseTransaction, deleteDraftTransaction };
}

export function useRepairPartUsages() {
  const trigger = useDbTrigger(['atari_repair_part_usages']);
  const [partUsages, setPartUsages] = useState<RepairPartUsage[]>(() => db.getRepairPartUsages());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    requestId.current += 1;
    const currentRequestId = requestId.current;
    let active = true;
    setLoading(true);
    setError(null);

    const loadPartUsages = async () => {
      console.log('HOOK_REPAIR_PART_USAGES_FETCH_START=1');
      try {
        const res = await fetchOrMigrateRepairPartUsages();
        console.log('HOOK_REPAIR_PART_USAGES_FETCH_SUCCESS=' + JSON.stringify({ dataLength: res.partUsages?.length ?? 0, success: res.success, error: res.error }));
        if (active && currentRequestId === requestId.current) {
          setPartUsages(res.partUsages ?? db.getRepairPartUsages());
          setError(null);
        }
      } catch (err: any) {
        console.log('HOOK_REPAIR_PART_USAGES_FETCH_ERROR=' + JSON.stringify({ error: err?.message || String(err) }));
        if (active && currentRequestId === requestId.current) {
          setPartUsages(prev => prev.length > 0 ? prev : db.getRepairPartUsages());
          setError(err?.message || String(err));
        }
      } finally {
        if (active) {
          setLoading(false);
          console.log('HOOK_REPAIR_PART_USAGES_LOADING_FALSE=1');
        }
      }
    };

    loadPartUsages();
    return () => { active = false; };
  }, [trigger]);

  useEffect(() => {
    console.log('HOOK_REPAIR_PART_USAGES_RENDER=' + JSON.stringify({
      loading,
      dataLength: partUsages.length
    }));
  }, [loading, partUsages.length]);

  const persistLocalUsages = (next: RepairPartUsage[]) => {
    setPartUsages(next);
    db.saveRepairPartUsages(next);
  };

  const upsertPartUsageLocal = (usage: RepairPartUsage) => {
    setPartUsages(prev => {
      const exists = prev.some(item => item.id === usage.id);
      const next = exists
        ? prev.map(item => item.id === usage.id ? usage : item)
        : [...prev, usage];
      db.saveRepairPartUsages(next);
      return next;
    });
  };

  const replacePartUsageIdLocal = (temporaryId: string, persisted: RepairPartUsage) => {
    setPartUsages(prev => {
      const next = prev.map(item => item.id === temporaryId ? persisted : item);
      db.saveRepairPartUsages(next);
      return next;
    });
  };

  const addPartUsage = (part: Omit<RepairPartUsage, "id" | "createdAt">) => {
    const created = db.addRepairPartUsage(part);
    upsertPartUsageLocal(created);
    void addRepairPartUsageToSupabase(part).catch(err => {
      console.warn('Could not sync repair part usage:', err);
    });
    return created;
  };

  return {
    partUsages,
    addPartUsage,
    persistLocalUsages,
    upsertPartUsageLocal,
    replacePartUsageIdLocal
  };
}

export function useSettlementAuditLogs() {
  const trigger = useDbTrigger(['atari_settlement_audit_logs']);
  const [auditLogs, setAuditLogs] = useState<SettlementAuditLog[]>([]);

  useEffect(() => {
    setAuditLogs(db.getSettlementAuditLogs());
  }, [trigger]);

  return { auditLogs };
}

