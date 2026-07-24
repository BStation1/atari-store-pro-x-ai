import { supabase } from './supabaseClient';
import { Invoice, InvoiceItem, PaymentMethod, User } from '../types';

const INVOICES_STORAGE_KEY = 'atari_invoices';

export const DEFAULT_INVOICES: Invoice[] = [];

export function getLocalInvoicesBackup(): Invoice[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(INVOICES_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error reading local invoices backup:', e);
  }
  return [];
}

export function saveLocalInvoicesBackup(data: Invoice[], dispatchEvent = true): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify(data));
      if (dispatchEvent) {
        window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: INVOICES_STORAGE_KEY } }));
      }
    }
  } catch (e) {
    console.error('Error saving local invoices backup:', e);
  }
}

/**
 * Utility UUID checker
 */
function isUuid(id?: string): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Maps local PaymentMethod enum / string to Supabase payment_method_enum
 */
export function mapPaymentMethodToEnum(pm?: PaymentMethod | string): 'cash' | 'card' | 'transfer' | 'credit' {
  if (!pm) return 'cash';
  const str = String(pm).toUpperCase();
  if (str === 'CASH' || str === 'نقدي') return 'cash';
  if (str === 'VISA' || str === 'CARD' || str === 'فيزا' || str === 'بطاقة') return 'card';
  if (str === 'TRANSFER' || str === 'BANK_TRANSFER' || str === 'تحويل') return 'transfer';
  if (str === 'DEBT' || str === 'CREDIT' || str === 'آجل') return 'credit';
  return 'cash';
}

/**
 * Maps Supabase payment_method_enum to local PaymentMethod enum
 */
export function mapEnumToPaymentMethod(enumVal?: string): PaymentMethod {
  if (enumVal === 'card') return PaymentMethod.Visa;
  if (enumVal === 'transfer') return PaymentMethod.InstaPay;
  if (enumVal === 'credit') return PaymentMethod.Cash;
  return PaymentMethod.Cash;
}

/**
 * Maps Supabase database row and items rows to local Invoice object.
 */
export function mapRowToInvoice(row: Record<string, any>, itemRows: Record<string, any>[]): Invoice {
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

  const items: InvoiceItem[] = (itemRows || []).map(item => ({
    productId: item.product_id || undefined,
    name: item.product_name_snapshot || '',
    quantity: typeof item.quantity === 'number' ? item.quantity : Number(item.quantity || 1),
    price: typeof item.unit_price_snapshot === 'number' ? item.unit_price_snapshot : Number(item.unit_price_snapshot || 0),
    costPrice: typeof item.unit_cost_snapshot === 'number' ? item.unit_cost_snapshot : Number(item.unit_cost_snapshot || 0),
    stockOwnership: item.stock_ownership_snapshot || 'SHARED'
  }));

  const invoiceNum = row.invoice_number || meta.localId || row.id;
  const isPaid = row.status === 'paid' || Number(row.paid_amount || 0) >= Number(row.total_amount || 0);
  const isCancelled = row.status === 'cancelled' || Boolean(meta.isCancelled);

  let mappedType: "repair" | "sales" | "parts_sale" = "sales";
  if (meta.originalType && ["repair", "sales", "parts_sale"].includes(meta.originalType)) {
    mappedType = meta.originalType;
  } else if (row.type === 'repair') {
    mappedType = "repair";
  } else {
    mappedType = "sales";
  }

  return {
    id: invoiceNum,
    customerId: row.customer_id || meta.customerId || 'C-001',
    orderId: row.repair_order_id || meta.orderId || undefined,
    items,
    totalAmount: typeof row.total_amount === 'number' ? row.total_amount : Number(row.total_amount || 0),
    discount: typeof row.discount_amount === 'number' ? row.discount_amount : Number(row.discount_amount || 0),
    paidAmount: typeof row.paid_amount === 'number' ? row.paid_amount : Number(row.paid_amount || 0),
    paymentMethod: mapEnumToPaymentMethod(row.payment_method),
    date: row.created_at || meta.date || new Date().toISOString(),
    type: mappedType,
    isPaid,
    isCancelled,
    cancelledAt: meta.cancelledAt,
    cancelledByUserId: row.cancelled_by_user_id || meta.cancelledByUserId,
    cancelledByUserName: meta.cancelledByUserName,
    cancelReason: meta.cancelReason
  };
}

/**
 * Migration & Fetching Logic for Invoices
 */
export async function fetchOrMigrateInvoices(): Promise<{
  success: boolean;
  invoices: Invoice[];
  localCount: number;
  migratedCount: number;
  duplicatesCount: number;
  balanceMatch: boolean;
  error?: string;
}> {
  const localInvoices = getLocalInvoicesBackup();
  const localTotal = localInvoices.reduce((acc, inv) => acc + (inv.totalAmount || 0), 0);

  try {
    // 1. Fetch current invoices and invoice_items from Supabase
    const { data: dbInvoices, error: fetchInvErr } = await supabase
      .from('invoices')
      .select('*');

    if (fetchInvErr) {
      console.warn('⚠️ Supabase invoices query error, using local fallback:', fetchInvErr);
      return {
        success: false,
        invoices: localInvoices,
        localCount: localInvoices.length,
        migratedCount: 0,
        duplicatesCount: 0,
        balanceMatch: true,
        error: fetchInvErr.message
      };
    }

    const { data: dbItems, error: fetchItemsErr } = await supabase
      .from('invoice_items')
      .select('*');

    if (fetchItemsErr) {
      console.warn('⚠️ Supabase invoice_items query error:', fetchItemsErr);
    }

    const existingInvoices = dbInvoices || [];
    const existingNumMap = new Map<string, any>();
    existingInvoices.forEach(r => {
      if (r.invoice_number) existingNumMap.set(String(r.invoice_number).trim(), r);
      // Check meta localId if present
      if (r.notes && typeof r.notes === 'string' && r.notes.trim().startsWith('{')) {
        try {
          const m = JSON.parse(r.notes);
          if (m.localId) existingNumMap.set(String(m.localId).trim(), r);
        } catch {}
      }
    });

    // Fetch customers & products for UUID resolution
    const { data: dbCustomers } = await supabase.from('customers').select('id, phone, name');
    const customerUuidMap = new Map<string, string>();
    (dbCustomers || []).forEach(c => {
      customerUuidMap.set(String(c.id), c.id);
      if (c.phone) customerUuidMap.set(String(c.phone).trim(), c.id);
      if (c.name) customerUuidMap.set(String(c.name).trim().toLowerCase(), c.id);
    });

    const { data: dbProducts } = await supabase.from('products').select('id, name, barcode, sku, description, cost_price, selling_price');
    const productUuidMap = new Map<string, string>();
    const productCostMap = new Map<string, number>();
    (dbProducts || []).forEach(p => {
      productUuidMap.set(String(p.id), p.id);
      if (p.barcode) productUuidMap.set(String(p.barcode).trim(), p.id);
      if (p.sku) productUuidMap.set(String(p.sku).trim(), p.id);
      if (p.name) productUuidMap.set(String(p.name).trim().toLowerCase(), p.id);
      if (p.description) {
        try {
          if (p.description.trim().startsWith('{')) {
            const m = JSON.parse(p.description);
            if (m.originalId) productUuidMap.set(String(m.originalId).trim(), p.id);
          }
        } catch {}
      }
      productCostMap.set(p.id, Number(p.cost_price || 0));
    });

    let newlyUploadedCount = 0;
    let duplicatesPrevented = 0;

    // 2. Upload missing local invoices
    for (const localInv of localInvoices) {
      const invNum = String(localInv.id || '').trim();
      if (existingNumMap.has(invNum)) {
        duplicatesPrevented++;
        continue;
      }

      // Resolve Customer UUID
      let custUuid: string | null = null;
      if (isUuid(localInv.customerId)) {
        custUuid = localInv.customerId;
      } else if (customerUuidMap.has(localInv.customerId)) {
        custUuid = customerUuidMap.get(localInv.customerId)!;
      }

      // Determine DB invoice_type_enum
      let dbType: 'sales' | 'return' | 'purchase' | 'repair' = 'sales';
      if (localInv.type === 'repair') dbType = 'repair';
      else if (localInv.type === 'parts_sale' || localInv.type === 'sales') dbType = 'sales';

      // Determine DB status
      let dbStatus: 'paid' | 'partially_paid' | 'unpaid' | 'cancelled' = 'paid';
      if (localInv.isCancelled) {
        dbStatus = 'cancelled';
      } else if (localInv.paidAmount >= localInv.totalAmount) {
        dbStatus = 'paid';
      } else if (localInv.paidAmount > 0) {
        dbStatus = 'partially_paid';
      } else {
        dbStatus = 'unpaid';
      }

      const calculatedSubtotal = (localInv.items || []).reduce((acc, item) => acc + (item.price * item.quantity), 0);
      const totalCostSnapshot = (localInv.items || []).reduce((acc, item) => acc + ((item.costPrice || 0) * item.quantity), 0);

      const meta = {
        localId: localInv.id,
        originalType: localInv.type,
        customerId: localInv.customerId,
        orderId: localInv.orderId,
        isCancelled: Boolean(localInv.isCancelled),
        cancelledAt: localInv.cancelledAt,
        cancelledByUserId: localInv.cancelledByUserId,
        cancelledByUserName: localInv.cancelledByUserName,
        cancelReason: localInv.cancelReason,
        date: localInv.date
      };

      const invoiceRow: Record<string, any> = {
        invoice_number: invNum.startsWith('INV-') ? invNum : `INV-2026-${invNum}`,
        type: dbType,
        customer_id: custUuid,
        repair_order_id: isUuid(localInv.orderId) ? localInv.orderId : null,
        subtotal: calculatedSubtotal > 0 ? calculatedSubtotal : localInv.totalAmount,
        discount_amount: Number(localInv.discount || 0),
        total_amount: Number(localInv.totalAmount || 0),
        total_cost_snapshot: totalCostSnapshot,
        paid_amount: Number(localInv.paidAmount || 0),
        remaining_amount: Math.max(0, Number(localInv.totalAmount || 0) - Number(localInv.paidAmount || 0)),
        payment_method: mapPaymentMethodToEnum(localInv.paymentMethod),
        status: dbStatus,
        notes: JSON.stringify(meta),
        created_at: localInv.date || new Date().toISOString()
      };

      // Atomic Insert Step 1: Insert Invoice Header
      const { data: insertedInv, error: insertInvErr } = await supabase
        .from('invoices')
        .insert(invoiceRow)
        .select()
        .single();

      if (insertInvErr || !insertedInv) {
        if (insertInvErr?.code === '23505') { // unique constraint on invoice_number
          duplicatesPrevented++;
        } else {
          console.warn('⚠️ Could not insert invoice header into Supabase:', insertInvErr?.message || insertInvErr);
        }
        continue;
      }

      // Atomic Insert Step 2: Insert Invoice Items
      const itemRowsToInsert = (localInv.items || []).map(item => {
        let prodUuid: string | null = null;
        if (isUuid(item.productId)) {
          prodUuid = item.productId!;
        } else if (item.productId && productUuidMap.has(item.productId)) {
          prodUuid = productUuidMap.get(item.productId)!;
        } else if (item.name && productUuidMap.has(item.name.trim().toLowerCase())) {
          prodUuid = productUuidMap.get(item.name.trim().toLowerCase())!;
        }

        const unitCost = item.costPrice !== undefined ? item.costPrice : (prodUuid ? (productCostMap.get(prodUuid) || 0) : 0);
        const qty = Number(item.quantity || 1);
        const unitPrice = Number(item.price || 0);

        return {
          invoice_id: insertedInv.id,
          product_id: prodUuid,
          product_name_snapshot: item.name || 'منتج غير مسمى',
          quantity: qty,
          unit_price_snapshot: unitPrice,
          unit_cost_snapshot: unitCost,
          stock_ownership_snapshot: item.stockOwnership || 'SHARED',
          total_price: unitPrice * qty,
          total_cost: unitCost * qty,
          created_at: localInv.date || new Date().toISOString()
        };
      });

      if (itemRowsToInsert.length > 0) {
        const { error: insertItemsErr } = await supabase
          .from('invoice_items')
          .insert(itemRowsToInsert);

        if (insertItemsErr) {
          console.warn('⚠️ Could not insert invoice items! Rolling back invoice header:', insertItemsErr.message || insertItemsErr);
          // Atomic Rollback: delete the incomplete invoice
          await supabase.from('invoices').delete().eq('id', insertedInv.id);
          continue;
        }
      }

      newlyUploadedCount++;
      existingNumMap.set(invNum, insertedInv);
    }

    // 3. Re-read fresh list of invoices and items from Supabase
    const { data: refreshedInvoices, error: reReadInvErr } = await supabase
      .from('invoices')
      .select('*');

    const { data: refreshedItems, error: reReadItemsErr } = await supabase
      .from('invoice_items')
      .select('*');

    if (reReadInvErr || !refreshedInvoices) {
      return {
        success: true,
        invoices: localInvoices,
        localCount: localInvoices.length,
        migratedCount: newlyUploadedCount,
        duplicatesCount: duplicatesPrevented,
        balanceMatch: true
      };
    }

    const itemsByInvoiceId = new Map<string, any[]>();
    (refreshedItems || []).forEach(item => {
      const invId = String(item.invoice_id);
      if (!itemsByInvoiceId.has(invId)) {
        itemsByInvoiceId.set(invId, []);
      }
      itemsByInvoiceId.get(invId)!.push(item);
    });

    const finalInvoices = refreshedInvoices.map(row => {
      const rowItems = itemsByInvoiceId.get(String(row.id)) || [];
      return mapRowToInvoice(row, rowItems);
    });

    // Check balances match
    const remoteTotal = finalInvoices.reduce((acc, inv) => acc + (inv.totalAmount || 0), 0);
    const balanceMatch = Math.abs(localTotal - remoteTotal) < 0.01 || finalInvoices.length >= localInvoices.length;

    // Update local cache
    saveLocalInvoicesBackup(finalInvoices, false);

    return {
      success: true,
      invoices: finalInvoices,
      localCount: localInvoices.length,
      migratedCount: newlyUploadedCount,
      duplicatesCount: duplicatesPrevented,
      balanceMatch
    };
  } catch (err: any) {
    console.warn('⚠️ Error in fetchOrMigrateInvoices:', err);
    return {
      success: false,
      invoices: localInvoices,
      localCount: localInvoices.length,
      migratedCount: 0,
      duplicatesCount: 0,
      balanceMatch: true,
      error: err?.message || 'خطأ غير متوقع في الاتصال بـ Supabase'
    };
  }
}

/**
 * Creates a new invoice with its items atomically in Supabase
 */
export async function addInvoiceToSupabase(
  invoiceData: Omit<Invoice, "id" | "date"> & { date?: string },
  currentUser?: User
): Promise<Invoice> {
  const nowIso = invoiceData.date || new Date().toISOString();

  // Resolve Customer UUID if needed
  let custUuid: string | null = null;
  if (isUuid(invoiceData.customerId)) {
    custUuid = invoiceData.customerId;
  } else if (invoiceData.customerId) {
    // Attempt lookup in Supabase
    const { data: matchedCust } = await supabase
      .from('customers')
      .select('id')
      .or(`id.eq.${invoiceData.customerId},phone.eq.${invoiceData.customerId}`)
      .maybeSingle();
    if (matchedCust) custUuid = matchedCust.id;
  }

  // Determine DB invoice_type_enum
  let dbType: 'sales' | 'return' | 'purchase' | 'repair' = 'sales';
  if (invoiceData.type === 'repair') dbType = 'repair';
  else if (invoiceData.type === 'parts_sale' || invoiceData.type === 'sales') dbType = 'sales';

  // Determine DB status
  let dbStatus: 'paid' | 'partially_paid' | 'unpaid' | 'cancelled' = 'paid';
  if (invoiceData.isCancelled) {
    dbStatus = 'cancelled';
  } else if (invoiceData.paidAmount >= invoiceData.totalAmount) {
    dbStatus = 'paid';
  } else if (invoiceData.paidAmount > 0) {
    dbStatus = 'partially_paid';
  } else {
    dbStatus = 'unpaid';
  }

  const calculatedSubtotal = (invoiceData.items || []).reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const totalCostSnapshot = (invoiceData.items || []).reduce((acc, item) => acc + ((item.costPrice || 0) * item.quantity), 0);

  // Generate local invoice number format if needed
  const localList = getLocalInvoicesBackup();
  const nextNum = `INV-2026-${String(localList.length + 1).padStart(3, "0")}`;

  const meta = {
    localId: nextNum,
    originalType: invoiceData.type,
    customerId: invoiceData.customerId,
    orderId: invoiceData.orderId,
    isCancelled: Boolean(invoiceData.isCancelled),
    date: nowIso
  };

  const invoiceRow: Record<string, any> = {
    invoice_number: nextNum,
    type: dbType,
    customer_id: custUuid,
    repair_order_id: isUuid(invoiceData.orderId) ? invoiceData.orderId : null,
    created_by_user_id: isUuid(currentUser?.id) ? currentUser?.id : null,
    subtotal: calculatedSubtotal > 0 ? calculatedSubtotal : invoiceData.totalAmount,
    discount_amount: Number(invoiceData.discount || 0),
    total_amount: Number(invoiceData.totalAmount || 0),
    total_cost_snapshot: totalCostSnapshot,
    paid_amount: Number(invoiceData.paidAmount || 0),
    remaining_amount: Math.max(0, Number(invoiceData.totalAmount || 0) - Number(invoiceData.paidAmount || 0)),
    payment_method: mapPaymentMethodToEnum(invoiceData.paymentMethod),
    status: dbStatus,
    notes: JSON.stringify(meta),
    created_at: nowIso
  };

  // 1. Atomic Insert: Invoice Header
  const { data: insertedInv, error: insertInvErr } = await supabase
    .from('invoices')
    .insert(invoiceRow)
    .select()
    .single();

  if (insertInvErr || !insertedInv) {
    throw new Error(insertInvErr?.message || 'فشل إنشاء الفاتورة في Supabase');
  }

  // 2. Resolve product UUIDs for items and build rows
  const itemRowsToInsert = [];
  for (const item of (invoiceData.items || [])) {
    let prodUuid: string | null = null;
    if (isUuid(item.productId)) {
      prodUuid = item.productId!;
    } else if (item.productId) {
      const { data: matchedProd } = await supabase
        .from('products')
        .select('id, cost_price')
        .or(`id.eq.${item.productId},barcode.eq.${item.productId},sku.eq.${item.productId}`)
        .maybeSingle();
      if (matchedProd) prodUuid = matchedProd.id;
    }

    const unitCost = Number(item.costPrice || 0);
    const qty = Number(item.quantity || 1);
    const unitPrice = Number(item.price || 0);

    itemRowsToInsert.push({
      invoice_id: insertedInv.id,
      product_id: prodUuid,
      product_name_snapshot: item.name || 'منتج غير مسمى',
      quantity: qty,
      unit_price_snapshot: unitPrice,
      unit_cost_snapshot: unitCost,
      stock_ownership_snapshot: item.stockOwnership || 'SHARED',
      total_price: unitPrice * qty,
      total_cost: unitCost * qty,
      created_at: nowIso
    });
  }

  // 3. Atomic Insert: Invoice Items
  if (itemRowsToInsert.length > 0) {
    const { data: insertedItems, error: insertItemsErr } = await supabase
      .from('invoice_items')
      .insert(itemRowsToInsert)
      .select();

    if (insertItemsErr) {
      // Atomic Rollback: delete invoice header if items insert fails
      await supabase.from('invoices').delete().eq('id', insertedInv.id);
      throw new Error(`فشل إضافة بنود الفاتورة: ${insertItemsErr.message}. تم إلغاء إنشاء الفاتورة لمراعاة السلامة.`);
    }

    const createdInvoice = mapRowToInvoice(insertedInv, insertedItems || []);
    // Update local cache
    saveLocalInvoicesBackup([createdInvoice, ...localList]);
    return createdInvoice;
  } else {
    const createdInvoice = mapRowToInvoice(insertedInv, []);
    saveLocalInvoicesBackup([createdInvoice, ...localList]);
    return createdInvoice;
  }
}

/**
 * Cancels an invoice in Supabase
 */
export async function cancelInvoiceInSupabase(
  invoiceId: string,
  cancelReason: string,
  currentUser?: User
): Promise<{ success: boolean; message: string }> {
  // Find invoice row in Supabase
  const { data: existingInv } = await supabase
    .from('invoices')
    .select('*')
    .or(`id.eq.${invoiceId},invoice_number.eq.${invoiceId}`)
    .maybeSingle();

  if (!existingInv) {
    throw new Error(`الفاتورة رقم (${invoiceId}) غير موجودة في قاعدة البيانات.`);
  }

  let meta: Record<string, any> = {};
  try {
    if (existingInv.notes && existingInv.notes.trim().startsWith('{')) {
      meta = JSON.parse(existingInv.notes);
    }
  } catch {}

  meta.isCancelled = true;
  meta.cancelReason = cancelReason;
  meta.cancelledAt = new Date().toISOString();
  meta.cancelledByUserId = currentUser?.id;
  meta.cancelledByUserName = currentUser?.fullName || currentUser?.name;

  const { error: updateErr } = await supabase
    .from('invoices')
    .update({
      status: 'cancelled',
      notes: JSON.stringify(meta),
      updated_at: new Date().toISOString()
    })
    .eq('id', existingInv.id);

  if (updateErr) {
    throw new Error(`فشل إلغاء الفاتورة بـ Supabase: ${updateErr.message}`);
  }

  // Update local backup
  const localList = getLocalInvoicesBackup();
  const idx = localList.findIndex(inv => inv.id === invoiceId || inv.id === existingInv.invoice_number);
  if (idx !== -1) {
    localList[idx].isCancelled = true;
    localList[idx].cancelReason = cancelReason;
    localList[idx].cancelledAt = meta.cancelledAt;
    saveLocalInvoicesBackup(localList);
  }

  return {
    success: true,
    message: 'تم إلغاء الفاتورة وتحديث حالتها بنجاح بـ Supabase.'
  };
}
