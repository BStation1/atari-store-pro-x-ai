/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RepairOrder } from "../types";

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

export type WhatsAppWorkflowTemplate =
  | "REPAIR_ORDER_CREATED"
  | "APPROVAL_REQUIRED"
  | "READY_FOR_PICKUP"
  | "DELIVERED";

export interface WhatsAppLogEntry {
  id: string;
  orderId: string;
  customer: string;
  phone: string;
  template: WhatsAppWorkflowTemplate;
  status: "SENT" | "FAILED";
  error?: string;
  timestamp: string;
}

const WHATSAPP_LOGS_KEY = "atari_whatsapp_logs_v1";
const WHATSAPP_SENT_KEYS = "atari_whatsapp_sent_keys_v1";

const inMemoryStore: Record<string, string> = {};

function storageGetItem(key: string): string | null {
  try {
    if (typeof localStorage !== "undefined" && localStorage) {
      const val = localStorage.getItem(key);
      if (val !== null) return val;
    }
  } catch {}
  return inMemoryStore[key] || null;
}

function storageSetItem(key: string, value: string): void {
  inMemoryStore[key] = value;
  try {
    if (typeof localStorage !== "undefined" && localStorage) {
      localStorage.setItem(key, value);
    }
  } catch {}
}

function storageRemoveItem(key: string): void {
  delete inMemoryStore[key];
  try {
    if (typeof localStorage !== "undefined" && localStorage) {
      localStorage.removeItem(key);
    }
  } catch {}
}

export function getWhatsAppLogs(): WhatsAppLogEntry[] {
  try {
    const raw = storageGetItem(WHATSAPP_LOGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("Failed to read WhatsApp logs:", err);
    return [];
  }
}

export function addWhatsAppLog(entry: Omit<WhatsAppLogEntry, "id" | "timestamp">): WhatsAppLogEntry {
  const newEntry: WhatsAppLogEntry = {
    ...entry,
    id: "WA-LOG-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
    timestamp: new Date().toISOString()
  };
  const current = getWhatsAppLogs();
  const updated = [newEntry, ...current].slice(0, 1000);
  storageSetItem(WHATSAPP_LOGS_KEY, JSON.stringify(updated));
  return newEntry;
}

export function clearWhatsAppLogs(): void {
  storageRemoveItem(WHATSAPP_LOGS_KEY);
  storageRemoveItem(WHATSAPP_SENT_KEYS);
}

export function isNotificationAlreadySent(dedupKey: string): boolean {
  try {
    const raw = storageGetItem(WHATSAPP_SENT_KEYS);
    const keys: string[] = raw ? JSON.parse(raw) : [];
    return keys.includes(dedupKey);
  } catch {
    return false;
  }
}

export function markNotificationAsSent(dedupKey: string): void {
  try {
    const raw = storageGetItem(WHATSAPP_SENT_KEYS);
    const keys: string[] = raw ? JSON.parse(raw) : [];
    if (!keys.includes(dedupKey)) {
      keys.push(dedupKey);
      storageSetItem(WHATSAPP_SENT_KEYS, JSON.stringify(keys.slice(-500)));
    }
  } catch (err) {
    console.error("Failed to mark notification key:", err);
  }
}

export function openWhatsAppMessage(phone: string, text: string): boolean {
  const formatted = formatEgyptianPhoneForWhatsApp(phone);
  if (!formatted) {
    console.warn("رقم الهاتف غير صالح لإرسال رسالة WhatsApp");
    return false;
  }
  const url = `https://wa.me/${formatted}?text=${encodeURIComponent(text)}`;
  if (typeof window !== "undefined" && window.open) {
    const win = window.open(url, "_blank");
    return Boolean(win);
  }
  return true;
}

export async function sendRepairNotificationWorkflow(params: {
  template: WhatsAppWorkflowTemplate;
  order: RepairOrder;
  customerName?: string;
  customerPhone?: string;
  extra?: {
    reason?: string;
    additionalCost?: number;
    newTotal?: number;
    repairedItems?: string;
    warrantyInfo?: string;
  };
  autoOpenWindow?: boolean;
}): Promise<{ success: boolean; isDuplicate?: boolean; message: string; log?: WhatsAppLogEntry }> {
  const { template, order, customerName, customerPhone, extra, autoOpenWindow = true } = params;

  const name = customerName || order.customerName || "عميلنا العزيز";
  const rawPhone = customerPhone || order.customerPhone || "";
  const phone = formatEgyptianPhoneForWhatsApp(rawPhone);

  const orderId = order.id || "N/A";
  const devicesText =
    order.devices?.map(d => `${d.type || ""} ${d.model || ""}`.trim()).join(" + ") || "الجهاز";
  const trackingUrl = typeof window !== "undefined" ? `${window.location.origin}/track?id=${orderId}` : `/track?id=${orderId}`;

  // Deduplication Key Construction
  let dedupStateKey = `${orderId}_${template}`;
  if (template === "APPROVAL_REQUIRED") {
    dedupStateKey += `_${extra?.additionalCost || 0}_${extra?.newTotal || order.totalEstimatedCost}`;
  } else if (template === "READY_FOR_PICKUP" || template === "DELIVERED") {
    dedupStateKey += `_${order.status}_${order.finalRepairPrice || order.totalEstimatedCost}`;
  }

  // Prevent sending duplicate message if already sent for this exact state
  if (isNotificationAlreadySent(dedupStateKey)) {
    console.warn(`[WhatsApp Workflow] Notification ${dedupStateKey} already sent. Skipping duplicate.`);
    return {
      success: true,
      isDuplicate: true,
      message: "تم إرسال الإشعار سابقاً (منع التكرار)"
    };
  }

  // Validate Phone
  if (!phone) {
    const errorMsg = "رقم الهاتف غير مسجل أو غير صالح لإرسال الواتس آب";
    const log = addWhatsAppLog({
      orderId,
      customer: name,
      phone: rawPhone || "N/A",
      template,
      status: "FAILED",
      error: errorMsg
    });
    return {
      success: false,
      message: "تم حفظ العملية ولكن تعذر إرسال رسالة واتساب.",
      log
    };
  }

  // Generate Message Body according to Template
  let messageText = "";

  switch (template) {
    case "REPAIR_ORDER_CREATED": {
      messageText = `مرحباً ${name} 👋
تم استلام طلب الصيانة رقم [${orderId}] بنجاح لدى مركز الصيانة.
📱 الجهاز: ${devicesText}
💵 التكلفة المقدرة: ${order.totalEstimatedCost || 0} ج.م
💳 المدفوع مقدمًا: ${order.advancePayment || 0} ج.م

🔗 رابط التتبع الفوري:
${trackingUrl}

شكراً لثقتكم بنا! ✨`;
      break;
    }

    case "APPROVAL_REQUIRED": {
      const reason = extra?.reason || "تغيير في قطع الغيار أو تكلفة الصيانة";
      const addCost = extra?.additionalCost ?? 0;
      const newTot = extra?.newTotal ?? order.totalEstimatedCost;

      messageText = `مرحباً ${name} 👋
بخصوص طلب الصيانة رقم [${orderId}] للجهاز (${devicesText}):
يلزم موافقتك على المستجدات التالية:
📌 السبب: ${reason}
💰 التكلفة الإضافية: ${addCost} ج.م
💵 الإجمالي الجديد: ${newTot} ج.م

🔗 رابط المتابعة والموافقة:
${trackingUrl}`;
      break;
    }

    case "READY_FOR_PICKUP": {
      const repaired =
        extra?.repairedItems ||
        order.devices?.map(d => d.issue || d.type).join(" + ") ||
        "تمت الصيانة بنجاح";
      const finalPrice = extra?.newTotal ?? order.finalRepairPrice ?? order.totalEstimatedCost ?? 0;
      const paid = order.advancePayment || 0;
      const remaining = Math.max(0, finalPrice - paid);

      messageText = `مرحباً ${name} 🎉
جهازك (${devicesText}) رقم الطلب [${orderId}] أصبح **جاهزاً للتسليم** الآن!
🛠️ ما تم إصلاحه: ${repaired}
💰 السعر النهائي: ${finalPrice} ج.م
💳 المدفوع: ${paid} ج.م
💵 المتبقي للتحصيل: ${remaining} ج.م

🔗 رابط التتبع: ${trackingUrl}`;
      break;
    }

    case "DELIVERED": {
      const warranty =
        extra?.warrantyInfo ||
        (order.warrantyDays
          ? `ضمان لمدة ${order.warrantyDays} يوم`
          : "الضمان حسب الشروط المدونة بالإيصال");

      messageText = `مرحباً ${name} ✨
شكراً لتعاملك معنا! تم تسليم طلب الصيانة رقم [${orderId}] بنجاح.
📱 الجهاز: ${devicesText}
🛡️ معلومات الضمان: ${warranty}

نتمنى لك تجربة استخدام ممتازة.`;
      break;
    }
  }

  // Attempt to send (open WhatsApp window)
  try {
    if (autoOpenWindow) {
      const opened = openWhatsAppMessage(phone, messageText);
      if (!opened) {
        throw new Error("تعذر فتح النافذة المباشرة للواتس آب");
      }
    }

    markNotificationAsSent(dedupStateKey);

    const log = addWhatsAppLog({
      orderId,
      customer: name,
      phone,
      template,
      status: "SENT"
    });

    return {
      success: true,
      message: "تم تجهيز وإرسال رسالة الواتس آب بنجاح",
      log
    };
  } catch (err: any) {
    const errorMsg = err?.message || "فشل إرسال رسالة الواتس آب";
    const log = addWhatsAppLog({
      orderId,
      customer: name,
      phone,
      template,
      status: "FAILED",
      error: errorMsg
    });

    return {
      success: false,
      message: "تم حفظ العملية ولكن تعذر إرسال رسالة واتساب.",
      log
    };
  }
}
