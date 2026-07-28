/**
 * Executive Technician Performance Table Component (Phase 3UI.2C)
 * Displays per-technician metrics: Total assigned, Completed, Avg Duration, Profit, Completion Rate.
 * @license Apache-2.0
 */

import React from 'react';
import { TechnicianAnalyticsData } from '../../../lib/analytics';
import EmptyState from '../../common/EmptyState';
import { Users, UserCheck, Clock, Award } from 'lucide-react';

interface TechnicianPerformanceTableProps {
  data: TechnicianAnalyticsData;
}

export const TechnicianPerformanceTable: React.FC<TechnicianPerformanceTableProps> = ({ data }) => {
  if (!data.hasData || data.technicians.length === 0) {
    return (
      <EmptyState
        title="لا توجد بيانات فنيين مسجلة"
        description="سيتم احتساب مؤشرات أداء الفنيين عند إسناد وإنجاز أجهزة الصيانة."
        icon={Users}
      />
    );
  }

  return (
    <div className="overflow-x-auto scrollbar-none">
      <table className="w-full text-right text-xs">
        <thead>
          <tr className="border-b border-slate-800 text-slate-400 font-extrabold uppercase bg-slate-950/60">
            <th className="py-3 px-3">الفني</th>
            <th className="py-3 px-3 text-center">الأجهزة المسندة</th>
            <th className="py-3 px-3 text-center">المكتملة</th>
            <th className="py-3 px-3 text-center">متوسط الزمن</th>
            <th className="py-3 px-3 text-center">نسبة الإنجاز</th>
            <th className="py-3 px-3 text-left">إجمالي الأرباح</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60 font-medium">
          {data.technicians.map((tech) => (
            <tr key={tech.technicianId} className="hover:bg-slate-900/50 transition-colors">
              <td className="py-3 px-3 font-bold text-white flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-mono text-xs shrink-0">
                  {tech.technicianName.charAt(0)}
                </div>
                <span className="truncate">{tech.technicianName}</span>
              </td>
              <td className="py-3 px-3 text-center font-mono font-bold text-slate-300">
                {tech.totalAssigned}
              </td>
              <td className="py-3 px-3 text-center font-mono font-bold text-emerald-400">
                {tech.completedCount}
              </td>
              <td className="py-3 px-3 text-center font-mono text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3 text-cyan-400" />
                  {tech.formattedAvgDuration}
                </span>
              </td>
              <td className="py-3 px-3 text-center">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full"
                      style={{ width: `${Math.min(100, tech.completionRate)}%` }}
                    />
                  </div>
                  <span className="font-mono text-[11px] font-bold text-slate-300">{tech.completionRate}%</span>
                </div>
              </td>
              <td className="py-3 px-3 text-left font-mono font-extrabold text-indigo-400">
                {tech.formattedProfit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TechnicianPerformanceTable;
