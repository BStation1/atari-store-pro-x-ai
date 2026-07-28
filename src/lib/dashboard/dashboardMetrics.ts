/**
 * Dashboard Metrics Layer (Phase 3A.1 - Dashboard KPIs)
 * Pure computation functions for system KPIs, metrics, status, activity, and quick stats.
 * No hardcoded mock values or artificial numbers.
 * @license Apache-2.0
 */

import { db } from '../db';
import { syncQueue } from '../sync/syncQueue';
import { calculateSyncHealthMetrics, verifyAuditChain, getAllAuditEvents } from '../sync/audit';
import {
  DashboardMetrics,
  DashboardKPISummary,
  KPIItem,
  SystemStatusSummary,
  RecentActivityItem,
  QuickStatItem,
  RecentRepairOrderViewModel
} from './dashboardTypes';

function formatCurrency(amount: number): string {
  const safeVal = isNaN(amount) || !isFinite(amount) ? 0 : amount;
  return new Intl.NumberFormat('ar-EG', {
    style: 'currency',
    currency: 'EGP',
    maximumFractionDigits: 0
  }).format(safeVal);
}

const nowIso = () => new Date().toISOString();

export function computeTotalRevenueMetric(): KPIItem {
  const invoices = db.getInvoices() || [];
  const repairOrders = db.getRepairOrders() || [];

  const validPaidInvoices = invoices.filter(inv => !inv.isCancelled && inv.isPaid);
  const invoiceRevenue = validPaidInvoices.reduce((sum, inv) => sum + (inv.paidAmount || inv.totalAmount || 0), 0);

  const repairAdvances = repairOrders
    .filter(ro => ro.status !== 'Cancelled' && ro.advancePayment && ro.advancePayment > 0)
    .reduce((sum, ro) => sum + (ro.advancePayment || 0), 0);

  const total = invoiceRevenue + repairAdvances;
  const sourceCount = validPaidInvoices.length + repairOrders.filter(ro => (ro.advancePayment || 0) > 0).length;

  return {
    id: 'kpi-total-revenue',
    titleAr: 'إجمالي الإيرادات',
    titleEn: 'Total Revenue',
    value: total,
    formattedValue: formatCurrency(total),
    unit: 'EGP',
    category: 'finance',
    status: 'normal',
    trendStatus: 'NOT_AVAILABLE',
    dataQuality: sourceCount > 0 ? 'VALID' : 'INSUFFICIENT_DATA',
    sourceCount,
    lastCalculatedAt: nowIso(),
    subtext: 'المبيعات وسلفيات الصيانة المسددة'
  };
}

export function computeRepairProfitMetric(): KPIItem {
  const repairOrders = db.getRepairOrders() || [];
  const validRepairs = repairOrders.filter(ro => ro.status !== 'Cancelled');

  const repairRevenue = validRepairs.reduce((sum, ro) => {
    return sum + (ro.finalRepairPrice || ro.totalEstimatedCost || ro.advancePayment || 0);
  }, 0);

  const sparePartsCost = validRepairs.reduce((sum, ro) => {
    const devices = ro.devices || [];
    const devicesPartsCost = devices.reduce((dSum, dev) => {
      const pCost = dev.partsCost || 0;
      const itemsCost = (dev.selectedRepairItems || []).reduce((iSum, item) => iSum + ((item.costPrice || 0) * (item.quantity || 1)), 0);
      return dSum + Math.max(pCost, itemsCost);
    }, 0);
    return sum + devicesPartsCost;
  }, 0);

  const profit = repairRevenue - sparePartsCost;

  return {
    id: 'kpi-repair-profit',
    titleAr: 'أرباح الصيانة',
    titleEn: 'Repair Profit',
    value: profit,
    formattedValue: formatCurrency(profit),
    unit: 'EGP',
    category: 'finance',
    status: profit >= 0 ? 'good' : 'warning',
    trendStatus: 'NOT_AVAILABLE',
    dataQuality: validRepairs.length > 0 ? 'VALID' : 'INSUFFICIENT_DATA',
    sourceCount: validRepairs.length,
    lastCalculatedAt: nowIso(),
    subtext: 'إيرادات الصيانة - تكلفة قطع الغيار'
  };
}

export function computeOperatingExpensesMetric(): KPIItem {
  const expenses = db.getExpenses() || [];
  const validExpenses = expenses.filter(exp => !exp.isCancelled);
  const total = validExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

  return {
    id: 'kpi-operating-expenses',
    titleAr: 'المصروفات التشغيلية',
    titleEn: 'Operating Expenses',
    value: total,
    formattedValue: formatCurrency(total),
    unit: 'EGP',
    category: 'finance',
    status: 'normal',
    trendStatus: 'NOT_AVAILABLE',
    dataQuality: validExpenses.length > 0 ? 'VALID' : 'INSUFFICIENT_DATA',
    sourceCount: validExpenses.length,
    lastCalculatedAt: nowIso(),
    subtext: 'إجمالي المصروفات العامة المحسوبة'
  };
}

export function computeNetBusinessProfitMetric(repairProfit: number): KPIItem {
  const expensesMetric = computeOperatingExpensesMetric();
  const netProfit = repairProfit - (typeof expensesMetric.value === 'number' ? expensesMetric.value : 0);

  return {
    id: 'kpi-net-business-profit',
    titleAr: 'صافي أرباح النشاط',
    titleEn: 'Net Business Profit',
    value: netProfit,
    formattedValue: formatCurrency(netProfit),
    unit: 'EGP',
    category: 'finance',
    status: netProfit >= 0 ? 'good' : 'warning',
    trendStatus: 'NOT_AVAILABLE',
    dataQuality: (expensesMetric.sourceCount > 0 || repairProfit !== 0) ? 'VALID' : 'INSUFFICIENT_DATA',
    sourceCount: expensesMetric.sourceCount,
    lastCalculatedAt: nowIso(),
    subtext: 'أرباح الصيانة - المصروفات التشغيلية'
  };
}

export function computeActiveRepairsMetric(): KPIItem {
  const repairOrders = db.getRepairOrders() || [];
  const activeStatuses = [
    'Received',
    'Diagnosing',
    'Waiting Approval',
    'Waiting Parts',
    'Repairing',
    'Testing',
    'Ready'
  ];
  const count = repairOrders.filter(ro => activeStatuses.includes(ro.status)).length;

  return {
    id: 'kpi-active-repairs',
    titleAr: 'أجهزة قيد الصيانة',
    titleEn: 'Active Repairs',
    value: count,
    formattedValue: `${count}`,
    unit: 'أجهزة',
    category: 'repairs',
    status: 'normal',
    trendStatus: 'NOT_AVAILABLE',
    dataQuality: 'VALID',
    sourceCount: repairOrders.length,
    lastCalculatedAt: nowIso(),
    subtext: 'طلبات صيانة نشطة بالمحل'
  };
}

export function computeCompletedRepairsMetric(): KPIItem {
  const repairOrders = db.getRepairOrders() || [];
  const count = repairOrders.filter(ro => ro.status === 'Delivered').length;

  return {
    id: 'kpi-completed-repairs',
    titleAr: 'صيانة مكتملة ومسلمة',
    titleEn: 'Completed Repairs',
    value: count,
    formattedValue: `${count}`,
    unit: 'أجهزة',
    category: 'repairs',
    status: 'good',
    trendStatus: 'NOT_AVAILABLE',
    dataQuality: 'VALID',
    sourceCount: repairOrders.length,
    lastCalculatedAt: nowIso(),
    subtext: 'تم تسليمها بنجاح للعميل'
  };
}

export function computeCompletionRateMetric(): KPIItem {
  const repairOrders = db.getRepairOrders() || [];
  const validOrders = repairOrders.filter(ro => ro.status !== 'Cancelled');
  const completed = validOrders.filter(ro => ro.status === 'Delivered').length;

  if (validOrders.length === 0) {
    return {
      id: 'kpi-completion-rate',
      titleAr: 'نسبة إنجاز الصيانة',
      titleEn: 'Completion Rate',
      value: 0,
      formattedValue: '0%',
      unit: '%',
      category: 'repairs',
      status: 'normal',
      trendStatus: 'NOT_AVAILABLE',
      dataQuality: 'INSUFFICIENT_DATA',
      sourceCount: 0,
      lastCalculatedAt: nowIso(),
      subtext: 'لا توجد طلبات صيانة مسجلة'
    };
  }

  const rate = Math.round((completed / validOrders.length) * 1000) / 10;

  return {
    id: 'kpi-completion-rate',
    titleAr: 'نسبة إنجاز الصيانة',
    titleEn: 'Completion Rate',
    value: rate,
    formattedValue: `${rate}%`,
    unit: '%',
    category: 'repairs',
    status: rate >= 70 ? 'good' : rate >= 40 ? 'normal' : 'attention',
    trendStatus: 'NOT_AVAILABLE',
    dataQuality: 'VALID',
    sourceCount: validOrders.length,
    lastCalculatedAt: nowIso(),
    subtext: 'الطلبات المسلمة / إجمالي الطلبات'
  };
}

export function computeAverageRepairDurationMetric(): KPIItem {
  const repairOrders = db.getRepairOrders() || [];
  const delivered = repairOrders.filter(ro => ro.status === 'Delivered');

  const validDurationsHours: number[] = [];

  delivered.forEach(ro => {
    const start = ro.receivedDate ? new Date(ro.receivedDate).getTime() : 0;
    const endStr = ro.deliveredAt || ro.completionDate;
    const end = endStr ? new Date(endStr).getTime() : 0;

    if (start > 0 && end > 0 && end >= start) {
      const diffHours = (end - start) / (1000 * 60 * 60);
      if (!isNaN(diffHours) && isFinite(diffHours)) {
        validDurationsHours.push(diffHours);
      }
    }
  });

  if (validDurationsHours.length === 0) {
    return {
      id: 'kpi-avg-repair-duration',
      titleAr: 'متوسط زمن الصيانة',
      titleEn: 'Average Repair Duration',
      value: 0,
      formattedValue: 'UNAVAILABLE',
      unit: '',
      category: 'repairs',
      status: 'normal',
      trendStatus: 'NOT_AVAILABLE',
      dataQuality: 'UNAVAILABLE',
      sourceCount: delivered.length,
      lastCalculatedAt: nowIso(),
      subtext: 'غير متاح لعدم توفر تواريخ مكتملة'
    };
  }

  const avgHours = validDurationsHours.reduce((a, b) => a + b, 0) / validDurationsHours.length;
  let formatted = '';
  if (avgHours < 24) {
    formatted = `${Math.round(avgHours * 10) / 10} ساعة`;
  } else {
    formatted = `${Math.round((avgHours / 24) * 10) / 10} يوم`;
  }

  return {
    id: 'kpi-avg-repair-duration',
    titleAr: 'متوسط زمن الصيانة',
    titleEn: 'Average Repair Duration',
    value: Math.round(avgHours * 10) / 10,
    formattedValue: formatted,
    unit: 'ساعات',
    category: 'repairs',
    status: 'normal',
    trendStatus: 'NOT_AVAILABLE',
    dataQuality: 'VALID',
    sourceCount: validDurationsHours.length,
    lastCalculatedAt: nowIso(),
    subtext: 'من الاستلام حتى التسليم النهائي'
  };
}

export function computeAverageInvoiceValueMetric(): KPIItem {
  const invoices = db.getInvoices() || [];
  const validInvoices = invoices.filter(inv => !inv.isCancelled);

  if (validInvoices.length === 0) {
    return {
      id: 'kpi-avg-invoice-value',
      titleAr: 'متوسط قيمة الفاتورة',
      titleEn: 'Average Invoice Value',
      value: 0,
      formattedValue: formatCurrency(0),
      unit: 'EGP',
      category: 'finance',
      status: 'normal',
      trendStatus: 'NOT_AVAILABLE',
      dataQuality: 'INSUFFICIENT_DATA',
      sourceCount: 0,
      lastCalculatedAt: nowIso(),
      subtext: 'لا توجد فواتير صادرة'
    };
  }

  const sum = validInvoices.reduce((acc, inv) => acc + (inv.totalAmount || 0), 0);
  const avg = Math.round(sum / validInvoices.length);

  return {
    id: 'kpi-avg-invoice-value',
    titleAr: 'متوسط قيمة الفاتورة',
    titleEn: 'Average Invoice Value',
    value: avg,
    formattedValue: formatCurrency(avg),
    unit: 'EGP',
    category: 'finance',
    status: 'normal',
    trendStatus: 'NOT_AVAILABLE',
    dataQuality: 'VALID',
    sourceCount: validInvoices.length,
    lastCalculatedAt: nowIso(),
    subtext: 'إجمالي قيمة الفواتير / عددها'
  };
}

export function computePendingPaymentsMetric(): KPIItem {
  const invoices = db.getInvoices() || [];
  const unpaidInvoices = invoices.filter(inv => !inv.isCancelled && !inv.isPaid);

  const pendingSum = unpaidInvoices.reduce((sum, inv) => {
    const remaining = Math.max(0, (inv.totalAmount || 0) - (inv.paidAmount || 0));
    return sum + remaining;
  }, 0);

  return {
    id: 'kpi-pending-payments',
    titleAr: 'المبالغ المتبقية للتحصيل',
    titleEn: 'Pending Payments',
    value: pendingSum,
    formattedValue: formatCurrency(pendingSum),
    unit: 'EGP',
    category: 'finance',
    status: pendingSum > 0 ? 'attention' : 'good',
    trendStatus: 'NOT_AVAILABLE',
    dataQuality: unpaidInvoices.length > 0 ? 'VALID' : 'INSUFFICIENT_DATA',
    sourceCount: unpaidInvoices.length,
    lastCalculatedAt: nowIso(),
    subtext: 'مبالغ فواتير غير مسددة بالكامل'
  };
}

export function computeInventoryValueMetric(): KPIItem {
  const products = db.getProducts() || [];
  const activeProducts = products.filter(p => !p.isArchived && p.isActive !== false);

  const totalValue = activeProducts.reduce((sum, p) => {
    return sum + ((p.purchasePrice || 0) * (p.quantity || 0));
  }, 0);

  return {
    id: 'kpi-inventory-value',
    titleAr: 'إجمالي قيمة المخزون',
    titleEn: 'Inventory Value',
    value: totalValue,
    formattedValue: formatCurrency(totalValue),
    unit: 'EGP',
    category: 'inventory',
    status: 'normal',
    trendStatus: 'NOT_AVAILABLE',
    dataQuality: activeProducts.length > 0 ? 'VALID' : 'INSUFFICIENT_DATA',
    sourceCount: activeProducts.length,
    lastCalculatedAt: nowIso(),
    subtext: 'تقييم الأصناف بسعر الشراء'
  };
}

export function computeLowStockItemsMetric(): KPIItem {
  const products = db.getProducts() || [];
  const activeProducts = products.filter(p => !p.isArchived && p.isActive !== false);

  const lowStockProducts = activeProducts.filter(p => {
    return typeof p.minStock === 'number' && p.minStock >= 0 && (p.quantity || 0) <= p.minStock;
  });

  return {
    id: 'kpi-low-stock-items',
    titleAr: 'أصناف منخفضة المخزون',
    titleEn: 'Low Stock Items',
    value: lowStockProducts.length,
    formattedValue: `${lowStockProducts.length}`,
    unit: 'صنف',
    category: 'inventory',
    status: lowStockProducts.length > 0 ? 'attention' : 'good',
    trendStatus: 'NOT_AVAILABLE',
    dataQuality: activeProducts.length > 0 ? 'VALID' : 'INSUFFICIENT_DATA',
    sourceCount: activeProducts.length,
    lastCalculatedAt: nowIso(),
    subtext: 'الأصناف المتساوية أو دون الحد الأدنى'
  };
}

export function computeSyncQueueStatusMetrics(): {
  pendingSyncItems: KPIItem;
  failedSyncItems: KPIItem;
  conflictItems: KPIItem;
} {
  const queue = syncQueue.list() || [];

  const pending = queue.filter(i => i.status === 'Pending').length;
  const failed = queue.filter(i => i.status === 'Failed').length;
  const conflict = queue.filter(i => i.status === 'Conflict').length;

  return {
    pendingSyncItems: {
      id: 'kpi-pending-sync-items',
      titleAr: 'عناصر مزامنة معلقة',
      titleEn: 'Pending Sync Items',
      value: pending,
      formattedValue: `${pending}`,
      unit: 'عنصر',
      category: 'sync',
      status: pending > 0 ? 'attention' : 'normal',
      trendStatus: 'NOT_AVAILABLE',
      dataQuality: 'VALID',
      sourceCount: queue.length,
      lastCalculatedAt: nowIso(),
      subtext: 'في قائمة انتظار المزامنة اليدوية'
    },
    failedSyncItems: {
      id: 'kpi-failed-sync-items',
      titleAr: 'عناصر مزامنة فاشلة',
      titleEn: 'Failed Sync Items',
      value: failed,
      formattedValue: `${failed}`,
      unit: 'عنصر',
      category: 'sync',
      status: failed > 0 ? 'warning' : 'good',
      trendStatus: 'NOT_AVAILABLE',
      dataQuality: 'VALID',
      sourceCount: queue.length,
      lastCalculatedAt: nowIso(),
      subtext: 'تتطلب إعادة المحاولة اليدوية'
    },
    conflictItems: {
      id: 'kpi-conflict-items',
      titleAr: 'عناصر بها تعارض',
      titleEn: 'Conflict Items',
      value: conflict,
      formattedValue: `${conflict}`,
      unit: 'عنصر',
      category: 'sync',
      status: conflict > 0 ? 'warning' : 'good',
      trendStatus: 'NOT_AVAILABLE',
      dataQuality: 'VALID',
      sourceCount: queue.length,
      lastCalculatedAt: nowIso(),
      subtext: 'تتطلب اختيار قرار حل التعارض'
    }
  };
}

export function computeSyncSuccessRateMetric(): KPIItem {
  const auditEvents = getAllAuditEvents() || [];
  const succeeded = auditEvents.filter(e => e.eventType === 'SYNC_SUCCEEDED').length;
  const failed = auditEvents.filter(e => e.eventType === 'SYNC_FAILED').length;

  const totalCompleted = succeeded + failed;

  if (totalCompleted === 0) {
    return {
      id: 'kpi-sync-success-rate',
      titleAr: 'نسبة نجاح المزامنة',
      titleEn: 'Sync Success Rate',
      value: 0,
      formattedValue: 'INSUFFICIENT_DATA',
      unit: '%',
      category: 'sync',
      status: 'normal',
      trendStatus: 'NOT_AVAILABLE',
      dataQuality: 'INSUFFICIENT_DATA',
      sourceCount: 0,
      lastCalculatedAt: nowIso(),
      subtext: 'لا توجد محاولات مزامنة مسجلة'
    };
  }

  const rate = Math.round((succeeded / totalCompleted) * 1000) / 10;

  return {
    id: 'kpi-sync-success-rate',
    titleAr: 'نسبة نجاح المزامنة',
    titleEn: 'Sync Success Rate',
    value: rate,
    formattedValue: `${rate}%`,
    unit: '%',
    category: 'sync',
    status: rate >= 90 ? 'good' : rate >= 70 ? 'normal' : 'warning',
    trendStatus: 'NOT_AVAILABLE',
    dataQuality: 'VALID',
    sourceCount: totalCompleted,
    lastCalculatedAt: nowIso(),
    subtext: 'المحاولات الناجحة / إجمالي المحاولات'
  };
}

export function computeAllDashboardKPIs(): DashboardKPISummary {
  const totalRevenue = computeTotalRevenueMetric();
  const repairProfit = computeRepairProfitMetric();
  const operatingExpenses = computeOperatingExpensesMetric();
  const netBusinessProfit = computeNetBusinessProfitMetric(typeof repairProfit.value === 'number' ? repairProfit.value : 0);

  const activeRepairs = computeActiveRepairsMetric();
  const completedRepairs = computeCompletedRepairsMetric();
  const completionRate = computeCompletionRateMetric();
  const averageRepairDuration = computeAverageRepairDurationMetric();

  const averageInvoiceValue = computeAverageInvoiceValueMetric();
  const pendingPayments = computePendingPaymentsMetric();

  const inventoryValue = computeInventoryValueMetric();
  const lowStockItems = computeLowStockItemsMetric();

  const queueSyncs = computeSyncQueueStatusMetrics();
  const syncSuccessRate = computeSyncSuccessRateMetric();

  return {
    totalRevenue,
    repairProfit,
    netBusinessProfit,
    operatingExpenses,
    activeRepairs,
    completedRepairs,
    completionRate,
    averageRepairDuration,
    averageInvoiceValue,
    pendingPayments,
    inventoryValue,
    lowStockItems,
    pendingSyncItems: queueSyncs.pendingSyncItems,
    failedSyncItems: queueSyncs.failedSyncItems,
    conflictItems: queueSyncs.conflictItems,
    syncSuccessRate
  };
}

export function computeDashboardMetrics(): DashboardMetrics {
  const kpis = computeAllDashboardKPIs();

  return {
    totalRevenue: typeof kpis.totalRevenue.value === 'number' ? kpis.totalRevenue.value : 0,
    formattedTotalRevenue: kpis.totalRevenue.formattedValue,
    totalProfit: typeof kpis.netBusinessProfit.value === 'number' ? kpis.netBusinessProfit.value : 0,
    formattedTotalProfit: kpis.netBusinessProfit.formattedValue,
    activeRepairs: typeof kpis.activeRepairs.value === 'number' ? kpis.activeRepairs.value : 0,
    completedRepairs: typeof kpis.completedRepairs.value === 'number' ? kpis.completedRepairs.value : 0,
    inventoryValue: typeof kpis.inventoryValue.value === 'number' ? kpis.inventoryValue.value : 0,
    formattedInventoryValue: kpis.inventoryValue.formattedValue,
    pendingSyncItems: typeof kpis.pendingSyncItems.value === 'number' ? kpis.pendingSyncItems.value : 0,
    kpis
  };
}

export function computeSystemStatus(): SystemStatusSummary {
  const queue = syncQueue.list() || [];
  const chainVerification = verifyAuditChain();
  const healthMetrics = calculateSyncHealthMetrics();

  const pendingCount = queue.filter(i => i.status === 'Pending').length;
  const syncingCount = queue.filter(i => i.status === 'Syncing').length;
  const failedCount = queue.filter(i => i.status === 'Failed').length;
  const conflictCount = queue.filter(i => i.status === 'Conflict').length;

  let syncStatus: SystemStatusSummary['syncStatus'] = 'IDLE';
  if (conflictCount > 0) syncStatus = 'CONFLICT';
  else if (failedCount > 0) syncStatus = 'FAILED';
  else if (syncingCount > 0) syncStatus = 'SYNCING';
  else if (pendingCount > 0) syncStatus = 'PENDING';

  const auditEvents = getAllAuditEvents() || [];
  const lastSuccessEvent = [...auditEvents]
    .reverse()
    .find(e => e.eventType === 'SYNC_SUCCEEDED');

  const lastSyncTs = lastSuccessEvent ? lastSuccessEvent.timestamp : null;
  const formattedLastSync = lastSyncTs
    ? new Date(lastSyncTs).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })
    : 'لا توجد مزامنة سابقة';

  let systemOverallStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
  if (!chainVerification.valid || conflictCount > 0 || failedCount > 0) {
    systemOverallStatus = 'CRITICAL';
  } else if (pendingCount > 0 || healthMetrics.dataQuality === 'INSUFFICIENT_DATA') {
    systemOverallStatus = 'WARNING';
  }

  return {
    syncStatus,
    auditHealth: {
      chainValid: chainVerification.valid,
      failureType: chainVerification.failureType,
      healthScorePercentage: healthMetrics.scorePercentage,
      healthGrade: healthMetrics.healthGrade,
      totalEvents: chainVerification.totalEvents,
      verifiedEvents: chainVerification.verifiedEvents
    },
    queueSize: queue.length,
    pendingQueueCount: pendingCount,
    failedQueueCount: failedCount,
    conflictQueueCount: conflictCount,
    lastSuccessfulSyncTimestamp: lastSyncTs,
    formattedLastSync,
    systemOverallStatus
  };
}

export function computeRecentActivities(): RecentActivityItem[] {
  const activities: RecentActivityItem[] = [];

  // 1. Audit events
  const auditEvents = getAllAuditEvents() || [];
  auditEvents.slice(-5).forEach(evt => {
    activities.push({
      id: `AUDIT-${evt.eventId || evt.sequenceNumber}`,
      type: 'SYNC',
      title: `مزامنة: ${evt.eventType}`,
      description: `${evt.entityType} (${evt.entityId}) - العملية: ${evt.operation}`,
      timestamp: evt.timestamp,
      formattedTime: new Date(evt.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      actor: evt.actor,
      status: evt.result === 'SUCCESS' ? 'success' : evt.result === 'FAILED' ? 'failed' : 'info'
    });
  });

  // 2. Recent Repair Orders
  const repairOrders = db.getRepairOrders() || [];
  repairOrders.slice(-5).forEach(ro => {
    activities.push({
      id: `RO-${ro.id}`,
      type: 'REPAIR',
      title: `طلب صيانة ${ro.id}`,
      description: `${ro.customerNameSnapshot || ro.guestCustomerName || 'عميل'} - حالة: ${ro.status}`,
      timestamp: ro.receivedDate || new Date().toISOString(),
      formattedTime: ro.receivedDate ? new Date(ro.receivedDate).toLocaleDateString('ar-EG') : 'الآن',
      actor: 'فريق الصيانة',
      status: ro.status === 'Delivered' ? 'success' : 'pending'
    });
  });

  // 3. Activity Logs from db
  const dbLogs = db.getActivityLogs() || [];
  dbLogs.slice(-5).forEach(log => {
    activities.push({
      id: `LOG-${log.id}`,
      type: 'SYSTEM',
      title: log.action || 'نشاط نظام',
      description: log.details || '',
      timestamp: log.timestamp || new Date().toISOString(),
      formattedTime: log.timestamp ? new Date(log.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : 'الآن',
      actor: log.userName || 'النظام',
      status: 'info'
    });
  });

  return activities
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 8);
}

export function computeQuickStats(): QuickStatItem[] {
  const kpis = computeAllDashboardKPIs();

  return [
    {
      id: 'stat-completion-rate',
      labelAr: 'نسبة إنجاز الصيانة',
      labelEn: 'Completion Rate',
      value: kpis.completionRate.formattedValue,
      subtext: kpis.completionRate.subtext,
      category: 'repairs',
      status: kpis.completionRate.status === 'good' ? 'good' : 'normal'
    },
    {
      id: 'stat-low-stock',
      labelAr: 'أصناف منخفضة المخزون',
      labelEn: 'Low Stock Items',
      value: kpis.lowStockItems.formattedValue,
      subtext: kpis.lowStockItems.subtext,
      category: 'inventory',
      status: kpis.lowStockItems.status === 'attention' ? 'attention' : 'good'
    },
    {
      id: 'stat-pending-payments',
      labelAr: 'المبالغ المتبقية للتحصيل',
      labelEn: 'Pending Payments',
      value: kpis.pendingPayments.formattedValue,
      subtext: kpis.pendingPayments.subtext,
      category: 'finance',
      status: kpis.pendingPayments.status === 'attention' ? 'attention' : 'good'
    }
  ];
}

export function computeRecentRepairOrders(limit: number = 5): RecentRepairOrderViewModel[] {
  const repairOrders = db.getRepairOrders() || [];
  const users = db.getUsers() || [];
  const allInvoices = db.getInvoices() || [];

  // Sort descending by receivedDate or createdAt timestamp safely
  const sortedOrders = [...repairOrders].sort((a, b) => {
    const timeA = a.receivedDate ? new Date(a.receivedDate).getTime() : 0;
    const timeB = b.receivedDate ? new Date(b.receivedDate).getTime() : 0;
    return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
  });

  const sliced = sortedOrders.slice(0, Math.max(1, limit));

  return sliced.map(order => {
    const firstDevice = order.devices && order.devices.length > 0 ? order.devices[0] : null;

    // Device Model
    const deviceModel = firstDevice
      ? (firstDevice.model || firstDevice.type || 'غير محدد')
      : 'غير محدد';

    // Device Image
    const deviceImage = firstDevice?.imageUrl || (firstDevice as any)?.image;

    // Customer Name & Phone
    const customerName =
      order.customerNameSnapshot ||
      order.customerName ||
      order.guestCustomerName ||
      'عميل غير محدد';

    const customerPhone =
      order.customerPhoneSnapshot ||
      order.customerPhone ||
      order.guestCustomerPhone ||
      'لا يوجد رقم';

    // Technician Name
    let technicianName = 'غير معين';
    if (firstDevice?.technicianId) {
      const techUser = users.find(u => u.id === firstDevice.technicianId);
      if (techUser) {
        technicianName = techUser.fullName || techUser.name || 'غير معين';
      } else {
        technicianName = firstDevice.technicianId;
      }
    }

    // Issue Summary
    const issueSummary =
      firstDevice?.issue ||
      (firstDevice?.reportedFaults && firstDevice.reportedFaults.length > 0
        ? firstDevice.reportedFaults.join(', ')
        : order.notes) ||
      'لا يوجد وصف للشكوى';

    // Received At
    const receivedAt = order.receivedDate || 'غير محدد';

    // Calculate daysInWorkshop
    let daysInWorkshop: number | 'UNAVAILABLE' = 'UNAVAILABLE';
    if (order.receivedDate) {
      const startMs = new Date(order.receivedDate).getTime();
      if (!isNaN(startMs)) {
        let endMs = Date.now();
        if (order.status === 'Delivered' || order.status === 'Cancelled' || order.completionDate || order.deliveredAt) {
          const endDateStr = order.completionDate || order.deliveredAt;
          if (endDateStr) {
            const parsedEnd = new Date(endDateStr).getTime();
            if (!isNaN(parsedEnd)) {
              endMs = parsedEnd;
            }
          }
        }
        const diffMs = endMs - startMs;
        daysInWorkshop = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      }
    }

    // Status Fallback Presentation Safety
    const status = order.status && typeof order.status === 'string' && order.status.trim() !== ''
      ? order.status
      : 'UNKNOWN';

    // Remaining Amount calculation with nullish coalescing & numeric safety
    const rawBase = order.finalRepairPrice ?? order.totalEstimatedCost;
    const baseAmount = typeof rawBase === 'number' && !isNaN(rawBase) && isFinite(rawBase)
      ? Math.max(0, rawBase)
      : (Number(rawBase) > 0 ? Number(rawBase) : 0);

    const rawDiscount = Number(order.discount);
    const discount = !isNaN(rawDiscount) && isFinite(rawDiscount) && rawDiscount > 0 ? rawDiscount : 0;

    const netTotal = Math.max(0, baseAmount - discount);

    const rawAdvance = Number(order.advancePayment);
    const advancePaid = !isNaN(rawAdvance) && isFinite(rawAdvance) && rawAdvance > 0 ? rawAdvance : 0;

    // Filter and deduplicate invoices for this order
    const seenInvoiceIds = new Set<string>();
    let invoicesPaidSum = 0;

    for (const inv of allInvoices) {
      if (inv.orderId === order.id && inv.isPaid && !inv.isCancelled) {
        if (!seenInvoiceIds.has(inv.id)) {
          seenInvoiceIds.add(inv.id);
          const rawInvPaid = Number(inv.paidAmount);
          if (!isNaN(rawInvPaid) && isFinite(rawInvPaid) && rawInvPaid > 0) {
            invoicesPaidSum += rawInvPaid;
          }
        }
      }
    }

    const totalPaid = advancePaid + invoicesPaidSum;
    const remainingAmount = Math.max(0, netTotal - totalPaid);

    return {
      orderId: order.id,
      orderNumber: order.id,
      deviceModel,
      deviceImage,
      customerName,
      customerPhone,
      technicianName,
      issueSummary,
      status,
      receivedAt,
      daysInWorkshop,
      remainingAmount,
      rawOrderId: order.id
    };
  });
}

