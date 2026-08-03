import { executeAddPartUsageTransaction } from './repairPartAddService';
import { db } from './db';
import { DeviceType, Product, RepairOrder, RepairPartUsage, RepairStatus, WorkOwnershipType } from '../types';

const usb: Product = {
  id: 'PROD-USB-MULTI', name: 'USB', nameAr: 'USB', category: 'Parts',
  barcode: 'USB-MULTI', sku: 'USB-MULTI', quantity: 10, minStock: 1,
  purchasePrice: 250, sellPrice: 800
};
const hdmi: Product = {
  id: 'PROD-HDMI-MULTI', name: 'HDMI', nameAr: 'HDMI', category: 'Parts',
  barcode: 'HDMI-MULTI', sku: 'HDMI-MULTI', quantity: 10, minStock: 1,
  purchasePrice: 100, sellPrice: 1200
};
const existingUsb: RepairPartUsage = {
  id: 'PU-USB-MULTI', repairOrderId: 'ATR-MULTI', inventoryItemId: usb.id,
  partName: usb.name, sku: usb.sku, quantity: 1, unitCost: 250, totalCost: 250,
  sellingPrice: 800, sellingTotal: 800, ownershipType: WorkOwnershipType.CUSTOMER_SHARED,
  responsiblePartnerId: 'SHOP', accountingStatus: 'CONSUMED',
  notes: 'deviceId:DEV-MULTI', createdAt: new Date().toISOString()
};
const order = {
  id: 'ATR-MULTI',
  devices: [{
    id: 'DEV-MULTI', type: DeviceType.PS5, model: 'Fat', serialNumber: 'MULTI',
    color: '', accessories: '', issue: '', status: RepairStatus.Diagnosing,
    estimatedCost: 0, finalRepairPrice: 0, partsCost: 0, laborCost: 0,
    // Simulate the stale snapshot from a concurrent first add.
    selectedRepairItems: []
  }],
  totalEstimatedCost: 0, finalRepairPrice: 0, advancePayment: 0, isPaid: false,
  status: RepairStatus.Diagnosing, receivedDate: new Date().toISOString(),
  trackingToken: 'MULTI', workOwnershipType: WorkOwnershipType.CUSTOMER_SHARED
} as RepairOrder;

db.saveProducts([usb, hdmi]);
db.saveRepairPartUsages([existingUsb]);
db.saveRepairOrders([order]);

const result = await executeAddPartUsageTransaction({
  product: hdmi, deviceIdx: 0, qty: 1, selectedOrder: order,
  products: [usb, hdmi], partUsages: []
});
const items = result.updatedOrder?.devices[0].selectedRepairItems || [];
if (!result.success) throw new Error(result.error || 'multi-add failed');
if (items.length !== 2) throw new Error(`expected 2 visible items, got ${items.length}`);
if (!items.some(item => item.productId === usb.id) || !items.some(item => item.productId === hdmi.id)) {
  throw new Error('both canonical products must be visible');
}
if (result.updatedOrder?.finalRepairPrice !== 2000) {
  throw new Error(`expected total 2000, got ${result.updatedOrder?.finalRepairPrice}`);
}
console.log('✅ concurrent stale snapshot rebuilt with both canonical parts');
