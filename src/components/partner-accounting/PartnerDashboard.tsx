import React from "react";
import { useRepairOrders } from "../../hooks/useData";
import ProfitsSummary from "./ProfitsSummary";

interface PartnerDashboardProps {
  currentUserId?: string;
}

export default function PartnerDashboard({ currentUserId = "U-101" }: PartnerDashboardProps) {
  const { orders } = useRepairOrders();

  return (
    <div className="space-y-6">
      <ProfitsSummary orders={orders} />
    </div>
  );
}
