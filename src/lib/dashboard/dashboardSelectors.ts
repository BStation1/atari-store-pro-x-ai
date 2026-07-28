/**
 * Dashboard Selectors (Phase 3A.1 - Dashboard KPIs)
 * Provides unified selector API for React components to request metrics, KPIs, activities, and status.
 * @license Apache-2.0
 */

import {
  computeDashboardMetrics,
  computeAllDashboardKPIs,
  computeSystemStatus,
  computeRecentActivities,
  computeQuickStats,
  computeRecentRepairOrders
} from './dashboardMetrics';
import {
  DashboardMetrics,
  DashboardKPISummary,
  SystemStatusSummary,
  RecentActivityItem,
  QuickStatItem,
  RecentRepairOrderViewModel
} from './dashboardTypes';

export function getDashboardMetrics(): DashboardMetrics {
  return computeDashboardMetrics();
}

export function getDashboardKPIs(): DashboardKPISummary {
  return computeAllDashboardKPIs();
}

export function getSystemStatus(): SystemStatusSummary {
  return computeSystemStatus();
}

export function getRecentActivities(): RecentActivityItem[] {
  return computeRecentActivities();
}

export function getQuickStats(): QuickStatItem[] {
  return computeQuickStats();
}

export function getRecentRepairOrders(limit: number = 5): RecentRepairOrderViewModel[] {
  return computeRecentRepairOrders(limit);
}

