/**
 * AppCard Component (Phase 3UI.0 - Premium Design System)
 * Elevated surface card with subtle border, shadow, hover states, and header/footer slots.
 * @license Apache-2.0
 */

import React from 'react';

export interface AppCardProps {
  children: React.ReactNode;
  className?: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  hoverable?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const AppCard: React.FC<AppCardProps> = ({
  children,
  className = '',
  header,
  footer,
  hoverable = false,
  padding = 'md'
}) => {
  const paddingClasses = {
    none: 'p-0',
    sm: 'p-3',
    md: 'p-5',
    lg: 'p-6'
  }[padding];

  return (
    <div
      className={`bg-slate-900/90 border border-slate-800 rounded-2xl shadow-lg transition-all duration-200 ${
        hoverable ? 'hover:border-slate-700 hover:shadow-xl hover:-translate-y-0.5' : ''
      } ${className}`}
    >
      {header && (
        <div className="border-b border-slate-800 px-5 py-3.5 flex items-center justify-between">
          {header}
        </div>
      )}
      <div className={paddingClasses}>{children}</div>
      {footer && (
        <div className="border-t border-slate-800 px-5 py-3 bg-slate-950/40 rounded-b-2xl">
          {footer}
        </div>
      )}
    </div>
  );
};

export default AppCard;
