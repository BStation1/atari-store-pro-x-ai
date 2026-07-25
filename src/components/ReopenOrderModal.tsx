/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { X, AlertTriangle, Unlock, ShieldAlert, History } from "lucide-react";
import { useDialog } from "../context/DialogContext";
import { RepairOrder, Customer, User } from "../types";
import { canReopenDeliveredOrder } from "../lib/authPermissions";
import { getCustomerNameHelper, getCustomerBadgeHelper } from "../lib/customerDisplayHelper";

interface ReopenOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: RepairOrder;
  customer?: Customer;
  currentUser: User;
  onConfirmReopen: (orderId: string, reason: string) => { success: boolean; error?: string; order?: RepairOrder } | Promise<{ success: boolean; error?: string; order?: RepairOrder }>;
}

export default function ReopenOrderModal({
  isOpen,
  onClose,
  order,
  customer,
  currentUser,
  onConfirmReopen
}: ReopenOrderModalProps) {
  const dialog = useDialog();
  const isOwnerOrAhmed = canReopenDeliveredOrder(currentUser);

  const [reopenReason, setReopenReason] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!isOwnerOrAhmed) {
      setErrorMsg("عذراً، عملية إعادة فتح طلبات الصيانة المسلمة متاح حصرياً لأحمد البنا (صاحب النظام)!");
      return;
    }

    if (!reopenReason.trim()) {
      setErrorMsg("يرجى إدخال سبب فتح أمر الصيانة إجبارياً للتدقيق وسجلات الرقابة.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await onConfirmReopen(order.id, reopenReason.trim());
      if (res.success) {
        await dialog.alert({
          message: `تمت إعادة فتح أمر الصيانة [${order.id}] بنجاح! يمكنك الآن تعديل بياناته ثم إعادة تسليمه.`,
          variant: "success"
        });
        onClose();
      } else {
        setErrorMsg(res.error || "تعذر إعادة فتح أمر الصيانة.");
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "حدث خطأ غير متوقع.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[#11131e] border border-amber-500/40 rounded-2xl w-full max-w-lg shadow-2xl glow-primary text-right my-auto">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-[#2a2d42] bg-amber-950/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 rounded-xl border border-amber-500/40 text-amber-400">
              <Unlock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                إعادة فتح أمر صيانة مسلّم
                <span className="text-xs font-mono bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-lg border border-amber-500/30 font-bold">
                  {order.id}
                </span>
              </h3>
              <p className="text-[11px] text-amber-300/80 mt-0.5">
                إجراء استثنائي خاص بأحمد البنا (صاحب النظام)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-[#2a2d42] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Warning Banner */}
          <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl space-y-1.5 text-xs text-red-300">
            <div className="flex items-center gap-2 text-red-200 font-bold text-sm">
              <ShieldAlert className="w-5 h-5 text-red-400" />
              تحذير أمان ورقابة مالية:
            </div>
            <p className="leading-relaxed">
              هذا الأمر تم تسليمه وإغلاقه مسبقاً. إعادة فتح هذا الطلب تسمح بتعديل بيانات الصيانة والأجهزة والمبالغ، وستسجل بالتفصيل في{" "}
              <strong className="text-white">سجل الأحداث والرقابة (Audit Log)</strong> باسمك وحسابك.
            </p>
          </div>

          {/* Delivery Info Overview */}
          <div className="bg-gray-950 p-4 rounded-xl border border-[#2a2d42] space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-[#2a2d42] items-center">
              <span className="text-gray-400">العميل:</span>
              <div className="flex items-center gap-1.5">
                <strong className="text-white">{getCustomerNameHelper(order, customer ? [customer] : [])}</strong>
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${
                  getCustomerBadgeHelper(order).type === 'REGISTERED' 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}>
                  {getCustomerBadgeHelper(order).label}
                </span>
              </div>
            </div>
            <div className="flex justify-between py-1 border-b border-[#2a2d42]">
              <span className="text-gray-400">تاريخ التسليم السابق:</span>
              <span className="font-mono text-gray-200">
                {order.deliveredAt ? new Date(order.deliveredAt).toLocaleString("ar-EG") : "مسلّم مسبقاً"}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-400">القائم بالتسليم السابق:</span>
              <span className="font-bold text-emerald-400">{order.deliveredByUserName || "أحمد البنا"}</span>
            </div>
          </div>

          {/* Mandatory Reason Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-amber-300 block">
              سبب إعادة الفتح (مطلوب إجبارياً للرقابة): <span className="text-red-400">*</span>
            </label>
            <textarea
              required
              rows={3}
              placeholder="اكتب سبب إعادة فتح الطلب هنا (مثال: تصحيح قطعة الغيار المستخدمة بناءً على طلب العميل / تعديل القيمة)..."
              value={reopenReason}
              onChange={e => setReopenReason(e.target.value)}
              className="w-full bg-gray-950 border border-[#2a2d42] focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none resize-none"
            />
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl text-xs text-red-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2 border-t border-[#2a2d42]">
            <button
              type="submit"
              disabled={isSubmitting || !reopenReason.trim() || !isOwnerOrAhmed}
              className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-800 disabled:text-gray-500 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-xs transition-all cursor-pointer shadow-lg shadow-amber-950/40"
            >
              {isSubmitting ? (
                <span>جارٍ إعادة الفتح...</span>
              ) : (
                <>
                  <Unlock className="w-4 h-4" />
                  تأكيد إعادة فتح الأمر للورشة
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-3 px-5 rounded-xl text-xs transition-colors cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
