import { supabase, isSupabaseConfigured } from './supabaseClient';
import { RepairOrder, RepairDevice, RepairStatus, WorkOwnershipType, PaymentMethod, User } from '../types';
import { db } from './db';

const REPAIR_ORDERS_STORAGE_KEY = 'atari_repair_orders';

export function getLocalRepairOrdersBackup(): RepairOrder[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(REPAIR_ORDERS_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error reading local repair orders backup:', e);
  }
  return [];
}

export function saveLocalRepairOrdersBackup(data: RepairOrder[], dispatchEvent = true): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(REPAIR_ORDERS_STORAGE_KEY, JSON.stringify(data));
      if (dispatchEvent) {
        window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: REPAIR_ORDERS_STORAGE_KEY } }));
      }
    }
  } catch (e) {
    console.error('Error saving local repair orders backup:', e);
  }
}

function isUuid(id?: string): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Maps UI RepairStatus to DB repair_status_enum
 */
export function mapUiStatusToDbStatus(status?: RepairStatus | string): string {
  if (!status) return 'RECEIVED';
  const str = String(status).toUpperCase();
  if (status === RepairStatus.Ready || str.includes('READY') || str.includes('جاهز')) return 'READY_FOR_DELIVERY';
  if (status === RepairStatus.Delivered || str.includes('DELIVERED') || str.includes('تسليم')) return 'DELIVERED';
  if (status === RepairStatus.Cancelled || str.includes('CANCELLED') || str.includes('ملغي')) return 'CANCELLED';
  if (
    status === RepairStatus.Diagnosing ||
    status === RepairStatus.WaitingParts ||
    status === RepairStatus.Repairing ||
    status === RepairStatus.Testing ||
    status === RepairStatus.WaitingCustomerApproval ||
    str.includes('DIAGNOS') ||
    str.includes('INSPECTION') ||
    str.includes('معاينة') ||
    str.includes('إصلاح')
  ) {
    return 'DIAGNOSING';
  }
  return 'RECEIVED';
}

/**
 * Maps DB repair_status_enum to UI RepairStatus
 */
export function mapDbStatusToUiStatus(dbStatus?: string): RepairStatus {
  if (!dbStatus) return RepairStatus.Received;
  const str = String(dbStatus).toUpperCase();
  if (str === 'READY_FOR_DELIVERY') return RepairStatus.Ready;
  if (str === 'DELIVERED') return RepairStatus.Delivered;
  if (str === 'CANCELLED') return RepairStatus.Cancelled;
  if (str === 'DIAGNOSING') return RepairStatus.Diagnosing;
  if (str === 'RECEIVED') return RepairStatus.Received;
  
  // Direct match fallback
  if (Object.values(RepairStatus).includes(dbStatus as RepairStatus)) {
    return dbStatus as RepairStatus;
  }
  return RepairStatus.Received;
}

/**
 * Maps Supabase database row to local RepairOrder object
 */
export function mapRowToRepairOrder(row: Record<string, any>): RepairOrder {
  let meta: Record<string, any> = {};
  if (row.notes) {
    try {
      if (typeof row.notes === 'string' && row.notes.trim().startsWith('{')) {
        meta = JSON.parse(row.notes);
      } else {
        meta = { notes: row.notes };
      }
    } catch {
      meta = { notes: row.notes };
    }
  }

  const orderId = row.order_number || meta.id || row.id;

  // Build devices array
  let devicesList: RepairDevice[] = Array.isArray(meta.devices) ? meta.devices : [];
  if (devicesList.length === 0) {
    devicesList = [
      {
        id: `D-${orderId}-0`,
        type: row.device_type || meta.deviceType || 'أجهزة ألعاب',
        model: row.device_model || meta.deviceModel || 'موديل قياسي',
        serialNumber: row.serial_number || meta.serialNumber || '',
        color: meta.color || 'قياسي',
        accessories: meta.accessories || 'بدون ملحقات',
        issue: meta.issue || 'فحص ومعاينة الكشف العام',
        selectedQuickFaults: meta.selectedQuickFaults || [],
        suggestedRepairPrice: meta.suggestedRepairPrice || Number(row.estimated_cost || 0),
        finalRepairPrice: typeof row.final_cost === 'number' ? row.final_cost : (meta.finalRepairPrice || Number(row.estimated_cost || 0)),
        estimatedCost: typeof row.estimated_cost === 'number' ? row.estimated_cost : (meta.estimatedCost || 0),
        partsCost: meta.partsCost || 0,
        laborCost: meta.laborCost || 0,
        status: mapDbStatusToUiStatus(row.status || meta.status)
      }
    ];
  }

  const resolvedOwnership = meta.jobType || meta.workOwnershipType || WorkOwnershipType.CUSTOMER_SHARED;

  return {
    id: orderId,
    customerId: row.customer_id || meta.customerId || undefined,
    customerType: meta.customerType || (row.customer_id ? "REGISTERED" : "GUEST"),
    guestCustomerName: meta.guestCustomerName,
    guestCustomerPhone: meta.guestCustomerPhone,
    guestCustomerAltPhone: meta.guestCustomerAltPhone,
    guestCustomerNote: meta.guestCustomerNote,
    customerNameSnapshot: meta.customerNameSnapshot || meta.guestCustomerName || "",
    customerPhoneSnapshot: meta.customerPhoneSnapshot || meta.guestCustomerPhone || "",
    devices: devicesList,
    totalEstimatedCost: typeof row.estimated_cost === 'number' ? row.estimated_cost : (meta.totalEstimatedCost || Number(row.estimated_cost || 0)),
    selectedQuickFaults: meta.selectedQuickFaults || [],
    suggestedRepairPrice: meta.suggestedRepairPrice || 0,
    finalRepairPrice: typeof row.final_cost === 'number' ? row.final_cost : (meta.finalRepairPrice || Number(row.final_cost || 0)),
    advancePayment: Number(meta.advancePayment || 0),
    status: mapDbStatusToUiStatus(row.status || meta.status),
    receivedDate: row.created_at || meta.receivedDate || new Date().toISOString(),
    completionDate: meta.completionDate,
    notes: meta.notes || (typeof row.notes === 'string' && !row.notes.startsWith('{') ? row.notes : ''),
    isPaid: Boolean(meta.isPaid || row.status === 'DELIVERED'),
    trackingToken: row.tracking_token || meta.trackingToken || `TRK-${orderId}`,
    workOwnershipType: resolvedOwnership,
    jobType: resolvedOwnership,
    workOwnerPartnerId: meta.workOwnerPartnerId,
    partnerDeductionRate: meta.partnerDeductionRate,
    otherDirectCosts: meta.otherDirectCosts,
    discount: meta.discount,
    refundAmount: meta.refundAmount,
    isSettled: meta.isSettled,
    settlementId: meta.settlementId,
    warrantyOption: meta.warrantyOption,
    warrantyDays: meta.warrantyDays,
    warrantyStartDate: meta.warrantyStartDate,
    warrantyEndDate: meta.warrantyEndDate,
    warrantyStatus: meta.warrantyStatus,
    deliveredAt: row.delivered_at || meta.deliveredAt,
    deliveredByUserId: meta.deliveredByUserId,
    deliveredByUserName: meta.deliveredByUserName,
    deliveryStatus: meta.deliveryStatus || (row.delivered_at ? "DELIVERED" : "NOT_DELIVERED"),
    deliveryNotes: meta.deliveryNotes,
    deliverySnapshot: meta.deliverySnapshot,
    deliveryHistory: meta.deliveryHistory,
    reopenedAt: row.reopened_at || meta.reopenedAt,
    reopenedByUserId: meta.reopenedByUserId,
    reopenedByUserName: meta.reopenedByUserName,
    reopenReason: meta.reopenReason,
    reopenLogs: meta.reopenLogs,
    timelineEvents: Array.isArray(meta.timelineEvents) ? meta.timelineEvents : [],
    auditLogs: Array.isArray(meta.auditLogs) ? meta.auditLogs : []
  };
}

/**
 * Fetch or migrate repair orders from Supabase with safe local fallback
 */
export async function fetchOrMigrateRepairOrders(): Promise<{ success: boolean; orders: RepairOrder[]; error?: string }> {
  const localOrders = getLocalRepairOrdersBackup();

  try {
    if (!isSupabaseConfigured) {
      console.warn("⚠️ [fetchOrMigrateRepairOrders] Supabase is not configured, using local storage backup.");
      return { success: true, orders: localOrders };
    }

    const { data, error } = await supabase
      .from('repair_orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn("⚠️ [fetchOrMigrateRepairOrders] Error fetching from Supabase, using local backup:", error.message);
      return {
        success: false,
        error: `Supabase: ${error.message}`,
        orders: localOrders
      };
    }

    if (!data || data.length === 0) {
      if (localOrders.length > 0) {
        return { success: true, orders: localOrders };
      }
      saveLocalRepairOrdersBackup([], false);
      return { success: true, orders: [] };
    }

    const mappedOrders = data.map(mapRowToRepairOrder);
    saveLocalRepairOrdersBackup(mappedOrders, false);
    return { success: true, orders: mappedOrders };
  } catch (err: any) {
    console.warn("⚠️ [fetchOrMigrateRepairOrders] Exception:", err?.message || err);
    return {
      success: false,
      error: err?.message || 'تعذر الاتصال بـ Supabase لقراءة أوامر الصيانة',
      orders: localOrders
    };
  }
}

/**
 * Adds a new repair order to Supabase with fallback to local storage
 */
export async function addRepairOrderToSupabase(
  orderData: Omit<RepairOrder, "id" | "receivedDate" | "trackingToken">,
  currentUser?: User
): Promise<RepairOrder> {
  const localList = getLocalRepairOrdersBackup();

  let targetCustomerId: string | null = isUuid(orderData.customerId) ? orderData.customerId! : null;

  // Generate unique Order ID (ATR-XXXXX)
  let maxNum = 10000;
  for (const o of localList) {
    const match = o.id.match(/ATR-(\d+)/) || o.id.match(/\d+/);
    if (match) {
      const num = parseInt(match[1] || match[0], 10);
      if (num >= maxNum) {
        maxNum = num + 1;
      }
    }
  }

  const generatedId = `ATR-${maxNum}`;
  const nowIso = new Date().toISOString();
  const generatedToken = `TRK-${maxNum}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
  const resolvedOwnership = orderData.jobType || orderData.workOwnershipType || WorkOwnershipType.CUSTOMER_SHARED;

  const initialTimeline: RepairTimelineEvent[] = Array.isArray(orderData.timelineEvents) && orderData.timelineEvents.length > 0 
    ? orderData.timelineEvents 
    : [
        {
          id: `EVT-${Date.now()}-1`,
          orderId: generatedId,
          eventType: "ORDER_RECEIVED",
          timestamp: nowIso,
          userId: currentUser?.id || "system",
          userName: currentUser?.fullName || currentUser?.name || "موظف الاستلام",
          note: "تم إنشاء أمر الاستلام وحجز كود التتبع بنجاح"
        }
      ];

  if (orderData.devices?.some(d => d.needsInspection) && !initialTimeline.some(e => e.eventType === "TRANSFERRED_INSPECTION")) {
    initialTimeline.unshift({
      id: `EVT-${Date.now()}-2`,
      orderId: generatedId,
      eventType: "TRANSFERRED_INSPECTION",
      timestamp: nowIso,
      userId: currentUser?.id || "system",
      userName: currentUser?.fullName || currentUser?.name || "موظف الاستلام",
      note: "تم تحويل الجهاز لورشة الصيانة للفحص والمعاينة الفنية"
    });
  }

  const fullOrderObj: RepairOrder = {
    ...orderData,
    id: generatedId,
    customerId: targetCustomerId || orderData.customerId || `CUST_${Date.now()}`,
    receivedDate: nowIso,
    trackingToken: generatedToken,
    jobType: resolvedOwnership,
    workOwnershipType: resolvedOwnership,
    timelineEvents: initialTimeline,
    auditLogs: Array.isArray(orderData.auditLogs) ? orderData.auditLogs : []
  };

  if (!isSupabaseConfigured) {
    const updatedLocalList = [fullOrderObj, ...localList.filter(o => o.id !== fullOrderObj.id)];
    saveLocalRepairOrdersBackup(updatedLocalList, true);
    return fullOrderObj;
  }

  try {
    // Step 1: Ensure customer ID exists in Supabase if possible
    if (!targetCustomerId) {
      const phoneToSearch = orderData.guestCustomerPhone || orderData.customerPhoneSnapshot || "";
      const nameToSearch = orderData.guestCustomerName || orderData.customerNameSnapshot || "عميل غير مسجل";

      if (phoneToSearch) {
        try {
          const { data: existingCust } = await supabase
            .from('customers')
            .select('id')
            .eq('phone', phoneToSearch)
            .maybeSingle();
          if (existingCust?.id) {
            targetCustomerId = existingCust.id;
          }
        } catch (e) {
          console.warn("Could not search customer by phone in Supabase:", e);
        }
      }

      if (!targetCustomerId) {
        try {
          const newCustPayload = {
            name: nameToSearch,
            phone: phoneToSearch || "00000000000",
            customer_type: 'REGULAR',
            notes: orderData.guestCustomerNote || 'عميل ينشأ تلقائياً لأمر الصيانة',
            created_at: new Date().toISOString()
          };

          const { data: createdCust } = await supabase
            .from('customers')
            .insert(newCustPayload)
            .select('id')
            .maybeSingle();

          if (createdCust?.id) {
            targetCustomerId = createdCust.id;
          }
        } catch (e) {
          console.warn("⚠️ Exception inserting guest customer in Supabase:", e);
        }
      }
    }

    fullOrderObj.customerId = targetCustomerId || fullOrderObj.customerId;

    const firstDevice = orderData.devices?.[0];
    const reportedIssueStr = firstDevice?.issue || 
      (Array.isArray(orderData.selectedQuickFaults) && orderData.selectedQuickFaults.length > 0 ? orderData.selectedQuickFaults.join(' - ') : null) || 
      orderData.notes || 
      'فحص ومعاينة الكشف العام';

    const payload: Record<string, any> = {
      order_number: generatedId,
      customer_id: isUuid(targetCustomerId) ? targetCustomerId : null,
      status: mapUiStatusToDbStatus(orderData.status),
      created_by_user_id: isUuid(currentUser?.id) ? currentUser?.id : null,
      tracking_token: generatedToken,
      created_at: nowIso,
      updated_at: nowIso,
      estimated_cost: Number(orderData.totalEstimatedCost || orderData.finalRepairPrice || 0),
      final_cost: Number(orderData.finalRepairPrice || orderData.totalEstimatedCost || 0),
      device_type: firstDevice?.type || 'أجهزة ألعاب',
      device_model: firstDevice?.model || 'موديل قياسي',
      serial_number: firstDevice?.serialNumber || '',
      reported_issue: reportedIssueStr,
      notes: JSON.stringify(fullOrderObj)
    };

    const { data, error } = await supabase
      .from("repair_orders")
      .insert(payload)
      .select()
      .maybeSingle();

    if (error) {
      console.warn("⚠️ Error saving repair order to Supabase, saving locally:", error.message);
    } else if (data) {
      const createdOrder = mapRowToRepairOrder(data);
      const updatedLocalList = [createdOrder, ...localList.filter(o => o.id !== createdOrder.id)];
      saveLocalRepairOrdersBackup(updatedLocalList, true);
      return createdOrder;
    }
  } catch (err: any) {
    console.warn("⚠️ Exception in addRepairOrderToSupabase, saving locally:", err?.message || err);
  }

  // Local fallback
  const updatedLocalList = [fullOrderObj, ...localList.filter(o => o.id !== fullOrderObj.id)];
  saveLocalRepairOrdersBackup(updatedLocalList, true);
  return fullOrderObj;
}

/**
 * Updates an existing repair order in Supabase with local fallback
 */
export async function updateRepairOrderInSupabase(
  order: RepairOrder,
  currentUser?: User
): Promise<RepairOrder> {
  const localList = getLocalRepairOrdersBackup();

  if (!isSupabaseConfigured) {
    const idx = localList.findIndex(o => o.id === order.id);
    if (idx !== -1) localList[idx] = order;
    else localList.unshift(order);
    saveLocalRepairOrdersBackup(localList, true);
    return order;
  }

  const nowIso = new Date().toISOString();
  const firstDevice = order.devices?.[0];

  const payload: Record<string, any> = {
    order_number: order.id,
    customer_id: isUuid(order.customerId) ? order.customerId : null,
    status: mapUiStatusToDbStatus(order.status),
    tracking_token: order.trackingToken,
    updated_at: nowIso,
    estimated_cost: Number(order.totalEstimatedCost || order.finalRepairPrice || 0),
    final_cost: Number(order.finalRepairPrice || order.totalEstimatedCost || 0),
    device_type: firstDevice?.type || null,
    device_model: firstDevice?.model || null,
    serial_number: firstDevice?.serialNumber || null,
    delivered_at: order.deliveredAt || null,
    reopened_at: order.reopenedAt || null,
    notes: JSON.stringify(order)
  };

  try {
    const { data, error } = await supabase
      .from('repair_orders')
      .update(payload)
      .or(`order_number.eq.${order.id}${isUuid(order.id) ? `,id.eq.${order.id}` : ''}`)
      .select()
      .maybeSingle();

    if (error) {
      console.warn("⚠️ [updateRepairOrderInSupabase] Update failed in Supabase, saving locally:", error.message);
    } else if (data) {
      const updated = mapRowToRepairOrder(data);
      const idx = localList.findIndex(o => o.id === updated.id);
      if (idx !== -1) localList[idx] = updated;
      else localList.unshift(updated);
      saveLocalRepairOrdersBackup(localList, true);
      return updated;
    }
  } catch (err: any) {
    console.warn("⚠️ [updateRepairOrderInSupabase] Exception updating in Supabase:", err);
  }

  const idx = localList.findIndex(o => o.id === order.id);
  if (idx !== -1) localList[idx] = order;
  else localList.unshift(order);
  saveLocalRepairOrdersBackup(localList, true);
  return order;
}

/**
 * Deletes a repair order from Supabase
 */
export async function deleteRepairOrderFromSupabase(
  id: string,
  currentUser?: User
): Promise<{ success: boolean; error?: string }> {
  const localList = getLocalRepairOrdersBackup().filter(o => o.id !== id);
  saveLocalRepairOrdersBackup(localList, true);

  if (!isSupabaseConfigured) {
    return { success: true };
  }

  try {
    const { error } = await supabase
      .from('repair_orders')
      .delete()
      .or(`order_number.eq.${id}${isUuid(id) ? `,id.eq.${id}` : ''}`);

    if (error) {
      console.warn("⚠️ [deleteRepairOrderFromSupabase] Delete failed in Supabase:", error.message);
    }
  } catch (err: any) {
    console.warn("⚠️ [deleteRepairOrderFromSupabase] Exception:", err);
  }

  return { success: true };
}
