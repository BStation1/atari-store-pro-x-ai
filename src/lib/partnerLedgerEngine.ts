import { supabase } from './supabaseClient';
import {
  InvoiceAccountingResult,
  WorkType,
  roundMoney
} from './accountingEngine';

export type AccountOwner = 'AHMED' | 'ABDO' | 'REPLACEMENT_FUND';
export type PartnerTransactionType =
  | 'PROFIT_SHARE'
  | 'COGS_RECOVERY'
  | 'SETTLEMENT_OBLIGATION'
  | 'REPLACEMENT_FUND_ALLOCATION'
  | 'REVERSAL'
  | 'MANUAL_ADJUSTMENT';

export interface PartnerLedgerEntry {
  id?: string;
  accountOwner: AccountOwner;
  transactionType: PartnerTransactionType;
  amount: number;
  signedAmount: number;
  invoiceId: string;
  invoiceNumber: string;
  accountingLedgerId?: string;
  workType: WorkType;
  referenceType?: string;
  referenceId?: string;
  description: string;
  createdByUserId?: string;
  createdAt?: string;
  reversedAt?: string;
  reversedBy?: string;
  reversalOfId?: string;
  sourceKey?: string;
  metadata?: Record<string, any>;
}

export interface PartnerAccountBalances {
  ahmedProfitShare: number;
  ahmedCogsRecovery: number;
  ahmedTotalEntitlements: number;
  abdouProfitShare: number;
  abdouSettlementObligation: number;
  abdouNetBalance: number;
  replacementFundBalance: number;
}

export interface LedgerFilterOptions {
  startDate?: string;
  endDate?: string;
  workType?: WorkType | string;
  invoiceNumber?: string;
  transactionType?: PartnerTransactionType | string;
  accountOwner?: AccountOwner | string;
}

/**
 * Pure Function: Generates exact partner ledger entries from Phase 6.1 Accounting Result
 */
export function generatePartnerLedgerEntries(
  accounting: InvoiceAccountingResult,
  createdByUserId?: string,
  timestampSuffix?: string
): PartnerLedgerEntry[] {
  if (accounting.isCancelled) {
    return [];
  }

  const entries: PartnerLedgerEntry[] = [];
  const suffix = timestampSuffix || new Date().getTime().toString();
  const invId = accounting.invoiceId;
  const invNum = accounting.invoiceNumber;
  const workType = accounting.workType;

  if (workType === 'CUSTOMER_WORK') {
    // 1. Ahmed Profit Share (50%)
    if (accounting.ahmedProfitShare !== 0) {
      entries.push({
        accountOwner: 'AHMED',
        transactionType: 'PROFIT_SHARE',
        amount: Math.abs(accounting.ahmedProfitShare),
        signedAmount: accounting.ahmedProfitShare,
        invoiceId: invId,
        invoiceNumber: invNum,
        workType,
        referenceType: 'INVOICE',
        referenceId: invId,
        description: `نصيب أرباح فاتورة العملاء ${invNum}`,
        createdByUserId,
        sourceKey: `${invId}_AHMED_PROFIT_SHARE_${suffix}`
      });
    }

    // 2. Abdo Profit Share (50%)
    if (accounting.abdouProfitShare !== 0) {
      entries.push({
        accountOwner: 'ABDO',
        transactionType: 'PROFIT_SHARE',
        amount: Math.abs(accounting.abdouProfitShare),
        signedAmount: accounting.abdouProfitShare,
        invoiceId: invId,
        invoiceNumber: invNum,
        workType,
        referenceType: 'INVOICE',
        referenceId: invId,
        description: `نصيب أرباح فاتورة العملاء ${invNum}`,
        createdByUserId,
        sourceKey: `${invId}_ABDO_PROFIT_SHARE_${suffix}`
      });
    }

    // 3. Replacement Fund Allocation
    if (accounting.replacementFundAmount !== 0) {
      entries.push({
        accountOwner: 'REPLACEMENT_FUND',
        transactionType: 'REPLACEMENT_FUND_ALLOCATION',
        amount: Math.abs(accounting.replacementFundAmount),
        signedAmount: accounting.replacementFundAmount,
        invoiceId: invId,
        invoiceNumber: invNum,
        workType,
        referenceType: 'INVOICE',
        referenceId: invId,
        description: `مخصص صندوق تعويض بضاعة الفاتورة ${invNum}`,
        createdByUserId,
        sourceKey: `${invId}_REPLACEMENT_FUND_${suffix}`
      });
    }
  } else if (workType === 'AHMED_WORK') {
    // 1. Ahmed COGS Recovery
    if (accounting.ahmedCogsRecovery !== 0) {
      entries.push({
        accountOwner: 'AHMED',
        transactionType: 'COGS_RECOVERY',
        amount: Math.abs(accounting.ahmedCogsRecovery),
        signedAmount: accounting.ahmedCogsRecovery,
        invoiceId: invId,
        invoiceNumber: invNum,
        workType,
        referenceType: 'INVOICE',
        referenceId: invId,
        description: `استرداد تكلفة بضاعة أحمد للفاتورة ${invNum}`,
        createdByUserId,
        sourceKey: `${invId}_AHMED_COGS_RECOVERY_${suffix}`
      });
    }

    // 2. Ahmed Profit Share (100%)
    if (accounting.ahmedProfitShare !== 0) {
      entries.push({
        accountOwner: 'AHMED',
        transactionType: 'PROFIT_SHARE',
        amount: Math.abs(accounting.ahmedProfitShare),
        signedAmount: accounting.ahmedProfitShare,
        invoiceId: invId,
        invoiceNumber: invNum,
        workType,
        referenceType: 'INVOICE',
        referenceId: invId,
        description: `أرباح شغل أحمد البنا للفاتورة ${invNum}`,
        createdByUserId,
        sourceKey: `${invId}_AHMED_PROFIT_SHARE_${suffix}`
      });
    }
    // Note: Abdo gets 0 profit share entry
  } else if (workType === 'ABDO_WORK') {
    // 1. Ahmed Profit Share (25%)
    if (accounting.ahmedProfitShare !== 0) {
      entries.push({
        accountOwner: 'AHMED',
        transactionType: 'PROFIT_SHARE',
        amount: Math.abs(accounting.ahmedProfitShare),
        signedAmount: accounting.ahmedProfitShare,
        invoiceId: invId,
        invoiceNumber: invNum,
        workType,
        referenceType: 'INVOICE',
        referenceId: invId,
        description: `نصيب أحمد من شغل عبده (25%) للفاتورة ${invNum}`,
        createdByUserId,
        sourceKey: `${invId}_AHMED_PROFIT_SHARE_${suffix}`
      });
    }

    // 2. Abdo Profit Share (75%)
    if (accounting.abdouProfitShare !== 0) {
      entries.push({
        accountOwner: 'ABDO',
        transactionType: 'PROFIT_SHARE',
        amount: Math.abs(accounting.abdouProfitShare),
        signedAmount: accounting.abdouProfitShare,
        invoiceId: invId,
        invoiceNumber: invNum,
        workType,
        referenceType: 'INVOICE',
        referenceId: invId,
        description: `نصيب عبده من شغله الخارجي (75%) للفاتورة ${invNum}`,
        createdByUserId,
        sourceKey: `${invId}_ABDO_PROFIT_SHARE_${suffix}`
      });
    }

    // 3. Abdo Settlement Obligation (Negative signed amount = debt/obligation)
    if (accounting.abdouSettlementObligation !== 0) {
      entries.push({
        accountOwner: 'ABDO',
        transactionType: 'SETTLEMENT_OBLIGATION',
        amount: Math.abs(accounting.abdouSettlementObligation),
        signedAmount: -1 * Math.abs(accounting.abdouSettlementObligation),
        invoiceId: invId,
        invoiceNumber: invNum,
        workType,
        referenceType: 'INVOICE',
        referenceId: invId,
        description: `التزام تسوية مستحق على عبده للفاتورة ${invNum}`,
        createdByUserId,
        sourceKey: `${invId}_ABDO_SETTLEMENT_OBLIGATION_${suffix}`
      });
    }
  }

  return entries;
}

/**
 * Pure Function: Calculates partner account balances from a collection of partner ledger entries.
 */
export function calculatePartnerAccountBalances(
  entries: PartnerLedgerEntry[],
  filters?: LedgerFilterOptions
): PartnerAccountBalances {
  let ahmedProfit = 0;
  let ahmedCogsRec = 0;
  let abdouProfit = 0;
  let abdouSettlementObl = 0;
  let replacementFund = 0;

  for (const entry of entries) {
    if (entry.reversedAt) continue; // Skip reversed entries
    if (entry.transactionType === 'REVERSAL') continue; // Skip reversal rows in sum

    if (filters) {
      if (filters.accountOwner && entry.accountOwner !== filters.accountOwner) continue;
      if (filters.workType && entry.workType !== filters.workType) continue;
      if (filters.transactionType && entry.transactionType !== filters.transactionType) continue;
      if (filters.invoiceNumber && !entry.invoiceNumber?.includes(filters.invoiceNumber)) continue;
      if (filters.startDate && entry.createdAt && new Date(entry.createdAt) < new Date(filters.startDate)) continue;
      if (filters.endDate && entry.createdAt && new Date(entry.createdAt) > new Date(filters.endDate)) continue;
    }

    if (entry.accountOwner === 'AHMED') {
      if (entry.transactionType === 'PROFIT_SHARE') {
        ahmedProfit += entry.signedAmount;
      } else if (entry.transactionType === 'COGS_RECOVERY') {
        ahmedCogsRec += entry.signedAmount;
      }
    } else if (entry.accountOwner === 'ABDO') {
      if (entry.transactionType === 'PROFIT_SHARE') {
        abdouProfit += entry.signedAmount;
      } else if (entry.transactionType === 'SETTLEMENT_OBLIGATION') {
        abdouSettlementObl += Math.abs(entry.amount);
      }
    } else if (entry.accountOwner === 'REPLACEMENT_FUND') {
      if (entry.transactionType === 'REPLACEMENT_FUND_ALLOCATION') {
        replacementFund += entry.signedAmount;
      }
    }
  }

  const roundedAhmedProfit = roundMoney(ahmedProfit);
  const roundedAhmedCogsRec = roundMoney(ahmedCogsRec);
  const roundedAbdouProfit = roundMoney(abdouProfit);
  const roundedAbdouObligation = roundMoney(abdouSettlementObl);
  const roundedReplacementFund = roundMoney(replacementFund);

  return {
    ahmedProfitShare: roundedAhmedProfit,
    ahmedCogsRecovery: roundedAhmedCogsRec,
    ahmedTotalEntitlements: roundMoney(roundedAhmedProfit + roundedAhmedCogsRec),
    abdouProfitShare: roundedAbdouProfit,
    abdouSettlementObligation: roundedAbdouObligation,
    abdouNetBalance: roundMoney(roundedAbdouProfit - roundedAbdouObligation),
    replacementFundBalance: roundedReplacementFund
  };
}

/**
 * Posts partner ledger entries to Supabase using RPC or client fallback with idempotency & reversals.
 */
export async function postPartnerLedgerToSupabase(
  invoiceId: string,
  currentUser?: { id?: string; email?: string; role?: string }
): Promise<{ success: boolean; result?: any; entries?: PartnerLedgerEntry[]; error?: string }> {
  try {
    // 1. Try RPC call post_partner_ledger_for_invoice
    const { data: rpcData, error: rpcErr } = await supabase.rpc('post_partner_ledger_for_invoice', {
      p_invoice_id: invoiceId
    });

    if (!rpcErr && rpcData && rpcData.success) {
      // Fetch posted active entries
      const { data: activeRows } = await supabase
        .from('partner_ledger')
        .select('*')
        .eq('invoice_id', invoiceId)
        .is('reversed_at', null)
        .neq('transaction_type', 'REVERSAL');

      const mapped: PartnerLedgerEntry[] = (activeRows || []).map((r: any) => ({
        id: r.id,
        accountOwner: r.account_owner,
        transactionType: r.transaction_type,
        amount: Number(r.amount || 0),
        signedAmount: Number(r.signed_amount || 0),
        invoiceId: r.invoice_id,
        invoiceNumber: r.invoice_number,
        accountingLedgerId: r.accounting_ledger_id,
        workType: r.work_type,
        referenceType: r.reference_type,
        referenceId: r.reference_id,
        description: r.description,
        createdByUserId: r.created_by_user_id,
        createdAt: r.created_at,
        sourceKey: r.source_key
      }));

      return { success: true, result: rpcData, entries: mapped };
    }

    if (rpcErr && rpcErr.message.includes('غير مصرح')) {
      return { success: false, error: rpcErr.message };
    }

    // 2. Client-side Fallback
    // Query invoice_accounting_ledger for invoiceId
    const { data: accRow, error: accErr } = await supabase
      .from('invoice_accounting_ledger')
      .select('*')
      .eq('invoice_id', invoiceId)
      .maybeSingle();

    if (accErr || !accRow) {
      return { success: false, error: accErr?.message || 'لم يتم العثور على القيود المحاسبية للفاتورة' };
    }

    const accountingResult: InvoiceAccountingResult = {
      invoiceId: accRow.invoice_id,
      invoiceNumber: accRow.invoice_number,
      workType: accRow.work_type,
      isCancelled: Boolean(accRow.is_cancelled),
      revenue: Number(accRow.revenue || 0),
      cogs: Number(accRow.cogs || 0),
      grossProfit: Number(accRow.gross_profit || 0),
      ahmedProfitShare: Number(accRow.ahmed_profit_share || 0),
      abdouProfitShare: Number(accRow.abdou_profit_share || 0),
      ahmedCogsRecovery: Number(accRow.ahmed_cogs_recovery || 0),
      abdouSettlementObligation: Number(accRow.abdou_settlement_obligation || 0),
      replacementFundAmount: Number(accRow.replacement_fund_amount || 0),
      ahmedInventoryCogs: Number(accRow.ahmed_inventory_cogs || 0),
      abdouInventoryCogs: Number(accRow.abdou_inventory_cogs || 0),
      sharedInventoryCogs: Number(accRow.shared_inventory_cogs || 0)
    };

    // Find previous active entries to reverse
    const { data: existingActive } = await supabase
      .from('partner_ledger')
      .select('*')
      .eq('invoice_id', invoiceId)
      .is('reversed_at', null)
      .neq('transaction_type', 'REVERSAL');

    const nowIso = new Date().toISOString();
    const timeSuffix = new Date().getTime().toString();

    // Reverse existing
    if (existingActive && existingActive.length > 0) {
      for (const oldRow of existingActive) {
        await supabase
          .from('partner_ledger')
          .update({ reversed_at: nowIso, reversed_by: currentUser?.id || null })
          .eq('id', oldRow.id);

        await supabase.from('partner_ledger').insert({
          account_owner: oldRow.account_owner,
          transaction_type: 'REVERSAL',
          amount: oldRow.amount,
          signed_amount: -1 * Number(oldRow.signed_amount || 0),
          invoice_id: invoiceId,
          invoice_number: accRow.invoice_number,
          accounting_ledger_id: accRow.id,
          work_type: accRow.work_type,
          reference_type: 'INVOICE_REVERSAL',
          reference_id: oldRow.id,
          reversal_of_id: oldRow.id,
          description: `عكس قيد سابق للفاتورة ${accRow.invoice_number}`,
          created_by_user_id: currentUser?.id || null,
          reversed_at: nowIso,
          reversed_by: currentUser?.id || null,
          source_key: `${invoiceId}_REV_${oldRow.id}_${timeSuffix}`
        });
      }
    }

    // Generate new active entries if not cancelled
    const newEntries = generatePartnerLedgerEntries(accountingResult, currentUser?.id, timeSuffix);

    if (newEntries.length > 0) {
      const dbRows = newEntries.map((e) => ({
        account_owner: e.accountOwner,
        transaction_type: e.transactionType,
        amount: e.amount,
        signed_amount: e.signedAmount,
        invoice_id: e.invoiceId,
        invoice_number: e.invoiceNumber,
        accounting_ledger_id: accRow.id,
        work_type: e.workType,
        reference_type: e.referenceType || 'INVOICE',
        reference_id: e.referenceId,
        description: e.description,
        created_by_user_id: currentUser?.id || null,
        source_key: e.sourceKey
      }));

      await supabase.from('partner_ledger').insert(dbRows);
    }

    return { success: true, entries: newEntries };
  } catch (err: any) {
    return { success: false, error: err?.message || 'حدث خطأ أثناء ترحيل دفتر الشركاء' };
  }
}
