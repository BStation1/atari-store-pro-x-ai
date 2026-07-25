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

export const DEFAULT_CUSTOMERS: Customer[] = [
  {
    id: "C-001",
    name: "محمد عبد الرحمن",
    phone: "201012345678",
    type: CustomerType.Individual,
    email: "m.abdo@gmail.com",
    notes: "عميل قديم لديه أكثر من جهاز",
    createdAt: "2026-05-01T10:00:00Z",
    balance: 0,
    isActive: true,
    isArchived: false
  },
  {
    id: "C-002",
    name: "محل ألعاب التحرير",
    phone: "201144556677",
    type: CustomerType.Shop,
    email: "tahrir.games@gmail.com",
    notes: "محل صيانة خارجي يرسل أجهزة بالجملة",
    createdAt: "2026-05-05T12:00:00Z",
    balance: 1500,
    isActive: true,
    isArchived: false
  },
  {
    id: "C-003",
    name: "كابتن حازم إمام",
    phone: "201200001111",
    type: CustomerType.VIP,
    email: "hazem10@vip.com",
    notes: "صيانة مستعجلة، يفضل الاتصال مباشرة",
    createdAt: "2026-05-10T09:30:00Z",
    balance: 0,
    isActive: true,
    isArchived: false
  },
  {
    id: "C-004",
    name: "أحمد حسن",
    phone: "201599887766",
    type: CustomerType.Individual,
    createdAt: "2026-05-12T14:15:00Z",
    balance: 350,
    isActive: true,
    isArchived: false
  }
];

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
  return DEFAULT_CUSTOMERS.filter(c => !deletedIds.has(c.id));
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
  } else if (row.customer_type === 'VIP') {
    custType = CustomerType.VIP;
  } else if (row.customer_type === 'WHOLESALE') {
    custType = CustomerType.Wholesale;
  } else if (row.customer_type === 'SHOP') {
    custType = CustomerType.Shop;
  }

  const cleanNotes = meta.notes !== undefined ? meta.notes : (typeof row.notes === 'string' && !row.notes.startsWith('{') ? row.notes : '');

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
    isArchived: Boolean(meta.isArchived || false)
  };
}

export function mapCustomerToRow(c: Partial<Customer>): Record<string, any> {
  let enumType = 'REGULAR';
  if (c.type === CustomerType.VIP) enumType = 'VIP';
  else if (c.type === CustomerType.Wholesale) enumType = 'WHOLESALE';
  else if (c.type === CustomerType.Shop) enumType = 'SHOP';

  const meta = {
    type: c.type || CustomerType.Individual,
    notes: c.notes || '',
    isActive: c.isActive !== false,
    isArchived: Boolean(c.isArchived),
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

  // Only pass id if valid UUID format
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
  const deletedIds = getDeletedCustomerIds();
  const localCustomers = getLocalCustomersBackup().filter(c => !deletedIds.has(c.id));
  const localBalanceTotal = localCustomers.reduce((acc, c) => acc + (c.balance || 0), 0);

  try {
    // 1. Fetch current customers from Supabase
    const { data: dbRows, error: fetchErr } = await supabase
      .from('customers')
      .select('*');

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

    const existingRows = dbRows || [];
    const existingPhoneMap = new Map<string, any>();
    existingRows.forEach(r => {
      if (r.phone && !deletedIds.has(String(r.id))) existingPhoneMap.set(String(r.phone).trim(), r);
    });

    let newlyUploadedCount = 0;
    let duplicatesPrevented = 0;

    // 2. Upload missing local customers to Supabase (upsert duplicate protection)
    for (const localCust of localCustomers) {
      if (deletedIds.has(localCust.id)) continue;
      const cleanPhone = String(localCust.phone || '').trim();
      
      if (existingPhoneMap.has(cleanPhone)) {
        duplicatesPrevented++;
        continue;
      }

      const rowToInsert = mapCustomerToRow(localCust);
      const { data: inserted, error: insertErr } = await supabase
        .from('customers')
        .insert(rowToInsert)
        .select()
        .single();

      if (!insertErr && inserted) {
        newlyUploadedCount++;
        existingPhoneMap.set(cleanPhone, inserted);
      } else if (insertErr && insertErr.code === '23505') { // Unique constraint violation on phone
        duplicatesPrevented++;
      } else if (insertErr) {
        console.warn('⚠️ Could not insert customer into Supabase:', insertErr.message || insertErr);
      }
    }

    // 3. Re-read all customers from Supabase to ensure fresh state
    const { data: refreshedRows, error: reReadErr } = await supabase
      .from('customers')
      .select('*');

    let remoteCustomers: Customer[] = [];
    if (!reReadErr && refreshedRows) {
      remoteCustomers = refreshedRows
        .map(mapRowToCustomer)
        .filter(c => !deletedIds.has(c.id));
    } else {
      remoteCustomers = Array.from(existingPhoneMap.values())
        .map(mapRowToCustomer)
        .filter(c => !deletedIds.has(c.id));
    }

    const remotePhones = new Set(
      remoteCustomers.map(c => normalizePhoneNumber(c.phone) || String(c.phone || '').trim())
    );

    // Merge any local customer that wasn't found in remote (e.g. offline/RLS fallback)
    const unmergedLocal = localCustomers.filter(lc => {
      if (deletedIds.has(lc.id)) return false;
      const p = normalizePhoneNumber(lc.phone) || String(lc.phone || '').trim();
      return p && !remotePhones.has(p);
    });

    const finalCustomers = [...remoteCustomers, ...unmergedLocal];
    
    // Validate balances
    const remoteBalanceTotal = finalCustomers.reduce((acc, c) => acc + (c.balance || 0), 0);
    const balanceMatch = Math.abs(localBalanceTotal - remoteBalanceTotal) < 0.01 || finalCustomers.length >= localCustomers.length;

    // Update local backup cache without re-triggering the event loop
    saveLocalCustomersBackup(finalCustomers, false);

    return {
      success: true,
      customers: finalCustomers,
      localCount: localCustomers.length,
      migratedCount: newlyUploadedCount,
      duplicatesCount: duplicatesPrevented,
      balanceMatch
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
  console.error("❌ [Supabase Customer Operation Error]:", err);
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
 * Add a new customer to Supabase
 */
export async function addCustomerToSupabase(
  customerData: Omit<Customer, "id" | "createdAt" | "balance"> & { balance?: number },
  currentUser?: User
): Promise<Customer> {
  try {
    // Centralized permission check
    const authCheck = await getAuthenticatedUserRole(currentUser);
    if (!authCheck.isOwner && authCheck.role === 'VIEWER') {
      throw new Error('عذراً، ليس لديك صلاحية إضافة عميل جديد.');
    }

    const cleanPhone = normalizePhoneNumber(customerData.phone) || String(customerData.phone || '').trim();

    if (!customerData.name || !cleanPhone) {
      throw new Error('يرجى كتابة اسم العميل ورقم الهاتف.');
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
      const { data: existing, error: dupError } = await supabase
        .from('customers')
        .select('id, name')
        .eq('phone', cleanPhone)
        .maybeSingle();

      if (dupError) {
        console.warn("⚠️ Warning checking duplicate phone in Supabase:", dupError);
      } else if (existing) {
        throw new Error(`يوجد عميل مسجل بالفعل بنفس رقم الهاتف (${cleanPhone}): ${existing.name}`);
      }
    } catch (err: any) {
      if (err?.message?.includes('مسجل بالفعل بنفس رقم الهاتف')) {
        throw err;
      }
      console.warn("⚠️ Duplicate check notice:", err);
    }

    const newCustPartial: Partial<Customer> = {
      name: customerData.name,
      phone: cleanPhone,
      email: customerData.email,
      address: customerData.address,
      type: customerData.type || CustomerType.Individual,
      notes: customerData.notes,
      balance: customerData.balance || 0,
      createdAt: new Date().toISOString(),
      isActive: true,
      isArchived: false
    };

    const payload = mapCustomerToRow(newCustPartial);

    // Get session user ID for console logging
    let sessionUserId = 'anonymous';
    try {
      const { data: authData } = await supabase.auth.getUser();
      sessionUserId = authData?.user?.id || 'no-auth-user';
    } catch (e) {
      console.warn("Could not get auth user:", e);
    }

    console.log("------------------------------------------");
    console.log("🔍 [addCustomerToSupabase] Sending Payload:", payload);
    console.log("👤 [addCustomerToSupabase] Session User ID:", sessionUserId);

    const { data, error } = await supabase
      .from('customers')
      .insert(payload)
      .select()
      .single();

    console.log("📦 [addCustomerToSupabase] Supabase Data Response:", data);
    console.log("❌ [addCustomerToSupabase] Supabase Error Response:", error);
    console.log("------------------------------------------");

    if (error) {
      console.error("⛔ [addCustomerToSupabase] Insert Failed with Error:", error);
      throw formatCustomerError(error, "فشل حفظ العميل في قاعدة البيانات");
    }

    if (!data) {
      console.error("⛔ [addCustomerToSupabase] Insert returned no data!");
      throw new Error('لم يتم إرجاع بيانات العميل الجديد من قاعدة البيانات (Supabase returned empty data).');
    }

    const createdCustomer = mapRowToCustomer(data);

    // Update local backup cache ONLY after verified Supabase insert success
    const updatedLocalList = [createdCustomer, ...localList.filter(c => c.id !== createdCustomer.id)];
    saveLocalCustomersBackup(updatedLocalList, true);

    return createdCustomer;
  } catch (err: any) {
    if (err?.message?.includes('مسجل بالفعل') || err?.message?.includes('صلاحية') || err?.message?.includes('اسم العميل')) {
      throw err;
    }
    throw formatCustomerError(err, "فشل إضافة العميل");
  }
}

/**
 * Update an existing customer in Supabase
 */
export async function updateCustomerInSupabase(
  customer: Customer,
  currentUser?: User
): Promise<Customer> {
  try {
    // Centralized permission check
    const authCheck = await getAuthenticatedUserRole(currentUser);
    if (!authCheck.isOwner && authCheck.role === 'VIEWER') {
      throw new Error('عذراً، ليس لديك صلاحية تعديل بيانات العملاء.');
    }

    const row = mapCustomerToRow(customer);

    let sessionUserId = 'anonymous';
    try {
      const { data: authData } = await supabase.auth.getUser();
      sessionUserId = authData?.user?.id || 'no-auth-user';
    } catch (e) {
      console.warn("Could not get auth user:", e);
    }

    console.log("------------------------------------------");
    console.log("🔍 [updateCustomerInSupabase] Updating Payload:", row);
    console.log("👤 [updateCustomerInSupabase] Session User ID:", sessionUserId);

    const { data: updated, error } = await supabase
      .from('customers')
      .update(row)
      .eq('id', customer.id)
      .select()
      .single();

    console.log("📦 [updateCustomerInSupabase] Supabase Updated Data Response:", updated);
    console.log("❌ [updateCustomerInSupabase] Supabase Error Response:", error);
    console.log("------------------------------------------");

    if (error) {
      console.error("⛔ [updateCustomerInSupabase] Update Failed with Error:", error);
      throw formatCustomerError(error, "فشل تحديث بيانات العميل");
    }

    if (!updated) {
      console.error("⛔ [updateCustomerInSupabase] Update returned no data!");
      throw new Error('لم يتم إرجاع بيانات العميل المحدثة من Supabase.');
    }

    const updatedCustomer = mapRowToCustomer(updated);

    // Update local backup cache after confirmed Supabase write
    const localList = getLocalCustomersBackup();
    const idx = localList.findIndex(c => c.id === customer.id);
    if (idx !== -1) {
      localList[idx] = updatedCustomer;
    } else {
      localList.push(updatedCustomer);
    }
    saveLocalCustomersBackup(localList, true);

    return updatedCustomer;
  } catch (err: any) {
    if (err?.message?.includes('صلاحية')) {
      throw err;
    }
    throw formatCustomerError(err, "فشل تحديث العميل");
  }
}

/**
 * Delete a customer in Supabase
 */
export async function deleteCustomerFromSupabase(
  id: string,
  currentUser?: User
): Promise<{ success: boolean; message: string }> {
  try {
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

    const localOrders = db.getRepairOrders ? db.getRepairOrders() : [];
    const hasLocalOrders = localOrders.some((o: any) => o.customerId === id || o.customer_id === id);
    const localInvoices = db.getInvoices ? db.getInvoices() : [];
    const hasLocalInvoices = localInvoices.some((i: any) => i.customerId === id || i.customer_id === id);

    const isLinked =
      (linkedOrders && linkedOrders.length > 0) ||
      (linkedInvoices && linkedInvoices.length > 0) ||
      hasLocalOrders ||
      hasLocalInvoices;

    if (isLinked) {
      throw new Error('لا يمكن حذف العميل لأنه مرتبط بسجلات صيانة أو فواتير مسجلة بالنظام.');
    }

    // Real Delete directly from customers table in Supabase
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Delete customer error:', error);
      if (error.code === '23503' || error.message.includes('foreign key constraint')) {
        throw new Error('لا يمكن حذف العميل من قاعدة البيانات لأنه مرتبط بسجلات أخرى.');
      }
      throw formatCustomerError(error, "تعذر حذف العميل من قاعدة البيانات");
    }

    // Track deleted customer ID and update local backup
    trackDeletedCustomerId(id);

    const localList = getLocalCustomersBackup().filter(c => c.id !== id);
    saveLocalCustomersBackup(localList);
    try {
      if ((db as any).deleteCustomer) {
        (db as any).deleteCustomer(id);
      }
    } catch (_) {}

    return {
      success: true,
      message: 'تم حذف العميل بنجاح من قاعدة البيانات.'
    };
  } catch (err: any) {
    if (err?.message?.includes('صلاحية') || err?.message?.includes('مرتبط بسجلات')) {
      throw err;
    }
    throw formatCustomerError(err, "فشل حذف العميل");
  }
}
