/**
 * Unified Repair Orders Data Access Layer
 * @license Apache-2.0
 */

import { RepairOrder } from '../../types';
import {
  fetchOrMigrateRepairOrders,
  addRepairOrderToSupabase,
  updateRepairOrderInSupabase,
  deleteRepairOrderFromSupabase,
  getLocalRepairOrdersBackup
} from '../supabaseRepairOrders';
import { db } from '../db';
import { IDataProvider } from './types';
import { syncQueue } from '../sync/syncQueue';

export async function getAllRepairOrders(): Promise<RepairOrder[]> {
  try {
    const res = await fetchOrMigrateRepairOrders();
    if (res.success && res.orders) {
      return res.orders;
    }
  } catch (err) {
    console.warn('[DataLayer] Failed fetching remote repair orders, returning local cache:', err);
  }
  return db.getRepairOrders();
}

export async function getRepairOrderById(id: string): Promise<RepairOrder | null> {
  const list = await getAllRepairOrders();
  return list.find(r => r.id === id) || null;
}

export async function createRepairOrder(data: Partial<RepairOrder>): Promise<RepairOrder> {
  const created = db.addRepairOrder(data as any);
  if (created && created.id) {
    try {
      syncQueue.enqueue({
        entityType: 'RepairOrder',
        entityId: created.id,
        operation: 'CREATE',
        payload: created,
        origin: 'RepairCenter',
        version: 1,
        idempotencyKey: `RepairOrder:${created.id}:CREATE`
      });
    } catch (err) {
      console.error('[DataLayer] Error enqueueing repair order:', err);
    }
  }
  return created;
}

export async function updateRepairOrder(id: string, data: Partial<RepairOrder>): Promise<RepairOrder> {
  const existing = await getRepairOrderById(id);
  const updated = { ...(existing || {}), ...data, id } as RepairOrder;
  db.updateRepairOrder(updated);
  return updated;
}

export async function deleteRepairOrder(id: string): Promise<boolean> {
  try {
    db.deleteRepairOrder(id);
    return true;
  } catch (e) {
    console.error('[DataLayer] Delete repair order error:', e);
    return false;
  }
}

export const repairOrdersDataProvider: IDataProvider<RepairOrder> = {
  get: getRepairOrderById,
  list: async () => getAllRepairOrders(),
  insert: createRepairOrder,
  update: updateRepairOrder,
  remove: deleteRepairOrder,
};

export {
  fetchOrMigrateRepairOrders,
  addRepairOrderToSupabase,
  updateRepairOrderInSupabase,
  deleteRepairOrderFromSupabase,
  getLocalRepairOrdersBackup
};
