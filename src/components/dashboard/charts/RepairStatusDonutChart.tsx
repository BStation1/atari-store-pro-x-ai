/**
 * Executive Repair Status Donut Chart Component (Phase 3UI.2C)
 * Recharts PieChart (Donut) for repair order status breakdown with UNKNOWN fallback.
 * @license Apache-2.0
 */

import React from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip
} from 'recharts';
import { RepairStatusAnalyticsData } from '../../../lib/analytics';
import EmptyState from '../../common/EmptyState';
import { Wrench } from 'lucide-react';

interface RepairStatusDonutChartProps {
  data: RepairStatusAnalyticsData;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const item = payload[0].payload;
    return (
      <div className="bg-slate-900/95 border border-slate-700/80 p-2.5 rounded-xl shadow-xl text-right dir-rtl space-y-1 text-xs">
        <div className="flex items-center gap-2 font-bold text-white">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
          <span>{item.labelAr}</span>
        </div>
        <div className="text-slate-300 font-mono">
          العدد: <strong className="text-white">{item.count}</strong> ({item.percentage}%)
        </div>
      </div>
    );
  }
  return null;
};

export const RepairStatusDonutChart: React.FC<RepairStatusDonutChartProps> = ({ data }) => {
  if (!data.hasData || data.items.length === 0) {
    return (
      <EmptyState
        title="لا توجد بيانات حالات صيانة"
        description="سيتم عرض التوزيع البياني هنا عند إدخال طلبات صيانة."
        icon={<Wrench className="w-8 h-8 text-slate-500" />}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
      {/* Donut Chart Canvas */}
      <div className="h-56 w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data.items}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={3}
              dataKey="count"
              nameKey="labelAr"
            >
              {data.items.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke="#0f172a" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-extrabold text-white font-mono">{data.totalOrders}</span>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">طلب صيانة</span>
        </div>
      </div>

      {/* Status Legend */}
      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
        {data.items.map((item) => (
          <div
            key={item.statusKey}
            className="flex items-center justify-between p-2 rounded-lg bg-slate-950/50 border border-slate-800/80 text-xs hover:bg-slate-900/60 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
              <span className="font-bold text-slate-300">{item.labelAr}</span>
            </div>
            <div className="flex items-center gap-2 font-mono">
              <span className="text-slate-400 text-[11px]">({item.percentage}%)</span>
              <span className="font-extrabold text-white bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                {item.count}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RepairStatusDonutChart;
