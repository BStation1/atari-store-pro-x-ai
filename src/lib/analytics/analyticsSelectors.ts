/**
 * Analytics Selectors (Phase 3UI.2C - Analytics Engine)
 * Pure accessor selectors for components. Zero computations done in UI components.
 * @license Apache-2.0
 */

import { DateRangeOption, ExecutiveDashboardAnalyticsViewModel } from './analyticsTypes';
import { getExecutiveDashboardAnalyticsViewModel } from './analyticsViewModels';

export function getAnalyticsViewModel(
  dateRange: DateRangeOption = 'allTime'
): ExecutiveDashboardAnalyticsViewModel {
  return getExecutiveDashboardAnalyticsViewModel(dateRange);
}
