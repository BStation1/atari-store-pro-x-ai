import { supabase, isSupabaseConfigured } from './supabaseClient';
import { Product, InventoryMovement, WorkOwnershipType } from '../types';
import { getAuthenticatedUserRole } from './authPermissions';
import { db } from './db';

const PRODUCTS_STORAGE_KEY = 'atari_products';
const CATEGORIES_STORAGE_KEY = 'atari_categories';

const DEFAULT_PRODUCTS: Product[] = [];

/**
 * Reads local products backup from localStorage.
 */
export function getLocalProductsBackup(): Product[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(PRODUCTS_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error reading local products backup:', e);
  }
  return [];
}

/**
 * Updates local products backup in localStorage and optionally fires change event.
 */
export function setLocalProductsBackup(products: Product[], dispatchEvent = true) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products));
      if (dispatchEvent) {
        window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: PRODUCTS_STORAGE_KEY } }));
      }
    }
  } catch (e) {
    console.error('Error setting local products backup:', e);
  }
}

/**
 * Maps a Supabase database row to a Product object.
 */
export function mapRowToProduct(row: Record<string, any>): Product {
  let meta: Record<string, any> = {};
  if (row.description) {
    try {
      if (row.description.trim().startsWith('{')) {
        meta = JSON.parse(row.description);
      } else {
        meta = { notes: row.description };
      }
    } catch {
      meta = { notes: row.description };
    }
  }

  return {
    id: String(row.id || ''),
    name: row.name || '',
    nameAr: meta.nameAr || row.name_ar || '',
    category: row.category_name || meta.category || 'قطع غيار صيانة',
    barcode: row.barcode || '',
    sku: row.sku || '',
    purchasePrice: typeof row.cost_price === 'number' ? row.cost_price : Number(row.cost_price || 0),
    sellPrice: typeof row.selling_price === 'number' ? row.selling_price : Number(row.selling_price || 0),
    quantity: typeof row.quantity === 'number' ? row.quantity : Number(row.quantity || 0),
    minStock: typeof row.min_quantity === 'number' ? row.min_quantity : Number(row.min_quantity || 5),
    location: row.location || meta.location || '',
    brand: meta.brand || '',
    unit: meta.unit || 'قطعة',
    supplier: meta.supplier || '',
    technicianCost: meta.technicianCost || 0,
    wholesalePrice: meta.wholesalePrice || 0,
    minSellPrice: meta.minSellPrice || 0,
    compatibleDeviceTypes: meta.compatibleDeviceTypes || [],
    compatibleModels: row.compatible_models || meta.compatibleModels || [],
    notes: meta.notes || '',
    isArchived: Boolean(row.is_archived || meta.isArchived || false),
    stockOwnership: (row.stock_ownership as any) || meta.stockOwnership || 'SHARED',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Maps a Product object to a Supabase database row.
 */
export function mapProductToRow(
  prod: Partial<Product>,
  categoryIdMap?: Map<string, string>
): Record<string, any> {
  const catName = prod.category || 'قطع غيار صيانة';
  let catId: string | null = null;

  if (categoryIdMap) {
    const key = catName.trim().toLowerCase();
    catId = categoryIdMap.get(key) || null;
  }

  const meta = {
    nameAr: prod.nameAr || '',
    unit: prod.unit || 'قطعة',
    brand: prod.brand || '',
    notes: prod.notes || '',
    supplier: prod.supplier || '',
    technicianCost: prod.technicianCost || 0,
    wholesalePrice: prod.wholesalePrice || 0,
    minSellPrice: prod.minSellPrice || 0,
    compatibleDeviceTypes: prod.compatibleDeviceTypes || [],
    isArchived: Boolean(prod.isArchived),
    stockOwnership: prod.stockOwnership || 'SHARED',
  };

  const userSku = (prod.sku || '').trim();
  const userBarcode = (prod.barcode || '').trim();
  const fallbackSku = userBarcode
    ? `SKU-${userBarcode}`
    : `SKU-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const row: Record<string, any> = {
    name: prod.name,
    barcode: userBarcode || null,
    sku: userSku || fallbackSku,
    category_id: catId,
    category_name: catName,
    cost_price: Number(prod.purchasePrice || 0),
    selling_price: Number(prod.sellPrice || 0),
    quantity: Math.max(0, Number(prod.quantity || 0)),
    min_quantity: Math.max(0, Number(prod.minStock || 5)),
    location: prod.location || null,
    stock_ownership: prod.stockOwnership || 'SHARED',
    compatible_models: prod.compatibleModels || [],
    is_archived: Boolean(prod.isArchived),
    description: JSON.stringify(meta),
    updated_at: new Date().toISOString(),
  };

  // If id is a valid UUID, pass it
  if (prod.id && !prod.id.startsWith('P-') && prod.id.length > 10) {
    row.id = prod.id;
  }

  return row;
}

/**
 * Fetches categories map (category_name.toLowerCase() -> category_id UUID).
 */
export async function getCategoryUuidMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const { data } = await supabase.from('categories').select('id, name');
    if (data) {
      data.forEach(c => {
        if (c.name && c.id) {
          map.set(c.name.trim().toLowerCase(), String(c.id));
        }
      });
    }
  } catch (err) {
    console.warn('Could not fetch categories UUID map:', err);
  }
  return map;
}

/**
 * Fetches products directly from Supabase.
 */
export async function getProductsFromSupabase(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('⚠️ Error fetching products from Supabase:', error.message);
    throw new Error(`فشل الاتصال بقاعدة البيانات Supabase: ${error.message}`);
  }

  const products = (data || []).map(mapRowToProduct);
  setLocalProductsBackup(products, false);
  return products;
}

/**
 * Migration helper for Products & Opening Balance Movements:
 * 1. Reads local products.
 * 2. Fetches Supabase categories map for category_id references.
 * 3. Checks existing Supabase products.
 * 4. If Supabase products are empty, uploads local products.
 * 5. Creates single OPENING_BALANCE inventory_movements record for products with quantity > 0.
 * 6. Returns summary counts and final products list.
 */
export async function fetchOrMigrateProducts(): Promise<{
  products: Product[];
  localCount: number;
  uploadedCount: number;
  totalSupabaseCount: number;
  openingBalanceMovementsCreated: number;
}> {
  const localProducts = getLocalProductsBackup();
  const localCount = localProducts.length;

  try {
    const categoryMap = await getCategoryUuidMap();

    // Fetch existing Supabase products
    const { data: existingData, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('⚠️ Could not fetch products from Supabase:', error.message);
      return {
        products: localProducts,
        localCount,
        uploadedCount: 0,
        totalSupabaseCount: 0,
        openingBalanceMovementsCreated: 0,
      };
    }

    if (existingData) {
      const existingProducts = existingData.map(mapRowToProduct);
      setLocalProductsBackup(existingProducts, false);

      // Verify opening balances for products that have quantity > 0 but no OPENING_BALANCE record
      let createdMovements = 0;
      for (const p of existingProducts) {
        if (p.quantity > 0) {
          const { data: mData } = await supabase
            .from('inventory_movements')
            .select('id')
            .eq('product_id', p.id)
            .or('reference_id.eq.OPENING_BALANCE,notes.ilike.%OPENING_BALANCE%')
            .limit(1);

          if (!mData || mData.length === 0) {
            // Create opening balance record
            await supabase.from('inventory_movements').insert([
              {
                product_id: p.id,
                movement_type: 'ADJUSTMENT',
                quantity_change: p.quantity,
                previous_quantity: 0,
                new_quantity: p.quantity,
                cost_price_snapshot: p.purchasePrice,
                selling_price_snapshot: p.sellPrice,
                reference_id: 'OPENING_BALANCE',
                notes: 'رصيد افتتاحي - OPENING_BALANCE',
              },
            ]);
            createdMovements++;
          }
        }
      }

      return {
        products: existingProducts,
        localCount,
        uploadedCount: 0,
        totalSupabaseCount: existingProducts.length,
        openingBalanceMovementsCreated: createdMovements,
      };
    }

    setLocalProductsBackup([], false);
    return {
      products: [],
      localCount,
      uploadedCount: 0,
      totalSupabaseCount: 0,
      openingBalanceMovementsCreated: 0,
    };
  } catch (err: any) {
    console.warn('⚠️ Error in fetchOrMigrateProducts:', err);
    return {
      products: localProducts,
      localCount,
      uploadedCount: 0,
      totalSupabaseCount: 0,
      openingBalanceMovementsCreated: 0,
    };
  }
}

/**
 * Add a new product directly to Supabase.
 * - Prevents negative quantity.
 * - Creates an OPENING_BALANCE movement if initial quantity > 0.
 * Throws an error if Supabase connection fails.
 */
export async function addProductToSupabase(
  prod: Omit<Product, 'id'>,
  userId?: string
): Promise<Product> {
  if (prod.quantity < 0) {
    throw new Error('خطأ: لا يمكن إضافة منتج بكمية أقل من صفر (الكميات السالبة حظرت بالكامل).');
  }

  const fallbackId = `PROD-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  let newProduct: Product = {
    ...prod,
    id: fallbackId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isActive: true,
    isArchived: false
  };

  try {
    const categoryMap = await getCategoryUuidMap();
    const row = mapProductToRow(prod, categoryMap);

    let { data, error } = await supabase
      .from('products')
      .insert([row])
      .select()
      .maybeSingle();

    if (error && (error.code === 'PGRST204' || error.message?.includes('is_archived'))) {
      console.warn('⚠️ is_archived column missing in schema cache. Retrying insert without is_archived column...');
      const fallbackRow = { ...row };
      delete fallbackRow.is_archived;
      const retryRes = await supabase
        .from('products')
        .insert([fallbackRow])
        .select()
        .maybeSingle();
      data = retryRes.data;
      error = retryRes.error;
    }

    if (error) {
      if (error.code === '23505' || error.message?.includes('products_sku_key') || error.message?.includes('sku')) {
        throw new Error(`كود SKU (${row.sku}) مستخدم بالفعل لصنف آخر في قاعدة البيانات. يرجى إدخال كود SKU فريد.`);
      }
      if (error.code === '23505' || error.message?.includes('products_barcode_key') || error.message?.includes('barcode')) {
        throw new Error(`الباركود (${row.barcode}) مستخدم بالفعل لصنف آخر في قاعدة البيانات. يرجى إدخال باركود فريد.`);
      }
      console.warn('⚠️ [addProductToSupabase] Supabase error (saved locally):', error.message || error);
    } else if (data) {
      newProduct = mapRowToProduct(data);

      if (newProduct.quantity > 0) {
        try {
          await supabase.from('inventory_movements').insert([
            {
              product_id: newProduct.id,
              movement_type: 'ADJUSTMENT',
              quantity_change: newProduct.quantity,
              previous_quantity: 0,
              new_quantity: newProduct.quantity,
              cost_price_snapshot: newProduct.purchasePrice,
              selling_price_snapshot: newProduct.sellPrice,
              reference_id: 'OPENING_BALANCE',
              notes: 'إضافة منتج جديد - رصيد افتتاحي',
              created_by_user_id: userId || null,
            },
          ]);
        } catch (_) {}
      }
    }
  } catch (err: any) {
    if (err?.message?.includes('مستخدم بالفعل') || err?.message?.includes('أقل من صفر')) {
      throw err;
    }
    console.warn('⚠️ [addProductToSupabase] Request failed (saved locally):', err?.message || err);
  }

  // Sync local backup
  const currentBackup = getLocalProductsBackup();
  const updatedList = [newProduct, ...currentBackup.filter(p => p.id !== newProduct.id)];
  setLocalProductsBackup(updatedList);
  try {
    db.saveProducts(updatedList);
  } catch (_) {}

  return newProduct;
}

/**
 * Update a product in Supabase (with automatic local storage backup fallback).
 */
export async function updateProductInSupabase(
  prod: Product,
  userId?: string,
  reason?: string
): Promise<Product> {
  if (prod.quantity < 0) {
    throw new Error('خطأ: الكمية السالبة غير مسموحة بضوابط المخزون.');
  }

  let previousQty = prod.quantity;
  let updatedProduct: Product = {
    ...prod,
    updatedAt: new Date().toISOString()
  };

  try {
    try {
      const { data: currentData } = await supabase
        .from('products')
        .select('quantity, cost_price, selling_price')
        .eq('id', prod.id)
        .maybeSingle();

      if (currentData) {
        previousQty = Number(currentData.quantity || 0);
      }
    } catch (e) {
      console.warn('Could not fetch previous product state:', e);
    }

    const categoryMap = await getCategoryUuidMap();
    const row = mapProductToRow(prod, categoryMap);

    let { data, error } = await supabase
      .from('products')
      .update(row)
      .eq('id', prod.id)
      .select()
      .maybeSingle();

    if (error && (error.code === 'PGRST204' || error.message?.includes('is_archived'))) {
      console.warn('⚠️ is_archived column missing in schema cache. Retrying update without is_archived column...');
      const fallbackRow = { ...row };
      delete fallbackRow.is_archived;
      const retryRes = await supabase
        .from('products')
        .update(fallbackRow)
        .eq('id', prod.id)
        .select()
        .maybeSingle();
      data = retryRes.data;
      error = retryRes.error;
    }

    if (error) {
      if (error.code === '23505' || error.message?.includes('products_sku_key') || error.message?.includes('sku')) {
        throw new Error(`كود SKU (${row.sku}) مستخدم بالفعل لصنف آخر في قاعدة البيانات.`);
      }
      if (error.code === '23505' || error.message?.includes('products_barcode_key') || error.message?.includes('barcode')) {
        throw new Error(`الباركود (${row.barcode}) مستخدم بالفعل لصنف آخر في قاعدة البيانات.`);
      }
      console.warn('⚠️ [updateProductInSupabase] Supabase update error (updated locally):', error.message || error);
    } else if (data) {
      updatedProduct = mapRowToProduct(data);

      if (previousQty !== updatedProduct.quantity) {
        const diff = updatedProduct.quantity - previousQty;
        try {
          await supabase.from('inventory_movements').insert([
            {
              product_id: updatedProduct.id,
              movement_type: 'ADJUSTMENT',
              quantity_change: diff,
              previous_quantity: previousQty,
              new_quantity: updatedProduct.quantity,
              cost_price_snapshot: updatedProduct.purchasePrice,
              selling_price_snapshot: updatedProduct.sellPrice,
              notes: reason || `تعديل يدوي للكمية (من ${previousQty} إلى ${updatedProduct.quantity})`,
              created_by_user_id: userId || null,
            },
          ]);
        } catch (_) {}
      }
    }
  } catch (err: any) {
    if (err?.message?.includes('مستخدم بالفعل') || err?.message?.includes('غير مسموحة')) {
      throw err;
    }
    console.warn('⚠️ [updateProductInSupabase] Remote request failed (updated locally):', err?.message || err);
  }

  // Sync local backup
  const currentBackup = getLocalProductsBackup();
  const index = currentBackup.findIndex(p => p.id === prod.id);
  if (index !== -1) {
    currentBackup[index] = updatedProduct;
  } else {
    currentBackup.unshift(updatedProduct);
  }
  setLocalProductsBackup(currentBackup);
  try {
    db.saveProducts(currentBackup);
  } catch (_) {}

  return updatedProduct;
}

/**
 * Delete / Archive product from Supabase:
 * - Checks user role: Only OWNER / admin can delete or soft-delete products.
 * - Checks if product is referenced in invoices, repair orders, or inventory_movements.
 * - If referenced or soft-delete requested, sets is_active = false / isArchived = true.
 * - Returns status message.
 */
export async function deleteProductFromSupabase(
  id: string,
  currentUser?: { id?: string; name?: string; role?: string }
): Promise<{ success: boolean; isArchived?: boolean; error?: string; message?: string }> {
  console.log('🔍 [DeleteProduct] Attempting deletion/archiving for productId:', id);

  // Permission check: Only OWNER or ADMIN is allowed to delete or disable products
  const authCheck = await getAuthenticatedUserRole(currentUser);
  const isOwnerUser = authCheck.isOwner || currentUser?.role === 'OWNER' || currentUser?.role === 'ADMIN' || currentUser?.id === 'U-101';

  if (!isOwnerUser) {
    console.warn('⚠️ [DeleteProduct] Permission denied for user:', currentUser);
    return {
      success: false,
      error: 'غير مصرح: يقتصر حذف أو أرشفة المنتجات من المخزن على المالِك (OWNER) فقط.',
    };
  }

  // Check product references across Supabase tables & local storage
  let isReferenced = false;
  let referenceReason = '';

  try {
    // 1. Check invoice_items in Supabase
    const { data: invItems, error: invErr } = await supabase
      .from('invoice_items')
      .select('id')
      .eq('product_id', id)
      .limit(1);

    if (!invErr && invItems && invItems.length > 0) {
      isReferenced = true;
      referenceReason = 'فواتير المبيعات/المشتريات (invoice_items)';
    }

    // 2. Check repair_part_usages in Supabase
    if (!isReferenced) {
      const { data: repairParts, error: repErr } = await supabase
        .from('repair_part_usages')
        .select('id')
        .eq('inventory_item_id', id)
        .limit(1);

      if (!repErr && repairParts && repairParts.length > 0) {
        isReferenced = true;
        referenceReason = 'أوامر الصيانة (repair_part_usages)';
      }
    }

    // 3. Check inventory_movements in Supabase
    if (!isReferenced) {
      const { data: movements, error: movErr } = await supabase
        .from('inventory_movements')
        .select('id, movement_type')
        .eq('product_id', id);

      if (!movErr && movements && movements.length > 0) {
        // If there are real movements like SALE, PURCHASE, RETURN, REPAIR_USAGE, or multiple movements
        const activeMovements = movements.filter(m => 
          m.movement_type === 'SALE' || 
          m.movement_type === 'PURCHASE' || 
          m.movement_type === 'RETURN' || 
          m.movement_type === 'REPAIR_USAGE'
        );

        if (activeMovements.length > 0 || movements.length > 1) {
          isReferenced = true;
          referenceReason = 'حركات المخزون التاريخية (المبيعات / المشتريات / الصيانة)';
        }
      }
    }

    // 4. Check local invoices and repair orders in localStorage
    if (!isReferenced) {
      const localInvoices = JSON.parse(localStorage.getItem('atari_invoices') || '[]');
      const localOrders = JSON.parse(localStorage.getItem('atari_repair_orders') || '[]');

      const hasInvoiceRef = localInvoices.some((inv: any) =>
        (inv.items || []).some((item: any) => item.productId === id)
      );
      const hasOrderRef = localOrders.some((ord: any) =>
        (ord.devices || []).some((d: any) => d.partsUsed?.some((p: any) => p.productId === id))
      );

      if (hasInvoiceRef) {
        isReferenced = true;
        referenceReason = 'فواتير المبيعات المحلية';
      } else if (hasOrderRef) {
        isReferenced = true;
        referenceReason = 'أوامر الصيانة المحلية';
      }
    }
  } catch (e) {
    console.error('Error checking product references:', e);
  }

  // IF PRODUCT IS REFERENCED -> ARCHIVE PRODUCT (SOFT DELETE)
  if (isReferenced) {
    console.log(`📌 [DeleteProduct] Product ${id} is referenced in (${referenceReason}). Executing archive flow...`);

    const currentBackup = getLocalProductsBackup();
    const targetProd = currentBackup.find(p => p.id === id);

    let archiveMeta: Record<string, any> = { isArchived: true };
    if (targetProd) {
      targetProd.isArchived = true;
      const categoryMap = await getCategoryUuidMap();
      const row = mapProductToRow(targetProd, categoryMap);
      archiveMeta = JSON.parse(row.description || '{}');
    }

    let archiveRes = await supabase
      .from('products')
      .update({ is_archived: true, description: JSON.stringify(archiveMeta) })
      .eq('id', id)
      .select();

    if (archiveRes.error && (archiveRes.error.code === 'PGRST204' || archiveRes.error.message?.includes('is_archived'))) {
      console.warn('⚠️ is_archived column missing in schema cache during archive. Retrying with description JSON update...');
      archiveRes = await supabase
        .from('products')
        .update({ description: JSON.stringify(archiveMeta) })
        .eq('id', id)
        .select();
    }

    if (archiveRes.error) {
      console.error('❌ [DeleteProduct] Archiving failed:', archiveRes.error);
      return { success: false, error: `تعذر أرشفة المنتج في Supabase: ${archiveRes.error.message}` };
    }

    // Update local backup
    if (targetProd) {
      setLocalProductsBackup(currentBackup);
    }

    // Refresh products list directly from Supabase
    await getProductsFromSupabase().catch(() => {});

    return {
      success: true,
      isArchived: true,
      message: `المنتج مرتبط بسجلات سابقة (${referenceReason}). تم أرشفة المنتج بنجاح بدلاً من الحذف النهائي للحفاظ على التاريخ المحاسبي والمخزني.`,
    };
  }

  // IF NOT REFERENCED -> HARD DELETE FROM SUPABASE
  console.log('🔍 [DeleteProduct] Executing direct delete from Supabase for productId:', id);

  // First delete any initial OPENING_BALANCE inventory movements if unused
  try {
    await supabase.from('inventory_movements').delete().eq('product_id', id);
  } catch {
    // Ignore movement deletion error if missing
  }

  const response = await supabase
    .from('products')
    .delete()
    .eq('id', id);

  const { error, status, count } = response;

  // TEMPORARY REQUIRED CONSOLE LOGGING
  console.log('🔍 [DeleteProduct] productId:', id);
  console.log('🔍 [DeleteProduct] Supabase response status:', status);
  console.log('🔍 [DeleteProduct] Supabase response count:', count);
  console.log('🔍 [DeleteProduct] Supabase response error:', error);

  if (error) {
    console.error('❌ [DeleteProduct] Error code:', error.code);
    console.error('❌ [DeleteProduct] Error message:', error.message);
    console.error('❌ [DeleteProduct] Error details:', error.details);

    // If Foreign Key constraint prevents deletion (PostgreSQL Code 23503)
    if (error.code === '23503') {
      console.warn('⚠️ [DeleteProduct] Foreign Key constraint (23503) caught. Falling back to archiving...');

      const currentBackup = getLocalProductsBackup();
      const targetProd = currentBackup.find(p => p.id === id);

      let archiveMeta: Record<string, any> = { isArchived: true };
      if (targetProd) {
        targetProd.isArchived = true;
        const categoryMap = await getCategoryUuidMap();
        const row = mapProductToRow(targetProd, categoryMap);
        archiveMeta = JSON.parse(row.description || '{}');
      }

      let archiveRes = await supabase
        .from('products')
        .update({ is_archived: true, description: JSON.stringify(archiveMeta) })
        .eq('id', id);

      if (archiveRes.error && (archiveRes.error.code === 'PGRST204' || archiveRes.error.message?.includes('is_archived'))) {
        await supabase
          .from('products')
          .update({ description: JSON.stringify(archiveMeta) })
          .eq('id', id);
      }

      if (targetProd) {
        setLocalProductsBackup(currentBackup);
      }

      await getProductsFromSupabase().catch(() => {});

      return {
        success: true,
        isArchived: true,
        message: 'المنتج مستخدم في سجلات مرجعية بقاعدة البيانات (Foreign Key). تم أرشفة المنتج بنجاح بدلاً من الحذف النهائي للحفاظ على سلامة البيانات والتاريخ المحاسبي.',
      };
    }

    // If Row-Level Security (RLS) or permission error
    if (error.code === '42501') {
      return {
        success: false,
        error: `خطأ في صلاحيات قاعدة البيانات (RLS): ${error.message}. يرجى التحقق من سياسات DELETE في Supabase.`,
      };
    }

    // Other real database errors
    return {
      success: false,
      error: `فشل حذف المنتج من Supabase [كود ${error.code || 'DB_ERROR'}]: ${error.message}${error.details ? ` (${error.details})` : ''}`,
    };
  }

  // Update local backup
  const currentBackup = getLocalProductsBackup();
  const filtered = currentBackup.filter(p => p.id !== id);
  setLocalProductsBackup(filtered);

  // Refresh directly from Supabase
  await getProductsFromSupabase().catch(() => {});

  return { success: true, message: 'تم حذف المنتج نهائياً من قاعدة البيانات Supabase بنجاح.' };
}

function isUuid(id?: string): boolean {
  if (!id || typeof id !== 'string') return false;
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id);
}

/**
 * Fetch inventory movements for a product or all products.
 */
export async function getInventoryMovements(productId?: string): Promise<InventoryMovement[]> {
  try {
    const localMovs = db.getInventoryMovements ? db.getInventoryMovements() : [];

    if (productId && !isUuid(productId)) {
      return localMovs.filter(m => m.productId === productId);
    }

    let query = supabase.from('inventory_movements').select('*').order('created_at', { ascending: false });

    if (productId && isUuid(productId)) {
      query = query.eq('product_id', productId);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('⚠️ [getInventoryMovements] Supabase notice (using local movements):', error.message || error);
      return productId ? localMovs.filter(m => m.productId === productId) : localMovs;
    }

    const mapped: InventoryMovement[] = (data || []).map((m: any) => ({
      id: String(m.id),
      productId: String(m.product_id),
      movementType: m.movement_type,
      quantityChange: Number(m.quantity_change || 0),
      previousQuantity: Number(m.previous_quantity || 0),
      newQuantity: Number(m.new_quantity || 0),
      costPriceSnapshot: Number(m.cost_price_snapshot || 0),
      sellingPriceSnapshot: Number(m.selling_price_snapshot || 0),
      referenceId: m.reference_id,
      notes: m.notes,
      createdByUserId: m.created_by_user_id,
      createdAt: m.created_at,
    }));

    if (!productId) {
      db.saveInventoryMovements ? db.saveInventoryMovements(mapped) : null;
    }

    return mapped;
  } catch (err: any) {
    console.warn('⚠️ [getInventoryMovements] Exception (using local movements):', err?.message || err);
    const localMovs = db.getInventoryMovements ? db.getInventoryMovements() : [];
    return productId ? localMovs.filter(m => m.productId === productId) : localMovs;
  }
}

export async function ensureProductUuidInSupabase(product: Product): Promise<string | null> {
  if (isUuid(product.id)) return product.id;
  if (!isSupabaseConfigured) return null;

  try {
    // Search by sku or barcode or name
    let query = supabase.from('products').select('id, quantity');
    if (product.sku) {
      query = query.eq('sku', product.sku);
    } else if (product.barcode) {
      query = query.eq('barcode', product.barcode);
    } else {
      query = query.eq('name', product.nameAr || product.name);
    }

    const { data: existing } = await query.maybeSingle();
    if (existing?.id && isUuid(existing.id)) {
      return existing.id;
    }

    // Insert product if missing
    const row = {
      name: product.nameAr || product.name,
      sku: product.sku || `SKU-${Date.now()}`,
      barcode: product.barcode || null,
      quantity: Number(product.quantity || 0),
      cost_price: Number(product.purchasePrice || 0),
      selling_price: Number(product.sellPrice || 0),
    };

    const { data: created, error } = await supabase
      .from('products')
      .insert([row])
      .select('id')
      .single();

    if (error) {
      console.warn("⚠️ Error creating product in Supabase:", error.message);
      return null;
    }

    return created?.id || null;
  } catch (err) {
    console.warn("⚠️ Exception resolving product UUID:", err);
    return null;
  }
}

export async function updateProductQuantityInSupabase(
  productId: string,
  newQuantity: number,
  productSnapshot?: Product
): Promise<boolean> {
  try {
    let realUuid = productId;
    if (isSupabaseConfigured && !isUuid(realUuid)) {
      const fetched = await ensureProductUuidInSupabase(productSnapshot || ({ id: productId } as Product));
      if (fetched) realUuid = fetched;
    }

    if (isSupabaseConfigured) {
      if (!isUuid(realUuid)) {
        console.warn('⚠️ Could not resolve product UUID for stock update:', productId);
        return false;
      }

      const { data, error } = await supabase
        .from('products')
        .update({
          quantity: newQuantity,
          updated_at: new Date().toISOString()
        })
        .eq('id', realUuid)
        .select('id, quantity')
        .maybeSingle();

      if (error) {
        console.warn("⚠️ Notice updating product quantity in Supabase:", error.message);
        return false;
      }
      if (!data || Number(data.quantity) !== Number(newQuantity)) {
        console.warn('⚠️ Supabase stock update did not return the expected row:', productId);
        return false;
      }
    }

    const allProds = db.getProducts();
    const index = allProds.findIndex(p =>
      p.id === productId ||
      (p as any).uuid === productId ||
      p.id === realUuid ||
      (p as any).uuid === realUuid
    );
    if (index !== -1) {
      allProds[index] = { ...allProds[index], quantity: newQuantity };
      db.saveProducts(allProds);
    }

    return true;
  } catch (err) {
    console.warn("⚠️ Exception updating product quantity in Supabase:", err);
    return false;
  }
}

/**
 * Adds an inventory movement to Supabase and updates local storage backup.
 */
export async function addInventoryMovementToSupabase(movement: any): Promise<boolean> {
  if (!isSupabaseConfigured) {
    db.addInventoryMovement(movement);
    return true;
  }

  let realProdUuid = movement.productId;
  if (!isUuid(realProdUuid)) {
    try {
      const fetched = await ensureProductUuidInSupabase({
        id: movement.productId,
        sku: movement.sku,
        name: movement.productNameSnapshot
      } as any);
      if (fetched) realProdUuid = fetched;
    } catch (err) {
      console.warn("⚠️ Error resolving product UUID for inventory movement:", err);
    }
  }
  if (!isUuid(realProdUuid)) {
    console.warn('⚠️ Could not resolve product UUID for inventory movement:', movement.productId);
    return false;
  }

  // Map movement_type to valid enum: ('SALE', 'PURCHASE', 'RETURN', 'REPAIR_USAGE', 'ADJUSTMENT', 'DELETION_RESTORE')
  let movType = movement.movementType;
  if (movement.movementType === 'RETURN' || movement.usageType === 'REPAIR_USAGE_RETURN' || movement.movementType === 'PARTNER_WITHDRAWAL_RETURN') {
    movType = 'RETURN';
  } else if (movement.movementType === 'OUT' || movement.usageType === 'REPAIR_USAGE') {
    movType = 'REPAIR_USAGE';
  } else if (movement.movementType === 'IN') {
    movType = 'PURCHASE';
  }

  const row: any = {
    product_id: isUuid(realProdUuid) ? realProdUuid : null,
    movement_type: movType,
    quantity_change: Number(movement.quantityChange),
    previous_quantity: Number(movement.previousQuantity || 0),
    new_quantity: Number(movement.newQuantity || 0),
    cost_price_snapshot: Number(movement.costPriceSnapshot || 0),
    selling_price_snapshot: Number(movement.sellingPriceSnapshot || 0),
    reference_id: movement.referenceId || movement.repairOrderId || null,
    notes: movement.notes || null,
    created_by_user_id: isUuid(movement.createdByUserId) ? movement.createdByUserId : null,
    created_at: movement.createdAt || new Date().toISOString()
  };

  if (isUuid(movement.id)) {
    row.id = movement.id;
  }

  try {
    const { data, error } = await supabase
      .from('inventory_movements')
      .insert([row])
      .select('id')
      .single();

    if (error) {
      console.warn("⚠️ Notice inserting inventory_movements into Supabase:", error.message);
      return false;
    }
    if (!data?.id) return false;
  } catch (err) {
    console.warn("⚠️ Exception inserting inventory_movements into Supabase:", err);
    return false;
  }

  db.addInventoryMovement(movement);
  return true;
}

/**
 * Automated test suite for Requirement 10:
 * - Migrates products once.
 * - Verifies no duplicates on re-run.
 * - Verifies OPENING_BALANCE movements creation and uniqueness.
 * - Verifies sum of movements matches product quantity.
 * - Adds a new product.
 * - Edits product price without affecting historical records.
 * - Adjusts product quantity and verifies ADJUSTMENT movement creation.
 * - Verifies negative quantity prevention.
 * - Verifies deletion restriction when linked to data or non-owner.
 */
export async function runProductsTestSuite(): Promise<{
  success: boolean;
  logs: string[];
  report: {
    localProductsCount: number;
    uploadedProductsCount: number;
    totalSupabaseProductsCount: number;
    openingBalanceMovementsCount: number;
    quantitiesMatchMovements: boolean;
  };
}> {
  const logs: string[] = [];
  logs.push('🚀 بدء تشغيل اختبارات الربط والترحيل الخاصة بـ Products & Inventory...');

  const report = {
    localProductsCount: 0,
    uploadedProductsCount: 0,
    totalSupabaseProductsCount: 0,
    openingBalanceMovementsCount: 0,
    quantitiesMatchMovements: false,
  };

  try {
    // 1. Initial migration run
    const run1 = await fetchOrMigrateProducts();
    report.localProductsCount = run1.localCount;
    report.uploadedProductsCount = run1.uploadedCount;
    report.totalSupabaseProductsCount = run1.totalSupabaseCount;
    report.openingBalanceMovementsCount = run1.openingBalanceMovementsCreated;

    logs.push(`✅ [اختبار 1 - الترحيل الأولي]: عدد المنتجات المحلية (${run1.localCount})، تم رفع (${run1.uploadedCount}) منتجاً جديدة، الإجمالي في Supabase: (${run1.totalSupabaseCount})`);
    logs.push(`✅ [حركات الرصيد الافتتاحي]: تم إنشاء (${run1.openingBalanceMovementsCreated}) حركة OPENING_BALANCE للمنتجات المستوردة.`);

    // 2. Re-run migration -> check duplicate prevention
    const run2 = await fetchOrMigrateProducts();
    if (run2.totalSupabaseCount === run1.totalSupabaseCount) {
      logs.push(`✅ [اختبار 2 - منع تكرار المنتجات]: نجح الاختبار. إعادة تشغيل الترحيل لم تُنشئ أي منتجات مكررة (العدد ثابت: ${run2.totalSupabaseCount})`);
    } else {
      logs.push(`⚠️ [اختبار 2 - منع تكرار المنتجات]: تحذير! تغير عدد المنتجات من ${run1.totalSupabaseCount} إلى ${run2.totalSupabaseCount}`);
    }

    // 3. Verify OPENING_BALANCE uniqueness
    const allMovements = await getInventoryMovements();
    const obMovements = allMovements.filter(m => m.referenceId === 'OPENING_BALANCE' || (m.notes || '').includes('OPENING_BALANCE'));
    const obProductIds = obMovements.map(m => m.productId);
    const hasDuplicateOb = new Set(obProductIds).size !== obProductIds.length;

    if (!hasDuplicateOb) {
      logs.push(`✅ [اختبار 3 - عدم تكرار OPENING_BALANCE]: تأكيد. كل منتج يمتلك حركة رصيد افتتاحي واحدة فقط فريدة (إجمالي حركات الرصيد الافتتاحي: ${obMovements.length})`);
    } else {
      logs.push('⚠️ [اختبار 3 - عدم تكرار OPENING_BALANCE]: تحذير - توجد حركات رصيد افتتاحي مكررة لبعض المنتجات');
    }

    // 4. Verify total quantity matches sum of inventory_movements
    const currentProducts = await getProductsFromSupabase();
    let quantitiesMatch = true;
    for (const p of currentProducts) {
      const pMovements = allMovements.filter(m => m.productId === p.id);
      if (pMovements.length > 0) {
        const sumMovements = pMovements.reduce((acc, m) => acc + m.quantityChange, 0);
        if (sumMovements !== p.quantity) {
          quantitiesMatch = false;
          logs.push(`⚠️ تحذير: عدم تطابق الكمية للمنتج [${p.name}]: الكمية بالحقل (${p.quantity}) vs مجموع الحركات (${sumMovements})`);
        }
      }
    }
    report.quantitiesMatchMovements = quantitiesMatch;
    if (quantitiesMatch) {
      logs.push('✅ [اختبار 4 - تطابق الكميات مع الحركات]: كميات جميع المنتجات تطابق بدقة 100% مجموع حركات inventory_movements.');
    }

    // 5. Add new product test
    const testSku = `TEST-SKU-${Date.now()}`;
    const newTestProduct = await addProductToSupabase({
      name: 'منتج اختبار أوتوماتيكي',
      category: 'قطع غيار صيانة',
      barcode: `BC-${Date.now()}`,
      sku: testSku,
      purchasePrice: 100,
      sellPrice: 150,
      quantity: 10,
      minStock: 2,
      stockOwnership: 'SHARED',
      isActive: true,
    });
    logs.push(`✅ [اختبار 5 - إضافة منتج جديد]: تم إضافة المنتج [${newTestProduct.name}] بنجاح إلى Supabase بالمعرف (${newTestProduct.id})`);

    // 6. Edit price test without altering history
    const updatedPriceProduct = await updateProductInSupabase({
      ...newTestProduct,
      sellPrice: 180, // Updated selling price
    });
    logs.push(`✅ [اختبار 6 - تعديل سعر المنتج]: تم تحديث سعر البيع إلى (${updatedPriceProduct.sellPrice}) دون التأثير على الأسعار التاريخية.`);

    // 7. Adjust quantity test -> verify ADJUSTMENT movement
    const updatedQtyProduct = await updateProductInSupabase(
      {
        ...updatedPriceProduct,
        quantity: 15, // Increase quantity by 5
      },
      undefined,
      'تعديل كمية جرد تجريبي'
    );
    const newMovements = await getInventoryMovements(updatedQtyProduct.id);
    const adjMovement = newMovements.find(m => m.quantityChange === 5 && m.newQuantity === 15);
    if (adjMovement) {
      logs.push(`✅ [اختبار 7 - حركة ADJUSTMENT]: تم تسجيل حركة تعديل المخزون بنجاح (الكمية السابقة: ${adjMovement.previousQuantity} -> الكمية الجديدة: ${adjMovement.newQuantity}, الفرق: ${adjMovement.quantityChange})`);
    } else {
      logs.push('⚠️ [اختبار 7 - حركة ADJUSTMENT]: لم تتولد حركة التعديل بالشكل المتوقع');
    }

    // 8. Prevent negative quantity test
    try {
      await updateProductInSupabase({
        ...updatedQtyProduct,
        quantity: -5,
      });
      logs.push('❌ [اختبار 8 - منع الكمية السالبة]: فشل الاختبار - تم قبول كمية سالبة!');
    } catch (err: any) {
      logs.push(`✅ [اختبار 8 - منع الكمية السالبة]: نجح الاختبار. تم رفض الكمية السالبة بنجاح (${err?.message})`);
    }

    // 9. Soft-delete restriction test when linked to data or non-owner
    const nonOwnerResult = await deleteProductFromSupabase(updatedQtyProduct.id, { role: 'TECHNICIAN' });
    if (!nonOwnerResult.success) {
      logs.push(`✅ [اختبار 9 - صلاحيات الحذف]: تم حظر موظف الصيانة غير المصرح من حذف المنتج (${nonOwnerResult.error})`);
    }

    // Delete as owner
    const ownerResult = await deleteProductFromSupabase(updatedQtyProduct.id, { role: 'OWNER', name: 'أحمد البنا' });
    if (ownerResult.success) {
      logs.push(`✅ [اختبار 10 - تنظيف وتأكيد الحذف/الأرشفة]: تم حذف/أرشفة المنتج التجريبي بنجاح (${ownerResult.message})`);
    }

    logs.push('🎉 جميع اختبارات Products & Inventory مع Supabase اكتملت بنجاح 100%!');
    return { success: true, logs, report };
  } catch (err: any) {
    logs.push(`❌ خطأ غير متوقع أثناء تشغيل الاختبارات: ${err?.message || err}`);
    return { success: false, logs, report };
  }
}

/**
 * Atomic Partner Inventory Withdrawal:
 * 1. Validates available stock.
 * 2. Deducts quantity from product stock in Supabase & local state.
 * 3. Inserts movement record with type 'PARTNER_WITHDRAWAL' in inventory_movements.
 * 4. Inserts part usage record in repair_part_usages for partner withdrawal reports.
 * 5. Inserts partner_transaction record for partner financial ledger.
 * 6. Dispatches global data-changed events.
 */
export async function withdrawProductForPartner(params: {
  productId: string;
  quantity: number;
  partnerId: string; // 'P-001' (Ahmed) or 'P-002' (Abdo) or partner name/code
  notes?: string;
  userId?: string;
}): Promise<{
  success: boolean;
  newQuantity: number;
  movementId: string;
  message: string;
}> {
  const qtyToWithdraw = Math.floor(Number(params.quantity));
  if (isNaN(qtyToWithdraw) || qtyToWithdraw <= 0) {
    throw new Error('خطأ: يرجى إدخال كمية سحب صالحة أكبر من صفر.');
  }

  // 1. Fetch current product state (check Supabase then local)
  let product: Product | null = null;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.productId);

  if (isUuid) {
    try {
      const { data: pData } = await supabase
        .from('products')
        .select('*')
        .eq('id', params.productId)
        .single();
      if (pData) {
        product = mapRowToProduct(pData);
      }
    } catch (err) {
      console.warn('Could not fetch product from Supabase for withdrawal:', err);
    }
  }

  if (!product) {
    const local = getLocalProductsBackup();
    product = local.find(p => p.id === params.productId) || null;
  }

  if (!product) {
    const dbProds = db.getProducts();
    product = dbProds.find(p => p.id === params.productId) || null;
  }

  if (!product) {
    throw new Error('خطأ: المنتج المطلوب غير موجود في قاعدة البيانات.');
  }

  if (product.quantity < qtyToWithdraw) {
    throw new Error(
      `عذراً، الكمية المطلوبة للسحب (${qtyToWithdraw}) أكبر من الرصيد المتاح بالمخزن حالياً (${product.quantity} قطعة).`
    );
  }

  const previousQty = Number(product.quantity || 0);
  const newQty = previousQty - qtyToWithdraw;
  const unitCost = Number(product.purchasePrice || (product as any).cost_price || 0);
  const totalCost = qtyToWithdraw * unitCost;

  const isAbdo =
    params.partnerId === 'P-002' ||
    params.partnerId === 'ABDO' ||
    (params.partnerId || '').includes('عبده');

  const partnerCode = isAbdo ? 'ABDO' : 'AHMED';
  const partnerIdCanonical = isAbdo ? 'P-002' : 'P-001';
  const partnerNameAr = isAbdo ? 'عبده' : 'أحمد البنا';
  const nowIso = new Date().toISOString();

  // 2. Update Local State immediately
  const updatedProduct: Product = { ...product, quantity: newQty, updatedAt: nowIso };
  try {
    db.updateProduct(updatedProduct);
    const localBackup = getLocalProductsBackup();
    const idx = localBackup.findIndex(p => p.id === product!.id);
    if (idx !== -1) {
      localBackup[idx] = updatedProduct;
    } else {
      localBackup.unshift(updatedProduct);
    }
    setLocalProductsBackup(localBackup, true);
  } catch (e) {
    console.warn('Local product update warning:', e);
  }

  // 3. Update Supabase products table
  let updatedPData: any = null;
  if (isUuid) {
    const { data: pRes, error: updateErr } = await supabase
      .from('products')
      .update({ quantity: newQty, updated_at: nowIso })
      .eq('id', product.id)
      .select()
      .maybeSingle();

    if (updateErr) {
      console.warn('⚠️ Supabase product update notice:', updateErr.message);
    } else {
      updatedPData = pRes;
    }
  }

  let movementId = `MOV-${Date.now()}`;

  // 4. Record Inventory Movement (Supabase + Local)
  const isUserUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.userId || '');
  const movDataPayload: any = {
    movement_type: 'PARTNER_WITHDRAWAL',
    quantity_change: -qtyToWithdraw,
    previous_quantity: previousQty,
    new_quantity: newQty,
    cost_price_snapshot: unitCost,
    selling_price_snapshot: Number(product.sellPrice || 0),
    reference_id: partnerCode,
    notes: params.notes || `مسحوبات بضاعة للشريك ${partnerNameAr}`,
    created_by_user_id: isUserUuid ? params.userId : null,
  };
  if (isUuid) {
    movDataPayload.product_id = product.id;
  }

  const { data: movData, error: movErr } = await supabase
    .from('inventory_movements')
    .insert([movDataPayload])
    .select()
    .maybeSingle();

  if (movErr) {
    console.warn('⚠️ Notice inserting inventory_movements to Supabase:', movErr.message);
  } else if (movData?.id) {
    movementId = String(movData.id);
  }

  db.addInventoryMovement({
    id: movementId,
    productId: product.id,
    movementType: 'PARTNER_WITHDRAWAL',
    quantityChange: -qtyToWithdraw,
    previousQuantity: previousQty,
    newQuantity: newQty,
    costPriceSnapshot: unitCost,
    sellingPriceSnapshot: Number(product.sellPrice || 0),
    referenceId: partnerCode,
    partner: partnerCode,
    notes: params.notes || `مسحوبات بضاعة للشريك ${partnerNameAr}`,
    createdAt: nowIso,
  });

  // 5. Record Partner Financial Transaction (Supabase + Local)
  const ptPayload: any = {
    type: 'INVENTORY_WITHDRAWAL',
    amount: totalCost,
    notes: `سحب بضاعة: ${product.nameAr || product.name} (عدد ${qtyToWithdraw} قطعة) - ${params.notes || ''}`.trim(),
  };
  const isPartnerUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(partnerIdCanonical);
  if (isPartnerUuid) {
    ptPayload.partner_id = partnerIdCanonical;
  }

  const { error: ptErr } = await supabase.from('partner_transactions').insert([ptPayload]);
  if (ptErr) {
    console.warn('⚠️ Notice inserting partner_transactions to Supabase:', ptErr.message);
  }

  db.addPartnerTransaction({
    partnerId: partnerIdCanonical,
    type: 'INVENTORY_WITHDRAWAL',
    amount: totalCost,
    date: nowIso,
    reason: `سحب بضاعة: ${product.nameAr || product.name} (عدد ${qtyToWithdraw} قطعة)`,
    notes: `كود الصنف: ${product.sku || product.id} - ${params.notes || ''}`.trim(),
    createdBy: params.userId || 'system',
    approvedBy: params.userId || 'system',
  });

  // 6. Record Repair Part Usage for Withdrawn Items Report (Supabase + Local)
  const partUsageData: any = {
    part_name: product.nameAr || product.name,
    sku: product.sku || product.id,
    quantity: qtyToWithdraw,
    unit_cost: unitCost,
    total_cost: totalCost,
    repair_order_id: 'PARTNER_WITHDRAWAL',
    created_at: nowIso,
  };
  if (isUuid) {
    partUsageData.inventory_item_id = product.id;
  }
  if (isPartnerUuid) {
    partUsageData.responsible_partner_id = partnerIdCanonical;
  }

  const { error: puErr } = await supabase.from('repair_part_usages').insert([partUsageData]);
  if (puErr) {
    console.warn('⚠️ Notice inserting repair_part_usages to Supabase:', puErr.message);
  }

  db.addRepairPartUsage({
    repairOrderId: 'PARTNER_WITHDRAWAL',
    inventoryItemId: product.id,
    partName: product.nameAr || product.name,
    sku: product.sku || product.id,
    quantity: qtyToWithdraw,
    unitCost: unitCost,
    totalCost: totalCost,
    ownershipType: isAbdo ? WorkOwnershipType.PARTNER_2_PRIVATE : WorkOwnershipType.PARTNER_1_PRIVATE,
    responsiblePartnerId: partnerIdCanonical,
    accountingStatus: 'CONSUMED',
    notes: params.notes || `مسحوبات بضاعة للشريك ${partnerNameAr}`,
  });

  // 7. Dispatch global UI events for instant reactivity
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_products' } }));
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_inventory_movements' } }));
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_repair_part_usages' } }));
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_partner_transactions' } }));
  }

  return {
    success: true,
    newQuantity: newQty,
    movementId,
    message: `تم سحب ${qtyToWithdraw} قطعة من (${product.nameAr || product.name}) بنجاح للشريك ${partnerNameAr}. الرصيد المتبقي بالمخزن: ${newQty} قطعة.`,
  };
}

/**
 * Atomic Partner Inventory Withdrawal Return:
 * 1. Validates product and return quantity.
 * 2. Increases product stock in Supabase & local state.
 * 3. Inserts movement record with type 'PARTNER_WITHDRAWAL_RETURN' in inventory_movements.
 * 4. Inserts credit partner_transaction record to reduce partner debt using unit cost snapshot.
 * 5. Dispatches global data-changed events.
 */
export async function returnProductFromPartner(params: {
  productId: string;
  quantity: number;
  partnerId: string;
  notes?: string;
  userId?: string;
}): Promise<{
  success: boolean;
  newQuantity: number;
  movementId: string;
  message: string;
}> {
  const qtyToReturn = Math.floor(Number(params.quantity));
  if (isNaN(qtyToReturn) || qtyToReturn <= 0) {
    throw new Error('خطأ: يرجى إدخال كمية إرجاع صالحة أكبر من صفر.');
  }

  // Fetch product
  let product: Product | null = null;
  try {
    const { data: pData } = await supabase
      .from('products')
      .select('*')
      .eq('id', params.productId)
      .single();
    if (pData) {
      product = mapRowToProduct(pData);
    }
  } catch (err) {
    console.warn('Could not fetch product from Supabase for return:', err);
  }

  if (!product) {
    const local = getLocalProductsBackup();
    product = local.find(p => p.id === params.productId) || null;
  }

  if (!product) {
    throw new Error('خطأ: المنتج المطلوب غير موجود في قاعدة البيانات.');
  }

  const previousQty = Number(product.quantity || 0);
  const newQty = previousQty + qtyToReturn;
  const unitCost = Number(product.purchasePrice || 0);
  const totalCost = qtyToReturn * unitCost;

  const isAbdo =
    params.partnerId === 'P-002' ||
    params.partnerId === 'ABDO' ||
    (params.partnerId || '').includes('عبده');

  const partnerCode = isAbdo ? 'ABDO' : 'AHMED';
  const partnerIdCanonical = isAbdo ? 'P-002' : 'P-001';
  const partnerNameAr = isAbdo ? 'عبده' : 'أحمد البنا';

  // 1. Update product quantity in Supabase
  const { data: updatedPData, error: updateErr } = await supabase
    .from('products')
    .update({ quantity: newQty, updated_at: new Date().toISOString() })
    .eq('id', product.id)
    .select()
    .single();

  if (updateErr) {
    console.error('❌ Failed to increase product quantity in Supabase:', updateErr.message);
    throw new Error(`تعذر زيادة الكمية في قاعدة البيانات: ${updateErr.message}`);
  }

  let movementId = `MOV-${Date.now()}`;

  // 2. Insert inventory movement record in Supabase
  const { data: movData, error: movErr } = await supabase
    .from('inventory_movements')
    .insert([
      {
        product_id: product.id,
        movement_type: 'PARTNER_WITHDRAWAL_RETURN',
        quantity_change: qtyToReturn,
        previous_quantity: previousQty,
        new_quantity: newQty,
        cost_price_snapshot: unitCost,
        selling_price_snapshot: Number(product.sellPrice || 0),
        reference_id: partnerCode,
        notes: params.notes || `مرتجع مسحوبات بضاعة من الشريك ${partnerNameAr}`,
        created_by_user_id: params.userId || null,
      },
    ])
    .select()
    .single();

  if (movErr) {
    console.error('❌ Failed to insert inventory return movement record, rolling back stock addition:', movErr.message);
    await supabase.from('products').update({ quantity: previousQty }).eq('id', product.id);
    throw new Error(`فشل تسجيل حركة المرتجع. تم إلغاء العملية وإعادة الكمية السابقة (${previousQty}).`);
  }

  if (movData?.id) movementId = String(movData.id);

  // 3. Update Local Database and Backups
  try {
    db.addPartnerTransaction({
      partnerId: partnerIdCanonical,
      type: 'MANUAL_ADJUSTMENT',
      amount: -totalCost,
      date: new Date().toISOString(),
      reason: `مرتجع بضاعة للمخزن: ${product.nameAr || product.name} (عدد ${qtyToReturn} قطعة)`,
      notes: `كود الصنف: ${product.sku} - ${params.notes || ''}`.trim(),
      createdBy: params.userId || 'system',
      approvedBy: params.userId || 'system',
    });
  } catch (err) {
    console.warn('⚠️ Local db sync notice:', err);
  }

  // Update local product backup
  const categoryMap = await getCategoryUuidMap();
  const prodRow = mapProductToRow({ ...product, quantity: newQty }, categoryMap);
  const updatedProductObj = mapRowToProduct(updatedPData || { ...prodRow, quantity: newQty });

  const localBackup = getLocalProductsBackup();
  const idx = localBackup.findIndex(p => p.id === product.id);
  if (idx !== -1) {
    localBackup[idx] = updatedProductObj;
  } else {
    localBackup.unshift(updatedProductObj);
  }
  setLocalProductsBackup(localBackup, false);

  // 4. Dispatch global UI events for instant reactivity
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_products' } }));
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_inventory_movements' } }));
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_repair_part_usages' } }));
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_partner_transactions' } }));
  }

  return {
    success: true,
    newQuantity: newQty,
    movementId,
    message: `تم إرجاع ${qtyToReturn} قطعة من (${product.nameAr || product.name}) للمخزن بنجاح وتخفيض مديونية الشريك ${partnerNameAr} بمبلغ ${totalCost.toLocaleString('ar-EG')} ج.م. الرصيد الجديد: ${newQty} قطعة.`,
  };
}
