/**
 * Executive Revenue Time-Series Chart Component (Phase 3UI.2C)
 * Recharts powered Revenue Chart supporting RTL, Dark Mode, Responsive Container & Empty State.
 * @license Apache-2.0
 */

import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { RevenueAnalyticsData } from '../../../lib/analytics';
import { formatCurrencyArabic } from '../../../lib/analytics/analyticsDateUtils';
import EmptyState from '../../common/EmptyState';
import { TrendingUp, DollarSign } from 'lucide-react';

interface RevenueChartProps {
  data: RevenueAnalyticsData;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900/95 border border-slate-700/80 p-3 rounded-xl shadow-2xl dir-rtl text-right min-w-[160px] space-y-1.5">
        <p className="text-xs font-bold text-slate-300 border-b border-slate-800 pb-1">{data.label || label}</p>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between items-center gap-3 text-emerald-400">
            <span>إيرادات المبيعات:</span>
            <strong className="font-mono">{formatCurrencyArabic(data.invoiceRevenue)}</strong>
          </div>
          <div className="flex justify-between items-center gap-3 text-indigo-400">
            <span>إيرادات الصيانة:</span>
            <strong className="font-mono">{formatCurrencyArabic(data.repairRevenue)}</strong>
          </div>
          <div className="flex justify-between items-center gap-3 text-white font-extrabold pt-1 border-t border-slate-800">
            <span>الإجمالي:</span>
            <strong className="font-mono">{formatCurrencyArabic(data.totalRevenue)}</strong>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export const RevenueChart: React.FC<RevenueChartProps> = ({ data }) => {
  if (!data.hasData || data.timeSeries.length === 0) {
    return (
      <EmptyState
        title="لا توجد بيانات إيرادات للفترة المحددة"
        description="سيتم عرض تحليل الإيرادات هنا فور تسجيل عمليات بيع أو صيانة جديدة."
        icon={<DollarSign className="w-8 h-8 text-slate-500" />}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Stat Bar */}
      <div className="flex items-center justify-between bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
        <div>
          <span className="text-xs font-medium text-slate-400 block">إجمالي الإيرادات ({data.periodLabel})</span>
          <span className="text-xl font-extrabold text-white font-mono">{formatCurrencyArabic(data.totalRevenue)}</span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
            <span className="text-slate-300 font-bold">المبيعات: {formatCurrencyArabic(data.invoiceRevenueTotal)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-indigo-500"></span>
            <span className="text-slate-300 font-bold">الصيانة: {formatCurrencyArabic(data.repairRevenueTotal)}</span>
          </div>
        </div>
      </div>

      {/* Recharts Area */}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.timeSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorInvoice" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
            <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} />
            <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="totalRevenue"
              name="الإجمالي"
              stroke="#6366f1"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#colorTotal)"
            />
            <Area
              type="monotone"
              dataKey="invoiceRevenue"
              name="المبيعات"
              stroke="#10b981"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorInvoice)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default RevenueChart;
