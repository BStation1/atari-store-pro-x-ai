import { RepairOrder, RepairPartUsage, Product } from '../types';

/**
 * Helper to check if two order IDs represent the same logical order (e.g., local ID 'ATR-10001' vs Supabase UUID).
 */
export function isSameOrderIdentity(
  orderIdA: string,
  orderIdB: string,
  ordersList: RepairOrder[] = []
): boolean {
  if (!orderIdA || !orderIdB) return false;
  if (orderIdA === orderIdB) return true;

  const setA = new Set<string>([orderIdA]);
  const matchedA = ordersList.find(o => o.id === orderIdA || (o as any).orderNumber === orderIdA || (o as any).uuid === orderIdA);
  if (matchedA) {
    if (matchedA.id) setA.add(String(matchedA.id));
    if ((matchedA as any).orderNumber) setA.add(String((matchedA as any).orderNumber));
    if ((matchedA as any).uuid) setA.add(String((matchedA as any).uuid));
  }

  const setB = new Set<string>([orderIdB]);
  const matchedB = ordersList.find(o => o.id === orderIdB || (o as any).orderNumber === orderIdB || (o as any).uuid === orderIdB);
  if (matchedB) {
    if (matchedB.id) setB.add(String(matchedB.id));
    if ((matchedB as any).orderNumber) setB.add(String((matchedB as any).orderNumber));
    if ((matchedB as any).uuid) setB.add(String((matchedB as any).uuid));
  }

  for (const id of setA) {
    if (setB.has(id)) return true;
  }
  return false;
}

/**
 * Helper to check if two product IDs represent the same logical product (e.g., local ID 'PROD-001' vs Supabase UUID vs SKU).
 */
export function isSameProductIdentity(
  productIdA: string,
  productIdB: string,
  productsList: Product[] = []
): boolean {
  if (!productIdA || !productIdB) return false;
  if (productIdA === productIdB) return true;

  const setA = new Set<string>([productIdA]);
  const prodA = productsList.find(p => p.id === productIdA || (p as any).uuid === productIdA || p.sku === productIdA);
  if (prodA) {
    if (prodA.id) setA.add(String(prodA.id));
    if ((prodA as any).uuid) setA.add(String((prodA as any).uuid));
    if (prodA.sku) setA.add(String(prodA.sku));
  }

  const setB = new Set<string>([productIdB]);
  const prodB = productsList.find(p => p.id === productIdB || (p as any).uuid === productIdB || p.sku === productIdB);
  if (prodB) {
    if (prodB.id) setB.add(String(prodB.id));
    if ((prodB as any).uuid) setB.add(String((prodB as any).uuid));
    if (prodB.sku) setB.add(String(prodB.sku));
  }

  for (const id of setA) {
    if (setB.has(id)) return true;
  }
  return false;
}

/**
 * Helper to check if two note fields represent the same device index or device ID.
 */
export function isSameDeviceIdentity(notesA?: string, notesB?: string): boolean {
  const getDevId = (notes?: string) => {
    if (!notes) return '0';
    const match = notes.match(/deviceId:([^\s,;]+)/);
    return match ? match[1] : '0';
  };
  return getDevId(notesA) === getDevId(notesB);
}

/**
 * Canonical check if a part usage belongs to a given repair order & device.
 */
export function isPartUsageForOrderAndDevice(
  pu: RepairPartUsage,
  order: RepairOrder,
  deviceIdx: number = 0,
  ordersList: RepairOrder[] = [],
  productsList: Product[] = []
): boolean {
  if (!order || !pu) return false;

  // Accounting status MUST be active (CONSUMED or PENDING, NOT RETURNED/REVERSED)
  if (pu.accountingStatus === 'RETURNED' || pu.accountingStatus === 'REVERSED') {
    return false;
  }

  // Check order identity across local ID, orderNumber, and Supabase UUID
  const orderMatches = isSameOrderIdentity(String(pu.repairOrderId), String(order.id), ordersList) ||
                       isSameOrderIdentity(String(pu.repairOrderId), String((order as any).orderNumber || ''), ordersList) ||
                       isSameOrderIdentity(String(pu.repairOrderId), String((order as any).uuid || ''), ordersList);
  if (!orderMatches) return false;

  // Check device matching
  const currentDevice = order.devices[deviceIdx];
  if (order.devices.length === 1) return true;
  if (!currentDevice) return true;

  if (pu.notes && pu.notes.includes(`deviceId:${currentDevice.id || deviceIdx}`)) {
    return true;
  }
  if (!pu.notes || !pu.notes.includes('deviceId:')) {
    return true;
  }

  return false;
}

/**
 * Canonical merge function for Repair Part Usages.
 * Guarantees zero-flicker reconciliation between remote usages, current state, and pending optimistic mutations.
 */
export function mergeRepairPartUsages(
  currentUsages: RepairPartUsage[] = [],
  remoteUsages: RepairPartUsage[] = [],
  pendingOptimisticUsages: Map<string, RepairPartUsage> | RepairPartUsage[] = [],
  ordersList: RepairOrder[] = [],
  productsList: Product[] = []
): RepairPartUsage[] {
  const pendingArray: RepairPartUsage[] = pendingOptimisticUsages instanceof Map
    ? Array.from(pendingOptimisticUsages.values())
    : Array.from(pendingOptimisticUsages || []);

  const resultMap = new Map<string, RepairPartUsage>();

  // 1. Start with remote persisted usages
  remoteUsages.forEach(u => resultMap.set(u.id, u));

  // 2. Add current usages if remote is empty or if current has active items not in remote
  if (remoteUsages.length === 0) {
    currentUsages.forEach(u => resultMap.set(u.id, u));
  }

  // 3. Merge pending optimistic usages that are not yet reconciled in remoteUsages
  for (const pending of pendingArray) {
    if (resultMap.has(pending.id)) {
      continue;
    }

    // Check if remote already contains a matching active record
    const existsInRemote = remoteUsages.some(ru => {
      const orderMatches = isSameOrderIdentity(String(ru.repairOrderId), String(pending.repairOrderId), ordersList);
      const productMatches = isSameProductIdentity(String(ru.inventoryItemId), String(pending.inventoryItemId), productsList);
      const deviceMatches = isSameDeviceIdentity(ru.notes, pending.notes);
      const statusActive = ru.accountingStatus !== 'RETURNED' && ru.accountingStatus !== 'REVERSED';
      return orderMatches && productMatches && deviceMatches && statusActive;
    });

    if (!existsInRemote) {
      resultMap.set(pending.id, pending);
    }
  }

  // 4. Retain any active items from currentUsages that are still in pending array or not yet in remote
  for (const curr of currentUsages) {
    if (!resultMap.has(curr.id)) {
      const isPending = pendingArray.some(p => p.id === curr.id);
      if (isPending) {
        resultMap.set(curr.id, curr);
      }
    }
  }

  return Array.from(resultMap.values());
}
