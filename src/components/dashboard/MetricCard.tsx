/**
 * MetricCard UI Component (Phase 3A.0 - Dashboard Foundation)
 * Reusable card displaying an individual dashboard metric cleanly.
 * @license Apache-2.0
 */

import React from 'react';

export interface MetricCardProps {
  id: string;
  titleAr: string;
  titleEn: string;
  formattedValue: string;
  subtitle?: string;
  icon: React.ReactNode;
  accentColor?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'cyan' | 'slate';
}

export const MetricCard: React.FC<MetricCardProps> = ({
  titleAr,
  titleEn,
  formattedValue,
  subtitle,
  icon,
  accentColor = 'indigo'
}) => {
  const colorStyles = {
    indigo: 'border-indigo-500/20 bg-slate-900 text-indigo-400',
    emerald: 'border-emerald-500/20 bg-slate-900 text-emerald-400',
    amber: 'border-amber-500/20 bg-slate-900 text-amber-400',
    rose: 'border-rose-500/20 bg-slate-900 text-rose-400',
    cyan: 'border-cyan-500/20 bg-slate-900 text-cyan-400',
    slate: 'border-slate-800 bg-slate-900 text-slate-400'
  }[accentColor];

  return (
    <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3 flex flex-col justify-between hover:border-slate-700 transition">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-slate-300 block">{titleAr}</span>
          <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-mono">{titleEn}</span>
        </div>
        <div className={`p-2.5 rounded-xl border ${colorStyles}`}>
          {icon}
        </div>
      </div>

      <div className="pt-2">
        <div className="text-2xl font-extrabold text-white font-mono tracking-tight">
          {formattedValue}
        </div>
        {subtitle && (
          <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  );
};

export default MetricCard;
