/**
 * RecentRepairOrders Component (Phase 3UI.1 - Device Asset Library & Recent Repair Orders)
 * Displays recent repair orders with device thumbnails, status badges, customer info, and workshop duration.
 * Supports desktop RTL table layout and mobile compact cards. Zero hardcoded mock data.
 * @license Apache-2.0
 */

import React from 'react';
import { RecentRepairOrderViewModel, getRepairStatusConfig } from '../../lib/dashboard';
import { Wrench, ExternalLink, Calendar, User, Phone, Clock } from 'lucide-react';
import AppCard from '../common/AppCard';
import DeviceThumbnail from '../common/DeviceThumbnail';
import StatusBadge from '../common/StatusBadge';
import EmptyState from '../common/EmptyState';

export interface RecentRepairOrdersProps {
  orders: RecentRepairOrderViewModel[];
  onOpenOrder?: (orderId: string) => void;
  onNavigateToRepairs?: () => void;
}

export const RecentRepairOrders: React.FC<RecentRepairOrdersProps> = ({
  orders,
  onOpenOrder,
  onNavigateToRepairs
}) => {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('ar-EG', {
      style: 'currency',
      currency: 'EGP',
      maximumFractionDigits: 0
    }).format(val);
  };

  const formatReceivedDate = (dateStr?: string) => {
    if (!dateStr || dateStr === 'غير محدد') return 'غير محدد';
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) return dateStr;
    return parsed.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDaysInWorkshop = (days: number | 'UNAVAILABLE') => {
    if (days === 'UNAVAILABLE') return 'غير متاح';
    if (days === 0) return 'اليوم';
    if (days === 1) return 'يوم واحد';
    if (days === 2) return 'يومان';
    if (days >= 3 && days <= 10) return `${days} أيام`;
    return `${days} يومًا`;
  };

  return (
    <AppCard
      header={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">
              آخر أوامر الصيانة (Recent Repair Orders)
            </h3>
          </div>
          {onNavigateToRepairs && (
            <button
              onClick={onNavigateToRepairs}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 transition cursor-pointer"
            >
              <span>عرض كافة الأوامر</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      }
      padding="md"
    >
      {orders.length === 0 ? (
        <EmptyState
          title="لا توجد أوامر صيانة حتى الآن"
          description="لم يتم تسجيل أي طلبات صيانة في النظام. يمكنك إضافة طلب صيانة جديد من الشاشة الرئيسية."
        />
      ) : (
        <>
          {/* Desktop Table View (md and above) */}
          <div className="hidden md:block overflow-x-auto">
            <table dir="rtl" className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-bold bg-slate-950/60">
                  <th className="py-3 px-3">الجهاز</th>
                  <th className="py-3 px-3">رقم الطلب</th>
                  <th className="py-3 px-3">العميل</th>
                  <th className="py-3 px-3">العطل / الشكوى</th>
                  <th className="py-3 px-3">الفني</th>
                  <th className="py-3 px-3">الاستلام</th>
                  <th className="py-3 px-3">مدة البقاء</th>
                  <th className="py-3 px-3">الحالة</th>
                  <th className="py-3 px-3">المتبقي</th>
                  <th className="py-3 px-3 text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {orders.map((order) => {
                  const statusConfig = getRepairStatusConfig(order.status);
                  return (
                    <tr
                      key={order.orderId}
                      className="hover:bg-slate-900/50 transition-colors"
                    >
                      {/* Device Image + Model */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <DeviceThumbnail
                            src={order.deviceImage}
                            modelName={order.deviceModel}
                            size="sm"
                            previewOnHover
                          />
                          <span className="font-bold text-slate-200 line-clamp-1">
                            {order.deviceModel}
                          </span>
                        </div>
                      </td>

                      {/* Order Number */}
                      <td className="py-3 px-3 font-mono font-bold text-indigo-400 whitespace-nowrap">
                        {order.orderNumber}
                      </td>

                      {/* Customer Name & Phone */}
                      <td className="py-3 px-3">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-slate-200 line-clamp-1">
                            {order.customerName}
                          </div>
                          <div className="text-[10px] font-mono text-slate-500">
                            {order.customerPhone}
                          </div>
                        </div>
                      </td>

                      {/* Issue Summary */}
                      <td className="py-3 px-3 max-w-[180px]">
                        <p className="text-slate-400 line-clamp-2 text-[11px] leading-tight">
                          {order.issueSummary}
                        </p>
                      </td>

                      {/* Technician */}
                      <td className="py-3 px-3 text-slate-300 font-medium whitespace-nowrap">
                        {order.technicianName}
                      </td>

                      {/* Received At */}
                      <td className="py-3 px-3 font-mono text-slate-400 whitespace-nowrap">
                        {formatReceivedDate(order.receivedAt)}
                      </td>

                      {/* Days in Workshop */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                          <Clock className="w-3 h-3 text-amber-400" />
                          {formatDaysInWorkshop(order.daysInWorkshop)}
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <StatusBadge
                          label={statusConfig.labelAr}
                          variant={statusConfig.variant}
                          size="sm"
                        />
                      </td>

                      {/* Remaining Amount */}
                      <td className="py-3 px-3 whitespace-nowrap font-mono font-extrabold text-slate-100">
                        {order.remainingAmount > 0 ? (
                          <span className="text-rose-400">{formatCurrency(order.remainingAmount)}</span>
                        ) : (
                          <span className="text-emerald-400">مسدد بالكامل</span>
                        )}
                      </td>

                      {/* Open Action Button */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <button
                          onClick={() => onOpenOrder ? onOpenOrder(order.rawOrderId) : onNavigateToRepairs && onNavigateToRepairs()}
                          className="p-1.5 rounded-lg bg-indigo-950/80 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 transition cursor-pointer"
                          title="فتح تفاصيل أمر الصيانة"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View (< md) */}
          <div className="md:hidden space-y-3">
            {orders.map((order) => {
              const statusConfig = getRepairStatusConfig(order.status);
              return (
                <div
                  key={order.orderId}
                  className="bg-slate-950/90 border border-slate-800 p-3.5 rounded-xl space-y-3"
                >
                  {/* Card Header: Device Thumbnail + Model + Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <DeviceThumbnail
                        src={order.deviceImage}
                        modelName={order.deviceModel}
                        size="md"
                      />
                      <div>
                        <div className="text-xs font-bold text-white line-clamp-1">
                          {order.deviceModel}
                        </div>
                        <div className="text-[10px] font-mono font-bold text-indigo-400 mt-0.5">
                          {order.orderNumber}
                        </div>
                      </div>
                    </div>
                    <StatusBadge
                      label={statusConfig.labelAr}
                      variant={statusConfig.variant}
                      size="sm"
                    />
                  </div>

                  {/* Customer & Issue Info */}
                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80">
                    <div>
                      <span className="text-[10px] text-slate-500 block flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400" />
                        العميل:
                      </span>
                      <span className="font-semibold text-slate-200 block truncate">
                        {order.customerName}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        الهاتف:
                      </span>
                      <span className="font-mono text-slate-300 block truncate">
                        {order.customerPhone}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 bg-slate-900/30 p-2 rounded border border-slate-800/40 line-clamp-2">
                    <span className="text-slate-500 font-bold">الشكوى: </span>
                    {order.issueSummary}
                  </p>

                  {/* Footer Metrics & Action Button */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-900 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                        <Calendar className="w-3 h-3 text-amber-400" />
                        {formatDaysInWorkshop(order.daysInWorkshop)}
                      </span>
                      <span className="font-mono font-bold text-slate-200">
                        {order.remainingAmount > 0 ? (
                          <span className="text-rose-400">{formatCurrency(order.remainingAmount)}</span>
                        ) : (
                          <span className="text-emerald-400">مسدد</span>
                        )}
                      </span>
                    </div>

                    <button
                      onClick={() => onOpenOrder ? onOpenOrder(order.rawOrderId) : onNavigateToRepairs && onNavigateToRepairs()}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                    >
                      <span>فتح</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </AppCard>
  );
};

export default RecentRepairOrders;
