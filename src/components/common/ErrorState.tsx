/**
 * ErrorState Component (Phase 3UI.0 - Premium Design System)
 * Fallback display for runtime error handling.
 * @license Apache-2.0
 */

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'حدث خطأ غير متوقع',
  message = 'تعذر تحميل المحتوى بشكل صحيح. يرجى إعادة المحاولة.',
  onRetry,
  className = ''
}) => {
  return (
    <div className={`bg-rose-950/30 border border-rose-800/60 rounded-2xl p-6 text-center space-y-3 ${className}`}>
      <div className="w-10 h-10 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl flex items-center justify-center mx-auto">
        <AlertTriangle className="w-5 h-5" />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-bold text-rose-200">{title}</h3>
        <p className="text-xs text-rose-300/80 max-w-sm mx-auto">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 inline-flex items-center gap-2 bg-rose-900/80 hover:bg-rose-800 text-white text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>إعادة المحاولة</span>
        </button>
      )}
    </div>
  );
};

export default ErrorState;
