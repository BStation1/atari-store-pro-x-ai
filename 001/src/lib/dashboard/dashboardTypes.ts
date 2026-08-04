/**
 * Dashboard Domain Types (Phase 3A.1 - Dashboard KPIs)
 * @license Apache-2.0
 */

export type DataQuality = 'VALID' | 'INSUFFICIENT_DATA' | 'UNAVAILABLE' | 'PARTIAL';
export type TrendStatus = 'NOT_AVAILABLE' | 'UP' | 'DOWN' | 'STABLE';
export type KPIStatus = 'normal' | 'attention' | 'good' | 'warning';

export interface KPIItem {
  id: string;
  titleAr: string;
  titleEn: string;
  value: number | string;
  formattedValue: string;
  unit?: string;
  category: 'finance' | 'repairs' | 'inventory' | 'sync';
  status: KPIStatus;
  trendStatus: TrendStatus;
  dataQuality: DataQuality;
  sourceCount: number;
  lastCalculatedAt: string;
  subtext?: string;
}

export interface DashboardKPISummary {
  totalRevenue: KPIItem;
  repairProfit: KPIItem;
  netBusinessProfit: KPIItem;
  operatingExpenses: KPIItem;
  activeRepairs: KPIItem;
  completedRepairs: KPIItem;
  completionRate: KPIItem;
  averageRepairDuration: KPIItem;
  averageInvoiceValue: KPIItem;
  pendingPayments: KPIItem;
  inventoryValue: KPIItem;
  lowStockItems: KPIItem;
  pendingSyncItems: KPIItem;
  failedSyncItems: KPIItem;
  conflictItems: KPIItem;
  syncSuccessRate: KPIItem;
}

export interface MetricItem {
  id: string;
  titleAr: string;
  titleEn: string;
  value: number;
  formattedValue: string;
  unit?: string;
  category?: 'finance' | 'repairs' | 'inventory' | 'sync';
}

export interface DashboardMetrics {
  totalRevenue: number;
  formattedTotalRevenue: string;
  totalProfit: number;
  formattedTotalProfit: string;
  activeRepairs: number;
  completedRepairs: number;
  inventoryValue: number;
  formattedInventoryValue: string;
  pendingSyncItems: number;
  kpis: DashboardKPISummary;
}

export interface RecentActivityItem {
  id: string;
  type: 'REPAIR' | 'INVOICE' | 'INVENTORY' | 'SYNC' | 'SYSTEM';
  title: string;
  description: string;
  timestamp: string;
  formattedTime: string;
  actor?: string;
  status?: 'success' | 'pending' | 'failed' | 'info';
}

export interface SystemStatusSummary {
  syncStatus: 'IDLE' | 'PENDING' | 'SYNCING' | 'FAILED' | 'CONFLICT';
  auditHealth: {
    chainValid: boolean;
    failureType: string;
    healthScorePercentage: number | string;
    healthGrade: string;
    totalEvents: number;
    verifiedEvents: number;
  };
  queueSize: number;
  pendingQueueCount: number;
  failedQueueCount: number;
  conflictQueueCount: number;
  lastSuccessfulSyncTimestamp: string | null;
  formattedLastSync: string;
  systemOverallStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL';
}

export interface QuickStatItem {
  id: string;
  labelAr: string;
  labelEn: string;
  value: number | string;
  subtext?: string;
  category: 'customers' | 'inventory' | 'finance' | 'repairs';
  status?: 'normal' | 'attention' | 'good';
}

export interface RecentRepairOrderViewModel {
  orderId: string;
  orderNumber: string;
  deviceModel: string;
  deviceImage?: string;
  customerName: string;
  customerPhone: string;
  technicianName: string;
  issueSummary: string;
  status: string;
  receivedAt: string;
  daysInWorkshop: number | 'UNAVAILABLE';
  remainingAmount: number;
  rawOrderId: string;
}

