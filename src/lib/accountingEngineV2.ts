import type {
  Invoice,
  InventoryMovement,
  RepairOrder,
  RepairPartUsage
} from '../types';

export type AccountingParty = 'SHOP' | 'AHMED' | 'ABDO';
export type PurchaseCostStatus = 'RECORDED' | 'NO_PARTS' | 'UNKNOWN_LEGACY_COST';

export interface AccountingPartDetail {
  id: string;
  partName: string;
  quantity: number;
  unitPurchaseCost: number;
  totalPurchaseCost: number;
  source: 'INVENTORY_MOVEMENT' | 'REPAIR_PART_USAGE' | 'LEGACY_ITEM' | 'LEGACY_DEVICE';
}

export interface OrderAccountingV2 {
  orderId: string;
  orderNumber: string;
  date: string;
  customerName: string;
  party: AccountingParty;
  workLabel: string;
  revenue: number;
  purchaseCost: number;
  netProfit: number;
  ahmedShare: number;
  abdoShare: number;
  amountDueFromAbdo: number;
  partsQuantity: number;
  parts: AccountingPartDetail[];
  costSource: 'INVENTORY_MOVEMENTS' | 'REPAIR_PART_USAGES' | 'LEGACY_ITEMS' | 'LEGACY_DEVICE' | 'NONE';
  purchaseCostStatus: PurchaseCostStatus;
  isAccountingIncomplete: boolean;
  sourceOrder: RepairOrder;
}

export interface AccountingSummaryV2 {
  rows: OrderAccountingV2[];
  completeRows: OrderAccountingV2[];
  incompleteRows: OrderAccountingV2[];
  totalOrders: number;
  totalRevenue: number;
  finalizedRevenue: number;
  pendingRevenue: number;
  totalPurchaseCost: number;
  totalNetProfit: number;
  totalAhmedShare: number;
  totalAbdoShare: number;
  totalAmountDueFromAbdo: number;
  totalPartsQuantity: number;
}

export interface DirectSalesAccountingV2 {
  revenue: number;
  purchaseCost: number;
  grossProfit: number;
}

const money = (value: unknown): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
};

const clean = (value: unknown): string => String(value ?? '').trim();
const upper = (value: unknown): string => clean(value).toUpperCase();

let lastMovementsAvailable = false;
let lastUsagesAvailable = false;

function orderIdentitySet(order: RepairOrder): Set<string> {
  const anyOrder = order as any;
  return new Set(
    [order.id, anyOrder.orderNumber, anyOrder.order_number, anyOrder.uuid, anyOrder.databaseId]
      .map(clean)
      .filter(Boolean)
  );
}

function valueMatchesOrder(value: unknown, order: RepairOrder): boolean {
  const target = clean(value);
  return Boolean(target) && orderIdentitySet(order).has(target);
}

function productNameFromMovement(movement: any): string {
  return clean(
    movement.productNameSnapshot ??
      movement.product_name_snapshot ??
      movement.partName ??
      movement.sku ??
      movement.notes ??
      'صنف غير معروف'
  );
}

function isActiveUsage(usage: RepairPartUsage): boolean {
  return usage.accountingStatus !== 'RETURNED' && usage.accountingStatus !== 'REVERSED';
}

function isOutgoingMovement(movement: any): boolean {
  const type = upper(movement.movementType ?? movement.movement_type);
  const qty = Number(movement.quantityChange ?? movement.quantity_change ?? 0);
  if (['RETURN', 'IN', 'DELETION_RESTORE', 'PURCHASE'].includes(type)) return false;
  return ['REPAIR_USAGE', 'PARTNER_WITHDRAWAL', 'OUT', 'SALE'].includes(type) || qty < 0;
}

function movementMatchesOrder(movement: any, order: RepairOrder): boolean {
  return [
    movement.repairOrderId,
    movement.repair_order_id,
    movement.referenceId,
    movement.reference_id,
    movement.orderId,
    movement.order_id
  ].some(value => valueMatchesOrder(value, order));
}

function usageMatchesOrder(usage: RepairPartUsage, order: RepairOrder): boolean {
  return valueMatchesOrder(usage.repairOrderId, order);
}

export function normalizeAccountingParty(raw: unknown): AccountingParty {
  const value = upper(raw);
  if (['AHMED', 'AHMED_WORK', 'P-001', 'P1', 'PARTNER_1', 'PARTNER_1_PRIVATE'].includes(value)) return 'AHMED';
  if (['ABDO', 'ABDOU', 'ABDO_WORK', 'P-002', 'P2', 'PARTNER_2', 'PARTNER_2_PRIVATE'].includes(value)) return 'ABDO';
  return 'SHOP';
}

export function resolveOrderParty(order: RepairOrder): AccountingParty {
  const anyOrder = order as any;
  return normalizeAccountingParty(
    anyOrder.jobType ??
      order.workOwnershipType ??
      anyOrder.work_owner ??
      anyOrder.ownershipType ??
      anyOrder.responsiblePartnerId
  );
}

function resolveInvoiceRevenue(order: RepairOrder, invoices: Invoice[]): number {
  const matchingInvoices = (invoices || []).filter(invoice => {
    if (invoice.isCancelled) return false;
    if (invoice.type && invoice.type !== 'repair') return false;
    return valueMatchesOrder(invoice.orderId, order);
  });

  if (matchingInvoices.length > 0) {
    return money(matchingInvoices.reduce((sum, invoice) => {
      const finalTotal = Math.max(0, (Number(invoice.totalAmount) || 0) - (Number(invoice.discount) || 0));
      return sum + finalTotal;
    }, 0));
  }

  const anyOrder = order as any;
  const gross = Number(order.finalRepairPrice ?? order.totalEstimatedCost ?? anyOrder.final_cost ?? 0) || 0;
  const discount = Number(order.discount ?? anyOrder.discount_amount ?? 0) || 0;
  return money(Math.max(0, gross - discount));
}

function movementCost(movement: any): { quantity: number; unitCost: number; totalCost: number } {
  const rawQty = Math.abs(Number(movement.quantityChange ?? movement.quantity_change ?? movement.quantity ?? 0));
  const quantity = Number.isFinite(rawQty) ? rawQty : 0;
  const unitCost = money(
    movement.costPriceSnapshot ??
      movement.cost_price_snapshot ??
      movement.unitCostSnapshot ??
      movement.unit_cost_snapshot ??
      movement.unitCost ??
      0
  );
  const explicitTotal = Number(movement.totalCost ?? movement.total_cost);
  const totalCost = Number.isFinite(explicitTotal) && explicitTotal >= 0
    ? money(explicitTotal)
    : money(quantity * unitCost);
  return { quantity, unitCost, totalCost };
}

function positiveNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return money(n);
  }
  return null;
}

function explicitItemQuantity(item: any): number {
  const qty = Number(item?.quantity ?? item?.qty ?? item?.partsQuantity ?? item?.parts_quantity ?? item?.itemQuantity ?? item?.item_quantity);
  if (Number.isFinite(qty) && qty > 0) return qty;
  // default to 1 only when a valid purchase-cost field exists
  const hasCost = explicitItemPurchaseUnitCost(item) !== null;
  return hasCost ? 1 : 0;
}

function explicitItemPurchaseUnitCost(item: any): number | null {
  // Only resolve from approved fields per requirements
  return positiveNumber(
    item?.costPrice,
    item?.purchaseCost,
    item?.purchase_cost,
    item?.purchase_unit_cost_snapshot,
    item?.partsPurchaseCost
  );
}

function explicitDevicePurchaseCost(device: any): number | null {
  // Only resolve device-level purchase cost from approved fields
  return positiveNumber(
    device?.partsPurchaseCost,
    device?.purchaseCost,
    device?.purchase_cost,
    device?.purchase_unit_cost_snapshot
  );
}

function legacyDeviceDetails(order: RepairOrder): AccountingPartDetail[] {
  const rows: AccountingPartDetail[] = [];

  (order.devices || []).forEach((device: any, deviceIndex: number) => {
    const rawItems = [
      ...(Array.isArray(device.selectedRepairItems) ? device.selectedRepairItems : []),
      ...(Array.isArray(device.repairItems) ? device.repairItems : []),
      ...(Array.isArray(device.items) ? device.items : []),
      ...(Array.isArray(device.parts) ? device.parts : []),
      ...(Array.isArray(device.technicalProcedures) ? device.technicalProcedures : [])
    ];

    const explicitItems = rawItems
      .map((item: any, itemIndex: number) => {
        const unitCost = explicitItemPurchaseUnitCost(item);
        if (!unitCost) return null;
        const quantity = explicitItemQuantity(item);
        if (!Number.isFinite(quantity) || quantity <= 0) return null;
        return {
          id: clean(item?.id) || `legacy-item-${order.id}-${deviceIndex}-${itemIndex}`,
          partName: clean(item?.name ?? item?.nameAr ?? item?.label ?? item?.sku) || 'قطعة غيار قديمة',
          quantity,
          unitPurchaseCost: unitCost,
          totalPurchaseCost: money(quantity * unitCost),
          source: 'LEGACY_ITEM' as const
        };
      })
      .filter(Boolean) as AccountingPartDetail[];

    if (explicitItems.length > 0) {
      rows.push(...explicitItems);
      return;
    }

    const devicePurchaseCost = explicitDevicePurchaseCost(device);
    if (devicePurchaseCost) {
      const quantity = Math.max(0, Number(
        device.partsQuantity ?? device.quantity ?? device.parts_quantity ?? device.itemQuantity ?? device.item_quantity ?? device.qty ?? 0
      ) || 0);
      rows.push({
        id: `legacy-device-${order.id}-${deviceIndex}`,
        partName: `تكلفة شراء قطع جهاز ${device.model || device.type || deviceIndex + 1}`,
        quantity,
        unitPurchaseCost: quantity > 0 ? money(devicePurchaseCost / quantity) : devicePurchaseCost,
        totalPurchaseCost: devicePurchaseCost,
        source: 'LEGACY_DEVICE'
      });
    }
  });

  return rows;
}

function hasPartEvidence(order: RepairOrder): boolean {
  return (order.devices || []).some((device: any) => {
    const arrays = [device.selectedRepairItems, device.repairItems, device.items, device.parts, device.technicalProcedures];
    const hasItems = arrays.some(items => Array.isArray(items) && items.length > 0);
    return hasItems || explicitDevicePurchaseCost(device) !== null;
  });
}

export function resolveOrderPartsAccounting(
  order: RepairOrder,
  movements: InventoryMovement[],
  usages: RepairPartUsage[]
): Pick<OrderAccountingV2, 'purchaseCost' | 'partsQuantity' | 'parts' | 'costSource' | 'purchaseCostStatus' | 'isAccountingIncomplete'> {
  const traceOrderId = (order as any)?.id;
  const traceOrderNumber = (order as any)?.orderNumber ?? (order as any)?.order_number;

  // Temporary: JSON logging for order ATR-10001
  if (traceOrderId === 'ATR-10001' || traceOrderNumber === 'ATR-10001') {
    console.log(
      'ORDER_PAYLOAD_JSON=' +
      JSON.stringify({
        order,
        orderKeys: Object.keys(order || {}),
        devices: order?.devices || [],
        deviceKeys: (order?.devices || []).map(d => Object.keys(d || {}))
      })
    );
  }

  const printTrace = (props: { purchaseCost: unknown; purchaseCostStatus: unknown; costSource: unknown }) => {
    const legacyParts = legacyDeviceDetails(order);
    const linkedMovementsCount = ((movements || []).filter(m => isOutgoingMovement(m) && movementMatchesOrder(m, order))).length;
    const linkedUsagesCount = ((usages || []).filter(u => isActiveUsage(u) && usageMatchesOrder(u, order))).length;
    console.log('========================');
    console.log(`ORDER: ${traceOrderNumber}`);
    console.log('orderId:');
    console.log(JSON.stringify(traceOrderId, null, 2));
    console.log('hasPartEvidence:');
    console.log(JSON.stringify(hasPartEvidence(order), null, 2));
    console.log('linkedMovements:');
    console.log(JSON.stringify(linkedMovementsCount, null, 2));
    console.log('linkedUsages:');
    console.log(JSON.stringify(linkedUsagesCount, null, 2));
    console.log('legacyParts:');
    console.log(JSON.stringify(legacyParts, null, 2));
    console.log('purchaseCost:');
    console.log(JSON.stringify(props.purchaseCost, null, 2));
    console.log('purchaseCostStatus:');
    console.log(JSON.stringify(props.purchaseCostStatus, null, 2));
    console.log('costSource:');
    console.log(JSON.stringify(props.costSource, null, 2));
    console.log('========================');
  };

  const linkedMovements = (movements || []).filter(
    movement => isOutgoingMovement(movement) && movementMatchesOrder(movement, order)
  );

  // linkedMovements count will be included in the final trace

  if (linkedMovements.length > 0) {
    const parts = linkedMovements.map((movement: any, index) => {
      const cost = movementCost(movement);
      return {
        id: clean(movement.id) || `movement-${order.id}-${index}`,
        partName: productNameFromMovement(movement),
        quantity: cost.quantity,
        unitPurchaseCost: cost.unitCost,
        totalPurchaseCost: cost.totalCost,
        source: 'INVENTORY_MOVEMENT' as const
      };
    });
    const result = {
      parts,
      purchaseCost: money(parts.reduce((sum, part) => sum + part.totalPurchaseCost, 0)),
      partsQuantity: parts.reduce((sum, part) => sum + part.quantity, 0),
      costSource: 'INVENTORY_MOVEMENTS' as const,
      purchaseCostStatus: 'RECORDED' as const,
      isAccountingIncomplete: false
    };
    printTrace({ purchaseCost: result.purchaseCost, purchaseCostStatus: result.purchaseCostStatus, costSource: result.costSource });
    return result;
  }

  const linkedUsages = (usages || []).filter(usage => isActiveUsage(usage) && usageMatchesOrder(usage, order));
  // linkedUsages count will be included in the final trace
  if (linkedUsages.length > 0) {
    const parts = linkedUsages.map((usage, index) => {
      const quantity = Math.max(0, Number(usage.quantity) || 0);
      const unitCost = money(usage.unitCost || 0);
      const explicitTotal = Number(usage.totalCost);
      return {
        id: clean(usage.id) || `usage-${order.id}-${index}`,
        partName: clean(usage.partName) || clean(usage.sku) || 'صنف غير معروف',
        quantity,
        unitPurchaseCost: unitCost,
        totalPurchaseCost: Number.isFinite(explicitTotal) && explicitTotal >= 0 ? money(explicitTotal) : money(quantity * unitCost),
        source: 'REPAIR_PART_USAGE' as const
      };
    });
    const result = {
      parts,
      purchaseCost: money(parts.reduce((sum, part) => sum + part.totalPurchaseCost, 0)),
      partsQuantity: parts.reduce((sum, part) => sum + part.quantity, 0),
      costSource: 'REPAIR_PART_USAGES' as const,
      purchaseCostStatus: 'RECORDED' as const,
      isAccountingIncomplete: false
    };
    printTrace({ purchaseCost: result.purchaseCost, purchaseCostStatus: result.purchaseCostStatus, costSource: result.costSource });
    return result;
  }

  const parts = legacyDeviceDetails(order);
  if (parts.length > 0) {
    const source = parts.some(part => part.source === 'LEGACY_ITEM') ? 'LEGACY_ITEMS' : 'LEGACY_DEVICE';
    const result = {
      parts,
      purchaseCost: money(parts.reduce((sum, part) => sum + part.totalPurchaseCost, 0)),
      partsQuantity: parts.reduce((sum, part) => sum + part.quantity, 0),
      costSource: source as const,
      purchaseCostStatus: 'RECORDED' as const,
      isAccountingIncomplete: false
    };
    printTrace({ purchaseCost: result.purchaseCost, purchaseCostStatus: result.purchaseCostStatus, costSource: result.costSource });
    return result;
  }

  const purchaseCostBeforeFallback = money(parts.reduce((sum, part) => sum + part.totalPurchaseCost, 0));
  const hasEvidence = hasPartEvidence(order);
  if (hasEvidence) {
    const result = {
      parts: [], purchaseCost: 0, partsQuantity: 0, costSource: 'NONE' as const,
      purchaseCostStatus: 'UNKNOWN_LEGACY_COST' as const, isAccountingIncomplete: true
    };
    printTrace({ purchaseCost: purchaseCostBeforeFallback, purchaseCostStatus: result.purchaseCostStatus, costSource: result.costSource });
    return result;
  }

  const finalResult = {
    parts: [], purchaseCost: 0, partsQuantity: 0, costSource: 'NONE' as const,
    purchaseCostStatus: 'NO_PARTS' as const, isAccountingIncomplete: false
  };
  printTrace({ purchaseCost: finalResult.purchaseCost, purchaseCostStatus: finalResult.purchaseCostStatus, costSource: finalResult.costSource });
  return finalResult;
}

export function calculateOrderAccountingV2(
  order: RepairOrder,
  invoices: Invoice[],
  movements: InventoryMovement[],
  usages: RepairPartUsage[]
): OrderAccountingV2 {
  const party = resolveOrderParty(order);
  const revenue = resolveInvoiceRevenue(order, invoices || []);
  const partsAccounting = resolveOrderPartsAccounting(order, movements || [], usages || []);
  const purchaseCost = partsAccounting.purchaseCost;
  const netProfit = partsAccounting.isAccountingIncomplete ? 0 : money(revenue - purchaseCost);

  let ahmedShare = 0;
  let abdoShare = 0;
  if (!partsAccounting.isAccountingIncomplete) {
    if (party === 'AHMED') ahmedShare = netProfit;
    else if (party === 'ABDO') {
      ahmedShare = money(netProfit * 0.25);
      abdoShare = money(netProfit * 0.75);
    } else {
      ahmedShare = money(netProfit * 0.5);
      abdoShare = money(netProfit * 0.5);
    }
  }

  const anyOrder = order as any;
  return {
    orderId: order.id,
    orderNumber: clean(anyOrder.orderNumber ?? anyOrder.order_number ?? order.id),
    date: clean(order.receivedDate ?? anyOrder.created_at ?? anyOrder.createdAt),
    customerName: clean(order.customerNameSnapshot ?? order.guestCustomerName ?? order.customerName ?? anyOrder.customer_name) || 'عميل نقدي',
    party,
    workLabel: party === 'AHMED' ? 'شغل أحمد' : party === 'ABDO' ? 'شغل عبده' : 'شغل المحل',
    revenue,
    purchaseCost,
    netProfit,
    ahmedShare,
    abdoShare,
    amountDueFromAbdo: party === 'ABDO' ? money(purchaseCost + ahmedShare) : 0,
    partsQuantity: partsAccounting.partsQuantity,
    parts: partsAccounting.parts,
    costSource: partsAccounting.costSource,
    purchaseCostStatus: partsAccounting.purchaseCostStatus,
    isAccountingIncomplete: partsAccounting.isAccountingIncomplete,
    sourceOrder: order
  };
}

export function calculateAccountingSummaryV2(rows: OrderAccountingV2[]): AccountingSummaryV2 {
  const completeRows = rows.filter(row => !row.isAccountingIncomplete);
  const incompleteRows = rows.filter(row => row.isAccountingIncomplete);
  return {
    rows,
    completeRows,
    incompleteRows,
    totalOrders: rows.length,
    totalRevenue: money(rows.reduce((sum, row) => sum + row.revenue, 0)),
    finalizedRevenue: money(completeRows.reduce((sum, row) => sum + row.revenue, 0)),
    pendingRevenue: money(incompleteRows.reduce((sum, row) => sum + row.revenue, 0)),
    totalPurchaseCost: money(completeRows.reduce((sum, row) => sum + row.purchaseCost, 0)),
    totalNetProfit: money(completeRows.reduce((sum, row) => sum + row.netProfit, 0)),
    totalAhmedShare: money(completeRows.reduce((sum, row) => sum + row.ahmedShare, 0)),
    totalAbdoShare: money(completeRows.reduce((sum, row) => sum + row.abdoShare, 0)),
    totalAmountDueFromAbdo: money(completeRows.reduce((sum, row) => sum + row.amountDueFromAbdo, 0)),
    totalPartsQuantity: completeRows.reduce((sum, row) => sum + row.partsQuantity, 0)
  };
}

export function buildAccountingSummaryV2(input: {
  orders: RepairOrder[];
  invoices?: Invoice[];
  movements?: InventoryMovement[];
  usages?: RepairPartUsage[];
}): AccountingSummaryV2 {
  const currentMovementsAvailable = Array.isArray(input.movements);
  const currentUsagesAvailable = Array.isArray(input.usages);
  const recomputedAfterLoad = (!lastMovementsAvailable && currentMovementsAvailable) || (!lastUsagesAvailable && currentUsagesAvailable);
  lastMovementsAvailable = currentMovementsAvailable;
  lastUsagesAvailable = currentUsagesAvailable;

  console.log(
    'ACCOUNTING_SUMMARY_TRACE=' +
    JSON.stringify({
      ordersLength: (input.orders || []).length,
      inventoryMovementsLength: (input.movements || []).length ?? 0,
      repairPartUsagesLength: (input.usages || []).length ?? 0,
      recomputedAfterLoad
    })
  );

  return calculateAccountingSummaryV2((input.orders || []).map(order =>
    calculateOrderAccountingV2(order, input.invoices || [], input.movements || [], input.usages || [])
  ));
}

export function calculateDirectSalesAccountingV2(invoices: Invoice[]): DirectSalesAccountingV2 {
  const sales = (invoices || []).filter(invoice => !invoice.isCancelled && invoice.type !== 'repair');
  const revenue = money(sales.reduce((sum, invoice) => sum + Math.max(0, (Number(invoice.totalAmount) || 0) - (Number(invoice.discount) || 0)), 0));
  const purchaseCost = money(sales.reduce((sum, invoice) => sum + (invoice.items || []).reduce((itemSum, item) => {
    return itemSum + Math.max(0, Number(item.quantity) || 0) * Math.max(0, Number(item.costPrice) || 0);
  }, 0), 0));
  return { revenue, purchaseCost, grossProfit: money(revenue - purchaseCost) };
}
