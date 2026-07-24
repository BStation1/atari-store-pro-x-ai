import React, { useState } from "react";
import {
  Calendar,
  Lock,
  Unlock,
  RefreshCw,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  FileText,
  CreditCard,
  Printer,
  ChevronLeft
} from "lucide-react";
import { useDialog } from "../../context/DialogContext";
import { usePartnerSettlements } from "../../hooks/useData";
import { PartnerSettlement } from "../../types";

interface MonthlySettlementsProps {
  currentUserId: string;
  onOpenReversalModal?: (settlementId: string) => void;
}

export default function MonthlySettlements({
  currentUserId,
  onOpenReversalModal
}: MonthlySettlementsProps) {
  const dialog = useDialog();
  const {
    settlements,
    calculateSettlement,
    createDraftSettlement,
    lockSettlement,
    recordSettlementPayment
  } = usePartnerSettlements();

  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedMonth, setSelectedMonth] = useState(7);

  // Live preview or saved settlement
  const preview = calculateSettlement(selectedYear, selectedMonth);
  const savedSettlement = settlements.find(
    s => s.id === `SETTL-${selectedYear}-${String(selectedMonth).padStart(2, "0")}`
  );

  const activeSettlement: PartnerSettlement = savedSettlement || preview;

  // Payment Modal State
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [payPartnerId, setPayPartnerId] = useState("P-002");
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState("CASH");
  const [payTreasury, setPayTreasury] = useState("الخزينة الرئيسية");
  const [payNotes, setPayNotes] = useState("");

  const handleCreateDraft = async () => {
    const res = createDraftSettlement(selectedYear, selectedMonth, currentUserId);
    if (!res.success) {
      await dialog.alert({ message: res.error || "تعذر إنشاء المسودة", variant: "error" });
    } else {
      await dialog.alert({ message: `تم إنشاء مسودة التسوية الشهرية لـ ${selectedMonth}/${selectedYear} بنجاح`, variant: "success" });
    }
  };

  const handleLock = async () => {
    const confirmed = await dialog.confirm({
      title: "إغلاق واعتماد التسوية الشهرية",
      message: `هل أنت متأكد من إغلاق واعتِماد التسوية الشهرية رقم ${activeSettlement.settlementNumber}؟\n\nسيتم تثبيت الأرباح وتطبيق القيود الدفترية وقفل جميع أوامر الصيانة المرتبطة.`,
      variant: "warning",
      confirmText: "إغلاق واعتماد التسوية"
    });
    if (confirmed) {
      const res = lockSettlement(activeSettlement.id, currentUserId);
      if (!res.success) {
        await dialog.alert({ message: res.error || "تعذر اعتماد التسوية", variant: "error" });
      } else {
        await dialog.alert({ message: "تم إغلاق واعتِماد التسوية الشهرية بنجاح وتسجيل القيود بجدول الأستاذ.", variant: "success" });
      }
    }
  };

  const handleOpenPayment = (partnerId: string, defaultAmount: number) => {
    setPayPartnerId(partnerId);
    setPayAmount(defaultAmount > 0 ? defaultAmount : 0);
    setIsPaymentOpen(true);
  };

  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (payAmount <= 0) {
      await dialog.alert({ message: "يرجى إدخال مبلغ دفعات صحيح أكبر من صفر", variant: "warning" });
      return;
    }

    const res = recordSettlementPayment(
      activeSettlement.id,
      payPartnerId,
      payAmount,
      payMethod,
      payTreasury,
      payNotes,
      currentUserId
    );

    if (!res.success) {
      await dialog.alert({ message: res.error || "حدث خطأ أثناء صرف المستحقات", variant: "error" });
    } else {
      await dialog.alert({ message: "تم تسجيل دفعة صرف مستحقات الشريك بنجاح وتسجيل القيد بدفتر الأستاذ.", variant: "success" });
      setIsPaymentOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Month Picker & Header Actions */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-sm">اختيار الفترة والتسوية الشهرية</h3>
            <p className="text-xs text-slate-400">حساب وتحصيل صافي أرباح الصيانة والتسويات المالية بين الشركاء</p>
          </div>

          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 mr-4">
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(Number(e.target.value))}
              className="bg-transparent text-xs font-bold text-slate-100 focus:outline-none"
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
              className="bg-transparent text-xs font-bold text-slate-100 focus:outline-none"
            >
              {[2025, 2026, 2027].map(y => (
                <option key={y} value={y} className="bg-slate-900">
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Badge & Action buttons */}
        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold border ${
              activeSettlement.status === "LOCKED"
                ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                : activeSettlement.status === "PAID"
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                : activeSettlement.status === "REVERSED"
                ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                : "bg-slate-800 text-slate-300 border-slate-700"
            }`}
          >
            الحالة: {activeSettlement.status}
          </span>

          {activeSettlement.status === "DRAFT" && (
            <>
              <button
                onClick={handleCreateDraft}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 transition"
              >
                <RefreshCw className="w-4 h-4 text-cyan-400" />
                تحديث / حفظ المسودة
              </button>

              <button
                onClick={handleLock}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-semibold flex items-center gap-2 transition shadow-lg shadow-amber-500/20"
              >
                <Lock className="w-4 h-4" />
                اعتماد وإغلاق التسوية (Lock)
              </button>
            </>
          )}

          {(activeSettlement.status === "LOCKED" || activeSettlement.status === "PARTIALLY_PAID") && onOpenReversalModal && (
            <button
              onClick={() => onOpenReversalModal(activeSettlement.id)}
              className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-xl text-xs font-semibold flex items-center gap-2 transition"
            >
              <RefreshCw className="w-4 h-4" />
              عكس التسوية (Reversal)
            </button>
          )}
        </div>
      </div>

      {/* Main Settlement Financial Sheet */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Shared Customer Work Calculation */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h4 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              1. شغل العملاء المشترك (CUSTOMER_SHARED - 50/50)
            </h4>
            <span className="text-xs text-slate-400">تقسيم الصافي مناصفة</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-800/60">
              <span className="text-slate-400">إجمالي إيراد الصيانة المشترك:</span>
              <span className="font-semibold text-slate-200">{activeSettlement.sharedRevenue?.toLocaleString("ar-EG")} ج.م.</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800/60">
              <span className="text-slate-400">خصم تكلفة بضاعة قطع الغيار المستهلكة:</span>
              <span className="font-semibold text-rose-400">- {activeSettlement.sharedPartsCost?.toLocaleString("ar-EG")} ج.م.</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800/60">
              <span className="text-slate-400">خصم مصروفات الصيانة المباشرة:</span>
              <span className="font-semibold text-rose-400">- {activeSettlement.sharedOtherCosts?.toLocaleString("ar-EG")} ج.م.</span>
            </div>
            <div className="flex justify-between py-2 bg-slate-950 px-3 rounded-xl font-bold border border-slate-800 text-sm">
              <span className="text-emerald-400">صافي الأرباح المشتركة القابلة للتوزيع:</span>
              <span className="text-emerald-400">{activeSettlement.sharedNetProfit?.toLocaleString("ar-EG")} ج.م.</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
              <span className="text-[11px] text-slate-400">نصيب أحمد البنا (50%)</span>
              <p className="text-base font-bold text-slate-100 mt-1">
                {activeSettlement.partner1SharedShare?.toLocaleString("ar-EG")} ج.م.
              </p>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
              <span className="text-[11px] text-slate-400">نصيب عبده (50%)</span>
              <p className="text-base font-bold text-cyan-400 mt-1">
                {activeSettlement.partner2SharedShare?.toLocaleString("ar-EG")} ج.م.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Private Work Breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h4 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400" />
              2. شغل عبده (PARTNER_2_PRIVATE)
            </h4>
            <span className="text-xs text-amber-400 font-medium">خصم البضاعة ⬅️ تقسيم الصافي بحسب نسبة الخصم المحفوظة</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-800/60">
              <span className="text-slate-400">إجمالي تحصيل أجهزة عبده الخاصة:</span>
              <span className="font-semibold text-slate-200">{activeSettlement.partner2PrivateRevenue?.toLocaleString("ar-EG")} ج.م.</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800/60">
              <span className="text-slate-400">خصم قيمة البضاعة المسحوبة من المخزن:</span>
              <span className="font-semibold text-rose-400">- {activeSettlement.partner2PrivatePartsCost?.toLocaleString("ar-EG")} ج.م.</span>
            </div>
            <div className="flex justify-between py-2 bg-slate-950 px-3 rounded-xl font-bold border border-slate-800 text-sm">
              <span className="text-amber-400">صافي أرباح شغل عبده الخاص:</span>
              <span className="text-amber-400">{activeSettlement.partner2PrivateNetProfit?.toLocaleString("ar-EG")} ج.م.</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
              <span className="text-[11px] text-slate-400">حق المحل/أحمد من شغل عبده (حسب الخصم)</span>
              <p className="text-base font-bold text-emerald-400 mt-1">
                {activeSettlement.partner1ShareFromPartner2Private?.toLocaleString("ar-EG")} ج.م.
              </p>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
              <span className="text-[11px] text-slate-400">حق عبده المتبقي بعد الخصم</span>
              <p className="text-base font-bold text-cyan-400 mt-1">
                {activeSettlement.partner2ShareFromPrivateWork?.toLocaleString("ar-EG")} ج.م.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Final Net Settlement Distribution Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Partner 1 (Owner) Box */}
        <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h4 className="font-bold text-slate-100 text-sm">صافي مستحقات أحمد البنا (الشريك الأول)</h4>
            <span className="text-xs text-slate-400">P-001</span>
          </div>

          <div className="space-y-1.5 text-xs text-slate-300">
            <div className="flex justify-between">
              <span>+ نصيب أرباح شغل العملاء المشترك:</span>
              <span className="font-semibold">{activeSettlement.partner1SharedShare?.toLocaleString("ar-EG")} ج.م.</span>
            </div>
            <div className="flex justify-between">
              <span>+ نصيب المحل من شغل عبده الخاص:</span>
              <span className="font-semibold">{activeSettlement.partner1ShareFromPartner2Private?.toLocaleString("ar-EG")} ج.م.</span>
            </div>
            <div className="flex justify-between text-rose-400">
              <span>- خصم تكلفة بضاعة الشغل الخاص به:</span>
              <span>- {activeSettlement.partner1PrivateDeduction?.toLocaleString("ar-EG")} ج.م.</span>
            </div>
            <div className="flex justify-between text-rose-400">
              <span>- المسحوبات والسلف الشخصية:</span>
              <span>- {(activeSettlement.partner1Advances + activeSettlement.partner1Withdrawals)?.toLocaleString("ar-EG")} ج.م.</span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400">الصافي المالي للشريك الأول:</span>
              <p className="text-xl font-extrabold text-emerald-400">
                {activeSettlement.partner1FinalBalance?.toLocaleString("ar-EG")} ج.م.
              </p>
            </div>

            {activeSettlement.status === "LOCKED" && (
              <button
                onClick={() => handleOpenPayment("P-001", activeSettlement.partner1FinalBalance)}
                className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition"
              >
                <CreditCard className="w-4 h-4" />
                صرف المستحقات
              </button>
            )}
          </div>
        </div>

        {/* Partner 2 (Abdou) Box */}
        <div className="bg-gradient-to-b from-slate-900 to-cyan-950/30 border border-cyan-500/30 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h4 className="font-bold text-cyan-300 text-sm">صافي مستحقات عبده (الشريك الثاني)</h4>
            <span className="text-xs text-cyan-400 font-mono">P-002</span>
          </div>

          <div className="space-y-1.5 text-xs text-slate-300">
            <div className="flex justify-between">
              <span>+ نصيب أرباح شغل العملاء المشترك:</span>
              <span className="font-semibold">{activeSettlement.partner2SharedShare?.toLocaleString("ar-EG")} ج.م.</span>
            </div>
            <div className="flex justify-between">
              <span>+ صافي نصيب عبده من شغله الخاص (75% بعد خصم البضاعة):</span>
              <span className="font-semibold">{activeSettlement.partner2ShareFromPrivateWork?.toLocaleString("ar-EG")} ج.م.</span>
            </div>
            <div className="flex justify-between text-rose-400">
              <span>- السلف والمسحوبات النقدية والمخزنية:</span>
              <span>- {(activeSettlement.partner2Advances + activeSettlement.partner2Withdrawals)?.toLocaleString("ar-EG")} ج.م.</span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400">الصافي المالي النهائي لعبده:</span>
              <p className="text-xl font-extrabold text-cyan-300">
                {activeSettlement.partner2FinalBalance?.toLocaleString("ar-EG")} ج.م.
              </p>
            </div>

            {activeSettlement.status === "LOCKED" && (
              <button
                onClick={() => handleOpenPayment("P-002", activeSettlement.partner2FinalBalance)}
                className="px-3.5 py-2 bg-cyan-400 hover:bg-cyan-500 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition shadow-lg shadow-cyan-500/20"
              >
                <CreditCard className="w-4 h-4" />
                صرف المستحقات لعبده
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Record Payment Modal */}
      {isPaymentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 text-slate-100">
            <h3 className="font-bold text-lg text-slate-100 pb-3 border-b border-slate-800">
              صرف دفعات مستحقات التسوية
            </h3>

            <form onSubmit={handleRecordPaymentSubmit} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">الشريك المستلم</label>
                <input
                  type="text"
                  readOnly
                  value={payPartnerId === "P-001" ? "أحمد البنا" : "عبده"}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-300 font-semibold"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">المبلغ المصروف (ج.م.) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={payAmount}
                  onChange={e => setPayAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-emerald-400 font-bold text-base focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">طريقة الدفع الخزينة</label>
                <select
                  value={payTreasury}
                  onChange={e => setPayTreasury(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-100"
                >
                  <option value="الخزينة الرئيسية">الخزينة الرئيسية للمحل</option>
                  <option value="فودافون كاش">فودافون كاش</option>
                  <option value="إنستا باي">إنستا باي</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">ملاحظات / أرقام الحوالات</label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={e => setPayNotes(e.target.value)}
                  placeholder="ملاحظات الصرف..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPaymentOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-500 font-bold text-slate-950"
                >
                  تأكيد الصرف القيد
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
