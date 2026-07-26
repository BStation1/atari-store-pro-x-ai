/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { db } from "../lib/db";
import { fetchOrMigrateStoreSettings } from "../lib/supabaseSettings";
import {
  fetchOrMigrateCategories,
  getCategoriesFromSupabase,
  addCategoryToSupabase,
  updateCategoryInSupabase,
  deleteCategoryFromSupabase,
  getLocalCategoriesBackup
} from "../lib/supabaseCategories";
import {
  fetchOrMigrateProducts,
  addProductToSupabase,
  updateProductInSupabase,
  deleteProductFromSupabase,
  getLocalProductsBackup
} from "../lib/supabaseProducts";
import {
  fetchOrMigrateCustomers,
  addCustomerToSupabase,
  updateCustomerInSupabase,
  deleteCustomerFromSupabase,
  getLocalCustomersBackup
} from "../lib/supabaseCustomers";
import {
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
  getRepairTemplatesSync
} from "../lib/supabaseDeviceManager";
import {
  fetchOrMigrateSuppliers,
  addSupplierToSupabase,
  updateSupplierInSupabase,
  deleteSupplierFromSupabase,
  getLocalSuppliersBackup
} from "../lib/supabaseSuppliers";
import {
  fetchOrMigrateInvoices,
  addInvoiceToSupabase,
  cancelInvoiceInSupabase,
  getLocalInvoicesBackup
} from "../lib/supabaseInvoices";
import {
  fetchOrMigrateRepairOrders,
  addRepairOrderToSupabase,
  updateRepairOrderInSupabase,
  deleteRepairOrderFromSupabase,
  getLocalRepairOrdersBackup
} from "../lib/supabaseRepairOrders";
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

// Hook to trigger re-renders on custom DB and Auth update events
function useDbTrigger() {
  const [trigger, setTrigger] = useState(0);

  useEffect(() => {
    const handleDbChange = () => {
      setTrigger(prev => prev + 1);
    };

    window.addEventListener("atari_db_changed", handleDbChange);
    window.addEventListener("atari_auth_changed", handleDbChange);
    return () => {
      window.removeEventListener("atari_db_changed", handleDbChange);
      window.removeEventListener("atari_auth_changed", handleDbChange);
    };
  }, []);

  return trigger;
}

export function useCustomers() {
  const trigger = useDbTrigger();
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
  const trigger = useDbTrigger();
  const [orders, setOrders] = useState<RepairOrder[]>(getLocalRepairOrdersBackup());
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    fetchOrMigrateRepairOrders()
      .then(res => {
        if (active) {
          setOrders(res.orders);
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
    }
    return res;
  };

  const reopenRepairOrder = async (orderId: string, currentUser: User, reason: string) => {
    const res = db.reopenRepairOrder(orderId, currentUser, reason);
    if (res.success && res.order) {
      await updateRepairOrderInSupabase(res.order, currentUser).catch(err => {
        console.warn("Could not sync reopen status to Supabase:", err);
      });
    }
    return res;
  };

  return {
    orders,
    loading,
    error,
    addRepairOrder,
    updateRepairOrder,
    deleteRepairOrder,
    deliverRepairOrder,
    reopenRepairOrder
  };
}

export function useProducts() {
  const trigger = useDbTrigger();
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
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_products' } }));
    return newProd;
  };

  const updateProduct = async (product: Product, userId?: string, reason?: string) => {
    const updated = await updateProductInSupabase(product, userId, reason);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_products' } }));
    return updated;
  };

  const deleteProduct = async (id: string, currentUser?: any) => {
    const res = await deleteProductFromSupabase(id, currentUser);
    if (res.success) {
      window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_products' } }));
    }
    return res;
  };

  return { products, loading, error, addProduct, updateProduct, deleteProduct };
}

export function useSuppliers() {
  const trigger = useDbTrigger();
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
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_suppliers' } }));
    return newSupplier;
  };

  const updateSupplier = async (supplier: Supplier, currentUser?: User) => {
    const updated = await updateSupplierInSupabase(supplier, currentUser);
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_suppliers' } }));
    return updated;
  };

  const deleteSupplier = async (id: string, currentUser?: User) => {
    const res = await deleteSupplierFromSupabase(id, currentUser);
    if (res.success) {
      window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_suppliers' } }));
    }
    return res;
  };

  return { suppliers, loading, error, addSupplier, updateSupplier, deleteSupplier };
}

export function useInvoices() {
  const trigger = useDbTrigger();
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
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_invoices' } }));
    return newInv;
  };

  const cancelInvoice = async (invoiceId: string, reason: string, currentUser?: User) => {
    const res = await cancelInvoiceInSupabase(invoiceId, reason, currentUser);
    if (res.success) {
      window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_invoices' } }));
    }
    return res;
  };

  return { invoices, loading, error, addInvoice, cancelInvoice };
}

export function useExpenses() {
  const trigger = useDbTrigger();
  const [expenses, setExpenses] = useState<Expense[]>([]);

  useEffect(() => {
    setExpenses(db.getExpenses());
  }, [trigger]);

  const addExpense = (expense: Omit<Expense, "id" | "date">) => {
    return db.addExpense(expense);
  };

  return { expenses, addExpense };
}

export function useSettings() {
  const trigger = useDbTrigger();
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
  };

  return { settings, updateSettings };
}

export function useCurrentUser() {
  const trigger = useDbTrigger();
  const [user, setUser] = useState<User>(db.getCurrentUser());

  useEffect(() => {
    setUser(db.getCurrentUser());
  }, [trigger]);

  const changeCurrentUser = (newUser: User) => {
    db.setCurrentUser(newUser);
  };

  return { user, changeCurrentUser };
}

export function useUsers() {
  const trigger = useDbTrigger();
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
    return newUser;
  };

  const updateUser = (user: User) => {
    const list = db.getUsers();
    const index = list.findIndex(u => u.id === user.id);
    if (index !== -1) {
      list[index] = user;
      db.saveUsers(list);
    }
  };

  return { users, addUser, updateUser };
}

export function useActivityLogs() {
  const trigger = useDbTrigger();
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  useEffect(() => {
    setLogs(db.getActivityLogs());
  }, [trigger]);

  return { logs };
}

export function useCategories() {
  const trigger = useDbTrigger();
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
  const trigger = useDbTrigger();
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
    return created;
  };

  const updateDeviceType = async (dt: DBDeviceType) => {
    await updateDeviceTypeInSupabase(dt);
    const refreshed = await fetchDeviceTypesFromSupabase();
    setDeviceTypes(refreshed);
  };

  const deleteDeviceType = async (id: string) => {
    const res = await deleteDeviceTypeInSupabase(id);
    const refreshed = await fetchDeviceTypesFromSupabase();
    setDeviceTypes(refreshed);
    return res;
  };

  return { deviceTypes, addDeviceType, updateDeviceType, deleteDeviceType };
}

export function useDeviceModels() {
  const trigger = useDbTrigger();
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
    return created;
  };

  const updateDeviceModel = async (m: DBDeviceModel) => {
    await updateDeviceModelInSupabase(m);
    const refreshed = await fetchDeviceModelsFromSupabase();
    setDeviceModels(refreshed);
  };

  const deleteDeviceModel = async (id: string) => {
    const res = await deleteDeviceModelInSupabase(id);
    const refreshed = await fetchDeviceModelsFromSupabase();
    setDeviceModels(refreshed);
    return res;
  };

  return { deviceModels, addDeviceModel, updateDeviceModel, deleteDeviceModel };
}

export function useCommonFaults() {
  const trigger = useDbTrigger();
  const [commonFaults, setCommonFaults] = useState<CommonFault[]>([]);

  useEffect(() => {
    setCommonFaults(db.getCommonFaults());
  }, [trigger]);

  const addCommonFault = (f: Omit<CommonFault, "id">) => {
    return db.addCommonFault(f);
  };

  const updateCommonFault = (f: CommonFault) => {
    db.updateCommonFault(f);
  };

  const deleteCommonFault = (id: string) => {
    return db.deleteCommonFault(id);
  };

  return { commonFaults, addCommonFault, updateCommonFault, deleteCommonFault };
}

export function useRepairServices() {
  const trigger = useDbTrigger();
  const [repairServices, setRepairServices] = useState<RepairService[]>([]);

  useEffect(() => {
    setRepairServices(db.getRepairServices());
  }, [trigger]);

  const addRepairService = (s: Omit<RepairService, "id">) => {
    return db.addRepairService(s);
  };

  const updateRepairService = (s: RepairService) => {
    db.updateRepairService(s);
  };

  const deleteRepairService = (id: string) => {
    return db.deleteRepairService(id);
  };

  return { repairServices, addRepairService, updateRepairService, deleteRepairService };
}

export function useDefaultPrices() {
  const trigger = useDbTrigger();
  const [defaultPrices, setDefaultPrices] = useState<DefaultPrice[]>([]);

  useEffect(() => {
    setDefaultPrices(db.getDefaultPrices());
  }, [trigger]);

  const addDefaultPrice = (p: Omit<DefaultPrice, "id">) => {
    return db.addDefaultPrice(p);
  };

  const updateDefaultPrice = (p: DefaultPrice) => {
    db.updateDefaultPrice(p);
  };

  const deleteDefaultPrice = (id: string) => {
    return db.deleteDefaultPrice(id);
  };

  return { defaultPrices, addDefaultPrice, updateDefaultPrice, deleteDefaultPrice };
}

export function useReceivedAccessories() {
  const trigger = useDbTrigger();
  const [receivedAccessories, setReceivedAccessories] = useState<ReceivedAccessory[]>([]);

  useEffect(() => {
    setReceivedAccessories(db.getReceivedAccessories());
  }, [trigger]);

  const addReceivedAccessory = (acc: Omit<ReceivedAccessory, "id">) => {
    return db.addReceivedAccessory(acc);
  };

  const updateReceivedAccessory = (acc: ReceivedAccessory) => {
    db.updateReceivedAccessory(acc);
  };

  const deleteReceivedAccessory = (id: string) => {
    return db.deleteReceivedAccessory(id);
  };

  return { receivedAccessories, addReceivedAccessory, updateReceivedAccessory, deleteReceivedAccessory };
}

export function useDeviceConditions() {
  const trigger = useDbTrigger();
  const [deviceConditions, setDeviceConditions] = useState<DeviceCondition[]>([]);

  useEffect(() => {
    setDeviceConditions(db.getDeviceConditions());
  }, [trigger]);

  const addDeviceCondition = (cond: Omit<DeviceCondition, "id">) => {
    return db.addDeviceCondition(cond);
  };

  const updateDeviceCondition = (cond: DeviceCondition) => {
    db.updateDeviceCondition(cond);
  };

  const deleteDeviceCondition = (id: string) => {
    return db.deleteDeviceCondition(id);
  };

  return { deviceConditions, addDeviceCondition, updateDeviceCondition, deleteDeviceCondition };
}

export function useRepairTemplates() {
  const trigger = useDbTrigger();
  const [repairTemplates, setRepairTemplates] = useState<RepairTemplateItem[]>(getRepairTemplatesSync());

  useEffect(() => {
    fetchRepairTemplatesFromSupabase().then(data => {
      setRepairTemplates(data);
    });
  }, [trigger]);

  const addRepairTemplateItem = (item: Omit<RepairTemplateItem, "id">) => {
    return addRepairTemplateToSupabase(item);
  };

  const updateRepairTemplateItem = (item: RepairTemplateItem) => {
    return updateRepairTemplateInSupabase(item);
  };

  const deleteRepairTemplateItem = (id: string) => {
    return deleteRepairTemplateInSupabase(id);
  };

  return { repairTemplates, addRepairTemplateItem, updateRepairTemplateItem, deleteRepairTemplateItem };
}

export function usePartners() {
  const trigger = useDbTrigger();
  const [partners, setPartners] = useState<Partner[]>([]);

  useEffect(() => {
    setPartners(db.getPartners());
  }, [trigger]);

  const updatePartner = (partner: Partner) => {
    db.updatePartner(partner);
  };

  return { partners, updatePartner };
}

export function usePartnerLedger() {
  const trigger = useDbTrigger();
  const [ledger, setLedger] = useState<PartnerLedgerEntry[]>([]);

  useEffect(() => {
    setLedger(db.getPartnerLedger());
  }, [trigger]);

  const addLedgerEntry = (entry: Omit<PartnerLedgerEntry, "id" | "createdAt" | "updatedAt">) => {
    return db.addPartnerLedgerEntry(entry);
  };

  return { ledger, addLedgerEntry };
}

export function usePartnerSettlements() {
  const trigger = useDbTrigger();
  const [settlements, setSettlements] = useState<PartnerSettlement[]>([]);

  useEffect(() => {
    setSettlements(db.getPartnerSettlements());
  }, [trigger]);

  return {
    settlements,
    calculateSettlement: db.calculateSettlement,
    createDraftSettlement: db.createDraftSettlement,
    lockSettlement: db.lockSettlement,
    reverseSettlement: db.reverseSettlement,
    recordSettlementPayment: db.recordSettlementPayment
  };
}

export function usePartnerTransactions() {
  const trigger = useDbTrigger();
  const [transactions, setTransactions] = useState<PartnerTransaction[]>([]);

  useEffect(() => {
    setTransactions(db.getPartnerTransactions());
  }, [trigger]);

  const addTransaction = (tx: Omit<PartnerTransaction, "id" | "createdAt" | "status">) => {
    return db.addPartnerTransaction(tx);
  };

  const reverseTransaction = (id: string, userId: string, reason: string) => {
    return db.reversePartnerTransaction(id, userId, reason);
  };

  const deleteDraftTransaction = (id: string, userId: string) => {
    return db.deleteDraftPartnerTransaction(id, userId);
  };

  return { transactions, addTransaction, reverseTransaction, deleteDraftTransaction };
}

export function useRepairPartUsages() {
  const trigger = useDbTrigger();
  const [partUsages, setPartUsages] = useState<RepairPartUsage[]>([]);

  useEffect(() => {
    setPartUsages(db.getRepairPartUsages());
  }, [trigger]);

  const addPartUsage = (part: Omit<RepairPartUsage, "id" | "createdAt">) => {
    return db.addRepairPartUsage(part);
  };

  return { partUsages, addPartUsage };
}

export function useSettlementAuditLogs() {
  const trigger = useDbTrigger();
  const [auditLogs, setAuditLogs] = useState<SettlementAuditLog[]>([]);

  useEffect(() => {
    setAuditLogs(db.getSettlementAuditLogs());
  }, [trigger]);

  return { auditLogs };
}
