/**
 * Unified Repair Orders Data Access Layer
 * @license Apache-2.0
 */

import { RepairOrder } from '../../types';
import {
  fetchOrMigrateRepairOrders as fetchOrMigrateRepairOrdersRemote,
  addRepairOrderToSupabase,
  updateRepairOrderInSupabase,
  deleteRepairOrderFromSupabase,
  getLocalRepairOrdersBackup
} from '../supabaseRepairOrders';
import { db } from '../db';
import { IDataProvider } from './types';
import { syncQueue } from '../sync/syncQueue';

const REPAIR_ORDERS_REMOTE_TTL_MS = 60 * 1000;
let repairOrdersFetchInFlight: Promise<any> | null = null;
let repairOrdersLastRemoteFetchAt = 0;

function localRepairOrdersResult(orders: RepairOrder[]) {
  return { success: true, orders };
}

/**
 * Guarded repair-order loader.
 * - Dashboard uses local cache only and never downloads the full repair_orders table.
 * - Other screens dedupe concurrent requests and reuse a recent local snapshot for 60 seconds.
 */
export async function fetchOrMigrateRepairOrders(): Promise<{ success: boolean; orders: RepairOrder[]; error?: string }> {
  const localOrders = getLocalRepairOrdersBackup();
  const dashboardLocalOnly = typeof window !== 'undefined' && Boolean((window as any).__ATARI_DASHBOARD_LOCAL_ONLY__);

  if (dashboardLocalOnly) {
    return localRepairOrdersResult(localOrders);
  }

  const now = Date.now();
  if (localOrders.length > 0 && now - repairOrdersLastRemoteFetchAt < REPAIR_ORDERS_REMOTE_TTL_MS) {
    return localRepairOrdersResult(localOrders);
  }

  if (repairOrdersFetchInFlight) {
    return repairOrdersFetchInFlight;
  }

  repairOrdersFetchInFlight = fetchOrMigrateRepairOrdersRemote()
    .then(result => {
      repairOrdersLastRemoteFetchAt = Date.now();
      return result;
    })
    .finally(() => {
      repairOrdersFetchInFlight = null;
    });

  return repairOrdersFetchInFlight;
}

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
  addRepairOrderToSupabase,
  updateRepairOrderInSupabase,
  deleteRepairOrderFromSupabase,
  getLocalRepairOrdersBackup
};