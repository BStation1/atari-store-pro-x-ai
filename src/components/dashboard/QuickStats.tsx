/**
 * QuickStats UI Component (Phase 3UI.0 - Premium Design System)
 * Displays simple expandable operational indicators.
 * @license Apache-2.0
 */

import React from 'react';
import { QuickStatItem } from '../../lib/dashboard';
import { Users, Package, FileText, CheckCircle2 } from 'lucide-react';
import AppCard from '../common/AppCard';

export interface QuickStatsProps {
  stats: QuickStatItem[];
}

export const QuickStats: React.FC<QuickStatsProps> = ({ stats }) => {
  const getIcon = (category: string) => {
    switch (category) {
      case 'customers':
        return <Users className="w-4 h-4 text-indigo-400" />;
      case 'inventory':
        return <Package className="w-4 h-4 text-amber-400" />;
      case 'finance':
        return <FileText className="w-4 h-4 text-cyan-400" />;
      default:
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    }
  };

  return (
    <AppCard
      header={
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <span>مؤشرات سريعة</span>
          <span className="text-xs font-mono text-slate-500 font-normal">(Quick Stats)</span>
        </h3>
      }
      padding="md"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.id}
            className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl space-y-1.5"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">{stat.labelAr}</span>
              {getIcon(stat.category)}
            </div>
            <div className="text-xl font-bold font-mono text-white">{stat.value}</div>
            {stat.subtext && (
              <div className="text-[10px] text-slate-500 font-mono">{stat.subtext}</div>
            )}
          </div>
        ))}
      </div>
    </AppCard>
  );
};

export default QuickStats;
