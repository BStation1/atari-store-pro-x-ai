/**
 * Unified Products Data Access Layer
 * @license Apache-2.0
 */

import { Product } from '../../types';
import {
  fetchOrMigrateProducts,
  addProductToSupabase,
  updateProductInSupabase,
  deleteProductFromSupabase,
  getLocalProductsBackup,
  runProductsTestSuite,
  withdrawProductForPartner,
  getInventoryMovements
} from '../supabaseProducts';
import { db } from '../db';
import { IDataProvider } from './types';
import { syncQueue } from '../sync/syncQueue';

export async function getAllProducts(): Promise<Product[]> {
  try {
    const res = await fetchOrMigrateProducts();
    if (res && Array.isArray(res.products)) {
      return res.products;
    }
  } catch (err) {
    console.warn('[DataLayer] Failed fetching remote products, returning local cache:', err);
  }
  return db.getProducts();
}

export async function getProductById(id: string): Promise<Product | null> {
  const list = await getAllProducts();
  return list.find(p => p.id === id) || null;
}

export async function createProduct(data: Partial<Product>): Promise<Product> {
  const created = db.addProduct(data as any);
  if (created && created.id) {
    try {
      syncQueue.enqueue({
        entityType: 'Product',
        entityId: created.id,
        operation: 'CREATE',
        payload: created,
        origin: 'Inventory',
        version: 1,
        idempotencyKey: `Product:${created.id}:CREATE`
      });
    } catch (err) {
      console.error('[DataLayer] Error enqueueing product:', err);
    }
  }
  return created;
}

export async function updateProduct(id: string, data: Partial<Product>): Promise<Product> {
  const existing = await getProductById(id);
  const updated = { ...(existing || {}), ...data, id } as Product;
  db.updateProduct(updated);
  return updated;
}

export async function deleteProduct(id: string): Promise<boolean> {
  try {
    db.deleteProduct(id);
    return true;
  } catch (e) {
    console.error('[DataLayer] Delete product error:', e);
    return false;
  }
}

export const productsDataProvider: IDataProvider<Product> = {
  get: getProductById,
  list: async () => getAllProducts(),
  insert: createProduct,
  update: updateProduct,
  remove: deleteProduct,
};

export {
  fetchOrMigrateProducts,
  addProductToSupabase,
  updateProductInSupabase,
  deleteProductFromSupabase,
  getLocalProductsBackup,
  runProductsTestSuite,
  withdrawProductForPartner,
  getInventoryMovements
};
