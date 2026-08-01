/**
 * Centralized Data Hooks (Phase 3 Bootstrap Refactor)
 * Delegates shared datasets to AppDataContext.
 * Eliminates duplicate initial queries, fetch storms, and unauthenticated state overwrites.
 * @license Apache-2.0
 */

import { useAppData } from "../context/AppDataContext";
import {
  db,
  addCategoryToSupabase,
  updateCategoryInSupabase,
  deleteCategoryFromSupabase,
  getCategoriesFromSupabase,
  addProductToSupabase,
  updateProductInSupabase,
  deleteProductFromSupabase,
  withdrawProductForPartner,
  returnProductFromPartner,
  addCustomerToSupabase,
  updateCustomerInSupabase,
  deleteCustomerFromSupabase,
  addDeviceTypeToSupabase,
  updateDeviceTypeInSupabase,
  deleteDeviceTypeInSupabase,
  fetchDeviceTypesFromSupabase,
  addDeviceModelToSupabase,
  updateDeviceModelInSupabase,
  deleteDeviceModelInSupabase,
  fetchDeviceModelsFromSupabase,
  addRepairTemplateToSupabase,
  updateRepairTemplateInSupabase,
  deleteRepairTemplateInSupabase,
  fetchRepairTemplatesFromSupabase,
  addSupplierToSupabase,
  updateSupplierInSupabase,
  deleteSupplierFromSupabase,
  addInvoiceToSupabase,
  cancelInvoiceInSupabase,
  addRepairOrderToSupabase,
  updateRepairOrderInSupabase,
  deleteRepairOrderFromSupabase
} from "../lib/data";
import { addRepairPartUsageToSupabase } from "../lib/supabasePartUsages";
import { addExpenseToSupabase } from "../lib/supabaseExpenses";
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
  PartnerTransaction,
  RepairPartUsage,
  SettlementAuditLog
} from "../types";

export function useCustomers() {
  const { customersState, setCustomersData } = useAppData();

  const addCustomer = async (
    customerData: Omit<Customer, "id" | "createdAt" | "balance"> & { balance?: number },
    currentUser?: User
  ) => {
    const newCust = await addCustomerToSupabase(customerData, currentUser);
    setCustomersData(prev => [newCust, ...prev.filter(c => c.id !== newCust.id && c.phone !== newCust.phone)]);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_customers' } }));
    return newCust;
  };

  const updateCustomer = async (customer: Customer, currentUser?: User) => {
    const updated = await updateCustomerInSupabase(customer, currentUser);
    setCustomersData(prev => prev.map(c => c.id === updated.id ? updated : c));
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_customers' } }));
    return updated;
  };

  const deleteCustomer = async (id: string, currentUser?: User) => {
    const res = await deleteCustomerFromSupabase(id, currentUser);
    if (res.success) {
      setCustomersData(prev => prev.filter(c => c.id !== id));
      window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_customers' } }));
    }
    return res;
  };

  return {
    customers: customersState.data,
    loading: customersState.isLoading || !customersState.isLoaded,
    isLoaded: customersState.isLoaded,
    error: customersState.error,
    addCustomer,
    updateCustomer,
    deleteCustomer
  };
}

export function useRepairOrders() {
  const { repairOrdersState, setRepairOrdersData } = useAppData();

  const addRepairOrder = async (
    order: Omit<RepairOrder, "id" | "receivedDate" | "trackingToken">,
    currentUser?: User
  ) => {
    const created = await addRepairOrderToSupabase(order, currentUser);
    setRepairOrdersData(prev => [created, ...prev.filter(o => o.id !== created.id)]);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_repair_orders' } }));
    return created;
  };

  const updateRepairOrder = async (order: RepairOrder, currentUser?: User) => {
    const updated = await updateRepairOrderInSupabase(order, currentUser);
    setRepairOrdersData(prev => prev.map(o => o.id === updated.id ? updated : o));
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_repair_orders' } }));
    return updated;
  };

  const deleteRepairOrder = async (id: string, currentUser?: User) => {
    const res = await deleteRepairOrderFromSupabase(id, currentUser);
    if (res.success) {
      setRepairOrdersData(prev => prev.filter(o => o.id !== id));
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
      setRepairOrdersData(prev => prev.map(o => o.id === res.order!.id ? res.order! : o));
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
      setRepairOrdersData(prev => prev.map(o => o.id === res.order!.id ? res.order! : o));
      window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_repair_orders' } }));
    }
    return res;
  };

  const setRepairOrderLocal = (order: RepairOrder) => {
    setRepairOrdersData(prev => prev.map(item => item.id === order.id ? order : item));
  };

  return {
    orders: repairOrdersState.data,
    loading: repairOrdersState.isLoading || !repairOrdersState.isLoaded,
    isLoaded: repairOrdersState.isLoaded,
    error: repairOrdersState.error,
    setRepairOrderLocal,
    addRepairOrder,
    updateRepairOrder,
    deleteRepairOrder,
    deliverRepairOrder,
    reopenRepairOrder
  };
}

export function useProducts() {
  const { productsState, setProductsData } = useAppData();

  const addProduct = async (product: Omit<Product, "id">, userId?: string) => {
    const newProd = await addProductToSupabase(product, userId);
    setProductsData(prev => [newProd, ...prev.filter(p => p.id !== newProd.id)]);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_products' } }));
    return newProd;
  };

  const updateProduct = async (product: Product, userId?: string, reason?: string) => {
    const updated = await updateProductInSupabase(product, userId, reason);
    setProductsData(prev => prev.map(p => p.id === updated.id ? updated : p));
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_products' } }));
    return updated;
  };

  const deleteProduct = async (id: string, currentUser?: any) => {
    const res = await deleteProductFromSupabase(id, currentUser);
    if (res.success) {
      setProductsData(prev => prev.filter(p => p.id !== id));
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
      setProductsData(prev =>
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
      setProductsData(prev =>
        prev.map(p => (p.id === params.productId ? { ...p, quantity: res.newQuantity } : p))
      );
    }
    return res;
  };

  const setProductLocal = (product: Product) => {
    setProductsData(prev => prev.map(item => item.id === product.id ? product : item));
  };

  return {
    products: productsState.data,
    loading: productsState.isLoading || !productsState.isLoaded,
    isLoaded: productsState.isLoaded,
    error: productsState.error,
    setProductLocal,
    addProduct,
    updateProduct,
    deleteProduct,
    withdrawProduct,
    returnProduct
  };
}

export function useInventoryMovements(productId?: string) {
  const { inventoryMovementsState } = useAppData();

  const filteredMovements = productId
    ? inventoryMovementsState.data.filter(m => m.productId === productId || m.product_id === productId)
    : inventoryMovementsState.data;

  return {
    movements: filteredMovements,
    loading: inventoryMovementsState.isLoading || !inventoryMovementsState.isLoaded,
    isLoaded: inventoryMovementsState.isLoaded
  };
}

export function useSuppliers() {
  const { suppliersState, setSuppliersData } = useAppData();

  const addSupplier = async (supplier: Omit<Supplier, "id">, currentUser?: User) => {
    const newSupplier = await addSupplierToSupabase(supplier, currentUser);
    setSuppliersData(prev => [newSupplier, ...prev.filter(s => s.id !== newSupplier.id)]);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_suppliers' } }));
    return newSupplier;
  };

  const updateSupplier = async (supplier: Supplier, currentUser?: User) => {
    const updated = await updateSupplierInSupabase(supplier, currentUser);
    setSuppliersData(prev => prev.map(s => s.id === updated.id ? updated : s));
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_suppliers' } }));
    return updated;
  };

  const deleteSupplier = async (id: string, currentUser?: User) => {
    const res = await deleteSupplierFromSupabase(id, currentUser);
    if (res.success) {
      setSuppliersData(prev => prev.filter(s => s.id !== id));
      window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_suppliers' } }));
    }
    return res;
  };

  return {
    suppliers: suppliersState.data,
    loading: suppliersState.isLoading || !suppliersState.isLoaded,
    isLoaded: suppliersState.isLoaded,
    error: suppliersState.error,
    addSupplier,
    updateSupplier,
    deleteSupplier
  };
}

export function useInvoices() {
  const { invoicesState, setInvoicesData } = useAppData();

  const addInvoice = async (
    invoiceData: Omit<Invoice, "id" | "date"> & { date?: string },
    currentUser?: User
  ) => {
    const newInv = await addInvoiceToSupabase(invoiceData, currentUser);
    setInvoicesData(prev => [newInv, ...prev.filter(i => i.id !== newInv.id)]);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_invoices' } }));
    return newInv;
  };

  const cancelInvoice = async (invoiceId: string, reason: string, currentUser?: User) => {
    const res = await cancelInvoiceInSupabase(invoiceId, reason, currentUser);
    if (res.success) {
      setInvoicesData(prev => prev.map(i => i.id === invoiceId ? { ...i, status: 'cancelled', isPaid: false } : i));
      window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_invoices' } }));
    }
    return res;
  };

  return {
    invoices: invoicesState.data,
    loading: invoicesState.isLoading || !invoicesState.isLoaded,
    isLoaded: invoicesState.isLoaded,
    error: invoicesState.error,
    addInvoice,
    cancelInvoice
  };
}

export function useExpenses() {
  const { expensesState, setExpensesData } = useAppData();

  const addExpense = (expense: Omit<Expense, "id" | "date">) => {
    addExpenseToSupabase(expense);
    const created = db.addExpense(expense);
    setExpensesData(prev => [created, ...prev]);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_expenses' } }));
    return created;
  };

  return {
    expenses: expensesState.data,
    loading: expensesState.isLoading || !expensesState.isLoaded,
    isLoaded: expensesState.isLoaded,
    addExpense
  };
}

export function useSettings() {
  const { settingsState, setSettingsData } = useAppData();

  const updateSettings = (newSettings: SystemSettings) => {
    db.saveSettings(newSettings);
    setSettingsData(newSettings);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_settings' } }));
  };

  return {
    settings: settingsState.data,
    updateSettings
  };
}

export function useCurrentUser() {
  const { currentUser } = useAppData();

  const changeCurrentUser = (newUser: User) => {
    db.setCurrentUser(newUser);
    window.dispatchEvent(new CustomEvent('atari_auth_changed', { detail: { key: 'atari_auth' } }));
  };

  return {
    user: currentUser || db.getCurrentUser(),
    changeCurrentUser
  };
}

export function useUsers() {
  const { usersState, setUsersData } = useAppData();

  const addUser = (user: Omit<User, "id">) => {
    const list = db.getUsers();
    const newUser: User = {
      ...user,
      id: `U-${String(list.length + 101).padStart(3, "0")}`
    };
    list.push(newUser);
    db.saveUsers(list);
    db.logActivity("U-101", "أحمد محمد", "إضافة مستخدم", `تم إضافة الموظف الجديد ${newUser.name}`);
    setUsersData(prev => [...prev, newUser]);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_users' } }));
    return newUser;
  };

  const updateUser = (user: User) => {
    const list = db.getUsers();
    const index = list.findIndex(u => u.id === user.id);
    if (index !== -1) {
      list[index] = user;
      db.saveUsers(list);
      setUsersData(prev => prev.map(u => u.id === user.id ? user : u));
      window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_users' } }));
    }
  };

  return {
    users: usersState.data,
    addUser,
    updateUser
  };
}

export function useActivityLogs() {
  const { activityLogsState } = useAppData();
  return { logs: activityLogsState.data };
}

export function useCategories() {
  const { categoriesState, setCategoriesData } = useAppData();

  const addCategory = async (cat: Omit<ProductCategory, "id">) => {
    const newCat = await addCategoryToSupabase(cat);
    const refreshed = await getCategoriesFromSupabase();
    setCategoriesData(refreshed);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_categories' } }));
    return newCat;
  };

  const updateCategory = async (cat: ProductCategory) => {
    const updated = await updateCategoryInSupabase(cat);
    const refreshed = await getCategoriesFromSupabase();
    setCategoriesData(refreshed);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_categories' } }));
    return updated;
  };

  const deleteCategory = async (id: string, name?: string) => {
    const targetCat = categoriesState.data.find(c => c.id === id || c.name === name);
    const catName = name || targetCat?.name || '';
    const res = await deleteCategoryFromSupabase(id, catName);
    if (res.success) {
      const refreshed = await getCategoriesFromSupabase();
      setCategoriesData(refreshed);
      window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_categories' } }));
    }
    return res;
  };

  return {
    categories: categoriesState.data,
    loading: categoriesState.isLoading || !categoriesState.isLoaded,
    isLoaded: categoriesState.isLoaded,
    error: categoriesState.error,
    addCategory,
    updateCategory,
    deleteCategory
  };
}

export function useDeviceTypes() {
  const { deviceTypesState } = useAppData();

  const addDeviceType = async (dt: Omit<DBDeviceType, "id">) => {
    const created = await addDeviceTypeToSupabase(dt);
    await fetchDeviceTypesFromSupabase();
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_device_types' } }));
    return created;
  };

  const updateDeviceType = async (dt: DBDeviceType) => {
    await updateDeviceTypeInSupabase(dt);
    await fetchDeviceTypesFromSupabase();
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_device_types' } }));
  };

  const deleteDeviceType = async (id: string) => {
    const res = await deleteDeviceTypeInSupabase(id);
    await fetchDeviceTypesFromSupabase();
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_device_types' } }));
    return res;
  };

  return {
    deviceTypes: deviceTypesState.data,
    addDeviceType,
    updateDeviceType,
    deleteDeviceType
  };
}

export function useDeviceModels() {
  const { deviceModelsState } = useAppData();

  const addDeviceModel = async (m: Omit<DBDeviceModel, "id">) => {
    const created = await addDeviceModelToSupabase(m);
    await fetchDeviceModelsFromSupabase();
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_device_models' } }));
    return created;
  };

  const updateDeviceModel = async (m: DBDeviceModel) => {
    await updateDeviceModelInSupabase(m);
    await fetchDeviceModelsFromSupabase();
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_device_models' } }));
  };

  const deleteDeviceModel = async (id: string) => {
    const res = await deleteDeviceModelInSupabase(id);
    await fetchDeviceModelsFromSupabase();
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_device_models' } }));
    return res;
  };

  return {
    deviceModels: deviceModelsState.data,
    addDeviceModel,
    updateDeviceModel,
    deleteDeviceModel
  };
}

export function useCommonFaults() {
  const addCommonFault = (f: Omit<CommonFault, "id">) => {
    const created = db.addCommonFault(f);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_common_faults' } }));
    return created;
  };

  const updateCommonFault = (f: CommonFault) => {
    db.updateCommonFault(f);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_common_faults' } }));
  };

  const deleteCommonFault = (id: string) => {
    const res = db.deleteCommonFault(id);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_common_faults' } }));
    return res;
  };

  return {
    commonFaults: db.getCommonFaults(),
    addCommonFault,
    updateCommonFault,
    deleteCommonFault
  };
}

export function useRepairServices() {
  const addRepairService = (s: Omit<RepairService, "id">) => {
    const created = db.addRepairService(s);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_repair_services' } }));
    return created;
  };

  const updateRepairService = (s: RepairService) => {
    db.updateRepairService(s);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_repair_services' } }));
  };

  const deleteRepairService = (id: string) => {
    const res = db.deleteRepairService(id);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_repair_services' } }));
    return res;
  };

  return {
    repairServices: db.getRepairServices(),
    addRepairService,
    updateRepairService,
    deleteRepairService
  };
}

export function useDefaultPrices() {
  const addDefaultPrice = (p: Omit<DefaultPrice, "id">) => {
    const created = db.addDefaultPrice(p);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_default_prices' } }));
    return created;
  };

  const updateDefaultPrice = (p: DefaultPrice) => {
    db.updateDefaultPrice(p);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_default_prices' } }));
  };

  const deleteDefaultPrice = (id: string) => {
    const res = db.deleteDefaultPrice(id);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_default_prices' } }));
    return res;
  };

  return {
    defaultPrices: db.getDefaultPrices(),
    addDefaultPrice,
    updateDefaultPrice,
    deleteDefaultPrice
  };
}

export function useReceivedAccessories() {
  const addReceivedAccessory = (acc: Omit<ReceivedAccessory, "id">) => {
    const created = db.addReceivedAccessory(acc);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_received_accessories' } }));
    return created;
  };

  const updateReceivedAccessory = (acc: ReceivedAccessory) => {
    db.updateReceivedAccessory(acc);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_received_accessories' } }));
  };

  const deleteReceivedAccessory = (id: string) => {
    const res = db.deleteReceivedAccessory(id);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_received_accessories' } }));
    return res;
  };

  return {
    receivedAccessories: db.getReceivedAccessories(),
    addReceivedAccessory,
    updateReceivedAccessory,
    deleteReceivedAccessory
  };
}

export function useDeviceConditions() {
  const addDeviceCondition = (cond: Omit<DeviceCondition, "id">) => {
    const created = db.addDeviceCondition(cond);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_device_conditions' } }));
    return created;
  };

  const updateDeviceCondition = (cond: DeviceCondition) => {
    db.updateDeviceCondition(cond);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_device_conditions' } }));
  };

  const deleteDeviceCondition = (id: string) => {
    const res = db.deleteDeviceCondition(id);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_device_conditions' } }));
    return res;
  };

  return {
    deviceConditions: db.getDeviceConditions(),
    addDeviceCondition,
    updateDeviceCondition,
    deleteDeviceCondition
  };
}

export function useRepairTemplates() {
  const { repairTemplatesState } = useAppData();

  const addRepairTemplateItem = async (item: Omit<RepairTemplateItem, "id">) => {
    const created = await addRepairTemplateToSupabase(item);
    await fetchRepairTemplatesFromSupabase();
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_repair_templates' } }));
    return created;
  };

  const updateRepairTemplateItem = async (item: RepairTemplateItem) => {
    const updated = await updateRepairTemplateInSupabase(item);
    await fetchRepairTemplatesFromSupabase();
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_repair_templates' } }));
    return updated;
  };

  const deleteRepairTemplateItem = async (id: string) => {
    const res = await deleteRepairTemplateInSupabase(id);
    await fetchRepairTemplatesFromSupabase();
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_repair_templates' } }));
    return res;
  };

  return {
    repairTemplates: repairTemplatesState.data,
    addRepairTemplateItem,
    updateRepairTemplateItem,
    deleteRepairTemplateItem
  };
}

export function usePartners() {
  const { partnersState, setPartnersData } = useAppData();

  const updatePartner = (partner: Partner) => {
    db.updatePartner(partner);
    setPartnersData(prev => prev.map(p => p.id === partner.id ? partner : p));
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_partners' } }));
  };

  return {
    partners: partnersState.data,
    updatePartner
  };
}

export function usePartnerLedger() {
  const { partnerLedgerState } = useAppData();

  const addLedgerEntry = (entry: Omit<PartnerLedgerEntry, "id" | "createdAt" | "updatedAt">) => {
    const created = db.addPartnerLedgerEntry(entry);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_partner_ledger' } }));
    return created;
  };

  return {
    ledger: partnerLedgerState.data,
    addLedgerEntry
  };
}

export function usePartnerSettlements() {
  const { partnerSettlementsState } = useAppData();

  return {
    settlements: partnerSettlementsState.data,
    calculateSettlement: db.calculateSettlement,
    createDraftSettlement: (...args: Parameters<typeof db.createDraftSettlement>) => {
      const res = db.createDraftSettlement(...args);
      window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_partner_settlements' } }));
      return res;
    },
    lockSettlement: (...args: Parameters<typeof db.lockSettlement>) => {
      const res = db.lockSettlement(...args);
      window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_partner_settlements' } }));
      return res;
    },
    reverseSettlement: (...args: Parameters<typeof db.reverseSettlement>) => {
      const res = db.reverseSettlement(...args);
      window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_partner_settlements' } }));
      return res;
    },
    recordSettlementPayment: (...args: Parameters<typeof db.recordSettlementPayment>) => {
      const res = db.recordSettlementPayment(...args);
      window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_partner_settlements' } }));
      return res;
    }
  };
}

export function usePartnerTransactions() {
  const { partnerTransactionsState } = useAppData();

  const addTransaction = (tx: Omit<PartnerTransaction, "id" | "createdAt" | "status">) => {
    const created = db.addPartnerTransaction(tx);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_partner_transactions' } }));
    return created;
  };

  const reverseTransaction = (id: string, userId: string, reason: string) => {
    const res = db.reversePartnerTransaction(id, userId, reason);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_partner_transactions' } }));
    return res;
  };

  const deleteDraftTransaction = (id: string, userId: string) => {
    const res = db.deleteDraftPartnerTransaction(id, userId);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_partner_transactions' } }));
    return res;
  };

  return {
    transactions: partnerTransactionsState.data,
    addTransaction,
    reverseTransaction,
    deleteDraftTransaction
  };
}

export function useRepairPartUsages() {
  const {
    repairPartUsagesState,
    setPartUsagesData,
    registerPendingPartUsage,
    replacePendingPartUsage,
    removePendingPartUsage,
    pendingRepairPartUsagesRef
  } = useAppData();

  const persistLocalUsages = (next: RepairPartUsage[]) => {
    setPartUsagesData(next);
    db.saveRepairPartUsages(next);
  };

  const upsertPartUsageLocal = (usage: RepairPartUsage) => {
    setPartUsagesData(prev => {
      const exists = prev.some(item => item.id === usage.id);
      const next = exists
        ? prev.map(item => item.id === usage.id ? usage : item)
        : [...prev, usage];
      db.saveRepairPartUsages(next);
      return next;
    });
  };

  const patchPartUsageLocal = (id: string, updates: Partial<RepairPartUsage>) => {
    setPartUsagesData(prev => {
      const next = prev.map(item => item.id === id ? { ...item, ...updates } : item);
      db.saveRepairPartUsages(next);
      return next;
    });
  };

  const markPartUsageReturnedLocal = (id: string) => {
    console.log("🔥 [INVOCATION] markPartUsageReturned / markPartUsageReturnedLocal called:", {
      timestamp: new Date().toISOString(),
      id,
      stack: new Error().stack
    });
    patchPartUsageLocal(id, { accountingStatus: 'RETURNED' });
  };

  const removeTemporaryPartUsageLocal = (id: string) => {
    removePendingPartUsage(id);
    setPartUsagesData(prev => {
      const next = prev.filter(item => item.id !== id);
      db.saveRepairPartUsages(next);
      return next;
    });
  };

  const replacePartUsageIdLocal = (temporaryId: string, persisted: RepairPartUsage) => {
    console.log("🔥 [INVOCATION] replacePartUsageIdLocal called:", {
      timestamp: new Date().toISOString(),
      temporaryId,
      persistedId: persisted?.id,
      stack: new Error().stack
    });
    replacePendingPartUsage(temporaryId, persisted);
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
    partUsages: repairPartUsagesState.data,
    addPartUsage,
    persistLocalUsages,
    upsertPartUsageLocal,
    patchPartUsageLocal,
    markPartUsageReturnedLocal,
    removeTemporaryPartUsageLocal,
    replacePartUsageIdLocal,
    registerPendingPartUsage,
    removePendingPartUsage,
    pendingRepairPartUsagesRef
  };
}

export function useSettlementAuditLogs() {
  return { auditLogs: db.getSettlementAuditLogs() };
}
