import React from "react";
import { Save, CheckCircle, Truck } from "lucide-react";

interface ActionButtonsProps {
  isDelivered: boolean;
  onSave: () => void;
  onMarkReady: () => void;
  onMarkDelivered: () => void;
}

export function ActionButtons({
  isDelivered,
  onSave,
  onMarkReady,
  onMarkDelivered,
}: ActionButtonsProps) {
  return (
    <div className="bg-[#11131e] border border-[#2a2d42] p-4 rounded-xl space-y-2.5">
      {/* 💾 حفظ */}
      <button
        type="button"
        onClick={onSave}
        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs py-3 px-4 rounded-xl shadow transition cursor-pointer flex items-center justify-center gap-2"
      >
        <Save className="w-4 h-4" />
        <span>💾 حفظ</span>
      </button>

      {/* 🛠 جاهز */}
      <button
        type="button"
        onClick={onMarkReady}
        className="w-full bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold text-xs py-3 px-4 rounded-xl shadow transition cursor-pointer flex items-center justify-center gap-2"
      >
        <CheckCircle className="w-4 h-4" />
        <span>🛠 جاهز</span>
      </button>

      {/* 🚚 تم التسليم */}
      <button
        type="button"
        disabled={isDelivered}
        onClick={onMarkDelivered}
        className="w-full bg-cyan-700 hover:bg-cyan-600 text-white font-extrabold text-xs py-3 px-4 rounded-xl shadow transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <Truck className="w-4 h-4" />
        <span>🚚 تم التسليم</span>
      </button>
    </div>
  );
}

export default ActionButtons;
