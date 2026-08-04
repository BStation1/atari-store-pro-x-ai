import { supabase } from './supabaseClient';
import { PartnerLedgerEntry } from './partnerLedgerEngine';
import { roundMoney } from './accountingEngine';
import {
  Expense,
  MonthlySettlementResult,
  ReplacementFundEntry,
  SettlementAuditRecord,
  UserRole
} from '../types';

/**
 * Pure Engine: Calculates exact Monthly Settlement from partner_ledger entries and expenses.
 * Strictly adheres to requirement: Does NOT recalculate profits from invoices directly.
 */
export function calculateMonthlySettlement(
  month: string, // "YYYY-MM"
  ledgerEntries: PartnerLedgerEntry[],
  expenses: Expense[],
  fundEntries?: ReplacementFundEntry[],
  existingSettlement?: MonthlySettlementResult
): MonthlySettlementResult {
  let ahmedProfitShare = 0;
  let abdouProfitShare = 0;
  let ahmedCogsRecovery = 0;
  let abdouSettlementObligation = 0;
  let replacementFundDeposits = 0;

  // 1. Filter ledger entries for the given month (excluding reversed entries)
  for (const entry of ledgerEntries) {
    if (entry.reversedAt) continue;
    if (entry.transactionType === 'REVERSAL') continue;

    // Derive entry YYYY-MM from createdAt or date
    const entryDate = entry.createdAt ? entry.createdAt.slice(0, 7) : month;
    if (entryDate !== month) continue;

    if (entry.accountOwner === 'AHMED') {
      if (entry.transactionType === 'PROFIT_SHARE') {
        ahmedProfitShare += entry.signedAmount;
      } else if (entry.transactionType === 'COGS_RECOVERY') {
        ahmedCogsRecovery += entry.signedAmount;
      }
    } else if (entry.accountOwner === 'ABDO') {
      if (entry.transactionType === 'PROFIT_SHARE') {
        abdouProfitShare += entry.signedAmount;
      } else if (entry.transactionType === 'SETTLEMENT_OBLIGATION') {
        abdouSettlementObligation += Math.abs(entry.amount);
      }
    } else if (entry.accountOwner === 'REPLACEMENT_FUND') {
      if (entry.transactionType === 'REPLACEMENT_FUND_ALLOCATION') {
        replacementFundDeposits += entry.signedAmount;
      }
    }
  }

  // 2. Filter expenses for the given month (excluding cancelled)
  let sharedExpenses = 0;
  let ahmedExpenses = 0;
  let abdouExpenses = 0;

  for (const exp of expenses) {
    if (exp.isCancelled) continue;
    const expMonth = exp.date ? exp.date.slice(0, 7) : month;
    if (expMonth !== month) continue;

    const amt = Number(exp.amount || 0);
    const owner = exp.expenseOwner || 'SHARED';

    if (owner === 'AHMED') {
      ahmedExpenses += amt;
    } else if (owner === 'ABDO') {
      abdouExpenses += amt;
    } else {
      sharedExpenses += amt;
    }
  }

  // Rounding monetary figures
  ahmedProfitShare = roundMoney(ahmedProfitShare);
  abdouProfitShare = roundMoney(abdouProfitShare);
  ahmedCogsRecovery = roundMoney(ahmedCogsRecovery);
  abdouSettlementObligation = roundMoney(abdouSettlementObligation);
  replacementFundDeposits = roundMoney(replacementFundDeposits);

  sharedExpenses = roundMoney(sharedExpenses);
  ahmedExpenses = roundMoney(ahmedExpenses);
  abdouExpenses = roundMoney(abdouExpenses);
  const totalExpenses = roundMoney(sharedExpenses + ahmedExpenses + abdouExpenses);

  // Net Payouts calculation
  // AHMED: Profit + COGS Recovery - Ahmed Personal Expenses - 50% Shared Expenses
  const ahmedNetPayout = roundMoney(
    ahmedProfitShare + ahmedCogsRecovery - ahmedExpenses - sharedExpenses / 2
  );

  // ABDO: Profit - Settlement Obligation - Abdo Personal Expenses - 50% Shared Expenses
  const abdouNetPayout = roundMoney(
    abdouProfitShare - abdouSettlementObligation - abdouExpenses - sharedExpenses / 2
  );

  // 3. Replacement Fund Balance Calculation
  let totalFundBalance = replacementFundDeposits;
  if (fundEntries && fundEntries.length > 0) {
    totalFundBalance = fundEntries.reduce((sum, e) => sum + Number(e.signedAmount || 0), 0);
  }

  return {
    id: existingSettlement?.id,
    settlementMonth: month,
    status: existingSettlement?.status || 'OPEN',
    ahmedProfitShare,
    abdouProfitShare,
    ahmedCogsRecovery,
    abdouSettlementObligation,
    replacementFundDeposits,
    sharedExpenses,
    ahmedExpenses,
    abdouExpenses,
    totalExpenses,
    ahmedNetPayout,
    abdouNetPayout,
    replacementFundBalance: roundMoney(totalFundBalance),
    lockedAt: existingSettlement?.lockedAt,
    lockedByUserId: existingSettlement?.lockedByUserId,
    lockedByUserName: existingSettlement?.lockedByUserName,
    notes: existingSettlement?.notes,
    createdAt: existingSettlement?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * Validates whether a replacement fund withdrawal is permitted under owner security checks.
 */
export function canWithdrawFromReplacementFund(
  currentBalance: number,
  withdrawAmount: number,
  userRole: UserRole
): { allowed: boolean; reason?: string } {
  const projectedBalance = currentBalance - withdrawAmount;
  if (projectedBalance < 0 && userRole !== 'OWNER') {
    return {
      allowed: false,
      reason: 'لا يمكن السحب من صندوق التعويض برصيد سالب إلا بصلاحية المالك (OWNER)'
    };
  }
  return { allowed: true };
}

/**
 * Locks the monthly settlement.
 * Prevents double closing.
 */
export function closeMonthEngine(
  settlement: MonthlySettlementResult,
  currentUser: { id: string; name: string; role: UserRole }
): MonthlySettlementResult {
  if (settlement.status === 'LOCKED') {
    throw new Error(`الشهر (${settlement.settlementMonth}) مغلق بالفعل ولا يمكن إعادة إغلاقه مرة أخرى.`);
  }

  return {
    ...settlement,
    status: 'LOCKED',
    lockedAt: new Date().toISOString(),
    lockedByUserId: currentUser.id,
    lockedByUserName: currentUser.name,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Reopens a locked month.
 * Restricted strictly to OWNER role, requiring an audit reason.
 */
export function reopenMonthEngine(
  settlement: MonthlySettlementResult,
  currentUser: { id: string; name: string; role: UserRole },
  reason: string
): { updatedSettlement: MonthlySettlementResult; auditRecord: SettlementAuditRecord } {
  if (currentUser.role !== 'OWNER') {
    throw new Error('غير مصرح. إعادة فتح الشهر تقتصر حصرياً على المالك (OWNER).');
  }

  if (!reason || !reason.trim()) {
    throw new Error('يرجى تحديد سبب إعادة فتح الشهر للتوثيق في سجل التدقيق.');
  }

  const updatedSettlement: MonthlySettlementResult = {
    ...settlement,
    status: 'OPEN',
    lockedAt: undefined,
    lockedByUserId: undefined,
    lockedByUserName: undefined,
    updatedAt: new Date().toISOString()
  };

  const auditRecord: SettlementAuditRecord = {
    settlementMonth: settlement.settlementMonth,
    action: 'REOPEN_MONTH',
    performedByUserId: currentUser.id,
    performedByUserName: currentUser.name,
    reason: reason.trim(),
    timestamp: new Date().toISOString(),
    details: {
      previousStatus: 'LOCKED',
      previousLockedAt: settlement.lockedAt,
      previousLockedBy: settlement.lockedByUserName
    }
  };

  return { updatedSettlement, auditRecord };
}

/**
 * Saves or updates monthly settlement in Supabase with fallback
 */
export async function saveMonthlySettlementToSupabase(
  settlement: MonthlySettlementResult
): Promise<{ success: boolean; error?: string }> {
  try {
    const dbRow = {
      settlement_month: settlement.settlementMonth,
      gross_revenue: 0, // Computed metadata if needed
      total_expenses: settlement.totalExpenses,
      total_cost_of_goods: 0,
      ahmed_stock_cost: settlement.ahmedCogsRecovery,
      abdo_stock_cost: settlement.abdouSettlementObligation,
      shared_stock_cost: 0,
      ahmed_profit_share: settlement.ahmedProfitShare,
      abdo_profit_share: settlement.abdouProfitShare,
      status: settlement.status,
      settled_at: settlement.status === 'LOCKED' ? settlement.lockedAt || new Date().toISOString() : null,
      created_by_user_id: settlement.lockedByUserId || null,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('partner_settlements')
      .upsert(dbRow, { onConflict: 'settlement_month' });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'تعذر حفظ تسوية الشهر في قاعدة البيانات' };
  }
}

/**
 * Audits month reopening in Supabase
 */
export async function logSettlementAuditToSupabase(
  audit: SettlementAuditRecord
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('settlement_audit_logs').insert({
      settlement_month: audit.settlementMonth,
      action: audit.action,
      performed_by_user_id: audit.performedByUserId,
      performed_by_user_name: audit.performedByUserName,
      reason: audit.reason,
      details: audit.details || {}
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}
