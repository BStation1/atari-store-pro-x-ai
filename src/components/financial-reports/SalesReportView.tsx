import React, { useState } from 'react';
import {
  FileText,
  Filter,
  Search,
  Printer,
  Download,
  Calendar,
  Layers,
  CreditCard,
  UserCheck,
  Building2,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { Customer, Invoice, UserRole } from '../../types';
import {
  SalesReportFilter,
  generateSalesReportRows,
  exportToCSV,
  openPrintableReportHTML,
  saveReportFiltersToSession,
  getReportFiltersFromSession
} from '../../lib/finalReportsEngine';

interface SalesReportViewProps {
  invoices: Invoice[];
  customers: Customer[];
  userRole?: UserRole;
  currencySymbol?: string;
  shopName?: string;
}

export default function SalesReportView({
  invoices,
  customers,
  userRole = 'OWNER',
  currencySymbol = 'ج.م.',
  shopName = 'Atari Store Pro X'
}: SalesReportViewProps) {
  // Restore filter settings from session storage if present
  const defaultFilters: SalesReportFilter = {
    dateFrom: '',
    dateTo: '',
    periodPreset: 'ALL',
    workType: 'ALL',
    customerId: '',
    userId: '',
    paymentMethod: 'ALL',
    invoiceStatus: 'ALL',
    stockOwnership: 'ALL'
  };

  const [filter, setFilter] = useState<SalesReportFilter>(() =>
    getReportFiltersFromSession('sales_report', defaultFilters)
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const handleFilterChange = (updates: Partial<SalesReportFilter>) => {
    const next = { ...filter, ...updates };
    setFilter(next);
    saveReportFiltersToSession('sales_report', next);
    setCurrentPage(1);
  };

  const handlePresetSelect = (preset: 'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'YEAR') => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    if (preset === 'TODAY') {
      handleFilterChange({ periodPreset: preset, dateFrom: todayStr, dateTo: todayStr });
    } else if (preset === 'WEEK') {
      const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
      handleFilterChange({ periodPreset: preset, dateFrom: weekAgo, dateTo: todayStr });
    } else if (preset === 'MONTH') {
      const monthStart = `${todayStr.slice(0, 7)}-01`;
      handleFilterChange({ periodPreset: preset, dateFrom: monthStart, dateTo: todayStr });
    } else if (preset === 'YEAR') {
      const yearStart = `${now.getFullYear()}-01-01`;
      handleFilterChange({ periodPreset: preset, dateFrom: yearStart, dateTo: todayStr });
    } else {
      handleFilterChange({ periodPreset: 'ALL', dateFrom: '', dateTo: '' });
    }
  };

  const { summary, rows } = generateSalesReportRows(invoices, filter);

  // Search query filter over calculated rows
  const searchedRows = rows.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.invoiceNumber.toLowerCase().includes(q) ||
      r.customerName.toLowerCase().includes(q) ||
      r.workType.toLowerCase().includes(q)
    );
  });

  // Pagination
  const totalPages = Math.ceil(searchedRows.length / pageSize) || 1;
  const paginatedRows = searchedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Export handlers
  const handlePrint = () => {
    const headers = [
      'رقم الفاتورة',
      'التاريخ',
      'العميل',
      'نوع الشغل',
      'الحالة',
      'الإيراد',
      'التكلفة COGS',
      'مجمل الربح',
      'أرباح أحمد',
      'أرباح عبده',
      'استرداد أحمد',
      'التزام عبده'
    ];

    const exportDataRows = searchedRows.map((r) => [
      r.invoiceNumber,
      r.date,
      r.customerName,
      r.workType,
      r.status,
      `${r.revenue} ${currencySymbol}`,
      `${r.cogs} ${currencySymbol}`,
      `${r.grossProfit} ${currencySymbol}`,
      `${r.ahmedProfitShare} ${currencySymbol}`,
      `${r.abdouProfitShare} ${currencySymbol}`,
      `${r.ahmedCogsRecovery} ${currencySymbol}`,
      `${r.abdouSettlementObligation} ${currencySymbol}`
    ]);

    // Append summary row
    exportDataRows.push([
      'الإجمالي العام',
      '-',
      '-',
      '-',
      '-',
      `${summary.revenue} ${currencySymbol}`,
      `${summary.cogs} ${currencySymbol}`,
      `${summary.grossProfit} ${currencySymbol}`,
      `${summary.ahmedProfitShare} ${currencySymbol}`,
      `${summary.abdouProfitShare} ${currencySymbol}`,
      `${summary.ahmedCogsRecovery} ${currencySymbol}`,
      `${summary.abdouSettlementObligation} ${currencySymbol}`
    ]);

    openPrintableReportHTML(
      'تقرير المبيعات والأرباح التفصيلي',
      headers,
      exportDataRows,
      shopName,
      filter.dateFrom || filter.dateTo ? `${filter.dateFrom || 'البداية'} إلى ${filter.dateTo || 'الآن'}` : 'جميع الفترات'
    );
  };

  const handleExportCSV = () => {
    const headers = [
      'Invoice Number',
      'Date',
      'Customer',
      'Work Type',
      'Status',
      'Revenue',
      'COGS',
      'Gross Profit',
      'Ahmed Profit',
      'Abdo Profit',
      'Ahmed COGS Recovery',
      'Abdo Obligation'
    ];

    const exportDataRows = searchedRows.map((r) => [
      r.invoiceNumber,
      r.date,
      r.customerName,
      r.workType,
      r.status,
      r.revenue,
      r.cogs,
      r.grossProfit,
      r.ahmedProfitShare,
      r.abdouProfitShare,
      r.ahmedCogsRecovery,
      r.abdouSettlementObligation
    ]);

    exportDataRows.push([
      'TOTAL',
      '-',
      '-',
      '-',
      '-',
      summary.revenue,
      summary.cogs,
      summary.grossProfit,
      summary.ahmedProfitShare,
      summary.abdouProfitShare,
      summary.ahmedCogsRecovery,
      summary.abdouSettlementObligation
    ]);

    exportToCSV('sales_profit_report', headers, exportDataRows, shopName);
  };

  return (
    <div className="space-y-6">
      {/* Top Controls & Filter Box */}
      <div className="bg-[#11131e] border border-[#2a2d42] p-5 rounded-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <Filter className="w-4 h-4 text-cyan-400" />
            <span>فلترة خيارات المبيعات والأرباح المحاسبية</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 bg-[#181b2a] hover:bg-[#202538] text-gray-200 border border-[#2a2d42] rounded-xl text-xs font-semibold flex items-center gap-2 transition"
            >
              <Printer className="w-4 h-4 text-cyan-400" />
              طباعة / PDF
            </button>

            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 bg-cyan-500 hover:bg-cyan-600 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-lg shadow-cyan-500/20"
            >
              <Download className="w-4 h-4" />
              تصدير Excel / CSV
            </button>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#1f2937]">
          <span className="text-xs text-gray-400 font-medium ml-2">الفترات السريعة:</span>
          {[
            { id: 'ALL', label: 'الكل' },
            { id: 'TODAY', label: 'اليوم' },
            { id: 'WEEK', label: 'آخر أسبوع' },
            { id: 'MONTH', label: 'الشهر الحالي' },
            { id: 'YEAR', label: 'السنة الحالية' }
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => handlePresetSelect(p.id as any)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                filter.periodPreset === p.id
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'bg-[#181b2a] text-gray-400 hover:text-white border border-[#2a2d42]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Detailed Input Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {/* Work Type Filter */}
          <div className="space-y-1">
            <label className="text-[11px] text-gray-400">نوع الشغل المحاسبي</label>
            <select
              value={filter.workType}
              onChange={(e) => handleFilterChange({ workType: e.target.value as any })}
              className="w-full bg-[#181b2a] text-white border border-[#2a2d42] rounded-xl p-2 text-xs outline-none"
            >
              <option value="ALL">جميع أنواع الشغل</option>
              <option value="CUSTOMER_WORK">صيانة عملاء (CUSTOMER_WORK)</option>
              <option value="AHMED_WORK">شغل خاص أحمد (AHMED_WORK)</option>
              <option value="ABDO_WORK">شغل خاص عبده (ABDO_WORK)</option>
            </select>
          </div>

          {/* Date From */}
          <div className="space-y-1">
            <label className="text-[11px] text-gray-400">من تاريخ</label>
            <input
              type="date"
              value={filter.dateFrom || ''}
              onChange={(e) => handleFilterChange({ dateFrom: e.target.value, periodPreset: 'CUSTOM' })}
              className="w-full bg-[#181b2a] text-white border border-[#2a2d42] rounded-xl p-2 text-xs outline-none"
            />
          </div>

          {/* Date To */}
          <div className="space-y-1">
            <label className="text-[11px] text-gray-400">إلى تاريخ</label>
            <input
              type="date"
              value={filter.dateTo || ''}
              onChange={(e) => handleFilterChange({ dateTo: e.target.value, periodPreset: 'CUSTOM' })}
              className="w-full bg-[#181b2a] text-white border border-[#2a2d42] rounded-xl p-2 text-xs outline-none"
            />
          </div>

          {/* Payment Method */}
          <div className="space-y-1">
            <label className="text-[11px] text-gray-400">طريقة الدفع</label>
            <select
              value={filter.paymentMethod}
              onChange={(e) => handleFilterChange({ paymentMethod: e.target.value })}
              className="w-full bg-[#181b2a] text-white border border-[#2a2d42] rounded-xl p-2 text-xs outline-none"
            >
              <option value="ALL">جميع الطرق</option>
              <option value="CASH">كاش (نقدي)</option>
              <option value="VISA">فيزا / بنك</option>
              <option value="TRANSFER">تحويل فودافون / إنستا</option>
              <option value="DEFERRED">آجل / متبقي</option>
            </select>
          </div>
        </div>
      </div>

      {/* Search & Results Table Bar */}
      <div className="bg-[#11131e] border border-[#2a2d42] rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-[#2a2d42] flex flex-wrap items-center justify-between gap-4">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 text-gray-400 absolute right-3 top-2.5" />
            <input
              type="text"
              placeholder="بحث برقم الفاتورة أو اسم العميل..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#181b2a] text-white border border-[#2a2d42] rounded-xl pr-9 pl-3 py-1.5 text-xs outline-none"
            />
          </div>

          <div className="text-xs text-gray-400">
            إجمالي النتائج: <span className="text-cyan-400 font-bold">{searchedRows.length}</span> فاتورة
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right text-gray-300">
            <thead className="bg-[#181b2a] text-gray-400 font-semibold border-b border-[#2a2d42]">
              <tr>
                <th className="p-3">الفاتورة</th>
                <th className="p-3">التاريخ</th>
                <th className="p-3">العميل</th>
                <th className="p-3">نوع الشغل</th>
                <th className="p-3">الإيراد</th>
                <th className="p-3">COGS</th>
                <th className="p-3">مجمل الربح</th>
                {userRole === 'OWNER' && (
                  <>
                    <th className="p-3">أرباح أحمد</th>
                    <th className="p-3">أرباح عبده</th>
                    <th className="p-3">استرداد أحمد</th>
                    <th className="p-3">التزام عبده</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f2937]">
              {paginatedRows.length > 0 ? (
                paginatedRows.map((r) => (
                  <tr key={r.invoiceId} className="hover:bg-[#161927] transition">
                    <td className="p-3 font-mono font-bold text-cyan-400">{r.invoiceNumber}</td>
                    <td className="p-3 whitespace-nowrap text-gray-400">{r.date}</td>
                    <td className="p-3 font-medium text-white">{r.customerName}</td>
                    <td className="p-3 text-gray-300">
                      <span className="px-2 py-0.5 rounded-md bg-[#181b2a] border border-[#2a2d42] text-[10px]">
                        {r.workType}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-emerald-400">
                      {r.revenue.toLocaleString('ar-EG')} {currencySymbol}
                    </td>
                    <td className="p-3 text-amber-400">{r.cogs.toLocaleString('ar-EG')}</td>
                    <td className="p-3 font-bold text-cyan-400">{r.grossProfit.toLocaleString('ar-EG')}</td>
                    {userRole === 'OWNER' && (
                      <>
                        <td className="p-3 text-emerald-400">{r.ahmedProfitShare}</td>
                        <td className="p-3 text-cyan-400">{r.abdouProfitShare}</td>
                        <td className="p-3 text-indigo-400">{r.ahmedCogsRecovery}</td>
                        <td className="p-3 text-rose-400">{r.abdouSettlementObligation}</td>
                      </>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-gray-500">
                    لا توجد فواتير مطابقة لخيارات الفلترة المحددة
                  </td>
                </tr>
              )}
            </tbody>

            {/* GRAND TOTAL SUMMARY ROW */}
            <tfoot className="bg-[#181b2a] font-bold text-white border-t-2 border-cyan-500/40">
              <tr>
                <td className="p-3 text-cyan-400">الإجمالي العام</td>
                <td className="p-3">-</td>
                <td className="p-3">-</td>
                <td className="p-3">-</td>
                <td className="p-3 text-emerald-400">
                  {summary.revenue.toLocaleString('ar-EG')} {currencySymbol}
                </td>
                <td className="p-3 text-amber-400">{summary.cogs.toLocaleString('ar-EG')}</td>
                <td className="p-3 text-cyan-400">{summary.grossProfit.toLocaleString('ar-EG')}</td>
                {userRole === 'OWNER' && (
                  <>
                    <td className="p-3 text-emerald-400">{summary.ahmedProfitShare}</td>
                    <td className="p-3 text-cyan-400">{summary.abdouProfitShare}</td>
                    <td className="p-3 text-indigo-400">{summary.ahmedCogsRecovery}</td>
                    <td className="p-3 text-rose-400">{summary.abdouSettlementObligation}</td>
                  </>
                )}
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-[#2a2d42] flex items-center justify-between text-xs text-gray-400">
            <div>
              الصفحة <span className="text-white font-bold">{currentPage}</span> من <span className="text-white font-bold">{totalPages}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 bg-[#181b2a] border border-[#2a2d42] rounded-lg disabled:opacity-40 text-gray-300"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 bg-[#181b2a] border border-[#2a2d42] rounded-lg disabled:opacity-40 text-gray-300"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
