import { Product, RepairOrder, RepairPartUsage, WorkOwnershipType, SelectedRepairItem } from '../types';
import { updateProductQuantityInSupabase, addInventoryMovementToSupabase } from './supabaseProducts';
import { updateRepairPartUsageInSupabase } from './supabasePartUsages';
import { deleteRepairPartUsageInSupabase, restoreRepairPartUsageInSupabase } from './repairPartUsageDeletion';
import { updateRepairOrderInSupabaseStrict } from './supabaseRepairOrders';
import { calculateSuggestedPriceForFaults, getUsageSellingUnitPrice } from './repairOrderCalculations';
import { usageMatchesDevice, usageMatchesOrder } from './accountingEngineV2';
import { db } from './db';

export interface ExecuteRemovePartUsageOptions {
  usageId: string;
  deviceIdx: number;
  removeQty?: number;
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

export function findProductForRepairUsage(products: Product[], usage: RepairPartUsage): Product | undefined {
  if (!usage || !products?.length) return undefined;
  if (usage.inventoryItemId) {
    const direct = products.find(p => p.id === usage.inventoryItemId || (p as any).uuid === usage.inventoryItemId);
    if (direct) return direct;
  }
  if (usage.sku) {
    const bySku = products.find(p => p.sku === usage.sku);
    if (bySku) return bySku;
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

export function resolveCanonicalRepairPartUsage(options: ResolveCanonicalUsageOptions): ResolveCanonicalUsageResult {
  const { clickedId, deviceIdx, selectedOrder, products, partUsages } = options;
  if (!selectedOrder) return { error: 'لم يتم تحديد أمر الصيانة.' };

  const currentDevice = selectedOrder.devices[deviceIdx];
  const items = currentDevice?.selectedRepairItems || (currentDevice as any)?.technicalProcedures || [];
  let targetItem: SelectedRepairItem | undefined;

  if (clickedId.startsWith('fallback-')) {
    const fallbackIdx = parseInt(clickedId.replace('fallback-', ''), 10);
    if (!isNaN(fallbackIdx) && items[fallbackIdx]) targetItem = items[fallbackIdx];
    else return { error: 'تعذر تحديد قطعة الغيار المطلوب إرجاعها.' };
  } else {
    targetItem = items.find((i: any) => i.id === clickedId || i.usageId === clickedId || i.productId === clickedId);
  }

  const activeOrderUsages = partUsages.filter(pu =>
    Number(pu.quantity || 0) > 0 &&
    pu.accountingStatus !== 'RETURNED' &&
    pu.accountingStatus !== 'REVERSED' &&
    usageMatchesOrder(pu, selectedOrder)
  );

  if (!clickedId.startsWith('fallback-')) {
    const direct = activeOrderUsages.find(pu => pu.id === clickedId);
    if (direct) return { usage: direct };
  }

  if (targetItem?.usageId) {
    const byUsageId = activeOrderUsages.find(pu => pu.id === targetItem!.usageId);
    if (byUsageId) return { usage: byUsageId };
  }

  const productId = targetItem?.productId || (!clickedId.startsWith('fallback-') ? clickedId : undefined);
  const matchedProduct = products.find(p => productId && (p.id === productId || (p as any).uuid === productId));
  const ids = new Set<string>();
  if (productId) ids.add(productId);
  if (matchedProduct?.id) ids.add(matchedProduct.id);
  if ((matchedProduct as any)?.uuid) ids.add((matchedProduct as any).uuid);

  let candidates = activeOrderUsages.filter(pu => pu.inventoryItemId && ids.has(pu.inventoryItemId));
  if (candidates.length > 1 && currentDevice) {
    const deviceMatches = candidates.filter(pu => usageMatchesDevice(pu, currentDevice, deviceIdx, selectedOrder.devices.length));
    if (deviceMatches.length) candidates = deviceMatches;
  }

  if (candidates.length === 1) return { usage: candidates[0] };
  if (candidates.length > 1) return { error: 'توجد أكثر من قطعة غيار مطابقة. تم إيقاف الحذف لتفادي إرجاع قطعة خاطئة.', isAmbiguous: true };
  return { error: 'تعذر تحديد سجل استخدام قطعة الغيار الحقيقي في قاعدة البيانات.' };
}

export async function executeRemovePartUsageTransaction(options: ExecuteRemovePartUsageOptions): Promise<RemovePartUsageResult> {
  const { usageId, deviceIdx, removeQty = 1, selectedOrder, products, partUsages } = options;
  if (!selectedOrder) return { success: false, error: 'لم يتم تحديد أمر الصيانة.' };

  const resolved = resolveCanonicalRepairPartUsage({ clickedId: usageId, deviceIdx, selectedOrder, products, partUsages });
  if (!resolved.usage) return { success: false, error: resolved.error || 'لم يتم العثور على استخدام قطعة الغيار المطلوب إرجاعها.' };

  const usage = resolved.usage;
  if (Number(usage.quantity || 0) <= 0 || usage.accountingStatus === 'RETURNED' || usage.accountingStatus === 'REVERSED') {
    return { success: true, updatedOrder: selectedOrder, updatedProducts: products, updatedPartUsages: partUsages, returnedQty: 0, isFullRemove: true };
  }

  const product = findProductForRepairUsage(products, usage);
  if (!product) return { success: false, error: 'تعذر ربط قطعة الغيار بسجل المنتج الحقيقي في المخزون. تم إيقاف الحذف بدون تغيير أي بيانات.' };

  const requestedQty = removeQty === -1 ? usage.quantity : Math.max(1, removeQty);
  const actualReturnedQty = Math.min(usage.quantity, requestedQty);
  const newUsageQty = Math.max(0, usage.quantity - actualReturnedQty);
  const isFullRemove = newUsageQty === 0;
  const usageSellPrice = getUsageSellingUnitPrice(usage, products);
  const previousProductQty = Number(product.quantity || 0);
  const newProductQuantity = previousProductQty + actualReturnedQty;

  const ownership = selectedOrder.workOwnershipType || WorkOwnershipType.CUSTOMER_SHARED;
  let owner: 'SHOP' | 'AHMED' | 'ABDO' = 'SHOP';
  if (ownership === WorkOwnershipType.PARTNER_1_PRIVATE) owner = 'AHMED';
  else if (ownership === WorkOwnershipType.PARTNER_2_PRIVATE) owner = 'ABDO';

  const partialUsageUpdates: Partial<RepairPartUsage> = {
    quantity: newUsageQty,
    unitCost: usage.unitCost,
    totalCost: newUsageQty * usage.unitCost,
    sellingPrice: usageSellPrice,
    sellingTotal: newUsageQty * usageSellPrice
  };

  // Build the final local state BEFORE waiting on Supabase. This makes the UI react immediately.
  const updatedProducts = products.map(p => p.id === product.id ? { ...p, quantity: newProductQuantity } : p);
  const updatedPartUsages = isFullRemove
    ? partUsages.filter(pu => pu.id !== usage.id)
    : partUsages.map(pu => pu.id === usage.id ? { ...pu, ...partialUsageUpdates } : pu);

  const updatedDevices = [...selectedOrder.devices];
  const currentDevice = updatedDevices[deviceIdx];
  let updatedOrder: RepairOrder = selectedOrder;

  if (currentDevice) {
    const remainingUsages = updatedPartUsages.filter(pu =>
      usageMatchesOrder(pu, selectedOrder) && Number(pu.quantity || 0) > 0 && pu.accountingStatus !== 'RETURNED' && pu.accountingStatus !== 'REVERSED'
    );
    const deviceRemainingUsages = remainingUsages.filter(pu => usageMatchesDevice(pu, currentDevice, deviceIdx, selectedOrder.devices.length));

    const newPartsSaleTotal = deviceRemainingUsages.reduce((sum, pu) => sum + (Number(pu.quantity || 0) * getUsageSellingUnitPrice(pu, products)), 0);
    const canonicalPartsCostTotal = remainingUsages.reduce((sum, pu) => sum + (Number(pu.quantity || 0) * Number(pu.unitCost || 0)), 0);

    const nextSelectedRepairItems = (currentDevice.selectedRepairItems || []).map(i => {
      const matches = i.id === usage.id || i.usageId === usage.id || (usage.inventoryItemId && i.productId === usage.inventoryItemId);
      if (!matches) return i;
      if (isFullRemove) return null;
      return { ...i, quantity: newUsageQty, repairPrice: usageSellPrice, salePrice: usageSellPrice };
    }).filter(Boolean) as SelectedRepairItem[];

    const tags = currentDevice.selectedQuickFaults || (currentDevice.issue ? currentDevice.issue.split(' - ').map(s => s.trim()) : []);
    const faultsCost = currentDevice.suggestedRepairPrice ?? calculateSuggestedPriceForFaults(tags);
    const newAutoPrice = faultsCost + newPartsSaleTotal;

    updatedDevices[deviceIdx] = currentDevice.isPriceManuallyEdited
      ? { ...currentDevice, selectedRepairItems: nextSelectedRepairItems, partsCost: newPartsSaleTotal, priceOverrideAcknowledged: false }
      : { ...currentDevice, selectedRepairItems: nextSelectedRepairItems, partsCost: newPartsSaleTotal, finalRepairPrice: newAutoPrice, estimatedCost: newAutoPrice };

    const totalFinal = updatedDevices.reduce((sum, d) => sum + (d.finalRepairPrice ?? d.estimatedCost ?? 0), 0);
    updatedOrder = {
      ...selectedOrder,
      devices: updatedDevices,
      totalEstimatedCost: totalFinal,
      finalRepairPrice: totalFinal,
      partsCostTotal: canonicalPartsCostTotal,
      parts_cost_total: canonicalPartsCostTotal
    } as RepairOrder;
  }

  const previousLocalProducts = products;
  const previousLocalUsages = partUsages;
  const previousLocalOrder = selectedOrder;

  const saveLocalOptimisticState = () => {
    db.saveProducts(updatedProducts);
    db.saveRepairPartUsages(updatedPartUsages);
    db.saveRepairOrders(db.getRepairOrders().map(o => o.id === updatedOrder.id ? updatedOrder : o));
  };

  const rollbackLocalOptimisticState = () => {
    db.saveProducts(previousLocalProducts);
    db.saveRepairPartUsages(previousLocalUsages);
    db.saveRepairOrders(db.getRepairOrders().map(o => o.id === previousLocalOrder.id ? previousLocalOrder : o));
  };

  // Optimistic UI: publish the expected result immediately. Remote work continues below.
  saveLocalOptimisticState();

  let usageMutationOk = false;
  let deletedSnapshot: RepairPartUsage | undefined;
  if (isFullRemove) {
    const deleteResult = await deleteRepairPartUsageInSupabase(usage.id);
    usageMutationOk = deleteResult.success;
    deletedSnapshot = deleteResult.deleted || usage;
  } else {
    usageMutationOk = await updateRepairPartUsageInSupabase(usage.id, partialUsageUpdates);
  }

  const usageUpdateResult = { ok: usageMutationOk, mode: isFullRemove ? 'DELETE' : 'UPDATE', updates: isFullRemove ? undefined : partialUsageUpdates };
  if (!usageMutationOk) {
    rollbackLocalOptimisticState();
    return {
      success: false,
      error: isFullRemove ? 'فشل حذف سجل استخدام قطعة الغيار من Supabase.' : 'فشل تحديث كمية استخدام قطعة الغيار في Supabase.',
      usageUpdateResult
    };
  }

  const rollbackUsage = async () => {
    if (isFullRemove) {
      await restoreRepairPartUsageInSupabase(deletedSnapshot || usage);
    } else {
      await updateRepairPartUsageInSupabase(usage.id, {
        quantity: usage.quantity,
        unitCost: usage.unitCost,
        totalCost: usage.totalCost,
        sellingPrice: usage.sellingPrice,
        sellingTotal: usage.sellingTotal
      });
    }
  };

  const stockOk = await updateProductQuantityInSupabase(product.id, newProductQuantity);
  const stockUpdateResult = { ok: stockOk, newQuantity: newProductQuantity };
  if (!stockOk) {
    await rollbackUsage();
    rollbackLocalOptimisticState();
    return { success: false, error: 'فشل إرجاع الكمية إلى المخزون في Supabase، وتم التراجع عن تعديل الاستخدام.', stockUpdateResult, usageUpdateResult };
  }

  const returnMovementPayload = {
    id: crypto.randomUUID(),
    productId: usage.inventoryItemId || product.id,
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
    repairOrderId: (selectedOrder as any).uuid || (selectedOrder as any).databaseId || selectedOrder.id,
    owner,
    notes: `إرجاع قطعة غيار صيانة للمخزن: ${usage.partName}`,
    createdAt: new Date().toISOString()
  };

  const movementOk = await addInventoryMovementToSupabase(returnMovementPayload);
  const movementInsertResult = { ok: movementOk, movement: returnMovementPayload };
  if (!movementOk) {
    await updateProductQuantityInSupabase(product.id, previousProductQty);
    await rollbackUsage();
    rollbackLocalOptimisticState();
    return { success: false, error: 'فشل تسجيل حركة إرجاع المخزون في Supabase، وتم التراجع عن التغييرات.', stockUpdateResult, usageUpdateResult, movementInsertResult };
  }

  const saveResult = await updateRepairOrderInSupabaseStrict(updatedOrder);
  if (!saveResult.success) {
    await updateProductQuantityInSupabase(product.id, previousProductQty);
    await rollbackUsage();
    await addInventoryMovementToSupabase({
      id: crypto.randomUUID(),
      productId: usage.inventoryItemId || product.id,
      productNameSnapshot: usage.partName,
      movementType: 'REPAIR_USAGE' as const,
      usageType: 'REPAIR_USAGE' as const,
      quantityChange: -actualReturnedQty,
      previousQuantity: newProductQuantity,
      newQuantity: previousProductQty,
      costPriceSnapshot: usage.unitCost,
      sellingPriceSnapshot: 0,
      totalCost: usage.unitCost * actualReturnedQty,
      referenceId: selectedOrder.id,
      repairOrderId: (selectedOrder as any).uuid || (selectedOrder as any).databaseId || selectedOrder.id,
      owner,
      notes: `عكس حركة إرجاع قطعة غيار بسبب فشل حفظ أمر الصيانة: ${usage.partName}`,
      createdAt: new Date().toISOString()
    });
    rollbackLocalOptimisticState();

    return { success: false, error: saveResult.error || 'فشل حفظ أمر الصيانة بعد إرجاع القطعة، وتم التراجع عن العملية.', stockUpdateResult, usageUpdateResult, movementInsertResult };
  }

  if (saveResult.updatedOrder) updatedOrder = saveResult.updatedOrder;

  // Re-save the canonical successful state in case Supabase hydration added fields.
  db.saveProducts(updatedProducts);
  db.saveRepairPartUsages(updatedPartUsages);
  db.saveRepairOrders(db.getRepairOrders().map(o => o.id === updatedOrder.id ? updatedOrder : o));

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
