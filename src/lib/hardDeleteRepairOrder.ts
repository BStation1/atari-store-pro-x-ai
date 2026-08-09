import { db } from './db';
import { isSupabaseConfigured, supabase } from './supabaseClient';
import { getLocalProductsBackup, setLocalProductsBackup } from './supabaseProducts';

export interface HardDeleteRepairOrderResult {
  success: boolean;
  restoredUnits: number;
  restoredProducts: number;
  deletedInvoices: number;
  deletedPartUsages: number;
  error?: string;
}

type RepairOrderRow = {
  id: string;
  order_number?: string | null;
  status?: string | null;
};

type PartUsageRow = {
  id: string;
  repair_order_id?: string | null;
  inventory_item_id?: string | null;
  quantity?: number | string | null;
  accounting_status?: string | null;
};

function isUuid(value?: string | null): boolean {
  if (!value) return false;
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);
}

function normalize(value?: unknown): string {
  return String(value ?? '').trim();
}

function isDeliveredStatus(value?: unknown): boolean {
  const status = normalize(value).toLowerCase();
  return status === 'delivered' || status === 'تم التسليم' || status.includes('deliver');
}

function isOwnerOrAdmin(): boolean {
  try {
    const user: any = db.getCurrentUser?.();
    const role = normalize(user?.role).toUpperCase();
    const roleId = normalize(user?.roleId).toUpperCase();
    return (
      role === 'OWNER' ||
      role === 'ADMIN' ||
      roleId === 'OWNER' ||
      roleId === 'ADMIN' ||
      user?.permissions?.includes?.('all') ||
      user?.email === 'elbannafc@gmail.com'
    );
  } catch {
    return false;
  }
}

function isIgnorableSchemaError(error: any): boolean {
  const code = normalize(error?.code).toUpperCase();
  const message = normalize(error?.message).toLowerCase();
  return (
    code === '42P01' ||
    code === '42703' ||
    code === 'PGRST204' ||
    code === 'PGRST205' ||
    message.includes('does not exist') ||
    message.includes('could not find the table') ||
    message.includes('could not find the')
  );
}

function dispatchChanged(key: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key } }));
}

function cleanupLocalStorage(orderRefs: Set<string>, restoredByProductId: Map<string, number>) {
  if (typeof localStorage === 'undefined') return;

  const matchesRef = (value: unknown) => orderRefs.has(normalize(value));
  const containsOrderRef = (value: unknown) => {
    const text = normalize(value);
    if (!text) return false;
    for (const ref of orderRefs) {
      if (ref && text.includes(ref)) return true;
    }
    return false;
  };

  try {
    const orders = JSON.parse(localStorage.getItem('atari_repair_orders') || '[]');
    if (Array.isArray(orders)) {
      localStorage.setItem(
        'atari_repair_orders',
        JSON.stringify(orders.filter((o: any) => !matchesRef(o?.id) && !matchesRef(o?.orderNumber) && !matchesRef(o?.uuid)))
      );
    }
  } catch {}

  try {
    const usages = JSON.parse(localStorage.getItem('atari_repair_part_usages') || '[]');
    if (Array.isArray(usages)) {
      localStorage.setItem(
        'atari_repair_part_usages',
        JSON.stringify(usages.filter((u: any) => !matchesRef(u?.repairOrderId) && !matchesRef(u?.repair_order_id)))
      );
    }
  } catch {}

  try {
    const invoices = JSON.parse(localStorage.getItem('atari_invoices') || '[]');
    if (Array.isArray(invoices)) {
      localStorage.setItem(
        'atari_invoices',
        JSON.stringify(invoices.filter((inv: any) => !matchesRef(inv?.orderId) && !matchesRef(inv?.repair_order_id)))
      );
    }
  } catch {}

  try {
    const movements = JSON.parse(localStorage.getItem('atari_inventory_movements') || '[]');
    if (Array.isArray(movements)) {
      localStorage.setItem(
        'atari_inventory_movements',
        JSON.stringify(
          movements.filter(
            (m: any) =>
              !matchesRef(m?.referenceId) &&
              !matchesRef(m?.reference_id) &&
              !containsOrderRef(m?.notes)
          )
        )
      );
    }
  } catch {}

  try {
    const localProducts = getLocalProductsBackup();
    if (localProducts.length > 0 && restoredByProductId.size > 0) {
      const nextProducts = localProducts.map(product => {
        const restored = restoredByProductId.get(normalize(product.id)) || 0;
        return restored > 0 ? { ...product, quantity: Number(product.quantity || 0) + restored } : product;
      });
      setLocalProductsBackup(nextProducts, false);
      try {
        db.saveProducts?.(nextProducts);
      } catch {}
    }
  } catch {}

  dispatchChanged('atari_products');
  dispatchChanged('atari_inventory_movements');
  dispatchChanged('atari_repair_part_usages');
  dispatchChanged('atari_invoices');
  dispatchChanged('atari_repair_orders');
}

async function deleteOptionalRows(table: string, column: string, value: string): Promise<void> {
  if (!value) return;
  try {
    const { error } = await supabase.from(table).delete().eq(column, value);
    if (error && !isIgnorableSchemaError(error)) {
      console.warn(`[hardDeleteRepairOrder] Optional cleanup ${table}.${column} failed:`, error.message || error);
    }
  } catch (error) {
    console.warn(`[hardDeleteRepairOrder] Optional cleanup ${table}.${column} exception:`, error);
  }
}

/**
 * Permanently removes a delivered repair order and its generated records.
 * Inventory consumed by active repair_part_usages is restored before destructive cleanup.
 * This is OWNER/ADMIN only and intentionally refuses non-delivered orders.
 */
export async function hardDeleteDeliveredRepairOrder(orderId: string): Promise<HardDeleteRepairOrderResult> {
  const result: HardDeleteRepairOrderResult = {
    success: false,
    restoredUnits: 0,
    restoredProducts: 0,
    deletedInvoices: 0,
    deletedPartUsages: 0,
  };

  if (!isOwnerOrAdmin()) {
    return { ...result, error: 'غير مصرح: الحذف النهائي متاح للمالك أو مدير النظام فقط.' };
  }

  const requestedId = normalize(orderId);
  if (!requestedId) return { ...result, error: 'رقم أمر الصيانة غير صالح.' };

  const localOrder = (() => {
    try {
      const list: any[] = JSON.parse(localStorage.getItem('atari_repair_orders') || '[]');
      return Array.isArray(list)
        ? list.find(o => normalize(o?.id) === requestedId || normalize(o?.orderNumber) === requestedId || normalize(o?.uuid) === requestedId)
        : undefined;
    } catch {
      return undefined;
    }
  })();

  if (localOrder && !isDeliveredStatus(localOrder.status) && normalize(localOrder.deliveryStatus).toUpperCase() !== 'DELIVERED') {
    return { ...result, error: 'لا يمكن الحذف النهائي إلا بعد أن تكون حالة أمر الصيانة «تم التسليم».' };
  }

  if (!isSupabaseConfigured) {
    const refs = new Set<string>([requestedId, normalize(localOrder?.orderNumber), normalize(localOrder?.uuid)].filter(Boolean));
    const restored = new Map<string, number>();
    try {
      const usages = db.getRepairPartUsages?.() || [];
      for (const usage of usages as any[]) {
        if (!refs.has(normalize(usage?.repairOrderId))) continue;
        const qty = Math.max(0, Number(usage?.quantity || 0));
        if (qty <= 0 || normalize(usage?.accountingStatus).toUpperCase() === 'RETURNED') continue;
        const productId = normalize(usage?.inventoryItemId);
        if (!productId) continue;
        restored.set(productId, (restored.get(productId) || 0) + qty);
      }
      cleanupLocalStorage(refs, restored);
      result.success = true;
      result.restoredUnits = Array.from(restored.values()).reduce((sum, q) => sum + q, 0);
      result.restoredProducts = restored.size;
      return result;
    } catch (error: any) {
      return { ...result, error: error?.message || 'تعذر تنفيذ الحذف المحلي.' };
    }
  }

  let orderRow: RepairOrderRow | null = null;
  try {
    const filters = [`order_number.eq.${requestedId}`];
    if (isUuid(requestedId)) filters.push(`id.eq.${requestedId}`);
    const { data, error } = await supabase
      .from('repair_orders')
      .select('id,order_number,status')
      .or(filters.join(','))
      .maybeSingle();
    if (error) return { ...result, error: `تعذر قراءة أمر الصيانة قبل الحذف: ${error.message}` };
    orderRow = data as RepairOrderRow | null;
  } catch (error: any) {
    return { ...result, error: error?.message || 'تعذر قراءة أمر الصيانة قبل الحذف.' };
  }

  if (!orderRow) {
    return { ...result, error: 'أمر الصيانة غير موجود في قاعدة البيانات.' };
  }

  if (!isDeliveredStatus(orderRow.status) && !isDeliveredStatus(localOrder?.status) && normalize(localOrder?.deliveryStatus).toUpperCase() !== 'DELIVERED') {
    return { ...result, error: 'رفض الحذف: أمر الصيانة ليس في حالة «تم التسليم».' };
  }

  const orderUuid = normalize(orderRow.id);
  const orderNumber = normalize(orderRow.order_number) || requestedId;
  const orderRefs = new Set<string>([requestedId, orderUuid, orderNumber, normalize(localOrder?.id), normalize(localOrder?.orderNumber), normalize(localOrder?.uuid)].filter(Boolean));

  let usages: PartUsageRow[] = [];
  try {
    const { data, error } = await supabase
      .from('repair_part_usages')
      .select('id,repair_order_id,inventory_item_id,quantity,accounting_status')
      .eq('repair_order_id', orderUuid);
    if (error) return { ...result, error: `تعذر قراءة قطع الغيار المرتبطة بالأوردر: ${error.message}` };
    usages = (data || []) as PartUsageRow[];
  } catch (error: any) {
    return { ...result, error: error?.message || 'تعذر قراءة قطع الغيار المرتبطة بالأوردر.' };
  }

  const restoreByProduct = new Map<string, number>();
  for (const usage of usages) {
    const productId = normalize(usage.inventory_item_id);
    const qty = Math.max(0, Number(usage.quantity || 0));
    const accountingStatus = normalize(usage.accounting_status).toUpperCase();
    if (!productId || qty <= 0 || accountingStatus === 'RETURNED' || accountingStatus === 'CANCELLED') continue;
    restoreByProduct.set(productId, (restoreByProduct.get(productId) || 0) + qty);
  }

  const previousProductQuantities = new Map<string, number>();
  if (restoreByProduct.size > 0) {
    const productIds = Array.from(restoreByProduct.keys());
    const { data: products, error } = await supabase
      .from('products')
      .select('id,quantity')
      .in('id', productIds);
    if (error) return { ...result, error: `تعذر قراءة رصيد المخزون قبل الإرجاع: ${error.message}` };

    for (const row of products || []) previousProductQuantities.set(normalize(row.id), Number(row.quantity || 0));
    const missing = productIds.filter(id => !previousProductQuantities.has(id));
    if (missing.length > 0) {
      return { ...result, error: `تعذر إرجاع البضاعة: يوجد ${missing.length} صنف مرتبط بالأوردر غير موجود بالمخزون.` };
    }

    const updatedProductIds: string[] = [];
    try {
      for (const [productId, restoreQty] of restoreByProduct) {
        const previousQty = previousProductQuantities.get(productId) || 0;
        const { error: updateError } = await supabase
          .from('products')
          .update({ quantity: previousQty + restoreQty, updated_at: new Date().toISOString() })
          .eq('id', productId);
        if (updateError) throw updateError;
        updatedProductIds.push(productId);
      }
    } catch (error: any) {
      for (const productId of updatedProductIds) {
        const previousQty = previousProductQuantities.get(productId);
        if (previousQty === undefined) continue;
        await supabase.from('products').update({ quantity: previousQty }).eq('id', productId).catch(() => undefined);
      }
      return { ...result, error: `فشل إرجاع البضاعة للمخزن، وتم إيقاف الحذف: ${error?.message || error}` };
    }
  }

  const rollbackStock = async () => {
    for (const [productId, previousQty] of previousProductQuantities) {
      try {
        await supabase.from('products').update({ quantity: previousQty }).eq('id', productId);
      } catch {}
    }
  };

  try {
    const invoiceIds = new Set<string>();

    const byRepairOrder = await supabase
      .from('invoices')
      .select('id')
      .eq('repair_order_id', orderUuid);
    if (byRepairOrder.error && !isIgnorableSchemaError(byRepairOrder.error)) throw byRepairOrder.error;
    (byRepairOrder.data || []).forEach((row: any) => invoiceIds.add(normalize(row.id)));

    const byNotes = await supabase
      .from('invoices')
      .select('id')
      .ilike('notes', `%${orderNumber}%`);
    if (byNotes.error && !isIgnorableSchemaError(byNotes.error)) throw byNotes.error;
    (byNotes.data || []).forEach((row: any) => invoiceIds.add(normalize(row.id)));

    const validInvoiceIds = Array.from(invoiceIds).filter(Boolean);
    if (validInvoiceIds.length > 0) {
      const itemDelete = await supabase.from('invoice_items').delete().in('invoice_id', validInvoiceIds);
      if (itemDelete.error && !isIgnorableSchemaError(itemDelete.error)) throw itemDelete.error;

      const invoiceDelete = await supabase.from('invoices').delete().in('id', validInvoiceIds);
      if (invoiceDelete.error) throw invoiceDelete.error;
      result.deletedInvoices = validInvoiceIds.length;
    }

    const usageIds = usages.map(u => normalize(u.id)).filter(Boolean);
    const movementRefs = Array.from(new Set([...orderRefs, ...usageIds])).filter(Boolean);
    if (movementRefs.length > 0) {
      const movementDelete = await supabase.from('inventory_movements').delete().in('reference_id', movementRefs);
      if (movementDelete.error && !isIgnorableSchemaError(movementDelete.error)) throw movementDelete.error;
    }
    if (orderNumber) {
      const movementNotesDelete = await supabase.from('inventory_movements').delete().ilike('notes', `%${orderNumber}%`);
      if (movementNotesDelete.error && !isIgnorableSchemaError(movementNotesDelete.error)) throw movementNotesDelete.error;
    }

    const usagesDelete = await supabase.from('repair_part_usages').delete().eq('repair_order_id', orderUuid);
    if (usagesDelete.error) throw usagesDelete.error;
    result.deletedPartUsages = usages.length;

    // Best-effort cleanup for optional accounting/payment tables that may or may not exist in a deployment.
    for (const table of ['repair_payments', 'payments', 'partner_transactions', 'partner_ledger']) {
      await deleteOptionalRows(table, 'repair_order_id', orderUuid);
      await deleteOptionalRows(table, 'order_id', orderUuid);
      await deleteOptionalRows(table, 'order_id', orderNumber);
      await deleteOptionalRows(table, 'reference_id', orderUuid);
      await deleteOptionalRows(table, 'reference_id', orderNumber);
    }

    const orderDelete = await supabase.from('repair_orders').delete().eq('id', orderUuid);
    if (orderDelete.error) throw orderDelete.error;
  } catch (error: any) {
    await rollbackStock();
    return {
      ...result,
      error: `توقف الحذف قبل اكتماله وتمت محاولة إعادة رصيد المخزون كما كان: ${error?.message || error}`,
    };
  }

  cleanupLocalStorage(orderRefs, restoreByProduct);

  result.success = true;
  result.restoredProducts = restoreByProduct.size;
  result.restoredUnits = Array.from(restoreByProduct.values()).reduce((sum, qty) => sum + qty, 0);
  return result;
}
