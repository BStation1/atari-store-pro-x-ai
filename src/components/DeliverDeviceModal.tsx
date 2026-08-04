/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import {
  X,
  CheckCircle,
  AlertTriangle,
  Lock,
  DollarSign,
  Printer,
  FileText,
  Copy,
  Check,
  ShieldCheck,
  CreditCard,
  UserCheck
} from "lucide-react";
import { RepairOrder, Customer, PaymentMethod, User, Invoice } from "../types";
import { canDeliverDevice } from "../lib/authPermissions";
import { PhoneDisplay } from "./PhoneDisplay";
import { formatPhoneDisplay } from "../utils/phone";
import { getCustomerNameHelper, getCustomerPhoneHelper, getCustomerBadgeHelper } from "../lib/customerDisplayHelper";
import { sendRepairNotificationWorkflow } from "../lib/whatsapp";

interface DeliverDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: RepairOrder;
  customer?: Customer;
  currentUser: User;
  invoices: Invoice[];
  onConfirmDelivery: (params: {
    paymentNow: number;
    paymentMethod: PaymentMethod | string;
    deliveryNotes: string;
  }) => { success: boolean; error?: string; order?: RepairOrder; invoice?: Invoice } | Promise<{ success: boolean; error?: string; order?: RepairOrder; invoice?: Invoice }>;
  onOpenReceiptPrint: (order: RepairOrder, invoice?: Invoice) => void;
}

export default function DeliverDeviceModal({
  isOpen,
  onClose,
  order,
  customer,
  currentUser,
  invoices,
  onConfirmDelivery,
  onOpenReceiptPrint
}: DeliverDeviceModalProps) {
  const isOwnerOrAhmed = canDeliverDevice(currentUser);

  // Calculate finances
  const totalCost = Number(order.totalEstimatedCost) || 0;
  const discount = Number(order.discount) || 0;
  const netTotalCost = Math.max(0, totalCost - discount);

  // Existing paid invoices linked to this order
  const orderInvoices = invoices.filter(inv => inv.orderId === order.id && inv.isPaid);
  const invoicesPaidSum = orderInvoices.reduce((sum, inv) => sum + (Number(inv.paidAmount) || 0), 0);
  const totalPreviousPaid = (Number(order.advancePayment) || 0) + invoicesPaidSum;

  const remainingDue = Math.max(0, netTotalCost - totalPreviousPaid);

  // State
  const [paymentNow, setPaymentNow] = useState<number>(remainingDue);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | string>(PaymentMethod.Cash);
  const [deliveryNotes, setDeliveryNotes] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [deliveryResult, setDeliveryResult] = useState<{
    deliveredOrder: RepairOrder;
    createdInvoice?: Invoice;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen) return null;

  const remainingAfterPayment = Math.max(0, remainingDue - (Number(paymentNow) || 0));

  const handleDeliverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!isOwnerOrAhmed) {
      setErrorMsg("عذراً، ليس لديك صلاحية لتسليم الجهاز! هذه العملية مقتصرة حصرياً على أحمد البنا / Owner.");
      return;
    }

    if (paymentNow < 0) {
      setErrorMsg("يرجى إدخال مبلغ دفع صحيحة (أكبر من أو يساوي الصفر).");
      return;
    }

    if (paymentNow > remainingDue) {
      setErrorMsg(`المبلغ المدفوع الآن (${paymentNow} ج.م) أعلى من المتبقي المستحق (${remainingDue} ج.م).`);
      return;
    }

    const isGuestOrder = order.customerType === "GUEST" || !order.customerId;
    if (isGuestOrder && remainingAfterPayment > 0) {
      setErrorMsg(`⚠️ تنبيه هديّة: لا يُسمح ببقاء رصيد آجل (${remainingAfterPayment} ج.م) على عميل زائر عند تسليم الجهاز. يرجى تحصيل كامل المبلغ عند التسليم أو تحويل العميل إلى عميل دائم أولاً!`);
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await onConfirmDelivery({
        paymentNow: Number(paymentNow) || 0,
        paymentMethod,
        deliveryNotes
      });

      if (res.success && res.order) {
        setDeliveryResult({
          deliveredOrder: res.order,
          createdInvoice: res.invoice
        });

        // Trigger WhatsApp DELIVERED notification after DB save
        const waRes = await sendRepairNotificationWorkflow({
          template: "DELIVERED",
          order: res.order,
          customerName: getCustomerNameHelper(res.order, customer ? [customer] : []),
          customerPhone: getCustomerPhoneHelper(res.order, customer ? [customer] : []),
          extra: {
            warrantyInfo: res.order.warrantyDays ? `ضمان لمدة ${res.order.warrantyDays} يوم` : "حسب الشروط المدونة بالإيصال"
          }
        });

        if (!waRes.success) {
          setErrorMsg("تم تسليم الجهاز وتحديث البيانات بنجاح ولكن تعذر إرسال رسالة واتساب.");
        }
      } else {
        setErrorMsg(res.error || "تعذر إتمام عملية التسليم.");
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "حدث خطأ غير متوقع أثناء تسليم الجهاز.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyTrackingLink = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const trackingLink = `${origin}/track?token=${order.trackingToken || ""}`;
    navigator.clipboard.writeText(trackingLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[#11131e] border border-[#2a2d42] rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl glow-primary text-right my-auto">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-[#2a2d42] bg-[#161927]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/30 text-emerald-400">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                تسليم الجهاز واقفال أمر الصيانة
                <span className="text-xs font-mono bg-indigo-500/20 text-indigo-300 px-2.5 py-0.5 rounded-lg border border-indigo-500/30 font-bold">
                  {order.id}
                </span>
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                تحصيل المستحقات وإصدار الفاتورة وقفل الطلب نهائياً
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
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Permission Guard Banner */}
          {!isOwnerOrAhmed && (
            <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl flex items-start gap-3 text-red-300 text-xs">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold text-red-200">تنبيه صلاحيات الأمان:</strong>
                <p className="mt-1">
                  عذراً، تسليم أجهزة الصيانة واعتماد التحصيل النهائي متاح حصرياً للمستخدم:
                  <span className="font-bold text-white"> "أحمد البنا (الشريك الأول / OWNER)"</span>.
                  يمكنك استعراض البيانات فقط.
                </p>
              </div>
            </div>
          )}

          {/* Success Screen after Delivery */}
          {deliveryResult ? (
            <div className="space-y-6 text-center py-4">
              <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/40 shadow-lg shadow-emerald-950/50">
                <CheckCircle className="w-10 h-10" />
              </div>

              <div>
                <h4 className="text-xl font-bold text-white">تم تسليم الجهاز بنجاح!</h4>
                <p className="text-xs text-gray-300 mt-1">
                  تم تسجيل الفاتورة وتسليم الجهاز وقفل طلب الصيانة رقم{" "}
                  <span className="font-mono font-bold text-indigo-400">{order.id}</span> بنجاح.
                </p>
              </div>

              {/* Delivery Receipt Summary Card */}
              <div className="bg-gray-950 p-4 rounded-xl border border-[#2a2d42] space-y-2.5 text-xs text-right">
                <div className="flex justify-between py-1 border-b border-[#2a2d42] items-center">
                  <span className="text-gray-400">العميل:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white">{getCustomerNameHelper(deliveryResult.deliveredOrder, customer ? [customer] : [])}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${
                      getCustomerBadgeHelper(deliveryResult.deliveredOrder).type === 'REGISTERED' 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    }`}>
                      {getCustomerBadgeHelper(deliveryResult.deliveredOrder).label}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between py-1 border-b border-[#2a2d42]">
                  <span className="text-gray-400">القائم بالتسليم:</span>
                  <span className="font-bold text-emerald-400">{currentUser.fullName || "أحمد البنا"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#2a2d42]">
                  <span className="text-gray-400">تاريخ ووقت التسليم:</span>
                  <span className="font-mono text-gray-200">
                    {new Date(deliveryResult.deliveredOrder.deliveredAt || Date.now()).toLocaleString("ar-EG")}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#2a2d42]">
                  <span className="text-gray-400">إجمالي المبلغ المدفوع:</span>
                  <span className="font-extrabold text-emerald-400">
                    {deliveryResult.deliveredOrder.deliverySnapshot?.totalPaid} ج.م
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-400">المتبقي كدَين:</span>
                  <span className={`font-extrabold ${
                    (deliveryResult.deliveredOrder.deliverySnapshot?.remainingBalance || 0) > 0
                      ? "text-rose-400"
                      : "text-emerald-400"
                  }`}>
                    {deliveryResult.deliveredOrder.deliverySnapshot?.remainingBalance || 0} ج.م
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => onOpenReceiptPrint(deliveryResult.deliveredOrder, deliveryResult.createdInvoice)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs transition-all cursor-pointer shadow-md shadow-indigo-950/40"
                >
                  <Printer className="w-4 h-4" />
                  طباعة إيصال التسليم
                </button>

                <button
                  type="button"
                  onClick={handleCopyTrackingLink}
                  className="bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs transition-all cursor-pointer border border-[#3a3e5c]"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  {copiedLink ? "تم نسخ الرابط" : "نسخ رابط التتبع"}
                </button>
              </div>
            </div>
          ) : (
            /* Normal Delivery Confirmation Form */
            <form onSubmit={handleDeliverSubmit} className="space-y-5">
              {/* Order & Customer Summary Card */}
              <div className="bg-gray-950/80 p-4 rounded-xl border border-[#2a2d42] space-y-2.5 text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-[#2a2d42]">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-indigo-400" />
                    <span className="text-gray-400">العميل:</span>
                    <strong className="text-white text-sm">{getCustomerNameHelper(order, customer ? [customer] : [])}</strong>
                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${
                      getCustomerBadgeHelper(order).type === 'REGISTERED' 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    }`}>
                      {getCustomerBadgeHelper(order).label}
                    </span>
                  </div>
                  <PhoneDisplay phone={getCustomerPhoneHelper(order, customer ? [customer] : [])} className="text-gray-400 font-mono" />
                </div>

                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] text-gray-400 block font-bold">الأجهزة في أمر الصيانة:</span>
                  {order.devices.map((dev, idx) => (
                    <div key={dev.id || idx} className="bg-[#11131e] p-2.5 rounded-lg border border-[#2a2d42] flex justify-between items-center text-xs">
                      <div>
                        <span className="font-bold text-indigo-300">{dev.type}</span> ({dev.model})
                        <p className="text-[10px] text-gray-400 mt-0.5">العطل: {dev.issue}</p>
                      </div>
                      <span className="font-mono font-bold text-white bg-gray-950 px-2 py-1 rounded border border-[#2a2d42]">
                        {(dev.finalRepairPrice ?? dev.estimatedCost ?? (Number(dev.partsCost || 0) + Number(dev.laborCost || 0))) || 0} ج.م
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Calculation Grid */}
              <div className="bg-gradient-to-r from-slate-950 via-[#161928] to-slate-950 p-4 rounded-xl border border-indigo-500/30 space-y-3">
                <h4 className="text-xs font-bold text-indigo-300 flex items-center gap-1.5 pb-2 border-b border-[#2a2d42]">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  الموقف المالي والإجماليات
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="bg-gray-950 p-2 rounded-lg border border-[#2a2d42]">
                    <span className="text-[10px] text-gray-400 block">سعر الصيانة المتفق عليه</span>
                    <span className="font-bold text-white text-sm mt-0.5 block">{order.finalRepairPrice ?? totalCost} ج.م</span>
                  </div>

                  <div className="bg-gray-950 p-2 rounded-lg border border-[#2a2d42]">
                    <span className="text-[10px] text-gray-400 block">الخصومات</span>
                    <span className="font-bold text-amber-400 text-sm mt-0.5 block">{discount} ج.م</span>
                  </div>

                  <div className="bg-gray-950 p-2 rounded-lg border border-[#2a2d42]">
                    <span className="text-[10px] text-gray-400 block">المدفوع سابقاً</span>
                    <span className="font-bold text-emerald-400 text-sm mt-0.5 block">{totalPreviousPaid} ج.م</span>
                  </div>

                  <div className="bg-indigo-950/60 p-2 rounded-lg border border-indigo-500/40">
                    <span className="text-[10px] text-indigo-300 block font-bold">المتبقي المستحق</span>
                    <span className="font-extrabold text-cyan-300 text-sm mt-0.5 block">{remainingDue} ج.م</span>
                  </div>
                </div>
              </div>

              {/* Payment Input Section */}
              <div className="space-y-4 bg-gray-950 p-4 rounded-xl border border-[#2a2d42]">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-white flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-emerald-400" />
                    المبلغ المدفوع الآن (عند التسليم):
                  </label>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">
                    خصيصاً لأحمد البنا
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max={remainingDue}
                        value={paymentNow}
                        disabled={!isOwnerOrAhmed}
                        onChange={e => setPaymentNow(Number(e.target.value))}
                        className="w-full bg-[#11131e] border border-[#2a2d42] focus:border-emerald-500 rounded-xl px-3 py-2.5 text-sm text-emerald-300 font-mono font-extrabold focus:outline-none disabled:opacity-50"
                      />
                      <span className="absolute left-3 top-2.5 text-xs text-gray-400 font-bold">ج.م</span>
                    </div>

                    <div className="flex gap-1.5 mt-2">
                      <button
                        type="button"
                        disabled={!isOwnerOrAhmed}
                        onClick={() => setPaymentNow(remainingDue)}
                        className="flex-1 bg-[#1a1d2e] hover:bg-indigo-600/30 text-indigo-300 text-[10px] py-1 px-2 rounded border border-[#2a2d42] font-bold cursor-pointer transition-colors disabled:opacity-50"
                      >
                        دفع كامل المتبقي ({remainingDue} ج.م)
                      </button>
                      <button
                        type="button"
                        disabled={!isOwnerOrAhmed}
                        onClick={() => setPaymentNow(0)}
                        className="bg-[#1a1d2e] hover:bg-rose-600/30 text-rose-300 text-[10px] py-1 px-2 rounded border border-[#2a2d42] font-bold cursor-pointer transition-colors disabled:opacity-50"
                      >
                        آجل (0 ج.م)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1 font-bold">طريقة الدفع:</label>
                    <select
                      value={paymentMethod}
                      disabled={!isOwnerOrAhmed}
                      onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                      className="w-full bg-[#11131e] border border-[#2a2d42] focus:border-emerald-500 rounded-xl px-3 py-2.5 text-xs text-white font-bold focus:outline-none cursor-pointer disabled:opacity-50"
                    >
                      <option value={PaymentMethod.Cash}>نقدي (Cash)</option>
                      <option value={PaymentMethod.InstaPay}>إنستا باي (InstaPay)</option>
                      <option value={PaymentMethod.VodafoneCash}>فودافون كاش (Vodafone Cash)</option>
                      <option value={PaymentMethod.Visa}>فيزا كارد (Visa Card)</option>
                    </select>
                  </div>
                </div>

                {/* Remaining Debt Warning */}
                {remainingAfterPayment > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl flex items-start gap-2.5 text-xs text-amber-300">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-bold text-amber-200 block">تنبيه المتبقي والمستحقات:</strong>
                      <p className="mt-0.5">
                        سيتم تسليم الجهاز مع بقاء مديونية قدرها{" "}
                        <span className="font-bold text-rose-400 dir-ltr inline-block">{remainingAfterPayment} ج.م</span> على حساب العميل!
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Delivery Notes */}
              <div>
                <label className="text-xs font-bold text-gray-300 block mb-1">ملاحظات وشروط التسليم (اختياري):</label>
                <textarea
                  placeholder="ملاحظات حالة التسليم، تجربة الجهاز أمام العميل، الملحقات المسلمة..."
                  value={deliveryNotes}
                  disabled={!isOwnerOrAhmed}
                  onChange={e => setDeliveryNotes(e.target.value)}
                  className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 h-20 resize-none disabled:opacity-50"
                />
              </div>

              {/* Error Alert */}
              {errorMsg && (
                <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl text-xs text-red-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Form Action Buttons */}
              <div className="flex gap-3 pt-2 border-t border-[#2a2d42]">
                <button
                  type="submit"
                  disabled={!isOwnerOrAhmed || isSubmitting}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-800 disabled:text-gray-500 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-xs transition-all cursor-pointer shadow-lg shadow-emerald-950/40"
                >
                  {isSubmitting ? (
                    <span className="inline-block animate-spin font-bold">⏳ جارٍ المعالجة والقفل...</span>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      تأكيد وتسليم الجهاز رسمياً
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
          )}
        </div>
      </div>
    </div>
  );
}
