/**
 * Dashboard View Component Wrapper (Phase 3A.0 - Dashboard Foundation)
 * Delegates rendering to the new Phase 3A.0 Dashboard Foundation layout.
 * @license Apache-2.0
 */

import React, { useEffect } from "react";
import DashboardFoundation from "./dashboard/Dashboard";

interface DashboardProps {
  onNavigate?: (view: string, subParam?: any) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  // Set synchronously before child hooks run so Dashboard summary hooks read the
  // already-cached local snapshots instead of downloading full Supabase tables.
  if (typeof window !== "undefined") {
    (window as any).__ATARI_DASHBOARD_LOCAL_ONLY__ = true;
  }

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined") {
        (window as any).__ATARI_DASHBOARD_LOCAL_ONLY__ = false;
      }
    };
  }, []);

  return <DashboardFoundation onNavigate={onNavigate} />;
}
