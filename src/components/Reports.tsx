import React from "react";
import FinancialReportsDashboard from "./financial-reports/FinancialReportsDashboard";
import { useCurrentUser } from "../hooks/useData";

export default function Reports() {
  const { user } = useCurrentUser();

  return (
    <div className="space-y-6">
      <FinancialReportsDashboard
        currentUserId={user?.id || 'U-101'}
        userRole={(user?.role || 'OWNER') as any}
      />
    </div>
  );
}
