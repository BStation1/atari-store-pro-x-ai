/**
 * Analytics View Models (Phase 3UI.2C - Analytics Engine)
 * Aggregates all analytics pure calculations into unified view models for React chart UI consumption.
 * @license Apache-2.0
 */

import { DateRangeOption, ExecutiveDashboardAnalyticsViewModel } from './analyticsTypes';
import { getDateRangeBounds } from './analyticsDateUtils';
import {
  calculateRevenueAnalytics,
  calculateProfitAnalytics,
  calculateRepairStatusAnalytics,
  calculateDeviceAnalytics,
  calculateTechnicianAnalytics,
  calculateTimelineAnalytics
} from './analyticsMetrics';

export function getExecutiveDashboardAnalyticsViewModel(
  dateRange: DateRangeOption = 'allTime'
): ExecutiveDashboardAnalyticsViewModel {
  const { start, end, labelAr } = getDateRangeBounds(dateRange);

  const revenueAnalytics = calculateRevenueAnalytics(start, end, labelAr);
  const profitAnalytics = calculateProfitAnalytics(start, end);
  const repairStatusAnalytics = calculateRepairStatusAnalytics(start, end);
  const deviceAnalytics = calculateDeviceAnalytics(start, end);
  const technicianAnalytics = calculateTechnicianAnalytics(start, end);
  const activityTimeline = calculateTimelineAnalytics(start, end, 8);

  return {
    dateRange,
    dateRangeLabel: labelAr,
    revenueAnalytics,
    profitAnalytics,
    repairStatusAnalytics,
    deviceAnalytics,
    technicianAnalytics,
    activityTimeline,
    lastUpdatedIso: new Date().toISOString()
  };
}
