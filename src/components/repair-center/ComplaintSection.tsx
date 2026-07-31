import React from "react";
import { QUICK_FAULTS_LIST } from "../../types";

interface ComplaintSectionProps {
  issue: string;
  showQuickFaultsDropdown: boolean;
  onToggleQuickFaultsDropdown: () => void;
  onSelectQuickFault: (faultLabel: string) => void;
  onIssueChange: (value: string) => void;
}

export function ComplaintSection({
  issue,
  showQuickFaultsDropdown,
  onToggleQuickFaultsDropdown,
  onSelectQuickFault,
  onIssueChange,
}: ComplaintSectionProps) {
  return (
    <div className="bg-[#11131e] border border-[#2a2d42] p-4 rounded-xl space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-extrabold text-white">
          شكوى العميل
        </label>

        {/* Dropdown Button */}
        <div className="relative">
          <button
            type="button"
            onClick={onToggleQuickFaultsDropdown}
            className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-500/30 px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer"
          >
            <span>+ إدراج شكوى شائعة</span>
          </button>

          {showQuickFaultsDropdown && (
            <div className="absolute left-0 top-full mt-1.5 w-64 bg-[#181b2a] border border-[#2a2d42] rounded-xl shadow-2xl p-2 z-30 max-h-56 overflow-y-auto custom-scrollbar">
              <div className="text-[10px] text-gray-400 font-bold px-2 py-1 border-b border-gray-800 mb-1 flex justify-between items-center">
                <span>اختر شكوى شائعة لإدراجها:</span>
                <button
                  type="button"
                  onClick={onToggleQuickFaultsDropdown}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-1">
                {QUICK_FAULTS_LIST.map((fault) => (
                  <button
                    key={fault.id}
                    type="button"
                    onClick={() => onSelectQuickFault(fault.label)}
                    className="w-full text-right px-2.5 py-1.5 text-xs text-gray-200 hover:text-white hover:bg-indigo-600/30 rounded-lg transition flex items-center justify-between cursor-pointer"
                  >
                    <span>{fault.label}</span>
                    {fault.defaultSellingPrice > 0 && (
                      <span className="text-[10px] text-emerald-400 font-mono">+{fault.defaultSellingPrice} ج.م</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <textarea
        rows={4}
        placeholder="أدخل شكوى العميل بالتفصيل..."
        value={issue || ""}
        onChange={(e) => onIssueChange(e.target.value)}
        className="w-full bg-[#181b2a] border border-[#2a2d42] rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none font-medium leading-relaxed"
      />
    </div>
  );
}

export default ComplaintSection;
