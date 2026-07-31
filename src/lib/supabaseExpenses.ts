import { supabase, isSupabaseConfigured } from './supabaseClient';
import { Expense } from '../types';
import { db } from './db';

export async function fetchOrMigrateExpenses(): Promise<{
  success: boolean;
  expenses: Expense[];
  error?: string;
}> {
  const localExpenses = db.getExpenses();

  try {
    if (!isSupabaseConfigured) {
      return { success: true, expenses: localExpenses };
    }

    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      console.warn("⚠️ [fetchOrMigrateExpenses] Supabase fetch notice:", error.message);
      return { success: false, error: error.message, expenses: localExpenses };
    }

    if (!data) {
      return { success: true, expenses: localExpenses };
    }

    const remoteExpenses: Expense[] = data.map((r: any) => ({
      id: String(r.id),
      category: String(r.category || 'عام'),
      description: String(r.description || r.title || ''),
      amount: Number(r.amount || 0),
      date: r.date || r.created_at || new Date().toISOString(),
      createdBy: r.created_by || r.createdBy || 'system',
      expenseOwner: r.expense_owner || r.expenseOwner,
      isCancelled: Boolean(r.is_cancelled || r.isCancelled),
      cancelledAt: r.cancelled_at || r.cancelledAt,
      cancelledByUserId: r.cancelled_by_user_id || r.cancelledByUserId,
      cancelledByUserName: r.cancelled_by_user_name || r.cancelledByUserName,
      cancelReason: r.cancel_reason || r.cancelled_reason
    }));

    const mergedMap = new Map<string, Expense>();
    remoteExpenses.forEach(e => mergedMap.set(e.id, e));
    localExpenses.forEach(e => {
      if (!mergedMap.has(e.id)) {
        mergedMap.set(e.id, e);
      }
    });

    const mergedExpenses = Array.from(mergedMap.values()).sort((a, b) =>
      new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
    );

    db.saveExpenses(mergedExpenses);
    return { success: true, expenses: mergedExpenses };
  } catch (err: any) {
    console.warn("⚠️ [fetchOrMigrateExpenses] Exception:", err?.message || err);
    return { success: false, error: err?.message, expenses: localExpenses };
  }
}

export async function addExpenseToSupabase(expense: Omit<Expense, "id" | "date"> & { id?: string; date?: string }): Promise<Expense> {
  const created = db.addExpense(expense as any);

  if (isSupabaseConfigured) {
    try {
      const row: any = {
        id: created.id,
        category: created.category,
        description: created.description,
        amount: created.amount,
        date: created.date,
        created_by: created.createdBy || 'system',
        expense_owner: created.expenseOwner || null,
        is_cancelled: created.isCancelled || false
      };

      const { error } = await supabase.from('expenses').upsert([row]);
      if (error) {
        console.warn("⚠️ Notice upserting expense to Supabase:", error.message);
      }
    } catch (err) {
      console.warn("⚠️ Exception upserting expense to Supabase:", err);
    }
  }

  return created;
}

export function getLocalExpensesBackup(): Expense[] {
  return db.getExpenses();
}

export function saveLocalExpensesBackup(data: Expense[]): void {
  db.saveExpenses(data);
}

