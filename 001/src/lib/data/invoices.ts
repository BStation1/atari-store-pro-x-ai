/**
 * Unified Invoices Data Access Layer
 * @license Apache-2.0
 */

import { Invoice } from '../../types';
import {
  fetchOrMigrateInvoices,
  addInvoiceToSupabase,
  cancelInvoiceInSupabase,
  getLocalInvoicesBackup
} from '../supabaseInvoices';
import { runInvoicesTestSuite } from '../supabaseInvoicesTest';
import { db } from '../db';
import { IDataProvider } from './types';
import { syncQueue } from '../sync/syncQueue';

export async function getAllInvoices(): Promise<Invoice[]> {
  try {
    const res = await fetchOrMigrateInvoices();
    if (res.success && res.invoices) {
      return res.invoices;
    }
  } catch (err) {
    console.warn('[DataLayer] Failed fetching remote invoices, returning local cache:', err);
  }
  return db.getInvoices();
}

export async function getInvoiceById(id: string): Promise<Invoice | null> {
  const list = await getAllInvoices();
  return list.find(i => i.id === id) || null;
}

export async function createInvoice(data: Partial<Invoice>): Promise<Invoice> {
  const created = db.addInvoice(data as any);
  if (created && created.id) {
    try {
      syncQueue.enqueue({
        entityType: 'Invoice',
        entityId: created.id,
        operation: 'CREATE',
        payload: created,
        origin: 'Accounting',
        version: 1,
        idempotencyKey: `Invoice:${created.id}:CREATE`
      });
    } catch (err) {
      console.error('[DataLayer] Error enqueueing invoice:', err);
    }
  }
  return created;
}

export async function updateInvoice(id: string, data: Partial<Invoice>): Promise<Invoice> {
  const existing = await getInvoiceById(id);
  const updated = { ...(existing || {}), ...data, id } as Invoice;
  const list = db.getInvoices();
  const index = list.findIndex(i => i.id === id);
  if (index !== -1) {
    list[index] = updated;
    db.saveInvoices(list);
  }
  return updated;
}

export async function deleteInvoice(id: string): Promise<boolean> {
  try {
    const list = db.getInvoices().filter(i => i.id !== id);
    db.saveInvoices(list);
    return true;
  } catch (e) {
    console.error('[DataLayer] Delete invoice error:', e);
    return false;
  }
}

export const invoicesDataProvider: IDataProvider<Invoice> = {
  get: getInvoiceById,
  list: async () => getAllInvoices(),
  insert: createInvoice,
  update: updateInvoice,
  remove: deleteInvoice,
};

export {
  fetchOrMigrateInvoices,
  addInvoiceToSupabase,
  cancelInvoiceInSupabase,
  getLocalInvoicesBackup,
  runInvoicesTestSuite
};
