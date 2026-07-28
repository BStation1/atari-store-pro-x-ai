/**
 * LoadingState Component (Phase 3UI.0 - Premium Design System)
 * Spinner indicator for loading operations.
 * @license Apache-2.0
 */

import React from 'react';
import { Loader2 } from 'lucide-react';

export interface LoadingStateProps {
  message?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'جاري تحسين وجلب البيانات...',
  className = ''
}) => {
  return (
    <div className={`p-8 flex flex-col items-center justify-center space-y-3 text-center ${className}`}>
      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      <p className="text-xs text-slate-400 font-medium">{message}</p>
    </div>
  );
};

export default LoadingState;
