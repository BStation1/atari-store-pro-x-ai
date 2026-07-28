/**
 * Unified Customer Data Access Layer
 * @license Apache-2.0
 */

import { Customer } from '../../types';
import {
  fetchOrMigrateCustomers,
  addCustomerToSupabase,
  updateCustomerInSupabase,
  deleteCustomerFromSupabase,
  getLocalCustomersBackup
} from '../supabaseCustomers';
import { runCustomersAndSuppliersTestSuite } from '../supabaseCustomersSuppliersTest';
import { db } from '../db';
import { IDataProvider } from './types';
import { syncQueue } from '../sync/syncQueue';

export async function getAllCustomers(): Promise<Customer[]> {
  try {
    const res = await fetchOrMigrateCustomers();
    if (res.success && res.customers) {
      return res.customers;
    }
  } catch (err) {
    console.warn('[DataLayer] Failed fetching remote customers, returning local cache:', err);
  }
  return db.getCustomers();
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  const list = await getAllCustomers();
  return list.find(c => c.id === id) || null;
}

export async function createCustomer(data: Partial<Customer>): Promise<Customer> {
  const created = db.addCustomer(data as any);
  if (created && created.id) {
    try {
      syncQueue.enqueue({
        entityType: 'Customer',
        entityId: created.id,
        operation: 'CREATE',
        payload: created,
        origin: 'Reception',
        version: 1,
        idempotencyKey: `Customer:${created.id}:CREATE`
      });
    } catch (err) {
      console.error('[DataLayer] Error enqueueing customer:', err);
    }
  }
  return created;
}

export async function updateCustomer(id: string, data: Partial<Customer>): Promise<Customer> {
  const existing = await getCustomerById(id);
  const updated = { ...(existing || {}), ...data, id } as Customer;
  db.updateCustomer(updated);
  return updated;
}

export async function deleteCustomer(id: string): Promise<boolean> {
  try {
    db.deleteCustomer(id);
    return true;
  } catch (e) {
    console.error('[DataLayer] Delete customer error:', e);
    return false;
  }
}

export const customersDataProvider: IDataProvider<Customer> = {
  get: getCustomerById,
  list: async () => getAllCustomers(),
  insert: createCustomer,
  update: updateCustomer,
  remove: deleteCustomer,
};

export {
  fetchOrMigrateCustomers,
  addCustomerToSupabase,
  updateCustomerInSupabase,
  deleteCustomerFromSupabase,
  getLocalCustomersBackup,
  runCustomersAndSuppliersTestSuite
};
