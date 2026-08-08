import { supabase, isSupabaseConfigured } from './supabaseClient';
import { RepairPartUsage } from '../types';
import { db } from './db';

export async function deleteRepairPartUsageInSupabase(id: string): Promise<{ success: boolean; deleted?: RepairPartUsage; error?: string }> {
  const localUsages = db.getRepairPartUsages();
  const localUsage = localUsages.find(u => u.id === id);

  if (!isSupabaseConfigured) {
    db.saveRepairPartUsages(localUsages.filter(u => u.id !== id));
    return { success: true, deleted: localUsage };
  }

  try {
    const { data: row, error: readError } = await supabase
      .from('repair_part_usages')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (readError || !row) {
      return { success: false, error: readError?.message || 'Repair part usage not found' };
    }

    const deletedSnapshot: RepairPartUsage = {
      id: String(row.id),
      repairOrderId: String(row.repair_order_id || ''),
      inventoryItemId: String(row.inventory_item_id || ''),
      partName: String(row.part_name_snapshot || ''),
      sku: String(row.sku || ''),
      quantity: Number(row.quantity || 0),
      unitCost: Number(row.cost_price_snapshot || 0),
      totalCost: Number(row.quantity || 0) * Number(row.cost_price_snapshot || 0),
      sellingPrice: Number(row.selling_price_snapshot || 0),
      sellingTotal: Number(row.quantity || 0) * Number(row.selling_price_snapshot || 0),
      ownershipType: (row.ownership_type || row.stock_ownership_snapshot || 'CUSTOMER_SHARED') as any,
      responsiblePartnerId: String(row.responsible_partner_id || 'SHOP'),
      accountingStatus: 'CONSUMED' as any,
      createdAt: row.created_at || new Date().toISOString(),
      employeeName: row.employee_name,
      warehouse: row.warehouse,
      notes: row.notes
    };

    const { error: deleteError } = await supabase
      .from('repair_part_usages')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.warn('⚠️ Failed deleting repair_part_usage from Supabase:', deleteError.message);
      return { success: false, error: deleteError.message };
    }

    db.saveRepairPartUsages(localUsages.filter(u => u.id !== id));
    return { success: true, deleted: deletedSnapshot };
  } catch (err: any) {
    console.warn('⚠️ Exception deleting repair_part_usage from Supabase:', err?.message || err);
    return { success: false, error: err?.message || String(err) };
  }
}

export async function restoreRepairPartUsageInSupabase(usage: RepairPartUsage): Promise<boolean> {
  const localUsages = db.getRepairPartUsages();

  if (!isSupabaseConfigured) {
    if (!localUsages.some(u => u.id === usage.id)) {
      db.saveRepairPartUsages([...localUsages, usage]);
    }
    return true;
  }

  try {
    const row = {
      id: usage.id,
      repair_order_id: usage.repairOrderId,
      inventory_item_id: usage.inventoryItemId,
      part_name_snapshot: usage.partName,
      quantity: Math.max(1, Number(usage.quantity || 1)),
      cost_price_snapshot: Number(usage.unitCost || 0),
      selling_price_snapshot: Number(usage.sellingPrice || 0),
      created_at: usage.createdAt || new Date().toISOString()
    };

    const { error } = await supabase.from('repair_part_usages').insert([row]);
    if (error) {
      console.error('❌ Failed restoring deleted repair_part_usage:', error.message);
      return false;
    }

    if (!localUsages.some(u => u.id === usage.id)) {
      db.saveRepairPartUsages([...localUsages, usage]);
    }
    return true;
  } catch (err: any) {
    console.error('❌ Exception restoring deleted repair_part_usage:', err?.message || err);
    return false;
  }
}
