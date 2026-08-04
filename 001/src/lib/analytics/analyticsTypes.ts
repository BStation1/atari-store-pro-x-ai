/**
 * Analytics Domain Types (Phase 3UI.2C - Analytics Engine)
 * Strictly typed interfaces for Revenue, Profit, Repair Status, Device Distribution,
 * Technician Performance, and Activity Timeline.
 * @license Apache-2.0
 */

export type DateRangeOption =
  | 'today'
  | 'last7days'
  | 'last30days'
  | 'thisMonth'
  | 'thisYear'
  | 'allTime';

export interface DateRangeFilter {
  option: DateRangeOption;
  labelAr: string;
}

export interface RevenuePoint {
  date: string; // ISO date string YYYY-MM-DD
  label: string; // Display label in Arabic (e.g. 28 يوليو or الأحد)
  invoiceRevenue: number;
  repairRevenue: number;
  totalRevenue: number;
}

export interface RevenueAnalyticsData {
  timeSeries: RevenuePoint[];
  totalRevenue: number;
  invoiceRevenueTotal: number;
  repairRevenueTotal: number;
  periodLabel: string;
  hasData: boolean;
}

export interface ProfitAnalyticsData {
  repairProfit: number;
  salesProfit: number;
  operatingExpenses: number;
  netProfit: number;
  repairRevenue: number;
  sparePartsCost: number;
  salesRevenue: number;
  cogs: number;
  marginPercentage: number;
  hasData: boolean;
}

export interface RepairStatusItem {
  statusKey: string;
  labelAr: string;
  count: number;
  percentage: number;
  color: string;
}

export interface RepairStatusAnalyticsData {
  items: RepairStatusItem[];
  totalOrders: number;
  hasData: boolean;
}

export interface DeviceCategoryItem {
  categoryKey: string; // PS5, PS4, Xbox, Nintendo, Steam Deck, Other
  labelAr: string;
  count: number;
  percentage: number;
  color: string;
}

export interface DeviceAnalyticsData {
  items: DeviceCategoryItem[];
  totalDevices: number;
  hasData: boolean;
}

export interface TechnicianMetricItem {
  technicianId: string;
  technicianName: string;
  totalAssigned: number;
  completedCount: number;
  inProgressCount: number;
  avgRepairDurationHours: number;
  formattedAvgDuration: string;
  totalProfitGenerated: number;
  formattedProfit: string;
  completionRate: number; // 0 - 100
}

export interface TechnicianAnalyticsData {
  technicians: TechnicianMetricItem[];
  totalTechnicians: number;
  hasData: boolean;
}

export interface TimelineEventItem {
  id: string;
  timestamp: string;
  formattedTime: string;
  formattedDate: string;
  title: string;
  description: string;
  type: 'repair' | 'invoice' | 'system' | 'user' | 'inventory';
  status?: string;
  actorName?: string;
}

export interface TimelineAnalyticsData {
  events: TimelineEventItem[];
  hasData: boolean;
}

export interface ExecutiveDashboardAnalyticsViewModel {
  dateRange: DateRangeOption;
  dateRangeLabel: string;
  revenueAnalytics: RevenueAnalyticsData;
  profitAnalytics: ProfitAnalyticsData;
  repairStatusAnalytics: RepairStatusAnalyticsData;
  deviceAnalytics: DeviceAnalyticsData;
  technicianAnalytics: TechnicianAnalyticsData;
  activityTimeline: TimelineAnalyticsData;
  lastUpdatedIso: string;
}
