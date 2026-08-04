/**
 * DataQualityBadge Component (Phase 3UI.0 - Premium Design System)
 * Visual indicator for metric data quality states: VALID, INSUFFICIENT_DATA, UNAVAILABLE, PARTIAL.
 * @license Apache-2.0
 */

import React from 'react';
import { DataQuality } from '../../lib/dashboard';

export interface DataQualityBadgeProps {
  quality: DataQuality;
  className?: string;
}

export const DataQualityBadge: React.FC<DataQualityBadgeProps> = ({
  quality,
  className = ''
}) => {
  switch (quality) {
    case 'INSUFFICIENT_DATA':
      return (
        <span
          className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-400 border border-amber-800 ${className}`}
        >
          بيانات غير كافية
        </span>
      );
    case 'UNAVAILABLE':
      return (
        <span
          className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 ${className}`}
        >
          غير متاح
        </span>
      );
    case 'PARTIAL':
      return (
        <span
          className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-400 border border-cyan-800 ${className}`}
        >
          جزئي
        </span>
      );
    case 'VALID':
    default:
      return null;
  }
};

export default DataQualityBadge;
