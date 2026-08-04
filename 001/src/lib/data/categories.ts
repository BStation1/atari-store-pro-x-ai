/**
 * Unified Categories Data Access Layer
 * @license Apache-2.0
 */

import { ProductCategory } from '../../types';
import {
  fetchOrMigrateCategories,
  getCategoriesFromSupabase,
  addCategoryToSupabase,
  updateCategoryInSupabase,
  deleteCategoryFromSupabase,
  getLocalCategoriesBackup,
  runCategoriesTestSuite
} from '../supabaseCategories';
import { db } from '../db';
import { IDataProvider } from './types';

export async function getAllCategories(): Promise<ProductCategory[]> {
  try {
    const res = await fetchOrMigrateCategories();
    if (res && Array.isArray(res.categories)) {
      return res.categories;
    }
  } catch (err) {
    console.warn('[DataLayer] Failed fetching remote categories, returning local cache:', err);
  }
  return db.getCategories();
}

export async function getCategoryById(id: string): Promise<ProductCategory | null> {
  const list = await getAllCategories();
  return list.find(c => c.id === id) || null;
}

export async function createCategory(data: Partial<ProductCategory>): Promise<ProductCategory> {
  return db.addCategory(data as any);
}

export async function updateCategory(id: string, data: Partial<ProductCategory>): Promise<ProductCategory> {
  const existing = await getCategoryById(id);
  const updated = { ...(existing || {}), ...data, id } as ProductCategory;
  db.updateCategory(updated);
  return updated;
}

export async function deleteCategory(id: string): Promise<boolean> {
  try {
    db.deleteCategory(id);
    return true;
  } catch (e) {
    console.error('[DataLayer] Delete category error:', e);
    return false;
  }
}

export const categoriesDataProvider: IDataProvider<ProductCategory> = {
  get: getCategoryById,
  list: async () => getAllCategories(),
  insert: createCategory,
  update: updateCategory,
  remove: deleteCategory,
};

export {
  fetchOrMigrateCategories,
  getCategoriesFromSupabase,
  addCategoryToSupabase,
  updateCategoryInSupabase,
  deleteCategoryFromSupabase,
  getLocalCategoriesBackup,
  runCategoriesTestSuite
};
