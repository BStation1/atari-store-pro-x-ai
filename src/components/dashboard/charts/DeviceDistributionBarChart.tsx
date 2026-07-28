/**
 * Executive Device Distribution Bar Chart Component (Phase 3UI.2C)
 * Recharts Bar Chart categorizing repairs by PS5, PS4, Xbox, Nintendo, Steam Deck, Other.
 * @license Apache-2.0
 */

import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid
} from 'recharts';
import { DeviceAnalyticsData } from '../../../lib/analytics';
import EmptyState from '../../common/EmptyState';
import { Gamepad2 } from 'lucide-react';

interface DeviceDistributionBarChartProps {
  data: DeviceAnalyticsData;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const item = payload[0].payload;
    return (
      <div className="bg-slate-900/95 border border-slate-700/80 p-2.5 rounded-xl shadow-xl text-right dir-rtl space-y-1 text-xs">
        <div className="font-bold text-white flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
          <span>{item.labelAr}</span>
        </div>
        <div className="text-slate-300 font-mono">
          الأجهزة المسجلة: <strong className="text-white">{item.count}</strong> ({item.percentage}%)
        </div>
      </div>
    );
  }
  return null;
};

export const DeviceDistributionBarChart: React.FC<DeviceDistributionBarChartProps> = ({ data }) => {
  if (!data.hasData || data.items.length === 0) {
    return (
      <EmptyState
        title="لا توجد أجهزة مسجلة"
        description="سيتم عرض توزيع الأجهزة هنا فور إضافة طلبات صيانة جديدة."
        icon={Gamepad2}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.items} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
            <XAxis dataKey="labelAr" stroke="#94a3b8" fontSize={11} tickLine={false} />
            <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="count" radius={[6, 6, 0, 0]}>
              {data.items.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Grid Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
        {data.items.map((cat) => (
          <div key={cat.categoryKey} className="p-2 bg-slate-950/60 border border-slate-800 rounded-xl text-center space-y-0.5">
            <span className="text-[10px] text-slate-400 font-bold block truncate">{cat.labelAr}</span>
            <div className="text-base font-extrabold text-white font-mono">{cat.count}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DeviceDistributionBarChart;
