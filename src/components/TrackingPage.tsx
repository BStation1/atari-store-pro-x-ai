/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Search,
  Wrench,
  Clock,
  CheckCircle,
  AlertTriangle,
  Smartphone,
  ChevronLeft,
  Calendar,
  X,
  User,
  ShieldCheck,
  MapPin,
  Check,
  Layers,
  DollarSign,
  FileText,
  MessageSquare,
  PackageCheck,
  Copy,
  Share2,
  PhoneCall,
  ExternalLink,
  Lock,
  Phone
} from "lucide-react";
import { useRepairOrders, useCustomers, useSettings } from "../hooks/useData";
import { RepairStatus, RepairOrder, Customer } from "../types";

import { getCustomerNameHelper, getCustomerPhoneHelper, getCustomerBadgeHelper } from "../lib/customerDisplayHelper";
import { PhoneDisplay } from "./PhoneDisplay";

interface TrackingPageProps {
  initialQuery?: string;
}

export default function TrackingPage({ initialQuery }: TrackingPageProps) {
  const { orders } = useRepairOrders();
  const { customers } = useCustomers();
  const { settings } = useSettings();

  const [orderId, setOrderId] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [matchedOrders, setMatchedOrders] = useState<RepairOrder[]>([]);
  const [searchedOrder, setSearchedOrder] = useState<RepairOrder | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [copiedToast, setCopiedToast] = useState(false);

  // Verification helper function
  const verifyAndExecuteSearch = (searchOrder: string, searchPhone: string, directToken?: string) => {
    setHasSearched(true);
    setVerificationError(null);

    const cleanOrder = searchOrder.trim().toLowerCase();
    const cleanPhone = searchPhone.trim().toLowerCase();
    const cleanPhoneDigits = cleanPhone.replace(/\D/g, "");
    const cleanToken = directToken?.trim().toLowerCase();

    if (!cleanOrder && !cleanPhone && !cleanToken) {
      setVerificationError("يرجى إدخال رقم الطلب ورقم الهاتف المسجل معًا للتحقق من هوية صاحب الجهاز.");
      setMatchedOrders([]);
      setSearchedOrder(null);
      return;
    }

    const verified = orders.filter(order => {
      // Direct token verification (from generated customer tracking link)
      if (cleanToken && order.trackingToken && order.trackingToken.toLowerCase() === cleanToken) {
        return true;
      }

      // Check order ID or device code or tracking token match
      const isOrderMatch =
        order.id.toLowerCase() === cleanOrder ||
        order.trackingToken?.toLowerCase() === cleanOrder ||
        order.devices.some(d => d.deviceCode?.toLowerCase() === cleanOrder || (d.serialNumber && d.serialNumber.toLowerCase() === cleanOrder));

      if (!isOrderMatch) return false;

      // Check customer phone match for strict double-factor security
      const custPhone = getCustomerPhoneHelper(order, customers);
      if (!custPhone) return false;

      const custPhoneDigits = custPhone.replace(/\D/g, "");
      if (cleanPhoneDigits.length >= 4) {
        return custPhoneDigits.includes(cleanPhoneDigits) || cleanPhoneDigits.includes(custPhoneDigits);
      }

      return custPhone.toLowerCase().includes(cleanPhone);
    });

    if (verified.length > 0) {
      setMatchedOrders(verified);
      setSearchedOrder(verified[0]);
      setVerificationError(null);
    } else {
      setMatchedOrders([]);
      setSearchedOrder(null);

      // Check if order exists to give specific error
      const existsWithoutPhoneMatch = orders.some(
        o => o.id.toLowerCase() === cleanOrder || o.trackingToken?.toLowerCase() === cleanOrder
      );

      if (existsWithoutPhoneMatch && cleanOrder && !cleanPhone) {
        setVerificationError("رقم الطلب موجود، لكن لأسباب أمنية يتعين عليك إدخال رقم الهاتف المسجل لتأكيد الهوية.");
      } else if (existsWithoutPhoneMatch) {
        setVerificationError("رقم الهاتف المرفق لا يتطابق مع بيانات هذا الطلب. يرجى التأكد من رقم الهاتف المدون بالإيصال.");
      } else {
        setVerificationError("لم نتمكن من العثور على أي طلب صيانة يطابق البيانات المدخلة. يرجى التحقق وإعادة المحاولة.");
      }
    }
  };

  // Auto-search on mount if query provided via prop or URL params
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const queryId = initialQuery || urlParams.get("id") || urlParams.get("orderId") || urlParams.get("track") || "";
      const queryPhone = urlParams.get("phone") || urlParams.get("mobile") || "";
      const queryToken = urlParams.get("token") || "";

      if (queryId) setOrderId(queryId);
      if (queryPhone) setPhoneInput(queryPhone);

      if ((queryId && queryPhone) || queryToken || (initialQuery && initialQuery.length > 3)) {
        verifyAndExecuteSearch(queryId || initialQuery || "", queryPhone, queryToken);
      }
    }
  }, [initialQuery, orders]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    verifyAndExecuteSearch(orderId, phoneInput);
  };

  // Get full customer direct tracking link
  const getCustomerTrackingLink = (order: RepairOrder): string => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const cust = customers.find(c => c.id === order.customerId);
    const phoneParam = cust?.phone ? `&phone=${encodeURIComponent(cust.phone)}` : "";
    const tokenParam = order.trackingToken ? `&token=${encodeURIComponent(order.trackingToken)}` : "";
    return `${origin}/?view=tracking&id=${order.id}${phoneParam}${tokenParam}`;
  };

  // Helper to copy tracking URL to clipboard
  const copyTrackingLink = (order: RepairOrder) => {
    const link = getCustomerTrackingLink(order);
    navigator.clipboard.writeText(link);
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 3000);
  };

  // Generate WhatsApp Share URL for Customer
  const shareOrderViaWhatsApp = (order: RepairOrder) => {
    const cust = customers.find(c => c.id === order.customerId);
    const link = getCustomerTrackingLink(order);
    const message = `مرحباً ${cust?.name || "عميلنا العزيز"}،\nيمكنك متابعة حالة وسجل صيانة جهازك (طلب رقم ${order.id}) عبر الرابط المباشر التالي:\n${link}\n\nشكراً لتعاملك مع ${settings.companyName}`;
    const targetPhone = cust?.phone ? cust.phone.replace(/[^0-9]/g, "") : (settings?.phone || "").replace(/[^0-9]/g, "");
    const waUrl = `https://wa.me/${targetPhone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, "_blank");
  };

  // Timeline updates mapper based on status
  const getTimelineSteps = (order: RepairOrder) => {
    const status = order.status;
    const receivedDateFormatted = new Date(order.receivedDate).toLocaleDateString("ar-EG", {
      weekday: "long",
      year: "numeric",
      month: "short",
      day: "numeric"
    });

    const completionDateFormatted = order.completionDate
      ? new Date(order.completionDate).toLocaleDateString("ar-EG", {
          weekday: "long",
          year: "numeric",
          month: "short",
          day: "numeric"
        })
      : null;

    const steps = [
      {
        key: RepairStatus.Received,
        text: "تم استلام الجهاز بالمركز",
        date: receivedDateFormatted,
        desc: "تم تسجيل الجهاز بالاستقبال وإصدار كود الصيانة وتوثيق الملحقات والحالة الظاهرية."
      },
      {
        key: RepairStatus.Diagnosing,
        text: "تحت الفحص والتشخيص الهندسي",
        date: "تاريخ الفحص الفني",
        desc: "فحص الدوائر الإلكترونية وتحديد العطل بدقة وإعداد التقرير الفني."
      },
      {
        key: RepairStatus.WaitingCustomerApproval,
        text: "بانتظار موافقة العميل على التسعيرة",
        date: "اعتماد التكلفة",
        desc: "تم إبلاغ العميل بتقرير الفحص والتكلفة المعتمدة بانتظار موافقته لبدء الصيانة."
      },
      {
        key: RepairStatus.Repairing,
        text: "قيد الصيانة والتركيب الفعلي",
        date: "عمليات الورشة",
        desc: "استبدال قطع الغيار المطلوبة وإجراء عمليات الصيانة اللازمة."
      },
      {
        key: RepairStatus.Testing,
        text: "تحت التجربة والمعايرة البرمجية",
        date: "فحص الجودة (QC)",
        desc: "اختبار الجهاز تحت الضغط الحراري للتأكد من ثبات الأداء وعودة كفاءة التشغيل."
      },
      {
        key: RepairStatus.Ready,
        text: "جاهز تماماً للتسليم بالفرع",
        date: completionDateFormatted || "جاهز للاستلام",
        desc: "الجهاز مغلف ومحفوظ بالرف الخاص بانتظار تشريفكم للاستلام."
      },
      {
        key: RepairStatus.Delivered,
        text: "تم تسليم الجهاز للعميل بنجاح",
        date: completionDateFormatted || "تاريخ التسليم",
        desc: "تم تسليم الجهاز وتصفية الحساب المالي وإصدار فاتورة الضمان."
      }
    ];

    const statusOrder = [
      RepairStatus.Received,
      RepairStatus.Diagnosing,
      RepairStatus.WaitingCustomerApproval,
      RepairStatus.WaitingParts,
      RepairStatus.Repairing,
      RepairStatus.Testing,
      RepairStatus.Ready,
      RepairStatus.Delivered
    ];

    const currentIndex = statusOrder.indexOf(status);

    return steps.map(step => {
      let stepIndex = statusOrder.indexOf(step.key);
      if (step.key === RepairStatus.Repairing && status === RepairStatus.WaitingParts) {
        return {
          ...step,
          done: true,
          current: true,
          text: "قيد الصيانة (بانتظار وصول قطع الغيار المطلوب)",
          desc: "تم طلب قطع الغيار وجاري الانتظار لتركيبها والبدء في الفحص النهائي."
        };
      }
      return {
        ...step,
        done: stepIndex <= currentIndex,
        current: stepIndex === currentIndex
      };
    });
  };

  const statusTexts = {
    [RepairStatus.Received]: "تم استلام الجهاز",
    [RepairStatus.Diagnosing]: "تحت الفحص والتشخيص حالياً",
    [RepairStatus.WaitingCustomerApproval]: "بانتظار موافقتك على تكلفة الصيانة",
    [RepairStatus.WaitingParts]: "قيد الانتظار لوصول قطع الغيار اللازمة",
    [RepairStatus.Repairing]: "قيد الإصلاح والصيانة الآن",
    [RepairStatus.Testing]: "تحت التجربة لضمان كفاءة الصيانة",
    [RepairStatus.Ready]: "جاهز للاستلام الآن! تفضل بزيارتنا",
    [RepairStatus.Delivered]: "تم التسليم بنجاح وشكراً لتعاملك معنا",
    [RepairStatus.Cancelled]: "تم إلغاء طلب الصيانة"
  };

  const getCustomerObj = (customerId: string): Customer | undefined => {
    return customers.find(c => c.id === customerId);
  };

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 text-right dir-rtl font-sans selection:bg-indigo-500 selection:text-white">
      {/* Toast Notification */}
      {copiedToast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl text-xs font-bold flex items-center gap-2 border border-emerald-400/30">
          <Check className="w-4 h-4 text-emerald-200" />
          تم نسخ رابط التتبع الفريد للعميل بنجاح!
        </div>
      )}

      {/* App brand header */}
      <div className="text-center mb-8 space-y-2">
        <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 px-4 py-1.5 rounded-full text-indigo-400 text-xs font-bold mb-1 shadow-inner">
          <ShieldCheck className="w-4 h-4 text-indigo-400" />
          بوابة تتبع الصيانة المشفرة والآمنة
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{settings.companyName}</h1>
        <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
          تابع حالة وسجل صيانة جهازك في أي وقت ومن أي جهاز بكل سهولة وأمان
        </p>
      </div>

      {/* Verification Search Form */}
      <div className="bg-[#11131e] border border-[#2a2d42] p-5 sm:p-6 rounded-3xl shadow-2xl backdrop-blur-md">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#2a2d42]">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Lock className="w-4 h-4 text-indigo-400" />
            الاستعلام الآمن عن حالة الصيانة
          </h3>
          <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800 px-2.5 py-1 rounded-lg font-mono">
            تحقق مزدوج
          </span>
        </div>

        <form onSubmit={handleSearch} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-gray-300 mb-1 block">رقم طلب الصيانة أو كود الجهاز *</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="مثال: R-2026-101"
                  value={orderId}
                  onChange={e => setOrderId(e.target.value)}
                  className="w-full bg-gray-950 border border-[#2a2d42] focus:border-indigo-500 rounded-xl px-4 py-3 text-xs text-white placeholder-gray-600 focus:outline-none font-mono text-left dir-ltr"
                  required
                />
                <Search className="w-4 h-4 text-gray-600 absolute left-3 top-3.5 hidden sm:block" />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-300 mb-1 block">رقم الهاتف المسجل للعميل *</label>
              <div className="relative">
                <input
                  type="tel"
                  placeholder="مثال: 01012345678"
                  value={phoneInput}
                  onChange={e => setPhoneInput(e.target.value)}
                  className="w-full bg-gray-950 border border-[#2a2d42] focus:border-indigo-500 rounded-xl px-4 py-3 text-xs text-white placeholder-gray-600 focus:outline-none font-mono text-left dir-ltr"
                  required
                />
                <Phone className="w-4 h-4 text-gray-600 absolute left-3 top-3.5 hidden sm:block" />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 px-6 rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-950/50 cursor-pointer flex items-center justify-center gap-2 mt-2"
          >
            <ShieldCheck className="w-4 h-4" />
            تحقق واستعلام عن الطلب
          </button>
        </form>

        <p className="text-[10px] text-gray-500 mt-3 text-center">
          🔒 لحماية خصوصيتك، يلزم إدخال رقم الطلب ورقم الهاتف معًا لفتح بيانات الصيانة.
        </p>
      </div>

      {/* Security Error Display */}
      {hasSearched && verificationError && (
        <div className="mt-6 bg-red-950/30 border border-red-500/30 p-5 rounded-2xl text-right space-y-2">
          <div className="flex items-center gap-2 text-red-400 font-bold text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>تعذر فتح بيانات طلب الصيانة</span>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed">{verificationError}</p>
        </div>
      )}

      {/* Multiple Orders Selector if customer has multiple devices */}
      {hasSearched && !verificationError && matchedOrders.length > 1 && (
        <div className="mt-6 bg-[#11131e] border border-[#2a2d42] p-4 rounded-2xl space-y-3">
          <span className="text-xs font-bold text-indigo-400 block">
            تم العثور على ({matchedOrders.length}) طلبات صيانة متحقق منها لهذا الهاتف:
          </span>
          <div className="flex flex-wrap gap-2">
            {matchedOrders.map(ord => (
              <button
                key={ord.id}
                onClick={() => setSearchedOrder(ord)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  searchedOrder?.id === ord.id
                    ? "bg-indigo-600 border-indigo-500 text-white shadow-md"
                    : "bg-gray-950 border-[#2a2d42] text-gray-400 hover:text-white"
                }`}
              >
                طلب {ord.id} ({statusTexts[ord.status] || ord.status})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Verified Order Results Display */}
      {hasSearched && !verificationError && searchedOrder && (
        <div className="mt-6 space-y-6">
          {/* Customer Welcome Header */}
          <div className="bg-indigo-950/30 border border-indigo-500/30 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-600/20 rounded-xl text-indigo-400 border border-indigo-500/30">
                <User className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] text-indigo-300 block">صاحب الجهاز المعرب</span>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <h4 className="text-sm font-bold text-white">
                    {getCustomerNameHelper(searchedOrder, customers)}
                  </h4>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    getCustomerBadgeHelper(searchedOrder).type === 'REGISTERED' 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  }`}>
                    {getCustomerBadgeHelper(searchedOrder).label}
                  </span>
                </div>
              </div>
            </div>

              {/* Action Buttons: WhatsApp Share & Copy Link */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => shareOrderViaWhatsApp(searchedOrder)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-emerald-950/40"
                  title="مشاركة تفاصيل التتبع عبر واتساب"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>مشاركة عبر واتساب</span>
                </button>

                <button
                  onClick={() => copyTrackingLink(searchedOrder)}
                  className="bg-gray-900 hover:bg-gray-800 border border-[#2a2d42] text-gray-300 hover:text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="نسخ رابط التتبع الفريد"
                >
                  <Copy className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="hidden sm:inline">نسخ الرابط</span>
                </button>
              </div>
            </div>

          {/* Main Status Header Card */}
          <div className="bg-[#11131e] border border-indigo-500/30 p-5 sm:p-6 rounded-3xl shadow-xl space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-3 pb-4 border-b border-[#2a2d42]">
              <div>
                <span className="text-[10px] text-gray-400 block">رقم أمر الصيانة</span>
                <span className="font-mono font-black text-indigo-400 text-2xl">{searchedOrder.id}</span>
              </div>
              <div className="text-left">
                <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-3.5 py-1.5 rounded-xl text-xs font-bold block mb-1">
                  {statusTexts[searchedOrder.status]}
                </span>
                <span className="text-[10px] text-gray-400 block font-mono">
                  تاريخ التسليم بالمحل: {new Date(searchedOrder.receivedDate).toLocaleDateString("ar-EG")}
                </span>
              </div>
            </div>

            {/* Public Financial Status Bar (Customer Safe - Pure Totals) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-gray-950/80 p-3.5 rounded-2xl border border-[#2a2d42]">
                <span className="text-[10px] text-gray-400 block">سعر الصيانة المتفق عليه</span>
                <span className="text-base font-bold text-white mt-0.5 block">
                  {searchedOrder.finalRepairPrice ?? searchedOrder.totalEstimatedCost} ج.م
                </span>
              </div>
              <div className="bg-gray-950/80 p-3.5 rounded-2xl border border-[#2a2d42]">
                <span className="text-[10px] text-gray-400 block">المدفوع مقدمًا (العربون)</span>
                <span className="text-base font-bold text-indigo-400 mt-0.5 block">
                  {searchedOrder.advancePayment} ج.م
                </span>
              </div>
              <div className="bg-gray-950/80 p-3.5 rounded-2xl border border-[#2a2d42]">
                <span className="text-[10px] text-gray-400 block">المتبقي عند الاستلام النهائي</span>
                <span className="text-base font-bold text-emerald-400 mt-0.5 block">
                  {Math.max(0, (searchedOrder.finalRepairPrice ?? searchedOrder.totalEstimatedCost) - searchedOrder.advancePayment)} ج.م
                </span>
              </div>
            </div>
          </div>

          {/* Devices Breakdown Card */}
          <div className="bg-[#11131e] border border-[#2a2d42] p-5 sm:p-6 rounded-3xl shadow-md space-y-4">
            <h4 className="text-sm font-bold text-white flex items-center gap-2 border-b border-[#2a2d42] pb-3">
              <Smartphone className="w-4 h-4 text-indigo-400" />
              الأجهزة المسجلة بهذا الطلب ({searchedOrder.devices.length})
            </h4>

            <div className="space-y-4">
              {searchedOrder.devices.map((device, idx) => (
                <div key={idx} className="bg-gray-950 p-4 rounded-2xl border border-[#2a2d42] space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="text-[10px] text-indigo-400 font-mono font-bold block">
                        رمز الجهاز: {device.deviceCode || `${searchedOrder.id}-${idx + 1}`}
                      </span>
                      <h5 className="text-sm font-bold text-white mt-0.5">
                        {device.type} ({device.model})
                      </h5>
                    </div>
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-500/20 px-3 py-1 rounded-xl">
                      {device.finalRepairPrice ?? device.estimatedCost} ج.م
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-300">
                    <div className="bg-[#11131e] p-3 rounded-xl border border-[#2a2d42]/60">
                      <span className="text-[10px] text-gray-500 block">العطل الملاحظ:</span>
                      <span className="font-medium text-amber-300">{device.issue}</span>
                    </div>

                    <div className="bg-[#11131e] p-3 rounded-xl border border-[#2a2d42]/60">
                      <span className="text-[10px] text-gray-500 block">الرقم التسلسلي (Serial):</span>
                      <span className="font-mono text-gray-300">{device.serialNumber || "غير مدون"}</span>
                    </div>
                  </div>

                  {device.accessories && (
                    <div className="text-xs">
                      <span className="text-[10px] text-gray-500 block mb-1">الملحقات المستلمة:</span>
                      <span className="text-gray-300 bg-gray-900 border border-[#2a2d42] px-2.5 py-1 rounded-lg inline-block text-[11px]">
                        {device.accessories}
                      </span>
                    </div>
                  )}

                  {/* Public Diagnostic Notes for Customer */}
                  {device.technicianNotes && (
                    <div className="bg-indigo-950/30 border border-indigo-500/20 p-3 rounded-xl text-xs">
                      <span className="text-[10px] text-indigo-400 font-bold block mb-1">📝 تقرير الفحص المعتمد:</span>
                      <p className="text-gray-200 leading-relaxed whitespace-pre-line">{device.technicianNotes}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Timeline Steps */}
          <div className="bg-[#11131e] border border-[#2a2d42] p-5 sm:p-6 rounded-3xl shadow-md space-y-4">
            <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2 border-b border-[#2a2d42] pb-3">
              <Clock className="w-4 h-4 text-indigo-400" />
              مراحل وسجل الصيانة الزمني
            </h4>
            <div className="relative pr-4 border-r-2 border-[#2a2d42] space-y-6 pt-2">
              {getTimelineSteps(searchedOrder).map((step, idx) => (
                <div key={idx} className="relative flex items-start gap-3">
                  {/* Timeline bullet icon */}
                  <div
                    className={`absolute -right-[23px] top-1.5 w-3 h-3 rounded-full border-2 ${
                      step.current
                        ? "bg-indigo-500 border-indigo-400 animate-ping"
                        : step.done
                        ? "bg-indigo-600 border-indigo-500"
                        : "bg-[#11131e] border-gray-600"
                    }`}
                  ></div>
                  <div
                    className={`absolute -right-[23px] top-1.5 w-3 h-3 rounded-full border-2 ${
                      step.current
                        ? "bg-indigo-500 border-indigo-400"
                        : step.done
                        ? "bg-indigo-600 border-indigo-500"
                        : "bg-[#11131e] border-gray-600"
                    }`}
                  ></div>

                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-bold block ${
                          step.current ? "text-indigo-400 text-sm" : step.done ? "text-white" : "text-gray-500"
                        }`}
                      >
                        {step.text}
                      </span>
                      {step.done && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </div>
                    <p className="text-[11px] text-gray-400 leading-relaxed">{step.desc}</p>
                    {step.done && <span className="text-[10px] text-gray-500 font-mono block">{step.date}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Direct Support & WhatsApp Bar */}
          <div className="bg-gray-950 p-5 rounded-3xl border border-[#2a2d42] space-y-3 text-center text-xs">
            <p className="text-gray-300 font-medium">هل لديك أي استفسار بخصوص حالة جهازك أو تفاصيل الاستلام؟</p>

            <div className="flex flex-wrap justify-center gap-3">
              <a
                href={`https://wa.me/${(settings?.phone || "").replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                  `مرحباً، لدي استفسار حول طلب الصيانة رقم: ${searchedOrder.id}`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-colors shadow-lg shadow-emerald-950/40 cursor-pointer"
              >
                <MessageSquare className="w-4 h-4" />
                تواصل مباشر عبر الواتساب
              </a>

              <button
                onClick={() => shareOrderViaWhatsApp(searchedOrder)}
                className="inline-flex items-center gap-2 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 font-bold px-5 py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                إرسال رابط التتبع المباشر
              </button>
            </div>

            <div className="pt-3 border-t border-[#2a2d42] text-[10px] text-gray-500 flex flex-wrap justify-center gap-4">
              <span>{settings.companyName}</span>
              <span>•</span>
              <span>{settings.address}</span>
              <span>•</span>
              <span>هاتف: <PhoneDisplay phone={settings.phone} /></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

