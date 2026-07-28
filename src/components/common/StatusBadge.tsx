/**
 * StatusBadge Component (Phase 3UI.0 - Premium Design System)
 * Accessible colored badge for operational statuses.
 * @license Apache-2.0
 */

import React from 'react';

export type StatusVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent';

export interface StatusBadgeProps {
  label: string;
  variant?: StatusVariant;
  icon?: React.ReactNode;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  variant = 'neutral',
  icon,
  size = 'md',
  className = ''
}) => {
  const variantStyles: Record<StatusVariant, string> = {
    success: 'bg-emerald-950/80 text-emerald-400 border-emerald-800/80',
    warning: 'bg-amber-950/80 text-amber-400 border-amber-800/80',
    danger: 'bg-rose-950/80 text-rose-400 border-rose-800/80',
    info: 'bg-cyan-950/80 text-cyan-400 border-cyan-800/80',
    accent: 'bg-indigo-950/80 text-indigo-400 border-indigo-800/80',
    neutral: 'bg-slate-800 text-slate-300 border-slate-700'
  };

  const sizeStyles = {
    sm: 'text-[10px] px-2 py-0.5 rounded gap-1',
    md: 'text-xs px-2.5 py-1 rounded-md gap-1.5'
  }[size];

  return (
    <span
      className={`inline-flex items-center font-medium border ${variantStyles[variant]} ${sizeStyles} ${className}`}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="truncate">{label}</span>
    </span>
  );
};

export default StatusBadge;
