/**
 * Profit Breakdown Component (Phase 3UI.2C)
 * Displays executive profit analysis (Repair Profit, Sales Profit, Expenses, Net Profit, Margin).
 * @license Apache-2.0
 */

import React from 'react';
import { ProfitAnalyticsData } from '../../../lib/analytics';
import { formatCurrencyArabic } from '../../../lib/analytics/analyticsDateUtils';
import EmptyState from '../../common/EmptyState';
import { Landmark, TrendingUp, ArrowDownRight, ArrowUpRight } from 'lucide-react';

interface ProfitBreakdownCardProps {
  data: ProfitAnalyticsData;
}

export const ProfitBreakdownCard: React.FC<ProfitBreakdownCardProps> = ({ data }) => {
  if (!data.hasData) {
    return (
      <EmptyState
        title="لا توجد بيانات أرباح للفترة المحددة"
        description="سيتم حساب الأرباح والمصروفات فور تنفيذ صيانة أو مبيعات."
        icon={Landmark}
      />
    );
  }

  const isPositiveNet = data.netProfit >= 0;

  return (
    <div className="space-y-4">
      {/* Net Profit Banner */}
      <div className={`p-4 rounded-xl border flex items-center justify-between transition-all duration-200 ${
        isPositiveNet
          ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-400'
          : 'bg-rose-950/30 border-rose-500/30 text-rose-400'
      }`}>
        <div className="space-y-1">
          <span className="text-xs font-bold text-slate-300 block">صافي الأرباح التشغيلية</span>
          <div className="text-2xl font-extrabold font-mono tracking-tight text-white">
            {formatCurrencyArabic(data.netProfit)}
          </div>
        </div>
        <div className="text-left space-y-1">
          <span className="text-[10px] uppercase font-mono text-slate-400 block">هامش الربح</span>
          <div className="inline-flex items-center gap-1 text-sm font-extrabold font-mono px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-800">
            {isPositiveNet ? <ArrowUpRight className="w-4 h-4 text-emerald-400" /> : <ArrowDownRight className="w-4 h-4 text-rose-400" />}
            {data.marginPercentage}%
          </div>
        </div>
      </div>

      {/* Breakdown Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Repair Profit */}
        <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
            <span>أرباح الصيانة</span>
            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
          </div>
          <div className="text-base font-extrabold text-white font-mono">
            {formatCurrencyArabic(data.repairProfit)}
          </div>
          <p className="text-[10px] text-slate-500 truncate">
            الإيراد: {formatCurrencyArabic(data.repairRevenue)} - قطع: {formatCurrencyArabic(data.sparePartsCost)}
          </p>
        </div>

        {/* Sales Profit */}
        <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
            <span>أرباح المبيعات</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          </div>
          <div className="text-base font-extrabold text-white font-mono">
            {formatCurrencyArabic(data.salesProfit)}
          </div>
          <p className="text-[10px] text-slate-500 truncate">
            المبيعات: {formatCurrencyArabic(data.salesRevenue)} - التكلفة: {formatCurrencyArabic(data.cogs)}
          </p>
        </div>

        {/* Operating Expenses */}
        <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
            <span>المصروفات</span>
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
          </div>
          <div className="text-base font-extrabold text-rose-400 font-mono">
            {formatCurrencyArabic(data.operatingExpenses)}
          </div>
          <p className="text-[10px] text-slate-500 truncate">
            المصروفات التشغيلية العامة
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProfitBreakdownCard;
