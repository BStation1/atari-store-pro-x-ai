/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { ShieldAlert, AlertTriangle, X, Lock } from "lucide-react";
import { RepairOrder, User } from "../types";

interface CancelWarrantyModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: RepairOrder;
  currentUser: User;
  onConfirmCancel: (reason: string) => { success: boolean; error?: string };
}

export default function CancelWarrantyModal({
  isOpen,
  onClose,
  order,
  currentUser,
  onConfirmCancel
}: CancelWarrantyModalProps) {
  const [reasonCategory, setReasonCategory] = useState("الجهاز تعرض لكسر");
  const [customReason, setCustomReason] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const fullReason = reasonCategory === "سبب آخر" 
      ? customReason.trim() 
      : `${reasonCategory}${customReason.trim() ? " - " + customReason.trim() : ""}`;

    if (!fullReason || fullReason.length < 3) {
      setErrorMsg("يرجى اختيار أو ذكر سبب تفصيلي لإلغاء الضمان.");
      return;
    }

    setIsSubmitting(true);
    const result = onConfirmCancel(fullReason);
    setIsSubmitting(false);

    if (result.success) {
      onClose();
    } else {
      setErrorMsg(result.error || "حدث خطأ أثناء إلغاء الضمان.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl max-w-lg w-full p-6 shadow-2xl text-slate-100 text-right">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-100 flex items-center gap-2">
                إلغاء ضمان أجهزة الصيانة
              </h3>
              <p className="text-xs text-amber-400 font-semibold">إجراء استثنائي خاص بأحمد البنا (OWNER)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-amber-200">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
              تنبيه هام جداً:
            </div>
            <p className="leading-relaxed">
              عملية إلغاء الضمان لأمر الصيانة [<strong>{order.id}</strong>] هي قرار استثنائي سيحرم الجهاز من التغطية المجانية المستقبليّة مع حفظ جميع السجلات للتدقيق الرقابي.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              سبب إلغاء الضمان الرئيسي <span className="text-rose-400">*</span>
            </label>
            <select
              value={reasonCategory}
              onChange={e => setReasonCategory(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
            >
              <option value="الجهاز تعرض لكسر">الجهاز تعرض لكسر / صدمات خارجية</option>
              <option value="الجهاز تعرض لمياه أو رطوبة">الجهاز تعرض لسوائل أو رطوبة أو مياه</option>
              <option value="الجهاز تم فتحه خارج المركز">الجهاز تم فتحه أو عبث به خارج المركز</option>
              <option value="سوء استخدام العميل">سوء استخدام أو تشغيل خاطئ من العميل</option>
              <option value="تلف مختلف عن العطل السابق">تلف مكونات مختلفة غير مشمولة بالصيانة السابقة</option>
              <option value="سبب آخر">سبب آخر (اكتب بالتفصيل بالأسفل)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              ملاحظات وتفاصيل إضافية للسبب <span className="text-slate-500">(اختياري أو إجباري مع سبب آخر)</span>
            </label>
            <textarea
              value={customReason}
              onChange={e => setCustomReason(e.target.value)}
              rows={3}
              placeholder="اكتب أسباب إلغاء الضمان أو شروط العميل الموضحة للتدقيق..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 font-bold">
              {errorMsg}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 border border-slate-700 transition"
            >
              إلغاء الأمر
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 flex items-center gap-2 transition shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              <ShieldAlert className="w-4 h-4" />
              تأكيد إلغاء الضمان رسميًا
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
