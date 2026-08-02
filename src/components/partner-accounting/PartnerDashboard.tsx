import React, { useState } from "react";
import { useRepairOrders } from "../../hooks/useData";
import ProfitsSummary from "./ProfitsSummary";
import PartnerStatement from "./PartnerStatement";
import MonthlySettlements from "./MonthlySettlements";
import { Calculator, FileSpreadsheet, Scale, Layers } from "lucide-react";

interface PartnerDashboardProps {
  currentUserId?: string;
}

export default function PartnerDashboard({ currentUserId = "U-101" }: PartnerDashboardProps) {
  const { orders, loading: ordersLoading } = useRepairOrders();
  const [activeTab, setActiveTab] = useState<"summary" | "statement" | "settlements">("summary");

  return (
    <div className="space-y-6 dir-rtl text-right">
      {/* Top Navigation Tabs */}
      <div className="bg-[#11131e] border border-[#2a2d42] p-2 rounded-2xl flex flex-wrap gap-2 shadow-lg">
        <button
          onClick={() => setActiveTab("summary")}
          className={`flex-1 min-w-[160px] py-3 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer border ${
            activeTab === "summary"
              ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-md font-black"
              : "bg-[#181b2a] text-gray-400 border-[#2a2d42] hover:bg-[#202538] hover:text-white"
          }`}
        >
          <Calculator className="w-4 h-4 text-cyan-400" />
          <span>ملخص محاسبة الشركاء والبضاعة</span>
        </button>

        <button
          onClick={() => setActiveTab("statement")}
          className={`flex-1 min-w-[160px] py-3 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer border ${
            activeTab === "statement"
              ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/50 shadow-md font-black"
              : "bg-[#181b2a] text-gray-400 border-[#2a2d42] hover:bg-[#202538] hover:text-white"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-indigo-400" />
          <span>كشف حساب الشريك (دفتر أستاذ)</span>
        </button>

        <button
          onClick={() => setActiveTab("settlements")}
          className={`flex-1 min-w-[160px] py-3 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer border ${
            activeTab === "settlements"
              ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-md font-black"
              : "bg-[#181b2a] text-gray-400 border-[#2a2d42] hover:bg-[#202538] hover:text-white"
          }`}
        >
          <Scale className="w-4 h-4 text-amber-400" />
          <span>التسويات والمستحقات الشهرية</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "summary" && <ProfitsSummary orders={orders} ordersLoading={ordersLoading} />}
      {activeTab === "statement" && <PartnerStatement />}
      {activeTab === "settlements" && <MonthlySettlements currentUserId={currentUserId} />}
    </div>
  );
}
