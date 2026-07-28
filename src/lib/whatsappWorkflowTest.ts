import {
  sendRepairNotificationWorkflow,
  getWhatsAppLogs,
  clearWhatsAppLogs
} from "./whatsapp";
import { RepairOrder, RepairStatus } from "../types";

export async function runWhatsAppWorkflowTestSuite(): Promise<{
  allPassed: boolean;
  results: Array<{ test: string; status: "PASS" | "FAIL"; error?: string }>;
}> {
  clearWhatsAppLogs();

  const results: Array<{ test: string; status: "PASS" | "FAIL"; error?: string }> = [];

  const mockOrder: RepairOrder = {
    id: "RO-TEST-999",
    trackingToken: "TOKEN-999",
    customerId: "CUST-100",
    customerName: "أحمد علي",
    customerPhone: "01012345678",
    devices: [
      {
        id: "DEV-1",
        type: "PlayStation 5" as any,
        model: "CFI-1200",
        serialNumber: "SN123456",
        color: "White",
        accessories: "كابل باور + ذراع",
        issue: "تغيير مدخل HDMI",
        reportedFaults: ["HDMI Port"],
        technicalProcedures: [],
        needsInspection: false,
        estimatedCost: 1500,
        partsCost: 500,
        laborCost: 1000,
        status: RepairStatus.Received
      }
    ],
    totalEstimatedCost: 1500,
    advancePayment: 300,
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

  // 2. Test Approval Required Trigger
  try {
    const res2 = await sendRepairNotificationWorkflow({
      template: "APPROVAL_REQUIRED",
      order: { ...mockOrder, status: RepairStatus.WaitingCustomerApproval },
      extra: {
        reason: "تغيير ايسي الباور + صيانة الإمداد",
        additionalCost: 400,
        newTotal: 1900
      },
      autoOpenWindow: false
    });

    if (res2.success && res2.log?.template === "APPROVAL_REQUIRED") {
      results.push({ test: "2. Approval Required Notification", status: "PASS" });
    } else {
      results.push({ test: "2. Approval Required Notification", status: "FAIL", error: "Failed trigger 2" });
    }
  } catch (err: any) {
    results.push({ test: "2. Approval Required Notification", status: "FAIL", error: err?.message });
  }

  // 3. Test Ready For Pickup Trigger
  try {
    const res3 = await sendRepairNotificationWorkflow({
      template: "READY_FOR_PICKUP",
      order: { ...mockOrder, status: RepairStatus.Ready, finalRepairPrice: 1900 },
      extra: {
        repairedItems: "استبدال مدخل HDMI + ايسي باور",
        newTotal: 1900
      },
      autoOpenWindow: false
    });

    if (res3.success && res3.log?.template === "READY_FOR_PICKUP") {
      results.push({ test: "3. Ready For Pickup Notification", status: "PASS" });
    } else {
      results.push({ test: "3. Ready For Pickup Notification", status: "FAIL", error: "Failed trigger 3" });
    }
  } catch (err: any) {
    results.push({ test: "3. Ready For Pickup Notification", status: "FAIL", error: err?.message });
  }

  // 4. Test Delivered Trigger
  try {
    const res4 = await sendRepairNotificationWorkflow({
      template: "DELIVERED",
      order: { ...mockOrder, status: RepairStatus.Delivered, warrantyDays: 30 },
      extra: {
        warrantyInfo: "ضمان 30 يوم شامل قطع الغيار"
      },
      autoOpenWindow: false
    });

    if (res4.success && res4.log?.template === "DELIVERED") {
      results.push({ test: "4. Delivered Notification", status: "PASS" });
    } else {
      results.push({ test: "4. Delivered Notification", status: "FAIL", error: "Failed trigger 4" });
    }
  } catch (err: any) {
    results.push({ test: "4. Delivered Notification", status: "FAIL", error: err?.message });
  }

  // 5. Test Deduplication (Prevent Duplicate Send)
  try {
    const resDup = await sendRepairNotificationWorkflow({
      template: "DELIVERED",
      order: { ...mockOrder, status: RepairStatus.Delivered, warrantyDays: 30 },
      extra: {
        warrantyInfo: "ضمان 30 يوم شامل قطع الغيار"
      },
      autoOpenWindow: false
    });

    if (resDup.isDuplicate) {
      results.push({ test: "5. Deduplication Safeguard (Prevent Duplicate Send)", status: "PASS" });
    } else {
      results.push({ test: "5. Deduplication Safeguard (Prevent Duplicate Send)", status: "FAIL", error: "Duplicate was not blocked" });
    }
  } catch (err: any) {
    results.push({ test: "5. Deduplication Safeguard (Prevent Duplicate Send)", status: "FAIL", error: err?.message });
  }

  // 6. Test Error Handling for Invalid/Missing Phone
  try {
    const invalidPhoneOrder = { ...mockOrder, id: "RO-INVALID-PHONE", customerPhone: "" };
    const resFail = await sendRepairNotificationWorkflow({
      template: "REPAIR_ORDER_CREATED",
      order: invalidPhoneOrder,
      customerPhone: "",
      autoOpenWindow: false
    });

    if (!resFail.success && resFail.message === "تم حفظ العملية ولكن تعذر إرسال رسالة واتساب.") {
      results.push({ test: "6. Failure Safeguard & Fallback Message", status: "PASS" });
    } else {
      results.push({ test: "6. Failure Safeguard & Fallback Message", status: "FAIL", error: "Fallback message mismatch: " + resFail.message });
    }
  } catch (err: any) {
    results.push({ test: "6. Failure Safeguard & Fallback Message", status: "FAIL", error: err?.message });
  }

  // 7. Test Logging Audit Accuracy
  try {
    const logs = getWhatsAppLogs();
    const hasSent = logs.some(l => l.status === "SENT");
    const hasFailed = logs.some(l => l.status === "FAILED");
    const hasOrder = logs.every(l => l.orderId && l.customer && l.timestamp && l.template);

    if (logs.length >= 5 && hasSent && hasFailed && hasOrder) {
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
