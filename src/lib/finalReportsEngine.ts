import { supabase } from './supabaseClient';
import { roundMoney } from './accountingEngine';
export { roundMoney };
import { PartnerLedgerEntry } from './partnerLedgerEngine';
import {
  Expense,
  Invoice,
  MonthlySettlementResult,
  Product,
  ReplacementFundEntry,
  SettlementAuditRecord,
  UserRole
} from '../types';

export interface OwnerStockMetrics {
  owner: 'AHMED' | 'ABDO' | 'SHARED';
  itemsCount: number;
  totalQuantity: number;
  valuationAtCost: number;
  retailSalesValue: number;
  cogsUsed: number;
  lowStockItemsCount: number;
  stagnantItemsCount: number;
}

export interface StatementRow {
  id: string;
  date: string;
  type: string;
  description: string;
  reference: string;
  debit: number;  // مدين
  credit: number; // دائن
  cumulativeBalance: number;
  userName: string;
}

export interface SalesReportFilter {
  dateFrom?: string;
  dateTo?: string;
  periodPreset?: 'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'CUSTOM';
  workType?: 'ALL' | 'CUSTOMER_WORK' | 'AHMED_WORK' | 'ABDO_WORK';
  customerId?: string;
  userId?: string;
  paymentMethod?: string;
  invoiceStatus?: string;
  stockOwnership?: 'ALL' | 'AHMED' | 'ABDO' | 'SHARED';
}

export interface SalesReportRow {
  invoiceId: string;
  invoiceNumber: string;
  date: string;
  customerName: string;
  workType: string;
  paymentMethod: string;
  status: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  ahmedProfitShare: number;
  abdouProfitShare: number;
  ahmedCogsRecovery: number;
  abdouSettlementObligation: number;
  replacementFundAmount: number;
}

/**
 * Filter persistence in SessionStorage
 */
export function saveReportFiltersToSession(reportKey: string, filters: any): void {
  try {
    sessionStorage.setItem(`report_filters_${reportKey}`, JSON.stringify(filters));
  } catch (e) {
    // Ignore session errors
  }
}

export function getReportFiltersFromSession<T>(reportKey: string, defaultFilters: T): T {
  try {
    const raw = sessionStorage.getItem(`report_filters_${reportKey}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    // Return default
  }
  return defaultFilters;
}

/**
 * Normalizes Date strings into YYYY-MM-DD
 */
export function formatDateISO(dateStr?: string): string {
  if (!dateStr) return new Date().toISOString().slice(0, 10);
  return dateStr.slice(0, 10);
}

/**
 * Executive Management Dashboard Calculator
 */
export function calculateExecutiveDashboardData(
  invoices: Invoice[],
  expenses: Expense[],
  fundEntries: ReplacementFundEntry[],
  settlements: MonthlySettlementResult[]
) {
  const todayStr = formatDateISO();
  const currentMonthStr = todayStr.slice(0, 7);

  let dailySales = 0;
  let monthlySales = 0;
  let totalCogs = 0;
  let grossProfit = 0;
  let totalInvoicesCount = 0;
  let partiallyPaidCount = 0;
  let unpaidCount = 0;
  let totalCustomerDebts = 0;

  for (const inv of invoices) {
    if (inv.isCancelled) continue;
    const invDate = formatDateISO(inv.date);
    const totalAmount = Number(inv.totalAmount || 0);
    const paidAmount = Number(inv.paidAmount || 0);
    const remaining = Math.max(0, totalAmount - paidAmount);

    totalInvoicesCount++;

    if (remaining > 0) {
      if (paidAmount > 0) {
        partiallyPaidCount++;
      } else {
        unpaidCount++;
      }
      totalCustomerDebts += remaining;
    }

    if (invDate === todayStr) {
      dailySales += totalAmount;
    }

    if (invDate.startsWith(currentMonthStr)) {
      monthlySales += totalAmount;
    }

    // Accrue COGS & Profit from items or accounting ledger if available
    const invCogs = Number((inv as any).cogs || 0);
    totalCogs += invCogs;
  }

  // Calculate total expenses for current month
  let totalExpenses = 0;
  for (const exp of expenses) {
    if (exp.isCancelled) continue;
    const expMonth = formatDateISO(exp.date).slice(0, 7);
    if (expMonth === currentMonthStr) {
      totalExpenses += Number(exp.amount || 0);
    }
  }

  grossProfit = roundMoney(monthlySales - totalCogs);
  const netProfit = roundMoney(grossProfit - totalExpenses);

  // Replacement fund balance from entries
  const replacementFundBalance = roundMoney(
    fundEntries.reduce((sum, e) => sum + Number(e.signedAmount || 0), 0)
  );

  let openMonthsCount = 0;
  let lockedMonthsCount = 0;
  for (const set of settlements) {
    if (set.status === 'LOCKED') {
      lockedMonthsCount++;
    } else {
      openMonthsCount++;
    }
  }

  return {
    dailySales: roundMoney(dailySales),
    monthlySales: roundMoney(monthlySales),
    totalCogs: roundMoney(totalCogs),
    grossProfit: roundMoney(grossProfit),
    totalExpenses: roundMoney(totalExpenses),
    netProfit: roundMoney(netProfit),
    totalInvoicesCount,
    partiallyPaidCount,
    unpaidCount,
    totalCustomerDebts: roundMoney(totalCustomerDebts),
    replacementFundBalance,
    openMonthsCount,
    lockedMonthsCount
  };
}

/**
 * Filter Partner Ledger Entries by Date Range
 */
export function filterPartnerLedgerByDate(
  entries: PartnerLedgerEntry[],
  dateFrom?: string,
  dateTo?: string
): PartnerLedgerEntry[] {
  return entries.filter((e) => {
    if (e.reversedAt || e.transactionType === 'REVERSAL') return false;
    const entryDate = formatDateISO(e.createdAt);
    if (dateFrom && entryDate < dateFrom) return false;
    if (dateTo && entryDate > dateTo) return false;
    return true;
  });
}

/**
 * Calculate Ahmed Dashboard Data
 */
export function calculateAhmedDashboardData(
  ledgerEntries: PartnerLedgerEntry[],
  expenses: Expense[],
  settlements: MonthlySettlementResult[],
  dateFrom?: string,
  dateTo?: string
) {
  const filteredLedger = filterPartnerLedgerByDate(ledgerEntries, dateFrom, dateTo);

  let ahmedProfit = 0;
  let ahmedCogsRecovery = 0;
  let manualTransactionsCount = 0;

  for (const entry of filteredLedger) {
    if (entry.accountOwner === 'AHMED') {
      if (entry.transactionType === 'PROFIT_SHARE') {
        ahmedProfit += entry.signedAmount;
      } else if (entry.transactionType === 'COGS_RECOVERY') {
        ahmedCogsRecovery += entry.signedAmount;
      }
      const txTypeStr = entry.transactionType as string;
      if (txTypeStr === 'DEPOSIT' || txTypeStr === 'WITHDRAWAL' || txTypeStr === 'MANUAL_DEPOSIT') {
        manualTransactionsCount++;
      }
    }
  }

  // Expenses for Ahmed
  let ahmedPrivateExpenses = 0;
  let sharedExpensesTotal = 0;

  for (const exp of expenses) {
    if (exp.isCancelled) continue;
    const expDate = formatDateISO(exp.date);
    if (dateFrom && expDate < dateFrom) continue;
    if (dateTo && expDate > dateTo) continue;

    const owner = exp.expenseOwner || 'SHARED';
    const amt = Number(exp.amount || 0);

    if (owner === 'AHMED') {
      ahmedPrivateExpenses += amt;
    } else if (owner === 'SHARED') {
      sharedExpensesTotal += amt;
    }
  }

  const ahmedSharedExpensesShare = roundMoney(sharedExpensesTotal / 2);
  const ahmedNetEntitlement = roundMoney(
    ahmedProfit + ahmedCogsRecovery - ahmedPrivateExpenses - ahmedSharedExpensesShare
  );

  let paidSettlements = 0;
  let remainingSettlements = 0;

  for (const set of settlements) {
    if (set.status === 'LOCKED') {
      paidSettlements += set.ahmedNetPayout;
    } else {
      remainingSettlements += set.ahmedNetPayout;
    }
  }

  const detailedEntries = filteredLedger.filter((e) => e.accountOwner === 'AHMED');

  return {
    ahmedProfit: roundMoney(ahmedProfit),
    ahmedCogsRecovery: roundMoney(ahmedCogsRecovery),
    ahmedPrivateExpenses: roundMoney(ahmedPrivateExpenses),
    ahmedSharedExpensesShare,
    ahmedNetEntitlement,
    manualTransactionsCount,
    paidSettlements: roundMoney(paidSettlements),
    remainingSettlements: roundMoney(remainingSettlements),
    detailedEntries
  };
}

/**
 * Calculate Abdo Dashboard Data
 */
export function calculateAbdoDashboardData(
  ledgerEntries: PartnerLedgerEntry[],
  expenses: Expense[],
  settlements: MonthlySettlementResult[],
  dateFrom?: string,
  dateTo?: string
) {
  const filteredLedger = filterPartnerLedgerByDate(ledgerEntries, dateFrom, dateTo);

  let abdouProfit = 0;
  let abdouSettlementObligation = 0;

  for (const entry of filteredLedger) {
    if (entry.accountOwner === 'ABDO') {
      if (entry.transactionType === 'PROFIT_SHARE') {
        abdouProfit += entry.signedAmount;
      } else if (entry.transactionType === 'SETTLEMENT_OBLIGATION') {
        abdouSettlementObligation += Math.abs(entry.amount);
      }
    }
  }

  // Expenses for Abdo
  let abdouPrivateExpenses = 0;
  let sharedExpensesTotal = 0;

  for (const exp of expenses) {
    if (exp.isCancelled) continue;
    const expDate = formatDateISO(exp.date);
    if (dateFrom && expDate < dateFrom) continue;
    if (dateTo && expDate > dateTo) continue;

    const owner = exp.expenseOwner || 'SHARED';
    const amt = Number(exp.amount || 0);

    if (owner === 'ABDO') {
      abdouPrivateExpenses += amt;
    } else if (owner === 'SHARED') {
      sharedExpensesTotal += amt;
    }
  }

  const abdouSharedExpensesShare = roundMoney(sharedExpensesTotal / 2);
  const netAbdouAccount = roundMoney(
    abdouProfit - abdouSettlementObligation - abdouPrivateExpenses - abdouSharedExpensesShare
  );

  let paidObligations = 0;
  let remainingObligations = 0;

  for (const set of settlements) {
    if (set.status === 'LOCKED') {
      paidObligations += set.abdouSettlementObligation;
    } else {
      remainingObligations += set.abdouSettlementObligation;
    }
  }

  const detailedEntries = filteredLedger.filter((e) => e.accountOwner === 'ABDO');

  return {
    abdouProfit: roundMoney(abdouProfit),
    abdouSettlementObligation: roundMoney(abdouSettlementObligation),
    abdouPrivateExpenses: roundMoney(abdouPrivateExpenses),
    abdouSharedExpensesShare,
    paidObligations: roundMoney(paidObligations),
    remainingObligations: roundMoney(remainingObligations),
    netAbdouAccount,
    detailedEntries
  };
}

/**
 * Replacement Fund Report Data
 */
export function calculateReplacementFundReportData(
  fundEntries: ReplacementFundEntry[],
  alertThreshold: number = 1000
) {
  let openingBalance = 0;
  let totalDeposits = 0;
  let totalWithdrawals = 0;

  for (const entry of fundEntries) {
    const amt = Number(entry.amount || 0);
    const signed = Number(entry.signedAmount || 0);

    if (signed >= 0) {
      totalDeposits += amt;
    } else {
      totalWithdrawals += Math.abs(signed);
    }
  }

  const currentBalance = roundMoney(totalDeposits - totalWithdrawals);
  const isBelowThreshold = currentBalance < alertThreshold;
  const hasNegativeWithdrawal = currentBalance < 0;

  return {
    openingBalance,
    totalDeposits: roundMoney(totalDeposits),
    totalWithdrawals: roundMoney(totalWithdrawals),
    currentBalance,
    entries: fundEntries,
    alertThreshold,
    isBelowThreshold,
    hasNegativeWithdrawal
  };
}

/**
 * Inventory by Ownership Report Data
 */
export function calculateInventoryByOwnershipData(products: Product[]) {
  const result: Record<'AHMED' | 'ABDO' | 'SHARED', OwnerStockMetrics> = {
    AHMED: {
      owner: 'AHMED',
      itemsCount: 0,
      totalQuantity: 0,
      valuationAtCost: 0,
      retailSalesValue: 0,
      cogsUsed: 0,
      lowStockItemsCount: 0,
      stagnantItemsCount: 0
    },
    ABDO: {
      owner: 'ABDO',
      itemsCount: 0,
      totalQuantity: 0,
      valuationAtCost: 0,
      retailSalesValue: 0,
      cogsUsed: 0,
      lowStockItemsCount: 0,
      stagnantItemsCount: 0
    },
    SHARED: {
      owner: 'SHARED',
      itemsCount: 0,
      totalQuantity: 0,
      valuationAtCost: 0,
      retailSalesValue: 0,
      cogsUsed: 0,
      lowStockItemsCount: 0,
      stagnantItemsCount: 0
    }
  };

  for (const p of products) {
    const owner = (p.stockOwnership || 'SHARED') as 'AHMED' | 'ABDO' | 'SHARED';
    const qty = Number(p.quantity || 0);
    const cost = Number(p.purchasePrice || 0);
    const price = Number(p.sellPrice || 0);
    const minAlert = Number(p.minStock || 3);

    const m = result[owner] || result.SHARED;
    m.itemsCount++;
    m.totalQuantity += qty;
    m.valuationAtCost += qty * cost;
    m.retailSalesValue += qty * price;

    if (qty <= minAlert && qty > 0) {
      m.lowStockItemsCount++;
    } else if (qty === 0) {
      m.stagnantItemsCount++;
    }
  }

  result.AHMED.valuationAtCost = roundMoney(result.AHMED.valuationAtCost);
  result.AHMED.retailSalesValue = roundMoney(result.AHMED.retailSalesValue);

  result.ABDO.valuationAtCost = roundMoney(result.ABDO.valuationAtCost);
  result.ABDO.retailSalesValue = roundMoney(result.ABDO.retailSalesValue);

  result.SHARED.valuationAtCost = roundMoney(result.SHARED.valuationAtCost);
  result.SHARED.retailSalesValue = roundMoney(result.SHARED.retailSalesValue);

  return result;
}

/**
 * Filter Invoices and Produce Detailed Sales & Profit Report Rows
 */
export function generateSalesReportRows(
  invoices: Invoice[],
  filter: SalesReportFilter
): { summary: SalesReportRow; rows: SalesReportRow[] } {
  const rows: SalesReportRow[] = [];

  const summaryRow: SalesReportRow = {
    invoiceId: 'TOTAL',
    invoiceNumber: 'الإجمالي العام',
    date: '-',
    customerName: '-',
    workType: filter.workType || 'ALL',
    paymentMethod: filter.paymentMethod || 'ALL',
    status: filter.invoiceStatus || 'ALL',
    revenue: 0,
    cogs: 0,
    grossProfit: 0,
    ahmedProfitShare: 0,
    abdouProfitShare: 0,
    ahmedCogsRecovery: 0,
    abdouSettlementObligation: 0,
    replacementFundAmount: 0
  };

  for (const inv of invoices) {
    const invDate = formatDateISO(inv.date);

    if (filter.dateFrom && invDate < filter.dateFrom) continue;
    if (filter.dateTo && invDate > filter.dateTo) continue;

    const workType = (inv as any).workType || 'CUSTOMER_WORK';
    if (filter.workType && filter.workType !== 'ALL' && workType !== filter.workType) continue;

    if (filter.customerId && inv.customerId !== filter.customerId) continue;
    if (filter.paymentMethod && filter.paymentMethod !== 'ALL' && inv.paymentMethod !== filter.paymentMethod) continue;
    const invStatus = inv.isCancelled ? 'CANCELLED' : (inv.isPaid ? 'PAID' : 'PENDING');
    if (filter.invoiceStatus && filter.invoiceStatus !== 'ALL' && invStatus !== filter.invoiceStatus) continue;

    const rev = Number(inv.totalAmount || 0);
    const cogs = Number((inv as any).cogs || 0);
    const gp = roundMoney(rev - cogs);

    // Accrued breakdown if stored
    const ahmedProf = Number((inv as any).ahmedProfitShare || 0);
    const abdouProf = Number((inv as any).abdouProfitShare || 0);
    const ahmedCogs = Number((inv as any).ahmedCogsRecovery || 0);
    const abdouOblig = Number((inv as any).abdouSettlementObligation || 0);
    const fundAmt = Number((inv as any).replacementFundAmount || 0);

    const row: SalesReportRow = {
      invoiceId: inv.id,
      invoiceNumber: inv.id,
      date: invDate,
      customerName: (inv as any).customerName || inv.customerId || 'عميل نقدي',
      workType,
      paymentMethod: inv.paymentMethod || 'كاش',
      status: invStatus,
      revenue: roundMoney(rev),
      cogs: roundMoney(cogs),
      grossProfit: gp,
      ahmedProfitShare: roundMoney(ahmedProf),
      abdouProfitShare: roundMoney(abdouProf),
      ahmedCogsRecovery: roundMoney(ahmedCogs),
      abdouSettlementObligation: roundMoney(abdouOblig),
      replacementFundAmount: roundMoney(fundAmt)
    };

    rows.push(row);

    summaryRow.revenue += row.revenue;
    summaryRow.cogs += row.cogs;
    summaryRow.grossProfit += row.grossProfit;
    summaryRow.ahmedProfitShare += row.ahmedProfitShare;
    summaryRow.abdouProfitShare += row.abdouProfitShare;
    summaryRow.ahmedCogsRecovery += row.ahmedCogsRecovery;
    summaryRow.abdouSettlementObligation += row.abdouSettlementObligation;
    summaryRow.replacementFundAmount += row.replacementFundAmount;
  }

  summaryRow.revenue = roundMoney(summaryRow.revenue);
  summaryRow.cogs = roundMoney(summaryRow.cogs);
  summaryRow.grossProfit = roundMoney(summaryRow.grossProfit);
  summaryRow.ahmedProfitShare = roundMoney(summaryRow.ahmedProfitShare);
  summaryRow.abdouProfitShare = roundMoney(summaryRow.abdouProfitShare);
  summaryRow.ahmedCogsRecovery = roundMoney(summaryRow.ahmedCogsRecovery);
  summaryRow.abdouSettlementObligation = roundMoney(summaryRow.abdouSettlementObligation);
  summaryRow.replacementFundAmount = roundMoney(summaryRow.replacementFundAmount);

  return { summary: summaryRow, rows };
}

/**
 * Generate Printable / PDF Account Statement
 */
export function generateAccountStatementRows(
  target: 'AHMED' | 'ABDO' | 'REPLACEMENT_FUND' | 'CUSTOMER' | 'SUPPLIER',
  ledgerEntries: PartnerLedgerEntry[],
  fundEntries: ReplacementFundEntry[],
  expenses: Expense[],
  entityId?: string
): StatementRow[] {
  const rows: StatementRow[] = [];
  let cumulative = 0;

  if (target === 'AHMED' || target === 'ABDO') {
    const partnerEntries = ledgerEntries.filter(
      (e) => !e.reversedAt && e.transactionType !== 'REVERSAL' && e.accountOwner === target
    );

    // Sort by date ascending for cumulative balance
    partnerEntries.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

    for (const e of partnerEntries) {
      const isCredit = e.signedAmount >= 0;
      const amt = Math.abs(e.signedAmount || e.amount || 0);

      const debit = isCredit ? 0 : amt;
      const credit = isCredit ? amt : 0;
      cumulative += e.signedAmount;

      rows.push({
        id: e.id || `st-${Math.random()}`,
        date: formatDateISO(e.createdAt),
        type: e.transactionType,
        description: e.description || e.workType || 'حركة شريك',
        reference: e.invoiceNumber || e.invoiceId || '-',
        debit: roundMoney(debit),
        credit: roundMoney(credit),
        cumulativeBalance: roundMoney(cumulative),
        userName: e.accountOwner
      });
    }
  } else if (target === 'REPLACEMENT_FUND') {
    const sorted = [...fundEntries].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

    for (const e of sorted) {
      const signed = Number(e.signedAmount || 0);
      const isDeposit = signed >= 0;
      const amt = Math.abs(signed);

      const debit = isDeposit ? 0 : amt;
      const credit = isDeposit ? amt : 0;
      cumulative += signed;

      rows.push({
        id: e.id || `fnd-${Math.random()}`,
        date: formatDateISO(e.createdAt),
        type: e.transactionType,
        description: e.description || 'حركة صندوق بضاعة',
        reference: e.referenceId || '-',
        debit: roundMoney(debit),
        credit: roundMoney(credit),
        cumulativeBalance: roundMoney(cumulative),
        userName: e.createdByUserId || 'النظام'
      });
    }
  }

  return rows;
}

/**
 * Printable HTML Window Export Helper
 */
export function openPrintableReportHTML(
  reportTitle: string,
  headers: string[],
  rows: (string | number)[][],
  shopName: string = 'Atari Store Pro X',
  dateRangeStr: string = 'جميع الفترات',
  userName: string = 'المدير المسؤول'
) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const htmlContent = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>${reportTitle} - ${shopName}</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          margin: 20px;
          color: #111;
          direction: rtl;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #333;
          padding-bottom: 15px;
          margin-bottom: 20px;
        }
        .header h1 { margin: 0; font-size: 22px; color: #1a1a2e; }
        .header h2 { margin: 5px 0 0 0; font-size: 16px; color: #4a4e69; }
        .meta-info {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          margin-bottom: 15px;
          background: #f8f9fa;
          padding: 10px;
          border-radius: 6px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
          font-size: 12px;
        }
        th, td {
          border: 1px solid #ccc;
          padding: 8px 10px;
          text-align: right;
        }
        th {
          background-color: #2b2d42;
          color: #ffffff;
          font-weight: bold;
        }
        tr:nth-child(even) { background-color: #f9f9f9; }
        tr.total-row {
          background-color: #e2e8f0;
          font-weight: bold;
        }
        .footer {
          margin-top: 30px;
          text-align: center;
          font-size: 11px;
          color: #666;
          border-top: 1px dashed #ccc;
          padding-top: 10px;
        }
        @media print {
          @page { margin: 15mm; size: A4 portrait; }
          body { margin: 0; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${shopName}</h1>
        <h2>${reportTitle}</h2>
      </div>

      <div class="meta-info">
        <div><strong>الفترة:</strong> ${dateRangeStr}</div>
        <div><strong>تاريخ التصدير:</strong> ${new Date().toLocaleString('ar-EG')}</div>
        <div><strong>المستخدم:</strong> ${userName}</div>
      </div>

      <table>
        <thead>
          <tr>
            ${headers.map((h) => `<th>${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (r, idx) => `
            <tr class="${idx === rows.length - 1 ? 'total-row' : ''}">
              ${r.map((c) => `<td>${c != null ? c : '-'}</td>`).join('')}
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>

      <div class="footer">
        تم استخراج هذا التقرير تلقائياً من نظام Atari Store Pro X المحاسبي الشامل • صفحة 1 من 1
      </div>

      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}

/**
 * Export CSV / Excel Format Helper
 */
export function exportToCSV(
  filename: string,
  headers: string[],
  rows: (string | number)[][],
  shopName: string = 'Atari Store Pro X',
  dateRangeStr: string = 'جميع الفترات',
  userName: string = 'المدير المسؤول'
) {
  const metaRows = [
    [`المحل:`, shopName],
    [`التقرير:`, filename],
    [`الفترة:`, dateRangeStr],
    [`تاريخ التصدير:`, new Date().toLocaleString('ar-EG')],
    [`المستخدم:`, userName],
    []
  ];

  const contentArray = [...metaRows, headers, ...rows];

  const csvContent = contentArray
    .map((e) =>
      e
        .map((val) => {
          const str = String(val != null ? val : '').replace(/"/g, '""');
          return `"${str}"`;
        })
        .join(',')
    )
    .join('\n');

  // Add UTF-8 BOM so Excel opens Arabic correctly
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
