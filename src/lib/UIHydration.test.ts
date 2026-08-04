import {
  getActiveRepairUsagesForOrder,
  getActiveRepairUsagesForDevice,
  buildRepairPartReceiptLines
} from "./accountingEngineV2";
import { RepairOrder, RepairPartUsage, WorkOwnershipType, RepairStatus } from "../types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✅ PASS: ${message}`);
}

export function runUIHydrationTests() {
  console.log("==================================================");
  console.log("🧪 Running UI Hydration & Canonical Usages Tests");
  console.log("==================================================");

  const mockOrder: RepairOrder = {
    id: "RO-UI-TEST-001",
    orderNumber: "1001",
    customerName: "عميل تجربة الواجهة",
    customerPhone: "01100000000",
    status: RepairStatus.Ready,
    devices: [
      {
        id: "DEV-PLAYSTATION-5",
        type: "PlayStation",
        model: "PS5",
        issue: "عطل باور",
        partsCost: 600,
        estimatedCost: 1800,
        finalRepairPrice: 1800,
        selectedRepairItems: [] // Note: selectedRepairItems is empty snapshot after reopen
      }
    ],
    totalEstimatedCost: 1800,
    finalRepairPrice: 1800,
    advancePayment: 0,
    isPaid: false,
    createdAt: new Date().toISOString()
  };

  const usagePartA: RepairPartUsage = {
    id: "PU-PART-A",
    repairOrderId: "RO-UI-TEST-001",
    inventoryItemId: "PROD-A",
    partName: "آيسي باور سوني 5 (Part A)",
    quantity: 1,
    unitCost: 300,
    totalCost: 300,
    sellingPrice: 600,
    sellingTotal: 600,
    ownershipType: WorkOwnershipType.CUSTOMER_SHARED,
    responsiblePartnerId: "SHOP",
    accountingStatus: "CONSUMED",
    createdAt: new Date().toISOString()
  };

  const usagePartAReturned: RepairPartUsage = {
    ...usagePartA,
    accountingStatus: "RETURNED"
  };

  const usagePartB: RepairPartUsage = {
    id: "PU-PART-B",
    repairOrderId: "RO-UI-TEST-001",
    inventoryItemId: "PROD-B",
    partName: "كابل باور سوني 5 (Part B)",
    quantity: 1,
    unitCost: 150,
    totalCost: 150,
    sellingPrice: 300,
    sellingTotal: 300,
    ownershipType: WorkOwnershipType.CUSTOMER_SHARED,
    responsiblePartnerId: "SHOP",
    accountingStatus: "CONSUMED",
    createdAt: new Date().toISOString()
  };

  // --- Test 5: Single active part on reopen ---
  console.log("\n--- Test 5: Reopen Order with 1 Active Usage ---");
  const activeOrderUsages5 = getActiveRepairUsagesForOrder(mockOrder, [usagePartA]);
  const activeDeviceUsages5 = getActiveRepairUsagesForDevice(mockOrder, mockOrder.devices[0], 0, [usagePartA]);
  const receiptLines5 = buildRepairPartReceiptLines(mockOrder, [usagePartA]);

  assert(activeOrderUsages5.length === 1, "getActiveRepairUsagesForOrder returns 1 active usage");
  assert(activeDeviceUsages5.length === 1, "RepairCenter UI displays 1 part from canonical usages");
  assert(activeDeviceUsages5[0].partName === "آيسي باور سوني 5 (Part A)", "RepairCenter part name matches Part A");
  assert(receiptLines5.length === 1, "PrintReceiptModal builds 1 receipt part line");
  assert(receiptLines5[0].partName === "آيسي باور سوني 5 (Part A)", "Receipt part line matches Part A");

  // --- Test 6: Add A -> Remove A -> Add B -> Reopen ---
  console.log("\n--- Test 6: Add A -> Remove A -> Add B -> Reopen ---");
  const usagesAfterAandB = [usagePartAReturned, usagePartB];
  const activeDeviceUsages6 = getActiveRepairUsagesForDevice(mockOrder, mockOrder.devices[0], 0, usagesAfterAandB);
  const receiptLines6 = buildRepairPartReceiptLines(mockOrder, usagesAfterAandB);

  assert(activeDeviceUsages6.length === 1, "RepairCenter UI displays exactly 1 active part (Part B)");
  assert(activeDeviceUsages6[0].partName === "كابل باور سوني 5 (Part B)", "Part A is cleanly excluded; Part B displayed");
  assert(receiptLines6.length === 1, "Receipt contains only Part B");
  assert(receiptLines6[0].partName === "كابل باور سوني 5 (Part B)", "Receipt line is Part B");

  console.log("\n==================================================");
  console.log("📊 UI Hydration Test Summary: All Passed");
  console.log("==================================================");
}

runUIHydrationTests();
