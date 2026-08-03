import { executeAddPartUsageTransaction } from './repairPartAddService';
import { db } from './db';
import { DeviceType, Product, RepairOrder, RepairPartUsage, RepairStatus, WorkOwnershipType } from '../types';

async function runRepairPartReAddAfterReturnTest() {
  const product: Product = {
    id: 'PROD-HDMI-QA',
    name: 'HDMI PS5',
    nameAr: 'سكوت اتش دي بلايستيشن 5',
    category: 'Repair parts',
    barcode: 'HDMI-QA',
    sku: 'HDMI-QA',
    quantity: 10,
    minStock: 1,
    purchasePrice: 100,
    sellPrice: 1200
  };

  const returnedUsage: RepairPartUsage = {
    id: 'PU-RETURNED-QA',
    repairOrderId: 'ATR-QA-1',
    inventoryItemId: product.id,
    partName: product.nameAr,
    sku: product.sku,
    quantity: 1,
    unitCost: 100,
    totalCost: 100,
    sellingPrice: 1200,
    sellingTotal: 1200,
    ownershipType: WorkOwnershipType.CUSTOMER_SHARED,
    responsiblePartnerId: 'SHOP',
    accountingStatus: 'RETURNED',
    notes: 'deviceId:DEV-QA-1',
    createdAt: new Date().toISOString()
  };

  const order: RepairOrder = {
    id: 'ATR-QA-1',
    devices: [{
      id: 'DEV-QA-1',
      type: DeviceType.PS5,
      model: 'Fat',
      serialNumber: 'QA',
      color: 'White',
      accessories: 'None',
      issue: '',
      status: RepairStatus.Diagnosing,
      estimatedCost: 0,
      finalRepairPrice: 0,
      partsCost: 0,
      laborCost: 0,
      selectedRepairItems: [{
        id: 'PU-GHOST-USB',
        usageId: 'PU-GHOST-USB',
        productId: 'PROD-USB-QA',
        name: 'USB ghost',
        quantity: 1,
        costPrice: 50,
        repairPrice: 800,
        salePrice: 800,
        deviceId: 'DEV-QA-1',
        deviceIndex: 0
      }]
    }],
    totalEstimatedCost: 0,
    finalRepairPrice: 0,
    advancePayment: 0,
    isPaid: false,
    status: RepairStatus.Diagnosing,
    receivedDate: new Date().toISOString(),
    trackingToken: 'QA-TOKEN',
    workOwnershipType: WorkOwnershipType.CUSTOMER_SHARED
  } as RepairOrder;

  db.saveProducts([product]);
  db.saveRepairPartUsages([returnedUsage]);
  db.saveRepairOrders([order]);

  // Simulate the stale React state observed in production: the same terminal
  // usage still looks active and has an inflated quantity in memory.
  const staleUsage = {
    ...returnedUsage,
    quantity: 2,
    accountingStatus: 'CONSUMED' as const
  };

  const result = await executeAddPartUsageTransaction({
    product,
    deviceIdx: 0,
    qty: 1,
    selectedOrder: order,
    products: [product],
    partUsages: [staleUsage]
  });

  const active = (result.updatedPartUsages || []).filter(
    usage => usage.accountingStatus !== 'RETURNED' && usage.accountingStatus !== 'REVERSED'
  );
  const terminal = (result.updatedPartUsages || []).find(usage => usage.id === returnedUsage.id);
  const visible = result.updatedOrder?.devices[0].selectedRepairItems || [];

  const checks: Array<[boolean, string]> = [
    [result.success, 're-add succeeds'],
    [terminal?.accountingStatus === 'RETURNED' && terminal.quantity === 1, 'returned usage is not incremented'],
    [active.length === 1 && active[0].quantity === 1, 'one fresh active usage is created'],
    [visible.length === 1 && visible[0].usageId === active[0]?.id, 'ghost snapshot is removed'],
    [visible[0]?.quantity === 1, 'visible quantity starts at one'],
    [result.updatedOrder?.finalRepairPrice === 1200, 'order total contains only the new part'],
    [result.updatedProducts?.[0].quantity === 9, 'stock is decremented once']
  ];

  let failed = 0;
  for (const [passed, message] of checks) {
    console.log(`${passed ? '✅' : '❌'} ${message}`);
    if (!passed) failed++;
  }
  if (failed > 0) process.exit(1);
}

runRepairPartReAddAfterReturnTest();
