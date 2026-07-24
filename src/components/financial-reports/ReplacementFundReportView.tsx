import React, { useState } from 'react';
import {
  Building2,
  TrendingUp,
  ArrowDownRight,
  ArrowUpLeft,
  AlertCircle,
  ShieldAlert,
  Sliders,
  FileText,
  Clock
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { ReplacementFundEntry, UserRole } from '../../types';
import { calculateReplacementFundReportData } from '../../lib/finalReportsEngine';

interface ReplacementFundReportViewProps {
  fundEntries: ReplacementFundEntry[];
  userRole?: UserRole;
  currencySymbol?: string;
}

export default function ReplacementFundReportView({
  fundEntries,
  userRole = 'OWNER',
  currencySymbol = 'ج.م.'
}: ReplacementFundReportViewProps) {
  const [threshold, setThreshold] = useState<number>(1000);

  const data = calculateReplacementFundReportData(fundEntries, threshold);

  // Prepare chart data chronologically
  const sortedEntries = [...fundEntries].sort((a, b) =>
    (a.createdAt || '').localeCompare(b.createdAt || '')
  );

  let runBal = 0;
  const chartData = sortedEntries.map((e, idx) => {
    runBal += Number(e.signedAmount || 0);
    return {
      index: idx + 1,
      date: (e.createdAt || '').slice(0, 10),
      الرصيد: runBal,
      المبلغ: Number(e.signedAmount || 0)
    };
  });

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-[#11131e] border border-[#2a2d42] p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">تقرير صندوق تعويض البضاعة المخصصة للعملاء</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              متابعة الإيداعات الآلية من صيانات العملاء (CU) ومسحوبات شراء قطع الغيار البديلة
            </p>
          </div>
        </div>

        {/* OWNER Threshold Setting */}
        {userRole === 'OWNER' && (
          <div className="flex items-center gap-2 bg-[#181b2a] border border-[#2a2d42] px-3 py-2 rounded-xl text-xs">
            <Sliders className="w-4 h-4 text-purple-400" />
            <span className="text-gray-400">حد التنبيه بالانخفاض:</span>
            <input
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value) || 0)}
              className="w-20 bg-[#11131e] text-white border border-[#2a2d42] rounded-lg px-2 py-1 outline-none font-bold text-center"
            />
            <span className="text-gray-400">{currencySymbol}</span>
          </div>
        )}
      </div>

      {/* Alert Banners */}
      {data.hasNegativeWithdrawal && (
        <div className="bg-rose-950/40 border border-rose-500/50 p-4 rounded-xl flex items-center gap-3 text-rose-300 text-xs">
          <ShieldAlert className="w-5 h-5 text-rose-400 flex-shrink-0" />
          <div>
            <span className="font-bold">تحذير حرج: رصيد صندوق التعويض بالسالب!</span>
            <p className="mt-0.5 text-rose-200">
              تجاوزت المسحوبات إجمالي الإيداعات المتوفرة. يرجى مراجعة عمليات الشراء أو إيداع مبالغ تعويضية.
            </p>
          </div>
        </div>
      )}

      {data.isBelowThreshold && !data.hasNegativeWithdrawal && (
        <div className="bg-amber-950/40 border border-amber-500/40 p-4 rounded-xl flex items-center gap-3 text-amber-300 text-xs">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <div>
            <span className="font-bold">تنبيه انخفاض الرصيد:</span>
            <p className="mt-0.5 text-amber-200">
              رصيد صندوق التعويض الحالي ({data.currentBalance} {currencySymbol}) أقل من حد التنبيه الآمن ({threshold} {currencySymbol}).
            </p>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#11131e] border border-[#2a2d42] p-4 rounded-2xl">
          <span className="text-xs text-gray-400">الرصيد الافتتاحي</span>
          <h3 className="text-xl font-bold text-gray-300 mt-2">
            {data.openingBalance.toLocaleString('ar-EG')} <span className="text-xs">{currencySymbol}</span>
          </h3>
          <p className="text-[10px] text-gray-500 mt-1">بداية النظام المحاسبي</p>
        </div>

        <div className="bg-[#11131e] border border-[#2a2d42] p-4 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">إجمالي الإيداعات (من CU)</span>
            <ArrowDownRight className="w-4 h-4 text-emerald-400" />
          </div>
          <h3 className="text-xl font-bold text-emerald-400 mt-2">
            {data.totalDeposits.toLocaleString('ar-EG')} <span className="text-xs">{currencySymbol}</span>
          </h3>
          <p className="text-[10px] text-gray-500 mt-1">إيداعات آلية ناتجة عن صيانة العملاء</p>
        </div>

        <div className="bg-[#11131e] border border-[#2a2d42] p-4 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">إجمالي المسحوبات (شراء بضاعة جديدة)</span>
            <ArrowUpLeft className="w-4 h-4 text-rose-400" />
          </div>
          <h3 className="text-xl font-bold text-rose-400 mt-2">
            {data.totalWithdrawals.toLocaleString('ar-EG')} <span className="text-xs">{currencySymbol}</span>
          </h3>
          <p className="text-[10px] text-gray-500 mt-1">تكاليف الشراء التعويضي</p>
        </div>

        <div className="bg-[#11131e] border border-[#2a2d42] p-4 rounded-2xl">
          <span className="text-xs text-purple-300 font-bold">الرصيد الصافي الحالي</span>
          <h3
            className={`text-2xl font-black mt-2 ${
              data.currentBalance < 0
                ? 'text-rose-400'
                : data.isBelowThreshold
                ? 'text-amber-400'
                : 'text-purple-400'
            }`}
          >
            {data.currentBalance.toLocaleString('ar-EG')} <span className="text-xs">{currencySymbol}</span>
          </h3>
          <p className="text-[10px] text-gray-400 mt-1">الرصيد المتاح لمشتروات التعويض</p>
        </div>
      </div>

      {/* Movement Area Chart */}
      <div className="bg-[#11131e] border border-[#2a2d42] p-6 rounded-2xl">
        <h3 className="text-sm font-bold text-white mb-1">تطور رصيد صندوق التعويض مع مرور الوقت</h3>
        <p className="text-xs text-gray-400 mb-4">مسار تغير الرصيد التراكمي مع كل عملية إيداع وسحب</p>

        <div className="w-full h-[280px] min-h-[280px]">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorFund" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} />
                <YAxis stroke="#9ca3af" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#161927', borderColor: '#2a2d42', color: '#f3f4f6' }} />
                <Area type="monotone" dataKey="الرصيد" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorFund)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex items-center justify-center border border-dashed border-[#2a2d42] rounded-xl text-gray-500 text-xs">
              لا توجد حركات مسجلة لصندوق التعويض
            </div>
          )}
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-[#11131e] border border-[#2a2d42] rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-[#2a2d42] flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-purple-400" />
            سجل حركات صندوق التعويض ({fundEntries.length} حركة)
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right text-gray-300">
            <thead className="bg-[#181b2a] text-gray-400 font-semibold border-b border-[#2a2d42]">
              <tr>
                <th className="p-3">التاريخ</th>
                <th className="p-3">نوع الحركة</th>
                <th className="p-3">المرجع</th>
                <th className="p-3">البيان</th>
                <th className="p-3">المستخدم</th>
                <th className="p-3">المبلغ الصافي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f2937]">
              {sortedEntries.length > 0 ? (
                sortedEntries.map((e) => (
                  <tr key={e.id} className="hover:bg-[#161927] transition">
                    <td className="p-3 whitespace-nowrap text-gray-400">{e.createdAt?.slice(0, 10)}</td>
                    <td className="p-3 font-semibold text-white">{e.transactionType}</td>
                    <td className="p-3 text-purple-400 font-mono">{e.referenceId || '-'}</td>
                    <td className="p-3 text-gray-300">{e.description || '-'}</td>
                    <td className="p-3 text-gray-400">{e.createdByUserId || 'النظام'}</td>
                    <td
                      className={`p-3 font-bold ${
                        Number(e.signedAmount || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {Number(e.signedAmount || 0) >= 0 ? `+${e.signedAmount}` : e.signedAmount} {currencySymbol}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-gray-500">
                    لا توجد حركات مسجلة بداخل الصندوق
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
