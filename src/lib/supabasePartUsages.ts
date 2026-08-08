import { supabase, isSupabaseConfigured } from './supabaseClient';
import { RepairPartUsage } from '../types';
import { db } from './db';
import { isRepairPartMutationPending } from './repairPartOptimisticBridge';

export async function fetchOrMigrateRepairPartUsages(): Promise<{
  success: boolean;
  partUsages: RepairPartUsage[];
  error?: string;
}> {
  const localUsages = db.getRepairPartUsages();

  // While an add/remove transaction is still in flight, the local store contains the
  // intentional optimistic snapshot. Returning it here prevents a fast refetch from
  // replacing the UI with the older Supabase snapshot for a few seconds.
  if (isRepairPartMutationPending()) {
    return { success: true, partUsages: localUsages };
  }

  try {
    if (!isSupabaseConfigured) {
      return { success: true, partUsages: localUsages };
    }

    const { data, error } = await supabase
      .from('repair_part_usages')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn("⚠️ [fetchOrMigrateRepairPartUsages] Supabase fetch notice:", error.message);
      return { success: false, error: error.message, partUsages: localUsages };
    }

    if (!data) {
      return { success: true, partUsages: localUsages };
    }

    const remoteUsages: RepairPartUsage[] = data.map((r: any) => {
      const q = Number(r.quantity || 0);
      const uCost = Number(r.cost_price_snapshot || r.unit_cost || r.unitCost || 0);
      const tCost = Number(r.total_cost || r.totalCost || (q * uCost));
      const sPrice = Number(r.selling_price_snapshot ?? r.selling_unit_price_snapshot ?? r.sellingPrice ?? 0);
      const sTotal = Number(r.selling_total ?? r.sellingTotal ?? (q * sPrice));

      return {
        id: String(r.id),
        repairOrderId: String(r.repair_order_id || r.repairOrderId || ''),
        inventoryItemId: String(r.inventory_item_id || r.inventoryItemId || ''),
        partName: String(r.part_name_snapshot || r.part_name || r.partName || ''),
        sku: String(r.sku || ''),
        quantity: q,
        unitCost: uCost,
        totalCost: tCost,
        sellingPrice: sPrice,
        sellingTotal: sTotal,
        ownershipType: (r.ownership_type || r.ownershipType || 'CUSTOMER_SHARED') as any,
        responsiblePartnerId: String(r.responsible_partner_id || r.responsiblePartnerId || 'SHOP'),
        accountingStatus: (q <= 0 ? 'RETURNED' : (r.accounting_status || r.accountingStatus || 'CONSUMED')) as any,
        createdAt: r.created_at || r.createdAt || new Date().toISOString(),
        employeeName: r.employee_name || r.employeeName,
        warehouse: r.warehouse,
        notes: r.notes
      };
    });

    // When Supabase is configured it is the source of truth. Do not merge local-only
    // usages back into the fetched list: a local-only row can be a usage that was
    // legitimately deleted remotely during a full part return. Re-merging it makes
    // deleted parts reappear and can create duplicate-looking rows in the workshop UI.
    const authoritativeUsages = [...remoteUsages].sort((a, b) =>
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );

    db.saveRepairPartUsages(authoritativeUsages);
    return { success: true, partUsages: authoritativeUsages };
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

  if (!isUuid(resolvedOrderUuid)) {
    throw new Error(`تعذر ربط أمر الصيانة بقاعدة البيانات Supabase (المعرف ${partUsage.repairOrderId} غير موجود/غير صالح)`);
  }

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
      }
    } catch {
      // handled by validation below
    }
  }

  if (!isUuid(resolvedItemUuid)) {
    throw new Error(`تعذر ربط قطعة الغيار بقاعدة البيانات Supabase (المعرف ${partUsage.inventoryItemId} غير موجود/غير صالح)`);
  }

  let ownershipEnum: 'AHMED' | 'ABDO' | 'SHARED' = 'SHARED';
  if (partUsage.ownershipType === 'PARTNER_1_PRIVATE' || (partUsage.ownershipType as any) === 'AHMED') {
    ownershipEnum = 'AHMED';
  } else if (partUsage.ownershipType === 'PARTNER_2_PRIVATE' || (partUsage.ownershipType as any) === 'ABDO') {
    ownershipEnum = 'ABDO';
  }

  const row: any = {
    repair_order_id: resolvedOrderUuid,
    inventory_item_id: resolvedItemUuid,
    part_name_snapshot: partUsage.partName,
    quantity: Number(partUsage.quantity || 1),
    cost_price_snapshot: Number(partUsage.unitCost || 0),
    selling_price_snapshot: Number(partUsage.sellingPrice || partUsage.unitCost || 0),
    stock_ownership_snapshot: ownershipEnum,
    created_at: partUsage.createdAt || new Date().toISOString()
  };

  if (isUuid(partUsage.id)) {
    row.id = partUsage.id;
  }

  const { data: insertedRow, error } = await supabase
    .from('repair_part_usages')
    .insert([row])
    .select()
    .single();

  if (error) {
    console.error("❌ Error inserting repair_part_usages into Supabase:", error.message);
    throw new Error(`فشل حفظ سجل قطعة الغيار في قاعدة البيانات Supabase: ${error.message}`);
  }

  return db.addRepairPartUsage({
    ...partUsage,
    id: insertedRow?.id ? String(insertedRow.id) : partUsage.id,
    repairOrderId: partUsage.repairOrderId
  } as any);
}

async function syncPartsCostTotalForRepairOrder(repairOrderId: string): Promise<boolean> {
  try {
    const { data: usages, error: usagesError } = await supabase
      .from('repair_part_usages')
      .select('quantity,cost_price_snapshot')
      .eq('repair_order_id', repairOrderId);

    if (usagesError) {
      console.warn('⚠️ Failed to read usages while syncing parts_cost_total:', usagesError.message);
      return false;
    }

    const total = (usages || []).reduce((sum: number, row: any) => {
      const qty = Math.max(0, Number(row.quantity || 0));
      const unitCost = Math.max(0, Number(row.cost_price_snapshot || 0));
      return sum + (qty * unitCost);
    }, 0);

    const { error: orderError } = await supabase
      .from('repair_orders')
      .update({ parts_cost_total: total, updated_at: new Date().toISOString() })
      .eq('id', repairOrderId);

    if (orderError) {
      console.warn('⚠️ Failed to sync repair_orders.parts_cost_total:', orderError.message);
      return false;
    }

    return true;
  } catch (err) {
    console.warn('⚠️ Exception syncing repair_orders.parts_cost_total:', err);
    return false;
  }
}

export async function updateRepairPartUsageInSupabase(id: string, updates: Partial<RepairPartUsage>): Promise<boolean> {
  const localUsages = db.getRepairPartUsages();
  const localIndex = localUsages.findIndex(pu => pu.id === id);
  const existingLocal = localIndex !== -1 ? localUsages[localIndex] : undefined;

  if (!isSupabaseConfigured) {
    if (localIndex !== -1) {
      localUsages[localIndex] = { ...localUsages[localIndex], ...updates };
      db.saveRepairPartUsages(localUsages);
    }
    return true;
  }

  try {
    const { data: previousRow, error: previousError } = await supabase
      .from('repair_part_usages')
      .select('id,repair_order_id,quantity,cost_price_snapshot,selling_price_snapshot')
      .eq('id', id)
      .maybeSingle();

    if (previousError || !previousRow) {
      console.warn('⚠️ Could not resolve repair_part_usage before update:', previousError?.message || id);
      return false;
    }

    const isFullReturn = updates.accountingStatus === 'RETURNED' || updates.accountingStatus === 'REVERSED';
    const rowUpdates: any = {};

    if (isFullReturn) {
      rowUpdates.quantity = 0;
    } else if (updates.quantity !== undefined) {
      rowUpdates.quantity = Math.max(0, Number(updates.quantity));
    }

    if (updates.unitCost !== undefined) {
      rowUpdates.cost_price_snapshot = Math.max(0, Number(updates.unitCost));
    }
    if (updates.sellingPrice !== undefined) {
      rowUpdates.selling_price_snapshot = Math.max(0, Number(updates.sellingPrice));
    }

    if (Object.keys(rowUpdates).length === 0) {
      if (localIndex !== -1) {
        localUsages[localIndex] = { ...localUsages[localIndex], ...updates };
        db.saveRepairPartUsages(localUsages);
      }
      return true;
    }

    const { data: updatedRow, error } = await supabase
      .from('repair_part_usages')
      .update(rowUpdates)
      .eq('id', id)
      .select('id,repair_order_id,quantity,cost_price_snapshot,selling_price_snapshot')
      .maybeSingle();

    if (error || !updatedRow) {
      console.warn('⚠️ Failed updating repair_part_usages in Supabase:', error?.message || 'No matching row');
      return false;
    }

    const costSyncOk = await syncPartsCostTotalForRepairOrder(String(updatedRow.repair_order_id));
    if (!costSyncOk) {
      const { error: rollbackError } = await supabase
        .from('repair_part_usages')
        .update({
          quantity: previousRow.quantity,
          cost_price_snapshot: previousRow.cost_price_snapshot,
          selling_price_snapshot: previousRow.selling_price_snapshot
        })
        .eq('id', id);

      if (rollbackError) {
        console.error('❌ Failed to rollback repair_part_usage after parts_cost_total sync failure:', rollbackError.message);
      }
      return false;
    }

    if (localIndex !== -1) {
      localUsages[localIndex] = {
        ...localUsages[localIndex],
        ...updates,
        quantity: Number(updatedRow.quantity ?? localUsages[localIndex].quantity),
        accountingStatus: (Number(updatedRow.quantity || 0) <= 0 ? 'RETURNED' : (updates.accountingStatus || localUsages[localIndex].accountingStatus)) as any
      };
      db.saveRepairPartUsages(localUsages);
    } else if (existingLocal) {
      db.saveRepairPartUsages([...localUsages, { ...existingLocal, ...updates }]);
    }

    return true;
  } catch (err) {
    console.warn('⚠️ Exception updating repair_part_usages in Supabase:', err);
    return false;
  }
}
