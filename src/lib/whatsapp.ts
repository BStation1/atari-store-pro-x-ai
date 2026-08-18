/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RepairOrder } from "../types";
import { getDeviceDisplayName } from "./customerDisplayHelper";
import { generateSecureTrackingToken } from "./trackingToken";

export function formatEgyptianPhoneForWhatsApp(phone: string): string {
  if (!phone || typeof phone !== "string") return "";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("20")) return cleaned;
  if (cleaned.startsWith("01")) return "20" + cleaned.substring(1);
  if (cleaned.startsWith("1") && cleaned.length === 10) return "20" + cleaned;
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
    if (typeof localStorage !== "undefined" && localStorage) localStorage.setItem(key, value);
  } catch {}
}

function storageRemoveItem(key: string): void {
  delete inMemoryStore[key];
  try {
    if (typeof localStorage !== "undefined" && localStorage) localStorage.removeItem(key);
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
  storageSetItem(WHATSAPP_LOGS_KEY, JSON.stringify([newEntry, ...current].slice(0, 1000)));
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

export function sanitizeWhatsAppMessage(text: string): string {
  return text.replace(/[\uFE0F\uFE0E\u200B\u200D\uFFFD]/g, "").trim();
}

export function buildWhatsAppUrl(phone: string, text: string): string | null {
  const formatted = formatEgyptianPhoneForWhatsApp(phone);
  if (!formatted) return null;
  return `https://wa.me/${formatted}?text=${encodeURIComponent(sanitizeWhatsAppMessage(text))}`;
}

/**
 * Reliably hand off a prepared message to WhatsApp.
 * Browsers may block a new tab when this is called after an async database save,
 * so we fall back to same-tab navigation instead of silently doing nothing.
 */
export function openWhatsAppMessage(phone: string, text: string): boolean {
  const url = buildWhatsAppUrl(phone, text);
  if (!url) {
    console.warn("رقم الهاتف غير صالح لإرسال رسالة WhatsApp");
    return false;
  }

  if (typeof window === "undefined") return true;

  try {
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (win) return true;
  } catch (err) {
    console.warn("WhatsApp popup was blocked:", err);
  }

  // A blocked popup must never make the WhatsApp button appear dead.
  // Same-tab navigation is allowed even after asynchronous work.
  try {
    window.location.assign(url);
    return true;
  } catch (err) {
    console.error("Failed to navigate to WhatsApp:", err);
    return false;
  }
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

  const deviceList = order.devices?.length
    ? order.devices.map(d => getDeviceDisplayName(d))
    : ["جهاز صيانة"];
  const devicesHeader = deviceList.length > 1
    ? `🎮 الأجهزة:\n• ${deviceList.join("\n• ")}`
    : `🎮 الجهاز:\n${deviceList[0]}`;

  const faultsList = order.devices?.length
    ? order.devices.map(d => d.issue || "فحص ومعاينة فنية").filter(Boolean)
    : ["فحص ومعاينة فنية"];
  const faultsText = faultsList.join(" + ");

  const token = order.trackingToken || generateSecureTrackingToken();
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const trackingUrl = `${origin}/track?token=${token}`;

  let dedupStateKey = `${orderId}_${template}`;
  if (template === "APPROVAL_REQUIRED") {
    dedupStateKey += `_${extra?.additionalCost || 0}_${extra?.newTotal || order.totalEstimatedCost}`;
  } else if (template === "READY_FOR_PICKUP" || template === "DELIVERED") {
    dedupStateKey += `_${order.status}_${order.finalRepairPrice || order.totalEstimatedCost}`;
  }
  const wasPreviouslyOpened = isNotificationAlreadySent(dedupStateKey);

  if (!phone) {
    const errorMsg = "رقم الهاتف غير مسجل أو غير صالح لإرسال الواتس آب";
    const log = addWhatsAppLog({ orderId, customer: name, phone: rawPhone || "N/A", template, status: "FAILED", error: errorMsg });
    return { success: false, message: "تم حفظ العملية ولكن تعذر تجهيز رسالة واتساب.", log };
  }

  const estCost = extra?.newTotal ?? order.totalEstimatedCost ?? 0;
  const costSection = estCost > 0 ? `💰 التكلفة المتوقعة:\n${estCost} ج.م\n\n` : "";
  let messageText = "";

  switch (template) {
    case "REPAIR_ORDER_CREATED":
      messageText = `🎉 مرحبًا ${name}\n\nتم استلام جهازك بنجاح في Atari Store.\n\n📋 رقم الطلب:\n${orderId}\n\n${devicesHeader}\n\n🔧 العطل:\n${faultsText}\n\n${costSection}🔗 متابعة حالة الصيانة:\n${trackingUrl}\n\nشكراً لثقتك بنا ❤️`;
      break;
    case "APPROVAL_REQUIRED": {
      const reason = extra?.reason || "تغيير في قطع الغيار أو تكلفة الصيانة";
      const addCost = extra?.additionalCost ?? 0;
      const newTot = extra?.newTotal ?? order.totalEstimatedCost;
      messageText = `مرحبًا ${name} 👋\n\nبخصوص طلب الصيانة رقم [${orderId}]:\n${devicesHeader}\n\nيلزم موافقتك على المستجدات التالية:\n📌 السبب: ${reason}\n💰 التكلفة الإضافية: ${addCost} ج.م\n💵 الإجمالي الجديد: ${newTot} ج.م\n\n🔗 رابط المتابعة والموافقة:\n${trackingUrl}\n\nشكراً لتعاملك معنا ❤️`;
      break;
    }
    case "READY_FOR_PICKUP": {
      const repaired = extra?.repairedItems || faultsText || "تمت الصيانة بنجاح";
      const finalPrice = extra?.newTotal ?? order.finalRepairPrice ?? order.totalEstimatedCost ?? 0;
      const paid = order.advancePayment || 0;
      const remaining = Math.max(0, finalPrice - paid);
      messageText = `🎉 مرحبًا ${name}\n\nطلب الصيانة رقم [${orderId}] أصبح جاهزاً للتسليم الآن!\n\n${devicesHeader}\n\n🛠️ ما تم إصلاحه:\n${repaired}\n\n💰 السعر النهائي: ${finalPrice} ج.م\n💳 المدفوع: ${paid} ج.م\n💵 المتبقي للتحصيل: ${remaining} ج.م\n\n🔗 متابعة حالة الصيانة:\n${trackingUrl}\n\nشكراً لثقتك بنا ❤️`;
      break;
    }
    case "DELIVERED": {
      const warranty = extra?.warrantyInfo || (order.warrantyDays ? `ضمان لمدة ${order.warrantyDays} يوم` : "الضمان حسب الشروط المدونة بالإيصال");
      messageText = `✨ مرحبًا ${name}\n\nشكراً لتعاملك معنا! تم تسليم طلب الصيانة رقم [${orderId}] بنجاح.\n\n${devicesHeader}\n\n🛡️ معلومات الضمان:\n${warranty}\n\nنتمنى لك تجربة استخدام ممتازة ❤️`;
      break;
    }
  }

  const sanitizedMessage = sanitizeWhatsAppMessage(messageText);

  try {
    if (wasPreviouslyOpened) {
      // Do not make the manual workshop button dead just because the same state was opened before.
      console.info(`[WhatsApp Workflow] Re-opening previously prepared notification ${dedupStateKey}.`);
    }

    if (autoOpenWindow && !openWhatsAppMessage(phone, sanitizedMessage)) {
      throw new Error("تعذر فتح الواتس آب على هذا الجهاز");
    }

    markNotificationAsSent(dedupStateKey);
    const log = addWhatsAppLog({ orderId, customer: name, phone, template, status: "SENT" });
    return {
      success: true,
      isDuplicate: wasPreviouslyOpened || undefined,
      message: "تم فتح رسالة الواتس آب وتجهيزها للإرسال",
      log
    };
  } catch (err: any) {
    const errorMsg = err?.message || "فشل فتح رسالة الواتس آب";
    const log = addWhatsAppLog({ orderId, customer: name, phone, template, status: "FAILED", error: errorMsg });
    return { success: false, message: "تم حفظ العملية ولكن تعذر فتح رسالة واتساب.", log };
  }
}
