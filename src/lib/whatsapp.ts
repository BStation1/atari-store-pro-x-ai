/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RepairOrder, Customer } from "../types";

export function formatEgyptianPhoneForWhatsApp(phone: string): string {
  if (!phone || typeof phone !== "string") return "";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("20")) {
    return cleaned;
  }
  if (cleaned.startsWith("01")) {
    return "20" + cleaned.substring(1);
  }
  if (cleaned.startsWith("1") && cleaned.length === 10) {
    return "20" + cleaned;
  }
  return cleaned;
}

export type WhatsAppTemplateType =
  | "received"          // تم استلام الجهاز
  | "diagnosing"        // الجهاز قيد الفحص
  | "cost_determined"   // تم تحديد تكلفة الصيانة
  | "ready"             // الجهاز جاهز للتسليم
  | "due_amount"        // يوجد مبلغ مستحق
  | "delivered"         // تم تسليم الجهاز
  | "warranty_info"     // بيانات الضمان
  | "rejected_cost"     // رفض العميل تكلفة الصيانة
  | "custom";           // رسالة مخصصة

export function getWhatsAppTemplateText(
  type: WhatsAppTemplateType,
  data: {
    customerName?: string;
    orderId?: string;
    deviceType?: string;
    deviceModel?: string;
    status?: string;
    totalCost?: number;
    paidAmount?: number;
    remainingAmount?: number;
    warrantyEndDate?: string;
    shopName?: string;
    trackingLink?: string;
    customText?: string;
  }
): string {
  const shop = data.shopName || "مركز الصيانة الإيطالي (أحمد البنا)";
  const cust = data.customerName || "عميلنا العزيز";
  const device = `${data.deviceType || ""} ${data.deviceModel || ""}`.trim() || "الجهاز";
  const orderId = data.orderId || "";
  const tracking = data.trackingLink || "";

  switch (type) {
    case "received":
      return `مرحباً ${cust} 👋
تم استلام جهازك (${device}) بنجاح لدى ${shop}.
رقم الطلب: [${orderId}]
المدفوع مقدمًا: ${data.paidAmount || 0} ج.م
التكلفة المبدئية: ${data.totalCost || 0} ج.م

يمكنك متابعة حالة الجهاز مباشرة عبر الرابط:
${tracking}

شكراً لثقتكم بنا! ✨`;

    case "diagnosing":
      return `مرحباً ${cust} 👋
جهازك (${device}) رقم الطلب [${orderId}] قيد الفحص والتشخيص حالياً بواسطة المهندس المختص في ${shop}.
سنوافيك بتقرير الفحص والتكلفة قريباً.

رابط التتبع: ${tracking}`;

    case "cost_determined":
      return `مرحباً ${cust} 👋
تم الانتهاء من فحص جهازك (${device}) رقم الطلب [${orderId}].
تكلفة الإصلاح المطلوبة: ${data.totalCost || 0} ج.م
يرجى إبلاغنا بقرارك للبدء في عملية الصيانة.

رابط التتبع: ${tracking}`;

    case "ready":
      return `مرحباً ${cust} 🎉
جهازك (${device}) رقم الطلب [${orderId}] أصبح **جاهزاً للتسليم** الآن لدى ${shop}!
المبلغ المتبقي للتحصيل: ${data.remainingAmount || 0} ج.م

يسعدنا تشريفك لمعاينة واستلام الجهاز.`;

    case "due_amount":
      return `مرحباً ${cust} 👋
تذكير من ${shop}:
يوجد مبلغ مستحق قدره (${data.remainingAmount || 0} ج.م) بخصوص جهازك (${device}) رقم الطلب [${orderId}].
نرجو التكرم بالسداد في أقرب وقت. شاكرين تعاونك.`;

    case "delivered":
      return `مرحباً ${cust} ✨
تم تسليم جهازك (${device}) رقم الطلب [${orderId}] بنجاح.
نتمنى لك تجربة استخدام ممتازة مع ${shop}!
في حال وجود أي استفسار نرجو التواصل معنا.`;

    case "warranty_info":
      return `مرحباً ${cust} 🛡️
بيانات ضمان جهازك (${device}) رقم الطلب [${orderId}] من ${shop}:
- حالة الضمان: داخل فترة الضمان
- تاريخ نهاية الضمان: ${data.warrantyEndDate || "غير محدد"}

نحن دائماً في خدمتك!`;

    case "rejected_cost":
      return `مرحباً ${cust} 👋
تم تسجيل عدم الموافقة على تكلفة صيانة جهازك (${device}) رقم الطلب [${orderId}].
الجهاز جاهز للاستلام بدون صيانة لدى ${shop}.`;

    case "custom":
    default:
      return data.customText || `مرحباً ${cust}، بخصوص طلب الصيانة [${orderId}] لدى ${shop}.`;
  }
}

export function openWhatsAppMessage(
  phone: string,
  text: string
): boolean {
  const formatted = formatEgyptianPhoneForWhatsApp(phone);
  if (!formatted) {
    console.warn("رقم الهاتف غير صالح لإرسال رسالة WhatsApp");
    return false;
  }
  const url = `https://wa.me/${formatted}?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank");
  return true;
}
