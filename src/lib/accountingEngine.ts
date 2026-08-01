import { supabase } from './supabaseClient';

export type WorkType = 'CUSTOMER_WORK' | 'AHMED_WORK' | 'ABDO_WORK';
export type StockOwnership = 'AHMED' | 'ABDO' | 'SHARED';

export interface AccountingItemInput {
  productId?: string;
  quantity: number;
  unitPriceSnapshot: number;
  unitCostSnapshot: number;
  stockOwnershipSnapshot?: StockOwnership | string;
}

export interface InvoiceAccountingInput {
  invoiceId: string;
  invoiceNumber?: string;
  workType?: WorkType | string;
  discountAmount?: number;
  isCancelled?: boolean;
  items: AccountingItemInput[];
}

export interface InvoiceAccountingResult {
  invoiceId: string;
  invoiceNumber: string;
  workType: WorkType;
  isCancelled: boolean;
  revenue: number;
  cogs: number;
  grossProfit: number;
  ahmedProfitShare: number;
  abdouProfitShare: number;
  ahmedCogsRecovery: number;
  abdouSettlementObligation: number;
  replacementFundAmount: number;
  ahmedInventoryCogs: number;
  abdouInventoryCogs: number;
  sharedInventoryCogs: number;
}

export function roundMoney(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

export function normalizeWorkType(raw?: string | null): WorkType {
  if (!raw) return 'CUSTOMER_WORK';
  const str = String(raw).trim().toUpperCase();
  if (str === 'AHMED' || str === 'AHMED_WORK' || str === 'PARTNER_1_PRIVATE') return 'AHMED_WORK';
  if (str === 'ABDO' || str === 'ABDO_WORK' || str === 'PARTNER_2_PRIVATE') return 'ABDO_WORK';
  return 'CUSTOMER_WORK';
}

export function normalizeStockOwnership(raw?: string | null): StockOwnership {
  if (!raw) return 'SHARED';
  const str = String(raw).trim().toUpperCase();
  if (str === 'AHMED') return 'AHMED';
  if (str === 'ABDO') return 'ABDO';
  return 'SHARED';
}

/**
 * Pure Function: Calculates accounting outcomes for an invoice.
 */
export function calculateInvoiceAccounting(input: InvoiceAccountingInput): InvoiceAccountingResult {
  const invoiceId = input.invoiceId;
  const invoiceNumber = input.invoiceNumber || invoiceId;
  const workType = normalizeWorkType(input.workType);
  const isCancelled = Boolean(input.isCancelled);

  if (isCancelled) {
    return {
      invoiceId,
      invoiceNumber,
      workType,
      isCancelled: true,
      revenue: 0,
      cogs: 0,
      grossProfit: 0,
      ahmedProfitShare: 0,
      abdouProfitShare: 0,
      ahmedCogsRecovery: 0,
      abdouSettlementObligation: 0,
      replacementFundAmount: 0,
      ahmedInventoryCogs: 0,
      abdouInventoryCogs: 0,
      sharedInventoryCogs: 0
    };
  }

  const items = input.items || [];
  let rawSubtotal = 0;
  let totalCogs = 0;
  let ahmedCogs = 0;
  let abdouCogs = 0;
  let sharedCogs = 0;

  for (const item of items) {
    const qty = Math.max(0, Number(item.quantity) || 0);
    const price = Math.max(0, Number(item.unitPriceSnapshot) || 0);
    const cost = Math.max(0, Number(item.unitCostSnapshot) || 0);

    const itemTotalPrice = qty * price;
    const itemTotalCost = qty * cost;

    rawSubtotal += itemTotalPrice;
    totalCogs += itemTotalCost;

    const ownership = normalizeStockOwnership(item.stockOwnershipSnapshot);
    if (ownership === 'AHMED') {
      ahmedCogs += itemTotalCost;
    } else if (ownership === 'ABDO') {
      abdouCogs += itemTotalCost;
    } else {
      sharedCogs += itemTotalCost;
    }
  }

  const discount = Math.min(Math.max(0, Number(input.discountAmount) || 0), rawSubtotal);
  const revenue = roundMoney(rawSubtotal - discount);
  const cogs = roundMoney(totalCogs);
  const grossProfit = roundMoney(revenue - cogs);

  const ahmedInventoryCogs = roundMoney(ahmedCogs);
  const abdouInventoryCogs = roundMoney(abdouCogs);
  const sharedInventoryCogs = roundMoney(sharedCogs);

  let ahmedProfitShare = 0;
  let abdouProfitShare = 0;
  let ahmedCogsRecovery = 0;
  let abdouSettlementObligation = 0;
  let replacementFundAmount = 0;

  if (workType === 'CUSTOMER_WORK') {
    ahmedProfitShare = roundMoney(grossProfit * 0.50);
    abdouProfitShare = roundMoney(grossProfit * 0.50);
    replacementFundAmount = cogs;
  } else if (workType === 'AHMED_WORK') {
    ahmedCogsRecovery = cogs;
    ahmedProfitShare = grossProfit;
    abdouProfitShare = 0;
    replacementFundAmount = 0;
  } else if (workType === 'ABDO_WORK') {
    ahmedProfitShare = roundMoney(grossProfit * 0.25);
    abdouProfitShare = roundMoney(grossProfit * 0.75);
    abdouSettlementObligation = ahmedProfitShare;
    replacementFundAmount = 0;
  }

  return {
    invoiceId,
    invoiceNumber,
    workType,
    isCancelled: false,
    revenue,
    cogs,
    grossProfit,
    ahmedProfitShare,
    abdouProfitShare,
    ahmedCogsRecovery,
    abdouSettlementObligation,
    replacementFundAmount,
    ahmedInventoryCogs,
    abdouInventoryCogs,
    sharedInventoryCogs
  };
}

/**
 * Executes post_invoice_accounting RPC on Supabase or performs fallback client upsert if RPC is unavailable.
 */
export async function postInvoiceAccountingToSupabase(
  invoiceId: string,
  currentUser?: { id?: string; email?: string; role?: string }
): Promise<{ success: boolean; result?: InvoiceAccountingResult; error?: string }> {
  try {
    // Attempt RPC call first
    const { data, error } = await supabase.rpc('post_invoice_accounting', {
      p_invoice_id: invoiceId
    });

    if (!error && data && (data.success || data.invoice_id)) {
      const res: InvoiceAccountingResult = {
        invoiceId: data.invoice_id,
        invoiceNumber: data.invoice_number,
        workType: normalizeWorkType(data.work_type),
        isCancelled: Boolean(data.is_cancelled),
        revenue: Number(data.revenue || 0),
        cogs: Number(data.cogs || 0),
        grossProfit: Number(data.gross_profit || 0),
        ahmedProfitShare: Number(data.ahmed_profit_share || 0),
        abdouProfitShare: Number(data.abdou_profit_share || 0),
        ahmedCogsRecovery: Number(data.ahmed_cogs_recovery || 0),
        abdouSettlementObligation: Number(data.abdou_settlement_obligation || 0),
        replacementFundAmount: Number(data.replacement_fund_amount || 0),
        ahmedInventoryCogs: Number(data.ahmed_inventory_cogs || 0),
        abdouInventoryCogs: Number(data.abdou_inventory_cogs || 0),
        sharedInventoryCogs: Number(data.shared_inventory_cogs || 0)
      };
      return { success: true, result: res };
    }

    if (error && error.message.includes('غير مصرح')) {
      return { success: false, error: error.message };
    }

    // Fallback: Query invoice & invoice_items directly from Supabase, run pure calculation, and upsert to invoice_accounting_ledger
    const { data: invRow, error: invErr } = await supabase
      .from('invoices')
      .select('*, invoice_items(*)')
      .eq('id', invoiceId)
      .maybeSingle();

    if (invErr || !invRow) {
      return { success: false, error: invErr?.message || 'لم يتم العثور على الفاتورة' };
    }

    const items: AccountingItemInput[] = (invRow.invoice_items || []).map((it: any) => ({
      productId: it.product_id,
      quantity: it.quantity,
      unitPriceSnapshot: it.unit_price_snapshot,
      unitCostSnapshot: it.unit_cost_snapshot,
      stockOwnershipSnapshot: it.stock_ownership_snapshot
    }));

    const calcInput: InvoiceAccountingInput = {
      invoiceId: invRow.id,
      invoiceNumber: invRow.invoice_number,
      workType: invRow.work_type || invRow.work_owner,
      discountAmount: invRow.discount_amount,
      isCancelled: invRow.status === 'cancelled',
      items
    };

    const calcResult = calculateInvoiceAccounting(calcInput);

    // Delete existing ledger entries for this invoice to preserve idempotency
    await supabase.from('invoice_accounting_ledger').delete().eq('invoice_id', invoiceId);
    await supabase.from('partner_ledger').delete().eq('reference_type', 'INVOICE').eq('reference_id', invoiceId);

    // Upsert into invoice_accounting_ledger
    const { error: ledgerErr } = await supabase.from('invoice_accounting_ledger').upsert({
      invoice_id: calcResult.invoiceId,
      invoice_number: calcResult.invoiceNumber,
      work_type: calcResult.workType,
      revenue: calcResult.revenue,
      cogs: calcResult.cogs,
      gross_profit: calcResult.grossProfit,
      ahmed_profit_share: calcResult.ahmedProfitShare,
      abdou_profit_share: calcResult.abdouProfitShare,
      ahmed_cogs_recovery: calcResult.ahmedCogsRecovery,
      abdou_settlement_obligation: calcResult.abdouSettlementObligation,
      replacement_fund_amount: calcResult.replacementFundAmount,
      ahmed_inventory_cogs: calcResult.ahmedInventoryCogs,
      abdou_inventory_cogs: calcResult.abdouInventoryCogs,
      shared_inventory_cogs: calcResult.sharedInventoryCogs,
      is_cancelled: calcResult.isCancelled,
      created_by_user_id: currentUser?.id || null,
      metadata: { posted_at: new Date().toISOString() }
    }, { onConflict: 'invoice_id' });

    if (ledgerErr) {
      console.warn('⚠️ Warning writing to invoice_accounting_ledger:', ledgerErr);
    }

    return { success: true, result: calcResult };
  } catch (err: any) {
    return { success: false, error: err?.message || 'حدث خطأ في محرك المحاسبة' };
  }
}
