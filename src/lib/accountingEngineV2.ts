import type {
  Invoice,
  InventoryMovement,
  RepairOrder,
  RepairPartUsage,
  RepairDevice,
  SelectedRepairItem
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

export function orderIdentitySet(order: RepairOrder): Set<string> {
  const anyOrder = order as any;
  return new Set(
    [order.id, anyOrder.orderNumber, anyOrder.order_number, order.uuid, order.databaseId, anyOrder.uuid, anyOrder.databaseId]
      .map(clean)
      .filter(Boolean)
  );
}

export function valueMatchesOrder(value: unknown, order: RepairOrder): boolean {
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

export function usageMatchesOrder(usage: RepairPartUsage, order: RepairOrder): boolean {
  return valueMatchesOrder(usage.repairOrderId, order);
}

export function usageMatchesDevice(
  usage: RepairPartUsage,
  device: RepairDevice,
  deviceIdx: number,
  totalDevices: number
): boolean {
  if (totalDevices === 1) return true;
  const notes = usage.notes || '';
  if (device.id && notes.includes(`deviceId:${device.id}`)) {
    return true;
  }
  if (notes.includes(`deviceId:${deviceIdx}`)) {
    return true;
  }
  if (!notes.includes('deviceId:') && deviceIdx === 0) {
    return true;
  }
  return false;
}

export function syncOrderSelectedRepairItemsFromUsages(
  order: RepairOrder,
  usages: RepairPartUsage[],
  getSellingPriceFn?: (pu: RepairPartUsage) => number
): RepairOrder {
  if (!order || !order.devices || order.devices.length === 0) return order;

  const activeUsages = (usages || []).filter(
    pu => usageMatchesOrder(pu, order) &&
          pu.accountingStatus !== 'RETURNED' &&
          pu.accountingStatus !== 'REVERSED'
  );

  let changed = false;
  const updatedDevices = order.devices.map((device, devIdx) => {
    const deviceUsages = activeUsages.filter(pu =>
      usageMatchesDevice(pu, device, devIdx, order.devices.length)
    );

    const rebuiltItems: SelectedRepairItem[] = deviceUsages.map(pu => {
      const sellP = getSellingPriceFn ? getSellingPriceFn(pu) : (pu.sellingPrice || pu.unitCost || 0);
      return {
        id: pu.id,
        usageId: pu.id,
        productId: pu.inventoryItemId,
        name: pu.partName,
        quantity: pu.quantity,
        costPrice: pu.unitCost,
        repairPrice: sellP,
        salePrice: sellP,
        deviceId: device.id,
        deviceIndex: devIdx
      };
    });

    const calcPartsCost = deviceUsages.reduce((sum, pu) => {
      const sellP = getSellingPriceFn ? getSellingPriceFn(pu) : (pu.sellingPrice || pu.unitCost || 0);
      return sum + (pu.quantity * sellP);
    }, 0);

    const existingItems = device.selectedRepairItems || [];

    const isStale =
      rebuiltItems.length !== existingItems.length ||
      Number(device.partsCost || 0) !== calcPartsCost ||
      rebuiltItems.some((item, i) => {
        const ext = existingItems[i];
        if (!ext) return true;
        return (
          ext.usageId !== item.usageId ||
          ext.id !== item.id ||
          ext.quantity !== item.quantity ||
          ext.repairPrice !== item.repairPrice ||
          ext.costPrice !== item.costPrice
        );
      });

    if (isStale) {
      changed = true;
      return {
        ...device,
        selectedRepairItems: rebuiltItems,
        partsCost: calcPartsCost
      };
    }

    return device;
  });

  if (!changed) return order;

  const totalFinal = updatedDevices.reduce((sum, d) => sum + (d.finalRepairPrice ?? d.estimatedCost ?? 0), 0);

  return {
    ...order,
    devices: updatedDevices,
    totalEstimatedCost: totalFinal,
    finalRepairPrice: totalFinal
  };
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
  return Math.max(1, Number(item?.quantity ?? item?.qty ?? item?.partsQuantity ?? item?.parts_quantity ?? 1) || 1);
}

function explicitItemPurchaseUnitCost(item: any): number | null {
  return positiveNumber(
    item?.costPrice,
    item?.purchaseCost,
    item?.purchase_cost,
    item?.unitCost,
    item?.unit_cost,
    item?.purchaseUnitCost,
    item?.purchase_unit_cost_snapshot,
    item?.defaultCostPrice
  );
}

function explicitDevicePurchaseCost(device: any): number | null {
  return positiveNumber(
    device?.partsPurchaseCost,
    device?.purchaseCost,
    device?.purchase_cost,
    device?.parts_purchase_cost,
    device?.partsCostPrice,
    device?.parts_cost_price,
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
      ...(Array.isArray(device.parts) ? device.parts : [])
    ];

    const explicitItems = rawItems
      .map((item: any, itemIndex: number) => {
        const unitCost = explicitItemPurchaseUnitCost(item);
        if (!unitCost) return null;
        const quantity = explicitItemQuantity(item);
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
    const arrays = [device.selectedRepairItems, device.repairItems, device.items, device.parts];
    const hasItems = arrays.some(items => Array.isArray(items) && items.length > 0);
    return hasItems || Number(device.partsCost || 0) > 0 || explicitDevicePurchaseCost(device) !== null;
  });
}

export function resolveOrderPartsAccounting(
  order: RepairOrder,
  movements: InventoryMovement[],
  usages: RepairPartUsage[]
): Pick<OrderAccountingV2, 'purchaseCost' | 'partsQuantity' | 'parts' | 'costSource' | 'purchaseCostStatus' | 'isAccountingIncomplete'> {
  const allOrderUsages = (usages || []).filter(usage => usageMatchesOrder(usage, order));
  if (allOrderUsages.length > 0) {
    const linkedUsages = allOrderUsages.filter(usage => isActiveUsage(usage));
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
      return {
        parts,
        purchaseCost: money(parts.reduce((sum, part) => sum + part.totalPurchaseCost, 0)),
        partsQuantity: parts.reduce((sum, part) => sum + part.quantity, 0),
        costSource: 'REPAIR_PART_USAGES',
        purchaseCostStatus: 'RECORDED',
        isAccountingIncomplete: false
      };
    } else {
      // All usages for this order were RETURNED
      return {
        parts: [],
        purchaseCost: 0,
        partsQuantity: 0,
        costSource: 'REPAIR_PART_USAGES',
        purchaseCostStatus: 'NO_PARTS',
        isAccountingIncomplete: false
      };
    }
  }

  const allOrderMovements = (movements || []).filter(m => movementMatchesOrder(m, order));
  const linkedMovements = allOrderMovements.filter(m => isOutgoingMovement(m));

  if (linkedMovements.length > 0) {
    const returnMovements = allOrderMovements.filter(m => {
      const type = upper(m.movementType ?? (m as any).movement_type);
      return type === 'RETURN' || (m as any).usageType === 'REPAIR_USAGE_RETURN' || type === 'IN';
    });

    const returnQty = returnMovements.reduce((sum, m) => sum + Math.abs(Number(m.quantityChange ?? (m as any).quantity_change ?? 0)), 0);
    const outgoingQty = linkedMovements.reduce((sum, m) => sum + Math.abs(Number(m.quantityChange ?? (m as any).quantity_change ?? 0)), 0);

    if (returnQty >= outgoingQty && outgoingQty > 0) {
      return {
        parts: [],
        purchaseCost: 0,
        partsQuantity: 0,
        costSource: 'INVENTORY_MOVEMENTS',
        purchaseCostStatus: 'NO_PARTS',
        isAccountingIncomplete: false
      };
    }

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
    return {
      parts,
      purchaseCost: money(parts.reduce((sum, part) => sum + part.totalPurchaseCost, 0)),
      partsQuantity: parts.reduce((sum, part) => sum + part.quantity, 0),
      costSource: 'INVENTORY_MOVEMENTS',
      purchaseCostStatus: 'RECORDED',
      isAccountingIncomplete: false
    };
  }

  const parts = legacyDeviceDetails(order);
  if (parts.length > 0) {
    const source = parts.some(part => part.source === 'LEGACY_ITEM') ? 'LEGACY_ITEMS' : 'LEGACY_DEVICE';
    return {
      parts,
      purchaseCost: money(parts.reduce((sum, part) => sum + part.totalPurchaseCost, 0)),
      partsQuantity: parts.reduce((sum, part) => sum + part.quantity, 0),
      costSource: source,
      purchaseCostStatus: 'RECORDED',
      isAccountingIncomplete: false
    };
  }

  if (hasPartEvidence(order)) {
    return {
      parts: [], purchaseCost: 0, partsQuantity: 0, costSource: 'NONE',
      purchaseCostStatus: 'UNKNOWN_LEGACY_COST', isAccountingIncomplete: true
    };
  }

  return {
    parts: [], purchaseCost: 0, partsQuantity: 0, costSource: 'NONE',
    purchaseCostStatus: 'NO_PARTS', isAccountingIncomplete: false
  };
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
    amountDueFromAbdo: party === 'ABDO' ? ahmedShare : 0,
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
