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

const normalize = (value: unknown) => String(value ?? '').trim();
const isUuid = (value: string) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);

function isOwnerOrAdmin(): boolean {
  try {
    const user: any = db.getCurrentUser?.();
    const role = normalize(user?.role).toUpperCase();
    const roleId = normalize(user?.roleId).toUpperCase();
    return role === 'OWNER' || role === 'ADMIN' || roleId === 'OWNER' || roleId === 'ADMIN' || user?.permissions?.includes?.('all') || user?.email === 'elbannafc@gmail.com';
  } catch { return false; }
}

function isMissingSchema(error: any): boolean {
  const code = normalize(error?.code).toUpperCase();
  const message = normalize(error?.message).toLowerCase();
  return code === '42P01' || code === '42703' || code === 'PGRST204' || code === 'PGRST205' || message.includes('does not exist') || message.includes('could not find');
}

function getLocalOrderRefs(requestedId: string): Set<string> {
  const refs = new Set<string>([requestedId]);
  try {
    const orders = JSON.parse(localStorage.getItem('atari_repair_orders') || '[]');
    if (!Array.isArray(orders)) return refs;
    const wanted = normalize(requestedId).toLowerCase();
    const order = orders.find((o: any) => [o?.id, o?.orderNumber, o?.uuid].some(v => normalize(v).toLowerCase() === wanted));
    if (order) for (const value of [order.id, order.orderNumber, order.uuid]) { const ref = normalize(value); if (ref) refs.add(ref); }
  } catch {}
  return refs;
}

function cleanupLocal(orderRefs: Set<string>, restored: Map<string, number>) {
  const normalizedRefs = new Set([...orderRefs].map(v => normalize(v).toLowerCase()).filter(Boolean));
  const matches = (v: unknown) => normalizedRefs.has(normalize(v).toLowerCase());
  try {
    const orders = JSON.parse(localStorage.getItem('atari_repair_orders') || '[]');
    if (Array.isArray(orders)) localStorage.setItem('atari_repair_orders', JSON.stringify(orders.filter((o: any) => !matches(o?.id) && !matches(o?.orderNumber) && !matches(o?.uuid))));
  } catch {}
  try {
    const usages = JSON.parse(localStorage.getItem('atari_repair_part_usages') || '[]');
    if (Array.isArray(usages)) localStorage.setItem('atari_repair_part_usages', JSON.stringify(usages.filter((u: any) => !matches(u?.repairOrderId) && !matches(u?.repair_order_id))));
  } catch {}
  try {
    const invoices = JSON.parse(localStorage.getItem('atari_invoices') || '[]');
    if (Array.isArray(invoices)) localStorage.setItem('atari_invoices', JSON.stringify(invoices.filter((inv: any) => !matches(inv?.orderId) && !matches(inv?.repair_order_id))));
  } catch {}
  try {
    const products = getLocalProductsBackup();
    if (products.length && restored.size) {
      const next = products.map(p => { const q = restored.get(normalize(p.id)) || 0; return q > 0 ? { ...p, quantity: Number(p.quantity || 0) + q } : p; });
      setLocalProductsBackup(next, false);
      try { db.saveProducts?.(next); } catch {}
    }
  } catch {}
  for (const key of ['atari_products','atari_inventory_movements','atari_repair_part_usages','atari_invoices','atari_repair_orders']) {
    try { window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key } })); } catch {}
  }
}

async function optionalDelete(table: string, column: string, value: string) {
  if (!value) return;
  try { const { error } = await supabase.from(table).delete().eq(column, value); if (error && !isMissingSchema(error)) console.warn(`[hardDeleteCompat] ${table}.${column}:`, error.message); } catch {}
}

export async function hardDeleteRepairOrderAnyStatus(orderId: string): Promise<HardDeleteRepairOrderResult> {
  const result: HardDeleteRepairOrderResult = { success: false, restoredUnits: 0, restoredProducts: 0, deletedInvoices: 0, deletedPartUsages: 0 };
  if (!isOwnerOrAdmin()) return { ...result, error: 'غير مصرح: الحذف النهائي متاح للمالك أو مدير النظام فقط.' };
  const requestedId = normalize(orderId);
  if (!requestedId) return { ...result, error: 'رقم أمر الصيانة غير صالح.' };
  const localRefs = getLocalOrderRefs(requestedId);

  if (!isSupabaseConfigured) { cleanupLocal(localRefs, new Map()); return { ...result, success: true }; }

  const filters = [`order_number.eq.${requestedId}`];
  if (isUuid(requestedId)) filters.push(`id.eq.${requestedId}`);
  const orderRes = await supabase.from('repair_orders').select('id,order_number,status').or(filters.join(',')).maybeSingle();
  if (orderRes.error) return { ...result, error: `تعذر قراءة أمر الصيانة قبل الحذف: ${orderRes.error.message}` };

  // Supabase is authoritative. If an order exists only in this browser's localStorage,
  // it is a stale/ghost order. Remove local references only; NEVER restore stock or touch accounting.
  if (!orderRes.data) {
    console.warn('[hardDeleteCompat] Ghost repair order found locally; cleaning browser-only copy:', requestedId);
    cleanupLocal(localRefs, new Map());
    return { ...result, success: true };
  }

  const orderUuid = normalize(orderRes.data.id);
  const orderNumber = normalize((orderRes.data as any).order_number) || requestedId;
  const refs = new Set<string>([...localRefs, requestedId, orderUuid, orderNumber].filter(Boolean));

  const usageRes = await supabase.from('repair_part_usages').select('*').eq('repair_order_id', orderUuid);
  if (usageRes.error && !isMissingSchema(usageRes.error)) return { ...result, error: `تعذر قراءة قطع الغيار المرتبطة بالأوردر: ${usageRes.error.message}` };
  const usages: any[] = Array.isArray(usageRes.data) ? usageRes.data : [];

  const restore = new Map<string, number>();
  for (const usage of usages) {
    const productId = normalize(usage.inventory_item_id ?? usage.inventoryItemId ?? usage.product_id ?? usage.productId);
    const qty = Math.max(0, Number(usage.quantity || 0));
    const status = normalize(usage.accounting_status ?? usage.accountingStatus).toUpperCase();
    if (!productId || qty <= 0 || status === 'RETURNED' || status === 'CANCELLED' || status === 'REVERSED') continue;
    restore.set(productId, (restore.get(productId) || 0) + qty);
  }

  const previous = new Map<string, number>();
  if (restore.size) {
    const ids = [...restore.keys()];
    const productsRes = await supabase.from('products').select('id,quantity').in('id', ids);
    if (productsRes.error) return { ...result, error: `تعذر قراءة رصيد المخزون قبل الإرجاع: ${productsRes.error.message}` };
    for (const p of productsRes.data || []) previous.set(normalize(p.id), Number(p.quantity || 0));
    for (const id of ids) if (!previous.has(id)) return { ...result, error: `تعذر إرجاع البضاعة: الصنف ${id} غير موجود بالمخزون.` };
    try {
      for (const [id, qty] of restore) { const res = await supabase.from('products').update({ quantity: (previous.get(id) || 0) + qty, updated_at: new Date().toISOString() }).eq('id', id); if (res.error) throw res.error; }
    } catch (e: any) {
      for (const [id, qty] of previous) { try { await supabase.from('products').update({ quantity: qty }).eq('id', id); } catch {} }
      return { ...result, error: `فشل إرجاع البضاعة للمخزن، وتم إيقاف الحذف: ${e?.message || e}` };
    }
  }

  const rollbackStock = async () => { for (const [id, qty] of previous) { try { await supabase.from('products').update({ quantity: qty }).eq('id', id); } catch {} } };

  try {
    const invoiceIds = new Set<string>();
    const invByOrder = await supabase.from('invoices').select('id').eq('repair_order_id', orderUuid);
    if (!invByOrder.error) (invByOrder.data || []).forEach((r: any) => invoiceIds.add(normalize(r.id))); else if (!isMissingSchema(invByOrder.error)) throw invByOrder.error;
    const invByNotes = await supabase.from('invoices').select('id').ilike('notes', `%${orderNumber}%`);
    if (!invByNotes.error) (invByNotes.data || []).forEach((r: any) => invoiceIds.add(normalize(r.id))); else if (!isMissingSchema(invByNotes.error)) throw invByNotes.error;

    const validInvoiceIds = [...invoiceIds].filter(Boolean);
    if (validInvoiceIds.length) {
      const itemsDel = await supabase.from('invoice_items').delete().in('invoice_id', validInvoiceIds); if (itemsDel.error && !isMissingSchema(itemsDel.error)) throw itemsDel.error;
      const invDel = await supabase.from('invoices').delete().in('id', validInvoiceIds); if (invDel.error) throw invDel.error;
      result.deletedInvoices = validInvoiceIds.length;
    }

    const usageIds = usages.map(u => normalize(u.id)).filter(Boolean);
    const movementRefs = [...new Set([...refs, ...usageIds])].filter(Boolean);
    if (movementRefs.length) { const movDel = await supabase.from('inventory_movements').delete().in('reference_id', movementRefs); if (movDel.error && !isMissingSchema(movDel.error)) throw movDel.error; }
    if (orderNumber) { const movNotes = await supabase.from('inventory_movements').delete().ilike('notes', `%${orderNumber}%`); if (movNotes.error && !isMissingSchema(movNotes.error)) throw movNotes.error; }

    if (usages.length) { const usageDel = await supabase.from('repair_part_usages').delete().eq('repair_order_id', orderUuid); if (usageDel.error) throw usageDel.error; result.deletedPartUsages = usages.length; }

    for (const table of ['partner_transactions','partner_ledger','partner_settlements','payments']) {
      await optionalDelete(table, 'repair_order_id', orderUuid);
      await optionalDelete(table, 'order_id', orderUuid);
      if (orderNumber !== orderUuid) await optionalDelete(table, 'order_id', orderNumber);
    }

    const orderDel = await supabase.from('repair_orders').delete().eq('id', orderUuid);
    if (orderDel.error) throw orderDel.error;

    result.success = true;
    result.restoredUnits = [...restore.values()].reduce((s, q) => s + q, 0);
    result.restoredProducts = restore.size;
    cleanupLocal(refs, restore);
    return result;
  } catch (e: any) {
    await rollbackStock();
    return { ...result, error: `تعذر إكمال الحذف النهائي: ${e?.message || e}` };
  }
}
