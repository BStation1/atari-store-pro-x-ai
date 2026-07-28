import React, { useState } from "react";
import {
  AlertOctagon,
  ShieldAlert,
  Trash2,
  CheckCircle,
  XCircle,
  RefreshCw,
  FileText,
  ShieldCheck,
  CheckCircle2
} from "lucide-react";
import { db } from "../lib/data";
import { useCurrentUser } from "../hooks/useData";
import { canResetOperationalData } from "../lib/authPermissions";

export default function OperationalResetPanel() {
  const { user: currentUser } = useCurrentUser();
  const isOwnerUser = canResetOperationalData(currentUser);

  const [resetConfirmationText, setResetConfirmationText] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetReport, setResetReport] = useState<{
    executionTimeMs: number;
    resetTables: { name: string; count: number }[];
    retainedTables: { name: string; countOrStatus: string }[];
  } | null>(null);

  const resetLogs = db.getSystemResetSecurityLogs ? db.getSystemResetSecurityLogs() : [];
  const lastResetLog = resetLogs.length > 0 ? resetLogs[0] : null;

  const handleConfirmReset = async () => {
    if (resetConfirmationText.trim() !== "RESET") {
      setResetError("كلمة التأكيد غير صحيحة. يجب كتابة كلمة RESET بالإنجليزية تماماً.");
      return;
    }

    setIsResetting(true);
    setResetError(null);

    try {
      const res = await db.executeFullOperationalResetAsync({ forceFailure: false });
      setIsResetting(false);

      if (res.success && res.resetTables && res.retainedTables) {
        setResetReport({
          executionTimeMs: res.executionTimeMs || 0,
          resetTables: res.resetTables,
          retainedTables: res.retainedTables
        });
      } else {
        setResetError(res.error || "فشلت عملية تصفير بيانات التشغيل.");
      }
    } catch (err: any) {
      setIsResetting(false);
      setResetError(err?.message || "حدث خطأ أثناء تنفيذ عملية التصفير داخل قاعدة البيانات.");
    }
  };

  const handleReloadSystem = () => {
    window.location.reload();
  };

  if (!isOwnerUser) {
    return (
      <div className="bg-rose-950/30 border-2 border-rose-500/50 p-6 rounded-3xl space-y-4 text-center">
        <div className="w-14 h-14 bg-rose-500/20 text-rose-400 rounded-full border border-rose-500/40 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-black text-white">غير مصرح بالوصول</h3>
        <p className="text-xs text-rose-200 max-w-md mx-auto leading-relaxed">
          عذراً، ميزة "تصفير بيانات التشغيل" حصرية تماماً لمستخدم الإدارة العليا (OWNER). لا تملك الحسابات الأخرى صلاحية الاطلاع أو تنفيذ التصفير.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-rose-950/50 via-red-950/30 to-gray-950 border-2 border-rose-500/60 p-6 rounded-3xl space-y-4 shadow-2xl relative overflow-hidden">
        <div className="flex items-center gap-3 border-b border-rose-500/30 pb-4">
          <div className="p-3 bg-rose-500/20 text-rose-400 rounded-2xl border border-rose-500/40">
            <AlertOctagon className="w-8 h-8 text-rose-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white">تصفير بيانات التشغيل (Operational Reset)</h2>
              <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] px-2.5 py-0.5 rounded-full font-bold">
                خاص بـ OWNER
              </span>
            </div>
            <p className="text-xs text-rose-200/90 mt-1">
              حذف كافة بيانات المعاملات والعمليات اليومية نهائياً مع الاحتفاظ التام بالأصناف، المنتجات، الإعدادات والمستخدمين.
            </p>
          </div>
        </div>

        {/* PROMINENT RED WARNING */}
        <div className="p-4 bg-rose-950/80 border-2 border-rose-500 rounded-2xl text-center space-y-1 shadow-inner">
          <p className="text-base sm:text-lg font-black text-rose-300">
            "سيتم حذف جميع بيانات التشغيل نهائيًا ولا يمكن التراجع."
          </p>
          <p className="text-[11px] text-rose-200/80">
            يرجى التأكد التام قبل البدء، حيث سيتم تفريغ الفواتير وأوامر الصيانة والقيود المحاسبية نهائياً.
          </p>
        </div>

        {/* DATA COMPARISON GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="bg-gray-950/80 p-4 rounded-2xl border border-rose-500/30 space-y-2">
            <h4 className="font-bold text-rose-400 flex items-center gap-2 text-xs">
              <Trash2 className="w-4 h-4" />
              سيتم حذف البيانات التالية نهائياً:
            </h4>
            <ul className="list-disc list-inside text-gray-300 space-y-1 text-[11px] leading-relaxed">
              <li>جميع الفواتير وعناصر الفواتير والمدفوعات</li>
              <li>جميع أوامر الصيانة ومرفقات الأجهزة ومستلزماتها</li>
              <li>جميع سجلات حركة المخزون والقيود المحاسبية</li>
              <li>جميع قيود دفتر الشركاء والتسويات الشهرية</li>
              <li>جميع المصروفات وسجلات الدفع عند الاستلام (COD)</li>
              <li>جميع سجلات العميل الزائر والعملاء والموردين</li>
              <li>جميع سجلات الأخطاء البرمجية وسجلات التدقيق والأنشطة</li>
            </ul>
          </div>

          <div className="bg-gray-950/80 p-4 rounded-2xl border border-emerald-500/30 space-y-2">
            <h4 className="font-bold text-emerald-400 flex items-center gap-2 text-xs">
              <ShieldCheck className="w-4 h-4" />
              سيتم الاحتفاظ بالبيانات التالية بالكامل:
            </h4>
            <ul className="list-disc list-inside text-gray-300 space-y-1 text-[11px] leading-relaxed">
              <li>جميع الأصناف والمنتجات بنفس الأسعار وكميات المخزون</li>
              <li>جميع الأقسام والتصنيفات</li>
              <li>إعدادات النظام والورشة وشاشة الاستقبال بالكامل</li>
              <li>حسابات المستخدمين وصلاحيات الأدوار</li>
              <li>الإعدادات المحاسبية وقواعد توزيع أرباح الشركاء</li>
              <li>أنواع الشغل وملكية المخزون وسجلات حماية التصفير</li>
            </ul>
          </div>
        </div>

        {/* ERROR DISPLAY */}
        {resetError && (
          <div className="p-3.5 bg-rose-950/90 border border-rose-500 rounded-xl text-xs text-rose-200 font-bold flex items-center gap-2">
            <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{resetError}</span>
          </div>
        )}

        {/* INPUT CONFIRMATION & BUTTON */}
        {!resetReport ? (
          <div className="bg-gray-950 p-5 rounded-2xl border border-[#2a2d42] space-y-4">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-200">
                لتأكيد عملية التصفير النهائي، يرجى كتابة كلمة <span className="text-rose-400 font-mono font-black text-base px-1">RESET</span> بالإنجليزية:
              </label>
              <input
                type="text"
                value={resetConfirmationText}
                onChange={(e) => setResetConfirmationText(e.target.value)}
                placeholder="اكتب كلمة RESET هنا"
                disabled={isResetting}
                className="w-full bg-gray-900 border border-rose-500/60 rounded-xl px-4 py-3 text-white font-mono text-center font-bold text-base focus:outline-none focus:border-rose-400 shadow-inner"
              />
            </div>

            <button
              onClick={handleConfirmReset}
              disabled={resetConfirmationText.trim() !== "RESET" || isResetting}
              className={`w-full py-3.5 px-6 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xl ${
                resetConfirmationText.trim() === "RESET" && !isResetting
                  ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/60"
                  : "bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700"
              }`}
            >
              {isResetting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  جاري تنفيذ تصفير بيانات التشغيل بالكامل...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  تأكيد التصفير
                </>
              )}
            </button>
          </div>
        ) : (
          /* RESET SUCCESS REPORT */
          <div className="bg-gray-950 p-6 rounded-2xl border-2 border-emerald-500/60 space-y-5">
            <div className="p-4 bg-emerald-950/50 border border-emerald-500/40 rounded-xl text-center space-y-2">
              <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/40 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-base font-black text-emerald-300">تم تصفير بيانات التشغيل بنجاح.</h3>
              <p className="text-xs text-emerald-200/90 font-mono">
                مدّة التنفيذ بالكامل: <span className="font-bold text-white">{resetReport.executionTimeMs} ms</span>
              </p>
            </div>

            {/* RESET TABLES SUMMARY */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-rose-400 flex items-center gap-1.5 border-b border-gray-800 pb-2">
                <FileText className="w-4 h-4" />
                الجداول التي تم تصفيرها:
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[180px] overflow-y-auto pr-1">
                {resetReport.resetTables.map((tbl, i) => (
                  <div key={i} className="bg-gray-900 p-2.5 rounded-xl border border-gray-800 flex justify-between items-center text-xs">
                    <span className="text-gray-300 font-medium">{tbl.name}</span>
                    <span className="bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded font-mono font-bold text-[11px]">
                      {tbl.count} سجل محذوف
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* RETAINED TABLES SUMMARY */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 border-b border-gray-800 pb-2">
                <ShieldCheck className="w-4 h-4" />
                الجداول التي تم الاحتفاظ بها:
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[150px] overflow-y-auto pr-1">
                {resetReport.retainedTables.map((tbl, i) => (
                  <div key={i} className="bg-gray-900 p-2.5 rounded-xl border border-gray-800 flex justify-between items-center text-xs">
                    <span className="text-gray-300 font-medium">{tbl.name}</span>
                    <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-bold text-[10px]">
                      {tbl.countOrStatus}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={handleReloadSystem}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-950/50"
            >
              <RefreshCw className="w-4 h-4" />
              إعادة تحميل النظام تلقائياً الآن
            </button>
          </div>
        )}
      </div>

      {/* REPORT OF LAST RESET OPERATION IF AVAILABLE */}
      {lastResetLog && (
        <div className="bg-gray-900 border border-[#2a2d42] p-5 rounded-2xl space-y-3">
          <h4 className="text-xs font-bold text-gray-300 flex items-center gap-2 border-b border-gray-800 pb-2">
            <FileText className="w-4 h-4 text-indigo-400" />
            تقرير أحدث عملية تصفير مسجلة في النظام:
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-gray-950 p-3 rounded-xl border border-gray-800">
              <span className="text-gray-500 text-[10px] block">تم بواسطة:</span>
              <strong className="text-white">{lastResetLog.executedByUserName || "OWNER"}</strong>
            </div>
            <div className="bg-gray-950 p-3 rounded-xl border border-gray-800">
              <span className="text-gray-500 text-[10px] block">تاريخ العملية:</span>
              <strong className="text-white font-mono text-[11px]">
                {new Date(lastResetLog.timestamp).toLocaleString("ar-EG")}
              </strong>
            </div>
            <div className="bg-gray-950 p-3 rounded-xl border border-gray-800">
              <span className="text-gray-500 text-[10px] block">حالة العملية:</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1 mt-0.5">
                <CheckCircle className="w-3.5 h-3.5" />
                {lastResetLog.status}
              </span>
            </div>
          </div>
          {lastResetLog.details && (
            <p className="text-[11px] text-gray-400 bg-gray-950 p-3 rounded-xl border border-gray-800 leading-relaxed">
              {lastResetLog.details}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
