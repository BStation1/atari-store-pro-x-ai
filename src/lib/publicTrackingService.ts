import { supabase } from "./supabaseClient";
import { RepairOrder, Customer } from "../types";

export interface PublicTrackingResponse {
  success: boolean;
  order?: RepairOrder | null;
  error?: string | null;
}

/**
 * Public Order Tracking Service.
 *
 * Security boundary:
 * - Never reads repair_orders directly from the browser.
 * - Never falls back to in-memory ERP data.
 * - Requires both tracking token/order code and the registered phone number.
 * - Relies on the narrow SECURITY DEFINER RPC to return customer-safe fields only.
 */
export async function fetchPublicTrackingOrder(
  token: string,
  phone: string,
  _localOrders: RepairOrder[] = [],
  _localCustomers: Customer[] = []
): Promise<PublicTrackingResponse> {
  const cleanToken = token.trim().toLowerCase();
  const cleanPhone = phone.trim();

  if (!cleanToken || !cleanPhone) {
    return {
      success: false,
      error: "رقم الهاتف أو بيانات التتبع غير صحيحة."
    };
  }

  try {
    const { data, error } = await supabase.rpc("get_public_tracking_order", {
      p_token: cleanToken,
      p_phone: cleanPhone
    });

    if (error) {
      console.warn("Public tracking RPC failed:", error.message);
      return {
        success: false,
        error: "تعذر التحقق من الطلب حالياً. يرجى المحاولة مرة أخرى."
      };
    }

    if (!data) {
      return {
        success: false,
        error: "رقم الهاتف أو بيانات التتبع غير صحيحة."
      };
    }

    return {
      success: true,
      order: data as RepairOrder
    };
  } catch (err) {
    console.warn("Public tracking request failed:", err);
    return {
      success: false,
      error: "تعذر التحقق من الطلب حالياً. يرجى المحاولة مرة أخرى."
    };
  }
}
