/**
 * Date Range Selector Component (Phase 3UI.2C)
 * Allows executive filter switching across time windows without mutating raw data.
 * @license Apache-2.0
 */

import React from 'react';
import { DateRangeOption, DATE_RANGE_OPTIONS } from '../../../lib/analytics';
import { Calendar } from 'lucide-react';

interface DateRangeSelectorProps {
  value: DateRangeOption;
  onChange: (val: DateRangeOption) => void;
}

export const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({ value, onChange }) => {
  return (
    <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 p-1 rounded-xl overflow-x-auto scrollbar-none">
      <span className="text-[11px] font-bold text-slate-500 px-2 flex items-center gap-1 shrink-0">
        <Calendar className="w-3.5 h-3.5 text-indigo-400" />
        الفترة:
      </span>
      <div className="flex items-center gap-1 shrink-0">
        {DATE_RANGE_OPTIONS.map((item) => {
          const isSelected = value === item.option;
          return (
            <button
              key={item.option}
              onClick={() => onChange(item.option)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
                isSelected
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/50 border border-indigo-400/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {item.labelAr}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DateRangeSelector;
