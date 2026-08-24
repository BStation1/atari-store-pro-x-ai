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
  setLocalProductsBackup,
  runProductsTestSuite,
  withdrawProductForPartner,
  returnProductFromPartner,
  getInventoryMovements
} from '../supabaseProducts';
import { supabase } from '../supabaseClient';
import { db } from '../db';
import { IDataProvider } from './types';
import { syncQueue } from '../sync/syncQueue';

const PRODUCTS_REMOTE_TTL_MS = 5 * 60 * 1000;
const AUTH_READY_TIMEOUT_MS = 5000;
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

async function waitForAuthenticatedSession() {
  const startedAt = Date.now();

  while (Date.now() - startedAt < AUTH_READY_TIMEOUT_MS) {
    const { data, error } = await supabase.auth.getSession();
    if (!error && data.session?.user) return data.session;
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
  if (!refreshError && refreshed.session?.user) return refreshed.session;

  throw new Error('جلسة Supabase لم تجهز بعد. أعد تسجيل الدخول أو حدّث الصفحة.');
}

/**
 * Runtime product loader optimized for Egress.
 *
 * IMPORTANT: inventory reads must never race Supabase Auth restoration. If the
 * first products request goes out as anon while RLS is enabled, PostgREST can
 * legitimately return an empty array even though the table contains rows.
 * We therefore wait for an authenticated session before the authoritative read,
 * and retry once after refreshing the token if an unexpected empty result arrives.
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

  productsFetchInFlight = (async () => {
    await waitForAuthenticatedSession();

    const snapshotBeforeRead = getLocalProductsBackup();
    let products = await getProductsFromSupabase();

    // A populated production inventory must not be silently treated as empty due
    // to an auth/RLS timing race. Refresh the JWT once and retry the same read.
    if (products.length === 0) {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError && refreshed.session?.user) {
        products = await getProductsFromSupabase();
      }
    }

    if (products.length === 0 && snapshotBeforeRead.length > 0) {
      console.warn('[DataLayer] Remote products returned empty; preserving last non-empty local snapshot.');
      setLocalProductsBackup(snapshotBeforeRead, false);
      products = snapshotBeforeRead;
    }

    productsLastRemoteFetchAt = Date.now();
    return localProductsResult(products);
  })()
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