import React from "react";

interface TotalsPanelProps {
  partsTotalSelling: number;
  calculatedLabor: number;
  grandTotal: number;
  onLaborChange: (newLabor: number) => void;
}

export function TotalsPanel({
  partsTotalSelling,
  calculatedLabor,
  grandTotal,
  onLaborChange,
}: TotalsPanelProps) {
  return (
    <div className="bg-[#11131e] border border-[#2a2d42] p-5 rounded-xl space-y-3">
      <div className="flex items-center justify-between text-xs text-gray-300">
        <span className="font-bold">قطع الغيار</span>
        <span className="font-mono font-extrabold text-white text-sm">
          {partsTotalSelling.toLocaleString('ar-EG')} ج.م
        </span>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-300">
        <span className="font-bold">المصنعية</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min="0"
            value={calculatedLabor}
            onChange={(e) => {
              const newLabor = Math.max(0, Number(e.target.value) || 0);
              onLaborChange(newLabor);
            }}
            className="w-24 bg-[#181b2a] border border-[#2a2d42] rounded-lg px-2 py-1 text-center font-mono font-extrabold text-white text-xs focus:outline-none focus:border-indigo-500"
          />
          <span className="text-gray-400 font-bold text-[11px]">ج.م</span>
        </div>
      </div>

      <div className="border-t border-[#2a2d42] pt-3 flex items-center justify-between">
        <span className="text-sm font-extrabold text-white">الإجمالي</span>
        <span className="text-2xl font-black font-mono text-emerald-400">
          {grandTotal.toLocaleString('ar-EG')} <span className="text-sm font-sans">ج.م</span>
        </span>
      </div>
    </div>
  );
}

export default TotalsPanel;
