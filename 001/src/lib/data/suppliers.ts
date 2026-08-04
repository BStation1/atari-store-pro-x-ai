/**
 * Unified Suppliers Data Access Layer
 * @license Apache-2.0
 */

import { Supplier } from '../../types';
import {
  fetchOrMigrateSuppliers,
  addSupplierToSupabase,
  updateSupplierInSupabase,
  deleteSupplierFromSupabase,
  getLocalSuppliersBackup,
  saveLocalSuppliersBackup
} from '../supabaseSuppliers';
import { db } from '../db';
import { IDataProvider } from './types';

export async function getAllSuppliers(): Promise<Supplier[]> {
  try {
    const res = await fetchOrMigrateSuppliers();
    if (res.success && res.suppliers) {
      return res.suppliers;
    }
  } catch (err) {
    console.warn('[DataLayer] Failed fetching remote suppliers, returning local cache:', err);
  }
  return db.getSuppliers();
}

export async function getSupplierById(id: string): Promise<Supplier | null> {
  const list = await getAllSuppliers();
  return list.find(s => s.id === id) || null;
}

export async function createSupplier(data: Partial<Supplier>): Promise<Supplier> {
  return db.addSupplier(data as any);
}

export async function updateSupplier(id: string, data: Partial<Supplier>): Promise<Supplier> {
  const existing = await getSupplierById(id);
  const updated = { ...(existing || {}), ...data, id } as Supplier;
  const list = db.getSuppliers();
  const index = list.findIndex(s => s.id === id);
  if (index !== -1) {
    list[index] = updated;
    db.saveSuppliers(list);
  }
  return updated;
}

export async function deleteSupplier(id: string): Promise<boolean> {
  try {
    const list = db.getSuppliers().filter(s => s.id !== id);
    db.saveSuppliers(list);
    return true;
  } catch (e) {
    console.error('[DataLayer] Delete supplier error:', e);
    return false;
  }
}

export const suppliersDataProvider: IDataProvider<Supplier> = {
  get: getSupplierById,
  list: async () => getAllSuppliers(),
  insert: createSupplier,
  update: updateSupplier,
  remove: deleteSupplier,
};

export {
  fetchOrMigrateSuppliers,
  addSupplierToSupabase,
  updateSupplierInSupabase,
  deleteSupplierFromSupabase,
  getLocalSuppliersBackup,
  saveLocalSuppliersBackup
};
