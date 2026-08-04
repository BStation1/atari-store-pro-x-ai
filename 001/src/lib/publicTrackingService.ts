import { supabase } from "./supabaseClient";
import { RepairOrder, Customer } from "../types";
import { isPhoneMatch } from "./phoneUtils";
import { getCustomerPhoneHelper } from "./customerDisplayHelper";

export interface PublicTrackingResponse {
  success: boolean;
  order?: RepairOrder | null;
  error?: string | null;
}

/**
 * Public Order Tracking Service - Fetch customer repair order without ERP authentication.
 * Enforces dual verification (Token/OrderCode + Registered Phone) and returns customer-safe data.
 */
export async function fetchPublicTrackingOrder(
  token: string,
  phone: string,
  localOrders: RepairOrder[] = [],
  localCustomers: Customer[] = []
): Promise<PublicTrackingResponse> {
  const cleanToken = token.trim().toLowerCase();
  const cleanPhone = phone.trim();

  if (!cleanToken || !cleanPhone) {
    return {
      success: false,
      error: "رقم الهاتف أو بيانات التتبع غير صحيحة."
    };
  }

  // 1. First Attempt: Express Server API Endpoint (/api/public/track)
  try {
    const apiRes = await fetch("/api/public/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: cleanToken, phone: cleanPhone })
    });

    if (apiRes.ok) {
      const data = await apiRes.json();
      if (data.success && data.order) {
        return {
          success: true,
          order: data.order as RepairOrder
        };
      }
    } else {
      const errData = await apiRes.json().catch(() => null);
      if (errData && errData.error) {
        // If server explicitly responded with an error (e.g. rate limit or bad phone/token)
        if (apiRes.status === 429) {
          return { success: false, error: errData.error };
        }
      }
    }
  } catch (err) {
    console.warn("Public track API route fallback to RPC:", err);
  }

  // 2. Second Attempt: Direct Supabase RPC call get_public_tracking_order
  try {
    const { data: rpcData, error: rpcErr } = await supabase.rpc("get_public_tracking_order", {
      p_token: cleanToken,
      p_phone: cleanPhone
    });

    if (!rpcErr && rpcData) {
      return {
        success: true,
        order: rpcData as RepairOrder
      };
    }
  } catch (err) {
    console.warn("RPC public tracking fallback error:", err);
  }

  // 3. Fallback: Search in-memory localOrders (if user is currently logged into ERP)
  if (localOrders && localOrders.length > 0) {
    const matched = localOrders.find(order => {
      const isOrderMatch =
        order.id.toLowerCase() === cleanToken ||
        (order.trackingToken && order.trackingToken.toLowerCase() === cleanToken) ||
        order.devices.some(
          d => ((d as any).deviceCode && String((d as any).deviceCode).toLowerCase() === cleanToken) || (d.serialNumber && d.serialNumber.toLowerCase() === cleanToken)
        );

      if (!isOrderMatch) return false;

      const custPhone = getCustomerPhoneHelper(order, localCustomers);
      return isPhoneMatch(cleanPhone, custPhone);
    });

    if (matched) {
      return {
        success: true,
        order: matched
      };
    }
  }

  return {
    success: false,
    error: "رقم الهاتف أو بيانات التتبع غير صحيحة."
  };
}
