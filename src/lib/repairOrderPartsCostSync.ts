import { supabase, isSupabaseConfigured } from './supabaseClient';
import { RepairOrder, RepairPartUsage } from '../types';

function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function isUuid(value?: string | null): boolean {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value));
}

function getOrderIdentifiers(order?: RepairOrder, repairOrderUuid?: string | null): Set<string> {
  const ids = new Set<string>();
  const add = (v: unknown) => {
    if (typeof v === 'string' && v.trim()) ids.add(v.trim());
  };

  add(repairOrderUuid);
  add(order?.id);
  add((order as any)?.uuid);
  add((order as any)?.databaseId);
  add((order as any)?.order_number);
  add((order as any)?.orderNumber);

  return ids;
}

function getUsageOrderId(usage: RepairPartUsage): string | undefined {
  return String(
    (usage as any).repairOrderId ||
    (usage as any).repair_order_id ||
    (usage as any).orderId ||
    (usage as any).order_id ||
    ''
  ) || undefined;
}

function isReturnedOrRemoved(usage: RepairPartUsage): boolean {
  const status = String(
    (usage as any).accountingStatus ||
    (usage as any).accounting_status ||
    (usage as any).status ||
    ''
  ).toUpperCase();

  return status.includes('RETURNED') || status.includes('REVERSED') || status.includes('REMOVED') || status.includes('CANCELLED');
}

export function getRepairUsageUnitCost(usage: RepairPartUsage): number {
  return toNumber(
    (usage as any).unitCost ??
    (usage as any).unit_cost ??
    (usage as any).costPriceSnapshot ??
    (usage as any).cost_price_snapshot ??
    (usage as any).costPrice ??
    (usage as any).cost_price ??
    0
  );
}

export function calculateActiveRepairPartsCostTotal(
  usages: RepairPartUsage[],
  order?: RepairOrder,
  repairOrderUuid?: string | null
): number {
  const ids = getOrderIdentifiers(order, repairOrderUuid);

  return usages.reduce((sum, usage) => {
    if (!usage || isReturnedOrRemoved(usage)) return sum;

    const usageOrderId = getUsageOrderId(usage);
    if (ids.size > 0 && usageOrderId && !ids.has(usageOrderId)) return sum;

    const qty = Math.max(0, toNumber((usage as any).quantity ?? (usage as any).qty ?? 0));
    const unitCost = getRepairUsageUnitCost(usage);
    return sum + qty * unitCost;
  }, 0);
}

export async function syncRepairOrderPartsCostTotal(options: {
  repairOrderUuid?: string | null;
  orderNumber?: string | null;
  partsCostTotal: number;
}): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { success: true };

  const partsCostTotal = toNumber(options.partsCostTotal);
  const updates = {
    parts_cost_total: partsCostTotal,
    updated_at: new Date().toISOString()
  };

  try {
    let query = supabase.from('repair_orders').update(updates).select('id, order_number, parts_cost_total');

    if (isUuid(options.repairOrderUuid || undefined)) {
      query = query.eq('id', options.repairOrderUuid as string);
    } else if (options.orderNumber) {
      query = query.eq('order_number', options.orderNumber);
    } else {
      return { success: false, error: 'Missing repair order identifier for parts_cost_total sync' };
    }

    const { data, error } = await query.maybeSingle();
    if (error) return { success: false, error: error.message };
    if (!data) return { success: false, error: 'No repair_orders row matched parts_cost_total sync target' };

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}
