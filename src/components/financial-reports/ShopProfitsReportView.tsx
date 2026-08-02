import React, { useState } from 'react';
import {
  Building2,
  Calendar,
  FileText,
  Printer,
  Download,
  TrendingUp,
  DollarSign,
  User,
  Users
} from 'lucide-react';
import { RepairOrder, WorkOwnershipType } from '../../types';
import { roundMoney, formatDateISO } from '../../lib/finalReportsEngine';
import { buildAccountingSummaryV2 } from '../../lib/accountingEngineV2';
import { useInvoices, useInventoryMovements, useRepairPartUsages } from '../../hooks/useData';

interface ShopProfitsReportViewProps {
  orders: RepairOrder[];
  currencySymbol?: string;
}

export default function ShopProfitsReportView({
  orders,
  currencySymbol = 'ج.م.'
}: ShopProfitsReportViewProps) {
  const { invoices } = useInvoices();
  const { movements } = useInventoryMovements();
  const { partUsages } = useRepairPartUsages();
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const accountingSummary = buildAccountingSummaryV2({
    orders,
    invoices,
    movements,
    usages: partUsages
  });

  const rows = accountingSummary.rows
    .filter(row => row.party === 'SHOP')
    .filter(row => {
      const orderDate = formatDateISO(row.date);
      if (dateFrom && orderDate < dateFrom) return false;
      if (dateTo && orderDate > dateTo) return false;
      return true;
    })
    .map(row => ({
      id: row.orderId, orderNum: row.orderNumber, customer: row.customerName, date: formatDateISO(row.date),
      status: row.sourceOrder.status, totalInvoice: row.revenue, partsCost: row.purchaseCost,
      netProfit: row.netProfit, ahmedShare: row.ahmedShare, abdoShare: row.abdoShare
    }));

  // Totals
  const totalInvoiceSum = roundMoney(rows.reduce((s, r) => s + r.totalInvoice, 0));
  const totalPartsCostSum = roundMoney(rows.reduce((s, r) => s + r.partsCost, 0));
  const totalNetProfitSum = roundMoney(rows.reduce((s, r) => s + r.netProfit, 0));
  const totalAhmedShareSum = roundMoney(rows.reduce((s, r) => s + r.ahmedShare, 0));
  const totalAbdoShareSum = roundMoney(rows.reduce((s, r) => s + r.abdoShare, 0));

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ['رقم الأوردر', 'العميل', 'التاريخ', 'إجمالي الفاتورة', 'تكلفة قطع الغيار', 'صافي الربح', 'نصيب أحمد (50%)', 'نصيب عبده (50%)'];
    const csvRows = rows.map(r => [
      r.orderNum,
      `"${r.customer}"`,
      r.date,
      r.totalInvoice,
      r.partsCost,
      r.netProfit,
      r.ahmedShare,
      r.abdoShare
    ]);
    csvRows.push(['الإجمالي العام', '', '', totalInvoiceSum, totalPartsCostSum, totalNetProfitSum, totalAhmedShareSum, totalAbdoShareSum]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...csvRows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `shop_profits_report_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header & Date Filter Bar */}
      <div className="bg-[#11131e] border border-[#2a2d42] p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
          <Building2 className="w-5 h-5" />
          <span>تقرير أرباح المحل (أعمال الشراكة - شغل المحل)</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#181b2a] border border-[#2a2d42] px-3 py-1.5 rounded-xl text-xs">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="text-gray-400">من:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-transparent text-white outline-none"
            />
            <span className="text-gray-400">إلى:</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-transparent text-white outline-none"
            />
          </div>

          {(dateFrom || dateTo) && (
            <button
              onClick={() => {
                setDateFrom('');
                setDateTo('');
              }}
              className="px-3 py-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-xl text-xs font-semibold"
            >
              إعادة ضبط
            </button>
          )}

          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            تصدير CSV
          </button>

          <button
            onClick={handlePrint}
            className="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            طباعة
          </button>
        </div>
      </div>

      {/* Summary Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-[#11131e] border border-[#2a2d42] p-4 rounded-xl">
          <span className="text-xs text-gray-400 font-semibold block">إجمالي إيراد فواتير المحل</span>
          <h3 className="text-xl font-bold text-white mt-2">
            {totalInvoiceSum.toLocaleString('ar-EG')} <span className="text-xs text-gray-400">{currencySymbol}</span>
          </h3>
          <p className="text-[10px] text-gray-500 mt-1">مجموع إجمالي أسعار شغل المحل</p>
        </div>

        <div className="bg-[#11131e] border border-[#2a2d42] p-4 rounded-xl">
          <span className="text-xs text-gray-400 font-semibold block">تكلفة قطع الغيار المسحوبة</span>
          <h3 className="text-xl font-bold text-rose-400 mt-2">
            {totalPartsCostSum.toLocaleString('ar-EG')} <span className="text-xs text-gray-400">{currencySymbol}</span>
          </h3>
          <p className="text-[10px] text-gray-500 mt-1">تُخصم لحساب صافي ربح المحل</p>
        </div>

        <div className="bg-[#11131e] border border-cyan-500/30 p-4 rounded-xl bg-cyan-950/20">
          <span className="text-xs text-cyan-300 font-bold block">صافي ربح المحل (الصافي)</span>
          <h3 className="text-2xl font-black text-cyan-300 mt-2">
            {totalNetProfitSum.toLocaleString('ar-EG')} <span className="text-xs text-cyan-400">{currencySymbol}</span>
          </h3>
          <p className="text-[10px] text-cyan-400/80 mt-1">إجمالي الفاتورة - تكلفة قطع الغيار</p>
        </div>

        <div className="bg-[#11131e] border border-indigo-500/30 p-4 rounded-xl">
          <div className="flex items-center gap-1 text-indigo-400 text-xs font-bold mb-1">
            <User className="w-3.5 h-3.5" />
            <span>نصيب أحمد (50%)</span>
          </div>
          <h3 className="text-xl font-extrabold text-indigo-300">
            {totalAhmedShareSum.toLocaleString('ar-EG')} <span className="text-xs text-gray-400">{currencySymbol}</span>
          </h3>
          <p className="text-[10px] text-gray-500 mt-1">أرباح شراكة أوتوماتيكية</p>
        </div>

        <div className="bg-[#11131e] border border-emerald-500/30 p-4 rounded-xl">
          <div className="flex items-center gap-1 text-emerald-400 text-xs font-bold mb-1">
            <Users className="w-3.5 h-3.5" />
            <span>نصيب عبده (50%)</span>
          </div>
          <h3 className="text-xl font-extrabold text-emerald-300">
            {totalAbdoShareSum.toLocaleString('ar-EG')} <span className="text-xs text-gray-400">{currencySymbol}</span>
          </h3>
          <p className="text-[10px] text-gray-500 mt-1">أرباح شراكة أوتوماتيكية</p>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-[#11131e] border border-[#2a2d42] rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-[#2a2d42] flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-400" />
            بيان أوامر صيانة شغل المحل ({rows.length} أمر صيانة)
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right text-gray-300">
            <thead className="bg-[#181b2a] text-gray-400 font-semibold border-b border-[#2a2d42]">
              <tr>
                <th className="p-3">رقم الأوردر</th>
                <th className="p-3">العميل</th>
                <th className="p-3">التاريخ</th>
                <th className="p-3">إجمالي الفاتورة</th>
                <th className="p-3">تكلفة قطع الغيار</th>
                <th className="p-3">صافي الربح</th>
                <th className="p-3 text-indigo-400">نصيب أحمد (50%)</th>
                <th className="p-3 text-emerald-400">نصيب عبده (50%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f2937]">
              {rows.length > 0 ? (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-[#161927] transition">
                    <td className="p-3 font-mono font-bold text-cyan-400">{r.orderNum}</td>
                    <td className="p-3 font-semibold text-white">{r.customer}</td>
                    <td className="p-3 text-gray-400 whitespace-nowrap">{r.date}</td>
                    <td className="p-3 font-bold text-white">{r.totalInvoice.toLocaleString('ar-EG')} {currencySymbol}</td>
                    <td className="p-3 font-semibold text-rose-400">{r.partsCost.toLocaleString('ar-EG')} {currencySymbol}</td>
                    <td className="p-3 font-extrabold text-cyan-300">{r.netProfit.toLocaleString('ar-EG')} {currencySymbol}</td>
                    <td className="p-3 font-bold text-indigo-300">{r.ahmedShare.toLocaleString('ar-EG')} {currencySymbol}</td>
                    <td className="p-3 font-bold text-emerald-300">{r.abdoShare.toLocaleString('ar-EG')} {currencySymbol}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    لا توجد أوامر صيانة مسجلة كـ "شغل المحل" في هذه الفترة
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="bg-[#181b2a] border-t-2 border-[#2a2d42] font-bold text-white">
                <tr>
                  <td colSpan={3} className="p-3 text-left font-black text-cyan-400">الإجمالي العام:</td>
                  <td className="p-3 text-white text-sm">{totalInvoiceSum.toLocaleString('ar-EG')} {currencySymbol}</td>
                  <td className="p-3 text-rose-400 text-sm">{totalPartsCostSum.toLocaleString('ar-EG')} {currencySymbol}</td>
                  <td className="p-3 text-cyan-300 text-base font-black">{totalNetProfitSum.toLocaleString('ar-EG')} {currencySymbol}</td>
                  <td className="p-3 text-indigo-300 text-sm">{totalAhmedShareSum.toLocaleString('ar-EG')} {currencySymbol}</td>
                  <td className="p-3 text-emerald-300 text-sm">{totalAbdoShareSum.toLocaleString('ar-EG')} {currencySymbol}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
