import React, { useState } from "react";
import {
  FileText,
  Printer,
  Download,
  Filter,
  Calendar,
  DollarSign,
  User,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import {
  usePartners,
  usePartnerLedger,
  useRepairOrders,
  useRepairPartUsages,
  usePartnerTransactions
} from "../../hooks/useData";
import { WorkOwnershipType } from "../../types";

interface PartnerStatementProps {
  onOpenReversalModal?: (transactionId: string) => void;
}

export default function PartnerStatement({ onOpenReversalModal }: PartnerStatementProps) {
  const { partners } = usePartners();
  const { ledger } = usePartnerLedger();
  const { orders } = useRepairOrders();
  const { partUsages } = useRepairPartUsages();
  const { transactions } = usePartnerTransactions();

  const [selectedPartnerId, setSelectedPartnerId] = useState("P-002"); // Abdou default
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedMonth, setSelectedMonth] = useState(7);
  const [workTypeFilter, setWorkTypeFilter] = useState("ALL");

  const selectedPartner = partners.find(p => p.id === selectedPartnerId) || partners[1] || partners[0];

  // Filter ledger for selected partner
  const partnerLedger = ledger.filter(l => l.partnerId === selectedPartnerId);

  // Filter orders for selected month & year & workTypeFilter
  const monthlyOrders = orders.filter(o => {
    if (!o.receivedDate) return false;
    const d = new Date(o.receivedDate);
    const matchesDate = d.getFullYear() === selectedYear && (d.getMonth() + 1) === selectedMonth;
    if (!matchesDate) return false;

    if (workTypeFilter === "ALL") return true;
    if (workTypeFilter === "CUSTOMER_SHARED") {
      return !o.workOwnershipType || o.workOwnershipType === WorkOwnershipType.CUSTOMER_SHARED;
    }
    return o.workOwnershipType === workTypeFilter;
  });

  // Calculate Abdou / Partner Private Work Breakdown if applicable
  const isAbdou = selectedPartnerId === "P-002";
  const partnerPrivateOrders = monthlyOrders.filter(
    o => isAbdou ? o.workOwnershipType === WorkOwnershipType.PARTNER_2_PRIVATE : o.workOwnershipType === WorkOwnershipType.PARTNER_1_PRIVATE
  );

  let privateRevenue = 0;
  let privatePartsCost = 0;
  let privateOtherCosts = 0;
  let partnerPrivateShare = 0;
  let ownerShareFromAbdouPrivate = 0;

  partnerPrivateOrders.forEach(o => {
    const rev = o.totalEstimatedCost || 0;
    const other = o.otherDirectCosts || 0;
    let parts = 0;
    const orderParts = partUsages.filter(pu => pu.repairOrderId === o.id);
    if (orderParts.length > 0) {
      parts = orderParts.reduce((acc, p) => acc + (p.totalCost || 0), 0);
    } else {
      parts = o.devices?.reduce((acc, d) => acc + (d.partsCost || 0), 0) || 0;
    }

    privateRevenue += rev;
    privateOtherCosts += other;
    privatePartsCost += parts;

    if (isAbdou) {
      const orderNetProfit = Math.max(0, rev - parts - other);
      const rate = typeof o.partnerDeductionRate === "number" ? o.partnerDeductionRate : 25;
      const ownerShare = Math.round(orderNetProfit * (rate / 100));
      const abdouShare = orderNetProfit - ownerShare;

      ownerShareFromAbdouPrivate += ownerShare;
      partnerPrivateShare += abdouShare;
    }
  });

  const privateNetProfit = Math.max(0, privateRevenue - privatePartsCost - privateOtherCosts);
  if (!isAbdou) {
    partnerPrivateShare = privateNetProfit;
  }

  // CSV Export helper
  const handleExportCSV = () => {
    const headers = ["ID", "التاريخ", "نوع الحركة", "البيان", "مدين", "دائن", "الرصيد التراكمي", "الحالة"];
    const rows = partnerLedger.map(l => [
      l.id,
      new Date(l.transactionDate).toLocaleDateString("ar-EG"),
      l.transactionType,
      `"${(l.descriptionArabic || "").replace(/"/g, '""')}"`,
      l.debit || 0,
      l.credit || 0,
      l.balanceAfter || 0,
      l.isReversed ? "معكوس" : "نشط"
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `كشف_حساب_شريك_${selectedPartner?.name}_${selectedMonth}_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Filters Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800">
            <User className="w-4 h-4 text-cyan-400" />
            <select
              value={selectedPartnerId}
              onChange={e => setSelectedPartnerId(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-100 focus:outline-none"
            >
              {partners.map(p => (
                <option key={p.id} value={p.id} className="bg-slate-900">
                  كشف حساب: {p.nameAr || p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800">
            <Calendar className="w-4 h-4 text-slate-400" />
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(Number(e.target.value))}
              className="bg-transparent text-xs font-semibold text-slate-100 focus:outline-none"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                <option key={m} value={m} className="bg-slate-900">
                  شهر {m}
                </option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-xs font-semibold text-slate-100 focus:outline-none mr-2"
            >
              {[2025, 2026, 2027].map(y => (
                <option key={y} value={y} className="bg-slate-900">
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-950 px-3 py-2 rounded-xl border border-cyan-500/30">
            <span className="text-xs text-cyan-400 font-bold">نوع الشغل:</span>
            <select
              value={workTypeFilter}
              onChange={e => setWorkTypeFilter(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-100 focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">جميع أنواع الشغل</option>
              <option value="CUSTOMER_SHARED" className="bg-slate-900">شغل عملاء</option>
              <option value="PARTNER_2_PRIVATE" className="bg-slate-900">شغل عبده</option>
              <option value="PARTNER_1_PRIVATE" className="bg-slate-900">شغل أحمد البنا</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 transition"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            تصدير Excel (CSV)
          </button>

          <button
            onClick={handlePrint}
            className="px-3.5 py-2 bg-cyan-500 hover:bg-cyan-600 text-slate-950 rounded-xl text-xs font-semibold flex items-center gap-2 transition shadow-lg shadow-cyan-500/20"
          >
            <Printer className="w-4 h-4" />
            طباعة كشف الحساب
          </button>
        </div>
      </div>

      {/* Header Summary for Selected Partner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <p className="text-xs text-slate-400 font-medium">الرصيد المستحق الحالي</p>
          <div className="flex items-baseline justify-between mt-2">
            <span className={`text-2xl font-bold ${selectedPartner?.balance >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {selectedPartner?.balance?.toLocaleString("ar-EG") || 0} ج.م.
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
              {selectedPartner?.balance >= 0 ? "دائن (له)" : "مدين (عليه)"}
            </span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <p className="text-xs text-slate-400 font-medium">إجمالي أجهزة الشغل الخاص هذا الشهر</p>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-amber-400">
              {partnerPrivateOrders.length} جهاز
            </span>
            <span className="text-[10px] text-slate-400">إيراد: {privateRevenue.toLocaleString("ar-EG")} ج.م.</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <p className="text-xs text-slate-400 font-medium">تكلفة البضاعة والمستلزمات المستهلكة</p>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-rose-400">
              {privatePartsCost.toLocaleString("ar-EG")} ج.م.
            </span>
            <span className="text-[10px] text-slate-400">تكلفة قطع الغيار</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <p className="text-xs text-slate-400 font-medium">صافي نصيب الشريك من الشغل الخاص</p>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-cyan-400">
              {partnerPrivateShare.toLocaleString("ar-EG")} ج.م.
            </span>
            <span className="text-[10px] text-cyan-500 font-medium">
              {isAbdou ? "(75% عبده / 25% لأحمد)" : "(100% لأحمد البنا بعد استرداد تكلفة البضاعة)"}
            </span>
          </div>
        </div>
      </div>

      {/* Special Box for Private Work Details */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 border border-cyan-500/30 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-cyan-300 flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              {isAbdou
                ? `بيان تفصيلي لشغل عبده الخاص (شهر ${selectedMonth}/${selectedYear})`
                : `بيان تفصيلي لشغلي الخاص - أحمد البنا (شهر ${selectedMonth}/${selectedYear})`}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {isAbdou
                ? "قاعدة المحاسبة: تحصيل إيراد الأجهزة + خصم سعر تكلفة بضاعة قطع الغيار المستهلكة من المخزن ⬅️ تقسيم الصافي بنسبة (75% عبده / 25% لأحمد البنا)."
                : "قاعدة المحاسبة: تحصيل إيراد الأجهزة + الأرباح بالكامل لأحمد البنا ⬅️ خصم واسترداد تكلفة البضاعة المستخدمة لصالح مخزن الشراكة."}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-3 text-center">
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
            <span className="text-[11px] text-slate-400">إجمالي تحصيل الإيراد</span>
            <p className="text-lg font-bold text-slate-100 mt-1">{privateRevenue.toLocaleString("ar-EG")} ج.م.</p>
          </div>
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
            <span className="text-[11px] text-slate-400">سحب بضاعة/قطع غيار (تُسترد للشراكة)</span>
            <p className="text-lg font-bold text-rose-400 mt-1">{privatePartsCost.toLocaleString("ar-EG")} ج.م.</p>
          </div>
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
            <span className="text-[11px] text-slate-400">مصروفات مباشرة</span>
            <p className="text-lg font-bold text-amber-400 mt-1">{privateOtherCosts.toLocaleString("ar-EG")} ج.م.</p>
          </div>
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
            <span className="text-[11px] text-slate-400">{isAbdou ? "صافي ربح أجهزة عبده" : "صافي ربح شغل أحمد البنا"}</span>
            <p className="text-lg font-bold text-emerald-400 mt-1">{privateNetProfit.toLocaleString("ar-EG")} ج.م.</p>
          </div>
          <div className="bg-cyan-500/10 p-3 rounded-xl border border-cyan-500/40">
            <span className="text-[11px] text-cyan-300 font-semibold">{isAbdou ? "صافي نصيب عبده المتبقي" : "صافي المستحق لأحمد البنا"}</span>
            <p className="text-lg font-extrabold text-cyan-300 mt-1">{partnerPrivateShare.toLocaleString("ar-EG")} ج.م.</p>
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-400" />
            دفتر أستاذ الشريك التفصيلي (Partner General Ledger)
          </h3>
          <span className="text-xs text-slate-400">عدد الحركات المسجلة: {partnerLedger.length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4 font-semibold">رقم الحركة</th>
                <th className="py-3 px-4 font-semibold">التاريخ</th>
                <th className="py-3 px-4 font-semibold">نوع القيد</th>
                <th className="py-3 px-4 font-semibold">البيان الشارح</th>
                <th className="py-3 px-4 font-semibold text-rose-400">مدين (سحب/سلفة)</th>
                <th className="py-3 px-4 font-semibold text-emerald-400">دائن (استحقاق أرباح)</th>
                <th className="py-3 px-4 font-semibold">الرصيد التراكمي</th>
                <th className="py-3 px-4 font-semibold text-center">الحالة / إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {partnerLedger.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    لا توجد حركات مالية مسجلة في دفتر أستاذ الشريك حتى الآن.
                  </td>
                </tr>
              ) : (
                partnerLedger.map(entry => (
                  <tr
                    key={entry.id}
                    className={`hover:bg-slate-800/40 transition ${
                      entry.isReversed ? "opacity-50 line-through bg-rose-950/10" : ""
                    }`}
                  >
                    <td className="py-3 px-4 font-mono text-slate-400">{entry.id}</td>
                    <td className="py-3 px-4 text-slate-300">
                      {new Date(entry.transactionDate).toLocaleDateString("ar-EG")}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                        {entry.transactionType}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-200 max-w-xs truncate">
                      {entry.descriptionArabic}
                    </td>
                    <td className="py-3 px-4 font-bold text-rose-400">
                      {entry.debit > 0 ? `${entry.debit.toLocaleString("ar-EG")} ج.م.` : "-"}
                    </td>
                    <td className="py-3 px-4 font-bold text-emerald-400">
                      {entry.credit > 0 ? `${entry.credit.toLocaleString("ar-EG")} ج.م.` : "-"}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-100">
                      {entry.balanceAfter.toLocaleString("ar-EG")} ج.م.
                    </td>
                    <td className="py-3 px-4 text-center">
                      {entry.isReversed ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30">
                          معكوس (Reversed)
                        </span>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            نشط معتمد
                          </span>
                          {onOpenReversalModal && entry.sourceType === "PARTNER_TRANSACTION" && (
                            <button
                              onClick={() => onOpenReversalModal(entry.sourceId!)}
                              title="عكس الحركة الماليّة"
                              className="p-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 transition"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
