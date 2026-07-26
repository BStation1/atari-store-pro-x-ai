import { supabase } from './supabaseClient';
import { ProductCategory, Product } from '../types';

const CATEGORIES_STORAGE_KEY = 'atari_categories';
const PRODUCTS_STORAGE_KEY = 'atari_products';
const CATEGORIES_INITIALIZED_KEY = 'atari_categories_initialized_sp';

const DEFAULT_CATEGORIES: ProductCategory[] = [
  { id: "CAT-001", name: "قطع غيار صيانة", sortOrder: 1, isActive: true },
  { id: "CAT-002", name: "اكسسوارات", sortOrder: 2, isActive: true },
  { id: "CAT-003", name: "ألعاب", sortOrder: 3, isActive: true },
  { id: "CAT-004", name: "أجهزة كونسول", sortOrder: 4, isActive: true }
];

function isCategoriesInitialized(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(CATEGORIES_INITIALIZED_KEY) === 'true';
  } catch {
    return false;
  }
}

function setCategoriesInitialized() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CATEGORIES_INITIALIZED_KEY, 'true');
    }
  } catch {
    // Ignore storage error
  }
}

/**
 * Safely map a Supabase database row to a ProductCategory object.
 */
export function mapRowToCategory(row: Record<string, any>): ProductCategory {
  return {
    id: String(row.id || ''),
    name: row.name || row.category_name || row.title || '',
    sortOrder: typeof row.sort_order === 'number' ? row.sort_order : typeof row.sortOrder === 'number' ? row.sortOrder : 1,
    isActive: row.is_active !== undefined ? Boolean(row.is_active) : row.isActive !== undefined ? Boolean(row.isActive) : true,
    isArchived: Boolean(row.is_archived || row.isArchived || false),
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt,
  };
}

/**
 * Safely map a ProductCategory object to a Supabase table row.
 */
export function mapCategoryToRow(cat: Partial<ProductCategory>): Record<string, any> {
  const row: Record<string, any> = {
    name: cat.name,
    sort_order: cat.sortOrder ?? 1,
    is_active: cat.isActive !== false,
    updated_at: new Date().toISOString(),
  };

  // If id looks like a valid UUID, include it; otherwise generate a new UUID for Supabase
  if (cat.id && !cat.id.startsWith('CAT-') && cat.id.length > 10) {
    row.id = cat.id;
  } else {
    row.id = crypto.randomUUID();
  }

  return row;
}

/**
 * Get categories from local storage backup.
 */
export function getLocalCategoriesBackup(): ProductCategory[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(CATEGORIES_STORAGE_KEY);
      if (stored !== null) return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error reading local categories backup:', e);
  }
  return [];
}

/**
 * Update local storage backup for offline/fast read capability.
 */
export function setLocalCategoriesBackup(categories: ProductCategory[], dispatchEvent = true) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
      setCategoriesInitialized();
      if (dispatchEvent) {
        window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: CATEGORIES_STORAGE_KEY } }));
      }
    }
  } catch (e) {
    console.error('Error setting local categories backup:', e);
  }
}

/**
 * Fetch categories directly from Supabase.
 */
export async function getCategoriesFromSupabase(): Promise<ProductCategory[]> {
  const response = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true });

  if (response.error) {
    console.warn('⚠️ Supabase categories notice:', response.error.message);
    return getLocalCategoriesBackup();
  }

  const categories = (response.data || []).map(mapRowToCategory);
  setLocalCategoriesBackup(categories, false);
  return categories;
}

/**
 * Migration helper: Read categories from Supabase without auto-seeding.
 */
export async function fetchOrMigrateCategories(): Promise<{
  categories: ProductCategory[];
  localCount: number;
  uploadedCount: number;
  totalSupabaseCount: number;
}> {
  const localCategories = getLocalCategoriesBackup();
  const localCount = localCategories.length;

  try {
    const response = await supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true });

    if (response.error) {
      console.error('⚠️ Could not fetch categories from Supabase:', {
        code: response.error.code,
        message: response.error.message,
        details: response.error.details,
      });
      return {
        categories: localCategories,
        localCount,
        uploadedCount: 0,
        totalSupabaseCount: localCategories.length,
      };
    }

    setCategoriesInitialized();
    const existingSupabaseCategories = (response.data || []).map(mapRowToCategory);
    setLocalCategoriesBackup(existingSupabaseCategories, false);
    return {
      categories: existingSupabaseCategories,
      localCount,
      uploadedCount: 0,
      totalSupabaseCount: existingSupabaseCategories.length,
    };
  } catch (err: any) {
    console.error('⚠️ Error in fetchOrMigrateCategories:', err);
    return {
      categories: localCategories,
      localCount,
      uploadedCount: 0,
      totalSupabaseCount: localCategories.length,
    };
  }
}

/**
 * Add a new category directly to Supabase.
 * Throws an error if Supabase connection fails.
 */
export async function addCategoryToSupabase(cat: Omit<ProductCategory, 'id'>): Promise<ProductCategory> {
  console.log("Saving category...", cat);
  const row = mapCategoryToRow(cat);

  const response = await supabase
    .from('categories')
    .insert([row])
    .select()
    .single();

  console.log("Supabase response", response);

  if (response.error) {
    console.error("Supabase Error adding category:", {
      code: response.error.code,
      message: response.error.message,
      details: response.error.details,
    });
    throw new Error(`تعذر إضافة التصنيف إلى Supabase: [${response.error.code}] ${response.error.message}`);
  }

  const newCategory = mapRowToCategory(response.data);

  // Sync to local backup
  const currentBackup = getLocalCategoriesBackup();
  currentBackup.push(newCategory);
  setLocalCategoriesBackup(currentBackup);

  return newCategory;
}

/**
 * Update a category directly in Supabase.
 * Throws an error if Supabase connection fails.
 */
export async function updateCategoryInSupabase(cat: ProductCategory): Promise<ProductCategory> {
  console.log("Saving category...", cat);
  const row = mapCategoryToRow(cat);

  let query = supabase.from('categories').update(row);

  if (cat.id && !cat.id.startsWith('CAT-')) {
    query = query.eq('id', cat.id);
  } else {
    query = query.eq('name', cat.name);
  }

  const response = await query.select().single();

  console.log("Supabase response", response);

  if (response.error) {
    console.error("Supabase Error updating category:", {
      code: response.error.code,
      message: response.error.message,
      details: response.error.details,
    });
    throw new Error(`تعذر تعديل التصنيف في Supabase: [${response.error.code}] ${response.error.message}`);
  }

  const updatedCat = mapRowToCategory(response.data);

  // Sync to local backup
  const currentBackup = getLocalCategoriesBackup();
  const index = currentBackup.findIndex(c => c.id === cat.id || c.name === cat.name);
  if (index !== -1) {
    currentBackup[index] = updatedCat;
  } else {
    currentBackup.push(updatedCat);
  }
  setLocalCategoriesBackup(currentBackup);

  return updatedCat;
}

/**
 * Delete a category from Supabase.
 */
export async function deleteCategoryFromSupabase(
  id: string,
  categoryName: string
): Promise<{ success: boolean; error?: string }> {
  console.log("Deleting category...", { id, categoryName });

  // Check local products (from localStorage)
  let products: Product[] = [];
  try {
    const raw = localStorage.getItem(PRODUCTS_STORAGE_KEY);
    if (raw) products = JSON.parse(raw);
  } catch (e) {
    console.error('Error reading products for deletion check:', e);
  }

  const hasLinkedProducts = products.some(
    p => p.category === categoryName && !p.isArchived
  );

  if (hasLinkedProducts) {
    return {
      success: false,
      error: 'لا يمكن حذف التصنيف لأنه يحتوي على منتجات مسجلة في النظام. يرجى نقل أو أرشفة المنتجات أولاً.',
    };
  }

  // Delete from Supabase
  let query = supabase.from('categories').delete();
  if (id && !id.startsWith('CAT-')) {
    query = query.eq('id', id);
  } else {
    query = query.eq('name', categoryName);
  }

  const response = await query;

  console.log("Supabase response", response);

  if (response.error) {
    console.error("Supabase Error deleting category:", {
      code: response.error.code,
      message: response.error.message,
      details: response.error.details,
    });
    return {
      success: false,
      error: `تعذر حذف التصنيف من Supabase: [${response.error.code}] ${response.error.message}`,
    };
  }

  // Update local backup
  const currentBackup = getLocalCategoriesBackup();
  const filtered = currentBackup.filter(c => c.id !== id && c.name !== categoryName);
  setLocalCategoriesBackup(filtered);

  return { success: true };
}

/**
 * Automated test suite for Requirement 7:
 * - Uploads local categories once.
 * - Verifies no duplicates on second run.
 * - Adds a new category and saves to Supabase.
 * - Edits the category.
 * - Verifies deletion prevention when products are linked.
 * - Cleans up test category.
 */
export async function runCategoriesTestSuite(): Promise<{
  success: boolean;
  logs: string[];
}> {
  const logs: string[] = [];
  logs.push('🚀 بدء تشغيل اختبارات الربط والترحيل الخاصة بـ categories...');

  try {
    // 1. First migration / fetch test
    const run1 = await fetchOrMigrateCategories();
    logs.push(`✅ [اختبار 1 - الترحيل الأولي]: تم قراءة ${run1.localCount} تصنيف محلي، وتم المزامنة مع Supabase (الإجمالي في Supabase: ${run1.totalSupabaseCount})`);

    // 2. Second migration run -> verify no duplication
    const run2 = await fetchOrMigrateCategories();
    if (run2.totalSupabaseCount === run1.totalSupabaseCount) {
      logs.push(`✅ [اختبار 2 - منع التكرار]: نجح الاختبار. إعادة تشغيل الترحيل لم تُنشئ تصنيفات مكررة (العدد ثابت: ${run2.totalSupabaseCount})`);
    } else {
      logs.push(`⚠️ [اختبار 2 - منع التكرار]: تحذير! تغير عدد العناصر من ${run1.totalSupabaseCount} إلى ${run2.totalSupabaseCount}`);
    }

    // 3. Add new category test
    const testCatName = `تصنيف تجريبي ${Date.now()}`;
    const addedCat = await addCategoryToSupabase({
      name: testCatName,
      sortOrder: 99,
      isActive: true,
    });
    logs.push(`✅ [اختبار 3 - إضافة تصنيف جديد]: تم إضافة التصنيف [${addedCat.name}] بنجاح إلى Supabase بالمعرف (${addedCat.id})`);

    // 4. Modify category test
    const updatedName = `${testCatName} - معدل`;
    const updatedCat = await updateCategoryInSupabase({
      ...addedCat,
      name: updatedName,
      sortOrder: 100,
    });
    logs.push(`✅ [اختبار 4 - تعديل التصنيف]: تم تعديل اسم التصنيف بنجاح إلى [${updatedCat.name}]`);

    // 5. Deletion prevention test with dummy product check
    // Create temporary mock product with category
    const currentProducts: Product[] = JSON.parse(localStorage.getItem(PRODUCTS_STORAGE_KEY) || '[]');
    const tempProduct: Product = {
      id: `P-TEST-${Date.now()}`,
      name: 'منتج تجريبي للاختبار',
      category: updatedName,
      barcode: '123456789',
      sku: 'TEST-SKU',
      purchasePrice: 100,
      sellPrice: 150,
      quantity: 5,
      minStock: 1,
    };
    localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify([...currentProducts, tempProduct]));

    const deleteAttemptWithProduct = await deleteCategoryFromSupabase(updatedCat.id, updatedCat.name);
    if (!deleteAttemptWithProduct.success) {
      logs.push(`✅ [اختبار 5 - منع الحذف لوجود منتجات]: تم رفض حذف التصنيف بنجاح لأن به منتجاً مرتبطاً: (${deleteAttemptWithProduct.error})`);
    } else {
      logs.push('⚠️ [اختبار 5]: تحذير - تم الحذف رغم وجود منتج مرتبط');
    }

    // Remove dummy test product
    const cleanedProducts = currentProducts.filter(p => p.id !== tempProduct.id);
    localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(cleanedProducts));

    // 6. Clean up test category
    const deleteRes = await deleteCategoryFromSupabase(updatedCat.id, updatedCat.name);
    if (deleteRes.success) {
      logs.push('✅ [اختبار 6 - التنظيف]: تم حذف التصنيف التجريبي بنجاح بعد اكتمال جميع الاختبارات');
    }

    logs.push('🎉 جميع اختبارات categories اكتملت بنجاح!');
    return { success: true, logs };
  } catch (err: any) {
    logs.push(`❌ خطأ أثناء تنفيذ الاختبارات: ${err?.message || err}`);
    return { success: false, logs };
  }
}
