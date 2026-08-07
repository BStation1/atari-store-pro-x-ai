import { supabase, isSupabaseConfigured } from './supabaseClient';
import { RepairOrder, RepairDevice, RepairStatus, WorkOwnershipType, PaymentMethod, User, RepairTimelineEvent } from '../types';
import { db } from './db';
import { generateSecureTrackingToken } from './trackingToken';

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

export function mapRepairOrderToRow(order: RepairOrder): Record<string, any> {
  const firstDevice = order.devices?.[0];
  const reportedIssueStr = firstDevice?.issue || 
    (Array.isArray((order as any).selectedQuickFaults) && (order as any).selectedQuickFaults.length > 0 ? (order as any).selectedQuickFaults.join(' - ') : null) || 
    order.notes || 
    'فحص ومعاينة الكشف العام';

  const payload: Record<string, any> = {
    order_number: order.id,
    customer_id: isUuid(order.customerId) ? order.customerId : null,
    status: mapUiStatusToDbStatus(order.status),
    tracking_token: order.trackingToken || generateSecureTrackingToken(),
    created_at: (order as any).createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    estimated_cost: Number(order.totalEstimatedCost || order.finalRepairPrice || 0),
    final_cost: Number(order.finalRepairPrice || order.totalEstimatedCost || 0),
    device_type: firstDevice?.type || 'أجهزة ألعاب',
    device_model: firstDevice?.model || 'موديل قياسي',
    serial_number: firstDevice?.serialNumber || '',
    reported_issue: reportedIssueStr,
    notes: JSON.stringify(order)
  };

  if (isUuid(order.id)) {
    payload.id = order.id;
  }

  return payload;
}

export async function ensureRepairOrderUuidInSupabase(order: RepairOrder): Promise<string | null> {
  if (isUuid(order.id)) {
    order.uuid = order.id;
    order.databaseId = order.id;
    return order.id;
  }
  if ((order as any).uuid && isUuid((order as any).uuid)) {
    order.databaseId = (order as any).uuid;
    return (order as any).uuid;
  }

  if (!isSupabaseConfigured) return null;

  try {
    // 1. Query by order_number or id
    const { data: existing } = await supabase
      .from('repair_orders')
      .select('id, order_number')
      .or(`order_number.eq.${order.id},id.eq.${order.id}`)
      .maybeSingle();

    if (existing?.id && isUuid(existing.id)) {
      order.uuid = existing.id;
      order.databaseId = existing.id;
      return existing.id;
    }

    // 2. Insert order row in Supabase if missing
    const rowToInsert = mapRepairOrderToRow(order);
    const { data: created, error } = await supabase
      .from('repair_orders')
      .insert([rowToInsert])
      .select('id')
      .single();

    if (error) {
      console.warn("⚠️ Error creating repair order row in Supabase:", error.message);
      return null;
    }

    if (created?.id) {
      order.uuid = created.id;
      order.databaseId = created.id;
    }
    return created?.id || null;
  } catch (err) {
    console.warn("⚠️ Exception resolving repair order UUID:", err);
    return null;
  }
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

  const rawRowId = row.id ? String(row.id) : undefined;
  const isRowIdUuid = Boolean(rawRowId && (rawRowId.includes('-') || rawRowId.length >= 30));
  const rowUuid = isRowIdUuid ? rawRowId : (meta.uuid || meta.databaseId || undefined);
  const orderNumberStr = row.order_number || meta.orderNumber || meta.order_number || meta.id || (!isRowIdUuid ? rawRowId : undefined);
  const orderId = orderNumberStr || meta.id || rawRowId || 'UNKNOWN';

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
    uuid: rowUuid || meta.uuid || rawRowId,
    databaseId: rowUuid || meta.databaseId || rawRowId,
    order_number: orderNumberStr,
    orderNumber: orderNumberStr,
    customerId: row.customer_id || meta.customerId || undefined,
    customerType: meta.customerType || (row.customer_id ? "REGISTERED" : "GUEST"),
    guestCustomerName: meta.guestCustomerName || meta.guest_name || meta.customer_name || meta.customerNameSnapshot || meta.customerName || row.guest_name || row.customer_name,
    guestCustomerPhone: meta.guestCustomerPhone || meta.guest_phone || meta.customer_phone || meta.customerPhoneSnapshot || meta.customerPhone || row.guest_phone || row.customer_phone,
    guestCustomerAltPhone: meta.guestCustomerAltPhone || meta.guest_alt_phone,
    guestCustomerNote: meta.guestCustomerNote,
    customerNameSnapshot: meta.customerNameSnapshot || meta.guestCustomerName || meta.customerName || row.customer_name || "",
    customerPhoneSnapshot: meta.customerPhoneSnapshot || meta.guestCustomerPhone || meta.customerPhone || row.customer_phone || "",
    guest_name: meta.guest_name || meta.guestCustomerName || row.guest_name,
    guest_phone: meta.guest_phone || meta.guestCustomerPhone || row.guest_phone,
    customer_name: meta.customer_name || meta.customerNameSnapshot || meta.customerName || row.customer_name,
    customer_phone: meta.customer_phone || meta.customerPhoneSnapshot || meta.customerPhone || row.customer_phone,
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
    trackingToken: row.tracking_token || meta.trackingToken || generateSecureTrackingToken(),
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
      const freshLocalOrders = getLocalRepairOrdersBackup();
      if (freshLocalOrders.length > 0) {
        return { success: true, orders: freshLocalOrders };
      }
      return { success: true, orders: [] };
    }

    const mappedOrders = data.map(mapRowToRepairOrder);

    // Merge fresh local orders with remote orders so newly added/unsynced local orders are retained
    const freshLocalOrders = getLocalRepairOrdersBackup();
    const mergedMap = new Map<string, RepairOrder>();
    mappedOrders.forEach(o => mergedMap.set(o.id, o));
    freshLocalOrders.forEach(o => {
      if (!mergedMap.has(o.id)) {
        mergedMap.set(o.id, o);
      }
    });

    const mergedOrders = Array.from(mergedMap.values()).sort((a, b) => {
      return new Date(b.receivedDate || 0).getTime() - new Date(a.receivedDate || 0).getTime();
    });

    saveLocalRepairOrdersBackup(mergedOrders, false);
    return { success: true, orders: mergedOrders };
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
  const generatedToken = generateSecureTrackingToken();
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

  const isGuestOrder = orderData.customerType === 'GUEST' || (!targetCustomerId && !orderData.customerId);
  const resolvedCustomerId = isUuid(targetCustomerId) ? targetCustomerId : (isUuid(orderData.customerId) ? orderData.customerId : undefined);

  const fullOrderObj: RepairOrder = {
    ...orderData,
    id: generatedId,
    customerId: resolvedCustomerId,
    customerType: isGuestOrder ? 'GUEST' : (orderData.customerType || 'REGISTERED'),
    guestCustomerName: orderData.guestCustomerName || orderData.guest_name || orderData.customerNameSnapshot || orderData.customerName,
    guestCustomerPhone: orderData.guestCustomerPhone || orderData.guest_phone || orderData.customerPhoneSnapshot || orderData.customerPhone,
    guest_name: orderData.guest_name || orderData.guestCustomerName || orderData.customerNameSnapshot || orderData.customerName,
    guest_phone: orderData.guest_phone || orderData.guestCustomerPhone || orderData.customerPhoneSnapshot || orderData.customerPhone,
    customerNameSnapshot: orderData.customerNameSnapshot || orderData.guestCustomerName || orderData.customerName || "",
    customerPhoneSnapshot: orderData.customerPhoneSnapshot || orderData.guestCustomerPhone || orderData.customerPhone || "",
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
    // Step 1: Link to existing registered customer if phone matches, otherwise keep as guest without inserting into customers directory
    if (!targetCustomerId) {
      const phoneToSearch = orderData.guestCustomerPhone || orderData.customerPhoneSnapshot || orderData.customerPhone || orderData.guest_phone || "";

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
    }

    if (isUuid(targetCustomerId)) {
      fullOrderObj.customerId = targetCustomerId;
      fullOrderObj.customerType = 'REGISTERED';
    }

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
      console.error("⚠️ Error saving repair order to Supabase:", error.message);
      throw new Error(`تعذر حفظ أمر الصيانة في Supabase: ${error.message}`);
    }

    if (data) {
      const createdOrder = mapRowToRepairOrder(data);
      const updatedLocalList = [createdOrder, ...localList.filter(o => o.id !== createdOrder.id)];
      saveLocalRepairOrdersBackup(updatedLocalList, true);
      return createdOrder;
    }
  } catch (err: any) {
    console.error("⚠️ Exception in addRepairOrderToSupabase:", err?.message || err);
    throw err;
  }

  // Local fallback if Supabase not configured
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
 * Strict version of updateRepairOrderInSupabase that checks for Supabase save errors
 */
export async function updateRepairOrderInSupabaseStrict(
  order: RepairOrder,
  currentUser?: User
): Promise<{ success: boolean; updatedOrder?: RepairOrder; error?: string }> {
  const localList = getLocalRepairOrdersBackup();

  if (!isSupabaseConfigured) {
    const idx = localList.findIndex(o => o.id === order.id);
    if (idx !== -1) localList[idx] = order;
    else localList.unshift(order);
    saveLocalRepairOrdersBackup(localList, true);
    return { success: true, updatedOrder: order };
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
      console.error("⚠️ [updateRepairOrderInSupabaseStrict] Error updating repair order in Supabase:", error.message);
      return { success: false, error: `فشل تحديث أمر الصيانة في Supabase: ${error.message}` };
    }

    const updated = data ? mapRowToRepairOrder(data) : order;
    const idx = localList.findIndex(o => o.id === updated.id);
    if (idx !== -1) localList[idx] = updated;
    else localList.unshift(updated);
    saveLocalRepairOrdersBackup(localList, true);
    return { success: true, updatedOrder: updated };
  } catch (err: any) {
    console.error("⚠️ [updateRepairOrderInSupabaseStrict] Exception:", err);
    return { success: false, error: err?.message || 'فشل تحديث أمر الصيانة في Supabase' };
  }
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
