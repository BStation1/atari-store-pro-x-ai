import { supabase } from './supabaseClient';
import { Supplier, User } from '../types';
import { getAuthenticatedUserRole } from './authPermissions';

const SUPPLIERS_STORAGE_KEY = 'atari_suppliers';
// Use the deployed row shape rather than requiring optional columns that may
// not exist on older supplier schemas. mapRowToSupplier already handles absent fields.
const SUPPLIER_SELECT = '*';

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

  try {
    // Avoid schema-specific select/order clauses. Missing optional columns such as
    // is_archived/updated_at/created_at otherwise make PostgREST respond with 400.
    const { data: dbRows, error: fetchErr } = await supabase
      .from('suppliers')
      .select(SUPPLIER_SELECT);

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

    const remoteSuppliers = (dbRows || [])
      .map(mapRowToSupplier)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    saveLocalSuppliersBackup(remoteSuppliers, false);

    return {
      success: true,
      suppliers: remoteSuppliers,
      localCount: remoteSuppliers.length,
      migratedCount: 0,
      duplicatesCount: 0,
      balanceMatch: true
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

export async function addSupplierToSupabase(
  supplierData: Omit<Supplier, "id">,
  currentUser?: User
): Promise<Supplier> {
  const authCheck = await getAuthenticatedUserRole(currentUser);
  if (!authCheck.isOwner && authCheck.role === 'VIEWER') {
    throw new Error('عذراً، تقتصر صلاحية إضافة الموردين على مدير النظام والشركاء فقط.');
  }

  const cleanPhone = String(supplierData.phone || '').trim();

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
    .select(SUPPLIER_SELECT)
    .single();

  if (error || !inserted) {
    throw new Error(error?.message || 'فشل إضافة المورد في Supabase');
  }

  const createdSupplier = mapRowToSupplier(inserted);
  const localList = getLocalSuppliersBackup();
  saveLocalSuppliersBackup([createdSupplier, ...localList], false);
  return createdSupplier;
}

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
    .select(SUPPLIER_SELECT)
    .single();

  if (error || !updated) {
    throw new Error(error?.message || 'فشل تحديث بيانات المورد في Supabase');
  }

  const updatedSupplier = mapRowToSupplier(updated);
  const localList = getLocalSuppliersBackup();
  const idx = localList.findIndex(s => s.id === supplier.id);
  if (idx !== -1) localList[idx] = updatedSupplier;
  else localList.push(updatedSupplier);
  saveLocalSuppliersBackup(localList, false);
  return updatedSupplier;
}

export async function deleteSupplierFromSupabase(
  id: string,
  currentUser?: User
): Promise<{ success: boolean; message: string }> {
  const authCheck = await getAuthenticatedUserRole(currentUser);
  if (!authCheck.isOwner) {
    throw new Error('عذراً، تقتصر صلاحية حذف الموردين على مدير النظام فقط.');
  }

  const { data: linkedInvoices } = await supabase
    .from('invoices')
    .select('id')
    .eq('supplier_id', id)
    .limit(1);

  const isLinked = linkedInvoices && linkedInvoices.length > 0;

  if (isLinked) {
    const { data: existing } = await supabase
      .from('suppliers')
      .select(SUPPLIER_SELECT)
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
      .select(SUPPLIER_SELECT)
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
