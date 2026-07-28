/**
 * Unified Expenses Data Access Layer
 * @license Apache-2.0
 */

import { Expense } from '../../types';
import { db } from '../db';
import { IDataProvider } from './types';
import { syncQueue } from '../sync/syncQueue';

export async function getAllExpenses(): Promise<Expense[]> {
  try {
    return db.getExpenses();
  } catch (err) {
    console.warn('[DataLayer] Failed reading expenses:', err);
    return [];
  }
}

export async function getExpenseById(id: string): Promise<Expense | null> {
  const list = await getAllExpenses();
  return list.find(e => e.id === id) || null;
}

export async function createExpense(data: Partial<Expense>): Promise<Expense> {
  const created = db.addExpense(data as any);
  if (created && created.id) {
    try {
      syncQueue.enqueue({
        entityType: 'Expense',
        entityId: created.id,
        operation: 'CREATE',
        payload: created,
        origin: 'Accounting',
        version: 1,
        idempotencyKey: `Expense:${created.id}:CREATE`
      });
    } catch (err) {
      console.error('[DataLayer] Error enqueueing expense:', err);
    }
  }
  return created;
}

export async function updateExpense(id: string, data: Partial<Expense>): Promise<Expense> {
  const existing = await getExpenseById(id);
  const updated = { ...(existing || {}), ...data, id } as Expense;
  const list = db.getExpenses();
  const index = list.findIndex(e => e.id === id);
  if (index !== -1) {
    list[index] = updated;
    db.saveExpenses(list);
  }
  return updated;
}

export async function deleteExpense(id: string): Promise<boolean> {
  try {
    const list = db.getExpenses().filter(e => e.id !== id);
    db.saveExpenses(list);
    return true;
  } catch (e) {
    console.error('[DataLayer] Delete expense error:', e);
    return false;
  }
}

export const expensesDataProvider: IDataProvider<Expense> = {
  get: getExpenseById,
  list: async () => getAllExpenses(),
  insert: createExpense,
  update: updateExpense,
  remove: deleteExpense,
};
