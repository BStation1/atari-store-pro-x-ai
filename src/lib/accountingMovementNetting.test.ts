import type { InventoryMovement, RepairOrder } from '../types';
import { resolveOrderPartsAccounting } from './accountingEngineV2';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const order = {
  id: 'ATR-NET-1',
  orderNumber: 'ATR-NET-1',
  devices: [],
  receivedDate: new Date().toISOString()
} as unknown as RepairOrder;

const movement = (
  id: string,
  productId: string,
  name: string,
  movementType: 'REPAIR_USAGE' | 'RETURN',
  quantityChange: number,
  unitCost: number
): InventoryMovement => ({
  id,
  productId,
  productNameSnapshot: name,
  movementType,
  usageType: movementType === 'RETURN' ? 'REPAIR_USAGE_RETURN' : undefined,
  quantityChange,
  previousQuantity: 0,
  newQuantity: 0,
  costPriceSnapshot: unitCost,
  sellingPriceSnapshot: 0,
  totalCost: Math.abs(quantityChange) * unitCost,
  referenceId: order.id,
  repairOrderId: order.id,
  createdAt: new Date().toISOString()
} as InventoryMovement);

const movements = [
  movement('OUT-HORN', 'UUID-HORN', 'سوكت هورن', 'REPAIR_USAGE', -2, 100),
  movement('OUT-USB', 'UUID-USB', 'سوكت يو اس بي', 'REPAIR_USAGE', -3, 50),
  movement('RETURN-HORN', 'LOCAL-HORN', 'سوكت هورن', 'RETURN', 1, 100),
  movement('RETURN-USB', 'LOCAL-USB', 'سوكت يو اس بي', 'RETURN', 3, 50)
];

const accounting = resolveOrderPartsAccounting(order, movements, []);
assert(accounting.partsQuantity === 1, 'returns are netted per product, not globally');
assert(accounting.purchaseCost === 100, 'remaining purchase cost is calculated from net quantity');
assert(accounting.parts.length === 1 && accounting.parts[0].partName === 'سوكت هورن', 'fully returned product is removed');

const fullyReturned = resolveOrderPartsAccounting(order, [
  movement('OUT-1', 'UUID-HORN', 'سوكت هورن', 'REPAIR_USAGE', -2, 100),
  movement('RETURN-1', 'LOCAL-HORN', 'سوكت هورن', 'RETURN', 2, 100)
], []);
assert(fullyReturned.partsQuantity === 0, 'full return leaves no accounting parts');
assert(fullyReturned.purchaseCostStatus === 'NO_PARTS', 'full return is reported as no parts');

// Production Supabase movements only retain productId + notes. OUT and RETURN
// notes differ, so they must net using the stable product identity.
const productionStyleMovements = [
  {
    ...movement('OUT-PROD', 'UUID-HDMI', '', 'REPAIR_USAGE', -1, 100),
    productNameSnapshot: undefined,
    notes: 'صرف قطعة غيار صيانة: HDMI للجهاز'
  },
  {
    ...movement('RETURN-PROD', 'UUID-HDMI', '', 'RETURN', 1, 100),
    productNameSnapshot: undefined,
    notes: 'إرجاع قطعة غيار صيانة للمخزن: HDMI'
  }
] as unknown as InventoryMovement[];
const productionStyle = resolveOrderPartsAccounting(order, productionStyleMovements, []);
assert(productionStyle.partsQuantity === 0, 'different OUT/RETURN notes net by product id');
assert(productionStyle.purchaseCost === 0, 'returned production movement leaves zero dashboard cost');
