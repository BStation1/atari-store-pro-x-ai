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
      partName: String(r.part_name || r.partName || ''),
      sku: String(r.sku || ''),
      quantity: Number(r.quantity || 0),
      unitCost: Number(r.unit_cost ?? r.unitCost ?? 0),
      totalCost: Number(r.total_cost ?? r.totalCost ?? 0),
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

export async function addRepairPartUsageToSupabase(
  partUsage: Omit<RepairPartUsage, "id" | "createdAt"> & { id?: string; createdAt?: string }
): Promise<RepairPartUsage> {
  const created = db.addRepairPartUsage(partUsage);

  if (isSupabaseConfigured) {
    try {
      const row: any = {
        id: created.id,
        repair_order_id: created.repairOrderId || null,
        inventory_item_id: created.inventoryItemId || null,
        part_name: created.partName,
        sku: created.sku || null,
        quantity: created.quantity,
        unit_cost: created.unitCost,
        total_cost: created.totalCost,
        ownership_type: created.ownershipType,
        responsible_partner_id: created.responsiblePartnerId,
        accounting_status: created.accountingStatus,
        created_at: created.createdAt,
        employee_name: created.employeeName || null,
        warehouse: created.warehouse || null,
        notes: created.notes || null
      };

      const { error } = await supabase.from('repair_part_usages').upsert([row]);
      if (error) {
        console.warn("⚠️ Notice upserting repair_part_usages to Supabase:", error.message);
      }
    } catch (err) {
      console.warn("⚠️ Exception upserting repair_part_usages to Supabase:", err);
    }
  }

  return created;
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

      const { error } = await supabase.from('repair_part_usages').update(rowUpdates).eq('id', id);
      if (error) {
        console.warn("⚠️ Notice updating repair_part_usages in Supabase:", error.message);
      }
    } catch (err) {
      console.warn("⚠️ Exception updating repair_part_usages in Supabase:", err);
    }
  }
}
