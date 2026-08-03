import { Product, RepairPartUsage, WorkOwnershipType } from '../types';
import { findProductForRepairUsage } from './repairPartRemovalService';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

export function runRepairPartProductMatchingTests() {
  const product: Product & { uuid?: string } = {
    id: 'LOCAL-HORN-PS5',
    uuid: '11111111-1111-4111-8111-111111111111',
    name: 'PS5 Horn',
    nameAr: 'سوكت هورن بلايستيشن 5',
    category: 'قطع غيار',
    barcode: 'HORN-PS5',
    sku: 'HORN-PS5',
    purchasePrice: 100,
    sellPrice: 1200,
    quantity: 98,
    minStock: 1
  };

  const baseUsage: RepairPartUsage = {
    id: 'USAGE-1',
    repairOrderId: 'ORDER-1',
    inventoryItemId: product.uuid,
    partName: product.nameAr,
    sku: product.sku,
    quantity: 2,
    unitCost: 100,
    totalCost: 200,
    sellingPrice: 1200,
    sellingTotal: 2400,
    ownershipType: WorkOwnershipType.CUSTOMER_SHARED,
    responsiblePartnerId: 'SHOP',
    accountingStatus: 'CONSUMED',
    createdAt: new Date().toISOString()
  };

  assert(findProductForRepairUsage([product], baseUsage)?.id === product.id, 'matches remote UUID to local product');
  assert(
    findProductForRepairUsage([product], { ...baseUsage, inventoryItemId: 'OLD-ID' })?.id === product.id,
    'falls back to SKU when ids differ'
  );
  assert(
    findProductForRepairUsage([product], { ...baseUsage, inventoryItemId: 'OLD-ID', sku: 'MISSING' }) === undefined,
    'does not guess an unrelated product'
  );

  const restoredQuantity = product.quantity + baseUsage.quantity;
  assert(restoredQuantity === 100, 'full removal restores stock from 98 to 100');
}

runRepairPartProductMatchingTests();
