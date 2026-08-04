import React, { useState } from 'react';
import {
  UserCheck,
  TrendingUp,
  DollarSign,
  Calendar,
  FileText,
  Wallet,
  CheckCircle2,
  Printer,
  Download,
  ShieldCheck,
  User,
  Building2,
  Users
} from 'lucide-react';
import { Expense, MonthlySettlementResult, RepairOrder, WorkOwnershipType } from '../../types';
import { PartnerLedgerEntry } from '../../lib/partnerLedgerEngine';
import { calculateAhmedDashboardData, formatDateISO, roundMoney } from '../../lib/finalReportsEngine';
import { calculateOrderAccountingV2 } from '../../lib/accountingEngineV2';
import { useInvoices, useInventoryMovements, useRepairPartUsages } from '../../hooks/useData';

interface AhmedDashboardViewProps {
  partnerLedger: PartnerLedgerEntry[];
  expenses: Expense[];
  settlements: MonthlySettlementResult[];
  orders?: RepairOrder[];
  currencySymbol?: string;
}

export default function AhmedDashboardView({
  partnerLedger,
  expenses,
  settlements,
  orders = [],
  currencySymbol = 'ج.م.'
}: AhmedDashboardViewProps) {
  const { invoices } = useInvoices();
  const { movements } = useInventoryMovements();
  const { partUsages } = useRepairPartUsages();
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const ahmedData = calculateAhmedDashboardData(partnerLedger, expenses, settlements, dateFrom, dateTo);

  const engineRows = orders
    .map(order => calculateOrderAccountingV2(order, invoices, movements, partUsages))
    .filter(row => {
      const orderDate = formatDateISO(row.date);
      if (dateFrom && orderDate < dateFrom) return false;
      if (dateTo && orderDate > dateTo) return false;
      return true;
    });

  let ahmedPrivateProfits = 0;
  let ahmedShopShare = 0;
  let ahmedFromAbdoShare = 0;

  const orderRows = engineRows.map(row => {
    if (row.party === 'AHMED') ahmedPrivateProfits += row.ahmedShare;
    else if (row.party === 'SHOP') ahmedShopShare += row.ahmedShare;
    else if (row.party === 'ABDO') ahmedFromAbdoShare += row.ahmedShare;
    return {
      id: row.orderId, orderNum: row.orderNumber, customer: row.customerName, date: formatDateISO(row.date),
      ownership: row.sourceOrder.workOwnershipType, workTypeLabel: row.workLabel, totalInvoice: row.revenue,
      partsCost: row.purchaseCost, netProfit: row.netProfit, ahmedEntitlement: row.ahmedShare,
      entitlementNote: row.party === 'AHMED' ? '100% أرباح خاصة لأحمد' : row.party === 'ABDO' ? '25% من صافي شغل عبده' : '50% من صافي شغل المحل'
    };
  });

  const roundAhmedPrivate = roundMoney(ahmedPrivateProfits);
  const roundAhmedShop = roundMoney(ahmedShopShare);
  const roundAhmedFromAbdo = roundMoney(ahmedFromAbdoShare);
  const totalAhmedIncome = roundMoney(roundAhmedPrivate + roundAhmedShop + roundAhmedFromAbdo);

  const handlePrint = () => window.print();

  return (
    <div className="space-y-6">
      {/* Header & Date Filter Bar */}
      <div className="bg-[#11131e] border border-[#2a2d42] p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
          <UserCheck className="w-5 h-5" />
          <span>تقرير وإجمالي دخل أحمد البنا (الشريك الأول)</span>
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
            className="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            طباعة التقرير
          </button>
        </div>
      </div>

      {/* THREE REVENUE STREAMS breakdown cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#11131e] border border-indigo-500/30 p-5 rounded-2xl">
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs mb-2">
            <User className="w-4 h-4" />
            <span>1. أرباح أحمد الخاصة (100% من شغل أحمد)</span>
          </div>
          <h3 className="text-2xl font-black text-indigo-300 mt-1">
            {roundAhmedPrivate.toLocaleString('ar-EG')} <span className="text-xs text-gray-400">{currencySymbol}</span>
          </h3>
          <p className="text-[11px] text-gray-400 mt-1">خاصة بأحمد بالكامل ولا تدخل ضمن الشراكة</p>
        </div>

        <div className="bg-[#11131e] border border-cyan-500/30 p-5 rounded-2xl">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs mb-2">
            <Building2 className="w-4 h-4" />
            <span>2. نصيب أحمد من أعمال المحل (50% من شغل المحل)</span>
          </div>
          <h3 className="text-2xl font-black text-cyan-300 mt-1">
            {roundAhmedShop.toLocaleString('ar-EG')} <span className="text-xs text-gray-400">{currencySymbol}</span>
          </h3>
          <p className="text-[11px] text-gray-400 mt-1">نصيبه الـ 50% من صافي ربح شغل المحل</p>
        </div>

        <div className="bg-[#11131e] border border-amber-500/30 p-5 rounded-2xl">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs mb-2">
            <Users className="w-4 h-4" />
            <span>3. نسبة أحمد من أعمال عبده (25% من شغل عبده)</span>
          </div>
          <h3 className="text-2xl font-black text-amber-300 mt-1">
            {roundAhmedFromAbdo.toLocaleString('ar-EG')} <span className="text-xs text-gray-400">{currencySymbol}</span>
          </h3>
          <p className="text-[11px] text-gray-400 mt-1">تضاف مباشرة لحسابه الشخصي (ليست شراكة)</p>
        </div>
      </div>

      {/* FINAL SUMMARY FORMULA CALLOUT BOX */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 border-2 border-indigo-500/40 p-6 rounded-2xl shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-indigo-300 font-black text-sm">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
            <span>إجمالي دخل أحمد البنا النهائي</span>
          </div>
          <p className="text-xs text-gray-300">
            <strong>المعادلة:</strong> أرباحه الخاصة ({roundAhmedPrivate.toLocaleString('ar-EG')}) + نصيبه من الشراكة ({roundAhmedShop.toLocaleString('ar-EG')}) + نسبة 25% من أعمال عبده ({roundAhmedFromAbdo.toLocaleString('ar-EG')})
          </p>
        </div>
        <div className="bg-indigo-950/80 border border-indigo-400/50 px-6 py-3 rounded-xl text-center">
          <span className="text-[11px] text-indigo-300 block font-bold">إجمالي الدخل المستحق</span>
          <span className="text-3xl font-black text-indigo-200">
            {totalAhmedIncome.toLocaleString('ar-EG')} <span className="text-sm font-normal">{currencySymbol}</span>
          </span>
        </div>
      </div>

      {/* Detailed Orders Breakdown Table for Ahmed */}
      <div className="bg-[#11131e] border border-[#2a2d42] rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-[#2a2d42] flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-400" />
            جدول تفاصيل استحقاقات أحمد البنا حسب الأوردر ({orderRows.length} أمر)
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
                <th className="p-3 text-indigo-400">استحقاق أحمد</th>
                <th className="p-3">ملاحظات التوزيع</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f2937]">
              {orderRows.length > 0 ? (
                orderRows.map((r) => (
                  <tr key={r.id} className="hover:bg-[#161927] transition">
                    <td className="p-3 font-mono font-bold text-indigo-400">{r.orderNum}</td>
                    <td className="p-3 font-semibold text-white">{r.customer}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                        r.ownership === WorkOwnershipType.PARTNER_1_PRIVATE
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                          : r.ownership === WorkOwnershipType.PARTNER_2_PRIVATE
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      }`}>
                        {r.workTypeLabel}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-white">{r.totalInvoice.toLocaleString('ar-EG')} {currencySymbol}</td>
                    <td className="p-3 text-rose-400">{r.partsCost.toLocaleString('ar-EG')} {currencySymbol}</td>
                    <td className="p-3 font-bold text-cyan-300">{r.netProfit.toLocaleString('ar-EG')} {currencySymbol}</td>
                    <td className="p-3 font-extrabold text-indigo-300 text-sm">
                      {r.ahmedEntitlement.toLocaleString('ar-EG')} {currencySymbol}
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
                  <td colSpan={6} className="p-3 text-left font-black text-indigo-400">إجمالي دخل أحمد البنا المستحق:</td>
                  <td className="p-3 text-indigo-300 text-base font-black">{totalAhmedIncome.toLocaleString('ar-EG')} {currencySymbol}</td>
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
