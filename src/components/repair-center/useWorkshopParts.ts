import { useState, useRef, useCallback, useMemo, useEffect, Dispatch, SetStateAction } from "react";
import {
  RepairOrder,
  RepairPartUsage,
  Product,
  User,
  WorkOwnershipType,
  QUICK_FAULTS_LIST
} from "../../types";
import { getDeviceDisplayName } from "../../lib/customerDisplayHelper";
import {
  addInventoryMovementToSupabase,
  ensureProductUuidInSupabase,
  updateProductQuantityInSupabase
} from "../../lib/supabaseProducts";
import {
  addRepairPartUsageToSupabase,
  updateRepairPartUsageInSupabase,
  isUuid
} from "../../lib/supabasePartUsages";
import {
  ensureRepairOrderUuidInSupabase,
  updateRepairOrderInSupabase
} from "../../lib/supabaseRepairOrders";
import {
  addTimelineEventHelper,
  addAuditLogRecordHelper
} from "../../lib/repairLogging";
import { useRepairPartUsages } from "../../hooks/useData";

export function getUsageSellingUnitPrice(pu: RepairPartUsage, productsList: Product[]): number {
  if (pu.sellingPrice && pu.sellingPrice > 0) return pu.sellingPrice;
  const prod = productsList.find(p => p.id === pu.inventoryItemId || (p.nameAr || p.name) === pu.partName);
  if (prod && Number(prod.sellPrice || (prod as any).price) > 0) {
    return Number(prod.sellPrice || (prod as any).price);
  }
  return pu.unitCost || 0;
}

export function calculateSuggestedPriceForFaults(faultLabels: string[]): number {
  return faultLabels.reduce((sum, label) => {
    const match = QUICK_FAULTS_LIST.find(f => f.label === label);
    return sum + (match ? match.defaultSellingPrice : 0);
  }, 0);
}

import {
  isSameOrderIdentity,
  isSameProductIdentity,
  isSameDeviceIdentity,
  isPartUsageForOrderAndDevice,
  mergeRepairPartUsages
} from "../../lib/partUsageUtils";

function logDetailedMutationError(
  operation: 'add' | 'increase' | 'decrease' | 'remove',
  mutationError: any,
  meta: {
    productId?: string;
    repairOrderId?: string;
    usageId?: string;
    tempUsageId?: string;
  }
) {
  const sbError = mutationError?.cause || mutationError?.error || mutationError;
  const rawCode = mutationError?.code || sbError?.code || "N/A";
  const rawMessage = mutationError?.message || sbError?.message || String(mutationError);
  const rawDetails = mutationError?.details || sbError?.details || "N/A";
  const rawHint = mutationError?.hint || sbError?.hint || "N/A";
  const rawStatus = mutationError?.status || sbError?.status || sbError?.statusCode || mutationError?.statusCode || "N/A";
  const rawRequest = mutationError?.request || sbError?.request || "N/A";
  const rawQuery = mutationError?.query || sbError?.query || "N/A";
  const rawRows = mutationError?.affectedRows ?? sbError?.affectedRows ?? 0;
  const rawStack = mutationError?.stack || new Error().stack;

  console.error("=================== REAL UNDERLYING MUTATION ERROR ===================");
  console.error(`- Operation: ${operation}`);
  console.error(`- Product ID: ${meta.productId || "N/A"}`);
  console.error(`- Repair Order ID: ${meta.repairOrderId || "N/A"}`);
  console.error(`- Usage ID: ${meta.usageId || "N/A"}`);
  console.error(`- Temp Usage ID (if any): ${meta.tempUsageId || "N/A"}`);
  console.error(`- Supabase request:`, rawRequest);
  console.error(`- HTTP status:`, rawStatus);
  console.error(`- Supabase error.code:`, rawCode);
  console.error(`- Supabase error.message:`, rawMessage);
  console.error(`- Supabase error.details:`, rawDetails);
  console.error(`- Supabase error.hint:`, rawHint);
  console.error(`- The exact query that failed:`, rawQuery);
  console.error(`- Number of affected rows:`, rawRows);
  console.error(`- Full stack trace:\n${rawStack}`);
  console.error("======================================================================");
}

/**
 * Pure helper function to recalculate repair order device partsCost and totals
 * based on a specific set of active part usages and products list.
 */
export function recalculateOrderTotals(
  order: RepairOrder,
  usages: RepairPartUsage[],
  deviceIdx: number = 0,
  productsList: Product[] = [],
  ordersList: RepairOrder[] = []
): RepairOrder {
  const currentDevice = order.devices[deviceIdx];
  if (!currentDevice) return order;

  const activeUsagesForDevice = usages.filter(pu =>
    isPartUsageForOrderAndDevice(pu, order, deviceIdx, ordersList, productsList)
  );

  const newPartsCost = activeUsagesForDevice.reduce((sum, pu) => {
    const sellP = getUsageSellingUnitPrice(pu, productsList);
    return sum + (pu.quantity * sellP);
  }, 0);

  const tags = currentDevice.selectedQuickFaults || (currentDevice.issue ? currentDevice.issue.split(" - ").map(s => s.trim()) : []);
  const faultsCost = currentDevice.suggestedRepairPrice ?? calculateSuggestedPriceForFaults(tags);
  const newAutoPrice = faultsCost + newPartsCost;

  const updatedDevices = [...order.devices];
  if (currentDevice.isPriceManuallyEdited) {
    updatedDevices[deviceIdx] = {
      ...currentDevice,
      partsCost: newPartsCost,
      priceOverrideAcknowledged: false
    };
  } else {
    updatedDevices[deviceIdx] = {
      ...currentDevice,
      partsCost: newPartsCost,
      finalRepairPrice: newAutoPrice,
      estimatedCost: newAutoPrice
    };
  }

  const totalFinal = updatedDevices.reduce((sum, d) => sum + (d.finalRepairPrice ?? d.estimatedCost ?? 0), 0);

  return {
    ...order,
    devices: updatedDevices,
    totalEstimatedCost: totalFinal,
    finalRepairPrice: totalFinal
  };
}

interface UseWorkshopPartsOptions {
  selectedOrder: RepairOrder | null;
  products: Product[];
  partUsages: RepairPartUsage[];
  currentUser: User | any | null;
  setSelectedOrder: Dispatch<SetStateAction<RepairOrder | null>>;
  updateRepairOrder: (order: RepairOrder) => void;
  setRepairOrderLocal: (order: RepairOrder) => void;
  setProductLocal: (product: Product) => void;
  persistLocalUsages: (usages: RepairPartUsage[]) => void;
  replacePartUsageIdLocal: (oldId: string, usage: RepairPartUsage) => void;
  dialog: { alert: (options: { title?: string; message: string; variant?: "info" | "success" | "warning" | "error" }) => Promise<void> };
}

export interface UseWorkshopPartsReturn {
  visiblePartUsages: RepairPartUsage[];
  busyProductIds: Set<string>;
  partsTotal: number;
  addPart: (productId: string, qtyToAdd?: number, deviceIdx?: number) => void;
  increasePart: (productId: string, deviceIdx?: number) => void;
  decreasePart: (usageId: string, deviceIdx?: number) => void;
  removePart: (usageId: string, deviceIdx?: number) => void;
  getUsageSellingUnitPrice: (pu: RepairPartUsage, productsList: Product[]) => number;
}

export function useWorkshopParts({
  selectedOrder,
  products,
  partUsages,
  currentUser,
  setSelectedOrder,
  updateRepairOrder,
  setRepairOrderLocal,
  setProductLocal,
  persistLocalUsages,
  replacePartUsageIdLocal,
  dialog
}: UseWorkshopPartsOptions): UseWorkshopPartsReturn {
  const [busyProductIds, setBusyProductIds] = useState<Set<string>>(new Set());

  // Dedicated workshop display state. This is intentionally isolated from the
  // global Supabase/AppDataContext array so a stale realtime/refetch response
  // cannot make an optimistic row disappear from the technician's table.
  const [workshopUsages, setWorkshopUsages] = useState<RepairPartUsage[]>([]);
  const workshopUsagesRef = useRef<RepairPartUsage[]>([]);
  useEffect(() => {
    workshopUsagesRef.current = workshopUsages;
  }, [workshopUsages]);

  // Prevent stale closures in async mutations/callbacks
  const selectedOrderRef = useRef(selectedOrder);
  selectedOrderRef.current = selectedOrder;

  const productsRef = useRef(products);
  productsRef.current = products;

  const partUsagesRef = useRef(partUsages);
  partUsagesRef.current = partUsages;

  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  // Sequential mutation queue per repair order to prevent concurrent race conditions
  const orderMutationQueueRef = useRef<Map<string, Promise<any>>>(new Map());

  // Pending background mutation count per product ID
  const pendingMutationsRef = useRef<Map<string, number>>(new Map());

  const findProductByAnyIdentity = useCallback((identity: string, usage?: RepairPartUsage) => {
    return productsRef.current.find(p =>
      p.id === identity ||
      (p as any).uuid === identity ||
      p.sku === identity ||
      (!!usage?.sku && p.sku === usage.sku) ||
      (!!usage?.partName && (p.nameAr || p.name) === usage.partName)
    );
  }, []);

  const fallbackUser: User = {
    id: "U-101",
    username: "elbanna",
    name: "أحمد البنا",
    fullName: "أحمد البنا (الشريك الأول)",
    role: "OWNER" as any,
    roleId: "OWNER",
    email: "elbannafc@gmail.com",
    isActive: true,
    permissions: ["all"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const {
    upsertPartUsageLocal,
    patchPartUsageLocal,
    markPartUsageReturnedLocal,
    removeTemporaryPartUsageLocal,
    registerPendingPartUsage,
    removePendingPartUsage,
    pendingRepairPartUsagesRef: sharedPendingRef
  } = useRepairPartUsages();

  // Initialize the local display list when the opened order changes.
  // For later remote updates we only upsert/patch rows; we never delete an
  // active local row merely because a remote snapshot is temporarily stale.
  const activeOrderIdentity = selectedOrder
    ? `${selectedOrder.id}|${(selectedOrder as any).orderNumber || ''}|${(selectedOrder as any).uuid || ''}`
    : '';

  useEffect(() => {
    if (!selectedOrder) {
      setWorkshopUsages([]);
      return;
    }
    const initial = partUsages.filter(pu =>
      isPartUsageForOrderAndDevice(pu, selectedOrder, 0, [], products)
    );
    setWorkshopUsages(initial);
  }, [activeOrderIdentity]);

  useEffect(() => {
    if (!selectedOrder) return;
    const incoming = partUsages.filter(pu =>
      isPartUsageForOrderAndDevice(pu, selectedOrder, 0, [], products)
    );

    setWorkshopUsages(current => {
      const next = [...current];

      for (const remote of incoming) {
        const matchIndex = next.findIndex(local => {
          if (local.id === remote.id) return true;
          return isSameOrderIdentity(String(local.repairOrderId), String(remote.repairOrderId), [selectedOrder]) &&
            isSameProductIdentity(String(local.inventoryItemId), String(remote.inventoryItemId), products) &&
            isSameDeviceIdentity(local.notes, remote.notes);
        });

        if (remote.accountingStatus === 'RETURNED' || remote.accountingStatus === 'REVERSED') {
          if (matchIndex >= 0) next.splice(matchIndex, 1);
          continue;
        }

        if (matchIndex >= 0) {
          // Preserve the local display identity while an optimistic mutation is
          // pending; otherwise overlay the latest persisted server fields.
          const local = next[matchIndex];
          const isPending = local.id.startsWith('PU-') || sharedPendingRef.current.has(local.id);
          next[matchIndex] = isPending ? local : { ...local, ...remote };
        } else {
          next.push(remote);
        }
      }

      workshopUsagesRef.current = next;
      return next;
    });
  }, [partUsages, products, activeOrderIdentity, selectedOrder, sharedPendingRef]);

  // PartsTable renders exclusively from the isolated workshop display state.
  const visiblePartUsages = useMemo(() => {
    const order = selectedOrder;
    if (!order) return [];
    return workshopUsages.filter(pu =>
      isPartUsageForOrderAndDevice(pu, order, 0, [], products)
    );
  }, [selectedOrder, workshopUsages, products]);

  // Structured logging on render (Section 1 requirement)
  useEffect(() => {
    const ts = new Date().toISOString().substring(11, 23);
    const traceItems = visiblePartUsages.map(u => ({
      id: u.id,
      qty: u.quantity,
      status: u.accountingStatus || 'CONSUMED',
      repairOrderId: u.repairOrderId,
      inventoryItemId: u.inventoryItemId,
      notes: u.notes || ''
    }));
    console.log(`[WORKSHOP_PARTS_TRACE ${ts}] Rendered visiblePartUsages count=${visiblePartUsages.length}:`, JSON.stringify(traceItems));
  }, [visiblePartUsages]);

  // 2. Calculate parts total selling price
  const partsTotal = useMemo(() => {
    return visiblePartUsages.reduce((sum, pu) => {
      const sellP = getUsageSellingUnitPrice(pu, products);
      return sum + (pu.quantity * sellP);
    }, 0);
  }, [visiblePartUsages, products]);

  // 3. Add part logic with exact snapshot rollback & per-order queue
  const addPart = useCallback((productId: string, qtyToAdd: number = 1, deviceIdx: number = 0) => {
    console.log("--> ENTER addPart", { productId, qtyToAdd, deviceIdx });
    const t0 = performance.now();
    console.log(`⏱️ [useWorkshopParts:AddPart] Click received for productId=${productId} at ${t0.toFixed(2)}ms`);

    const order = selectedOrderRef.current;
    if (!order) {
      console.log("<-- EXIT addPart (no selected order)");
      return;
    }

    const currentProducts = productsRef.current;
    const product = findProductByAnyIdentity(productId);
    if (!product) {
      console.log("<-- EXIT addPart (product not found)");
      return;
    }

    const qty = Math.max(1, Math.floor(qtyToAdd));
    if (product.quantity < qty) {
      dialog.alert({ message: "عفواً، هاته القطعة غير متوفرة بالمخزون حالياً!", variant: "error" });
      console.log("<-- EXIT addPart (insufficient stock)");
      return;
    }

    const currentDevice = order.devices[deviceIdx];
    if (!currentDevice) {
      console.log("<-- EXIT addPart (device not found)");
      return;
    }

    const unitSellingPrice = Number(product.sellPrice || product.price || product.purchasePrice) || 0;
    const unitPurchaseCost = Number(product.purchasePrice || product.costPrice) || 0;
    const totalCost = unitPurchaseCost * qty;

    const ownership = order.workOwnershipType || WorkOwnershipType.CUSTOMER_SHARED;
    let owner: 'SHOP' | 'AHMED' | 'ABDO' = 'SHOP';
    if (ownership === WorkOwnershipType.PARTNER_1_PRIVATE) owner = 'AHMED';
    else if (ownership === WorkOwnershipType.PARTNER_2_PRIVATE) owner = 'ABDO';

    const allUsages = workshopUsagesRef.current;
    const existingUsage = allUsages.find(pu =>
      isPartUsageForOrderAndDevice(pu, order, deviceIdx, [], currentProducts) &&
      isSameProductIdentity(pu.inventoryItemId, product.id, currentProducts)
    );

    const tempUsageId = existingUsage ? undefined : `PU-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const currentQty = existingUsage ? existingUsage.quantity : 0;
    const newUsageQty = currentQty + qty;

    console.log("========================\nWORKSHOP MUTATION\n========================");
    console.log("Timestamp:", new Date().toISOString());
    console.log("Operation: addPart");
    console.log("Caller:", new Error().stack?.split("\n")[2]?.trim() || "unknown");
    console.trace();
    console.log("Repair Order ID:", order.id);
    console.log("Product ID:", productId);
    console.log("Usage ID:", existingUsage?.id || tempUsageId);
    console.log("Current Quantity:", currentQty);
    console.log("New Quantity:", newUsageQty);

    const mutationId = `mut_add_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Capture IMMUTABLE Snapshot BEFORE optimistic mutation
    const snapshot = {
      mutationId,
      orderId: order.id,
      productId: product.id,
      productBefore: { ...product },
      usageBefore: existingUsage ? { ...existingUsage } : null,
      qtyDelta: -qty, // stock reduced by qty
      deviceIdx,
      tempUsageId
    };

    // 1. Synchronous Optimistic Update: Product Stock
    const newStockQty = product.quantity - qty;
    setProductLocal({
      ...product,
      quantity: newStockQty
    });

    // 2. Synchronous Optimistic Update: Part Usages
    let updatedUsageList = [...allUsages];
    let usageRecordToSave: RepairPartUsage;

    if (existingUsage) {
      usageRecordToSave = {
        ...existingUsage,
        quantity: newUsageQty,
        unitCost: unitPurchaseCost,
        totalCost: newUsageQty * unitPurchaseCost,
        sellingPrice: unitSellingPrice,
        sellingTotal: newUsageQty * unitSellingPrice
      };
      updatedUsageList = allUsages.map(pu => pu.id === existingUsage.id ? usageRecordToSave : pu);
      upsertPartUsageLocal(usageRecordToSave);
    } else {
      usageRecordToSave = {
        id: snapshot.tempUsageId!,
        repairOrderId: order.id,
        inventoryItemId: product.id,
        partName: product.nameAr || product.name,
        sku: product.sku || product.id,
        quantity: qty,
        unitCost: unitPurchaseCost,
        totalCost: totalCost,
        sellingPrice: unitSellingPrice,
        sellingTotal: unitSellingPrice * qty,
        ownershipType: ownership,
        responsiblePartnerId: owner === 'AHMED' ? 'P-001' : owner === 'ABDO' ? 'P-002' : 'SHOP',
        accountingStatus: 'CONSUMED',
        notes: `deviceId:${currentDevice.id || deviceIdx}`,
        createdAt: new Date().toISOString()
      };
      updatedUsageList.push(usageRecordToSave);
      registerPendingPartUsage(usageRecordToSave);
    }

    // Keep the workshop table stable independently from AppDataContext/refetches.
    setWorkshopUsages(updatedUsageList);
    workshopUsagesRef.current = updatedUsageList;

    // 3. Synchronous Recalculate Order Totals
    let updatedOrder = recalculateOrderTotals(selectedOrderRef.current || order, updatedUsageList, deviceIdx, currentProducts);

    const currentUserForAction = currentUserRef.current || fallbackUser;
    updatedOrder = addAuditLogRecordHelper(
      updatedOrder,
      "ADD_PART",
      `قطع غيار جهاز ${currentDevice.type}`,
      null,
      `${product.name} (سعر البيع: ${unitSellingPrice} ج.م | كمية: ${qty})`,
      "صرف قطعة غيار من المخزون وتوثيق حركة السحب",
      currentUserForAction,
      currentDevice.id
    );

    updatedOrder = addTimelineEventHelper(
      updatedOrder,
      "PART_ADDED",
      `صرف قطعة غيار من المخزون: ${product.name} (كمية ${qty} بسعر بيع ${unitSellingPrice} ج.م)`,
      currentUserForAction,
      currentDevice.id
    );

    setSelectedOrder(updatedOrder);
    setRepairOrderLocal(updatedOrder);

    // Track busy count per product
    const pendingCount = (pendingMutationsRef.current.get(product.id) || 0) + 1;
    pendingMutationsRef.current.set(product.id, pendingCount);
    setBusyProductIds(prev => new Set(prev).add(product.id));

    // Async task queued per repair order
    const task = async () => {
      let createdPersistedUsage: RepairPartUsage | null = null;
      try {
        const [productUuid, repairOrderUuid] = await Promise.all([
          ensureProductUuidInSupabase(product).then(value => value || product.id),
          ensureRepairOrderUuidInSupabase(order).then(value => value || order.id)
        ]);

        const quantityPromise = updateProductQuantityInSupabase(productUuid, newStockQty);
        
        console.log("🔥 [INVOCATION] Calling addInventoryMovementToSupabase in addPart task...");
        const movementPromise = addInventoryMovementToSupabase({
          productId: productUuid,
          productNameSnapshot: product.nameAr || product.name,
          movementType: 'REPAIR_USAGE',
          quantityChange: -qty,
          previousQuantity: product.quantity,
          newQuantity: newStockQty,
          costPriceSnapshot: unitPurchaseCost,
          sellingPriceSnapshot: unitSellingPrice,
          totalCost: totalCost,
          referenceId: order.id,
          repairOrderId: repairOrderUuid,
          owner: owner,
          notes: `صرف قطعة غيار صيانة: ${product.nameAr || product.name} للجهاز (${getDeviceDisplayName(currentDevice)})`,
          createdAt: new Date().toISOString()
        });

        let usagePromise: Promise<any>;
        if (existingUsage) {
          console.log("🔥 [INVOCATION] Calling updateRepairPartUsageInSupabase in addPart task...");
          usagePromise = updateRepairPartUsageInSupabase(existingUsage.id, {
            quantity: usageRecordToSave.quantity,
            unitCost: unitPurchaseCost,
            totalCost: usageRecordToSave.totalCost,
            sellingPrice: unitSellingPrice,
            sellingTotal: usageRecordToSave.sellingTotal
          });
        } else {
          console.log("🔥 [INVOCATION] Calling addRepairPartUsageToSupabase in addPart task...");
          usagePromise = addRepairPartUsageToSupabase({
            repairOrderId: repairOrderUuid,
            inventoryItemId: productUuid,
            partName: product.nameAr || product.name,
            sku: product.sku || product.id,
            quantity: qty,
            unitCost: unitPurchaseCost,
            totalCost: totalCost,
            sellingPrice: unitSellingPrice,
            sellingTotal: unitSellingPrice * qty,
            ownershipType: ownership,
            responsiblePartnerId: owner === 'AHMED' ? 'P-001' : owner === 'ABDO' ? 'P-002' : 'SHOP',
            accountingStatus: 'CONSUMED',
            notes: `deviceId:${currentDevice.id || deviceIdx}`
          });
        }

        const latestOrderForDb = selectedOrderRef.current
          ? recalculateOrderTotals(selectedOrderRef.current, workshopUsagesRef.current, deviceIdx, productsRef.current)
          : updatedOrder;

        const [, , persistedUsage] = await Promise.all([
          quantityPromise,
          movementPromise,
          usagePromise,
          updateRepairOrderInSupabase(latestOrderForDb)
        ]);

        if (!existingUsage && persistedUsage?.id && snapshot.tempUsageId) {
          createdPersistedUsage = persistedUsage;
          const reconciledUsage: RepairPartUsage = {
            ...usageRecordToSave,
            ...persistedUsage,
            repairOrderId: order.id,
            // Keep the local catalog identity for UI controls. The persisted
            // UUID remains available on the remote row and is resolved when
            // a server mutation is performed.
            inventoryItemId: usageRecordToSave.inventoryItemId,
            sku: usageRecordToSave.sku
          };
          setWorkshopUsages(current => {
            const next = current.map(row => row.id === snapshot.tempUsageId
              ? { ...row, ...reconciledUsage, id: reconciledUsage.id, repairOrderId: order.id }
              : row
            );
            workshopUsagesRef.current = next;
            return next;
          });
          console.log("🔥 [INVOCATION] Calling replacePartUsageIdLocal in addPart task...");
          replacePartUsageIdLocal(snapshot.tempUsageId, reconciledUsage);
        }
      } catch (mutationError: any) {
        logDetailedMutationError('add', mutationError, {
          productId: product.id,
          repairOrderId: order.id,
          usageId: existingUsage?.id,
          tempUsageId: snapshot.tempUsageId
        });

        // GRANULAR EXACT ROLLBACK:
        // 1. Revert product stock by -snapshot.qtyDelta
        const currentLatestProduct = productsRef.current.find(p => p.id === product.id) || product;
        const restoredProductQty = currentLatestProduct.quantity - snapshot.qtyDelta;
        setProductLocal({ ...currentLatestProduct, quantity: restoredProductQty });

        // 2. Revert usages: remove tempUsage or restore usageBefore
        let revertedUsages: RepairPartUsage[];
        if (snapshot.usageBefore === null) {
          if (snapshot.tempUsageId) {
            removeTemporaryPartUsageLocal(snapshot.tempUsageId);
          }
          revertedUsages = workshopUsagesRef.current.filter(u => u.id !== snapshot.tempUsageId);
        } else {
          upsertPartUsageLocal(snapshot.usageBefore);
          revertedUsages = workshopUsagesRef.current.map(u => u.id === snapshot.usageBefore!.id ? snapshot.usageBefore! : u);
        }

        setWorkshopUsages(revertedUsages);
        workshopUsagesRef.current = revertedUsages;

        // 3. Recalculate order totals based on current order state & reverted usages
        const currentLatestOrder = selectedOrderRef.current || order;
        const rolledBackOrder = recalculateOrderTotals(currentLatestOrder, revertedUsages, deviceIdx, productsRef.current);
        setSelectedOrder(rolledBackOrder);
        setRepairOrderLocal(rolledBackOrder);

        try {
          await updateRepairOrderInSupabase(rolledBackOrder);
        } catch (dbErr) {
          console.error("Failed to sync rolled back order to Supabase:", dbErr);
        }
      } finally {
        if (snapshot.tempUsageId) removePendingPartUsage(snapshot.tempUsageId);
        if (createdPersistedUsage?.id) removePendingPartUsage(createdPersistedUsage.id);

        const remaining = (pendingMutationsRef.current.get(product.id) || 1) - 1;
        pendingMutationsRef.current.set(product.id, remaining);
        if (remaining <= 0) {
          setBusyProductIds(prev => {
            const next = new Set(prev);
            next.delete(product.id);
            return next;
          });
        }
      }
    };

    const prevQueue = orderMutationQueueRef.current.get(order.id) || Promise.resolve();
    const nextQueue = prevQueue.then(task, task);
    orderMutationQueueRef.current.set(order.id, nextQueue);

    console.log("<-- EXIT addPart");
  }, [
    dialog,
    persistLocalUsages,
    replacePartUsageIdLocal,
    setProductLocal,
    setRepairOrderLocal,
    setSelectedOrder,
    findProductByAnyIdentity
  ]);

  // 4. Increase part alias
  const increasePart = useCallback((productId: string, deviceIdx: number = 0) => {
    console.log("--> ENTER increasePart", { productId, deviceIdx });
    const order = selectedOrderRef.current;
    const allUsages = workshopUsagesRef.current;
    const currentProducts = productsRef.current;
    const existingUsage = allUsages.find(pu =>
      order && isPartUsageForOrderAndDevice(pu, order, deviceIdx, [], currentProducts) &&
      isSameProductIdentity(pu.inventoryItemId, productId, currentProducts)
    );

    console.log("========================\nWORKSHOP MUTATION\n========================");
    console.log("Timestamp:", new Date().toISOString());
    console.log("Operation: increasePart");
    console.log("Caller:", new Error().stack?.split("\n")[2]?.trim() || "unknown");
    console.trace();
    console.log("Repair Order ID:", order?.id || "N/A");
    console.log("Product ID:", productId);
    console.log("Usage ID:", existingUsage?.id || "N/A");
    console.log("Current Quantity:", existingUsage ? existingUsage.quantity : 0);
    console.log("New Quantity:", existingUsage ? existingUsage.quantity + 1 : 1);

    addPart(productId, 1, deviceIdx);
    console.log("<-- EXIT increasePart");
  }, [addPart]);

  // 5. Remove part logic (supports decreasing quantity or complete removal) with granular rollback
  const removePartInternal = useCallback((usageId: string, deviceIdx: number = 0, removeQty: number = 1) => {
    console.log("--> ENTER removePartInternal", { usageId, deviceIdx, removeQty });

    const order = selectedOrderRef.current;
    if (!order) {
      console.log("<-- EXIT removePartInternal (no selected order)");
      return;
    }

    const allUsages = workshopUsagesRef.current;
    const usage = allUsages.find(pu => pu.id === usageId);
    if (!usage) {
      console.log("<-- EXIT removePartInternal (usage not found)");
      return;
    }

    const currentProducts = productsRef.current;
    const product = findProductByAnyIdentity(usage.inventoryItemId, usage);

    const qtyToReturn = Math.min(usage.quantity, Math.max(1, removeQty));
    const isFullRemove = (usage.quantity <= qtyToReturn) || removeQty === -1;
    const actualReturnedQty = isFullRemove ? usage.quantity : qtyToReturn;

    const mutationId = `mut_rem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Capture IMMUTABLE Snapshot BEFORE optimistic mutation
    const snapshot = {
      mutationId,
      orderId: order.id,
      productId: usage.inventoryItemId,
      productBefore: product ? { ...product } : null,
      usageBefore: { ...usage },
      qtyDelta: actualReturnedQty, // stock increased by actualReturnedQty
      deviceIdx
    };

    // 1. Synchronous Optimistic Update: Product Stock
    if (product) {
      setProductLocal({
        ...product,
        quantity: product.quantity + actualReturnedQty
      });
    }

    // 2. Synchronous Optimistic Update: Usages
    let updatedUsages: RepairPartUsage[] = [];
    const newQty = usage.quantity - actualReturnedQty;
    const newTotalCost = newQty * usage.unitCost;
    const usageSellPrice = getUsageSellingUnitPrice(usage, currentProducts);
    const newSellingTotal = newQty * usageSellPrice;

    if (isFullRemove) {
      updatedUsages = allUsages.map(pu => pu.id === usageId ? { ...pu, accountingStatus: 'RETURNED' as const } : pu);
      console.log("🔥 [INVOCATION] Calling markPartUsageReturnedLocal from removePartInternal...");
      markPartUsageReturnedLocal(usageId);
    } else {
      updatedUsages = allUsages.map(pu => pu.id === usageId ? {
        ...pu,
        quantity: newQty,
        totalCost: newTotalCost,
        sellingPrice: usageSellPrice,
        sellingTotal: newSellingTotal
      } : pu);
      patchPartUsageLocal(usageId, {
        quantity: newQty,
        totalCost: newTotalCost,
        sellingPrice: usageSellPrice,
        sellingTotal: newSellingTotal
      });
    }

    const visibleUpdatedUsages = updatedUsages.filter(u => u.accountingStatus !== 'RETURNED' && u.accountingStatus !== 'REVERSED');
    setWorkshopUsages(visibleUpdatedUsages);
    workshopUsagesRef.current = visibleUpdatedUsages;

    // 3. Synchronous Recalculate Order Totals
    let updatedOrder = recalculateOrderTotals(selectedOrderRef.current || order, updatedUsages, deviceIdx, currentProducts);
    setSelectedOrder(updatedOrder);
    setRepairOrderLocal(updatedOrder);

    // Mark product as busy
    const pendingCount = (pendingMutationsRef.current.get(usage.inventoryItemId) || 0) + 1;
    pendingMutationsRef.current.set(usage.inventoryItemId, pendingCount);
    setBusyProductIds(prev => new Set(prev).add(usage.inventoryItemId));

    const task = async () => {
      try {
        const persistedUsage = partUsagesRef.current.find(candidate =>
          isUuid(candidate.id) &&
          isSameOrderIdentity(String(candidate.repairOrderId), String(usage.repairOrderId), [order]) &&
          isSameProductIdentity(String(candidate.inventoryItemId), String(usage.inventoryItemId), productsRef.current) &&
          isSameDeviceIdentity(candidate.notes, usage.notes)
        );
        const serverUsageId = isUuid(usageId) ? usageId : persistedUsage?.id;
        if (!serverUsageId) {
          throw new Error(`قطعة الغيار لم يكتمل حفظها بعد. أعد المحاولة بعد لحظة. usageId=${usageId}`);
        }

        let usageUpdatedOnServer = false;
        let stockUpdatedOnServer = false;
        let persistedProductId = product?.id || usage.inventoryItemId;

        try {
          if (isFullRemove) {
            console.log("🔥 [INVOCATION] Calling updateRepairPartUsageInSupabase (RETURNED) from removePartInternal task...");
            await updateRepairPartUsageInSupabase(serverUsageId, { accountingStatus: 'RETURNED' });
          } else {
            console.log("🔥 [INVOCATION] Calling updateRepairPartUsageInSupabase (UPDATE QTY) from removePartInternal task...");
            await updateRepairPartUsageInSupabase(serverUsageId, {
              quantity: newQty,
              totalCost: newTotalCost,
              sellingPrice: usageSellPrice,
              sellingTotal: newSellingTotal
            });
          }
          usageUpdatedOnServer = true;

          if (product) {
            persistedProductId = (await ensureProductUuidInSupabase(product)) || product.id;
            await updateProductQuantityInSupabase(persistedProductId, product.quantity + actualReturnedQty);
            stockUpdatedOnServer = true;
          }

          const persistedOrderId = (await ensureRepairOrderUuidInSupabase(order)) || order.id;
          const ownership = order.workOwnershipType || WorkOwnershipType.CUSTOMER_SHARED;
          let owner: 'SHOP' | 'AHMED' | 'ABDO' = 'SHOP';
          if (ownership === WorkOwnershipType.PARTNER_1_PRIVATE) owner = 'AHMED';
          else if (ownership === WorkOwnershipType.PARTNER_2_PRIVATE) owner = 'ABDO';

          console.log("🔥 [INVOCATION] Calling addInventoryMovementToSupabase from removePartInternal task...");
          await addInventoryMovementToSupabase({
            id: `MOV-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
            productId: persistedProductId,
            productNameSnapshot: usage.partName,
            movementType: 'IN',
            usageType: 'REPAIR_USAGE_RETURN',
            quantityChange: actualReturnedQty,
            previousQuantity: product ? product.quantity : 0,
            newQuantity: product ? product.quantity + actualReturnedQty : actualReturnedQty,
            costPriceSnapshot: usage.unitCost,
            sellingPriceSnapshot: 0,
            totalCost: usage.unitCost * actualReturnedQty,
            referenceId: order.id,
            repairOrderId: persistedOrderId,
            owner,
            notes: `إرجاع قطعة غيار صيانة للمخزن: ${usage.partName}`,
            createdAt: new Date().toISOString()
          });

          const latestOrderForDb = selectedOrderRef.current
            ? recalculateOrderTotals(selectedOrderRef.current, workshopUsagesRef.current, deviceIdx, productsRef.current)
            : updatedOrder;
          await updateRepairOrderInSupabase(latestOrderForDb);
        } catch (serverError) {
          if (stockUpdatedOnServer && product) {
            try {
              await updateProductQuantityInSupabase(persistedProductId, product.quantity);
            } catch (compensationError) {
              console.error('Failed to compensate product stock:', compensationError);
            }
          }
          if (usageUpdatedOnServer) {
            try {
              console.log("🔥 [INVOCATION] Calling updateRepairPartUsageInSupabase (COMPENSATE) from removePartInternal task...");
              await updateRepairPartUsageInSupabase(serverUsageId, {
                accountingStatus: snapshot.usageBefore.accountingStatus,
                quantity: snapshot.usageBefore.quantity,
                unitCost: snapshot.usageBefore.unitCost,
                totalCost: snapshot.usageBefore.totalCost,
                sellingPrice: snapshot.usageBefore.sellingPrice,
                sellingTotal: snapshot.usageBefore.sellingTotal
              });
            } catch (compensationError) {
              console.error('Failed to compensate repair part usage:', compensationError);
            }
          }
          throw serverError;
        }
      } catch (err) {
        logDetailedMutationError(isFullRemove ? 'remove' : 'decrease', err, {
          productId: product?.id || usage.inventoryItemId,
          repairOrderId: order.id,
          usageId: usageId
        });

        // GRANULAR EXACT ROLLBACK:
        if (product) {
          const currentLatestProduct = productsRef.current.find(p => p.id === product.id) || product;
          const restoredProductQty = currentLatestProduct.quantity - snapshot.qtyDelta;
          setProductLocal({ ...currentLatestProduct, quantity: restoredProductQty });
        }

        upsertPartUsageLocal(snapshot.usageBefore);
        const currentUsages = workshopUsagesRef.current;
        const revertedUsages = currentUsages.some(u => u.id === usageId)
          ? currentUsages.map(u => u.id === usageId ? snapshot.usageBefore : u)
          : [...currentUsages, snapshot.usageBefore];
        setWorkshopUsages(revertedUsages);
        workshopUsagesRef.current = revertedUsages;

        const currentLatestOrder = selectedOrderRef.current || order;
        const rolledBackOrder = recalculateOrderTotals(currentLatestOrder, revertedUsages, deviceIdx, productsRef.current);
        setSelectedOrder(rolledBackOrder);
        setRepairOrderLocal(rolledBackOrder);

        try {
          await updateRepairOrderInSupabase(rolledBackOrder);
        } catch (dbErr) {
          console.error("Failed to sync rolled back order to Supabase:", dbErr);
        }
      } finally {
        const remaining = (pendingMutationsRef.current.get(usage.inventoryItemId) || 1) - 1;
        pendingMutationsRef.current.set(usage.inventoryItemId, remaining);
        if (remaining <= 0) {
          setBusyProductIds(prev => {
            const next = new Set(prev);
            next.delete(usage.inventoryItemId);
            return next;
          });
        }
      }
    };

    const prevQueue = orderMutationQueueRef.current.get(order.id) || Promise.resolve();
    const nextQueue = prevQueue.then(task, task);
    orderMutationQueueRef.current.set(order.id, nextQueue);

    console.log("<-- EXIT removePartInternal");
  }, [
    dialog,
    persistLocalUsages,
    setProductLocal,
    setRepairOrderLocal,
    setSelectedOrder,
    findProductByAnyIdentity
  ]);

  // 6. Decrease quantity wrapper (reduces by 1)
  const decreasePart = useCallback((usageId: string, deviceIdx: number = 0) => {
    console.log("--> ENTER decreasePart", { usageId, deviceIdx });
    const order = selectedOrderRef.current;
    const allUsages = workshopUsagesRef.current;
    const usage = allUsages.find(pu => pu.id === usageId);

    console.log("========================\nWORKSHOP MUTATION\n========================");
    console.log("Timestamp:", new Date().toISOString());
    console.log("Operation: decreasePart");
    console.log("Caller:", new Error().stack?.split("\n")[2]?.trim() || "unknown");
    console.trace();
    console.log("Repair Order ID:", order?.id || "N/A");
    console.log("Product ID:", usage?.inventoryItemId || "N/A");
    console.log("Usage ID:", usageId);
    console.log("Current Quantity:", usage ? usage.quantity : 0);
    console.log("New Quantity:", usage ? usage.quantity - 1 : 0);

    removePartInternal(usageId, deviceIdx, 1);
    console.log("<-- EXIT decreasePart");
  }, [removePartInternal]);

  // 7. Full remove wrapper
  const removePart = useCallback((usageId: string, deviceIdx: number = 0) => {
    console.log("--> ENTER removePart", { usageId, deviceIdx });
    const order = selectedOrderRef.current;
    const allUsages = workshopUsagesRef.current;
    const usage = allUsages.find(pu => pu.id === usageId);

    console.log("========================\nWORKSHOP MUTATION\n========================");
    console.log("Timestamp:", new Date().toISOString());
    console.log("Operation: removePart");
    console.log("Caller:", new Error().stack?.split("\n")[2]?.trim() || "unknown");
    console.trace();
    console.log("Repair Order ID:", order?.id || "N/A");
    console.log("Product ID:", usage?.inventoryItemId || "N/A");
    console.log("Usage ID:", usageId);
    console.log("Current Quantity:", usage ? usage.quantity : 0);
    console.log("New Quantity:", 0);

    removePartInternal(usageId, deviceIdx, -1);
    console.log("<-- EXIT removePart");
  }, [removePartInternal]);

  return {
    visiblePartUsages,
    busyProductIds,
    partsTotal,
    addPart,
    increasePart,
    decreasePart,
    removePart,
    getUsageSellingUnitPrice
  };
}
