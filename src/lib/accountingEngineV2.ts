import type {
  Invoice,
  InventoryMovement,
  RepairOrder,
  RepairPartUsage,
  WorkOwnershipType
} from '../types';

export type AccountingParty = 'SHOP' | 'AHMED' | 'ABDO';

export interface AccountingPartDetail {
  id: string;
  partName: string;
  quantity: number;
  unitPurchaseCost: number;
  totalPurchaseCost: number;
  source: 'INVENTORY_MOVEMENT' | 'REPAIR_PART_USAGE' | 'LEGACY_DEVICE';
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
  costSource: 'INVENTORY_MOVEMENTS' | 'REPAIR_PART_USAGES' | 'LEGACY_DEVICE' | 'NONE';
  sourceOrder: RepairOrder;
}

export interface AccountingSummaryV2 {
  rows: OrderAccountingV2[];
  totalOrders: number;
  totalRevenue: number;
  totalPurchaseCost: number;
  totalNetProfit: number;
  totalAhmedShare: number;
  totalAbdoShare: number;
  totalAmountDueFromAbdo: number;
  totalPartsQuantity: number;
}

const money = (value: unknown): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
};

const clean = (value: unknown): string => String(value ?? '').trim();
const upper = (value: unknown): string => clean(value).toUpperCase();

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
  if (['RETURN', 'IN', 'DELETION_RESTORE'].includes(type)) return false;
  return ['REPAIR_USAGE', 'PARTNER_WITHDRAWAL', 'OUT'].includes(type) || qty < 0;
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
  if (
    ['AHMED', 'AHMED_WORK', 'P-001', 'P1', 'PARTNER_1', 'PARTNER_1_PRIVATE'].includes(value)
  ) {
    return 'AHMED';
  }
  if (
    ['ABDO', 'ABDOU', 'ABDO_WORK', 'P-002', 'P2', 'PARTNER_2', 'PARTNER_2_PRIVATE'].includes(value)
  ) {
    return 'ABDO';
  }
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
  const matchingInvoices = invoices.filter(invoice => {
    if (invoice.isCancelled) return false;
    if (invoice.type && invoice.type !== 'repair') return false;
    return valueMatchesOrder(invoice.orderId, order) || valueMatchesOrder(invoice.id, order);
  });

  if (matchingInvoices.length > 0) {
    return money(
      matchingInvoices.reduce((sum, invoice) => {
        const total = Number(invoice.totalAmount) || 0;
        // totalAmount is treated as the final invoice total in this project.
        return sum + Math.max(0, total);
      }, 0)
    );
  }

  const anyOrder = order as any;
  const gross = Number(order.finalRepairPrice ?? order.totalEstimatedCost ?? anyOrder.final_cost ?? 0) || 0;
  const discount = Number(order.discount ?? anyOrder.discount_amount ?? 0) || 0;
  return money(Math.max(0, gross - discount));
}

function movementCost(movement: any): { quantity: number; unitCost: number; totalCost: number } {
  const quantity = Math.abs(Number(movement.quantityChange ?? movement.quantity_change ?? 0)) || 1;
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

function explicitDevicePurchaseCost(device: any): number | null {
  const candidates = [
    device.partsPurchaseCost,
    device.purchaseCost,
    device.purchase_cost,
    device.parts_purchase_cost,
    device.partsCostPrice,
    device.parts_cost_price
  ];
  for (const candidate of candidates) {
    const n = Number(candidate);
    if (Number.isFinite(n) && n > 0) return money(n);
  }
  return null;
}

function legacyDeviceDetails(order: RepairOrder): AccountingPartDetail[] {
  const rows: AccountingPartDetail[] = [];
  (order.devices || []).forEach((device: any, deviceIndex: number) => {
    const explicitPurchase = explicitDevicePurchaseCost(device);
    const legacyCost = explicitPurchase ?? money(device.partsCost || 0);
    if (legacyCost <= 0) return;

    const candidateItems = [
      ...(Array.isArray(device.selectedRepairItems) ? device.selectedRepairItems : []),
      ...(Array.isArray(device.technicalProcedures) ? device.technicalProcedures : [])
    ].filter((item: any) => Number(item?.costPrice) > 0);

    if (candidateItems.length > 0) {
      candidateItems.forEach((item: any, itemIndex: number) => {
        const quantity = Math.max(1, Number(item.quantity) || 1);
        const unitCost = money(item.costPrice || 0);
        rows.push({
          id: `legacy-${order.id}-${deviceIndex}-${itemIndex}`,
          partName: clean(item.name) || 'قطعة غيار قديمة',
          quantity,
          unitPurchaseCost: unitCost,
          totalPurchaseCost: money(quantity * unitCost),
          source: 'LEGACY_DEVICE'
        });
      });
      return;
    }

    rows.push({
      id: `legacy-${order.id}-${deviceIndex}`,
      partName: `تكلفة قطع جهاز ${device.model || device.type || deviceIndex + 1}`,
      // Legacy records often contain only a total purchase cost and no reliable quantity.
      quantity: 0,
      unitPurchaseCost: legacyCost,
      totalPurchaseCost: legacyCost,
      source: 'LEGACY_DEVICE'
    });
  });
  return rows;
}

export function resolveOrderPartsAccounting(
  order: RepairOrder,
  movements: InventoryMovement[],
  usages: RepairPartUsage[]
): Pick<OrderAccountingV2, 'purchaseCost' | 'partsQuantity' | 'parts' | 'costSource'> {
  const linkedMovements = (movements || []).filter(
    movement => isOutgoingMovement(movement) && movementMatchesOrder(movement, order)
  );

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
    return {
      parts,
      purchaseCost: money(parts.reduce((sum, part) => sum + part.totalPurchaseCost, 0)),
      partsQuantity: parts.reduce((sum, part) => sum + part.quantity, 0),
      costSource: 'INVENTORY_MOVEMENTS'
    };
  }

  const linkedUsages = (usages || []).filter(
    usage => isActiveUsage(usage) && usageMatchesOrder(usage, order)
  );

  if (linkedUsages.length > 0) {
    const parts = linkedUsages.map((usage, index) => {
      const quantity = Math.max(1, Number(usage.quantity) || 1);
      const unitCost = money(usage.unitCost || 0);
      const explicitTotal = Number(usage.totalCost);
      return {
        id: clean(usage.id) || `usage-${order.id}-${index}`,
        partName: clean(usage.partName) || clean(usage.sku) || 'صنف غير معروف',
        quantity,
        unitPurchaseCost: unitCost,
        totalPurchaseCost: Number.isFinite(explicitTotal) && explicitTotal >= 0
          ? money(explicitTotal)
          : money(quantity * unitCost),
        source: 'REPAIR_PART_USAGE' as const
      };
    });
    return {
      parts,
      purchaseCost: money(parts.reduce((sum, part) => sum + part.totalPurchaseCost, 0)),
      partsQuantity: parts.reduce((sum, part) => sum + part.quantity, 0),
      costSource: 'REPAIR_PART_USAGES'
    };
  }

  const parts = legacyDeviceDetails(order);
  if (parts.length > 0) {
    return {
      parts,
      purchaseCost: money(parts.reduce((sum, part) => sum + part.totalPurchaseCost, 0)),
      partsQuantity: parts.reduce((sum, part) => sum + part.quantity, 0),
      costSource: 'LEGACY_DEVICE'
    };
  }

  return { parts: [], purchaseCost: 0, partsQuantity: 0, costSource: 'NONE' };
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
  const netProfit = money(revenue - purchaseCost);

  let ahmedShare = 0;
  let abdoShare = 0;
  if (party === 'AHMED') {
    ahmedShare = netProfit;
  } else if (party === 'ABDO') {
    ahmedShare = money(netProfit * 0.25);
    abdoShare = money(netProfit * 0.75);
  } else {
    ahmedShare = money(netProfit * 0.5);
    abdoShare = money(netProfit * 0.5);
  }

  const anyOrder = order as any;
  return {
    orderId: order.id,
    orderNumber: clean(anyOrder.orderNumber ?? anyOrder.order_number ?? order.id),
    date: clean(order.receivedDate ?? anyOrder.created_at ?? anyOrder.createdAt),
    customerName: clean(order.customerNameSnapshot ?? order.guestCustomerName ?? anyOrder.customer_name) || 'عميل نقدي',
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
    sourceOrder: order
  };
}

export function calculateAccountingSummaryV2(rows: OrderAccountingV2[]): AccountingSummaryV2 {
  return {
    rows,
    totalOrders: rows.length,
    totalRevenue: money(rows.reduce((sum, row) => sum + row.revenue, 0)),
    totalPurchaseCost: money(rows.reduce((sum, row) => sum + row.purchaseCost, 0)),
    totalNetProfit: money(rows.reduce((sum, row) => sum + row.netProfit, 0)),
    totalAhmedShare: money(rows.reduce((sum, row) => sum + row.ahmedShare, 0)),
    totalAbdoShare: money(rows.reduce((sum, row) => sum + row.abdoShare, 0)),
    totalAmountDueFromAbdo: money(rows.reduce((sum, row) => sum + row.amountDueFromAbdo, 0)),
    totalPartsQuantity: rows.reduce((sum, row) => sum + row.partsQuantity, 0)
  };
}

export function buildAccountingSummaryV2(input: {
  orders: RepairOrder[];
  invoices?: Invoice[];
  movements?: InventoryMovement[];
  usages?: RepairPartUsage[];
}): AccountingSummaryV2 {
  const rows = (input.orders || []).map(order =>
    calculateOrderAccountingV2(order, input.invoices || [], input.movements || [], input.usages || [])
  );
  return calculateAccountingSummaryV2(rows);
}
