import React, { useState } from 'react';
import {
  Calendar,
  Building2,
  User,
  Users,
  FileText,
  Printer,
  Download,
  Package,
  ChevronDown,
  ChevronUp,
  Box,
  Layers,
  ShoppingBag,
  X,
  Search,
  Filter,
  Eye,
  AlertCircle,
  Clock,
  DollarSign
} from 'lucide-react';
import { RepairOrder, WorkOwnershipType, Invoice } from '../../types';
import { formatDateISO, roundMoney } from '../../lib/finalReportsEngine';
import { calculateOrderAccountingV2 } from '../../lib/accountingEngineV2';
import { useRepairPartUsages, useInvoices, useProducts, useInventoryMovements } from '../../hooks/useData';

interface ProfitsSummaryProps {
  orders: RepairOrder[];
  currencySymbol?: string;
}

export interface WithdrawnItemDetail {
  id: string;
  partName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  refNum: string;
  customerName: string;
  date: string;
  ownership: WorkOwnershipType;
  partyLabel: 'SHOP' | 'AHMED' | 'ABDO';
  partyNameArabic: string;
  sourceType: 'REPAIR_ORDER' | 'DIRECT_INVOICE';
}

export interface AggregatedItem {
  partName: string;
  totalQuantity: number;
  unitCost: number;
  totalCost: number;
}

export default function ProfitsSummary({
  orders,
  currencySymbol = 'ج.م.'
}: ProfitsSummaryProps) {
  const { partUsages } = useRepairPartUsages();
  const { invoices } = useInvoices();
  const { products } = useProducts();
  const { movements: rawMovements } = useInventoryMovements();

  // Current Date Helper Values
  const now = new Date();
  const todayISO = now.toISOString().split('T')[0];
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // State
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>(currentMonthStr);
  const [partyFilter, setPartyFilter] = useState<'ALL' | 'SHOP' | 'AHMED' | 'ABDO'>('ALL');
  const [dateFilterType, setDateFilterType] = useState<'MONTH' | 'TODAY' | 'WEEK' | 'CUSTOM'>('MONTH');
  const [customFromDate, setCustomFromDate] = useState<string>(`${currentMonthStr}-01`);
  const [customToDate, setCustomToDate] = useState<string>(todayISO);

  // UI Modals & Expanders
  const [isWithdrawnModalOpen, setIsWithdrawnModalOpen] = useState(false);
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Parse Month/Year for display
  const [yearStr, monthNumStr] = selectedMonthYear.split('-');
  const selectedYear = Number(yearStr) || now.getFullYear();
  const selectedMonth = Number(monthNumStr) || now.getMonth() + 1;

  const monthNamesArabic = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];
  const selectedMonthLabel = `${monthNamesArabic[selectedMonth - 1] || ''} ${selectedYear}`;

  // Helper Date Check Function
  const isDateInFilterRange = (dateStr?: string): boolean => {
    if (!dateStr) return false;
    const isoDate = formatDateISO(dateStr);

    if (dateFilterType === 'TODAY') {
      return isoDate === todayISO;
    }
    if (dateFilterType === 'WEEK') {
      const d = new Date(isoDate);
      const diffMs = now.getTime() - d.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 7;
    }
    if (dateFilterType === 'MONTH') {
      return isoDate.startsWith(selectedMonthYear);
    }
    if (dateFilterType === 'CUSTOM') {
      return isoDate >= customFromDate && isoDate <= customToDate;
    }
    return true;
  };

  const isAbdoOwnership = (ownership?: string) => {
    if (!ownership) return false;
    const s = String(ownership).toUpperCase();
    return s === WorkOwnershipType.PARTNER_2_PRIVATE || s === 'ABDO' || s === 'ABDO_WORK' || s === 'P-002' || s === 'PARTNER_2';
  };

  const isAhmedOwnership = (ownership?: string) => {
    if (!ownership) return false;
    const s = String(ownership).toUpperCase();
    return s === WorkOwnershipType.PARTNER_1_PRIVATE || s === 'AHMED' || s === 'AHMED_WORK' || s === 'P-001' || s === 'PARTNER_1';
  };

  // Helper Party Ownership Match
  const matchesPartyFilter = (ownership: any): boolean => {
    if (partyFilter === 'ALL') return true;
    if (partyFilter === 'SHOP') return !isAhmedOwnership(ownership) && !isAbdoOwnership(ownership);
    if (partyFilter === 'AHMED') return isAhmedOwnership(ownership);
    if (partyFilter === 'ABDO') return isAbdoOwnership(ownership);
    return true;
  };

  // Helper to check if a part usage or reference ID belongs to an order
  const isPartBelongsToOrder = (puRepairOrderId: string | undefined, order: RepairOrder): boolean => {
    if (!puRepairOrderId) return false;
    const oId = String(order.id || '');
    const oNum = String((order as any).orderNumber || '');
    const oUuid = String((order as any).uuid || '');
    const target = String(puRepairOrderId);
    return target === oId || target === oNum || target === oUuid;
  };

  // Accounting Engine V2 is the single source for order profit/share calculations.
  const engineRows = orders.map((order) =>
    calculateOrderAccountingV2(order, invoices, rawMovements || [], partUsages)
  );

  const rows = engineRows
    .filter((row) => isDateInFilterRange(row.date))
    .filter((row) => partyFilter === 'ALL' || row.party === partyFilter)
    .map((row) => ({
      id: row.orderId,
      orderNum: row.orderNumber,
      customer: row.customerName,
      date: formatDateISO(row.date),
      ownership:
        row.party === 'AHMED'
          ? WorkOwnershipType.PARTNER_1_PRIVATE
          : row.party === 'ABDO'
          ? WorkOwnershipType.PARTNER_2_PRIVATE
          : WorkOwnershipType.CUSTOMER_SHARED,
      workLabel: row.workLabel,
      totalInvoice: row.revenue,
      partsCost: row.purchaseCost,
      partsList: row.parts.map((part) => ({
        partName: part.partName,
        quantity: part.quantity,
        unitCost: part.unitPurchaseCost,
        totalCost: part.totalPurchaseCost
      })),
      netProfit: row.netProfit,
      ahmedShare: row.ahmedShare,
      abdoShare: row.abdoShare,
      amountDueFromAbdo: row.amountDueFromAbdo,
      costSource: row.costSource,
      party: row.party
    }));

  // The withdrawn-goods cards and table use the exact same resolved part rows
  // used by Accounting Engine V2. This prevents card/table disagreement.
  const allWithdrawalTransactions: WithdrawnItemDetail[] = engineRows.flatMap((row) => {
    if (!isDateInFilterRange(row.date)) return [];
    return row.parts.map((part) => ({
      id: part.id,
      partName: part.partName,
      quantity: part.quantity,
      unitCost: part.unitPurchaseCost,
      totalCost: part.totalPurchaseCost,
      refNum: `أمر صيانة #${row.orderNumber}`,
      customerName: row.customerName,
      date: formatDateISO(row.date),
      ownership:
        row.party === 'AHMED'
          ? WorkOwnershipType.PARTNER_1_PRIVATE
          : row.party === 'ABDO'
          ? WorkOwnershipType.PARTNER_2_PRIVATE
          : WorkOwnershipType.CUSTOMER_SHARED,
      partyLabel: row.party,
      partyNameArabic: row.party === 'AHMED' ? 'أحمد' : row.party === 'ABDO' ? 'عبده' : 'المحل',
      sourceType: 'REPAIR_ORDER' as const
    }));
  });

  const withdrawnItemsList = allWithdrawalTransactions.filter((tx) => {
    if (partyFilter === 'ALL') return true;
    return tx.partyLabel === partyFilter;
  });

  // Filter by search query before aggregation
  const modalFilteredTransactions = withdrawnItemsList.filter((tx) => {
    if (!modalSearchQuery.trim()) return true;
    const q = modalSearchQuery.toLowerCase().trim();
    return (
      tx.partName.toLowerCase().includes(q) ||
      tx.refNum.toLowerCase().includes(q) ||
      tx.customerName.toLowerCase().includes(q)
    );
  });

  // Group by real Item Name (اسم الصنف)
  const aggregatedItemsMap = new Map<string, AggregatedItem>();

  modalFilteredTransactions.forEach((tx) => {
    const key = tx.partName;
    let aggregated = aggregatedItemsMap.get(key);
    if (!aggregated) {
      aggregated = {
        partName: key,
        totalQuantity: 0,
        unitCost: tx.unitCost,
        totalCost: 0
      };
      aggregatedItemsMap.set(key, aggregated);
    }

    aggregated.totalQuantity += tx.quantity;
    aggregated.totalCost += tx.totalCost;
    aggregated.unitCost = aggregated.totalQuantity > 0 ? roundMoney(aggregated.totalCost / aggregated.totalQuantity) : tx.unitCost;
  });

  const aggregatedItemsList = Array.from(aggregatedItemsMap.values());

  // Sort aggregated items by total quantity descending
  aggregatedItemsList.sort((a, b) => b.totalQuantity - a.totalQuantity);

  // Withdrawn Inventory Aggregations
  const totalWithdrawnQty = withdrawnItemsList.reduce((sum, i) => sum + i.quantity, 0);
  const totalWithdrawnCost = roundMoney(withdrawnItemsList.reduce((sum, i) => sum + i.totalCost, 0));

  // Overall KPI Summaries for displayed dataset
  const totalOrdersCount = rows.length;
  const totalInvoices = roundMoney(rows.reduce((sum, r) => sum + r.totalInvoice, 0));
  const totalPartsCost = roundMoney(rows.reduce((sum, r) => sum + r.partsCost, 0));
  const totalNetProfit = roundMoney(rows.reduce((sum, r) => sum + r.netProfit, 0));
  const totalAhmedShare = roundMoney(rows.reduce((sum, r) => sum + r.ahmedShare, 0));
  const totalAbdoShare = roundMoney(rows.reduce((sum, r) => sum + r.abdoShare, 0));

  // Abdo settlement is also sourced from the same engine rows.
  const abdoWorkRows = engineRows
    .filter((row) => row.party === 'ABDO' && isDateInFilterRange(row.date))
    .map((row) => ({
      totalInvoice: row.revenue,
      partsCost: row.purchaseCost,
      netProfit: row.netProfit,
      ahmed25Share: row.ahmedShare,
      abdo75Share: row.abdoShare
    }));

  const abdoTotalInvoices = roundMoney(abdoWorkRows.reduce((sum, r) => sum + r.totalInvoice, 0));
  const abdoTotalPartsCost = roundMoney(abdoWorkRows.reduce((sum, r) => sum + r.partsCost, 0));
  const abdoTotalNetProfit = roundMoney(abdoWorkRows.reduce((sum, r) => sum + r.netProfit, 0));
  const abdoAhmed25Share = roundMoney(abdoWorkRows.reduce((sum, r) => sum + r.ahmed25Share, 0));
  const abdoAbdo75Profit = roundMoney(abdoWorkRows.reduce((sum, r) => sum + r.abdo75Share, 0));
  const abdoTotalOwedByAbdo = roundMoney(
  abdoTotalPartsCost + abdoAhmed25Share
);

  // Print & Export Handlers
  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = [
      'رقم الأوردر',
      'التاريخ',
      'اسم العميل',
      'نوع الشغل',
      'إجمالي الفاتورة',
      'تكلفة قطع الغيار',
      'صافي الربح',
      'نصيب أحمد',
      'نصيب عبده'
    ];

    const csvRows = rows.map((r) => [
      r.orderNum,
      r.date,
      `"${r.customer}"`,
      `"${r.workLabel}"`,
      r.totalInvoice,
      r.partsCost,
      r.netProfit,
      r.ahmedShare,
      r.abdoShare
    ]);

    csvRows.push([]);
    csvRows.push(['--- تفاصيل البضاعة المسحوبة ---']);
    csvRows.push(['اسم القطعة', 'الكمية المسحوبة', 'سعر التكلفة', 'إجمالي التكلفة', 'رقم الأوردر/الفاتورة', 'العميل', 'التاريخ']);
    withdrawnItemsList.forEach((item) => {
      csvRows.push([
        `"${item.partName}"`,
        item.quantity,
        item.unitCost,
        item.totalCost,
        `"${item.refNum}"`,
        `"${item.customerName}"`,
        item.date
      ]);
    });

    csvRows.push([]);
    csvRows.push(['--- تسوية حساب عبده (شغل عبده) ---']);
    csvRows.push(['إجمالي الفواتير الخاصة بعبده', abdoTotalInvoices]);
    csvRows.push(['إجمالي تكلفة البضاعة المسحوبة', abdoTotalPartsCost]);
    csvRows.push(['نسبة أحمد (25%)', abdoAhmed25Share]);
    csvRows.push(['صافي ربح عبده (75%)', abdoAbdo75Profit]);
    csvRows.push(['إجمالي المستحق على عبده (نسبة أحمد 25%)', abdoTotalOwedByAbdo]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...csvRows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `partner_accounting_report_${selectedMonthYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Modal Filtered Items
  const modalFilteredItems = withdrawnItemsList.filter((item) => {
    if (!modalSearchQuery.trim()) return true;
    const q = modalSearchQuery.toLowerCase();
    return (
      item.partName.toLowerCase().includes(q) ||
      item.refNum.toLowerCase().includes(q) ||
      item.customerName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 text-right dir-rtl">
      {/* HEADER BAR */}
      <div className="bg-[#11131e] border border-[#2a2d42] p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-400">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              محاسبة الشركاء وتقارير الأرباح
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                {dateFilterType === 'MONTH' ? selectedMonthLabel : dateFilterType === 'TODAY' ? 'تقرير اليوم' : dateFilterType === 'WEEK' ? 'تقرير الأسبوع' : 'فترة مخصصة'}
              </span>
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              توزيع الأرباح الدقيق حسب نوع الشغل، تتبع البضاعة المسحوبة، وتسوية حساب عبده
            </p>
          </div>
        </div>

        {/* Export & Print */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            تصدير CSV
          </button>
          <button
            onClick={handlePrint}
            className="px-3.5 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            طباعة
          </button>
        </div>
      </div>

      {/* FILTER CONTROL PANEL */}
      <div className="bg-[#11131e] border border-[#2a2d42] p-4.5 rounded-2xl space-y-4 shadow-md">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 1. Select Party / Work Owner */}
          <div className="space-y-1.5">
            <label className="text-xs text-cyan-400 font-bold block flex items-center gap-1.5">
              <Users className="w-4 h-4 text-cyan-400" />
              1. اختيار الطرف / نوع الشغل:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'ALL', label: 'الجميع (الكل)', icon: Users },
                { id: 'SHOP', label: 'المحل (50/50)', icon: Building2 },
                { id: 'AHMED', label: 'أحمد (100%)', icon: User },
                { id: 'ABDO', label: 'عبده (75/25)', icon: User }
              ].map((p) => {
                const Icon = p.icon;
                return (
                  <button
                    key={p.id}
                    onClick={() => setPartyFilter(p.id as any)}
                    className={`flex-1 min-w-[100px] py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 border ${
                      partyFilter === p.id
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60 shadow-lg font-black'
                        : 'bg-[#181b2a] text-gray-400 border-[#2a2d42] hover:bg-[#202538] hover:text-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Select Date Range */}
          <div className="space-y-1.5">
            <label className="text-xs text-cyan-400 font-bold block flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-cyan-400" />
              2. التصفية حسب التاريخ:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'TODAY', label: 'اليوم' },
                { id: 'WEEK', label: 'الأسبوع' },
                { id: 'MONTH', label: 'الشهر' },
                { id: 'CUSTOM', label: 'فترة مخصصة' }
              ].map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDateFilterType(d.id as any)}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer border ${
                    dateFilterType === d.id
                      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/60 font-black'
                      : 'bg-[#181b2a] text-gray-400 border-[#2a2d42] hover:bg-[#202538] hover:text-white'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sub-inputs for Month Selector or Custom Date Inputs */}
        {dateFilterType === 'MONTH' && (
          <div className="flex items-center gap-3 pt-2 border-t border-[#1f2336]">
            <span className="text-xs text-gray-400 font-semibold">الشهر والسنة:</span>
            <input
              type="month"
              value={selectedMonthYear}
              onChange={(e) => setSelectedMonthYear(e.target.value)}
              className="bg-[#181b2a] border border-cyan-500/40 text-white font-bold text-xs px-3 py-1.5 rounded-xl outline-none focus:border-cyan-400 cursor-pointer"
            />
            <span className="text-xs text-cyan-300 font-bold">({selectedMonthLabel})</span>
          </div>
        )}

        {dateFilterType === 'CUSTOM' && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#1f2336]">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 font-semibold">من:</span>
              <input
                type="date"
                value={customFromDate}
                onChange={(e) => setCustomFromDate(e.target.value)}
                className="bg-[#181b2a] border border-cyan-500/40 text-white font-bold text-xs px-3 py-1.5 rounded-xl outline-none focus:border-cyan-400 cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 font-semibold">إلى:</span>
              <input
                type="date"
                value={customToDate}
                onChange={(e) => setCustomToDate(e.target.value)}
                className="bg-[#181b2a] border border-cyan-500/40 text-white font-bold text-xs px-3 py-1.5 rounded-xl outline-none focus:border-cyan-400 cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      {/* SPECIAL HIGHLIGHT: ABDO'S ACCOUNT SETTLEMENT BOX (Requirement 2) */}
      {(partyFilter === 'ALL' || partyFilter === 'ABDO') && (
        <div className="bg-gradient-to-br from-[#1a1710] via-[#11131e] to-[#141221] border-2 border-amber-500/40 p-5 rounded-2xl shadow-2xl relative overflow-hidden space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/20 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-400">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-amber-300 flex items-center gap-2">
                  تسوية حساب عبده (شغل عبده الخاص)
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    قواعد: عبده 75% | أحمد 25% | البضاعة مسحوبة
                  </span>
                </h3>
                <p className="text-[11px] text-gray-400">
                  عبده يسحب البضاعة من المحل دون دفع قيمتها فوراً، وتُسوى أرباح أحمد والبضاعة بنهاية الشهر
                </p>
              </div>
            </div>

            <div className="bg-rose-950/40 border border-rose-500/50 px-4 py-2 rounded-xl text-left dir-ltr">
              <span className="text-[10px] text-rose-300 font-bold block text-right dir-rtl">
                إجمالي المستحق على عبده
              </span>
              <span className="text-xl font-black text-rose-400">
                {abdoTotalOwedByAbdo.toLocaleString('ar-EG')} <span className="text-xs">{currencySymbol}</span>
              </span>
            </div>
          </div>

          {/* Abdo Breakdown Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-[#181b2a]/80 border border-[#2a2d42] p-3 rounded-xl">
              <span className="text-[10px] text-gray-400 font-bold block">1. إجمالي فواتير عبده</span>
              <h4 className="text-base font-black text-white mt-1">
                {abdoTotalInvoices.toLocaleString('ar-EG')} <span className="text-[10px]">{currencySymbol}</span>
              </h4>
            </div>

            <div className="bg-[#181b2a]/80 border border-rose-500/30 p-3 rounded-xl">
              <span className="text-[10px] text-rose-300 font-bold block">2. تكلفة البضاعة المسحوبة</span>
              <h4 className="text-base font-black text-rose-400 mt-1">
                {abdoTotalPartsCost.toLocaleString('ar-EG')} <span className="text-[10px]">{currencySymbol}</span>
              </h4>
            </div>

            <div className="bg-[#181b2a]/80 border border-indigo-500/30 p-3 rounded-xl">
              <span className="text-[10px] text-indigo-300 font-bold block">3. نسبة أحمد (25%)</span>
              <h4 className="text-base font-black text-indigo-300 mt-1">
                {abdoAhmed25Share.toLocaleString('ar-EG')} <span className="text-[10px]">{currencySymbol}</span>
              </h4>
            </div>

            <div className="bg-[#181b2a]/80 border border-emerald-500/30 p-3 rounded-xl">
              <span className="text-[10px] text-emerald-300 font-bold block">4. صافي ربح عبده (75%)</span>
              <h4 className="text-base font-black text-emerald-300 mt-1">
                {abdoAbdo75Profit.toLocaleString('ar-EG')} <span className="text-[10px]">{currencySymbol}</span>
              </h4>
            </div>

            <div className="col-span-2 sm:col-span-1 bg-gradient-to-r from-rose-950/60 to-rose-900/40 border border-rose-500/60 p-3 rounded-xl">
              <span className="text-[10px] text-rose-200 font-bold block">5. المستحق على عبده</span>
              <h4 className="text-base font-black text-rose-300 mt-1">
                {abdoTotalOwedByAbdo.toLocaleString('ar-EG')} <span className="text-[10px]">{currencySymbol}</span>
              </h4>
            </div>
          </div>

          <div className="bg-[#131625] p-2.5 rounded-xl border border-amber-500/20 text-xs text-amber-200/90 flex items-center justify-between">
            <span>
              💡 <strong>معادلة التسوية:</strong> إجمالي المستحق على عبده = نسبة أحمد 25% من صافي الربح = <strong>{abdoTotalOwedByAbdo.toLocaleString('ar-EG')} ج.م.</strong>
            </span>
          </div>
        </div>
      )}

      {/* SUMMARY KPI CARDS (INCLUDING CLICKABLE WITHDRAWN INVENTORY CARD - Requirement 3) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* 1. عدد الأوردرات */}
        <div className="bg-[#11131e] border border-[#2a2d42] p-3.5 rounded-2xl">
          <span className="text-[11px] text-gray-400 font-bold block">عدد الأوردرات</span>
          <h4 className="text-xl font-black text-white mt-1">{totalOrdersCount}</h4>
          <span className="text-[10px] text-gray-500 block mt-0.5">أمر صيانة</span>
        </div>

        {/* 2. إجمالي الفواتير */}
        <div className="bg-[#11131e] border border-[#2a2d42] p-3.5 rounded-2xl">
          <span className="text-[11px] text-gray-400 font-bold block">إجمالي الإيرادات</span>
          <h4 className="text-xl font-black text-white mt-1">
            {totalInvoices.toLocaleString('ar-EG')}{' '}
            <span className="text-[10px] text-gray-400">{currencySymbol}</span>
          </h4>
          <span className="text-[10px] text-gray-500 block mt-0.5">إجمالي الفواتير</span>
        </div>

        {/* 3. CLICKABLE CARD: البضاعة المسحوبة (تكلفة البضاعة) */}
        <div
          onClick={() => setIsWithdrawnModalOpen(true)}
          className="bg-gradient-to-br from-rose-950/40 via-[#11131e] to-[#161222] border-2 border-rose-500/50 hover:border-rose-400 p-3.5 rounded-2xl cursor-pointer transition-all hover:scale-[1.02] group shadow-lg relative"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-rose-300 font-extrabold flex items-center gap-1">
              <ShoppingBag className="w-3.5 h-3.5 text-rose-400" />
              البضاعة المسحوبة
            </span>
            <span className="text-[9px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded-full font-bold group-hover:bg-rose-500 group-hover:text-white transition">
              عرض التفاصيل 👁️
            </span>
          </div>
          <h4 className="text-xl font-black text-rose-300 mt-1">
            {totalWithdrawnCost.toLocaleString('ar-EG')}{' '}
            <span className="text-[10px] text-gray-400">{currencySymbol}</span>
          </h4>
          <span className="text-[10px] text-rose-400/80 block mt-0.5 font-bold">
            {totalWithdrawnQty} قطعة مسحوبة (اضغط)
          </span>
        </div>

        {/* 4. عدد قطع الغيار */}
        <div className="bg-[#11131e] border border-rose-500/20 p-3.5 rounded-2xl">
          <span className="text-[11px] text-rose-300/80 font-bold block">إجمالي قطع الغيار</span>
          <h4 className="text-xl font-black text-rose-400 mt-1">{totalWithdrawnQty}</h4>
          <span className="text-[10px] text-gray-500 block mt-0.5">قطعة مستخدمة</span>
        </div>

        {/* 5. إجمالي صافي الربح */}
        <div className="bg-[#11131e] border border-cyan-500/40 p-3.5 rounded-2xl bg-cyan-950/10">
          <span className="text-[11px] text-cyan-300 font-bold block">إجمالي صافي الربح</span>
          <h4 className="text-xl font-black text-cyan-200 mt-1">
            {totalNetProfit.toLocaleString('ar-EG')}{' '}
            <span className="text-[10px] text-gray-400">{currencySymbol}</span>
          </h4>
          <span className="text-[10px] text-gray-400 block mt-0.5">بعد خصم التكلفة</span>
        </div>

        {/* 6. إجمالي مستحق أحمد */}
        <div className="bg-gradient-to-br from-indigo-950/60 to-[#11131e] border border-indigo-500/40 p-3.5 rounded-2xl">
          <span className="text-[11px] text-indigo-300 font-bold block">إجمالي مستحق أحمد</span>
          <h4 className="text-xl font-black text-indigo-200 mt-1">
            {totalAhmedShare.toLocaleString('ar-EG')}{' '}
            <span className="text-[10px] text-gray-400">{currencySymbol}</span>
          </h4>
          <span className="text-[10px] text-indigo-300/80 block mt-0.5">نصيبه النهائي</span>
        </div>

        {/* 7. إجمالي مستحق عبده */}
        <div className="bg-gradient-to-br from-emerald-950/60 to-[#11131e] border border-emerald-500/40 p-3.5 rounded-2xl">
          <span className="text-[11px] text-emerald-300 font-bold block">إجمالي مستحق عبده</span>
          <h4 className="text-xl font-black text-emerald-200 mt-1">
            {totalAbdoShare.toLocaleString('ar-EG')}{' '}
            <span className="text-[10px] text-gray-400">{currencySymbol}</span>
          </h4>
          <span className="text-[10px] text-emerald-300/80 block mt-0.5">نصيبه النهائي</span>
        </div>
      </div>

      {/* MAIN ORDERS REPAIR TABLE */}
      <div className="bg-[#11131e] border border-[#2a2d42] rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-[#2a2d42] flex items-center justify-between bg-[#141724]">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-400" />
            جدول أوردرات الصيانة والتوزيع ({rows.length} أمر)
          </h3>
          <span className="text-xs font-bold text-gray-400">
            الطرف المفلتر: <strong className="text-cyan-300">{partyFilter === 'ALL' ? 'الكل' : partyFilter === 'SHOP' ? 'المحل' : partyFilter === 'AHMED' ? 'أحمد' : 'عبده'}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right text-gray-300">
            <thead className="bg-[#181b2a] text-gray-400 font-semibold border-b border-[#2a2d42]">
              <tr>
                <th className="p-3">رقم الأوردر</th>
                <th className="p-3">التاريخ</th>
                <th className="p-3">العميل</th>
                <th className="p-3">نوع الشغل</th>
                <th className="p-3">إجمالي الفاتورة</th>
                <th className="p-3 text-rose-400">تكلفة قطع الغيار</th>
                <th className="p-3 text-cyan-300">صافي الربح</th>
                <th className="p-3 text-indigo-400 font-bold">نصيب أحمد</th>
                <th className="p-3 text-emerald-400 font-bold">نصيب عبده</th>
                <th className="p-3 text-center">عرض البضاعة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f2937]">
              {rows.length > 0 ? (
                rows.map((r) => {
                  const isExpanded = expandedOrderId === r.id;
                  return (
                    <React.Fragment key={r.id}>
                      <tr className="hover:bg-[#161927] transition">
                        <td className="p-3 font-mono font-bold text-cyan-400">{r.orderNum}</td>
                        <td className="p-3 text-gray-400 whitespace-nowrap">{r.date}</td>
                        <td className="p-3 font-semibold text-white">{r.customer}</td>
                        <td className="p-3">
                          <span
                            className={`px-2.5 py-1 rounded-md font-bold text-[11px] ${
                              r.ownership === WorkOwnershipType.PARTNER_1_PRIVATE
                                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                : r.ownership === WorkOwnershipType.PARTNER_2_PRIVATE
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                            }`}
                          >
                            {r.workLabel}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-white">
                          {r.totalInvoice.toLocaleString('ar-EG')} {currencySymbol}
                        </td>
                        <td className="p-3 text-rose-400 font-semibold">
                          {r.partsCost.toLocaleString('ar-EG')} {currencySymbol}
                        </td>
                        <td className="p-3 font-extrabold text-cyan-300">
                          {r.netProfit.toLocaleString('ar-EG')} {currencySymbol}
                        </td>
                        <td className="p-3 font-black text-indigo-300 text-sm">
                          {r.ahmedShare.toLocaleString('ar-EG')} {currencySymbol}
                        </td>
                        <td className="p-3 font-black text-emerald-300 text-sm">
                          {r.abdoShare.toLocaleString('ar-EG')} {currencySymbol}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => setExpandedOrderId(isExpanded ? null : r.id)}
                            className={`px-3 py-1 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 mx-auto transition cursor-pointer border ${
                              isExpanded
                                ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-black'
                                : 'bg-[#181b2a] hover:bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                            }`}
                          >
                            <Box className="w-3.5 h-3.5" />
                            <span>عرض التفاصيل</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Sub-Row */}
                      {isExpanded && (
                        <tr className="bg-[#0e101a] border-y-2 border-cyan-500/30">
                          <td colSpan={10} className="p-4">
                            <div className="bg-[#151828] border border-[#2a2d42] rounded-xl p-3 space-y-2">
                              <div className="flex items-center justify-between border-b border-[#2a2d42] pb-2">
                                <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                                  <Package className="w-4 h-4" />
                                  قطع الغيار المسحوبة للأوردر رقم #{r.orderNum}
                                </span>
                                <span className="text-[11px] text-gray-400 font-mono">
                                  إجمالي التكلفة: {r.partsCost.toLocaleString('ar-EG')} {currencySymbol}
                                </span>
                              </div>

                              {r.partsList.length > 0 ? (
                                <table className="w-full text-xs text-right text-gray-300">
                                  <thead className="bg-[#1c2035] text-gray-400 font-bold">
                                    <tr>
                                      <th className="p-2">اسم قطعة الغيار</th>
                                      <th className="p-2">الكمية المسحوبة</th>
                                      <th className="p-2">تكلفة الوحدة</th>
                                      <th className="p-2 text-rose-300">إجمالي التكلفة</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[#2a2d42]">
                                    {r.partsList.map((p, pIdx) => (
                                      <tr key={pIdx} className="hover:bg-[#1a1e30]">
                                        <td className="p-2 font-semibold text-white">{p.partName}</td>
                                        <td className="p-2 font-bold text-cyan-300">{p.quantity}</td>
                                        <td className="p-2">{p.unitCost.toLocaleString('ar-EG')} {currencySymbol}</td>
                                        <td className="p-2 font-bold text-rose-400">
                                          {p.totalCost.toLocaleString('ar-EG')} {currencySymbol}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              ) : (
                                <p className="text-xs text-gray-500 py-2 text-center">
                                  لم يتم تسجيل قطع غيار مخصصة لهذا الأوردر (تكلفة البضاعة 0 ج.م)
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-gray-500">
                    لا توجد أوردرات صيانة مطابقة للفلتر المحدد
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: AGGREGATED WITHDRAWN INVENTORY REPORT */}
      {isWithdrawnModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 dir-rtl text-right overflow-y-auto">
          <div className="bg-[#11131e] border border-[#2a2d42] rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-[#2a2d42] flex items-center justify-between bg-[#141724]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-400">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    تقرير البضاعة المسحوبة التجميعي حسب نوع الصنف
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      {partyFilter === 'ALL' ? 'جميع الأطراف' : partyFilter === 'SHOP' ? 'شغل المحل' : partyFilter === 'AHMED' ? 'شغل أحمد' : 'شغل عبده'}
                    </span>
                  </h3>
                  <p className="text-xs text-gray-400">
                    تقرير تجميعي يظهر كل صنف مسحوب مرة واحدة فقط مع مجموع الكميات المسحوبة والتكلفة الإجمالية
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setIsWithdrawnModalOpen(false);
                }}
                className="p-2 text-gray-400 hover:text-white bg-[#1a1d2d] hover:bg-[#25293e] rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Search Bar & Party Filter Indicator */}
            <div className="p-4 border-b border-[#2a2d42] bg-[#161928] flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-4 h-4 text-gray-400 absolute right-3 top-3" />
                <input
                  type="text"
                  placeholder="ابحث باسم الصنف، أو رقم الأوردر/الفاتورة..."
                  value={modalSearchQuery}
                  onChange={(e) => setModalSearchQuery(e.target.value)}
                  className="w-full bg-[#11131e] border border-[#2a2d42] text-white text-xs pr-9 pl-4 py-2.5 rounded-xl outline-none focus:border-rose-500/50"
                />
              </div>

              <div className="flex items-center gap-2 text-xs font-bold text-gray-300">
                <span>الطرف المختار:</span>
                <div className="flex bg-[#11131e] p-1 rounded-xl border border-[#2a2d42]">
                  <button
                    onClick={() => setPartyFilter('ALL')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      partyFilter === 'ALL' ? 'bg-rose-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    الكل
                  </button>
                  <button
                    onClick={() => setPartyFilter('SHOP')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      partyFilter === 'SHOP' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    المحل
                  </button>
                  <button
                    onClick={() => setPartyFilter('AHMED')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      partyFilter === 'AHMED' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    أحمد
                  </button>
                  <button
                    onClick={() => setPartyFilter('ABDO')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      partyFilter === 'ABDO' ? 'bg-amber-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    عبده
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Primary Table Content */}
            <div className="overflow-y-auto flex-1 p-4">
              {(() => {
                const filteredAggregated = aggregatedItemsList.filter((item) => {
                  if (!modalSearchQuery.trim()) return true;
                  const query = modalSearchQuery.toLowerCase();
                  return item.partName.toLowerCase().includes(query);
                });

                const modalTotalProducts = filteredAggregated.length;
                const modalTotalPieces = filteredAggregated.reduce((sum, item) => sum + item.totalQuantity, 0);
                const modalTotalCost = roundMoney(filteredAggregated.reduce((sum, item) => sum + item.totalCost, 0));

                return (
                  <>
                    <table className="w-full text-xs text-right text-gray-300 border-collapse">
                      <thead className="bg-[#181b2a] text-gray-400 font-semibold border-b border-[#2a2d42] sticky top-0">
                        <tr>
                          <th className="p-3">اسم الصنف</th>
                          <th className="p-3 text-center">الكمية</th>
                          <th className="p-3 text-center">سعر تكلفة الشراء (وقت السحب)</th>
                          <th className="p-3 text-rose-400 font-bold text-left">إجمالي التكلفة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1f2937]">
                        {filteredAggregated.length > 0 ? (
                          filteredAggregated.map((item, idx) => (
                            <tr key={idx} className="hover:bg-[#161927] transition">
                              <td className="p-3 font-bold text-white flex items-center gap-2">
                                <Box className="w-4 h-4 text-rose-400 shrink-0" />
                                <span className="text-sm">{item.partName}</span>
                              </td>
                              <td className="p-3 font-extrabold text-cyan-300 text-center text-sm">
                                {item.totalQuantity} قطعة
                              </td>
                              <td className="p-3 text-center text-gray-300 font-medium text-sm">
                                {item.unitCost.toLocaleString('ar-EG')} {currencySymbol}
                              </td>
                              <td className="p-3 font-black text-rose-300 text-sm text-left">
                                {item.totalCost.toLocaleString('ar-EG')} {currencySymbol}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="p-8 text-center text-gray-500">
                              لا توجد أصناف بضاعة مسحوبة مطابقة للبحث أو الفلتر المختار
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>

                    {/* Modal Footer Summary */}
                    <div className="mt-4 p-4 border-t-2 border-[#2a2d42] bg-[#141724] flex flex-wrap items-center justify-between gap-4 rounded-xl">
                      <div className="flex items-center gap-4">
                        <div className="bg-[#1a1d2d] border border-[#2a2d42] px-3.5 py-2 rounded-xl">
                          <span className="text-[10px] text-gray-400 font-bold block">إجمالي عدد الأصناف:</span>
                          <span className="text-sm font-black text-white">
                            {modalTotalProducts} صنف
                          </span>
                        </div>

                        <div className="bg-[#1a1d2d] border border-cyan-500/30 px-3.5 py-2 rounded-xl">
                          <span className="text-[10px] text-cyan-300 font-bold block">إجمالي عدد القطع:</span>
                          <span className="text-sm font-black text-cyan-300">
                            {modalTotalPieces} قطعة
                          </span>
                        </div>

                        <div className="bg-[#1a1d2d] border border-rose-500/30 px-3.5 py-2 rounded-xl">
                          <span className="text-[10px] text-rose-300 font-bold block">إجمالي تكلفة المسحوبات:</span>
                          <span className="text-sm font-black text-rose-400">
                            {modalTotalCost.toLocaleString('ar-EG')} {currencySymbol}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => setIsWithdrawnModalOpen(false)}
                        className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                      >
                        إغلاق التقرير
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
