/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Trash2, AlertTriangle, X, RefreshCw, RotateCcw } from "lucide-react";
import { Invoice, User } from "../types";

interface DeleteSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice;
  currentUser: User;
  onConfirmCancelSale: (reason: string) => { success: boolean; error?: string };
}

export default function DeleteSaleModal({
  isOpen,
  onClose,
  invoice,
  currentUser,
  onConfirmCancelSale
}: DeleteSaleModalProps) {
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!reason.trim() || reason.trim().length < 3) {
      setErrorMsg("يرجى كتابة سبب تفصيلي وملائم لإلغاء وتصفية عملية البيع.");
      return;
    }

    if (confirmText.trim() !== "حذف") {
      setErrorMsg('يرجى كتابة كلمة "حذف" للتأكيد النهائي للحذف والتصفية.');
      return;
    }

    setIsSubmitting(true);
    const result = onConfirmCancelSale(reason.trim());
    setIsSubmitting(false);

    if (result.success) {
      onClose();
    } else {
      setErrorMsg(result.error || "حدث خطأ أثناء إلغاء وتصفية الفاتورة.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-rose-500/40 rounded-2xl max-w-lg w-full p-6 shadow-2xl text-slate-100 text-right">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-100 flex items-center gap-2">
                حذف وتصفية عملية بيع (DELETE_SALE)
              </h3>
              <p className="text-xs text-rose-400 font-semibold">مقتصر حصريًا على أحمد البنا (OWNER)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Invoice Brief */}
        <div className="mt-4 p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs space-y-1.5">
          <div className="flex justify-between text-slate-300">
            <span>رقم الفاتورة: <strong className="text-white">{invoice.id}</strong></span>
            <span>التاريخ: <strong className="text-white">{new Date(invoice.date).toLocaleDateString("ar-EG")}</strong></span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>المبلغ الإجمالي: <strong className="text-emerald-400">{invoice.totalAmount} ج.م</strong></span>
            <span>عدد الأصناف المباعة: <strong className="text-indigo-400">{invoice.items?.length || 0}</strong></span>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 space-y-1">
            <div className="flex items-center gap-2 font-bold text-rose-200">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              تأثير عملية الحذف والتصفية الآمنة:
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] opacity-90 pr-2">
              <li>سيتم استعادة الأصناف المباعة تلقائيًا للمخزن لرفع كميتها المتبقية.</li>
              <li>سيتم إلغاء تأثير الفاتورة على أرباح المبيعات والخزينة بشكل دقيق.</li>
              <li>سيتم احتفاظ السجل برقم الفاتورة لأغراض الرقابة وتتبع الحركات (Soft Delete).</li>
            </ul>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              سبب إلغاء وتصفية عملية البيع <span className="text-rose-400">*</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="اكتب سبب إلغاء عملية البيع بالتفصيل (مثل: إرجاع العميل للمنتج، خطأ في التسجيل...)"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              للتأكيد، اكتب كلمة <span className="text-rose-400 font-bold">"حذف"</span> بالأسفل:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder='اكتب "حذف"'
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500"
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
              className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-2 transition shadow-lg shadow-rose-600/20 disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              تأكيد إلغاء وتصفية عملية البيع
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
