/**
 * Executive Activity Timeline Component (Phase 3UI.2C)
 * Displays real-time operational activity timeline.
 * @license Apache-2.0
 */

import React from 'react';
import { TimelineAnalyticsData } from '../../../lib/analytics';
import EmptyState from '../../common/EmptyState';
import { History, Wrench, Receipt, Cpu, User } from 'lucide-react';

interface ActivityTimelineWidgetProps {
  data: TimelineAnalyticsData;
}

export const ActivityTimelineWidget: React.FC<ActivityTimelineWidgetProps> = ({ data }) => {
  if (!data.hasData || data.events.length === 0) {
    return (
      <EmptyState
        title="لا يوجد سجل أنشطة مؤخراً"
        description="سيتم تتبع وتوثيق جميع عمليات الصيانة والمبيعات في التايم لاين تلقائياً."
        icon={History}
      />
    );
  }

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'repair':
        return <Wrench className="w-3.5 h-3.5 text-indigo-400" />;
      case 'invoice':
        return <Receipt className="w-3.5 h-3.5 text-emerald-400" />;
      case 'user':
        return <User className="w-3.5 h-3.5 text-amber-400" />;
      case 'system':
      default:
        return <Cpu className="w-3.5 h-3.5 text-cyan-400" />;
    }
  };

  return (
    <div className="relative border-r-2 border-slate-800 pr-4 space-y-4 my-2">
      {data.events.map((evt) => (
        <div key={evt.id} className="relative group">
          {/* Dot Icon */}
          <div className="absolute -right-[23px] top-0.5 p-1 rounded-full bg-slate-900 border border-slate-700 shadow-md">
            {getEventIcon(evt.type)}
          </div>

          <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl hover:bg-slate-900/60 transition-all duration-200 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-200">{evt.title}</span>
              <span className="text-[10px] font-mono text-slate-500">
                {evt.formattedDate} • {evt.formattedTime}
              </span>
            </div>
            {evt.description && (
              <p className="text-[11px] text-slate-400 leading-relaxed truncate">
                {evt.description}
              </p>
            )}
            {evt.actorName && (
              <span className="text-[10px] text-slate-500 font-mono block">
                بواسطة: {evt.actorName}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ActivityTimelineWidget;
