/**
 * SystemStatus UI Component (Phase 3UI.0 - Premium Design System)
 * Real-time inspection of system sync status, queue metrics, and audit hash-chain integrity.
 * Reads ONLY from system state via selector data.
 * @license Apache-2.0
 */

import React from 'react';
import { SystemStatusSummary } from '../../lib/dashboard';
import { ShieldCheck, ShieldAlert, Database, Layers } from 'lucide-react';
import AppCard from '../common/AppCard';
import StatusBadge from '../common/StatusBadge';

export interface SystemStatusProps {
  status: SystemStatusSummary;
}

export const SystemStatus: React.FC<SystemStatusProps> = ({ status }) => {
  const getSyncBadge = () => {
    switch (status.syncStatus) {
      case 'IDLE':
        return <StatusBadge label="مستقر (IDLE)" variant="neutral" size="sm" />;
      case 'PENDING':
        return <StatusBadge label="معلق (PENDING)" variant="warning" size="sm" />;
      case 'SYNCING':
        return <StatusBadge label="جاري المزامنة (SYNCING)" variant="accent" size="sm" />;
      case 'CONFLICT':
        return <StatusBadge label="تعارض (CONFLICT)" variant="danger" size="sm" />;
      default:
        return <StatusBadge label="فشل (FAILED)" variant="danger" size="sm" />;
    }
  };

  return (
    <AppCard
      header={
        <div className="flex items-center justify-between w-full">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-cyan-400" />
            <span>حالة النظام والمزامنة</span>
            <span className="text-xs font-mono text-slate-500 font-normal">(System Status)</span>
          </h3>
          {getSyncBadge()}
        </div>
      }
      padding="md"
    >
      <div className="space-y-3">
        {/* Audit Chain Integrity Status */}
        <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              {status.auditHealth.chainValid ? (
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-rose-400" />
              )}
              سلامة سلسلة السجل المحمي (Audit Chain)
            </span>
            <StatusBadge
              label={status.auditHealth.chainValid ? 'سليمة (VALID)' : 'تالفة (CORRUPTED)'}
              variant={status.auditHealth.chainValid ? 'success' : 'danger'}
              size="sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-900">
            <div>
              <span className="text-slate-500 block text-[10px]">درجة صحة المزامنة:</span>
              <span className="font-mono text-white font-bold">
                {status.auditHealth.healthScorePercentage}% ({status.auditHealth.healthGrade})
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">إجمالي أحداث التدقيق:</span>
              <span className="font-mono text-white font-bold">{status.auditHealth.totalEvents} حدث</span>
            </div>
          </div>
        </div>

        {/* Sync Queue Summary */}
        <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-indigo-400" />
              حجم قائمة الانتظار (Sync Queue)
            </span>
            <span className="text-xs font-mono font-bold text-white bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
              {status.queueSize} عنصر
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
              <span className="text-[10px] text-amber-400 block font-medium">معلق</span>
              <span className="font-mono font-bold text-white text-sm">{status.pendingQueueCount}</span>
            </div>
            <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
              <span className="text-[10px] text-rose-400 block font-medium">فشل</span>
              <span className="font-mono font-bold text-white text-sm">{status.failedQueueCount}</span>
            </div>
            <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
              <span className="text-[10px] text-cyan-400 block font-medium">تعارض</span>
              <span className="font-mono font-bold text-white text-sm">{status.conflictQueueCount}</span>
            </div>
          </div>
        </div>
      </div>
    </AppCard>
  );
};

export default SystemStatus;
