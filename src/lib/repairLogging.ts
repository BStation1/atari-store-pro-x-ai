/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RepairOrder, RepairTimelineEvent, RepairAuditLogRecord, User } from "../types";

/**
 * Appends a new event to the repair order's timeline log
 */
export function addTimelineEventHelper(
  order: RepairOrder,
  eventType: RepairTimelineEvent['eventType'],
  note?: string,
  currentUser?: User | { id?: string; name?: string; fullName?: string } | null,
  deviceId?: string,
  details?: Record<string, any>
): RepairOrder {
  const existingTimeline = Array.isArray(order.timelineEvents) ? [...order.timelineEvents] : [];
  
  const userName = currentUser?.fullName || currentUser?.name || "النظام";
  const userId = currentUser?.id || "system";

  const newEvent: RepairTimelineEvent = {
    id: `EVT-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    orderId: order.id,
    deviceId,
    eventType,
    timestamp: new Date().toISOString(),
    userId,
    userName,
    note,
    details
  };

  return {
    ...order,
    timelineEvents: [newEvent, ...existingTimeline] // Newest first
  };
}

/**
 * Appends a new audit record to the repair order's technical change log
 */
export function addAuditLogRecordHelper(
  order: RepairOrder,
  actionType: RepairAuditLogRecord['actionType'],
  fieldName: string | undefined,
  oldValue: any,
  newValue: any,
  notes: string | undefined,
  currentUser?: User | { id?: string; name?: string; fullName?: string; role?: string } | null,
  deviceId?: string
): RepairOrder {
  const existingAudit = Array.isArray(order.auditLogs) ? [...order.auditLogs] : [];

  const userName = currentUser?.fullName || currentUser?.name || "النظام";
  const userId = currentUser?.id || "system";
  const userRole = currentUser?.role || "user";

  const newRecord: RepairAuditLogRecord = {
    id: `AUD-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    orderId: order.id,
    deviceId,
    userId,
    userName,
    userRole,
    timestamp: new Date().toISOString(),
    actionType,
    fieldName,
    oldValue: oldValue !== undefined && oldValue !== null ? String(oldValue) : null,
    newValue: newValue !== undefined && newValue !== null ? String(newValue) : null,
    notes
  };

  return {
    ...order,
    auditLogs: [newRecord, ...existingAudit] // Newest first
  };
}

/**
 * Translated event labels for UI timeline display
 */
export const EVENT_TYPE_LABELS: Record<RepairTimelineEvent['eventType'], { label: string; badgeClass: string; iconName: string }> = {
  ORDER_RECEIVED: { label: "تم استلام الجهاز", badgeClass: "bg-blue-500/10 text-blue-400 border-blue-500/30", iconName: "PackageCheck" },
  TRANSFERRED_INSPECTION: { label: "تحويل للفحص والمعاينة", badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/30", iconName: "Search" },
  INSPECTION_STARTED: { label: "بدأ الفني الفحص", badgeClass: "bg-purple-500/10 text-purple-400 border-purple-500/30", iconName: "Wrench" },
  DIAGNOSIS_SET: { label: "تم تسجيل التشخيص الفني", badgeClass: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30", iconName: "FileText" },
  PROCEDURE_ADDED: { label: "إضافة عملية صيانة", badgeClass: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30", iconName: "PlusCircle" },
  PROCEDURE_REMOVED: { label: "حذف عملية صيانة", badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/30", iconName: "Trash2" },
  PART_ADDED: { label: "إضافة قطعة غيار", badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", iconName: "Package" },
  PART_QTY_CHANGED: { label: "تعديل كمية قطعة", badgeClass: "bg-teal-500/10 text-teal-400 border-teal-500/30", iconName: "Sliders" },
  PART_REMOVED: { label: "حذف قطعة غيار", badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/30", iconName: "Trash2" },
  PRICE_CHANGED: { label: "تعديل التكلفة / السعر", badgeClass: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30", iconName: "DollarSign" },
  REPAIR_APPROVED: { label: "اعتماد الإصلاح", badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", iconName: "CheckCircle" },
  REPAIR_COMPLETED: { label: "تم إنهاء الصيانة", badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-400/40", iconName: "CheckCircle2" },
  READY_FOR_DELIVERY: { label: "جاهز للتسليم", badgeClass: "bg-emerald-600/20 text-emerald-300 border-emerald-500/50", iconName: "ShieldCheck" },
  DELIVERED_TO_CUSTOMER: { label: "تم التسليم للعميل", badgeClass: "bg-emerald-600 text-white border-emerald-400", iconName: "PackageCheck" },
  STATUS_CHANGED: { label: "تغيير حالة أمر الصيانة", badgeClass: "bg-sky-500/10 text-sky-400 border-sky-500/30", iconName: "RefreshCw" },
  TECHNICIAN_CHANGED: { label: "تغيير الفني المسؤول", badgeClass: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30", iconName: "User" },
  NOTE_ADDED: { label: "إضافة ملاحظة", badgeClass: "bg-gray-500/10 text-gray-400 border-gray-500/30", iconName: "MessageSquare" }
};

/**
 * Translated action labels for UI audit log display
 */
export const AUDIT_ACTION_LABELS: Record<RepairAuditLogRecord['actionType'], { label: string; badgeClass: string }> = {
  ADD_PART: { label: "إضافة قطعة غيار", badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  DELETE_PART: { label: "حذف قطعة غيار", badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/30" },
  CHANGE_PART_QTY: { label: "تغيير الكمية", badgeClass: "bg-teal-500/10 text-teal-400 border-teal-500/30" },
  CHANGE_SELL_PRICE: { label: "تغيير سعر البيع", badgeClass: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" },
  CHANGE_COST_PRICE: { label: "تغيير سعر التكلفة", badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  ADD_PROCEDURE: { label: "إضافة إجراء فني", badgeClass: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30" },
  DELETE_PROCEDURE: { label: "حذف إجراء فني", badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/30" },
  CHANGE_DIAGNOSIS: { label: "تغيير التشخيص", badgeClass: "bg-purple-500/10 text-purple-400 border-purple-500/30" },
  CHANGE_STATUS: { label: "تغيير حالة الطلب", badgeClass: "bg-sky-500/10 text-sky-400 border-sky-500/30" },
  CHANGE_TECHNICIAN: { label: "تغيير الفني المسؤول", badgeClass: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30" },
  CHANGE_FAULTS: { label: "تعديل أعطال وشكاوى الجهاز", badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  CHANGE_OWNERSHIP: { label: "تعديل ملكية/تبعية الجهاز", badgeClass: "bg-sky-500/10 text-sky-400 border-sky-500/30" },
  CHANGE_DEDUCTION_RATE: { label: "تعديل نسبة الخصم/الخصم الضريبي", badgeClass: "bg-purple-500/10 text-purple-400 border-purple-500/30" },
  OTHER_EDIT: { label: "تعديل آخر", badgeClass: "bg-gray-500/10 text-gray-400 border-gray-500/30" }
};
