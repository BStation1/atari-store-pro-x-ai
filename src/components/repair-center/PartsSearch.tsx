import React from "react";
import { Search } from "lucide-react";
import { Product } from "../../types";

interface PartsSearchProps {
  deviceType?: string;
  deviceModel?: string;
  partSearch: string;
  onSearchChange: (value: string) => void;
  matchedSearchResults: Product[];
  busyProductIds: Set<string>;
  onAddPartToDevice: (productId: string, quantity: number) => void;
  onClearSearch: () => void;
}

export function PartsSearch({
  deviceType,
  deviceModel,
  partSearch,
  onSearchChange,
  matchedSearchResults,
  busyProductIds,
  onAddPartToDevice,
  onClearSearch,
}: PartsSearchProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-extrabold text-white">
          قطع الغيار
        </label>
        <span className="text-[11px] text-gray-400 font-semibold">
          قطع متوافقة مع {deviceType} {deviceModel}
        </span>
      </div>

      {/* Persistent Search Field */}
      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute right-3.5 top-3.5" />
        <input
          type="text"
          placeholder="🔍 ابحث باسم القطعة أو SKU أو Barcode..."
          value={partSearch}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && matchedSearchResults.length > 0) {
              e.preventDefault();
              const firstP = matchedSearchResults[0];
              if (firstP && firstP.quantity > 0) {
                onAddPartToDevice(firstP.id, 1);
                onClearSearch();
              }
            }
          }}
          className="w-full bg-[#181b2a] border border-[#2a2d42] rounded-xl pr-10 pl-4 py-2.5 text-xs text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 font-medium"
        />
        {partSearch && (
          <button
            type="button"
            onClick={onClearSearch}
            className="absolute left-3 top-2.5 text-gray-400 hover:text-white bg-gray-800 rounded-full w-5 h-5 flex items-center justify-center text-[10px] cursor-pointer"
          >
            ✕
          </button>
        )}
      </div>

      {/* Quick Add Compatible Items Grid */}
      <div className="bg-[#181b2a] border border-[#2a2d42] p-2.5 rounded-xl max-h-[180px] overflow-y-auto custom-scrollbar space-y-2">
        <div className="text-[10px] text-gray-400 font-bold px-1">
          {partSearch.trim() ? `نتائج البحث (${matchedSearchResults.length}):` : `القطع المتوافقة القابلة للإضافة السريعة:`}
        </div>
        {matchedSearchResults.length === 0 ? (
          <p className="text-xs text-gray-400 italic py-2 text-center">لا توجد قطع غيار مطابقة.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {matchedSearchResults.slice(0, 12).map((p) => {
              const price = Number(p.sellPrice || (p as any).price || p.purchasePrice || 0);
              const isBusy = busyProductIds.has(p.id);
              const isOutOfStock = p.quantity <= 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={isOutOfStock || isBusy}
                  onClick={() => {
                    onAddPartToDevice(p.id, 1);
                    onClearSearch();
                  }}
                  className={`p-2 rounded-lg text-xs font-bold border text-right transition flex items-center justify-between gap-2 ${
                    isOutOfStock || isBusy
                      ? "bg-gray-900 text-gray-500 border-gray-800 cursor-not-allowed opacity-60"
                      : "bg-[#11131e] text-white border-[#2a2d42] hover:border-indigo-500 hover:bg-indigo-950/40 cursor-pointer"
                  }`}
                >
                  <div className="truncate">
                    <p className="font-bold text-white truncate text-xs">{p.nameAr || p.name}</p>
                    <p className="text-[10px] text-gray-400 font-mono flex items-center gap-1">
                      <span>المتاح: {p.quantity}</span>
                      {isBusy && <span className="text-amber-400 font-bold animate-pulse text-[9px]">(جاري الحفظ...)</span>}
                    </p>
                  </div>
                  <span className="font-mono font-extrabold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded text-[11px] shrink-0 border border-emerald-500/30">
                    {price.toLocaleString('ar-EG')} ج.م
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default PartsSearch;
