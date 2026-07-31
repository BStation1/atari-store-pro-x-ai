import { useState, useRef, useCallback, useMemo, Dispatch, SetStateAction } from "react";
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
  updateRepairPartUsageInSupabase
} from "../../lib/supabasePartUsages";
import {
  ensureRepairOrderUuidInSupabase,
  updateRepairOrderInSupabase
} from "../../lib/supabaseRepairOrders";
import {
  addTimelineEventHelper,
  addAuditLogRecordHelper
} from "../../lib/repairLogging";

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

/**
 * Pure helper function to recalculate repair order device partsCost and totals
 * based on a specific set of active part usages and products list.
 */
export function recalculateOrderTotals(
  order: RepairOrder,
  usages: RepairPartUsage[],
  deviceIdx: number = 0,
  productsList: Product[] = []
): RepairOrder {
  const orderIdsToMatch = new Set<string>([
    String(order.id || ''),
    String((order as any).orderNumber || ''),
    String((order as any).uuid || '')
  ].filter(Boolean));

  const updatedDevices = [...order.devices];
  const currentDevice = updatedDevices[deviceIdx];
  if (!currentDevice) return order;

  const activeUsagesForDevice = usages.filter(
    pu => (orderIdsToMatch.has(String(pu.repairOrderId)) || pu.repairOrderId === order.id || String(pu.repairOrderId) === String(order.id)) &&
          pu.accountingStatus !== 'RETURNED' &&
          pu.accountingStatus !== 'REVERSED' &&
          ((pu.notes && pu.notes.includes(`deviceId:${currentDevice.id || deviceIdx}`)) || order.devices.length === 1)
  );

  const newPartsCost = activeUsagesForDevice.reduce((sum, pu) => {
    const sellP = getUsageSellingUnitPrice(pu, productsList);
    return sum + (pu.quantity * sellP);
  }, 0);

  const tags = currentDevice.selectedQuickFaults || (currentDevice.issue ? currentDevice.issue.split(" - ").map(s => s.trim()) : []);
  const faultsCost = currentDevice.suggestedRepairPrice ?? calculateSuggestedPriceForFaults(tags);
  const newAutoPrice = faultsCost + newPartsCost;

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

  // 1. Calculate visible part usages for the current selected order / device
  const visiblePartUsages = useMemo(() => {
    const order = selectedOrder;
    if (!order) return [];

    const orderIdsToMatch = new Set<string>([
      String(order.id || ''),
      String((order as any).orderNumber || ''),
      String((order as any).uuid || '')
    ].filter(Boolean));

    const currentDevice = order.devices[0];

    return partUsages.filter(
      pu => (orderIdsToMatch.has(String(pu.repairOrderId)) || pu.repairOrderId === order.id || String(pu.repairOrderId) === String(order.id)) &&
            pu.accountingStatus !== 'RETURNED' &&
            pu.accountingStatus !== 'REVERSED' &&
            ((pu.notes && pu.notes.includes(`deviceId:${currentDevice?.id || 0}`)) || order.devices.length === 1)
    );
  }, [selectedOrder, partUsages]);

  // 2. Calculate parts total selling price
  const partsTotal = useMemo(() => {
    return visiblePartUsages.reduce((sum, pu) => {
      const sellP = getUsageSellingUnitPrice(pu, products);
      return sum + (pu.quantity * sellP);
    }, 0);
  }, [visiblePartUsages, products]);

  // 3. Add part logic with exact snapshot rollback & per-order queue
  const addPart = useCallback((productId: string, qtyToAdd: number = 1, deviceIdx: number = 0) => {
    const t0 = performance.now();
    console.log(`⏱️ [useWorkshopParts:AddPart] Click received for productId=${productId} at ${t0.toFixed(2)}ms`);

    const order = selectedOrderRef.current;
    if (!order) return;

    const currentProducts = productsRef.current;
    const product = currentProducts.find(p => p.id === productId);
    if (!product) return;

    const qty = Math.max(1, Math.floor(qtyToAdd));
    if (product.quantity < qty) {
      dialog.alert({ message: "عفواً، هاته القطعة غير متوفرة بالمخزون حالياً!", variant: "error" });
      return;
    }

    const currentDevice = order.devices[deviceIdx];
    if (!currentDevice) return;

    const unitSellingPrice = Number(product.sellPrice || product.price || product.purchasePrice) || 0;
    const unitPurchaseCost = Number(product.purchasePrice || product.costPrice) || 0;
    const totalCost = unitPurchaseCost * qty;

    const ownership = order.workOwnershipType || WorkOwnershipType.CUSTOMER_SHARED;
    let owner: 'SHOP' | 'AHMED' | 'ABDO' = 'SHOP';
    if (ownership === WorkOwnershipType.PARTNER_1_PRIVATE) owner = 'AHMED';
    else if (ownership === WorkOwnershipType.PARTNER_2_PRIVATE) owner = 'ABDO';

    const orderIdsToMatch = new Set<string>([
      String(order.id || ''),
      String((order as any).orderNumber || ''),
      String((order as any).uuid || '')
    ].filter(Boolean));

    const allUsages = partUsagesRef.current;
    const existingUsage = allUsages.find(
      pu => (orderIdsToMatch.has(String(pu.repairOrderId)) || pu.repairOrderId === order.id || String(pu.repairOrderId) === String(order.id)) &&
            (pu.inventoryItemId === product.id || ((product as any).uuid && pu.inventoryItemId === (product as any).uuid)) &&
            pu.accountingStatus !== 'RETURNED' &&
            pu.accountingStatus !== 'REVERSED' &&
            ((pu.notes && pu.notes.includes(`deviceId:${currentDevice.id || deviceIdx}`)) || order.devices.length === 1)
    );

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
      tempUsageId: existingUsage ? undefined : `PU-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
    };

    // 1. Synchronous Optimistic Update: Product Stock
    const newQty = product.quantity - qty;
    setProductLocal({
      ...product,
      quantity: newQty
    });

    // 2. Synchronous Optimistic Update: Part Usages
    let updatedUsageList = [...allUsages];
    let usageRecordToSave: RepairPartUsage;

    if (existingUsage) {
      const newUsageQty = existingUsage.quantity + qty;
      usageRecordToSave = {
        ...existingUsage,
        quantity: newUsageQty,
        unitCost: unitPurchaseCost,
        totalCost: newUsageQty * unitPurchaseCost,
        sellingPrice: unitSellingPrice,
        sellingTotal: newUsageQty * unitSellingPrice
      };
      updatedUsageList = allUsages.map(pu => pu.id === existingUsage.id ? usageRecordToSave : pu);
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
    }

    persistLocalUsages(updatedUsageList);

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
      try {
        // Debug testing hook: Force failure simulation if requested
        if (
          (window as any).__FORCE_FAIL_NEXT_ADD_PART__ ||
          ((window as any).__FORCE_FAIL_A__ && (product.id === 'PROD-A' || product.name.includes('A')))
        ) {
          (window as any).__FORCE_FAIL_NEXT_ADD_PART__ = false;
          (window as any).__FORCE_FAIL_A__ = false;
          throw new Error("FORCED_FAILURE_SIMULATION");
        }

        const [productUuid, repairOrderUuid] = await Promise.all([
          ensureProductUuidInSupabase(product).then(value => value || product.id),
          ensureRepairOrderUuidInSupabase(order).then(value => value || order.id)
        ]);

        const quantityPromise = updateProductQuantityInSupabase(productUuid, newQty);
        const movementPromise = addInventoryMovementToSupabase({
          productId: productUuid,
          productNameSnapshot: product.nameAr || product.name,
          movementType: 'REPAIR_USAGE',
          quantityChange: -qty,
          previousQuantity: product.quantity,
          newQuantity: newQty,
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
          usagePromise = updateRepairPartUsageInSupabase(existingUsage.id, {
            quantity: usageRecordToSave.quantity,
            unitCost: unitPurchaseCost,
            totalCost: usageRecordToSave.totalCost,
            sellingPrice: unitSellingPrice,
            sellingTotal: usageRecordToSave.sellingTotal
          });
        } else {
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
          ? recalculateOrderTotals(selectedOrderRef.current, partUsagesRef.current, deviceIdx, productsRef.current)
          : updatedOrder;

        const [, , persistedUsage] = await Promise.all([
          quantityPromise,
          movementPromise,
          usagePromise,
          updateRepairOrderInSupabase(latestOrderForDb)
        ]);

        if (!existingUsage && persistedUsage?.id && snapshot.tempUsageId && persistedUsage.id !== snapshot.tempUsageId) {
          replacePartUsageIdLocal(snapshot.tempUsageId, {
            ...usageRecordToSave,
            ...persistedUsage,
            repairOrderId: order.id
          });
        }
      } catch (mutationError: any) {
        console.error(`❌ [useWorkshopParts:AddPart] Mutation ${mutationId} failed, performing granular rollback:`, mutationError);

        // GRANULAR EXACT ROLLBACK:
        // 1. Revert product stock by -snapshot.qtyDelta
        const currentLatestProduct = productsRef.current.find(p => p.id === product.id) || product;
        const restoredProductQty = currentLatestProduct.quantity - snapshot.qtyDelta;
        setProductLocal({ ...currentLatestProduct, quantity: restoredProductQty });

        // 2. Revert usages: remove tempUsage or restore usageBefore
        const currentUsages = partUsagesRef.current;
        let revertedUsages: RepairPartUsage[];
        if (snapshot.usageBefore === null) {
          revertedUsages = currentUsages.filter(u => u.id !== snapshot.tempUsageId);
        } else {
          revertedUsages = currentUsages.map(u => u.id === snapshot.usageBefore!.id ? snapshot.usageBefore! : u);
        }
        persistLocalUsages(revertedUsages);

        // 3. Recalculate order totals based on current order state & reverted usages (preserving all other concurrent mutations!)
        const currentLatestOrder = selectedOrderRef.current || order;
        const rolledBackOrder = recalculateOrderTotals(currentLatestOrder, revertedUsages, deviceIdx, productsRef.current);
        setSelectedOrder(rolledBackOrder);
        setRepairOrderLocal(rolledBackOrder);

        try {
          await updateRepairOrderInSupabase(rolledBackOrder);
        } catch (dbErr) {
          console.error("Failed to sync rolled back order to Supabase:", dbErr);
        }

        dialog.alert({
          message: "حدث خطأ أثناء حفظ قطعة الغيار بالخادم، تم إلغاء العملية وتحديث المخزون.",
          variant: "error"
        });
      } finally {
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
  }, [
    dialog,
    persistLocalUsages,
    replacePartUsageIdLocal,
    setProductLocal,
    setRepairOrderLocal,
    setSelectedOrder
  ]);

  // 4. Increase part alias
  const increasePart = useCallback((productId: string, deviceIdx: number = 0) => {
    addPart(productId, 1, deviceIdx);
  }, [addPart]);

  // 5. Remove part logic (supports decreasing quantity or complete removal) with granular rollback
  const removePartInternal = useCallback((usageId: string, deviceIdx: number = 0, removeQty: number = 1) => {
    const order = selectedOrderRef.current;
    if (!order) return;

    const allUsages = partUsagesRef.current;
    const usage = allUsages.find(pu => pu.id === usageId);
    if (!usage) return;

    const currentProducts = productsRef.current;
    const product = currentProducts.find(p => p.id === usage.inventoryItemId);

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
    } else {
      updatedUsages = allUsages.map(pu => pu.id === usageId ? {
        ...pu,
        quantity: newQty,
        totalCost: newTotalCost,
        sellingPrice: usageSellPrice,
        sellingTotal: newSellingTotal
      } : pu);
    }
    persistLocalUsages(updatedUsages);

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
        const quantityPromise = product
          ? updateProductQuantityInSupabase(product.id, product.quantity + actualReturnedQty)
          : Promise.resolve();

        const ownership = order.workOwnershipType || WorkOwnershipType.CUSTOMER_SHARED;
        let owner: 'SHOP' | 'AHMED' | 'ABDO' = 'SHOP';
        if (ownership === WorkOwnershipType.PARTNER_1_PRIVATE) owner = 'AHMED';
        else if (ownership === WorkOwnershipType.PARTNER_2_PRIVATE) owner = 'ABDO';

        const movementPromise = addInventoryMovementToSupabase({
          id: `MOV-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          productId: usage.inventoryItemId,
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
          repairOrderId: order.id,
          owner: owner,
          notes: `إرجاع قطعة غيار صيانة للمخزن: ${usage.partName}`,
          createdAt: new Date().toISOString()
        });

        let usagePromise: Promise<any>;
        if (isFullRemove) {
          usagePromise = updateRepairPartUsageInSupabase(usageId, { accountingStatus: 'RETURNED' });
        } else {
          usagePromise = updateRepairPartUsageInSupabase(usageId, {
            quantity: newQty,
            totalCost: newTotalCost,
            sellingPrice: usageSellPrice,
            sellingTotal: newSellingTotal
          });
        }

        const latestOrderForDb = selectedOrderRef.current
          ? recalculateOrderTotals(selectedOrderRef.current, partUsagesRef.current, deviceIdx, productsRef.current)
          : updatedOrder;

        await Promise.all([
          quantityPromise,
          movementPromise,
          usagePromise,
          updateRepairOrderInSupabase(latestOrderForDb)
        ]);
      } catch (err) {
        console.error(`❌ [useWorkshopParts:RemovePart] Mutation ${mutationId} failed, performing granular rollback:`, err);

        // GRANULAR EXACT ROLLBACK:
        // 1. Revert product stock by -snapshot.qtyDelta
        if (product) {
          const currentLatestProduct = productsRef.current.find(p => p.id === product.id) || product;
          const restoredProductQty = currentLatestProduct.quantity - snapshot.qtyDelta;
          setProductLocal({ ...currentLatestProduct, quantity: restoredProductQty });
        }

        // 2. Revert usage
        const currentUsages = partUsagesRef.current;
        const revertedUsages = currentUsages.map(u => u.id === usageId ? snapshot.usageBefore : u);
        persistLocalUsages(revertedUsages);

        // 3. Recalculate order totals
        const currentLatestOrder = selectedOrderRef.current || order;
        const rolledBackOrder = recalculateOrderTotals(currentLatestOrder, revertedUsages, deviceIdx, productsRef.current);
        setSelectedOrder(rolledBackOrder);
        setRepairOrderLocal(rolledBackOrder);

        try {
          await updateRepairOrderInSupabase(rolledBackOrder);
        } catch (dbErr) {
          console.error("Failed to sync rolled back order to Supabase:", dbErr);
        }

        dialog.alert({
          message: "تعذر حفظ تعديل قطعة الغيار، وتمت إعادة الكمية والحساب للحالة السابقة.",
          variant: "error"
        });
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
  }, [
    dialog,
    persistLocalUsages,
    setProductLocal,
    setRepairOrderLocal,
    setSelectedOrder
  ]);

  // 6. Decrease quantity wrapper (reduces by 1)
  const decreasePart = useCallback((usageId: string, deviceIdx: number = 0) => {
    removePartInternal(usageId, deviceIdx, 1);
  }, [removePartInternal]);

  // 7. Full remove wrapper
  const removePart = useCallback((usageId: string, deviceIdx: number = 0) => {
    removePartInternal(usageId, deviceIdx, -1);
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
