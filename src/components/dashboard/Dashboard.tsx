/**
 * Dashboard Main Container Component (Phase 3UI.2C - Real Analytics Engine & Executive Charts)
 * Executive layout with dynamic time-based greeting, Quick Actions bar, Date Range filter,
 * Recharts Revenue Area Chart, Profit Breakdown Card, Repair Status Donut Chart, Device Bar Chart,
 * Technician Performance Table, and Activity Timeline Widget.
 * All computations, KPIs, metrics, and selectors are strictly preserved without alteration.
 * @license Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  getDashboardKPIs,
  getSystemStatus,
  getRecentActivities,
  getRecentRepairOrders,
  KPIItem
} from '../../lib/dashboard';
import { db } from '../../lib/db';
import {
  getAnalyticsViewModel,
  DateRangeOption
} from '../../lib/analytics';

import KPICard from './KPICard';
import RecentActivity from './RecentActivity';
import RecentRepairOrders from './RecentRepairOrders';
import AppCard from '../common/AppCard';
import StatusBadge from '../common/StatusBadge';
import EmptyState from '../common/EmptyState';

import DateRangeSelector from './charts/DateRangeSelector';
import RevenueChart from './charts/RevenueChart';
import ProfitBreakdownCard from './charts/ProfitBreakdownCard';
import RepairStatusDonutChart from './charts/RepairStatusDonutChart';
import DeviceDistributionBarChart from './charts/DeviceDistributionBarChart';
import TechnicianPerformanceTable from './charts/TechnicianPerformanceTable';
import ActivityTimelineWidget from './charts/ActivityTimelineWidget';

import {
  DollarSign,
  TrendingUp,
  Wrench,
  Clock,
  LayoutDashboard,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  BarChart3,
  PieChart,
  Package,
  Layers,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  UserPlus,
  Receipt,
  PackagePlus,
  FileText,
  Sparkles,
  Users,
  History,
  Landmark
} from 'lucide-react';

export interface DashboardProps {
  onNavigate?: (view: string, params?: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [dateRange, setDateRange] = useState<DateRangeOption>('allTime');

  const kpis = useMemo(() => getDashboardKPIs(), []);
  const systemStatus = useMemo(() => getSystemStatus(), []);
  const activities = useMemo(() => getRecentActivities(), []);
  const recentOrders = useMemo(() => getRecentRepairOrders(5), []);

  // Pure Analytics ViewModel computed strictly via analytics selectors
  const analytics = useMemo(() => getAnalyticsViewModel(dateRange), [dateRange]);

  // Current User & Greeting
  const currentUser = useMemo(() => db.getCurrentUser(), []);
  const userName = currentUser?.name || 'المدير التنفيذي';
  const currentHour = new Date().getHours();
  const timeGreeting = currentHour < 12 ? 'صباح الخير' : 'مساء الخير';

  // Compute operational summaries safely relying on REAL DATA ONLY
  const waitingCount = useMemo(() => {
    const orders = db.getRepairOrders() || [];
    return orders.filter(ro => ['Received', 'Diagnosing', 'Waiting Approval', 'Waiting Parts'].includes(ro.status)).length;
  }, []);

  const readyCount = useMemo(() => {
    const orders = db.getRepairOrders() || [];
    return orders.filter(ro => ['Ready', 'Delivered'].includes(ro.status)).length;
  }, []);

  const waitingRepairsKPI: KPIItem = useMemo(() => ({
    id: 'kpi-waiting-repairs',
    titleAr: 'الأجهزة المنتظرة',
    titleEn: 'Waiting Devices',
    value: waitingCount,
    formattedValue: `${waitingCount}`,
    unit: 'أجهزة',
    category: 'repairs',
    status: waitingCount > 0 ? 'attention' : 'good',
    trendStatus: 'NOT_AVAILABLE',
    dataQuality: 'VALID',
    sourceCount: waitingCount,
    lastCalculatedAt: new Date().toISOString(),
    subtext: 'في انتظار التشخيص، الموافقة، أو قطع الغيار'
  }), [waitingCount]);

  // Real inventory priority grouped alerts
  const inventoryAlerts = useMemo(() => {
    const products = db.getProducts() || [];
    
    const outOfStock = products.filter(p => (p.quantity ?? 0) === 0);
    const lowStock = products.filter(p => {
      const q = p.quantity ?? 0;
      const minS = p.minStock ?? (p as any).minQuantity ?? 5;
      return q > 0 && q <= minS;
    });
    const nearLowStock = products.filter(p => {
      const q = p.quantity ?? 0;
      const minS = p.minStock ?? (p as any).minQuantity ?? 5;
      return q > minS && q <= Math.ceil(minS * 1.5);
    });

    return {
      outOfStock,
      lowStock,
      nearLowStock,
      totalAlertsCount: outOfStock.length + lowStock.length + nearLowStock.length
    };
  }, []);

  const getOverallBadge = () => {
    switch (systemStatus.systemOverallStatus) {
      case 'HEALTHY':
        return (
          <StatusBadge
            label="النظام يعمل بكفاءة عالية (Healthy)"
            variant="success"
            icon={<ShieldCheck className="w-4 h-4" />}
          />
        );
      case 'WARNING':
        return (
          <StatusBadge
            label="تنبيه: توجد عناصر معلقة (Warning)"
            variant="warning"
            icon={<AlertTriangle className="w-4 h-4" />}
          />
        );
      default:
        return (
          <StatusBadge
            label="تنبيه حرج: يتطلب فحص النظام (Critical)"
            variant="danger"
            icon={<ShieldAlert className="w-4 h-4" />}
          />
        );
    }
  };

  // Quick action items available in system
  const quickActions = [
    { id: 'reception', label: 'استقبال جهاز', icon: Wrench, color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20 hover:bg-indigo-600 hover:text-white' },
    { id: 'repair-center', label: 'أمر صيانة جديد', icon: PlusCircle, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20 hover:bg-cyan-600 hover:text-white' },
    { id: 'customers', label: 'عميل جديد', icon: UserPlus, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-600 hover:text-white' },
    { id: 'accounting', label: 'فاتورة جديدة', icon: Receipt, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20 hover:bg-amber-600 hover:text-white' },
    { id: 'inventory', label: 'إضافة قطعة', icon: PackagePlus, color: 'text-teal-400 bg-teal-500/10 border-teal-500/20 hover:bg-teal-600 hover:text-white' },
    { id: 'reports', label: 'التقارير', icon: FileText, color: 'text-violet-400 bg-violet-500/10 border-violet-500/20 hover:bg-violet-600 hover:text-white' }
  ];

  return (
    <div dir="rtl" className="space-y-6 pb-12 transition-all duration-200">
      {/* Executive Dynamic Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800/90 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-start md:items-center gap-4 relative z-10">
          <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 shrink-0 shadow-inner">
            <Sparkles className="w-7 h-7 animate-pulse" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl lg:text-2xl font-extrabold text-white tracking-tight">
                {timeGreeting}، {userName}
              </h1>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              أهلاً بك في لوحة التحكم التنفيذية — ملخص العمليات الحية للنظام
            </p>

            {/* Quick Operational Pills */}
            <div className="flex items-center gap-2 pt-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] font-bold text-slate-300">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                الأجهزة النشطة: <strong className="text-amber-400 font-mono">{kpis.activeRepairs.formattedValue}</strong>
              </span>

              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] font-bold text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                الأجهزة الجاهزة: <strong className="text-emerald-400 font-mono">{readyCount}</strong>
              </span>

              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] font-bold text-slate-300">
                <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                الطلبات المنتظرة: <strong className="text-indigo-400 font-mono">{waitingCount}</strong>
              </span>
            </div>
          </div>
        </div>

        <div className="shrink-0 relative z-10 flex flex-col items-end gap-3">
          {getOverallBadge()}
          <DateRangeSelector value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      {/* Quick Actions Bar */}
      {onNavigate && (
        <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-2xl flex items-center gap-2.5 overflow-x-auto scrollbar-none shadow-md">
          <span className="text-xs font-extrabold text-slate-400 shrink-0 px-2 flex items-center gap-1.5">
            <LayoutDashboard className="w-3.5 h-3.5 text-indigo-400" />
            إجراءات سريعة:
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {quickActions.map((act) => {
              const ActionIcon = act.icon;
              return (
                <button
                  key={act.id}
                  onClick={() => onNavigate(act.id)}
                  className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all duration-200 flex items-center gap-2 cursor-pointer shadow-xs ${act.color}`}
                >
                  <ActionIcon className="w-4 h-4 shrink-0" />
                  <span>{act.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Section 1: Top Summary (4 Key KPIs) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
            ملخص المؤشرات الرئيسية (Top Summary)
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <KPICard kpi={kpis.totalRevenue} icon={<DollarSign className="w-5 h-5" />} accentColor="emerald" />
          <KPICard kpi={kpis.repairProfit} icon={<TrendingUp className="w-5 h-5" />} accentColor="cyan" />
          <KPICard kpi={kpis.activeRepairs} icon={<Wrench className="w-5 h-5" />} accentColor="amber" />
          <KPICard kpi={waitingRepairsKPI} icon={<Clock className="w-5 h-5" />} accentColor="indigo" />
        </div>
      </section>

      {/* Section 2: Executive Charts & Revenue Engine */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
            الرسوم البيانية التنفيذية واقتصادات النشاط (Executive Analytics)
          </h2>
          <span className="text-xs font-bold text-indigo-400 font-mono">
            نطاق البيانات: {analytics.dateRangeLabel}
          </span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Container 1: Revenue Analytics Engine */}
          <AppCard
            header={
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">تحليلات الإيرادات (Revenue Engine)</h3>
              </div>
            }
          >
            <RevenueChart data={analytics.revenueAnalytics} />
          </AppCard>

          {/* Container 2: Profit Analytics Breakdown */}
          <AppCard
            header={
              <div className="flex items-center gap-2">
                <Landmark className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">تحليلات الأرباح والمصروفات (Profit Engine)</h3>
              </div>
            }
          >
            <ProfitBreakdownCard data={analytics.profitAnalytics} />
          </AppCard>
        </div>
      </section>

      {/* Section 3: Operational Breakdown (Status Donut & Device Bar Chart) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            التوزيع التشغيلي وحالات الصيانة (Operational Breakdown)
          </h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Repair Status Donut */}
          <AppCard
            header={
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">توزيع حالات الصيانة (Status Donut)</h3>
              </div>
            }
          >
            <RepairStatusDonutChart data={analytics.repairStatusAnalytics} />
          </AppCard>

          {/* Device Distribution Bar */}
          <AppCard
            header={
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">توزيع الأجهزة والموديلات (Device Distribution)</h3>
              </div>
            }
          >
            <DeviceDistributionBarChart data={analytics.deviceAnalytics} />
          </AppCard>
        </div>
      </section>

      {/* Section 4: Technician Performance & Activity Timeline */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-500"></span>
            أداء الفنيين وسجل الأنشطة المباشر (Team & Activity)
          </h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Technician Performance (Span 2 cols) */}
          <div className="lg:col-span-2">
            <AppCard
              header={
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-teal-400" />
                  <h3 className="text-sm font-bold text-white">مؤشرات أداء الفنيين (Technician Performance)</h3>
                </div>
              }
              padding="sm"
            >
              <TechnicianPerformanceTable data={analytics.technicianAnalytics} />
            </AppCard>
          </div>

          {/* Timeline Widget (Span 1 col) */}
          <div>
            <AppCard
              header={
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-violet-400" />
                  <h3 className="text-sm font-bold text-white">التايم لاين المباشر (Live Activity)</h3>
                </div>
              }
              padding="sm"
            >
              <ActivityTimelineWidget data={analytics.activityTimeline} />
            </AppCard>
          </div>
        </div>
      </section>

      {/* Section 5: Recent Repair Orders */}
      <section className="space-y-3">
        <RecentRepairOrders
          orders={recentOrders}
          onNavigateToRepairs={() => onNavigate && onNavigate('repair-center')}
          onOpenOrder={(orderId) => onNavigate && onNavigate('repair-center', { orderId })}
        />
      </section>

      {/* Section 6: Bottom Area (Categorized Priority Inventory Alerts) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            تنبيهات المخزون والتوريد (Inventory Alerts)
          </h2>
        </div>
        <AppCard
          header={
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-400" />
                <h3 className="text-sm font-bold text-white">أولويات المخزون والنواقص (Stock Priority Alerts)</h3>
              </div>
              {inventoryAlerts.totalAlertsCount > 0 && (
                <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400">
                  {inventoryAlerts.totalAlertsCount} تنبيه
                </span>
              )}
            </div>
          }
        >
          {inventoryAlerts.totalAlertsCount === 0 ? (
            <div className="py-8 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-emerald-400 block">جميع الأصناف في المستويات الآمنة</span>
              <p className="text-[11px] text-slate-500">لا توجد نواقص أو أصناف منخفضة المخزون حالياً.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 🔴 Priority 1: Out of Stock */}
              {inventoryAlerts.outOfStock.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-extrabold text-rose-400 bg-rose-950/30 px-3 py-1.5 rounded-lg border border-rose-500/20">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                      🔴 نفد المخزون ({inventoryAlerts.outOfStock.length})
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {inventoryAlerts.outOfStock.slice(0, 4).map(prod => (
                      <div key={prod.id} className="p-2.5 bg-slate-950/80 border border-rose-500/30 rounded-xl flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-slate-200 block truncate">{prod.nameAr || prod.name || prod.id}</span>
                          <span className="text-[10px] text-slate-500 font-mono">الحد الأدنى: {prod.minStock ?? (prod as any).minQuantity ?? 5}</span>
                        </div>
                        <span className="px-2.5 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[11px] font-mono font-bold rounded-lg shrink-0">
                          نفد (0)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 🟠 Priority 2: Low Stock */}
              {inventoryAlerts.lowStock.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-extrabold text-amber-400 bg-amber-950/30 px-3 py-1.5 rounded-lg border border-amber-500/20">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      🟠 مخزون منخفض ({inventoryAlerts.lowStock.length})
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {inventoryAlerts.lowStock.slice(0, 4).map(prod => (
                      <div key={prod.id} className="p-2.5 bg-slate-950/80 border border-amber-500/30 rounded-xl flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-slate-200 block truncate">{prod.nameAr || prod.name || prod.id}</span>
                          <span className="text-[10px] text-slate-500 font-mono">الحد الأدنى: {prod.minStock ?? (prod as any).minQuantity ?? 5}</span>
                        </div>
                        <span className="px-2.5 py-1 bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[11px] font-mono font-bold rounded-lg shrink-0">
                          متاح: {prod.quantity}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 🟡 Priority 3: Near Low Stock */}
              {inventoryAlerts.nearLowStock.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-extrabold text-yellow-400 bg-yellow-950/20 px-3 py-1.5 rounded-lg border border-yellow-500/20">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                      🟡 يقترب من النفاد ({inventoryAlerts.nearLowStock.length})
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {inventoryAlerts.nearLowStock.slice(0, 4).map(prod => (
                      <div key={prod.id} className="p-2.5 bg-slate-950/80 border border-yellow-500/20 rounded-xl flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-slate-200 block truncate">{prod.nameAr || prod.name || prod.id}</span>
                          <span className="text-[10px] text-slate-500 font-mono">الحد الأدنى: {prod.minStock ?? (prod as any).minQuantity ?? 5}</span>
                        </div>
                        <span className="px-2.5 py-1 bg-yellow-500/10 text-yellow-300 border border-yellow-500/20 text-[11px] font-mono font-bold rounded-lg shrink-0">
                          متاح: {prod.quantity}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </AppCard>
      </section>
    </div>
  );
};

export default Dashboard;



