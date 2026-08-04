import { supabase } from './supabaseClient';
import { Customer, CustomerType, User } from '../types';
import { normalizePhoneNumber } from '../utils/phone';
import { db } from './db';
import { getAuthenticatedUserRole } from './authPermissions';

const CUSTOMERS_STORAGE_KEY = 'atari_customers';
const DELETED_CUSTOMERS_KEY = 'atari_deleted_customer_ids';

export function getDeletedCustomerIds(): Set<string> {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(DELETED_CUSTOMERS_KEY);
      if (stored) return new Set(JSON.parse(stored));
    }
  } catch (e) {
    console.error('Error reading deleted customer IDs:', e);
  }
  return new Set();
}

export function trackDeletedCustomerId(id: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      const current = getDeletedCustomerIds();
      current.add(id);
      localStorage.setItem(DELETED_CUSTOMERS_KEY, JSON.stringify(Array.from(current)));
    }
  } catch (e) {
    console.error('Error tracking deleted customer ID:', e);
  }
}

export const DEFAULT_CUSTOMERS: Customer[] = [];

export function getLocalCustomersBackup(): Customer[] {
  const deletedIds = getDeletedCustomerIds();
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(CUSTOMERS_STORAGE_KEY);
      if (stored) {
        const parsed: Customer[] = JSON.parse(stored);
        return parsed.filter(c => !deletedIds.has(c.id));
      }
    }
  } catch (e) {
    console.error('Error reading local customers backup:', e);
  }
  return [];
}

export function saveLocalCustomersBackup(data: Customer[], dispatchEvent = true): void {
  const deletedIds = getDeletedCustomerIds();
  const cleanData = data.filter(c => !deletedIds.has(c.id));
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CUSTOMERS_STORAGE_KEY, JSON.stringify(cleanData));
      try { db.saveCustomers(cleanData); } catch (_) {}
      if (dispatchEvent) {
        window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: CUSTOMERS_STORAGE_KEY } }));
      }
    }
  } catch (e) {
    console.error('Error saving local customers backup:', e);
  }
}

/**
 * Centralized mapping between UI CustomerType and Supabase customer_type_enum
 */
export const CUSTOMER_TYPE_TO_DB: Record<CustomerType, 'REGULAR' | 'VIP' | 'WHOLESALE'> = {
  [CustomerType.Individual]: 'REGULAR',
  [CustomerType.VIP]: 'VIP',
  [CustomerType.Wholesale]: 'WHOLESALE',
  [CustomerType.Shop]: 'WHOLESALE',
  [CustomerType.Guest]: 'REGULAR',
};

export const DB_TO_CUSTOMER_TYPE: Record<string, CustomerType> = {
  REGULAR: CustomerType.Individual,
  VIP: CustomerType.VIP,
  WHOLESALE: CustomerType.Wholesale,
  SHOP: CustomerType.Shop,
};

export function mapRowToCustomer(row: Record<string, any>): Customer {
  let meta: Record<string, any> = {};
  if (row.notes) {
    try {
      if (typeof row.notes === 'string' && row.notes.trim().startsWith('{')) {
        meta = JSON.parse(row.notes);
      } else {
        meta = { notes: row.notes };
      }
    } catch {
      meta = { notes: row.notes };
    }
  }

  let custType: CustomerType = CustomerType.Individual;
  if (meta.type && Object.values(CustomerType).includes(meta.type)) {
    custType = meta.type as CustomerType;
  } else if (row.customer_type && DB_TO_CUSTOMER_TYPE[row.customer_type]) {
    custType = DB_TO_CUSTOMER_TYPE[row.customer_type];
  }

  const cleanNotes = meta.notes !== undefined ? meta.notes : (typeof row.notes === 'string' && !row.notes.startsWith('{') ? row.notes : '');

  const isGuest = Boolean(
    meta.isGuest === true ||
    meta.customerType === 'GUEST' ||
    row.customer_type === 'GUEST' ||
    row.name === 'عميل غير مسجل' ||
    (typeof cleanNotes === 'string' && cleanNotes.includes('عميل ينشأ تلقائياً لأمر الصيانة'))
  );

  return {
    id: String(row.id || ''),
    name: row.name || '',
    phone: row.phone || '',
    type: custType,
    email: row.email || meta.email || '',
    address: row.address || meta.address || '',
    notes: cleanNotes,
    createdAt: row.created_at || meta.createdAt || new Date().toISOString(),
    updatedAt: row.updated_at || meta.updatedAt,
    balance: typeof row.balance === 'number' ? row.balance : Number(row.balance || 0),
    isActive: meta.isActive !== false,
    isArchived: Boolean(meta.isArchived || false),
    isGuest,
    customerType: isGuest ? 'GUEST' : 'REGISTERED'
  };
}

export function mapCustomerToRow(c: Partial<Customer>): Record<string, any> {
  const uiType = c.type || CustomerType.Individual;
  const enumType = CUSTOMER_TYPE_TO_DB[uiType] || 'REGULAR';
  const isGuest = Boolean(c.isGuest || c.customerType === 'GUEST' || c.type === CustomerType.Guest);

  const meta = {
    type: uiType,
    notes: c.notes || '',
    isActive: c.isActive !== false,
    isArchived: Boolean(c.isArchived),
    isGuest,
    customerType: isGuest ? 'GUEST' : 'REGISTERED',
    createdAt: c.createdAt || new Date().toISOString(),
    email: c.email || '',
    address: c.address || '',
    migratedOpeningBalance: Number(c.balance || 0)
  };

  const row: Record<string, any> = {
    name: c.name,
    phone: String(c.phone || '').trim(),
    email: c.email || null,
    address: c.address || null,
    customer_type: enumType,
    balance: Number(c.balance || 0),
    notes: JSON.stringify(meta),
    updated_at: new Date().toISOString()
  };

  // Only pass id if it is a strictly valid UUID format to avoid Postgres 22P02 syntax errors
  if (c.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c.id)) {
    row.id = c.id;
  }

  return row;
}

/**
 * Migration & Fetching Logic for Customers
 */
export async function fetchOrMigrateCustomers(): Promise<{
  success: boolean;
  customers: Customer[];
  localCount: number;
  migratedCount: number;
  duplicatesCount: number;
  balanceMatch: boolean;
  error?: string;
}> {
  const localCustomers = getLocalCustomersBackup();

  try {
    // Fetch current customers directly from Supabase
    const { data: dbRows, error: fetchErr } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchErr) {
      console.warn('⚠️ Supabase customers query error, using local fallback:', fetchErr);
      return {
        success: false,
        customers: localCustomers,
        localCount: localCustomers.length,
        migratedCount: 0,
        duplicatesCount: 0,
        balanceMatch: true,
        error: fetchErr.message
      };
    }

    const remoteCustomers = (dbRows || []).map(mapRowToCustomer);

    // Update local backup cache without re-triggering the event loop
    saveLocalCustomersBackup(remoteCustomers, false);

    return {
      success: true,
      customers: remoteCustomers,
      localCount: remoteCustomers.length,
      migratedCount: 0,
      duplicatesCount: 0,
      balanceMatch: true
    };
  } catch (err: any) {
    console.warn('⚠️ Error in fetchOrMigrateCustomers:', err);
    return {
      success: false,
      customers: localCustomers,
      localCount: localCustomers.length,
      migratedCount: 0,
      duplicatesCount: 0,
      balanceMatch: true,
      error: err?.message || 'خطأ غير متوقع في الاتصال بـ Supabase'
    };
  }
}

/**
 * Helper to produce clean, user-friendly error messages without raw stack traces or JS dumps.
 */
function formatCustomerError(err: any, defaultMsg: string): Error {
  const rawMsg = String(err?.message || err?.details || err?.hint || err || '');

  if (
    err?.name === 'TypeError' ||
    rawMsg.includes('Failed to fetch') ||
    rawMsg.includes('fetch') ||
    rawMsg.includes('NetworkError') ||
    rawMsg.includes('Network Error')
  ) {
    return new Error(
      "تعذر الاتصال بقاعدة البيانات (TypeError: Failed to fetch). يرجى التأكد من ضبط متغيرات البيئة VITE_SUPABASE_URL و VITE_SUPABASE_PUBLISHABLE_KEY في Vercel ثم إعادة النشر (Redeploy)."
    );
  }

  const clean = rawMsg
    .replace(/TypeError:\s*/g, '')
    .replace(/Error:\s*/g, '')
    .replace(/\[object Object\]/g, '')
    .trim();

  return new Error(clean || defaultMsg);
}

/**
 * Add a new customer to Supabase (with automatic local storage fallback)
 */
export async function addCustomerToSupabase(
  customerData: Omit<Customer, "id" | "createdAt" | "balance"> & { balance?: number },
  currentUser?: User
): Promise<Customer> {
  const cleanPhone = normalizePhoneNumber(customerData.phone) || String(customerData.phone || '').trim();

  if (!customerData.name || !cleanPhone) {
    throw new Error('يرجى كتابة اسم العميل ورقم الهاتف.');
  }

  // Permission check
  try {
    const authCheck = await getAuthenticatedUserRole(currentUser);
    if (!authCheck.isOwner && authCheck.role === 'VIEWER') {
      throw new Error('عذراً، ليس لديك صلاحية إضافة عميل جديد.');
    }
  } catch (pErr: any) {
    if (pErr?.message?.includes('صلاحية')) throw pErr;
  }

  // Check duplicate phone in local storage
  const localList = getLocalCustomersBackup();
  const existingLocal = localList.find(c => {
    const p = normalizePhoneNumber(c.phone) || String(c.phone || '').trim();
    return p && p === cleanPhone;
  });
  if (existingLocal) {
    throw new Error(`يوجد عميل مسجل بالفعل بنفس رقم الهاتف (${cleanPhone}): ${existingLocal.name}`);
  }

  // Check duplicate phone in Supabase
  try {
    const { data: existing } = await supabase
      .from('customers')
      .select('id, name')
      .eq('phone', cleanPhone)
      .maybeSingle();

    if (existing) {
      throw new Error(`يوجد عميل مسجل بالفعل بنفس رقم الهاتف (${cleanPhone}): ${existing.name}`);
    }
  } catch (err: any) {
    if (err?.message?.includes('مسجل بالفعل')) throw err;
    console.warn("⚠️ Duplicate phone check notice:", err?.message || err);
  }

  // Prepare fallback customer with local ID
  const fallbackId = `CUST-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  let createdCustomer: Customer = {
    id: fallbackId,
    name: customerData.name,
    phone: cleanPhone,
    type: customerData.type || CustomerType.Individual,
    email: customerData.email || '',
    address: customerData.address || '',
    notes: customerData.notes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    balance: customerData.balance || 0,
    isActive: true,
    isArchived: false,
    isGuest: false,
    customerType: 'REGISTERED'
  };

  const payload = mapCustomerToRow(createdCustomer);

  try {
    const { data, error } = await supabase
      .from('customers')
      .insert(payload)
      .select()
      .maybeSingle();

    if (error) {
      console.warn("⚠️ [addCustomerToSupabase] Supabase insert warning (saved locally):", error.message || error);
    } else if (data) {
      createdCustomer = mapRowToCustomer(data);
    }
  } catch (err: any) {
    console.warn("⚠️ [addCustomerToSupabase] Supabase request failed, saving customer locally:", err?.message || err);
  }

  // Save to local backup storage regardless
  const updatedLocalList = [createdCustomer, ...localList.filter(c => c.id !== createdCustomer.id)];
  saveLocalCustomersBackup(updatedLocalList, true);

  return createdCustomer;
}

/**
 * Update an existing customer in Supabase (with automatic local storage fallback)
 */
export async function updateCustomerInSupabase(
  customer: Customer,
  currentUser?: User
): Promise<Customer> {
  if (!customer || !customer.id) {
    throw new Error('بيانات العميل غير مكتملة.');
  }

  // Permission check
  try {
    const authCheck = await getAuthenticatedUserRole(currentUser);
    if (!authCheck.isOwner && authCheck.role === 'VIEWER') {
      throw new Error('عذراً، ليس لديك صلاحية تعديل بيانات العملاء.');
    }
  } catch (pErr: any) {
    if (pErr?.message?.includes('صلاحية')) throw pErr;
  }

  const row = mapCustomerToRow(customer);
  let updatedCustomer: Customer = { ...customer, updatedAt: new Date().toISOString() };

  try {
    const { data: updated, error } = await supabase
      .from('customers')
      .update(row)
      .eq('id', customer.id)
      .select()
      .maybeSingle();

    if (error) {
      console.warn("⚠️ [updateCustomerInSupabase] Supabase update warning (saved locally):", error.message || error);
    } else if (updated) {
      updatedCustomer = mapRowToCustomer(updated);
    }
  } catch (err: any) {
    console.warn("⚠️ [updateCustomerInSupabase] Supabase request failed, updated locally:", err?.message || err);
  }

  // Update local backup cache
  const localList = getLocalCustomersBackup();
  const idx = localList.findIndex(c => c.id === customer.id);
  if (idx !== -1) {
    localList[idx] = updatedCustomer;
  } else {
    localList.push(updatedCustomer);
  }
  saveLocalCustomersBackup(localList, true);

  return updatedCustomer;
}

/**
 * Delete a customer in Supabase (with local backup tracking)
 */
export async function deleteCustomerFromSupabase(
  id: string,
  currentUser?: User
): Promise<{ success: boolean; message: string }> {
  // Permission check
  const authCheck = await getAuthenticatedUserRole(currentUser);
  const isAllowedRole =
    authCheck.isOwner ||
    ['ADMIN', 'MANAGER', 'RECEPTION', 'RECEPTIONIST', 'CASHIER'].includes(String(authCheck.role).toUpperCase()) ||
    ['OWNER', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'RECEPTION', 'CASHIER'].includes(String(currentUser?.roleId).toUpperCase());

  if (!isAllowedRole) {
    throw new Error('عذراً، ليس لديك صلاحية حذف العملاء.');
  }

  // Check if customer is referenced in repair orders or invoices
  const localOrders = db.getRepairOrders ? db.getRepairOrders() : [];
  const hasLocalOrders = localOrders.some((o: any) => o.customerId === id || o.customer_id === id);
  const localInvoices = db.getInvoices ? db.getInvoices() : [];
  const hasLocalInvoices = localInvoices.some((i: any) => i.customerId === id || i.customer_id === id);

  if (hasLocalOrders || hasLocalInvoices) {
    throw new Error('لا يمكن حذف العميل لأنه مرتبط بسجلات صيانة أو فواتير مسجلة بالنظام.');
  }

  try {
    const { data: linkedOrders } = await supabase
      .from('repair_orders')
      .select('id')
      .eq('customer_id', id)
      .limit(1);

    const { data: linkedInvoices } = await supabase
      .from('invoices')
      .select('id')
      .eq('customer_id', id)
      .limit(1);

    if ((linkedOrders && linkedOrders.length > 0) || (linkedInvoices && linkedInvoices.length > 0)) {
      throw new Error('لا يمكن حذف العميل لأنه مرتبط بسجلات صيانة أو فواتير مسجلة بالنظام.');
    }

    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id);

    if (error) {
      if (error.code === '23503' || error.message.includes('foreign key constraint')) {
        throw new Error('لا يمكن حذف العميل من قاعدة البيانات لأنه مرتبط بسجلات أخرى.');
      }
      console.warn("⚠️ [deleteCustomerFromSupabase] Supabase delete warning:", error.message || error);
    }
  } catch (err: any) {
    if (err?.message?.includes('صلاحية') || err?.message?.includes('مرتبط بسجلات')) {
      throw err;
    }
    console.warn("⚠️ [deleteCustomerFromSupabase] Remote delete notice:", err?.message || err);
  }

  // Track deleted customer ID and update local backup
  trackDeletedCustomerId(id);

  const localList = getLocalCustomersBackup().filter(c => c.id !== id);
  saveLocalCustomersBackup(localList, true);
  try {
    if ((db as any).deleteCustomer) {
      (db as any).deleteCustomer(id);
    }
  } catch (_) {}

  return {
    success: true,
    message: 'تم حذف العميل بنجاح.'
  };
}
