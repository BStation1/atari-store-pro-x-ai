import { supabase, isSupabaseConfigured } from './supabaseClient';
import { PartnerTransaction, PartnerLedgerEntry, PartnerSettlement } from '../types';
import { db } from './db';

export async function fetchOrMigratePartnerTransactions(): Promise<{
  success: boolean;
  transactions: PartnerTransaction[];
  error?: string;
}> {
  const localTxs = db.getPartnerTransactions();

  try {
    if (!isSupabaseConfigured) {
      return { success: true, transactions: localTxs };
    }

    const { data, error } = await supabase
      .from('partner_transactions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn("⚠️ [fetchOrMigratePartnerTransactions] Supabase fetch notice:", error.message);
      return { success: false, error: error.message, transactions: localTxs };
    }

    if (!data) {
      return { success: true, transactions: localTxs };
    }

    const remoteTxs: PartnerTransaction[] = data.map((r: any) => ({
      id: String(r.id),
      partnerId: String(r.partner_id || r.partnerId || ''),
      type: r.type,
      amount: Number(r.amount || 0),
      date: r.date || r.created_at || new Date().toISOString(),
      createdAt: r.created_at || r.createdAt || new Date().toISOString(),
      status: r.status || 'APPROVED',
      reason: r.reason || '',
      notes: r.notes || '',
      createdBy: r.created_by || r.createdBy || 'system',
      approvedBy: r.approved_by || r.approvedBy || 'system',
      approvalDate: r.approval_date || r.approvalDate
    }));

    const mergedMap = new Map<string, PartnerTransaction>();
    remoteTxs.forEach(t => mergedMap.set(t.id, t));
    localTxs.forEach(t => {
      if (!mergedMap.has(t.id)) {
        mergedMap.set(t.id, t);
      }
    });

    const mergedTxs = Array.from(mergedMap.values()).sort((a, b) =>
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );

    db.savePartnerTransactions(mergedTxs);
    return { success: true, transactions: mergedTxs };
  } catch (err: any) {
    console.warn("⚠️ [fetchOrMigratePartnerTransactions] Exception:", err?.message || err);
    return { success: false, error: err?.message, transactions: localTxs };
  }
}

export async function fetchOrMigratePartnerLedger(): Promise<{
  success: boolean;
  ledger: PartnerLedgerEntry[];
  error?: string;
}> {
  const localLedger = db.getPartnerLedger();

  try {
    if (!isSupabaseConfigured) {
      return { success: true, ledger: localLedger };
    }

    const { data, error } = await supabase
      .from('partner_ledger')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn("⚠️ [fetchOrMigratePartnerLedger] Supabase fetch notice:", error.message);
      return { success: false, error: error.message, ledger: localLedger };
    }

    if (!data) {
      return { success: true, ledger: localLedger };
    }

    const remoteLedger: PartnerLedgerEntry[] = data.map((r: any) => ({
      id: String(r.id),
      partnerId: String(r.partner_id || r.partnerId || ''),
      transactionDate: r.transaction_date || r.transactionDate || r.created_at || new Date().toISOString(),
      transactionType: r.transaction_type || r.transactionType || r.entry_type || 'SYSTEM',
      sourceType: r.source_type || r.sourceType || r.reference_type || 'MANUAL',
      sourceId: String(r.source_id || r.sourceId || r.reference_id || ''),
      repairOrderId: r.repair_order_id || r.repairOrderId,
      settlementId: r.settlement_id || r.settlementId,
      debit: Number(r.debit || 0),
      credit: Number(r.credit || 0),
      amount: Number(r.amount || 0),
      balanceAfter: Number(r.balance_after || r.balanceAfter || 0),
      currency: r.currency || 'EGP',
      descriptionArabic: r.description_arabic || r.descriptionArabic || r.notes || '',
      descriptionEnglish: r.description_english || r.descriptionEnglish,
      notes: r.notes || '',
      createdByUserId: r.created_by_user_id || r.createdByUserId || 'system',
      createdAt: r.created_at || r.createdAt || new Date().toISOString(),
      updatedAt: r.updated_at || r.updatedAt || new Date().toISOString()
    }));

    const mergedMap = new Map<string, PartnerLedgerEntry>();
    remoteLedger.forEach(l => mergedMap.set(l.id, l));
    localLedger.forEach(l => {
      if (!mergedMap.has(l.id)) {
        mergedMap.set(l.id, l);
      }
    });

    const mergedLedger = Array.from(mergedMap.values()).sort((a, b) =>
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );

    db.savePartnerLedger(mergedLedger);
    return { success: true, ledger: mergedLedger };
  } catch (err: any) {
    console.warn("⚠️ [fetchOrMigratePartnerLedger] Exception:", err?.message || err);
    return { success: false, error: err?.message, ledger: localLedger };
  }
}

export async function fetchOrMigratePartnerSettlements(): Promise<{
  success: boolean;
  settlements: PartnerSettlement[];
  error?: string;
}> {
  const localSettlements = db.getPartnerSettlements();

  try {
    if (!isSupabaseConfigured) {
      return { success: true, settlements: localSettlements };
    }

    const { data, error } = await supabase
      .from('partner_settlements')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn("⚠️ [fetchOrMigratePartnerSettlements] Supabase fetch notice:", error.message);
      return { success: false, error: error.message, settlements: localSettlements };
    }

    if (!data) {
      return { success: true, settlements: localSettlements };
    }

    const remoteSettlements: PartnerSettlement[] = data.map((r: any) => ({
      ...r,
      id: String(r.id),
      settlementNumber: r.settlement_number || r.settlementNumber || `SET-${r.id}`,
      currency: r.currency || 'EGP',
      settlementMonth: r.settlement_month || r.settlementMonth,
      periodStart: r.period_start || r.periodStart,
      periodEnd: r.period_end || r.periodEnd,
      status: r.status,
      closedAt: r.closed_at || r.closedAt,
      closedByUserId: r.closed_by_user_id || r.closedByUserId,
      netShopProfit: Number(r.net_shop_profit || r.netShopProfit || 0),
      totalExpenses: Number(r.total_expenses || r.totalExpenses || 0),
      ahmedFinalShare: Number(r.ahmed_final_share || r.ahmedFinalShare || 0),
      abdoFinalShare: Number(r.abdo_final_share || r.abdoFinalShare || 0),
      createdAt: r.created_at || r.createdAt || new Date().toISOString(),
      updatedAt: r.updated_at || r.updatedAt || new Date().toISOString()
    }));

    const mergedMap = new Map<string, PartnerSettlement>();
    remoteSettlements.forEach(s => mergedMap.set(s.id, s));
    localSettlements.forEach(s => {
      if (!mergedMap.has(s.id)) {
        mergedMap.set(s.id, s);
      }
    });

    const mergedSettlements = Array.from(mergedMap.values()).sort((a, b) =>
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );

    db.savePartnerSettlements(mergedSettlements);
    return { success: true, settlements: mergedSettlements };
  } catch (err: any) {
    console.warn("⚠️ [fetchOrMigratePartnerSettlements] Exception:", err?.message || err);
    return { success: false, error: err?.message, settlements: localSettlements };
  }
}
