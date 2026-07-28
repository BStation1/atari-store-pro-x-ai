/**
 * EmptyState Component (Phase 3UI.0 - Premium Design System)
 * Safe zero / empty data state visualization.
 * @license Apache-2.0
 */

import React from 'react';
import { Inbox } from 'lucide-react';

export interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode | React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'لا توجد بيانات متاحة',
  description = 'لا تتوفر أي سجلات في هذا القسم حالياً.',
  icon,
  action,
  className = ''
}) => {
  const renderIcon = () => {
    if (!icon) return <Inbox className="w-8 h-8 text-slate-500" />;
    if (React.isValidElement(icon)) return icon;
    if (typeof icon === 'function' || (typeof icon === 'object' && icon !== null)) {
      const IconComp = icon as React.ComponentType<{ className?: string }>;
      return <IconComp className="w-8 h-8 text-slate-500" />;
    }
    return <Inbox className="w-8 h-8 text-slate-500" />;
  };

  return (
    <div
      className={`bg-slate-900/60 border border-slate-800/80 rounded-2xl p-8 text-center space-y-3 flex flex-col items-center justify-center ${className}`}
    >
      <div className="p-3 bg-slate-800/60 border border-slate-700/60 text-slate-400 rounded-2xl">
        {renderIcon()}
      </div>
      <div className="space-y-1 max-w-sm">
        <h3 className="text-sm font-bold text-slate-300">{title}</h3>
        <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
      </div>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
};

export default EmptyState;
