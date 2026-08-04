import {
  RepairOrder,
  RepairStatus,
  DeviceType,
  WorkOwnershipType,
  RepairPartUsage,
  InventoryMovement,
  Product
} from '../types';
import {
  resolveOrderPartsAccounting,
  syncOrderSelectedRepairItemsFromUsages
} from './accountingEngineV2';

export function runRepairPartLifecycleTests() {
  console.log("==================================================");
  console.log("🧪 Running Repair Part Lifecycle Unit Tests Suite");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // --- Test 1: Add Part -> Save -> READY_FOR_DELIVERY -> Reopen ---
  console.log("\n--- Test 1: Add Part -> Save -> READY_FOR_DELIVERY -> Reopen ---");

  const orderId = "ATR-90001";
  const orderUuid = "9b1deb4d-3b7d-4b69-8000-000000000001";

  const productA: Product = {
    id: "PROD-A",
    name: "PS5 HDMI IC",
    nameAr: "اي سي اتش دي ام اي بلايستيشن 5",
    category: "قطع غيار",
    quantity: 10,
    minQuantity: 2
  } as any;

  let testOrder1: RepairOrder = {
    id: orderId,
    uuid: orderUuid,
    databaseId: orderUuid,
    orderNumber: orderId,
    order_number: orderId,
    receivedDate: new Date().toISOString(),
    status: RepairStatus.Diagnosing,
    workOwnershipType: WorkOwnershipType.CUSTOMER_SHARED,
    totalEstimatedCost: 1000,
    finalRepairPrice: 1000,
    advancePayment: 0,
    isPaid: false,
    trackingToken: "TRK-90001",
    devices: [
      {
        id: "DEV-90001-0",
        type: DeviceType.PS5,
        model: "PS5 Standard",
        serialNumber: "SN-90001",
        color: "White",
        accessories: "Power cable",
        issue: "No signal",
        estimatedCost: 1000,
        finalRepairPrice: 1000,
        partsCost: 0,
        laborCost: 1000,
        status: RepairStatus.Diagnosing,
        selectedRepairItems: []
      }
    ]
  };

  const usageA1: RepairPartUsage = {
    id: "PU-TEST-001",
    repairOrderId: orderUuid, // Simulating Supabase UUID link
    inventoryItemId: productA.id,
    partName: productA.nameAr!,
    sku: productA.id,
    quantity: 1,
    unitCost: 300,
    totalCost: 300,
    sellingPrice: 500,
    sellingTotal: 500,
    ownershipType: WorkOwnershipType.CUSTOMER_SHARED,
    responsiblePartnerId: "SHOP",
    accountingStatus: "CONSUMED",
    notes: `deviceId:${testOrder1.devices[0].id}`,
    createdAt: new Date().toISOString()
  };

  const movementA1: InventoryMovement = {
    id: "MOV-TEST-001",
    productId: productA.id,
    movementType: "REPAIR_USAGE",
    quantityChange: -1,
    previousQuantity: 10,
    newQuantity: 9,
    costPriceSnapshot: 300,
    sellingPriceSnapshot: 500,
    referenceId: orderId,
    notes: "صرف قطعة غيار صيانة",
    createdAt: new Date().toISOString()
  } as any;

  const usagesList1 = [usageA1];
  const movementsList1 = [movementA1];

  // 1. Initial sync / add part
  testOrder1 = syncOrderSelectedRepairItemsFromUsages(testOrder1, usagesList1, pu => pu.sellingPrice || 0);

  assert(
    testOrder1.devices[0].selectedRepairItems?.length === 1,
    "Selected repair items snapshot contains 1 part after add"
  );
  assert(
    testOrder1.devices[0].selectedRepairItems?.[0].usageId === usageA1.id,
    "Selected repair item usageId matches canonical repair_part_usage id"
  );
  assert(
    testOrder1.devices[0].partsCost === 500,
    "Device partsCost correctly updated to 500 EGP"
  );

  // 2. Mark READY_FOR_DELIVERY
  testOrder1.status = RepairStatus.Ready;
  testOrder1.devices[0].status = RepairStatus.Ready;

  // 3. Reopen order (hydrate from usages)
  const reopenedOrder1 = syncOrderSelectedRepairItemsFromUsages(testOrder1, usagesList1, pu => pu.sellingPrice || 0);

  assert(
    reopenedOrder1.devices[0].selectedRepairItems?.length === 1,
    "Part remains visible in UI after reopening order"
  );

  const accounting1 = resolveOrderPartsAccounting(reopenedOrder1, movementsList1, usagesList1);
  assert(
    accounting1.purchaseCostStatus === "RECORDED",
    "Accounting status is RECORDED"
  );
  assert(
    accounting1.purchaseCost === 300,
    "Purchase cost is accurately resolved to 300 EGP"
  );
  assert(
    accounting1.partsQuantity === 1,
    "Active parts quantity equals 1"
  );

  // --- Test 2: Add A -> Remove A -> Add B -> Save -> Ready -> Reopen ---
  console.log("\n--- Test 2: Add A -> Remove A -> Add B -> Save -> Ready -> Reopen ---");

  const productB: Product = {
    id: "PROD-B",
    name: "PS5 Power IC",
    nameAr: "اي سي بور بلايستيشن 5",
    category: "قطع غيار",
    quantity: 5,
    minQuantity: 1
  } as any;

  let testOrder2: RepairOrder = {
    id: "ATR-90002",
    uuid: "9b1deb4d-3b7d-4b69-8000-000000000002",
    databaseId: "9b1deb4d-3b7d-4b69-8000-000000000002",
    orderNumber: "ATR-90002",
    order_number: "ATR-90002",
    receivedDate: new Date().toISOString(),
    status: RepairStatus.Diagnosing,
    workOwnershipType: WorkOwnershipType.CUSTOMER_SHARED,
    totalEstimatedCost: 1200,
    finalRepairPrice: 1200,
    advancePayment: 0,
    isPaid: false,
    trackingToken: "TRK-90002",
    devices: [
      {
        id: "DEV-90002-0",
        type: DeviceType.PS5,
        model: "PS5 Digital",
        serialNumber: "SN-90002",
        color: "Black",
        accessories: "None",
        issue: "No power",
        estimatedCost: 1200,
        finalRepairPrice: 1200,
        partsCost: 0,
        laborCost: 1200,
        status: RepairStatus.Diagnosing,
        selectedRepairItems: []
      }
    ]
  };

  // 1. Add Part A (usageA2 & movementA2_out)
  const usageA2: RepairPartUsage = {
    id: "PU-TEST-002A",
    repairOrderId: testOrder2.uuid!,
    inventoryItemId: productA.id,
    partName: productA.nameAr!,
    sku: productA.id,
    quantity: 1,
    unitCost: 300,
    totalCost: 300,
    sellingPrice: 500,
    sellingTotal: 500,
    ownershipType: WorkOwnershipType.CUSTOMER_SHARED,
    responsiblePartnerId: "SHOP",
    accountingStatus: "CONSUMED",
    notes: `deviceId:${testOrder2.devices[0].id}`,
    createdAt: new Date().toISOString()
  };

  const movementA2_out: InventoryMovement = {
    id: "MOV-TEST-002A-OUT",
    productId: productA.id,
    movementType: "REPAIR_USAGE",
    quantityChange: -1,
    previousQuantity: 10,
    newQuantity: 9,
    costPriceSnapshot: 300,
    sellingPriceSnapshot: 500,
    referenceId: testOrder2.id,
    notes: "صرف قطعة غيار صيانة",
    createdAt: new Date().toISOString()
  } as any;

  // 2. Remove Part A (status becomes RETURNED, movementA2_in created)
  usageA2.accountingStatus = "RETURNED";

  const movementA2_in: InventoryMovement = {
    id: "MOV-TEST-002A-IN",
    productId: productA.id,
    movementType: "RETURN",
    quantityChange: 1,
    previousQuantity: 9,
    newQuantity: 10,
    costPriceSnapshot: 300,
    sellingPriceSnapshot: 0,
    referenceId: testOrder2.id,
    notes: "إرجاع قطعة غيار صيانة",
    createdAt: new Date().toISOString()
  } as any;

  // 3. Add Part B (usageB2 & movementB2_out)
  const usageB2: RepairPartUsage = {
    id: "PU-TEST-002B",
    repairOrderId: testOrder2.uuid!,
    inventoryItemId: productB.id,
    partName: productB.nameAr!,
    sku: productB.id,
    quantity: 1,
    unitCost: 400,
    totalCost: 400,
    sellingPrice: 600,
    sellingTotal: 600,
    ownershipType: WorkOwnershipType.CUSTOMER_SHARED,
    responsiblePartnerId: "SHOP",
    accountingStatus: "CONSUMED",
    notes: `deviceId:${testOrder2.devices[0].id}`,
    createdAt: new Date().toISOString()
  };

  const movementB2_out: InventoryMovement = {
    id: "MOV-TEST-002B-OUT",
    productId: productB.id,
    movementType: "REPAIR_USAGE",
    quantityChange: -1,
    previousQuantity: 5,
    newQuantity: 4,
    costPriceSnapshot: 400,
    sellingPriceSnapshot: 600,
    referenceId: testOrder2.id,
    notes: "صرف قطعة غيار صيانة",
    createdAt: new Date().toISOString()
  } as any;

  const usagesList2 = [usageA2, usageB2];
  const movementsList2 = [movementA2_out, movementA2_in, movementB2_out];

  // Hydrate order state
  testOrder2 = syncOrderSelectedRepairItemsFromUsages(testOrder2, usagesList2, pu => pu.sellingPrice || 0);

  assert(
    testOrder2.devices[0].selectedRepairItems?.length === 1,
    "Only 1 active part visible in selectedRepairItems"
  );
  assert(
    testOrder2.devices[0].selectedRepairItems?.[0].productId === productB.id,
    "Visible part is Part B (Part A was cleanly excluded after return)"
  );
  assert(
    usageA2.accountingStatus === "RETURNED",
    "Part A accounting status is RETURNED"
  );

  // Mark READY_FOR_DELIVERY and reopen
  testOrder2.status = RepairStatus.Ready;
  testOrder2.devices[0].status = RepairStatus.Ready;
  const reopenedOrder2 = syncOrderSelectedRepairItemsFromUsages(testOrder2, usagesList2, pu => pu.sellingPrice || 0);

  const accounting2 = resolveOrderPartsAccounting(reopenedOrder2, movementsList2, usagesList2);

  assert(
    accounting2.purchaseCostStatus === "RECORDED",
    "Accounting status is RECORDED"
  );
  assert(
    accounting2.partsQuantity === 1,
    "Total active parts quantity is 1 (Part B only)"
  );
  assert(
    accounting2.purchaseCost === 400,
    "Total purchase cost equals 400 EGP (Part B cost only, Part A cost excluded)"
  );

  console.log("==================================================");
  console.log(`📊 Test Summary: ${passed} Passed, ${failed} Failed`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runRepairPartLifecycleTests();
