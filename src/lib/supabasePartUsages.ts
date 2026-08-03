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

    const localById = new Map(localUsages.map(u => [u.id, u]));
    const mergedMap = new Map<string, RepairPartUsage>();
    remoteUsages.forEach(remote => {
      const local = localById.get(remote.id);
      const localTerminal = local?.accountingStatus === 'RETURNED' || local?.accountingStatus === 'REVERSED';
      mergedMap.set(remote.id, {
        ...remote,
        sku: remote.sku || local?.sku || '',
        notes: remote.notes || local?.notes,
        accountingStatus: localTerminal ? local.accountingStatus : remote.accountingStatus
      });
    });
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

function isMissingColumnError(error: any): boolean {
  return error?.code === 'PGRST204' || /column .*schema cache|could not find .* column/i.test(String(error?.message || ''));
}

async function resolveRemoteUsageId(id: string, usage?: RepairPartUsage): Promise<string | null> {
  if (isUuid(id)) return id;
  if (!usage) return null;

  let orderUuid = isUuid(usage.repairOrderId) ? usage.repairOrderId : null;
  if (!orderUuid && usage.repairOrderId) {
    const { data: order } = await supabase
      .from('repair_orders')
      .select('id')
      .eq('order_number', usage.repairOrderId)
      .limit(1)
      .maybeSingle();
    if (order?.id && isUuid(String(order.id))) orderUuid = String(order.id);
  }
  if (!orderUuid) return null;

  let productUuid = isUuid(usage.inventoryItemId) ? usage.inventoryItemId : null;
  if (!productUuid && usage.sku) {
    const { data: product } = await supabase
      .from('products')
      .select('id')
      .eq('sku', usage.sku)
      .limit(1)
      .maybeSingle();
    if (product?.id && isUuid(String(product.id))) productUuid = String(product.id);
  }
  if (!productUuid && usage.partName) {
    const { data: product } = await supabase
      .from('products')
      .select('id')
      .eq('name', usage.partName)
      .limit(1)
      .maybeSingle();
    if (product?.id && isUuid(String(product.id))) productUuid = String(product.id);
  }
  if (!productUuid) return null;

  const { data: remoteUsage } = await supabase
    .from('repair_part_usages')
    .select('id')
    .eq('repair_order_id', orderUuid)
    .eq('inventory_item_id', productUuid)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return remoteUsage?.id && isUuid(String(remoteUsage.id)) ? String(remoteUsage.id) : null;
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
    let { data: insertedRow, error } = await supabase
      .from('repair_part_usages')
      .insert([row])
      .select()
      .single();

    // Older production databases only have the original compact table shape.
    // Keep the app operational until the additive schema migration is applied.
    if (error && isMissingColumnError(error)) {
      const legacyRow = {
        repair_order_id: row.repair_order_id,
        inventory_item_id: row.inventory_item_id,
        part_name_snapshot: row.part_name_snapshot,
        quantity: row.quantity,
        cost_price_snapshot: row.cost_price_snapshot,
        selling_price_snapshot: row.selling_price_snapshot,
        stock_ownership_snapshot: row.stock_ownership_snapshot,
        created_at: row.created_at
      };
      const retry = await supabase
        .from('repair_part_usages')
        .insert([legacyRow])
        .select()
        .single();
      insertedRow = retry.data;
      error = retry.error;
    }

    if (error) {
      console.warn("⚠️ Notice inserting repair_part_usages into Supabase:", error.message);
      throw new Error(`تعذر إنشاء سجل قطعة الغيار: ${error.message}`);
    }

    if (!insertedRow?.id) throw new Error('لم تُرجع قاعدة البيانات معرّف سجل قطعة الغيار');

    return db.addRepairPartUsage({
      ...partUsage,
      id: insertedRow?.id ? String(insertedRow.id) : partUsage.id,
      repairOrderId: partUsage.repairOrderId
    } as any);
  } catch (err) {
    console.warn("⚠️ Exception inserting repair_part_usages into Supabase:", err);
    throw err;
  }
}

export async function updateRepairPartUsageInSupabase(
  id: string,
  updates: Partial<RepairPartUsage>,
  usageSnapshot?: RepairPartUsage
): Promise<boolean> {
  if (isSupabaseConfigured) {
    try {
      const remoteUsageId = await resolveRemoteUsageId(id, usageSnapshot);
      if (!remoteUsageId) {
        if (isUuid(id)) {
          console.warn('⚠️ Remote repair_part_usage UUID no longer exists:', id);
          return false;
        }
        // Historical local-only usages predate reliable Supabase persistence.
        // Their stock and movement operations still persist remotely; keep the
        // usage snapshot editable locally instead of making the UI unusable.
        console.warn('⚠️ Updating historical local-only repair usage:', id);
      } else {
        const isTerminal = updates.accountingStatus === 'RETURNED' || updates.accountingStatus === 'REVERSED';
        const legacySafeUpdates: any = {};
        if (updates.quantity !== undefined) legacySafeUpdates.quantity = updates.quantity;
        if (updates.unitCost !== undefined) legacySafeUpdates.cost_price_snapshot = updates.unitCost;
        if (updates.sellingPrice !== undefined) legacySafeUpdates.selling_price_snapshot = updates.sellingPrice;

        // The production table may still use the original schema. A terminal
        // usage is removed after its compensating inventory movement succeeds;
        // partial changes only touch columns present in every schema version.
        const operation = isTerminal
          ? supabase.from('repair_part_usages').delete()
          : supabase.from('repair_part_usages').update(legacySafeUpdates);
        const query = operation.eq('id', remoteUsageId);
        if (!isTerminal && Object.keys(legacySafeUpdates).length === 0) return false;
        const { data, error } = await query.select('id');
        if (error) {
          console.warn("⚠️ Notice updating repair_part_usages in Supabase:", error.message);
          return false;
        }
        if (!data || data.length !== 1) {
          console.warn('⚠️ Repair part usage update affected an unsafe row count:', data?.length || 0);
          return false;
        }
      }
    } catch (err) {
      console.warn("⚠️ Exception updating repair_part_usages in Supabase:", err);
      return false;
    }
  }

  const all = db.getRepairPartUsages();
  const index = all.findIndex(pu => pu.id === id);
  if (index !== -1) {
    all[index] = { ...all[index], ...updates };
    db.saveRepairPartUsages(all);
  }
  return true;
}
