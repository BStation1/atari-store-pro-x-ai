import { useState, useRef, useEffect, useCallback, useMemo, Dispatch, SetStateAction } from "react";
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

  // 3. Add part logic
  const addPart = useCallback((productId: string, qtyToAdd: number = 1, deviceIdx: number = 0) => {
    const t0 = performance.now();
    console.log(`⏱️ [useWorkshopParts:AddPart] Click received for productId=${productId} at ${t0.toFixed(2)}ms`);

    const order = selectedOrderRef.current;
    if (!order) return;

    if (busyProductIds.has(productId)) {
      console.log(`[useWorkshopParts:AddPart] Product ${productId} is busy. Ignoring click.`);
      return;
    }

    const currentProducts = productsRef.current;
    const product = currentProducts.find(p => p.id === productId);
    if (!product) return;

    const qty = Math.max(1, Math.floor(qtyToAdd));
    if (product.quantity < qty) {
      dialog.alert({ message: "عفواً، هاته القطعة غير متوفرة بالمخزون حالياً!", variant: "error" });
      return;
    }

    const updatedDevices = [...order.devices];
    const currentDevice = updatedDevices[deviceIdx];
    if (!currentDevice) return;

    setBusyProductIds(prev => new Set(prev).add(productId));

    const unitSellingPrice = Number(product.sellPrice || product.price || product.purchasePrice) || 0;
    const unitPurchaseCost = Number(product.purchasePrice || product.costPrice) || 0;
    const totalCost = unitPurchaseCost * qty;

    const ownership = order.workOwnershipType || WorkOwnershipType.CUSTOMER_SHARED;
    let owner: 'SHOP' | 'AHMED' | 'ABDO' = 'SHOP';
    if (ownership === WorkOwnershipType.PARTNER_1_PRIVATE) owner = 'AHMED';
    else if (ownership === WorkOwnershipType.PARTNER_2_PRIVATE) owner = 'ABDO';

    // Optimistic Update: Product stock
    const newQty = product.quantity - qty;
    setProductLocal({
      ...product,
      quantity: newQty
    });

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

    let updatedUsageList = [...allUsages];
    let usageRecordToSave: RepairPartUsage;

    if (existingUsage) {
      const newUsageQty = existingUsage.quantity + qty;
      const newUsageTotalCost = newUsageQty * unitPurchaseCost;
      const newUsageSellingTotal = newUsageQty * unitSellingPrice;
      usageRecordToSave = {
        ...existingUsage,
        quantity: newUsageQty,
        unitCost: unitPurchaseCost,
        totalCost: newUsageTotalCost,
        sellingPrice: unitSellingPrice,
        sellingTotal: newUsageSellingTotal
      };
      updatedUsageList = allUsages.map(pu => pu.id === existingUsage.id ? usageRecordToSave : pu);
    } else {
      const tempId = `PU-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      usageRecordToSave = {
        id: tempId,
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

    // Recalculate device partsCost and grand total
    const activeUsagesForDevice = updatedUsageList.filter(
      pu => (orderIdsToMatch.has(String(pu.repairOrderId)) || pu.repairOrderId === order.id || String(pu.repairOrderId) === String(order.id)) &&
            pu.accountingStatus !== 'RETURNED' &&
            pu.accountingStatus !== 'REVERSED' &&
            ((pu.notes && pu.notes.includes(`deviceId:${currentDevice.id || deviceIdx}`)) || order.devices.length === 1)
    );

    const newPartsCost = activeUsagesForDevice.reduce((sum, pu) => {
      const sellP = getUsageSellingUnitPrice(pu, currentProducts);
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

    let updatedOrder: RepairOrder = {
      ...order,
      devices: updatedDevices,
      totalEstimatedCost: totalFinal,
      finalRepairPrice: totalFinal
    };

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

    // Background Supabase persistence
    (async () => {
      const tMutStart = performance.now();
      try {
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

        const [, , persistedUsage] = await Promise.all([
          quantityPromise,
          movementPromise,
          usagePromise,
          updateRepairOrderInSupabase(updatedOrder)
        ]);

        if (!existingUsage && persistedUsage?.id && persistedUsage.id !== usageRecordToSave.id) {
          replacePartUsageIdLocal(usageRecordToSave.id, {
            ...usageRecordToSave,
            ...persistedUsage,
            repairOrderId: order.id
          });
        }
      } catch (mutationError: any) {
        console.error("❌ [useWorkshopParts:AddPart] Background mutation failed, rolling back:", mutationError);
        // Rollback optimistic updates
        setProductLocal({ ...product, quantity: product.quantity });
        const currentUsages = partUsagesRef.current;
        if (existingUsage) {
          persistLocalUsages(currentUsages.map(u => u.id === existingUsage.id ? existingUsage : u));
        } else {
          persistLocalUsages(currentUsages.filter(u => u.id !== usageRecordToSave.id));
        }
        setSelectedOrder(order);
        setRepairOrderLocal(order);

        dialog.alert({
          message: "حدث خطأ أثناء حفظ قطعة الغيار بالخادم، تم إلغاء العملية وتحديث المخزون.",
          variant: "error"
        });
      } finally {
        setBusyProductIds(prev => {
          const next = new Set(prev);
          next.delete(productId);
          return next;
        });
      }
    })();
  }, [
    busyProductIds,
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

  // 5. Remove part logic (supports decreasing quantity or complete removal)
  const removePartInternal = useCallback((usageId: string, deviceIdx: number = 0, removeQty: number = 1) => {
    const order = selectedOrderRef.current;
    if (!order) return;

    const allUsages = partUsagesRef.current;
    const usage = allUsages.find(pu => pu.id === usageId);
    if (!usage) return;

    if (busyProductIds.has(usage.inventoryItemId)) return;
    setBusyProductIds(prev => new Set(prev).add(usage.inventoryItemId));

    const currentProducts = productsRef.current;
    const product = currentProducts.find(p => p.id === usage.inventoryItemId);

    const qtyToReturn = Math.min(usage.quantity, Math.max(1, removeQty));
    const isFullRemove = (usage.quantity <= qtyToReturn) || removeQty === -1;
    const actualReturnedQty = isFullRemove ? usage.quantity : qtyToReturn;

    // Optimistic Update: Stock
    if (product) {
      setProductLocal({
        ...product,
        quantity: product.quantity + actualReturnedQty
      });
    }

    // Optimistic Update: Usages
    let updatedUsages: RepairPartUsage[] = [];
    const newQty = usage.quantity - actualReturnedQty;
    const newTotalCost = newQty * usage.unitCost;
    const usageSellPrice = getUsageSellingUnitPrice(usage, currentProducts);
    const newSellingTotal = newQty * usageSellPrice;

    if (isFullRemove) {
      updatedUsages = allUsages.map(pu => {
        if (pu.id === usageId) {
          return { ...pu, accountingStatus: 'RETURNED' as const };
        }
        return pu;
      });
    } else {
      updatedUsages = allUsages.map(pu => {
        if (pu.id === usageId) {
          return {
            ...pu,
            quantity: newQty,
            totalCost: newTotalCost,
            sellingPrice: usageSellPrice,
            sellingTotal: newSellingTotal
          };
        }
        return pu;
      });
    }
    persistLocalUsages(updatedUsages);

    // Recalculate order totals
    const orderIdsToMatch = new Set<string>([
      String(order.id || ''),
      String((order as any).orderNumber || ''),
      String((order as any).uuid || ''),
      String(usage.repairOrderId || '')
    ].filter(Boolean));

    const updatedDevices = [...order.devices];
    const currentDevice = updatedDevices[deviceIdx];
    let updatedOrder: RepairOrder = order;

    if (currentDevice) {
      const remainingUsages = updatedUsages.filter(
        pu => orderIdsToMatch.has(String(pu.repairOrderId)) && pu.accountingStatus !== 'RETURNED' && pu.accountingStatus !== 'REVERSED'
      );
      const deviceRemainingUsages = remainingUsages.filter(
        pu => (pu.notes && pu.notes.includes(`deviceId:${currentDevice.id || deviceIdx}`)) || order.devices.length === 1
      );

      const newPartsCost = deviceRemainingUsages.reduce((sum, pu) => {
        const sellP = getUsageSellingUnitPrice(pu, currentProducts);
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

      updatedOrder = {
        ...order,
        devices: updatedDevices,
        totalEstimatedCost: totalFinal,
        finalRepairPrice: totalFinal
      };

      setSelectedOrder(updatedOrder);
      setRepairOrderLocal(updatedOrder);
    }

    // Background Supabase persistence
    (async () => {
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

        await Promise.all([
          quantityPromise,
          movementPromise,
          usagePromise,
          updateRepairOrderInSupabase(updatedOrder)
        ]);
      } catch (err) {
        console.error("❌ [useWorkshopParts:RemovePart] Background removal sync failed; rolling back:", err);
        if (product) setProductLocal(product);
        persistLocalUsages(allUsages);
        setSelectedOrder(order);
        setRepairOrderLocal(order);
        dialog.alert({
          message: "تعذر حفظ تعديل قطعة الغيار، وتمت إعادة الكمية والحساب للحالة السابقة.",
          variant: "error"
        });
      } finally {
        setBusyProductIds(prev => {
          const next = new Set(prev);
          next.delete(usage.inventoryItemId);
          return next;
        });
      }
    })();
  }, [
    busyProductIds,
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
