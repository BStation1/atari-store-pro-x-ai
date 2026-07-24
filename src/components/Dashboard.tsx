/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import {
  Wrench,
  Clock,
  CheckCircle,
  TrendingUp,
  Users,
  Search,
  Bell,
  Check,
  ChevronLeft,
  AlertTriangle,
  FileText,
  PlusCircle,
  DollarSign
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { useCustomers, useRepairOrders, useInvoices, useProducts } from "../hooks/useData";
import { RepairStatus, DeviceType, CustomerType } from "../types";
import { getCustomerNameHelper, getCustomerBadgeHelper } from "../lib/customerDisplayHelper";

interface DashboardProps {
  onNavigate: (view: string, subParam?: any) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { customers } = useCustomers();
  const { orders } = useRepairOrders();
  const { invoices } = useInvoices();
  const { products } = useProducts();

  // 1. CALCULATE CORE METRICS
  const totalOrders = orders.length;
  const underRepair = orders.filter(
    o => o.status === RepairStatus.Repairing || o.status === RepairStatus.Diagnosing
  ).length;
  const readyForPickup = orders.filter(o => o.status === RepairStatus.Ready).length;
  
  // Calculate total revenues from invoices
  const totalRevenue = invoices.reduce((sum, inv) => sum + inv.paidAmount, 0);
  const totalCustomers = customers.length;

  // 2. CHART DATA (REVENUE OVER TIME - LAST 7 DAYS)
  const revenueChartData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dayName = d.toLocaleDateString("ar-EG", { day: "numeric", month: "long" });
    const dateString = d.toISOString().split('T')[0];
    
    // Sum invoice amounts for this day
    const dayRevenue = invoices
      .filter(inv => inv.date.startsWith(dateString))
      .reduce((sum, inv) => sum + inv.paidAmount, 0);
      
    return {
      day: dayName,
      "الإيرادات": dayRevenue
    };
  });

  // 3. PIE CHART DATA (ORDER STATUS DISTRIBUTION)
  const statusCounts = orders.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const statusMap = {
    [RepairStatus.Received]: { label: "مستلمة", color: "#6366f1" },
    [RepairStatus.Diagnosing]: { label: "تحت الفحص", color: "#3b82f6" },
    [RepairStatus.WaitingCustomerApproval]: { label: "بانتظار موافقة العميل", color: "#f59e0b" },
    [RepairStatus.WaitingParts]: { label: "بانتظار قطع", color: "#ef4444" },
    [RepairStatus.Repairing]: { label: "قيد الإصلاح", color: "#10b981" },
    [RepairStatus.Testing]: { label: "تحت التجربة", color: "#84cc16" },
    [RepairStatus.Ready]: { label: "جاهزة", color: "#8b5cf6" },
    [RepairStatus.Delivered]: { label: "تم التسليم", color: "#6b7280" },
    [RepairStatus.Cancelled]: { label: "ملغاة", color: "#4b5563" }
  };

  const statusPieData = Object.keys(statusMap).map(statusKey => ({
    name: statusMap[statusKey as RepairStatus].label,
    value: statusCounts[statusKey as RepairStatus] || 0,
    color: statusMap[statusKey as RepairStatus].color
  })).filter(item => item.value > 0);

  // Status mapping for order rows
  const getStatusDisplay = (status: RepairStatus) => {
    switch (status) {
      case RepairStatus.Received:
        return { text: "مستلمة", className: "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" };
      case RepairStatus.Diagnosing:
        return { text: "تحت الفحص", className: "bg-blue-500/10 text-blue-400 border border-blue-500/20" };
      case RepairStatus.WaitingCustomerApproval:
        return { text: "بانتظار الموافقة", className: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20" };
      case RepairStatus.WaitingParts:
        return { text: "بانتظار قطع", className: "bg-orange-500/10 text-orange-400 border border-orange-500/20" };
      case RepairStatus.Repairing:
        return { text: "قيد الإصلاح", className: "bg-green-500/10 text-green-400 border border-green-500/20" };
      case RepairStatus.Testing:
        return { text: "تحت التجربة", className: "bg-lime-500/10 text-lime-400 border border-lime-500/20" };
      case RepairStatus.Ready:
        return { text: "جاهزة للاستلام", className: "bg-purple-500/10 text-purple-400 border border-purple-500/20" };
      case RepairStatus.Delivered:
        return { text: "تم التسليم", className: "bg-gray-500/10 text-gray-400 border border-gray-500/20" };
      case RepairStatus.Cancelled:
        return { text: "ملغاة", className: "bg-red-500/10 text-red-400 border border-red-500/20" };
    }
  };

  // Get low stock alert products
  const lowStockProducts = products.filter(p => p.quantity <= p.minStock);

  return (
    <div className="space-y-6">
      {/* 1. Welcome Header */}
      <div className="bg-[#11131e] border border-[#2a2d42] p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 glow-primary">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            مرحباً بك في Atari Store Pro X 👋
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            إدارة متكاملة واحترافية لمراكز صيانة الأجهزة الإلكترونية والبلايستيشن
          </p>
        </div>
        <div className="text-xs font-mono text-gray-400 bg-gray-950/50 px-4 py-2 rounded-xl border border-[#2a2d42]">
          توقيت النظام: {new Date().toLocaleDateString("ar-EG", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* 2. Top Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Orders */}
        <div className="bg-[#11131e] border border-[#2a2d42] p-5 rounded-xl flex items-center gap-4 hover:border-indigo-500/30 transition-all-custom cursor-pointer" onClick={() => onNavigate("repair-center")}>
          <div className="p-3 rounded-lg bg-indigo-500/10 text-indigo-400">
            <PlusCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-gray-400 text-xs font-medium">إجمالي الطلبات</p>
            <h3 className="text-2xl font-bold text-white mt-1">{totalOrders}</h3>
            <span className="text-green-400 text-[10px] font-bold">▲ الإجمالي بالنظام</span>
          </div>
        </div>

        {/* Under Repair */}
        <div className="bg-[#11131e] border border-[#2a2d42] p-5 rounded-xl flex items-center gap-4 hover:border-blue-500/30 transition-all-custom cursor-pointer" onClick={() => onNavigate("repair-center", { status: RepairStatus.Repairing })}>
          <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <p className="text-gray-400 text-xs font-medium">تحت الصيانة</p>
            <h3 className="text-2xl font-bold text-white mt-1">{underRepair}</h3>
            <span className="text-blue-400 text-[10px] font-bold">▲ قيد العمل</span>
          </div>
        </div>

        {/* Ready for pickup */}
        <div className="bg-[#11131e] border border-[#2a2d42] p-5 rounded-xl flex items-center gap-4 hover:border-purple-500/30 transition-all-custom cursor-pointer" onClick={() => onNavigate("repair-center", { status: RepairStatus.Ready })}>
          <div className="p-3 rounded-lg bg-purple-500/10 text-purple-400">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-gray-400 text-xs font-medium">جاهزة للاستلام</p>
            <h3 className="text-2xl font-bold text-white mt-1">{readyForPickup}</h3>
            <span className="text-purple-400 text-[10px] font-bold">▲ جاهزة للاستلام</span>
          </div>
        </div>

        {/* Revenues */}
        <div className="bg-[#11131e] border border-[#2a2d42] p-5 rounded-xl flex items-center gap-4 hover:border-green-500/30 transition-all-custom cursor-pointer" onClick={() => onNavigate("accounting")}>
          <div className="p-3 rounded-lg bg-green-500/10 text-green-400">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-gray-400 text-xs font-medium">إجمالي الإيرادات</p>
            <h3 className="text-2xl font-bold text-white mt-1">{totalRevenue.toLocaleString()} ج.م</h3>
            <span className="text-green-400 text-[10px] font-bold">▲ محصل بالكامل</span>
          </div>
        </div>

        {/* Customers count */}
        <div className="bg-[#11131e] border border-[#2a2d42] p-5 rounded-xl flex items-center gap-4 hover:border-pink-500/30 transition-all-custom cursor-pointer" onClick={() => onNavigate("customers")}>
          <div className="p-3 rounded-lg bg-pink-500/10 text-pink-400">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-gray-400 text-xs font-medium">العملاء</p>
            <h3 className="text-2xl font-bold text-white mt-1">{totalCustomers}</h3>
            <span className="text-pink-400 text-[10px] font-bold">▲ عملاء مسجلين</span>
          </div>
        </div>
      </div>

      {/* 3. Charts & Actions Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue line chart */}
        <div className="lg:col-span-2 bg-[#11131e] border border-[#2a2d42] p-6 rounded-2xl flex flex-col justify-between h-[380px]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-md font-bold text-white">إيرادات المبيعات والصيانة المؤخرة</h3>
            <div className="text-xs text-gray-400 bg-gray-950 px-3 py-1.5 rounded-lg border border-[#2a2d42]">آخر 7 أيام</div>
          </div>
          <div className="w-full h-full min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueChartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="day" stroke="#9ca3af" fontSize={11} />
                <YAxis stroke="#9ca3af" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: "#161927", borderColor: "#2a2d42", color: "#f3f4f6" }} />
                <Line type="monotone" dataKey="الإيرادات" stroke="#6366f1" strokeWidth={3} activeDot={{ r: 8 }} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Order Status Distribution Donut Chart */}
        <div className="bg-[#11131e] border border-[#2a2d42] p-6 rounded-2xl flex flex-col justify-between h-[380px]">
          <div className="mb-2">
            <h3 className="text-md font-bold text-white">حالات الطلبات</h3>
            <p className="text-gray-400 text-xs mt-1">توزيع أجهزة الصيانة حسب الحالة الحالية</p>
          </div>
          <div className="flex items-center justify-between h-full">
            <div className="w-1/2 h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "#161927", borderColor: "#2a2d42", color: "#f3f4f6", direction: "rtl" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-1/2 space-y-1.5 overflow-y-auto max-h-[200px] pl-2 text-right">
              {statusPieData.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: item.color }}></span>
                    <span className="text-gray-300">{item.name}</span>
                  </div>
                  <span className="text-white font-bold">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Actions & Alerts Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions (Actions from Image Mockup) */}
        <div className="bg-[#11131e] border border-[#2a2d42] p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <h3 className="text-md font-bold text-white mb-4">إجراءات سريعة</h3>
            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => onNavigate("reception")}
                className="w-full bg-[#1e1b4b] hover:bg-indigo-950 text-indigo-300 font-medium py-3 px-4 rounded-xl border border-indigo-500/20 flex items-center justify-between transition-all-custom cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-indigo-400" />
                  طلب صيانة جديد
                </span>
                <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-mono px-2 py-0.5 rounded-md">Ctrl+N</span>
              </button>

              <button
                onClick={() => onNavigate("customers", { focusSearch: true })}
                className="w-full bg-[#111827] hover:bg-gray-800 text-gray-300 font-medium py-3 px-4 rounded-xl border border-gray-700/50 flex items-center justify-between transition-all-custom cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Search className="w-5 h-5 text-gray-400" />
                  بحث عن عميل
                </span>
              </button>

              <button
                onClick={() => onNavigate("customers", { openAddModal: true })}
                className="w-full bg-[#111827] hover:bg-gray-800 text-gray-300 font-medium py-3 px-4 rounded-xl border border-gray-700/50 flex items-center justify-between transition-all-custom cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-gray-400" />
                  إضافة عميل جديد
                </span>
              </button>

              <button
                onClick={() => onNavigate("accounting", { openInvoiceModal: true })}
                className="w-full bg-[#111827] hover:bg-gray-800 text-gray-300 font-medium py-3 px-4 rounded-xl border border-gray-700/50 flex items-center justify-between transition-all-custom cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-gray-400" />
                  فاتورة جديدة
                </span>
              </button>

              <button
                onClick={() => onNavigate("repair-center")}
                className="w-full bg-[#111827] hover:bg-gray-800 text-gray-300 font-medium py-3 px-4 rounded-xl border border-gray-700/50 flex items-center justify-between transition-all-custom cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-gray-400" />
                  عرض كل طلبات الصيانة
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Recent Repairs Table */}
        <div className="bg-[#11131e] border border-[#2a2d42] p-6 rounded-2xl lg:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-md font-bold text-white">طلبات حديثة</h3>
            <button
              onClick={() => onNavigate("repair-center")}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
            >
              عرض الكل
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-[#2a2d42] text-gray-400">
                  <th className="pb-3 pt-1 font-medium pr-2">رقم الطلب</th>
                  <th className="pb-3 pt-1 font-medium">العميل</th>
                  <th className="pb-3 pt-1 font-medium">الجهاز</th>
                  <th className="pb-3 pt-1 font-medium">الحالة</th>
                  <th className="pb-3 pt-1 font-medium pl-2">تاريخ الاستلام</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2d42]/60">
                {orders.slice(0, 5).map((order) => {
                  const custName = getCustomerNameHelper(order, customers);
                  const custBadge = getCustomerBadgeHelper(order);
                  const mainDevice = order.devices[0];
                  const statusInfo = getStatusDisplay(order.status);
                  
                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-white/5 transition-all-custom cursor-pointer"
                      onClick={() => onNavigate("repair-center", { orderId: order.id })}
                    >
                      <td className="py-3 font-mono font-bold text-indigo-400 pr-2">{order.id}</td>
                      <td className="py-3 text-white font-medium">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{custName}</span>
                          <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${
                            custBadge.type === 'REGISTERED' 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          }`}>
                            {custBadge.label}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 text-gray-300">
                        <span className="font-bold text-white">{mainDevice?.type}</span> {mainDevice?.model}
                      </td>
                      <td className="py-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${statusInfo.className}`}>
                          {statusInfo.text}
                        </span>
                      </td>
                      <td className="py-3 text-gray-400 pl-2">
                        {new Date(order.receivedDate).toLocaleDateString("ar-EG")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 5. Notifications/Alerts Section */}
      <div className="bg-[#11131e] border border-[#2a2d42] p-6 rounded-2xl">
        <h3 className="text-md font-bold text-white mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5 text-indigo-400" />
          التنبيهات العاجلة للعمليات والمخزون
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Alert 1 */}
          <div className="bg-[#161927] border border-[#2a2d42] p-4 rounded-xl flex items-start gap-3">
            <div className="p-2 rounded-lg bg-green-500/10 text-green-400 mt-0.5">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">طلب جاهز للاستلام</p>
              <p className="text-[11px] text-gray-400 mt-1">الطلب R-2026-126 جاهز تماماً للاستلام من العميل</p>
              <span className="text-[9px] text-gray-500 mt-2 block font-mono">منذ 5 دقائق</span>
            </div>
          </div>

          {/* Alert 2 */}
          <div className="bg-[#161927] border border-[#2a2d42] p-4 rounded-xl flex items-start gap-3">
            <div className="p-2 rounded-lg bg-red-500/10 text-red-400 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-white">منتجات منخفضة المخزون</p>
              {lowStockProducts.length > 0 ? (
                <p className="text-[11px] text-gray-400 mt-1">
                  يوجد {lowStockProducts.length} منتجات تقارب النفاد: {lowStockProducts[0].name}
                </p>
              ) : (
                <p className="text-[11px] text-gray-400 mt-1">
                  ذراع تحكم PS5 V2 قارب على النفاد من المحل
                </p>
              )}
              <span className="text-[9px] text-gray-500 mt-2 block font-mono">منذ 15 دقيقة</span>
            </div>
          </div>

          {/* Alert 3 */}
          <div className="bg-[#161927] border border-[#2a2d42] p-4 rounded-xl flex items-start gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 mt-0.5">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">دفعة قطع غيار واردة</p>
              <p className="text-[11px] text-gray-400 mt-1">تم تسلّم شحنة باورسبلاي وHDMI PS5 جديدة بنجاح</p>
              <span className="text-[9px] text-gray-500 mt-2 block font-mono">منذ 30 دقيقة</span>
            </div>
          </div>

          {/* Alert 4 */}
          <div className="bg-[#161927] border border-[#2a2d42] p-4 rounded-xl flex items-start gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-400 mt-0.5">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">فواتير مستحقة الدفع</p>
              <p className="text-[11px] text-gray-400 mt-1">فاتورة صيانة محل ألعاب التحرير INV-2026-045 لم تدفع بالكامل</p>
              <span className="text-[9px] text-gray-500 mt-2 block font-mono">منذ 4 ساعات</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
