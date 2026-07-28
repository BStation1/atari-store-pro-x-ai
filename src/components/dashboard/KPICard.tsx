/**
 * KPICard UI Component (Phase 3UI.0 - Premium Design System)
 * Display component for individual KPI metric with Data Quality Badge and status indicator.
 * Rendering only - no calculations modified.
 * @license Apache-2.0
 */

import React from 'react';
import { KPIItem } from '../../lib/dashboard';
import AppCard from '../common/AppCard';
import DataQualityBadge from '../common/DataQualityBadge';

export interface KPICardProps {
  kpi: KPIItem;
  icon: React.ReactNode;
  accentColor?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'cyan' | 'slate';
}

export const KPICard: React.FC<KPICardProps> = ({
  kpi,
  icon,
  accentColor = 'indigo'
}) => {
  const colorStyles = {
    indigo: 'border-indigo-500/30 bg-indigo-950/40 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-400/50',
    emerald: 'border-emerald-500/30 bg-emerald-950/40 text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white group-hover:border-emerald-400/50',
    amber: 'border-amber-500/30 bg-amber-950/40 text-amber-400 group-hover:bg-amber-600 group-hover:text-white group-hover:border-amber-400/50',
    rose: 'border-rose-500/30 bg-rose-950/40 text-rose-400 group-hover:bg-rose-600 group-hover:text-white group-hover:border-rose-400/50',
    cyan: 'border-cyan-500/30 bg-cyan-950/40 text-cyan-400 group-hover:bg-cyan-600 group-hover:text-white group-hover:border-cyan-400/50',
    slate: 'border-slate-800 bg-slate-900 text-slate-400 group-hover:bg-slate-800 group-hover:text-white'
  }[accentColor];

  return (
    <AppCard
      hoverable
      padding="md"
      className="group flex flex-col justify-between space-y-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-950/40"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <span className="text-xs font-bold text-slate-200 block truncate">{kpi.titleAr}</span>
          <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-mono truncate">
            {kpi.titleEn}
          </span>
        </div>
        <div className={`p-2.5 rounded-xl border shrink-0 transition-colors duration-200 ${colorStyles}`}>
          {icon}
        </div>
      </div>

      <div className="pt-2 space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-2xl lg:text-3xl font-extrabold text-white font-mono tracking-tight truncate">
            {kpi.formattedValue}
          </div>
          <DataQualityBadge quality={kpi.dataQuality} />
        </div>

        {kpi.subtext && (
          <p className="text-[11px] text-slate-400 line-clamp-1">{kpi.subtext}</p>
        )}
      </div>
    </AppCard>
  );
};

export default KPICard;
