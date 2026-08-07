import { Product, RepairOrder, RepairPartUsage, WorkOwnershipType, SelectedRepairItem } from '../types';
import { updateProductQuantityInSupabase, addInventoryMovementToSupabase } from './supabaseProducts';
import { updateRepairPartUsageInSupabase } from './supabasePartUsages';
import { updateRepairOrderInSupabaseStrict } from './supabaseRepairOrders';
import { calculateSuggestedPriceForFaults, getUsageSellingUnitPrice } from './repairOrderCalculations';
import { usageMatchesDevice, usageMatchesOrder } from './accountingEngineV2';
import { db } from './db';

export interface ExecuteRemovePartUsageOptions {
  usageId: string;
  deviceIdx: number;
  removeQty?: number; // 1 by default, or -1 for full remove
  selectedOrder: RepairOrder;
  products: Product[];
  partUsages: RepairPartUsage[];
}

export interface RemovePartUsageResult {
  success: boolean;
  updatedOrder?: RepairOrder;
  updatedProducts?: Product[];
  updatedPartUsages?: RepairPartUsage[];
  returnedQty?: number;
  isFullRemove?: boolean;
  error?: string;
  stockUpdateResult?: any;
  usageUpdateResult?: any;
  movementInsertResult?: any;
  returnMovementRow?: any;
}

/**
  * Safely finds a product matching a repair part usage record using stable identifiers
  */
export function findProductForRepairUsage(products: Product[], usage: RepairPartUsage): Product | undefined {
  if (!usage || !products || products.length === 0) return undefined;

  // 1. Direct match on inventoryItemId against product.id or product.uuid
  if (usage.inventoryItemId) {
    const match = products.find(p => p.id === usage.inventoryItemId || (p as any).uuid === usage.inventoryItemId);
    if (match) return match;
  }

  // 2. Match on SKU
  if (usage.sku) {
    const match = products.find(p => p.sku === usage.sku);
    if (match) return match;
  }

  // 3. Match usage.id against product.id
  if (usage.id) {
    const match = products.find(p => p.id === usage.id || (p as any).uuid === usage.id);
    if (match) return match;
  }

  // 4. Fallback name match
  if (usage.partName) {
    const match = products.find(p => p.name === usage.partName);
    if (match) return match;
  }

  return undefined;
}

export interface ResolveCanonicalUsageOptions {
  clickedId: string;
  deviceIdx: number;
  selectedOrder: RepairOrder;
  products: Product[];
  partUsages: RepairPartUsage[];
}

export interface ResolveCanonicalUsageResult {
  usage?: RepairPartUsage;
  error?: string;
  isAmbiguous?: boolean;
}

/**
 * Safely resolves a clicked item / usage identifier to a single, canonical, active RepairPartUsage database record.
 */
export function resolveCanonicalRepairPartUsage(
  options: ResolveCanonicalUsageOptions
): ResolveCanonicalUsageResult {
  const { clickedId, deviceIdx, selectedOrder, products, partUsages } = options;

  if (!selectedOrder) {
    return { error: 'لم يتم تحديد أمر الصيانة.' };
  }

  const currentDevice = selectedOrder.devices[deviceIdx];
  const items = currentDevice?.selectedRepairItems || (currentDevice as any)?.technicalProcedures || [];

  // 1. Identify target item (if clickedId is fallback-X or item.id/usageId/productId)
  let targetItem: SelectedRepairItem | undefined = undefined;

  if (clickedId.startsWith('fallback-')) {
    const idxStr = clickedId.replace('fallback-', '');
    const fallbackIdx = parseInt(idxStr, 10);
    if (!isNaN(fallbackIdx) && items[fallbackIdx]) {
      targetItem = items[fallbackIdx];
    } else {
      return { error: 'تعذر تحديد كود قطعة الغيار المطلوب إرجاعها من أمر الصيانة.' };
    }
  } else {
    targetItem = items.find((i: any) => i.id === clickedId || i.usageId === clickedId || i.productId === clickedId);
  }

  // 2. Filter active candidates belonging to current repair order
  const activeOrderUsages = partUsages.filter(pu =>
    pu.accountingStatus !== 'RETURNED' &&
    pu.accountingStatus !== 'REVERSED' &&
    usageMatchesOrder(pu, selectedOrder)
  );

  if (activeOrderUsages.length === 0) {
    return { error: 'تعذر تحديد كود قطعة الغيار المطلوب إرجاعها من أمر الصيانة (لا يوجد سجلات استخدام نشطة في قاعدة البيانات).' };
  }

  // 3. Direct match by usage.id if clickedId is a real usage ID
  if (!clickedId.startsWith('fallback-')) {
    const directMatch = activeOrderUsages.find(pu => pu.id === clickedId);
    if (directMatch) {
      return { usage: directMatch };
    }
  }

  // 4. Match by targetItem.usageId if present
  if (targetItem?.usageId) {
    const usageByItemUsageId = activeOrderUsages.find(pu => pu.id === targetItem!.usageId);
    if (usageByItemUsageId) {
      return { usage: usageByItemUsageId };
    }
  }

  // 5. Match by product identity (productId / SKU / UUID)
  const productIdToMatch = targetItem?.productId || (!clickedId.startsWith('fallback-') ? clickedId : undefined);
  const skuToMatch = (targetItem as any)?.sku;

  let candidateUsages: RepairPartUsage[] = [];

  if (productIdToMatch || skuToMatch) {
    const matchedProduct = products.find(p =>
      (productIdToMatch && (p.id === productIdToMatch || (p as any).uuid === productIdToMatch)) ||
      (skuToMatch && p.sku === skuToMatch)
    );

    const productIds = new Set<string>();
    if (productIdToMatch) productIds.add(productIdToMatch);
    if (matchedProduct?.id) productIds.add(matchedProduct.id);
    if ((matchedProduct as any)?.uuid) productIds.add((matchedProduct as any).uuid);

    const skus = new Set<string>();
    if (skuToMatch) skus.add(skuToMatch);
    if (matchedProduct?.sku) skus.add(matchedProduct.sku);

    candidateUsages = activeOrderUsages.filter(pu => {
      const matchProdId = pu.inventoryItemId && productIds.has(pu.inventoryItemId);
      const matchSku = pu.sku && skus.has(pu.sku);
      return matchProdId || matchSku;
    });
  }

  // Prefer candidates matching the current device
  if (candidateUsages.length > 1 && currentDevice) {
    const deviceMatches = candidateUsages.filter(pu =>
      usageMatchesDevice(pu, currentDevice, deviceIdx, selectedOrder.devices.length)
    );
    if (deviceMatches.length > 0) {
      candidateUsages = deviceMatches;
    }
  }

  // Fallback: If 0 candidate usages matched product ID directly, check if there is a unique usage for current device
  if (candidateUsages.length === 0 && currentDevice) {
    const deviceUsages = activeOrderUsages.filter(pu =>
      usageMatchesDevice(pu, currentDevice, deviceIdx, selectedOrder.devices.length)
    );
    if (deviceUsages.length === 1) {
      candidateUsages = deviceUsages;
    }
  }

  if (candidateUsages.length === 1) {
    return { usage: candidateUsages[0] };
  }

  if (candidateUsages.length > 1) {
    return {
      error: 'توجد أكثر من قطعة غيار مطابقة في أمر الصيانة. تعذر التحديد الدقيق لتفادي الأخطاء.',
      isAmbiguous: true
    };
  }

  return {
    error: 'تعذر تحديد كود قطعة الغيار المطلوب إرجاعها من أمر الصيانة.'
  };
}

export async function executeRemovePartUsageTransaction(
  options: ExecuteRemovePartUsageOptions
): Promise<RemovePartUsageResult> {
  const { usageId, deviceIdx, removeQty = 1, selectedOrder, products, partUsages } = options;

  if (!selectedOrder) {
    return { success: false, error: 'لم يتم تحديد أمر الصيانة.' };
  }

  // 1. Strictly resolve canonical usage record without synthetic fallbacks
  const resolved = resolveCanonicalRepairPartUsage({
    clickedId: usageId,
    deviceIdx,
    selectedOrder,
    products,
    partUsages
  });

  if (!resolved.usage) {
    return {
      success: false,
      error: resolved.error || 'لم يتم العثور على استخدام قطعة الغيار المطلوب إرجاعها في قاعدة البيانات.'
    };
  }

  const usage = resolved.usage;

  // Idempotency: If usage is already marked RETURNED or REVERSED, do not double-return stock
  if (usage.accountingStatus === 'RETURNED' || usage.accountingStatus === 'REVERSED') {
    return {
      success: true,
      updatedOrder: selectedOrder,
      updatedProducts: products,
      updatedPartUsages: partUsages,
      returnedQty: 0,
      isFullRemove: true
    };
  }

  const product = findProductForRepairUsage(products, usage);
  const qtyToReturn = Math.min(usage.quantity, Math.max(1, removeQty === -1 ? usage.quantity : removeQty));
  const isFullRemove = usage.quantity <= qtyToReturn || removeQty === -1;
  const actualReturnedQty = isFullRemove ? usage.quantity : qtyToReturn;
  const newQty = usage.quantity - actualReturnedQty;
  const newTotalCost = newQty * usage.unitCost;
  const usageSellPrice = getUsageSellingUnitPrice(usage, products);
  const newSellingTotal = newQty * usageSellPrice;

  const previousProductQty = product ? product.quantity : 0;
  const newProductQuantity = previousProductQty + actualReturnedQty;

  const ownership = selectedOrder.workOwnershipType || WorkOwnershipType.CUSTOMER_SHARED;
  let owner: 'SHOP' | 'AHMED' | 'ABDO' = 'SHOP';
  if (ownership === WorkOwnershipType.PARTNER_1_PRIVATE) owner = 'AHMED';
  else if (ownership === WorkOwnershipType.PARTNER_2_PRIVATE) owner = 'ABDO';

  const returnMovementPayload = {
    id: `MOV-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
    productId: usage.inventoryItemId,
    productNameSnapshot: usage.partName,
    movementType: 'RETURN' as const,
    usageType: 'REPAIR_USAGE_RETURN' as const,
    quantityChange: actualReturnedQty,
    previousQuantity: previousProductQty,
    newQuantity: newProductQuantity,
    costPriceSnapshot: usage.unitCost,
    sellingPriceSnapshot: 0,
    totalCost: usage.unitCost * actualReturnedQty,
    referenceId: selectedOrder.id,
    repairOrderId: selectedOrder.id,
    owner: owner,
    notes: `إرجاع قطعة غيار صيانة للمخزن: ${usage.partName}`,
    createdAt: new Date().toISOString()
  };

  // STEP A: Restore product stock
  let stockUpdateResult: any = { ok: true };
  let stockOk = true;
  if (product) {
    stockOk = await updateProductQuantityInSupabase(product.id, newProductQuantity);
    stockUpdateResult = { ok: stockOk, newQuantity: newProductQuantity };
    if (!stockOk) {
      return {
        success: false,
        error: 'فشل تحديث مخزون المنتج في Supabase.',
        stockUpdateResult
      };
    }
  }

  // STEP B: Mark usage RETURNED or update quantity
  let usageUpdates: Partial<RepairPartUsage> = {};
  if (isFullRemove) {
    usageUpdates = { accountingStatus: 'RETURNED' };
  } else {
    usageUpdates = {
      quantity: newQty,
      totalCost: newTotalCost,
      sellingPrice: usageSellPrice,
      sellingTotal: newSellingTotal
    };
  }

  const usageOk = await updateRepairPartUsageInSupabase(usage.id, usageUpdates);
  const usageUpdateResult = { ok: usageOk, updates: usageUpdates };
  if (!usageOk) {
    // ROLLBACK C: Restore stock to exact previous quantity if usage update fails
    if (product) {
      await updateProductQuantityInSupabase(product.id, previousProductQty);
    }
    return {
      success: false,
      error: 'فشل تحديث حالة استخدام قطعة الغيار إلى RETURNED في Supabase.',
      stockUpdateResult,
      usageUpdateResult
    };
  }

  // STEP C: Insert linked REPAIR_USAGE_RETURN movement
  const movementOk = await addInventoryMovementToSupabase(returnMovementPayload);
  const movementInsertResult = { ok: movementOk, movement: returnMovementPayload };
  if (!movementOk) {
    // ROLLBACK D: Restore both usage state AND stock quantity if movement insert fails
    const previousUsageState: Partial<RepairPartUsage> = {
      quantity: usage.quantity,
      totalCost: usage.totalCost,
      sellingPrice: usage.sellingPrice,
      sellingTotal: usage.sellingTotal,
      accountingStatus: usage.accountingStatus
    };
    await updateRepairPartUsageInSupabase(usage.id, previousUsageState);
    if (product) {
      await updateProductQuantityInSupabase(product.id, previousProductQty);
    }
    return {
      success: false,
      error: 'فشل تسجيل حركة إرجاع المخزون REPAIR_USAGE_RETURN في Supabase.',
      stockUpdateResult,
      usageUpdateResult,
      movementInsertResult
    };
  }

  // STEP D: Calculate local state updates & persist repair order strictly
  let updatedProducts = products;
  if (product) {
    updatedProducts = products.map(p => p.id === product.id ? { ...p, quantity: newProductQuantity } : p);
  }

  let updatedPartUsages: RepairPartUsage[] = [];
  if (isFullRemove) {
    updatedPartUsages = partUsages.map(pu => pu.id === usage.id ? { ...pu, accountingStatus: 'RETURNED' as const } : pu);
  } else {
    updatedPartUsages = partUsages.map(pu => pu.id === usage.id ? { ...pu, ...usageUpdates } : pu);
  }

  const updatedDevices = [...selectedOrder.devices];
  const currentDevice = updatedDevices[deviceIdx];
  let updatedOrder: RepairOrder = selectedOrder;

  if (currentDevice) {
    const remainingUsages = updatedPartUsages.filter(
      pu => usageMatchesOrder(pu, selectedOrder) && pu.accountingStatus !== 'RETURNED' && pu.accountingStatus !== 'REVERSED'
    );
    const deviceRemainingUsages = remainingUsages.filter(
      pu => usageMatchesDevice(pu, currentDevice, deviceIdx, selectedOrder.devices.length)
    );

    const newPartsCost = deviceRemainingUsages.reduce((sum, pu) => {
      const sellP = getUsageSellingUnitPrice(pu, products);
      return sum + (pu.quantity * sellP);
    }, 0);

    const nextSelectedRepairItems = (currentDevice.selectedRepairItems || []).map(i => {
      if (i.id === usage.id || i.usageId === usage.id || (usage.inventoryItemId && i.productId === usage.inventoryItemId)) {
        if (isFullRemove) return null;
        return { ...i, quantity: newQty, repairPrice: usageSellPrice, salePrice: usageSellPrice };
      }
      return i;
    }).filter(Boolean) as SelectedRepairItem[];

    const tags = currentDevice.selectedQuickFaults || (currentDevice.issue ? currentDevice.issue.split(" - ").map(s => s.trim()) : []);
    const faultsCost = currentDevice.suggestedRepairPrice ?? calculateSuggestedPriceForFaults(tags);
    const newAutoPrice = faultsCost + newPartsCost;

    if (currentDevice.isPriceManuallyEdited) {
      updatedDevices[deviceIdx] = {
        ...currentDevice,
        selectedRepairItems: nextSelectedRepairItems,
        partsCost: newPartsCost,
        priceOverrideAcknowledged: false
      };
    } else {
      updatedDevices[deviceIdx] = {
        ...currentDevice,
        selectedRepairItems: nextSelectedRepairItems,
        partsCost: newPartsCost,
        finalRepairPrice: newAutoPrice,
        estimatedCost: newAutoPrice
      };
    }

    const totalFinal = updatedDevices.reduce((sum, d) => sum + (d.finalRepairPrice ?? d.estimatedCost ?? 0), 0);

    updatedOrder = {
      ...selectedOrder,
      devices: updatedDevices,
      totalEstimatedCost: totalFinal,
      finalRepairPrice: totalFinal
    };
  }

  // Strict repair order persistence in Supabase
  const saveResult = await updateRepairOrderInSupabaseStrict(updatedOrder);
  if (!saveResult.success) {
    // ROLLBACK E: Restore usage state, restore stock, and neutralize/reverse RETURN movement
    const previousUsageState: Partial<RepairPartUsage> = {
      quantity: usage.quantity,
      totalCost: usage.totalCost,
      sellingPrice: usage.sellingPrice,
      sellingTotal: usage.sellingTotal,
      accountingStatus: usage.accountingStatus
    };
    await updateRepairPartUsageInSupabase(usage.id, previousUsageState);
    if (product) {
      await updateProductQuantityInSupabase(product.id, previousProductQty);
    }

    const compensatingMovementPayload = {
      id: `MOV-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      productId: usage.inventoryItemId,
      productNameSnapshot: usage.partName,
      movementType: 'USAGE' as const,
      usageType: 'REPAIR_USAGE' as const,
      quantityChange: -actualReturnedQty,
      previousQuantity: newProductQuantity,
      newQuantity: previousProductQty,
      costPriceSnapshot: usage.unitCost,
      sellingPriceSnapshot: 0,
      totalCost: usage.unitCost * actualReturnedQty,
      referenceId: selectedOrder.id,
      repairOrderId: selectedOrder.id,
      owner: owner,
      notes: `عكس إرجاع قطعة غيار صيانة (فشل حفظ أمر الصيانة): ${usage.partName}`,
      createdAt: new Date().toISOString()
    };
    await addInventoryMovementToSupabase(compensatingMovementPayload);

    return {
      success: false,
      error: saveResult.error || 'فشل حفظ أمر الصيانة في Supabase بعد خصم القطعة.',
      stockUpdateResult,
      usageUpdateResult,
      movementInsertResult
    };
  }

  if (saveResult.updatedOrder) {
    updatedOrder = saveResult.updatedOrder;
  }

  // Sync to local storage db
  if (product) {
    db.saveProducts(updatedProducts);
  }
  db.saveRepairPartUsages(updatedPartUsages);
  db.saveRepairOrders(
    db.getRepairOrders().map(o => o.id === updatedOrder.id ? updatedOrder : o)
  );

  return {
    success: true,
    updatedOrder,
    updatedProducts,
    updatedPartUsages,
    returnedQty: actualReturnedQty,
    isFullRemove,
    stockUpdateResult,
    usageUpdateResult,
    movementInsertResult,
    returnMovementRow: returnMovementPayload
  };
}
