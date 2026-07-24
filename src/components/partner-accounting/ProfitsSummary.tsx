import React, { useState } from 'react';
import {
  Calendar,
  Building2,
  User,
  Users,
  FileText,
  Printer,
  Download,
  RotateCcw,
  ShieldCheck,
  Package,
  ChevronDown,
  ChevronUp,
  Box,
  Layers,
  Sparkles,
  ShoppingBag
} from 'lucide-react';
import { RepairOrder, WorkOwnershipType } from '../../types';
import { formatDateISO, roundMoney } from '../../lib/finalReportsEngine';
import { useRepairPartUsages } from '../../hooks/useData';

interface ProfitsSummaryProps {
  orders: RepairOrder[];
  currencySymbol?: string;
}

interface PartDetail {
  partName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

export default function ProfitsSummary({
  orders,
  currencySymbol = 'ج.م.'
}: ProfitsSummaryProps) {
  const { partUsages } = useRepairPartUsages();

  // Get current year-month string (e.g. "2026-07")
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [selectedMonthYear, setSelectedMonthYear] = useState<string>(currentMonthStr);
  const [workTypeFilter, setWorkTypeFilter] = useState<string>('ALL'); // 'ALL' | 'CUSTOMER_SHARED' | 'PARTNER_1_PRIVATE' | 'PARTNER_2_PRIVATE'
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Parse Year and Month for label display (e.g. "يوليو 2026")
  const [yearStr, monthNumStr] = selectedMonthYear.split('-');
  const selectedYear = Number(yearStr) || now.getFullYear();
  const selectedMonth = Number(monthNumStr) || now.getMonth() + 1;

  const monthNamesArabic = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];
  const selectedMonthLabel = `${monthNamesArabic[selectedMonth - 1] || ''} ${selectedYear}`;

  // Filter orders by selected month/year and work ownership filter
  const filteredOrders = orders.filter((o) => {
    if (!o.receivedDate) return false;
    const orderDateISO = formatDateISO(o.receivedDate); // "YYYY-MM-DD"
    if (!orderDateISO.startsWith(selectedMonthYear)) return false;

    const ownership = o.jobType || o.workOwnershipType || WorkOwnershipType.CUSTOMER_SHARED;

    if (workTypeFilter === 'ALL') return true;
    if (workTypeFilter === 'CUSTOMER_SHARED') {
      return ownership === WorkOwnershipType.CUSTOMER_SHARED;
    }
    if (workTypeFilter === 'PARTNER_1_PRIVATE') {
      return ownership === WorkOwnershipType.PARTNER_1_PRIVATE;
    }
    if (workTypeFilter === 'PARTNER_2_PRIVATE') {
      return ownership === WorkOwnershipType.PARTNER_2_PRIVATE;
    }
    return true;
  });

  // Build row details for each order including spare parts used
  const rows = filteredOrders.map((o) => {
    const orderNum = (o as any).orderNumber || o.id;
    const customer = o.customerNameSnapshot || o.guestCustomerName || 'عميل نقدي';
    const date = formatDateISO(o.receivedDate);
    const totalInvoice = Math.max(0, (Number(o.finalRepairPrice ?? o.totalEstimatedCost) || 0) - (Number(o.discount) || 0));

    // Get parts for this order from partUsages
    const orderParts = partUsages.filter(
      (pu) => pu.repairOrderId === o.id && pu.accountingStatus !== 'RETURNED' && pu.accountingStatus !== 'REVERSED'
    );

    let partsList: PartDetail[] = [];
    let partsCost = 0;

    if (orderParts.length > 0) {
      partsList = orderParts.map((p) => {
        const qty = Number(p.quantity) || 1;
        const uCost = Number(p.unitCost) || 0;
        const tCost = Number(p.totalCost) || qty * uCost;
        return {
          partName: p.partName || 'قطع غيار صيانة',
          quantity: qty,
          unitCost: uCost,
          totalCost: tCost
        };
      });
      partsCost = partsList.reduce((sum, item) => sum + item.totalCost, 0);
    } else {
      // Fallback to order devices partsCost if specific parts list is not saved
      const devicePartsCost = o.devices?.reduce((sum, d) => sum + (Number(d.partsCost) || 0), 0) || 0;
      partsCost = devicePartsCost;
      if (devicePartsCost > 0) {
        partsList = [
          {
            partName: 'قطع غيار صيانة مسجلة بالأوردر',
            quantity: 1,
            unitCost: devicePartsCost,
            totalCost: devicePartsCost
          }
        ];
      }
    }

    const netProfit = Math.max(0, totalInvoice - partsCost);
    const ownership = o.jobType || o.workOwnershipType || WorkOwnershipType.CUSTOMER_SHARED;

    let ahmedShare = 0;
    let abdoShare = 0;
    let workLabel = 'شغل المحل';

    if (ownership === WorkOwnershipType.PARTNER_1_PRIVATE) {
      // شغل أحمد: أحمد 100%، عبده 0%
      ahmedShare = roundMoney(netProfit * 1.0);
      abdoShare = 0;
      workLabel = 'شغل أحمد';
    } else if (ownership === WorkOwnershipType.PARTNER_2_PRIVATE) {
      // شغل عبده: عبده 75%، أحمد 25%
      abdoShare = roundMoney(netProfit * 0.75);
      ahmedShare = roundMoney(netProfit * 0.25);
      workLabel = 'شغل عبده';
    } else {
      // شغل المحل: أحمد 50%، عبده 50%
      ahmedShare = roundMoney(netProfit * 0.5);
      abdoShare = roundMoney(netProfit * 0.5);
      workLabel = 'شغل المحل';
    }

    return {
      id: o.id,
      orderNum,
      customer,
      date,
      ownership,
      workLabel,
      totalInvoice,
      partsCost,
      partsList,
      netProfit,
      ahmedShare,
      abdoShare
    };
  });

  // Calculate Monthly Aggregated Spare Parts Summary ("تجميع البضاعة خلال الشهر")
  const aggregatedPartsMap: { [key: string]: { partName: string; totalQty: number; unitCost: number; totalCost: number } } = {};

  rows.forEach((r) => {
    r.partsList.forEach((p) => {
      const key = p.partName.trim().toLowerCase();
      if (!aggregatedPartsMap[key]) {
        aggregatedPartsMap[key] = {
          partName: p.partName,
          totalQty: 0,
          unitCost: p.unitCost,
          totalCost: 0
        };
      }
      aggregatedPartsMap[key].totalQty += p.quantity;
      aggregatedPartsMap[key].totalCost += p.totalCost;
    });
  });

  const aggregatedPartsList = Object.values(aggregatedPartsMap).sort((a, b) => b.totalCost - a.totalCost);

  // Overall KPI Summaries (الملخص النهائي)
  const totalOrdersCount = rows.length;
  const totalInvoices = roundMoney(rows.reduce((sum, r) => sum + r.totalInvoice, 0));
  const totalPartsQty = rows.reduce((sum, r) => sum + r.partsList.reduce((pSum, p) => pSum + p.quantity, 0), 0);
  const totalPartsCost = roundMoney(rows.reduce((sum, r) => sum + r.partsCost, 0));
  const totalNetProfit = roundMoney(rows.reduce((sum, r) => sum + r.netProfit, 0));
  const totalAhmedShare = roundMoney(rows.reduce((sum, r) => sum + r.ahmedShare, 0));
  const totalAbdoShare = roundMoney(rows.reduce((sum, r) => sum + r.abdoShare, 0));

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
    csvRows.push(['--- ملخص البضاعة المسحوبة خلال الشهر ---']);
    csvRows.push(['اسم قطعة الغيار', 'إجمالي العدد', 'تكلفة الوحدة', 'إجمالي التكلفة']);
    aggregatedPartsList.forEach((p) => {
      csvRows.push([`"${p.partName}"`, p.totalQty, p.unitCost, p.totalCost]);
    });

    csvRows.push([]);
    csvRows.push(['--- الإجمالي العام ---']);
    csvRows.push(['عدد الأوردرات', totalOrdersCount]);
    csvRows.push(['إجمالي الفواتير', totalInvoices]);
    csvRows.push(['إجمالي قطع الغيار', totalPartsQty]);
    csvRows.push(['إجمالي تكلفة قطع الغيار', totalPartsCost]);
    csvRows.push(['إجمالي صافي الربح', totalNetProfit]);
    csvRows.push(['نصيب أحمد النهائي', totalAhmedShare]);
    csvRows.push(['نصيب عبده النهائي', totalAbdoShare]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...csvRows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `monthly_profits_report_${selectedMonthYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Quick Month Navigation
  const handleSetPrevMonth = () => {
    let y = selectedYear;
    let m = selectedMonth - 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    setSelectedMonthYear(`${y}-${String(m).padStart(2, '0')}`);
  };

  const handleSetNextMonth = () => {
    let y = selectedYear;
    let m = selectedMonth + 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    setSelectedMonthYear(`${y}-${String(m).padStart(2, '0')}`);
  };

  return (
    <div className="space-y-6 text-right dir-rtl">
      {/* HEADER & FILTER BAR */}
      <div className="bg-[#11131e] border border-[#2a2d42] p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-400">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              ملخص الأرباح والتقرير الشهري
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                {selectedMonthLabel}
              </span>
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              حساب وإجمالي أرباح المحل والشركاء (أحمد وعبده) بدون تعقيدات محاسبية
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            تصدير Excel/CSV
          </button>

          <button
            onClick={handlePrint}
            className="px-3 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            طباعة
          </button>
        </div>
      </div>

      {/* FILTERS CONTROL CARD */}
      <div className="bg-[#11131e] border border-[#2a2d42] p-4 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4 shadow-md">
        {/* 1. Month & Year Selector */}
        <div className="space-y-1.5">
          <label className="text-xs text-cyan-400 font-bold block flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-cyan-400" />
            1. اختيار الشهر والسنة:
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSetPrevMonth}
              className="px-3 py-2 bg-[#181b2a] hover:bg-[#202538] border border-[#2a2d42] text-gray-300 rounded-xl text-xs font-bold transition"
            >
              الشهر السابق
            </button>
            <input
              type="month"
              value={selectedMonthYear}
              onChange={(e) => setSelectedMonthYear(e.target.value)}
              className="bg-[#181b2a] border border-cyan-500/40 text-white font-bold text-sm px-3 py-1.5 rounded-xl outline-none focus:border-cyan-400 cursor-pointer flex-1"
            />
            <button
              onClick={handleSetNextMonth}
              className="px-3 py-2 bg-[#181b2a] hover:bg-[#202538] border border-[#2a2d42] text-gray-300 rounded-xl text-xs font-bold transition"
            >
              الشهر التالي
            </button>
          </div>
        </div>

        {/* 2. Work Ownership Filter */}
        <div className="space-y-1.5">
          <label className="text-xs text-cyan-400 font-bold block flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-cyan-400" />
            2. اختيار نوع الشغل:
          </label>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'ALL', label: 'الكل' },
              { id: 'CUSTOMER_SHARED', label: 'شغل المحل' },
              { id: 'PARTNER_1_PRIVATE', label: 'شغل أحمد' },
              { id: 'PARTNER_2_PRIVATE', label: 'شغل عبده' }
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setWorkTypeFilter(f.id)}
                className={`flex-1 min-w-[80px] py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer border ${
                  workTypeFilter === f.id
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-md'
                    : 'bg-[#181b2a] text-gray-400 border-[#2a2d42] hover:bg-[#202538] hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SUMMARY KPI CARDS (الملخص النهائي - الخانات السبع) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* 1. عدد الأوردرات */}
        <div className="bg-[#11131e] border border-[#2a2d42] p-3.5 rounded-2xl">
          <span className="text-[11px] text-gray-400 font-bold block">عدد الأوردرات</span>
          <h4 className="text-xl font-black text-white mt-1">{totalOrdersCount}</h4>
          <span className="text-[10px] text-gray-500 block mt-0.5">أمر صيانة</span>
        </div>

        {/* 2. إجمالي الفواتير */}
        <div className="bg-[#11131e] border border-[#2a2d42] p-3.5 rounded-2xl">
          <span className="text-[11px] text-gray-400 font-bold block">إجمالي الفواتير</span>
          <h4 className="text-xl font-black text-white mt-1">
            {totalInvoices.toLocaleString('ar-EG')}{' '}
            <span className="text-[10px] text-gray-400">{currencySymbol}</span>
          </h4>
          <span className="text-[10px] text-gray-500 block mt-0.5">شامل الإيرادات</span>
        </div>

        {/* 3. إجمالي عدد قطع الغيار */}
        <div className="bg-[#11131e] border border-rose-500/20 p-3.5 rounded-2xl">
          <span className="text-[11px] text-rose-300/80 font-bold block">إجمالي عدد قطع الغيار</span>
          <h4 className="text-xl font-black text-rose-400 mt-1">{totalPartsQty}</h4>
          <span className="text-[10px] text-gray-500 block mt-0.5">قطع مستخدمة</span>
        </div>

        {/* 4. إجمالي تكلفة قطع الغيار */}
        <div className="bg-[#11131e] border border-rose-500/30 p-3.5 rounded-2xl">
          <span className="text-[11px] text-rose-400 font-bold block">إجمالي تكلفة قطع الغيار</span>
          <h4 className="text-xl font-black text-rose-300 mt-1">
            {totalPartsCost.toLocaleString('ar-EG')}{' '}
            <span className="text-[10px] text-gray-400">{currencySymbol}</span>
          </h4>
          <span className="text-[10px] text-gray-500 block mt-0.5">تكلفة البضاعة</span>
        </div>

        {/* 5. إجمالي صافي الربح */}
        <div className="bg-[#11131e] border border-cyan-500/40 p-3.5 rounded-2xl bg-cyan-950/10">
          <span className="text-[11px] text-cyan-300 font-bold block">إجمالي صافي الربح</span>
          <h4 className="text-xl font-black text-cyan-200 mt-1">
            {totalNetProfit.toLocaleString('ar-EG')}{' '}
            <span className="text-[10px] text-gray-400">{currencySymbol}</span>
          </h4>
          <span className="text-[10px] text-gray-400 block mt-0.5">بعد خصم البضاعة</span>
        </div>

        {/* 6. إجمالي نصيب أحمد */}
        <div className="bg-gradient-to-br from-indigo-950/60 to-[#11131e] border border-indigo-500/40 p-3.5 rounded-2xl">
          <span className="text-[11px] text-indigo-300 font-bold block">إجمالي مستحق أحمد</span>
          <h4 className="text-xl font-black text-indigo-200 mt-1">
            {totalAhmedShare.toLocaleString('ar-EG')}{' '}
            <span className="text-[10px] text-gray-400">{currencySymbol}</span>
          </h4>
          <span className="text-[10px] text-indigo-300/80 block mt-0.5">نصيبه النهائى</span>
        </div>

        {/* 7. إجمالي نصيب عبده */}
        <div className="bg-gradient-to-br from-emerald-950/60 to-[#11131e] border border-emerald-500/40 p-3.5 rounded-2xl">
          <span className="text-[11px] text-emerald-300 font-bold block">إجمالي مستحق عبده</span>
          <h4 className="text-xl font-black text-emerald-200 mt-1">
            {totalAbdoShare.toLocaleString('ar-EG')}{' '}
            <span className="text-[10px] text-gray-400">{currencySymbol}</span>
          </h4>
          <span className="text-[10px] text-emerald-300/80 block mt-0.5">نصيبه النهائي</span>
        </div>
      </div>

      {/* MAIN ORDERS REPAIR TABLE (جدول تفاصيل الأوردرات) */}
      <div className="bg-[#11131e] border border-[#2a2d42] rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-[#2a2d42] flex items-center justify-between bg-[#141724]">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-400" />
            جدول أوردرات الصيانة والتوزيع - {selectedMonthLabel} ({rows.length} أمر)
          </h3>
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
                <th className="p-3">تكلفة قطع الغيار</th>
                <th className="p-3">صافي الربح</th>
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
                            <span>عرض البضاعة</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Sub-Row for Order Parts */}
                      {isExpanded && (
                        <tr className="bg-[#0e101a] border-y-2 border-cyan-500/30">
                          <td colSpan={10} className="p-4">
                            <div className="bg-[#151828] border border-[#2a2d42] rounded-xl p-3 space-y-2">
                              <div className="flex items-center justify-between border-b border-[#2a2d42] pb-2">
                                <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                                  <Package className="w-4 h-4" />
                                  قطع الغيار المستخدمة للأوردر رقم #{r.orderNum}
                                </span>
                                <span className="text-[11px] text-gray-400 font-mono">
                                  إجمالي البضاعة: {r.partsCost.toLocaleString('ar-EG')} {currencySymbol}
                                </span>
                              </div>

                              {r.partsList.length > 0 ? (
                                <table className="w-full text-xs text-right text-gray-300">
                                  <thead className="bg-[#1c2035] text-gray-400 font-bold">
                                    <tr>
                                      <th className="p-2">اسم قطعة الغيار</th>
                                      <th className="p-2">الكمية المستخدمة</th>
                                      <th className="p-2">تكلفة الوحدة</th>
                                      <th className="p-2 text-rose-300">إجمالي تكلفة القطعة</th>
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
                    لا توجد أوردرات صيانة مطابقة للفلتر في هذا الشهر ({selectedMonthLabel})
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="bg-[#181b2a] border-t-2 border-[#2a2d42] font-bold text-white">
                <tr>
                  <td colSpan={4} className="p-3 text-left font-black text-cyan-400">
                    الإجمالي العام ({selectedMonthLabel}):
                  </td>
                  <td className="p-3 text-white text-sm">
                    {totalInvoices.toLocaleString('ar-EG')} {currencySymbol}
                  </td>
                  <td className="p-3 text-rose-400 text-sm">
                    {totalPartsCost.toLocaleString('ar-EG')} {currencySymbol}
                  </td>
                  <td className="p-3 text-cyan-300 text-base font-black">
                    {totalNetProfit.toLocaleString('ar-EG')} {currencySymbol}
                  </td>
                  <td className="p-3 text-indigo-300 text-base font-black">
                    {totalAhmedShare.toLocaleString('ar-EG')} {currencySymbol}
                  </td>
                  <td className="p-3 text-emerald-300 text-base font-black">
                    {totalAbdoShare.toLocaleString('ar-EG')} {currencySymbol}
                  </td>
                  <td className="p-3"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* MONTHLY AGGREGATED SPARE PARTS SUMMARY TABLE (تجميع البضاعة خلال الشهر / ملخص البضاعة المسحوبة) */}
      <div className="bg-[#11131e] border border-[#2a2d42] rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-[#2a2d42] flex items-center justify-between bg-[#141724]">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-rose-400" />
            <div>
              <h3 className="text-sm font-bold text-white">
                ملخص البضاعة المسحوبة خلال شهر {selectedMonthLabel}
              </h3>
              <p className="text-[11px] text-gray-400">
                تجميع لكافة قطع الغيار المسحوبة للأوردرات المحددة بالتقرير
              </p>
            </div>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30">
            {aggregatedPartsList.length} نوع قطعة غيار
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right text-gray-300">
            <thead className="bg-[#181b2a] text-gray-400 font-semibold border-b border-[#2a2d42]">
              <tr>
                <th className="p-3">قطعة الغيار</th>
                <th className="p-3 text-cyan-400">إجمالي العدد المستخدم خلال الشهر</th>
                <th className="p-3">تكلفة الوحدة (وقت الأوردر)</th>
                <th className="p-3 text-rose-400">إجمالي تكلفة الكمية</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f2937]">
              {aggregatedPartsList.length > 0 ? (
                aggregatedPartsList.map((p, idx) => (
                  <tr key={idx} className="hover:bg-[#161927] transition">
                    <td className="p-3 font-bold text-white flex items-center gap-2">
                      <Box className="w-3.5 h-3.5 text-cyan-400" />
                      {p.partName}
                    </td>
                    <td className="p-3 font-extrabold text-cyan-300 text-sm">
                      {p.totalQty}
                    </td>
                    <td className="p-3 text-gray-300">
                      {p.unitCost.toLocaleString('ar-EG')} {currencySymbol}
                    </td>
                    <td className="p-3 font-black text-rose-300 text-sm">
                      {p.totalCost.toLocaleString('ar-EG')} {currencySymbol}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500">
                    لا توجد بضاعة مسحوبة لأوردرات الصيانة في هذا الشهر
                  </td>
                </tr>
              )}
            </tbody>
            {aggregatedPartsList.length > 0 && (
              <tfoot className="bg-[#181b2a] border-t-2 border-[#2a2d42] font-bold text-white">
                <tr>
                  <td className="p-3 text-left font-black text-cyan-400">
                    إجمالي البضاعة المسحوبة بالكامل:
                  </td>
                  <td className="p-3 text-cyan-300 font-black text-sm">{totalPartsQty} قطعة</td>
                  <td className="p-3"></td>
                  <td className="p-3 text-rose-300 font-black text-base">
                    {totalPartsCost.toLocaleString('ar-EG')} {currencySymbol}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
