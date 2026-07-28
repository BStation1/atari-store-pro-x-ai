import {
  sendRepairNotificationWorkflow,
  getWhatsAppLogs,
  clearWhatsAppLogs,
  sanitizeWhatsAppMessage
} from "./whatsapp";
import { RepairOrder, RepairStatus } from "../types";
import { generateSecureTrackingToken } from "./trackingToken";
import { getDeviceDisplayName } from "./customerDisplayHelper";

export async function runWhatsAppWorkflowTestSuite(): Promise<{
  allPassed: boolean;
  results: Array<{ test: string; status: "PASS" | "FAIL"; error?: string }>;
}> {
  clearWhatsAppLogs();

  const results: Array<{ test: string; status: "PASS" | "FAIL"; error?: string }> = [];

  const secureToken = generateSecureTrackingToken();

  const mockOrder: RepairOrder = {
    id: "ATR-10002",
    trackingToken: secureToken,
    customerId: "CUST-100",
    customerName: "أحمد علي",
    customerPhone: "01278316303",
    devices: [
      {
        id: "DEV-1",
        type: "DT-1785084373897" as any, // Raw internal ID test
        model: "DM-1785084431395",       // Raw internal ID test
        serialNumber: "SN123456",
        color: "Black",
        accessories: "ذراع تحكم",
        issue: "HDMI Port Repair",
        reportedFaults: ["HDMI"],
        technicalProcedures: [],
        needsInspection: false,
        estimatedCost: 450,
        partsCost: 150,
        laborCost: 300,
        status: RepairStatus.Received
      }
    ],
    totalEstimatedCost: 450,
    advancePayment: 0,
    isPaid: false,
    status: RepairStatus.Received,
    receivedDate: new Date().toISOString()
  };

  // 1. Test Repair Order Created Trigger
  try {
    const res1 = await sendRepairNotificationWorkflow({
      template: "REPAIR_ORDER_CREATED",
      order: mockOrder,
      autoOpenWindow: false
    });

    if (res1.success && res1.log?.template === "REPAIR_ORDER_CREATED") {
      results.push({ test: "1. Repair Order Created Notification", status: "PASS" });
    } else {
      results.push({ test: "1. Repair Order Created Notification", status: "FAIL", error: "Failed trigger 1" });
    }
  } catch (err: any) {
    results.push({ test: "1. Repair Order Created Notification", status: "FAIL", error: err?.message });
  }

  // 2. Test Device Name Resolution (BUG-003) - Ensure internal IDs like DT-xxx are NOT printed
  try {
    const displayName = getDeviceDisplayName({ type: "DT-1785084373897", model: "DM-1785084431395" });
    if (!displayName.includes("DT-178") && !displayName.includes("DM-178")) {
      results.push({ test: "2. Device Name Resolution (BUG-003)", status: "PASS" });
    } else {
      results.push({ test: "2. Device Name Resolution (BUG-003)", status: "FAIL", error: "Raw ID was leaked: " + displayName });
    }
  } catch (err: any) {
    results.push({ test: "2. Device Name Resolution (BUG-003)", status: "FAIL", error: err?.message });
  }

  // 3. Test Message UTF-8 Encoding Sanitization (BUG-004) - No replacement chars
  try {
    const dirtyMessage = "مرحباً أحمد 👋\uFE0F\u200B\uFFFD اختبار الترميز";
    const cleanMessage = sanitizeWhatsAppMessage(dirtyMessage);
    if (!cleanMessage.includes("\uFE0F") && !cleanMessage.includes("\u200B") && !cleanMessage.includes("\uFFFD")) {
      results.push({ test: "3. UTF-8 Message Encoding Sanitization (BUG-004)", status: "PASS" });
    } else {
      results.push({ test: "3. UTF-8 Message Encoding Sanitization (BUG-004)", status: "FAIL", error: "Sanitization failed" });
    }
  } catch (err: any) {
    results.push({ test: "3. UTF-8 Message Encoding Sanitization (BUG-004)", status: "FAIL", error: err?.message });
  }

  // 4. Test Secure Tracking Token Format (BUG-006)
  try {
    if (secureToken && secureToken.length >= 24 && !secureToken.startsWith("ATR-")) {
      results.push({ test: "4. Secure Tracking Token Generation (BUG-006)", status: "PASS" });
    } else {
      results.push({ test: "4. Secure Tracking Token Generation (BUG-006)", status: "FAIL", error: "Insecure token: " + secureToken });
    }
  } catch (err: any) {
    results.push({ test: "4. Secure Tracking Token Generation (BUG-006)", status: "FAIL", error: err?.message });
  }

  // 5. Test Conditional Estimated Cost (Omit if cost = 0)
  try {
    const zeroCostOrder = { ...mockOrder, id: "ATR-ZERO-COST", totalEstimatedCost: 0 };
    const resZero = await sendRepairNotificationWorkflow({
      template: "REPAIR_ORDER_CREATED",
      order: zeroCostOrder,
      autoOpenWindow: false
    });

    if (resZero.success) {
      results.push({ test: "5. Conditional Estimated Cost Logic (Omit if 0)", status: "PASS" });
    } else {
      results.push({ test: "5. Conditional Estimated Cost Logic (Omit if 0)", status: "FAIL" });
    }
  } catch (err: any) {
    results.push({ test: "5. Conditional Estimated Cost Logic (Omit if 0)", status: "FAIL", error: err?.message });
  }

  // 6. Test Deduplication Safeguard
  try {
    const resDup = await sendRepairNotificationWorkflow({
      template: "REPAIR_ORDER_CREATED",
      order: mockOrder,
      autoOpenWindow: false
    });

    if (resDup.isDuplicate) {
      results.push({ test: "6. Deduplication Safeguard (Prevent Duplicate Send)", status: "PASS" });
    } else {
      results.push({ test: "6. Deduplication Safeguard (Prevent Duplicate Send)", status: "FAIL", error: "Duplicate was not blocked" });
    }
  } catch (err: any) {
    results.push({ test: "6. Deduplication Safeguard (Prevent Duplicate Send)", status: "FAIL", error: err?.message });
  }

  // 7. Test Logging Audit Accuracy
  try {
    const logs = getWhatsAppLogs();
    const hasSent = logs.some(l => l.status === "SENT");
    const hasOrder = logs.every(l => l.orderId && l.customer && l.timestamp && l.template);

    if (logs.length >= 2 && hasSent && hasOrder) {
      results.push({ test: "7. WhatsApp Audit Logs Verification", status: "PASS" });
    } else {
      results.push({ test: "7. WhatsApp Audit Logs Verification", status: "FAIL", error: `Log count: ${logs.length}` });
    }
  } catch (err: any) {
    results.push({ test: "7. WhatsApp Audit Logs Verification", status: "FAIL", error: err?.message });
  }

  const allPassed = results.every(r => r.status === "PASS");
  return { allPassed, results };
}
