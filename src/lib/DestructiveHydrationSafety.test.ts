import { syncOrderSelectedRepairItemsFromUsages } from "./accountingEngineV2";
import { RepairOrder, RepairPartUsage, WorkOwnershipType, RepairStatus, DeviceType } from "../types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✅ PASS: ${message}`);
}

export function runDestructiveHydrationSafetyTests() {
  console.log("==================================================");
  console.log("🧪 Running Destructive Hydration Safety Unit Tests");
  console.log("==================================================");

  const mockOrderWithPart: RepairOrder = {
    id: "RO-TEST-HYDRATION-001",
    customerName: "عميل تجربة الهيدريشن",
    customerPhone: "01000000000",
    status: RepairStatus.Ready,
    devices: [
      {
        id: "DEV-1",
        type: DeviceType.PS5,
        model: "PS5",
        serialNumber: "SN-123",
        color: "أبيض",
        accessories: "بدون",
        issue: "عطل بور",
        partsCost: 500,
        laborCost: 1000,
        estimatedCost: 1500,
        finalRepairPrice: 1500,
        status: RepairStatus.Ready,
        selectedRepairItems: [
          {
            id: "PU-100",
            usageId: "PU-100",
            productId: "PROD-POWER-IC",
            name: "آيسي باور سوني 5",
            quantity: 1,
            costPrice: 300,
            repairPrice: 500,
            salePrice: 500,
            deviceId: "DEV-1",
            deviceIndex: 0
          }
        ]
      }
    ],
    totalEstimatedCost: 1500,
    finalRepairPrice: 1500,
    advancePayment: 0,
    isPaid: false,
    receivedDate: new Date().toISOString(),
    trackingToken: "TRK-HYD-001"
  };

  const activeUsage: RepairPartUsage = {
    id: "PU-100",
    sku: "PROD-POWER-IC",
    repairOrderId: "RO-TEST-HYDRATION-001",
    inventoryItemId: "PROD-POWER-IC",
    partName: "آيسي باور سوني 5",
    quantity: 1,
    unitCost: 300,
    totalCost: 300,
    sellingPrice: 500,
    sellingTotal: 500,
    ownershipType: WorkOwnershipType.CUSTOMER_SHARED,
    responsiblePartnerId: "SHOP",
    accountingStatus: "CONSUMED",
    createdAt: new Date().toISOString()
  };

  const returnedUsage: RepairPartUsage = {
    ...activeUsage,
    accountingStatus: "RETURNED"
  };

  // --- Test A: Temporary empty usages (usagesLoaded = false, usages = []) ---
  console.log("\n--- Test A: Temporary empty usages (usagesLoaded = false, usages = []) ---");
  const resultA = syncOrderSelectedRepairItemsFromUsages(
    mockOrderWithPart,
    [],
    undefined,
    { usagesLoaded: false, allowClear: true }
  );
  assert(resultA.devices[0].selectedRepairItems?.length === 1, "selectedRepairItems remains 1");
  assert(resultA.devices[0].partsCost === 500, "partsCost remains 500 EGP");

  // --- Test B: Fully loaded active usage (usagesLoaded = true, active usages = 1) ---
  console.log("\n--- Test B: Fully loaded active usage (usagesLoaded = true, active usages = 1) ---");
  const resultB = syncOrderSelectedRepairItemsFromUsages(
    mockOrderWithPart,
    [activeUsage],
    undefined,
    { usagesLoaded: true, allowClear: true }
  );
  assert(resultB.devices[0].selectedRepairItems?.length === 1, "snapshot rebuilt with 1 part");
  assert(resultB.devices[0].selectedRepairItems?.[0].id === "PU-100", "rebuilt part usageId matches PU-100");
  assert(resultB.devices[0].partsCost === 500, "partsCost equals 500 EGP");

  // --- Test C: Fully loaded returned usage (usagesLoaded = true, all usages RETURNED, allowClear = true) ---
  console.log("\n--- Test C: Fully loaded returned usage (all usages RETURNED, allowClear = true) ---");
  const resultC = syncOrderSelectedRepairItemsFromUsages(
    mockOrderWithPart,
    [returnedUsage],
    undefined,
    { usagesLoaded: true, allowClear: true }
  );
  assert(resultC.devices[0].selectedRepairItems?.length === 0, "selectedRepairItems becomes 0");
  assert(resultC.devices[0].partsCost === 0, "partsCost becomes 0 EGP");

  // --- Test D: Ready status race (usagesLoaded = false, status changed to READY) ---
  console.log("\n--- Test D: Ready status race (status changed to READY before usage reload) ---");
  const resultDUnsynced = syncOrderSelectedRepairItemsFromUsages(
    mockOrderWithPart,
    [],
    undefined,
    { usagesLoaded: false, allowClear: false }
  );
  const resultDStatusUpdate: RepairOrder = {
    ...resultDUnsynced,
    status: RepairStatus.Ready,
    devices: resultDUnsynced.devices.map(d => ({ ...d, status: RepairStatus.Ready }))
  };

  assert(resultDStatusUpdate.status === RepairStatus.Ready, "Order status set to READY");
  assert(resultDStatusUpdate.devices[0].selectedRepairItems?.length === 1, "persisted order still contains 1 part");
  assert(resultDStatusUpdate.devices[0].selectedRepairItems?.[0].name === "آيسي باور سوني 5", "receipt/reopen shows part name correctly");
  assert(resultDStatusUpdate.devices[0].partsCost === 500, "partsCost preserved at 500 EGP");

  console.log("\n==================================================");
  console.log("📊 Destructive Hydration Safety Test Summary: All Passed");
  console.log("==================================================");
}

runDestructiveHydrationSafetyTests();
