/**
 * Unified Products Data Access Layer
 * @license Apache-2.0
 */

import { Product } from '../../types';
import {
  getProductsFromSupabase,
  addProductToSupabase,
  updateProductInSupabase,
  deleteProductFromSupabase,
  getLocalProductsBackup,
  runProductsTestSuite,
  withdrawProductForPartner,
  returnProductFromPartner,
  getInventoryMovements
} from '../supabaseProducts';
import { db } from '../db';
import { IDataProvider } from './types';
import { syncQueue } from '../sync/syncQueue';

const PRODUCTS_REMOTE_TTL_MS = 5 * 60 * 1000;
let productsFetchInFlight: Promise<any> | null = null;
let productsLastRemoteFetchAt = 0;

function localProductsResult(products: Product[]) {
  return {
    products,
    localCount: products.length,
    uploadedCount: 0,
    totalSupabaseCount: products.length,
    openingBalanceMovementsCreated: 0
  };
}

/**
 * Runtime product loader optimized for Egress.
 *
 * IMPORTANT: the legacy fetchOrMigrateProducts implementation also scanned
 * inventory_movements once per product to verify opening balances. That is an
 * N+1 database pattern and must not run during ordinary page reads.
 * Runtime refresh now uses one products query only; data migrations belong in
 * an explicit maintenance/migration action, not in the normal UI read path.
 *
 * - Dashboard reads local cache only.
 * - Other screens dedupe concurrent requests and reuse a recent snapshot for 5 minutes.
 */
export async function fetchOrMigrateProducts() {
  const localProducts = getLocalProductsBackup();
  const dashboardLocalOnly = typeof window !== 'undefined' && Boolean((window as any).__ATARI_DASHBOARD_LOCAL_ONLY__);

  if (dashboardLocalOnly) {
    return localProductsResult(localProducts);
  }

  const now = Date.now();
  if (localProducts.length > 0 && now - productsLastRemoteFetchAt < PRODUCTS_REMOTE_TTL_MS) {
    return localProductsResult(localProducts);
  }

  if (productsFetchInFlight) {
    return productsFetchInFlight;
  }

  productsFetchInFlight = getProductsFromSupabase()
    .then(products => {
      productsLastRemoteFetchAt = Date.now();
      return localProductsResult(products);
    })
    .catch(err => {
      console.warn('[DataLayer] Product refresh failed; using local snapshot:', err);
      return localProductsResult(getLocalProductsBackup());
    })
    .finally(() => {
      productsFetchInFlight = null;
    });

  return productsFetchInFlight;
}

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
  addProductToSupabase,
  updateProductInSupabase,
  deleteProductFromSupabase,
  getLocalProductsBackup,
  runProductsTestSuite,
  withdrawProductForPartner,
  returnProductFromPartner,
  getInventoryMovements
};