/**
 * Analytics Pure Computation Metrics (Phase 3UI.2C - Analytics Engine)
 * Pure, side-effect-free calculations for Revenue, Profit, Repair Status, Devices,
 * Technicians, and Timeline. Strictly using actual database records.
 * @license Apache-2.0
 */

import { db } from '../db';
import {
  isDateInRange,
  formatDateKey,
  formatArabicDisplayDate,
  formatCurrencyArabic,
  formatArabicTime
} from './analyticsDateUtils';
import {
  RevenueAnalyticsData,
  RevenuePoint,
  ProfitAnalyticsData,
  RepairStatusAnalyticsData,
  RepairStatusItem,
  DeviceAnalyticsData,
  DeviceCategoryItem,
  TechnicianAnalyticsData,
  TechnicianMetricItem,
  TimelineAnalyticsData,
  TimelineEventItem
} from './analyticsTypes';

const STATUS_CONFIG: Record<string, { labelAr: string; color: string }> = {
  'Received': { labelAr: 'مستلم', color: '#6366f1' },
  'Diagnosing': { labelAr: 'جاري التشخيص', color: '#06b6d4' },
  'Waiting Approval': { labelAr: 'في انتظار الموافقة', color: '#f59e0b' },
  'Waiting Parts': { labelAr: 'في انتظار قطع الغيار', color: '#d97706' },
  'Repairing': { labelAr: 'جاري الإصلاح', color: '#8b5cf6' },
  'Testing': { labelAr: 'قيد الاختبار', color: '#3b82f6' },
  'Ready': { labelAr: 'جاهز للتسليم', color: '#10b981' },
  'Delivered': { labelAr: 'تم التسليم', color: '#059669' },
  'Cancelled': { labelAr: 'ملغي', color: '#f43f5e' },
  'UNKNOWN': { labelAr: 'غير محدد', color: '#64748b' }
};

const DEVICE_CATEGORY_CONFIG: Record<string, { labelAr: string; color: string }> = {
  'PS5': { labelAr: 'بلايستيشن 5', color: '#6366f1' },
  'PS4': { labelAr: 'بلايستيشن 4', color: '#3b82f6' },
  'Xbox': { labelAr: 'إكس بوكس', color: '#10b981' },
  'Nintendo': { labelAr: 'نينتندو سويتش', color: '#f43f5e' },
  'Steam Deck': { labelAr: 'ستيم ديك', color: '#06b6d4' },
  'Other': { labelAr: 'أجهزة أخرى', color: '#8b5cf6' }
};

export function calculateRevenueAnalytics(
  start: Date | null,
  end: Date | null,
  periodLabel: string
): RevenueAnalyticsData {
  const rawInvoices = db.getInvoices() || [];
  const rawRepairOrders = db.getRepairOrders() || [];

  // Deduplicate records by ID
  const invoicesMap = new Map<string, typeof rawInvoices[0]>();
  rawInvoices.forEach(inv => {
    if (inv && inv.id) invoicesMap.set(inv.id, inv);
  });
  const invoices = Array.from(invoicesMap.values());

  const repairsMap = new Map<string, typeof rawRepairOrders[0]>();
  rawRepairOrders.forEach(ro => {
    if (ro && ro.id) repairsMap.set(ro.id, ro);
  });
  const repairOrders = Array.from(repairsMap.values());

  // Filter valid in-range invoices and repairs
  const paidInvoices = invoices.filter(inv => !inv.isCancelled && inv.isPaid && isDateInRange(inv.date, start, end));
  const validRepairs = repairOrders.filter(ro => ro.status !== 'Cancelled' && isDateInRange(ro.receivedDate, start, end));

  const mapByDate: Record<string, { invoice: number; repair: number; dateObj: Date }> = {};

  if (start && end) {
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24));
    if (diffDays <= 60) {
      const cur = new Date(start);
      while (cur <= end) {
        const key = formatDateKey(cur);
        mapByDate[key] = { invoice: 0, repair: 0, dateObj: new Date(cur) };
        cur.setDate(cur.getDate() + 1);
      }
    }
  }

  // POS / Sales invoices (exclude repair-linked invoices to prevent double counting)
  const salesInvoices = paidInvoices.filter(inv => inv.type !== 'repair' && !inv.orderId);
  // Repair invoices (delivery payments or repair payments)
  const repairInvoices = paidInvoices.filter(inv => inv.type === 'repair' || Boolean(inv.orderId));

  let invoiceTotal = 0;
  salesInvoices.forEach(inv => {
    const amount = Number(inv.paidAmount ?? inv.totalAmount) || 0;
    invoiceTotal += amount;
    const dateObj = new Date(inv.date || Date.now());
    const key = formatDateKey(dateObj);
    if (!mapByDate[key]) {
      mapByDate[key] = { invoice: 0, repair: 0, dateObj };
    }
    mapByDate[key].invoice += amount;
  });

  let repairTotal = 0;

  // 1. Add Repair Order Advances (collected upon order receipt)
  validRepairs.forEach(ro => {
    const advance = Number(ro.advancePayment) || 0;
    if (advance > 0) {
      repairTotal += advance;
      const dateObj = new Date(ro.receivedDate || Date.now());
      const key = formatDateKey(dateObj);
      if (!mapByDate[key]) {
        mapByDate[key] = { invoice: 0, repair: 0, dateObj };
      }
      mapByDate[key].repair += advance;
    }
  });

  // 2. Add Repair Invoices (delivery final payments)
  repairInvoices.forEach(inv => {
    const amount = Number(inv.paidAmount ?? inv.totalAmount) || 0;
    if (amount > 0) {
      repairTotal += amount;
      const dateObj = new Date(inv.date || Date.now());
      const key = formatDateKey(dateObj);
      if (!mapByDate[key]) {
        mapByDate[key] = { invoice: 0, repair: 0, dateObj };
      }
      mapByDate[key].repair += amount;
    }
  });

  // 3. Fallback for delivered/ready repairs without an explicit repair invoice or advance
  validRepairs.forEach(ro => {
    const hasLinkedInvoice = repairInvoices.some(inv => inv.orderId === ro.id);
    const advance = Number(ro.advancePayment) || 0;
    if (!hasLinkedInvoice && advance === 0 && (ro.status === 'Delivered' || ro.status === 'Ready')) {
      const finalPrice = Number(ro.finalRepairPrice ?? ro.totalEstimatedCost) || 0;
      if (finalPrice > 0) {
        repairTotal += finalPrice;
        const dateObj = new Date(ro.receivedDate || Date.now());
        const key = formatDateKey(dateObj);
        if (!mapByDate[key]) {
          mapByDate[key] = { invoice: 0, repair: 0, dateObj };
        }
        mapByDate[key].repair += finalPrice;
      }
    }
  });

  const sortedKeys = Object.keys(mapByDate).sort();
  const timeSeries: RevenuePoint[] = sortedKeys.map(key => {
    const item = mapByDate[key];
    const total = item.invoice + item.repair;
    return {
      date: key,
      label: formatArabicDisplayDate(item.dateObj),
      invoiceRevenue: item.invoice,
      repairRevenue: item.repair,
      totalRevenue: total
    };
  });

  const grandTotal = invoiceTotal + repairTotal;
  const hasData = grandTotal > 0 || salesInvoices.length > 0 || validRepairs.length > 0 || repairInvoices.length > 0;

  return {
    timeSeries,
    totalRevenue: grandTotal,
    invoiceRevenueTotal: invoiceTotal,
    repairRevenueTotal: repairTotal,
    periodLabel,
    hasData
  };
}

export function calculateProfitAnalytics(
  start: Date | null,
  end: Date | null
): ProfitAnalyticsData {
  const rawRepairOrders = db.getRepairOrders() || [];
  const rawInvoices = db.getInvoices() || [];
  const rawExpenses = db.getExpenses() || [];

  // Deduplicate
  const repairsMap = new Map<string, typeof rawRepairOrders[0]>();
  rawRepairOrders.forEach(ro => ro?.id && repairsMap.set(ro.id, ro));
  const repairOrders = Array.from(repairsMap.values());

  const invoicesMap = new Map<string, typeof rawInvoices[0]>();
  rawInvoices.forEach(inv => inv?.id && invoicesMap.set(inv.id, inv));
  const invoices = Array.from(invoicesMap.values());

  const validRepairs = repairOrders.filter(ro => ro.status !== 'Cancelled' && isDateInRange(ro.receivedDate, start, end));
  const validInvoices = invoices.filter(inv => !inv.isCancelled && inv.isPaid && isDateInRange(inv.date, start, end));
  const validExpenses = rawExpenses.filter(exp => !exp.isCancelled && isDateInRange(exp.date, start, end));

  // Repair Profit: Repair Revenue - Spare Parts Cost
  let repairRevenue = 0;
  let sparePartsCost = 0;

  validRepairs.forEach(ro => {
    const rev = Number(ro.finalRepairPrice ?? ro.totalEstimatedCost ?? ro.advancePayment) || 0;
    repairRevenue += rev;

    const devices = ro.devices || [];
    devices.forEach(dev => {
      const pCost = Number(dev.partsCost) || 0;
      const itemsCost = (dev.selectedRepairItems || []).reduce((sum, item) => sum + ((Number(item.costPrice) || 0) * (Number(item.quantity) || 1)), 0);
      sparePartsCost += Math.max(pCost, itemsCost);
    });
  });

  const repairProfit = repairRevenue - sparePartsCost;

  // Sales Profit: Sales Revenue - COGS
  let salesRevenue = 0;
  let cogs = 0;

  validInvoices.filter(inv => inv.type !== 'repair' && !inv.orderId).forEach(inv => {
    salesRevenue += Number(inv.paidAmount ?? inv.totalAmount) || 0;
    const items = inv.items || [];
    items.forEach(item => {
      cogs += (Number(item.costPrice) || 0) * (Number(item.quantity) || 1);
    });
  });

  const salesProfit = salesRevenue - cogs;

  // Operating Expenses
  const operatingExpenses = validExpenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);

  // Net Profit = (Repair Profit + Sales Profit) - Operating Expenses
  const netProfit = (repairProfit + salesProfit) - operatingExpenses;
  const totalRevenue = repairRevenue + salesRevenue;
  const marginPercentage = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  const hasData = validRepairs.length > 0 || validInvoices.length > 0 || validExpenses.length > 0;

  return {
    repairProfit,
    salesProfit,
    operatingExpenses,
    netProfit,
    repairRevenue,
    sparePartsCost,
    salesRevenue,
    cogs,
    marginPercentage: isNaN(marginPercentage) || !isFinite(marginPercentage) ? 0 : Math.round(marginPercentage * 10) / 10,
    hasData
  };
}

export function calculateRepairStatusAnalytics(
  start: Date | null,
  end: Date | null
): RepairStatusAnalyticsData {
  const rawRepairOrders = db.getRepairOrders() || [];
  const repairsMap = new Map<string, typeof rawRepairOrders[0]>();
  rawRepairOrders.forEach(ro => ro?.id && repairsMap.set(ro.id, ro));
  const filtered = Array.from(repairsMap.values()).filter(ro => isDateInRange(ro.receivedDate, start, end));

  const counts: Record<string, number> = {};
  filtered.forEach(ro => {
    const st = ro.status || 'UNKNOWN';
    const key = STATUS_CONFIG[st] ? st : 'UNKNOWN';
    counts[key] = (counts[key] || 0) + 1;
  });

  const totalOrders = filtered.length;
  const items: RepairStatusItem[] = Object.entries(counts).map(([stKey, count]) => {
    const config = STATUS_CONFIG[stKey] || STATUS_CONFIG['UNKNOWN'];
    const pct = totalOrders > 0 ? Math.round((count / totalOrders) * 100) : 0;
    return {
      statusKey: stKey,
      labelAr: config.labelAr,
      count,
      percentage: pct,
      color: config.color
    };
  });

  return {
    items: items.sort((a, b) => b.count - a.count),
    totalOrders,
    hasData: totalOrders > 0
  };
}

export function calculateDeviceAnalytics(
  start: Date | null,
  end: Date | null
): DeviceAnalyticsData {
  const rawRepairOrders = db.getRepairOrders() || [];
  const repairsMap = new Map<string, typeof rawRepairOrders[0]>();
  rawRepairOrders.forEach(ro => ro?.id && repairsMap.set(ro.id, ro));
  const filtered = Array.from(repairsMap.values()).filter(ro => isDateInRange(ro.receivedDate, start, end));

  const counts: Record<string, number> = {
    'PS5': 0,
    'PS4': 0,
    'Xbox': 0,
    'Nintendo': 0,
    'Steam Deck': 0,
    'Other': 0
  };

  let totalDevices = 0;

  filtered.forEach(ro => {
    const devices = ro.devices || [];
    if (devices.length > 0) {
      devices.forEach(dev => {
        totalDevices++;
        const str = `${dev.model || ''} ${dev.type || ''}`.toLowerCase();
        if (str.includes('ps5') || str.includes('playstation 5')) counts['PS5']++;
        else if (str.includes('ps4') || str.includes('playstation 4')) counts['PS4']++;
        else if (str.includes('xbox')) counts['Xbox']++;
        else if (str.includes('nintendo') || str.includes('switch')) counts['Nintendo']++;
        else if (str.includes('steam deck') || str.includes('steam')) counts['Steam Deck']++;
        else counts['Other']++;
      });
    } else {
      totalDevices++;
      counts['Other']++;
    }
  });

  const items: DeviceCategoryItem[] = Object.entries(counts)
    .filter(([_, count]) => count > 0 || totalDevices === 0)
    .map(([catKey, count]) => {
      const config = DEVICE_CATEGORY_CONFIG[catKey] || DEVICE_CATEGORY_CONFIG['Other'];
      const pct = totalDevices > 0 ? Math.round((count / totalDevices) * 100) : 0;
      return {
        categoryKey: catKey,
        labelAr: config.labelAr,
        count,
        percentage: pct,
        color: config.color
      };
    });

  return {
    items: items.sort((a, b) => b.count - a.count),
    totalDevices,
    hasData: totalDevices > 0
  };
}

export function calculateTechnicianAnalytics(
  start: Date | null,
  end: Date | null
): TechnicianAnalyticsData {
  const users = db.getUsers() || [];
  const rawRepairOrders = db.getRepairOrders() || [];

  const repairsMap = new Map<string, typeof rawRepairOrders[0]>();
  rawRepairOrders.forEach(ro => ro?.id && repairsMap.set(ro.id, ro));
  const filteredOrders = Array.from(repairsMap.values()).filter(ro => isDateInRange(ro.receivedDate, start, end));

  const techUsers = users.filter(u => u.roleId === 'TECHNICIAN' || u.role === 'technician' || u.roleId === 'ADMIN' || u.roleId === 'OWNER');

  const techMap: Record<string, {
    id: string;
    name: string;
    total: number;
    completed: number;
    inProgress: number;
    durationSumHours: number;
    durationCount: number;
    profitSum: number;
  }> = {};

  techUsers.forEach(u => {
    techMap[u.id] = {
      id: u.id,
      name: u.fullName || u.name || 'فني',
      total: 0,
      completed: 0,
      inProgress: 0,
      durationSumHours: 0,
      durationCount: 0,
      profitSum: 0
    };
  });

  filteredOrders.forEach(ro => {
    if (ro.status === 'Cancelled') return;

    const devices = ro.devices || [];
    const techId = (devices[0] && devices[0].technicianId) || (ro as unknown as { technicianId?: string }).technicianId || 'UNASSIGNED';

    if (!techMap[techId]) {
      techMap[techId] = {
        id: techId,
        name: techId === 'UNASSIGNED' ? 'غير مسند' : techId,
        total: 0,
        completed: 0,
        inProgress: 0,
        durationSumHours: 0,
        durationCount: 0,
        profitSum: 0
      };
    }

    const t = techMap[techId];
    t.total++;

    // Completed definition: Ready or Delivered
    if (ro.status === 'Ready' || ro.status === 'Delivered') {
      t.completed++;

      // Average repair duration (only for completed orders with valid dates)
      const endIso = ro.deliveredAt || ro.completionDate;
      const startIso = ro.receivedDate;
      if (startIso && endIso) {
        const startMs = new Date(startIso).getTime();
        const endMs = new Date(endIso).getTime();
        if (!isNaN(startMs) && !isNaN(endMs) && endMs > startMs) {
          const hours = (endMs - startMs) / (1000 * 3600);
          if (hours > 0) {
            t.durationSumHours += hours;
            t.durationCount++;
          }
        }
      }

      // Partner Profit Distribution mapping:
      // CUSTOMER_SHARED / CUSTOMER_WORK: 50% Ahmed / 50% Abdo
      // PARTNER_1_PRIVATE / AHMED_WORK: 100% Ahmed
      // PARTNER_2_PRIVATE / ABDO_WORK: 75% Abdo / 25% Ahmed
      const workTypeStr = String(ro.workOwnershipType || ro.jobType || '').toUpperCase();
      const rev = Number(ro.finalRepairPrice ?? ro.totalEstimatedCost) || 0;
      const pCost = (ro.devices || []).reduce((sum, d) => {
        const devCost = Number(d.partsCost) || 0;
        const itemsCost = (d.selectedRepairItems || []).reduce((iSum, i) => iSum + ((Number(i.costPrice) || 0) * (Number(i.quantity) || 1)), 0);
        return sum + Math.max(devCost, itemsCost);
      }, 0);
      const grossNet = Math.max(0, rev - pCost);

      if (workTypeStr === 'CUSTOMER_SHARED' || workTypeStr === 'CUSTOMER_WORK' || workTypeStr === 'SHOP') {
        // Partner share 50/50
        if (t.id.toLowerCase().includes('ahmed') || t.id.toLowerCase().includes('partner_1')) {
          t.profitSum += grossNet * 0.5;
        } else if (t.id.toLowerCase().includes('abdo') || t.id.toLowerCase().includes('partner_2')) {
          t.profitSum += grossNet * 0.5;
        }
      } else if (workTypeStr === 'PARTNER_1_PRIVATE' || workTypeStr === 'AHMED_WORK') {
        if (t.id.toLowerCase().includes('ahmed') || t.id.toLowerCase().includes('partner_1')) {
          t.profitSum += grossNet;
        }
      } else if (workTypeStr === 'PARTNER_2_PRIVATE' || workTypeStr === 'ABDO_WORK') {
        if (t.id.toLowerCase().includes('abdo') || t.id.toLowerCase().includes('partner_2')) {
          t.profitSum += grossNet * 0.75;
        } else if (t.id.toLowerCase().includes('ahmed') || t.id.toLowerCase().includes('partner_1')) {
          t.profitSum += grossNet * 0.25;
        }
      } else {
        // Unspecified work ownership type: Do NOT guess 100% to technician.
        // We do not attribute unverified profit to individual employee technician cards without ownership spec.
      }
    } else {
      t.inProgress++;
    }
  });

  const list = Object.values(techMap).filter(t => t.total > 0);

  const technicians: TechnicianMetricItem[] = list.map(t => {
    const avgHrs = t.durationCount > 0 ? Math.round((t.durationSumHours / t.durationCount) * 10) / 10 : 0;
    const compRate = t.total > 0 ? Math.round((t.completed / t.total) * 100) : 0;

    let fmtDur = 'أقل من ساعة';
    if (avgHrs >= 24) {
      fmtDur = `${Math.round(avgHrs / 24)} يوم`;
    } else if (avgHrs >= 1) {
      fmtDur = `${Math.round(avgHrs)} ساعة`;
    }

    return {
      technicianId: t.id,
      technicianName: t.name,
      totalAssigned: t.total,
      completedCount: t.completed,
      inProgressCount: t.inProgress,
      avgRepairDurationHours: isNaN(avgHrs) || !isFinite(avgHrs) ? 0 : avgHrs,
      formattedAvgDuration: fmtDur,
      totalProfitGenerated: t.profitSum,
      formattedProfit: t.profitSum > 0 ? formatCurrencyArabic(t.profitSum) : 'غير محدد (توزيع شركاء)',
      completionRate: isNaN(compRate) || !isFinite(compRate) ? 0 : Math.min(100, Math.max(0, compRate))
    };
  });

  return {
    technicians: technicians.sort((a, b) => b.completedCount - a.completedCount),
    totalTechnicians: technicians.length,
    hasData: technicians.length > 0
  };
}

export function calculateTimelineAnalytics(
  start: Date | null,
  end: Date | null,
  limit: number = 10
): TimelineAnalyticsData {
  const rawRepairOrders = db.getRepairOrders() || [];
  const rawInvoices = db.getInvoices() || [];
  const activityLogs = db.getActivityLogs() || [];

  const rawEvents: TimelineEventItem[] = [];

  // Repair order events
  rawRepairOrders.filter(ro => ro?.id && isDateInRange(ro.receivedDate, start, end)).slice(0, 15).forEach(ro => {
    const dObj = new Date(ro.receivedDate || Date.now());
    const devices = ro.devices || [];
    const techId = (devices[0] && devices[0].technicianId) || 'النظام';

    rawEvents.push({
      id: `ro-${ro.id}`,
      timestamp: ro.receivedDate || new Date().toISOString(),
      formattedDate: formatArabicDisplayDate(dObj),
      formattedTime: formatArabicTime(dObj),
      title: `أمر صيانة #${ro.id}`,
      description: `العميل: ${ro.customerName || 'عام'} - الحالة: ${ro.status}`,
      type: 'repair',
      status: ro.status,
      actorName: techId
    });
  });

  // Invoice events
  rawInvoices.filter(inv => inv?.id && isDateInRange(inv.date, start, end)).slice(0, 15).forEach(inv => {
    const dObj = new Date(inv.date || Date.now());
    rawEvents.push({
      id: `inv-${inv.id}`,
      timestamp: inv.date || new Date().toISOString(),
      formattedDate: formatArabicDisplayDate(dObj),
      formattedTime: formatArabicTime(dObj),
      title: `فاتورة مبيعات #${inv.id}`,
      description: `المبلغ: ${formatCurrencyArabic(inv.totalAmount || 0)} - ${inv.isPaid ? 'مسددة' : 'غير مسددة'}`,
      type: 'invoice',
      actorName: 'الكاشير'
    });
  });

  // Activity logs
  activityLogs.filter(act => act?.id && isDateInRange(act.timestamp, start, end)).slice(0, 15).forEach(act => {
    const dObj = new Date(act.timestamp || Date.now());
    rawEvents.push({
      id: `act-${act.id}`,
      timestamp: act.timestamp || new Date().toISOString(),
      formattedDate: formatArabicDisplayDate(dObj),
      formattedTime: formatArabicTime(dObj),
      title: act.action || 'نشاط للنظام',
      description: act.details || '',
      type: 'system',
      actorName: act.userName || 'المستخدم'
    });
  });

  const sorted = rawEvents
    .filter(ev => !isNaN(new Date(ev.timestamp).getTime()))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);

  return {
    events: sorted,
    hasData: sorted.length > 0
  };
}
