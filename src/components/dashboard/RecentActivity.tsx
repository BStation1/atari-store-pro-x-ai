/**
 * RecentActivity UI Component (Phase 3UI.0 - Premium Design System)
 * Displays recent system events and operational logs with clean empty state handling.
 * @license Apache-2.0
 */

import React from 'react';
import { RecentActivityItem } from '../../lib/dashboard';
import { Activity, Wrench, FileText, RefreshCw, Info } from 'lucide-react';
import AppCard from '../common/AppCard';
import EmptyState from '../common/EmptyState';

export interface RecentActivityProps {
  activities: RecentActivityItem[];
}

export const RecentActivity: React.FC<RecentActivityProps> = ({ activities }) => {
  const getActivityIcon = (type: RecentActivityItem['type']) => {
    switch (type) {
      case 'REPAIR':
        return <Wrench className="w-4 h-4 text-cyan-400" />;
      case 'INVOICE':
        return <FileText className="w-4 h-4 text-emerald-400" />;
      case 'SYNC':
        return <RefreshCw className="w-4 h-4 text-indigo-400" />;
      default:
        return <Info className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <AppCard
      header={
        <div className="flex items-center justify-between w-full">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-400" />
            <span>الأنشطة الأخيرة</span>
            <span className="text-xs font-mono text-slate-500 font-normal">(Recent Activity)</span>
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            {activities.length} عملية
          </span>
        </div>
      }
      padding="md"
    >
      {activities.length === 0 ? (
        <EmptyState
          title="لا توجد أنشطة حديثة مسجلة"
          description="لم يتم تسجيل أي عمليات أو تحديثات في الفترة الأخيرة."
        />
      ) : (
        <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
          {activities.map((item) => (
            <div
              key={item.id}
              className="bg-slate-950/80 border border-slate-800/80 p-3 rounded-xl flex items-start gap-3 hover:border-slate-700 transition"
            >
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 shrink-0 mt-0.5">
                {getActivityIcon(item.type)}
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-200 truncate">{item.title}</span>
                  <span className="text-[10px] text-slate-500 font-mono shrink-0">{item.formattedTime}</span>
                </div>
                <p className="text-xs text-slate-400 truncate">{item.description}</p>
                {item.actor && (
                  <span className="inline-block text-[10px] text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 font-mono">
                    بواسطة: {item.actor}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppCard>
  );
};

export default RecentActivity;
