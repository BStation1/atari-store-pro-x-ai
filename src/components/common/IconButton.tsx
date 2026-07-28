/**
 * IconButton Component (Phase 3UI.0 - Premium Design System)
 * Accessible button with keyboard navigation, focus ring, and custom icon.
 * @license Apache-2.0
 */

import React from 'react';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  ariaLabel: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  badgeCount?: number;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  ariaLabel,
  variant = 'secondary',
  size = 'md',
  badgeCount,
  className = '',
  ...props
}) => {
  const variantStyles = {
    primary: 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500/30',
    secondary: 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700',
    ghost: 'bg-transparent hover:bg-slate-800/60 text-slate-400 hover:text-white border-transparent',
    danger: 'bg-rose-950/60 hover:bg-rose-900 text-rose-300 border-rose-800'
  }[variant];

  const sizeStyles = {
    sm: 'p-1.5 rounded-lg text-xs',
    md: 'p-2.5 rounded-xl text-sm',
    lg: 'p-3.5 rounded-2xl text-base'
  }[size];

  return (
    <button
      aria-label={ariaLabel}
      title={ariaLabel}
      className={`relative border transition-all duration-150 focus-ring-custom cursor-pointer inline-flex items-center justify-center ${variantStyles} ${sizeStyles} ${className}`}
      {...props}
    >
      {icon}
      {typeof badgeCount === 'number' && badgeCount > 0 && (
        <span className="min-w-[18px] h-[18px] bg-rose-600 text-white text-[10px] font-bold rounded-full absolute -top-1 -right-1 flex items-center justify-center px-1 border border-slate-950 animate-pulse">
          {badgeCount > 99 ? '99+' : badgeCount}
        </span>
      )}
    </button>
  );
};

export default IconButton;
