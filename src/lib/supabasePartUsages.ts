import { supabase, isSupabaseConfigured } from './supabaseClient';
import { RepairPartUsage } from '../types';
import { db } from './db';

export async function fetchOrMigrateRepairPartUsages(): Promise<{
  success: boolean;
  partUsages: RepairPartUsage[];
  error?: string;
}> {
  const localUsages = db.getRepairPartUsages();

  try {
    console.log('FETCH_REPAIR_PART_USAGES_START=' + JSON.stringify({ supabaseConfigured: isSupabaseConfigured }));
    if (!isSupabaseConfigured) {
      return { success: true, partUsages: localUsages };
    }

    const { data, error } = await supabase
      .from('repair_part_usages')
      .select('*')
      .order('created_at', { ascending: false });

    console.log('FETCH_REPAIR_PART_USAGES_RESPONSE=' + JSON.stringify({ dataLength: (data || []).length, error: error?.message ?? null }));
    if (error) {
      console.warn("⚠️ [fetchOrMigrateRepairPartUsages] Supabase fetch notice:", error.message);
      return { success: false, error: error.message, partUsages: localUsages };
    }

    if (!data) {
      return { success: true, partUsages: localUsages };
    }

    const remoteUsages: RepairPartUsage[] = data.map((r: any) => ({
      id: String(r.id),
      repairOrderId: String(r.repair_order_id || r.repairOrderId || ''),
      inventoryItemId: String(r.inventory_item_id || r.inventoryItemId || ''),
      partName: String(r.part_name_snapshot || r.part_name || r.partName || ''),
      sku: String(r.sku || ''),
      quantity: Number(r.quantity || 0),
      unitCost: Number(r.cost_price_snapshot ?? r.unit_cost ?? r.unitCost ?? 0),
      totalCost: Number(r.total_cost ?? r.totalCost ?? 0),
      sellingPrice: Number(r.selling_price_snapshot ?? r.selling_unit_price_snapshot ?? r.sellingPrice ?? 0),
      sellingTotal: Number(r.selling_total ?? r.sellingTotal ?? (Number(r.quantity || 0) * Number(r.selling_price_snapshot ?? r.sellingPrice ?? 0))),
      ownershipType: (r.ownership_type || r.ownershipType || 'CUSTOMER_SHARED') as any,
      responsiblePartnerId: String(r.responsible_partner_id || r.responsiblePartnerId || 'SHOP'),
      accountingStatus: (r.accounting_status || r.accountingStatus || 'CONSUMED') as any,
      createdAt: r.created_at || r.createdAt || new Date().toISOString(),
      employeeName: r.employee_name || r.employeeName,
      warehouse: r.warehouse,
      notes: r.notes
    }));

    const mergedMap = new Map<string, RepairPartUsage>();
    remoteUsages.forEach(u => mergedMap.set(u.id, u));
    localUsages.forEach(u => {
      if (!mergedMap.has(u.id)) {
        mergedMap.set(u.id, u);
      }
    });

    const mergedUsages = Array.from(mergedMap.values()).sort((a, b) => 
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );

    db.saveRepairPartUsages(mergedUsages);
    return { success: true, partUsages: mergedUsages };
  } catch (err: any) {
    console.warn("⚠️ [fetchOrMigrateRepairPartUsages] Exception:", err?.message || err);
    return { success: false, error: err?.message, partUsages: localUsages };
  }
}

export function isUuid(id?: string): boolean {
  if (!id || typeof id !== 'string') return false;
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id);
}

export async function addRepairPartUsageToSupabase(
  partUsage: Omit<RepairPartUsage, "id" | "createdAt"> & { id?: string; createdAt?: string }
): Promise<RepairPartUsage> {
  if (!isSupabaseConfigured) {
    return db.addRepairPartUsage(partUsage);
  }

  // 1. Resolve repair_order_id UUID in Supabase if a custom order number like 'ATR-10001' was passed
  let resolvedOrderUuid = partUsage.repairOrderId;
  if (!isUuid(resolvedOrderUuid)) {
    try {
      const { data: existingOrder } = await supabase
        .from('repair_orders')
        .select('id')
        .or(`order_number.eq.${partUsage.repairOrderId},id.eq.${partUsage.repairOrderId}`)
        .maybeSingle();

      if (existingOrder?.id && isUuid(existingOrder.id)) {
        resolvedOrderUuid = existingOrder.id;
      }
    } catch (err) {
      console.warn("⚠️ Exception resolving repair_order UUID:", err);
    }
  }

  // 2. Resolve inventory_item_id UUID in Supabase if needed
  let resolvedItemUuid = partUsage.inventoryItemId;
  if (resolvedItemUuid && !isUuid(resolvedItemUuid)) {
    try {
      const { data: existingProd } = await supabase
        .from('products')
        .select('id')
        .or(`sku.eq.${partUsage.sku || partUsage.inventoryItemId},name.eq.${partUsage.partName}`)
        .maybeSingle();

      if (existingProd?.id && isUuid(existingProd.id)) {
        resolvedItemUuid = existingProd.id;
      } else {
        resolvedItemUuid = undefined;
      }
    } catch (err) {
      resolvedItemUuid = undefined;
    }
  }

  // Map ownership
  let ownershipEnum: 'AHMED' | 'ABDO' | 'SHARED' = 'SHARED';
  if (partUsage.ownershipType === 'PARTNER_1_PRIVATE' || (partUsage.ownershipType as any) === 'AHMED') {
    ownershipEnum = 'AHMED';
  } else if (partUsage.ownershipType === 'PARTNER_2_PRIVATE' || (partUsage.ownershipType as any) === 'ABDO') {
    ownershipEnum = 'ABDO';
  }

  const row: any = {
    repair_order_id: isUuid(resolvedOrderUuid) ? resolvedOrderUuid : null,
    inventory_item_id: isUuid(resolvedItemUuid) ? resolvedItemUuid : null,
    part_name_snapshot: partUsage.partName,
    part_name: partUsage.partName,
    sku: partUsage.sku || null,
    quantity: Number(partUsage.quantity || 1),
    cost_price_snapshot: Number(partUsage.unitCost || 0),
    unit_cost: Number(partUsage.unitCost || 0),
    selling_price_snapshot: Number(partUsage.sellingPrice || partUsage.unitCost || 0),
    total_cost: Number(partUsage.totalCost || (partUsage.quantity * partUsage.unitCost)),
    selling_total: Number(partUsage.sellingTotal || (partUsage.quantity * (partUsage.sellingPrice || partUsage.unitCost || 0))),
    stock_ownership_snapshot: ownershipEnum,
    ownership_type: partUsage.ownershipType || 'CUSTOMER_SHARED',
    responsible_partner_id: partUsage.responsiblePartnerId || 'SHOP',
    accounting_status: partUsage.accountingStatus || 'CONSUMED',
    created_at: partUsage.createdAt || new Date().toISOString(),
    employee_name: partUsage.employeeName || null,
    warehouse: partUsage.warehouse || null,
    notes: partUsage.notes || null
  };

  if (isUuid(partUsage.id)) {
    row.id = partUsage.id;
  }

  try {
    const { data: insertedRow, error } = await supabase
      .from('repair_part_usages')
      .insert([row])
      .select()
      .single();

    if (error) {
      console.warn("⚠️ Notice inserting repair_part_usages into Supabase:", error.message);
    }

    return db.addRepairPartUsage({
      ...partUsage,
      id: insertedRow?.id ? String(insertedRow.id) : partUsage.id,
      repairOrderId: partUsage.repairOrderId
    } as any);
  } catch (err) {
    console.warn("⚠️ Exception inserting repair_part_usages into Supabase:", err);
    return db.addRepairPartUsage(partUsage);
  }
}

export async function updateRepairPartUsageInSupabase(id: string, updates: Partial<RepairPartUsage>): Promise<void> {
  const all = db.getRepairPartUsages();
  const index = all.findIndex(pu => pu.id === id);
  if (index !== -1) {
    all[index] = { ...all[index], ...updates };
    db.saveRepairPartUsages(all);
  }

  if (isSupabaseConfigured) {
    try {
      const rowUpdates: any = {};
      if (updates.accountingStatus) rowUpdates.accounting_status = updates.accountingStatus;
      if (updates.notes !== undefined) rowUpdates.notes = updates.notes;
      if (updates.quantity !== undefined) rowUpdates.quantity = updates.quantity;
      if (updates.unitCost !== undefined) rowUpdates.unit_cost = updates.unitCost;
      if (updates.totalCost !== undefined) rowUpdates.total_cost = updates.totalCost;
      if (updates.sellingPrice !== undefined) rowUpdates.selling_price_snapshot = updates.sellingPrice;
      if (updates.sellingTotal !== undefined) rowUpdates.selling_total = updates.sellingTotal;

      const { error } = await supabase.from('repair_part_usages').update(rowUpdates).eq('id', id);
      if (error) {
        console.warn("⚠️ Notice updating repair_part_usages in Supabase:", error.message);
      }
    } catch (err) {
      console.warn("⚠️ Exception updating repair_part_usages in Supabase:", err);
    }
  }
}
