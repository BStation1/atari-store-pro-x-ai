import { supabase } from './supabaseClient';
import { Supplier, User } from '../types';
import { getAuthenticatedUserRole } from './authPermissions';

const SUPPLIERS_STORAGE_KEY = 'atari_suppliers';

export const DEFAULT_SUPPLIERS: Supplier[] = [];

export function getLocalSuppliersBackup(): Supplier[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(SUPPLIERS_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error reading local suppliers backup:', e);
  }
  return [];
}

export function saveLocalSuppliersBackup(data: Supplier[], dispatchEvent = true): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SUPPLIERS_STORAGE_KEY, JSON.stringify(data));
      if (dispatchEvent) {
        window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: SUPPLIERS_STORAGE_KEY } }));
      }
    }
  } catch (e) {
    console.error('Error saving local suppliers backup:', e);
  }
}

export function mapRowToSupplier(row: Record<string, any>): Supplier {
  return {
    id: String(row.id || ''),
    name: row.name || '',
    phone: row.phone || '',
    company: row.company || '',
    email: row.email || '',
    address: row.address || '',
    notes: typeof row.notes === 'string' ? row.notes : '',
    balance: typeof row.balance === 'number' ? row.balance : Number(row.balance || 0),
    isActive: row.is_active !== false,
    isArchived: Boolean(row.is_archived || false),
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at
  };
}

export function mapSupplierToRow(s: Partial<Supplier>): Record<string, any> {
  const row: Record<string, any> = {
    name: s.name,
    phone: String(s.phone || '').trim(),
    company: s.company || null,
    email: s.email || null,
    address: s.address || null,
    balance: Number(s.balance || 0),
    updated_at: new Date().toISOString()
  };

  if (s.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.id)) {
    row.id = s.id;
  }

  return row;
}

/**
 * Migration & Fetching Logic for Suppliers
 */
export async function fetchOrMigrateSuppliers(): Promise<{
  success: boolean;
  suppliers: Supplier[];
  localCount: number;
  migratedCount: number;
  duplicatesCount: number;
  balanceMatch: boolean;
  error?: string;
}> {
  const localSuppliers = getLocalSuppliersBackup();
  const localBalanceTotal = localSuppliers.reduce((acc, s) => acc + (s.balance || 0), 0);

  try {
    // 1. Query suppliers from Supabase
    const { data: dbRows, error: fetchErr } = await supabase
      .from('suppliers')
      .select('*');

    if (fetchErr) {
      console.warn('⚠️ Supabase suppliers query error, using local fallback:', fetchErr);
      return {
        success: false,
        suppliers: localSuppliers,
        localCount: localSuppliers.length,
        migratedCount: 0,
        duplicatesCount: 0,
        balanceMatch: true,
        error: fetchErr.message
      };
    }

    const existingRows = dbRows || [];
    const existingKeyMap = new Map<string, any>();

    existingRows.forEach(r => {
      const pKey = String(r.phone || '').trim();
      const nameKey = String(r.name || '').trim().toLowerCase();
      const compKey = String(r.company || '').trim().toLowerCase();
      if (pKey) existingKeyMap.set(`p:${pKey}`, r);
      if (compKey) existingKeyMap.set(`c:${compKey}`, r);
      if (nameKey) existingKeyMap.set(`n:${nameKey}`, r);
    });

    let newlyUploadedCount = 0;
    let duplicatesPrevented = 0;

    // 2. Upload missing suppliers to Supabase
    for (const localSup of localSuppliers) {
      const pKey = String(localSup.phone || '').trim();
      const nameKey = String(localSup.name || '').trim().toLowerCase();
      const compKey = String(localSup.company || '').trim().toLowerCase();

      const exists = existingKeyMap.has(`p:${pKey}`) ||
                     (compKey && existingKeyMap.has(`c:${compKey}`)) ||
                     (nameKey && existingKeyMap.has(`n:${nameKey}`));

      if (exists) {
        duplicatesPrevented++;
        continue;
      }

      const rowToInsert = mapSupplierToRow(localSup);
      const { data: inserted, error: insertErr } = await supabase
        .from('suppliers')
        .insert(rowToInsert)
        .select()
        .single();

      if (!insertErr && inserted) {
        newlyUploadedCount++;
        if (pKey) existingKeyMap.set(`p:${pKey}`, inserted);
        if (compKey) existingKeyMap.set(`c:${compKey}`, inserted);
        if (nameKey) existingKeyMap.set(`n:${nameKey}`, inserted);
      } else if (insertErr) {
        console.warn('⚠️ Could not insert supplier into Supabase:', insertErr.message || insertErr);
      }
    }

    // 3. Re-read all suppliers from Supabase
    const { data: refreshedRows, error: reReadErr } = await supabase
      .from('suppliers')
      .select('*');

    if (reReadErr || !refreshedRows) {
      return {
        success: true,
        suppliers: Array.from(existingKeyMap.values()).map(mapRowToSupplier),
        localCount: localSuppliers.length,
        migratedCount: newlyUploadedCount,
        duplicatesCount: duplicatesPrevented,
        balanceMatch: true
      };
    }

    const finalSuppliers = refreshedRows.map(mapRowToSupplier);
    const remoteBalanceTotal = finalSuppliers.reduce((acc, s) => acc + (s.balance || 0), 0);
    const balanceMatch = Math.abs(localBalanceTotal - remoteBalanceTotal) < 0.01 || finalSuppliers.length >= localSuppliers.length;

    // Save refreshed list to local backup
    saveLocalSuppliersBackup(finalSuppliers, false);

    return {
      success: true,
      suppliers: finalSuppliers,
      localCount: localSuppliers.length,
      migratedCount: newlyUploadedCount,
      duplicatesCount: duplicatesPrevented,
      balanceMatch
    };
  } catch (err: any) {
    console.warn('⚠️ Error in fetchOrMigrateSuppliers:', err);
    return {
      success: false,
      suppliers: localSuppliers,
      localCount: localSuppliers.length,
      migratedCount: 0,
      duplicatesCount: 0,
      balanceMatch: true,
      error: err?.message || 'خطأ غير متوقع في الاتصال بـ Supabase'
    };
  }
}

/**
 * Add a new supplier to Supabase
 */
export async function addSupplierToSupabase(
  supplierData: Omit<Supplier, "id">,
  currentUser?: User
): Promise<Supplier> {
  const authCheck = await getAuthenticatedUserRole(currentUser);
  if (!authCheck.isOwner && authCheck.role === 'VIEWER') {
    throw new Error('عذراً، تقتصر صلاحية إضافة الموردين على مدير النظام والشركاء فقط.');
  }

  const cleanPhone = String(supplierData.phone || '').trim();
  const cleanName = String(supplierData.name || '').trim();

  // Check duplicate supplier
  if (cleanPhone) {
    const { data: existing } = await supabase
      .from('suppliers')
      .select('id, name')
      .eq('phone', cleanPhone)
      .maybeSingle();

    if (existing) {
      throw new Error(`يوجد مورد مسجل بالفعل برقم الهاتف (${cleanPhone}): ${existing.name}`);
    }
  }

  const newSupplierPartial: Partial<Supplier> = {
    ...supplierData,
    createdAt: new Date().toISOString(),
    isActive: true,
    isArchived: false
  };

  const row = mapSupplierToRow(newSupplierPartial);
  const { data: inserted, error } = await supabase
    .from('suppliers')
    .insert(row)
    .select()
    .single();

  if (error || !inserted) {
    throw new Error(error?.message || 'فشل إضافة المورد في Supabase');
  }

  const createdSupplier = mapRowToSupplier(inserted);

  // Update local backup
  const localList = getLocalSuppliersBackup();
  saveLocalSuppliersBackup([createdSupplier, ...localList], false);

  return createdSupplier;
}

/**
 * Update an existing supplier in Supabase
 */
export async function updateSupplierInSupabase(
  supplier: Supplier,
  currentUser?: User
): Promise<Supplier> {
  const authCheck = await getAuthenticatedUserRole(currentUser);
  if (!authCheck.isOwner && authCheck.role === 'VIEWER') {
    throw new Error('عذراً، تقتصر صلاحية تعديل بيانات الموردين على مدير النظام والشركاء فقط.');
  }

  const row = mapSupplierToRow(supplier);

  const { data: updated, error } = await supabase
    .from('suppliers')
    .update(row)
    .eq('id', supplier.id)
    .select()
    .single();

  if (error || !updated) {
    throw new Error(error?.message || 'فشل تحديث بيانات المورد في Supabase');
  }

  const updatedSupplier = mapRowToSupplier(updated);

  // Update local backup
  const localList = getLocalSuppliersBackup();
  const idx = localList.findIndex(s => s.id === supplier.id);
  if (idx !== -1) {
    localList[idx] = updatedSupplier;
  } else {
    localList.push(updatedSupplier);
  }
  saveLocalSuppliersBackup(localList, false);

  return updatedSupplier;
}

/**
 * Delete or Soft-Delete a supplier in Supabase
 */
export async function deleteSupplierFromSupabase(
  id: string,
  currentUser?: User
): Promise<{ success: boolean; message: string }> {
  const authCheck = await getAuthenticatedUserRole(currentUser);
  if (!authCheck.isOwner) {
    throw new Error('عذراً، تقتصر صلاحية حذف الموردين على مدير النظام فقط.');
  }

  // Check if supplier is linked in invoices or products
  const { data: linkedInvoices } = await supabase
    .from('invoices')
    .select('id')
    .eq('supplier_id', id)
    .limit(1);

  const isLinked = linkedInvoices && linkedInvoices.length > 0;

  if (isLinked) {
    const { data: existing } = await supabase
      .from('suppliers')
      .select('*')
      .eq('id', id)
      .single();

    if (existing) {
      const sup = mapRowToSupplier(existing);
      sup.isActive = false;
      sup.isArchived = true;
      await updateSupplierInSupabase(sup, currentUser);
      return {
        success: true,
        message: 'تم أرشفة المورد وإلغاء تنشيطه بدلاً من الحذف الفعلي لوجود معنيات فواتير مرتبطة به (Soft Delete).'
      };
    }
  }

  const { error } = await supabase
    .from('suppliers')
    .delete()
    .eq('id', id);

  if (error) {
    const { data: existing } = await supabase
      .from('suppliers')
      .select('*')
      .eq('id', id)
      .single();

    if (existing) {
      const sup = mapRowToSupplier(existing);
      sup.isActive = false;
      sup.isArchived = true;
      await updateSupplierInSupabase(sup, currentUser);
      return {
        success: true,
        message: 'تم أرشفة المورد بنجاح (Soft Delete).'
      };
    }
    throw new Error(error.message);
  }

  const localList = getLocalSuppliersBackup().filter(s => s.id !== id);
  saveLocalSuppliersBackup(localList);

  return {
    success: true,
    message: 'تم حذف المورد بنجاح.'
  };
}
