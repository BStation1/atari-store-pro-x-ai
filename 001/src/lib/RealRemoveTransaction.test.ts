import { Product, RepairOrder, RepairPartUsage, RepairStatus, DeviceType, WorkOwnershipType, InventoryMovement } from '../types';
import { executeRemovePartUsageTransaction } from './repairPartRemovalService';
import { resolveOrderPartsAccounting, syncOrderSelectedRepairItemsFromUsages } from './accountingEngineV2';

export async function runRealRemoveTransactionTest() {
  console.log("==================================================");
  console.log("🧪 Running Real Remove Service Acceptance Test");
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

  // Initial stock = 10
  let products: Product[] = [
    {
      id: "PROD-10000",
      name: "PS5 HDMI Port",
      nameAr: "مدخل اتش دي ام اي بلايستيشن 5",
      category: "قطع غيار",
      quantity: 10,
      minQuantity: 1
    } as any
  ];

  let order: RepairOrder = {
    id: "ATR-10000",
    uuid: "10000000-0000-0000-0000-000000010000",
    databaseId: "10000000-0000-0000-0000-000000010000",
    orderNumber: "ATR-10000",
    receivedDate: new Date().toISOString(),
    status: RepairStatus.Diagnosing,
    workOwnershipType: WorkOwnershipType.CUSTOMER_SHARED,
    totalEstimatedCost: 1000,
    finalRepairPrice: 1000,
    advancePayment: 0,
    isPaid: false,
    trackingToken: "TRK-10000",
    devices: [
      {
        id: "DEV-10000-0",
        type: DeviceType.PS5,
        model: "PS5 Disc",
        serialNumber: "SN-10000",
        color: "White",
        accessories: "Cable",
        issue: "No display",
        estimatedCost: 1000,
        finalRepairPrice: 1000,
        partsCost: 350,
        laborCost: 650,
        status: RepairStatus.Diagnosing,
        selectedRepairItems: []
      }
    ]
  };

  // Add Part A cost 100
  const usageA: RepairPartUsage = {
    id: "PU-10000-A",
    repairOrderId: order.uuid!,
    inventoryItemId: "PROD-10000",
    partName: "قطعة غيار أ",
    sku: "PROD-10000",
    quantity: 1,
    unitCost: 100,
    totalCost: 100,
    sellingPrice: 150,
    sellingTotal: 150,
    ownershipType: WorkOwnershipType.CUSTOMER_SHARED,
    responsiblePartnerId: "SHOP",
    accountingStatus: "CONSUMED",
    notes: `deviceId:${order.devices[0].id}`,
    createdAt: new Date().toISOString()
  };

  // Add Part B cost 250
  const usageB: RepairPartUsage = {
    id: "PU-10000-B",
    repairOrderId: order.uuid!,
    inventoryItemId: "PROD-10000",
    partName: "قطعة غيار ب",
    sku: "PROD-10000",
    quantity: 1,
    unitCost: 250,
    totalCost: 250,
    sellingPrice: 300,
    sellingTotal: 300,
    ownershipType: WorkOwnershipType.CUSTOMER_SHARED,
    responsiblePartnerId: "SHOP",
    accountingStatus: "CONSUMED",
    notes: `deviceId:${order.devices[0].id}`,
    createdAt: new Date().toISOString()
  };

  // Outgoing movements on add
  const movementA_out: InventoryMovement = {
    id: "MOV-10000-A-OUT",
    productId: "PROD-10000",
    movementType: "REPAIR_USAGE",
    quantityChange: -1,
    previousQuantity: 10,
    newQuantity: 9,
    costPriceSnapshot: 100,
    sellingPriceSnapshot: 150,
    referenceId: order.id,
    createdAt: new Date().toISOString()
  } as any;

  const movementB_out: InventoryMovement = {
    id: "MOV-10000-B-OUT",
    productId: "PROD-10000",
    movementType: "REPAIR_USAGE",
    quantityChange: -1,
    previousQuantity: 9,
    newQuantity: 8,
    costPriceSnapshot: 250,
    sellingPriceSnapshot: 300,
    referenceId: order.id,
    createdAt: new Date().toISOString()
  } as any;

  products[0].quantity = 8; // Stock after add = 8
  let usages: RepairPartUsage[] = [usageA, usageB];
  let movements: InventoryMovement[] = [movementA_out, movementB_out];

  order = syncOrderSelectedRepairItemsFromUsages(order, usages, pu => pu.sellingPrice || 0);

  console.log(`Initial State: Stock=${products[0].quantity}, Active Usages=${usages.filter(u => u.accountingStatus !== 'RETURNED').length}`);
  assert(products[0].quantity === 8, "Stock after add equals 8");

  // EXECUTE REMOVE A using real remove service
  const removeResA = await executeRemovePartUsageTransaction({
    usageId: usageA.id,
    deviceIdx: 0,
    removeQty: -1,
    selectedOrder: order,
    products,
    partUsages: usages
  });

  assert(removeResA.success, "Remove A transaction succeeded");
  if (removeResA.updatedProducts) products = removeResA.updatedProducts;
  if (removeResA.updatedPartUsages) usages = removeResA.updatedPartUsages;
  if (removeResA.updatedOrder) order = removeResA.updatedOrder;
  if (removeResA.returnMovementRow) movements.push(removeResA.returnMovementRow);

  // EXECUTE REMOVE B using real remove service
  const removeResB = await executeRemovePartUsageTransaction({
    usageId: usageB.id,
    deviceIdx: 0,
    removeQty: -1,
    selectedOrder: order,
    products,
    partUsages: usages
  });

  assert(removeResB.success, "Remove B transaction succeeded");
  if (removeResB.updatedProducts) products = removeResB.updatedProducts;
  if (removeResB.updatedPartUsages) usages = removeResB.updatedPartUsages;
  if (removeResB.updatedOrder) order = removeResB.updatedOrder;
  if (removeResB.returnMovementRow) movements.push(removeResB.returnMovementRow);

  // Verification against all prompt acceptance criteria
  const activeUsagesCount = usages.filter(u => u.accountingStatus !== 'RETURNED' && u.accountingStatus !== 'REVERSED').length;
  const returnedUsagesCount = usages.filter(u => u.accountingStatus === 'RETURNED').length;
  const returnMovementsCount = movements.filter(m => m.movementType === 'RETURN' || (m as any).usageType === 'REPAIR_USAGE_RETURN').length;

  const accounting = resolveOrderPartsAccounting(order, movements, usages);

  assert(products[0].quantity === 10, "Required final state: stock = 10");
  assert(activeUsagesCount === 0, "Required final state: active usages = 0");
  assert(returnedUsagesCount === 2, "Required final state: RETURNED usages = 2");
  assert(returnMovementsCount === 2, "Required final state: REPAIR_USAGE_RETURN movements = 2");
  assert((order.devices[0].selectedRepairItems || []).length === 0, "Required final state: invoice parts = 0");
  assert(accounting.partsQuantity === 0, "Required final state: withdrawn quantity = 0");
  assert(accounting.purchaseCost === 0, "Required final state: order purchase cost = 0");

  console.log("==================================================");
  console.log(`📊 Real Remove Service Test Summary: ${passed} Passed, ${failed} Failed`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runRealRemoveTransactionTest();
