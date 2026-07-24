import React, { useState } from 'react';
import {
  Users,
  Building2,
  Calendar,
  FileText,
  Printer,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { Expense, MonthlySettlementResult, RepairOrder, WorkOwnershipType } from '../../types';
import { PartnerLedgerEntry } from '../../lib/partnerLedgerEngine';
import { calculateAbdoDashboardData, formatDateISO, roundMoney } from '../../lib/finalReportsEngine';

interface AbdoDashboardViewProps {
  partnerLedger: PartnerLedgerEntry[];
  expenses: Expense[];
  settlements: MonthlySettlementResult[];
  orders?: RepairOrder[];
  currencySymbol?: string;
}

export default function AbdoDashboardView({
  partnerLedger,
  expenses,
  settlements,
  orders = [],
  currencySymbol = 'ج.م.'
}: AbdoDashboardViewProps) {
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const abdoData = calculateAbdoDashboardData(partnerLedger, expenses, settlements, dateFrom, dateTo);

  // Filter repair orders for Abdo's report
  const filteredOrders = orders.filter((o) => {
    if (o.receivedDate) {
      const orderDate = formatDateISO(o.receivedDate);
      if (dateFrom && orderDate < dateFrom) return false;
      if (dateTo && orderDate > dateTo) return false;
    }
    return true;
  });

  // Calculate Abdo's 2 revenue streams from repair orders
  let abdoShopShare = 0;
  let abdoPrivateProfits = 0;

  const orderRows = filteredOrders.map((o) => {
    const orderNum = (o as any).orderNumber || o.id;
    const customer = o.customerNameSnapshot || o.guestCustomerName || 'عميل نقدي';
    const totalInvoice = Number(o.finalRepairPrice ?? o.totalEstimatedCost) || 0;
    const discount = Number(o.discount) || 0;
    const netRevenue = Math.max(0, totalInvoice - discount);
    const partsCost = o.devices?.reduce((sum, d) => sum + (Number(d.partsCost) || 0), 0) || 0;
    const otherCosts = Number(o.otherDirectCosts) || 0;
    const netProfit = Math.max(0, netRevenue - partsCost - otherCosts);

    const ownership = o.workOwnershipType || WorkOwnershipType.CUSTOMER_SHARED;

    let abdoEntitlement = 0;
    let workTypeLabel = 'شغل المحل';
    let entitlementNote = '50% أرباح شراكة المحل';

    if (ownership === WorkOwnershipType.CUSTOMER_SHARED) {
      abdoEntitlement = roundMoney(netProfit * 0.5); // 50%
      abdoShopShare += abdoEntitlement;
      workTypeLabel = 'شغل المحل';
      entitlementNote = '50% نصيب من أرباح المحل';
    } else if (ownership === WorkOwnershipType.PARTNER_2_PRIVATE) {
      abdoEntitlement = roundMoney(netProfit * 0.75); // 75%
      abdoPrivateProfits += abdoEntitlement;
      workTypeLabel = 'شغل عبده';
      entitlementNote = '75% أرباح خاصة لعبده';
    } else if (ownership === WorkOwnershipType.PARTNER_1_PRIVATE) {
      abdoEntitlement = 0;
      workTypeLabel = 'شغل أحمد';
      entitlementNote = 'خاصة بأحمد بالكامل (0% لعبده)';
    }

    return {
      id: o.id,
      orderNum,
      customer,
      date: formatDateISO(o.receivedDate),
      ownership,
      workTypeLabel,
      totalInvoice,
      partsCost,
      netProfit,
      abdoEntitlement,
      entitlementNote
    };
  });

  const roundAbdoShop = roundMoney(abdoShopShare);
  const roundAbdoPrivate = roundMoney(abdoPrivateProfits);
  const totalAbdoIncome = roundMoney(roundAbdoShop + roundAbdoPrivate);

  const handlePrint = () => window.print();

  return (
    <div className="space-y-6">
      {/* Header & Date Filter Bar */}
      <div className="bg-[#11131e] border border-[#2a2d42] p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
          <Users className="w-5 h-5" />
          <span>تقرير وإجمالي دخل عبده (الشريك الثاني)</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#181b2a] border border-[#2a2d42] px-3 py-1.5 rounded-xl text-xs">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="text-gray-400">من:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-transparent text-white outline-none"
            />
            <span className="text-gray-400">إلى:</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-transparent text-white outline-none"
            />
          </div>

          {(dateFrom || dateTo) && (
            <button
              onClick={() => {
                setDateFrom('');
                setDateTo('');
              }}
              className="px-3 py-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-xl text-xs font-semibold"
            >
              إعادة ضبط
            </button>
          )}

          <button
            onClick={handlePrint}
            className="px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            طباعة التقرير
          </button>
        </div>
      </div>

      {/* TWO REVENUE STREAMS breakdown cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-[#11131e] border border-cyan-500/30 p-5 rounded-2xl">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs mb-2">
            <Building2 className="w-4 h-4" />
            <span>1. نصيب عبده من أعمال المحل (50% من شغل المحل)</span>
          </div>
          <h3 className="text-2xl font-black text-cyan-300 mt-1">
            {roundAbdoShop.toLocaleString('ar-EG')} <span className="text-xs text-gray-400">{currencySymbol}</span>
          </h3>
          <p className="text-[11px] text-gray-400 mt-1">نصيبه الـ 50% من صافي أرباح شغل المحل الشامل</p>
        </div>

        <div className="bg-[#11131e] border border-emerald-500/30 p-5 rounded-2xl">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs mb-2">
            <UserCheck className="w-4 h-4" />
            <span>2. أرباح أعماله الخاصة (75% من شغل عبده)</span>
          </div>
          <h3 className="text-2xl font-black text-emerald-300 mt-1">
            {roundAbdoPrivate.toLocaleString('ar-EG')} <span className="text-xs text-gray-400">{currencySymbol}</span>
          </h3>
          <p className="text-[11px] text-gray-400 mt-1">75% صافي ربح شغله الخاص بعد خصم قطع الغيار</p>
        </div>
      </div>

      {/* FINAL SUMMARY FORMULA CALLOUT BOX */}
      <div className="bg-gradient-to-r from-cyan-950 via-slate-900 to-cyan-950 border-2 border-cyan-500/40 p-6 rounded-2xl shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-cyan-300 font-black text-sm">
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
            <span>إجمالي دخل عبده النهائي</span>
          </div>
          <p className="text-xs text-gray-300">
            <strong>المعادلة:</strong> نصيبه من الشراكة/المحل ({roundAbdoShop.toLocaleString('ar-EG')}) + أرباح أعماله الخاصة 75% ({roundAbdoPrivate.toLocaleString('ar-EG')})
          </p>
        </div>
        <div className="bg-cyan-950/80 border border-cyan-400/50 px-6 py-3 rounded-xl text-center">
          <span className="text-[11px] text-cyan-300 block font-bold">إجمالي الدخل المستحق</span>
          <span className="text-3xl font-black text-cyan-200">
            {totalAbdoIncome.toLocaleString('ar-EG')} <span className="text-sm font-normal">{currencySymbol}</span>
          </span>
        </div>
      </div>

      {/* Detailed Orders Breakdown Table for Abdo */}
      <div className="bg-[#11131e] border border-[#2a2d42] rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-[#2a2d42] flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-400" />
            جدول تفاصيل استحقاقات عبده حسب الأوردر ({orderRows.length} أمر)
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right text-gray-300">
            <thead className="bg-[#181b2a] text-gray-400 font-semibold border-b border-[#2a2d42]">
              <tr>
                <th className="p-3">رقم الأوردر</th>
                <th className="p-3">العميل</th>
                <th className="p-3">نوع الشغل</th>
                <th className="p-3">إجمالي الفاتورة</th>
                <th className="p-3">تكلفة قطع الغيار</th>
                <th className="p-3">صافي الربح</th>
                <th className="p-3 text-cyan-400">استحقاق عبده</th>
                <th className="p-3">ملاحظات التوزيع</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f2937]">
              {orderRows.length > 0 ? (
                orderRows.map((r) => (
                  <tr key={r.id} className="hover:bg-[#161927] transition">
                    <td className="p-3 font-mono font-bold text-cyan-400">{r.orderNum}</td>
                    <td className="p-3 font-semibold text-white">{r.customer}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                        r.ownership === WorkOwnershipType.PARTNER_2_PRIVATE
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : r.ownership === WorkOwnershipType.PARTNER_1_PRIVATE
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                          : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      }`}>
                        {r.workTypeLabel}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-white">{r.totalInvoice.toLocaleString('ar-EG')} {currencySymbol}</td>
                    <td className="p-3 text-rose-400">{r.partsCost.toLocaleString('ar-EG')} {currencySymbol}</td>
                    <td className="p-3 font-bold text-cyan-300">{r.netProfit.toLocaleString('ar-EG')} {currencySymbol}</td>
                    <td className="p-3 font-extrabold text-cyan-300 text-sm">
                      {r.abdoEntitlement.toLocaleString('ar-EG')} {currencySymbol}
                    </td>
                    <td className="p-3 text-gray-400 text-[11px]">{r.entitlementNote}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    لا توجد حركات مسجلة للفترة المحددة
                  </td>
                </tr>
              )}
            </tbody>
            {orderRows.length > 0 && (
              <tfoot className="bg-[#181b2a] border-t-2 border-[#2a2d42] font-bold text-white">
                <tr>
                  <td colSpan={6} className="p-3 text-left font-black text-cyan-400">إجمالي دخل عبده المستحق:</td>
                  <td className="p-3 text-cyan-300 text-base font-black">{totalAbdoIncome.toLocaleString('ar-EG')} {currencySymbol}</td>
                  <td className="p-3"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
