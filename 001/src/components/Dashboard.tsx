/**
 * Dashboard View Component Wrapper (Phase 3A.0 - Dashboard Foundation)
 * Delegates rendering to the new Phase 3A.0 Dashboard Foundation layout.
 * @license Apache-2.0
 */

import React from "react";
import DashboardFoundation from "./dashboard/Dashboard";

interface DashboardProps {
  onNavigate?: (view: string, subParam?: any) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  return <DashboardFoundation />;
}
