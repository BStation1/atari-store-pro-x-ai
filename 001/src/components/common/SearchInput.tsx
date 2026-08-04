/**
 * SearchInput Component (Phase 3UI.0 - Premium Design System)
 * Search field with shortcut trigger display and RTL styling.
 * @license Apache-2.0
 */

import React from 'react';
import { Search } from 'lucide-react';

export interface SearchInputProps {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClick?: () => void;
  placeholder?: string;
  readOnly?: boolean;
  shortcutHint?: string;
  className?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  onClick,
  placeholder = 'البحث السريع في النظام...',
  readOnly = false,
  shortcutHint = 'Ctrl+K',
  className = ''
}) => {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-2.5 bg-slate-950/80 border border-slate-800 focus-within:border-indigo-500 px-3.5 py-2 rounded-xl text-xs transition-colors cursor-pointer ${className}`}
    >
      <Search className="w-4 h-4 text-slate-500 shrink-0" />
      <input
        type="text"
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        placeholder={placeholder}
        className="bg-transparent text-slate-200 placeholder-slate-500 focus:outline-none w-full cursor-pointer"
      />
      {shortcutHint && (
        <span className="hidden sm:inline-block text-[10px] font-mono text-slate-500 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded shrink-0">
          {shortcutHint}
        </span>
      )}
    </div>
  );
};

export default SearchInput;
