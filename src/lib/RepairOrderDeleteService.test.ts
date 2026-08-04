import { executeDeleteRepairOrderTransaction } from './repairOrderDeleteService';
import { RepairOrder, Product, RepairPartUsage, Invoice, RepairStatus, WorkOwnershipType, DeviceType } from '../types';

async function runTests() {
  console.log("🧪 [Test] Running RepairOrderDeleteService unit tests...");

  const mockProduct: Product = {
    id: 'PROD-101',
    name: 'شاشة ايفون 11',
    nameAr: 'شاشة ايفون 11',
    category: 'قطع غيار',
    barcode: '123456',
    sku: 'PROD-101',
    purchasePrice: 500,
    sellPrice: 800,
    quantity: 5,
    minStock: 1,
    createdAt: new Date().toISOString()
  };

  const mockOrder: RepairOrder = {
    id: 'ORD-999',
    orderNumber: 'ORD-999',
    customerId: 'CUST-1',
    customerNameSnapshot: 'عميل تجريبي',
    status: RepairStatus.Repairing,
    totalEstimatedCost: 800,
    advancePayment: 0,
    isPaid: false,
    trackingToken: 'TOK-999',
    devices: [
      {
        id: 'D-1',
        type: DeviceType.PS5,
        model: 'ايفون 11',
        serialNumber: 'SN-123',
        color: 'أسود',
        accessories: 'بدون ملحقات',
        issue: 'كسر شاشة',
        estimatedCost: 800,
        partsCost: 500,
        laborCost: 300,
        status: RepairStatus.Repairing,
        selectedRepairItems: [
          {
            id: 'PU-101',
            usageId: 'PU-101',
            productId: 'PROD-101',
            name: 'شاشة ايفون 11',
            quantity: 2,
            repairPrice: 800,
            costPrice: 500
          }
        ]
      }
    ],
    receivedDate: new Date().toISOString()
  };

  const mockUsage: RepairPartUsage = {
    id: 'PU-101',
    repairOrderId: 'ORD-999',
    inventoryItemId: 'PROD-101',
    partName: 'شاشة ايفون 11',
    sku: 'PROD-101',
    quantity: 2,
    unitCost: 500,
    totalCost: 1000,
    sellingPrice: 800,
    sellingTotal: 1600,
    ownershipType: WorkOwnershipType.CUSTOMER_SHARED,
    responsiblePartnerId: 'SHOP',
    accountingStatus: 'CONSUMED',
    createdAt: new Date().toISOString()
  };

  const mockInvoice: Invoice = {
    id: 'INV-101',
    orderId: 'ORD-999',
    items: [{ name: 'دفعة صيانة', quantity: 1, price: 500 }],
    totalAmount: 500,
    discount: 0,
    paidAmount: 500,
    paymentMethod: 'CASH',
    date: new Date().toISOString(),
    type: 'repair',
    isPaid: true
  };

  // Test 1: Refuse deletion if already delivered
  const deliveredOrder: RepairOrder = { ...mockOrder, status: RepairStatus.Delivered, deliveryStatus: 'DELIVERED' };
  const resDelivered = await executeDeleteRepairOrderTransaction({
    orderId: deliveredOrder.id,
    selectedOrder: deliveredOrder,
    products: [mockProduct],
    partUsages: [mockUsage],
    invoices: [mockInvoice]
  });

  if (resDelivered.success) {
    throw new Error("❌ Test 1 Failed: Should refuse deleting a delivered order.");
  }
  console.log("✅ Test 1 Passed: Refuses deleting delivered order.");

  // Test 2: Successful pre-delivery deletion and inventory restore
  const resPreDelivery = await executeDeleteRepairOrderTransaction({
    orderId: mockOrder.id,
    selectedOrder: mockOrder,
    products: [{ ...mockProduct }],
    partUsages: [{ ...mockUsage }],
    invoices: [{ ...mockInvoice }]
  });

  if (!resPreDelivery.success) {
    throw new Error(`❌ Test 2 Failed: ${resPreDelivery.error}`);
  }

  const updatedProd = resPreDelivery.updatedProducts?.find(p => p.id === 'PROD-101');
  if (!updatedProd || updatedProd.quantity !== 7) { // 5 + 2 = 7
    throw new Error(`❌ Test 2 Failed: Expected stock 7, got ${updatedProd?.quantity}`);
  }

  const updatedUsage = resPreDelivery.updatedPartUsages?.find(pu => pu.id === 'PU-101');
  if (!updatedUsage || updatedUsage.accountingStatus !== 'RETURNED') {
    throw new Error(`❌ Test 2 Failed: Usage accountingStatus should be RETURNED`);
  }

  console.log("✅ Test 2 Passed: Successfully restored stock (+2) and marked usage RETURNED.");
  console.log("🎉 All RepairOrderDeleteService tests passed successfully!");
}

runTests().catch(err => {
  console.error("❌ Test suite failed:", err);
  process.exit(1);
});
