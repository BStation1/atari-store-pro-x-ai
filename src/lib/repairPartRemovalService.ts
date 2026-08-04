import { Product, RepairOrder, RepairPartUsage, WorkOwnershipType, SelectedRepairItem } from '../types';
import { updateProductQuantityInSupabase, addInventoryMovementToSupabase } from './supabaseProducts';
import { updateRepairPartUsageInSupabase, addRepairPartUsageToSupabase } from './supabasePartUsages';
import { updateRepairOrderInSupabase } from './supabaseRepairOrders';
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

export async function executeRemovePartUsageTransaction(
  options: ExecuteRemovePartUsageOptions
): Promise<RemovePartUsageResult> {
  const { usageId, deviceIdx, removeQty = 1, selectedOrder, products, partUsages } = options;

  if (!selectedOrder) {
    return { success: false, error: 'لم يتم تحديد أمر الصيانة.' };
  }

  let usage = partUsages.find(pu => pu.id === usageId);
  if (!usage) {
    usage = partUsages.find(pu => pu.inventoryItemId === usageId && usageMatchesOrder(pu, selectedOrder) && pu.accountingStatus !== 'RETURNED');
  }

  // Idempotency safety: If no active usage found, check if it was already marked RETURNED
  if (!usage) {
    const alreadyReturned = partUsages.find(pu => (pu.id === usageId || pu.inventoryItemId === usageId) && usageMatchesOrder(pu, selectedOrder) && pu.accountingStatus === 'RETURNED');
    if (alreadyReturned) {
      return {
        success: true,
        updatedOrder: selectedOrder,
        updatedProducts: products,
        updatedPartUsages: partUsages,
        returnedQty: 0,
        isFullRemove: true
      };
    }
  }

  const targetDevice = selectedOrder.devices?.[deviceIdx];
  let isSyntheticFallbackItem = false;

  if (!usage && targetDevice?.selectedRepairItems) {
    const item = targetDevice.selectedRepairItems.find(
      i => i.id === usageId || i.usageId === usageId || i.productId === usageId || i.name === usageId
    );
    if (item) {
      isSyntheticFallbackItem = true;
      usage = {
        id: item.usageId || item.id || `usage-fallback-${Date.now()}`,
        repairOrderId: selectedOrder.id,
        inventoryItemId: item.productId || item.id || usageId,
        partName: item.name,
        sku: item.productId || item.id || usageId,
        quantity: item.quantity || 1,
        unitCost: item.costPrice || 0,
        totalCost: (item.costPrice || 0) * (item.quantity || 1),
        sellingPrice: item.repairPrice ?? item.salePrice ?? 0,
        sellingTotal: (item.repairPrice ?? item.salePrice ?? 0) * (item.quantity || 1),
        ownershipType: selectedOrder.workOwnershipType || WorkOwnershipType.CUSTOMER_SHARED,
        responsiblePartnerId: 'SHOP',
        accountingStatus: 'CONSUMED',
        createdAt: (selectedOrder as any).createdAt || new Date().toISOString()
      };
    }
  }

  if (!usage) {
    return { success: false, error: 'لم يتم العثور على استخدام قطعة الغيار.' };
  }

  // Idempotency: If usage is already marked RETURNED, consider it successfully processed
  if (usage.accountingStatus === 'RETURNED') {
    return {
      success: true,
      updatedOrder: selectedOrder,
      updatedProducts: products,
      updatedPartUsages: partUsages,
      returnedQty: 0,
      isFullRemove: true
    };
  }

  const product = products.find(p => 
    p.id === usage.inventoryItemId || 
    (p as any).uuid === usage.inventoryItemId || 
    (usage.sku && p.sku === usage.sku) || 
    (usage.partName && (p.nameAr === usage.partName || p.name === usage.partName))
  );
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

  // STEP A: Restore product stock ONLY if this was an actual consumed part usage (not synthetic fallback)
  const shouldRestoreStock = !isSyntheticFallbackItem && !!product;
  let stockUpdateResult: any = { ok: true };
  let stockOk = true;

  if (shouldRestoreStock && product) {
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

  let usageOk = true;
  if (isSyntheticFallbackItem) {
    const syntheticReturnedUsage: RepairPartUsage = {
      ...usage,
      accountingStatus: 'RETURNED'
    };
    await addRepairPartUsageToSupabase(syntheticReturnedUsage).catch(err => {
      console.warn("Notice saving synthetic returned usage to Supabase:", err);
    });
  } else {
    usageOk = await updateRepairPartUsageInSupabase(usage.id, usageUpdates);
  }

  const usageUpdateResult = { ok: usageOk, updates: usageUpdates };
  if (!usageOk) {
    return {
      success: false,
      error: 'فشل تحديث حالة استخدام قطعة الغيار إلى RETURNED في Supabase.',
      stockUpdateResult,
      usageUpdateResult
    };
  }

  // STEP C: Insert linked REPAIR_USAGE_RETURN movement ONLY if stock was restored
  let movementInsertResult: any = { ok: true };
  if (shouldRestoreStock) {
    const movementOk = await addInventoryMovementToSupabase(returnMovementPayload);
    movementInsertResult = { ok: movementOk, movement: returnMovementPayload };
    if (!movementOk) {
      return {
        success: false,
        error: 'فشل تسجيل حركة إرجاع المخزون REPAIR_USAGE_RETURN في Supabase.',
        stockUpdateResult,
        usageUpdateResult,
        movementInsertResult
      };
    }
  }

  // ALL SUCCEEDED -> NOW RECALCULATE LOCAL STATE & PERSIST ORDER
  let updatedProducts = products;
  if (shouldRestoreStock && product) {
    updatedProducts = products.map(p => 
      (p.id === product.id || (p as any).uuid === product.id || p.id === usage.inventoryItemId || (p as any).uuid === usage.inventoryItemId || (product.sku && p.sku === product.sku))
        ? { ...p, quantity: newProductQuantity }
        : p
    );
    db.saveProducts(updatedProducts);
  }

  let updatedPartUsages: RepairPartUsage[] = [];
  const targetUsageId = usage.id;
  if (isSyntheticFallbackItem) {
    const syntheticReturnedUsage: RepairPartUsage = {
      ...usage,
      accountingStatus: 'RETURNED'
    };
    const exists = partUsages.some(pu => pu.id === syntheticReturnedUsage.id);
    updatedPartUsages = exists
      ? partUsages.map(pu => pu.id === syntheticReturnedUsage.id ? syntheticReturnedUsage : pu)
      : [...partUsages, syntheticReturnedUsage];
  } else if (isFullRemove) {
    updatedPartUsages = partUsages.map(pu => (pu.id === targetUsageId || pu.id === usageId) ? { ...pu, accountingStatus: 'RETURNED' as const } : pu);
  } else {
    updatedPartUsages = partUsages.map(pu => (pu.id === targetUsageId || pu.id === usageId) ? { ...pu, ...usageUpdates } : pu);
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
      const isMatch = i.id === usageId ||
                      i.usageId === usageId ||
                      i.id === targetUsageId ||
                      i.usageId === targetUsageId ||
                      i.productId === usage.inventoryItemId ||
                      i.id === usage.inventoryItemId ||
                      i.name === usage.partName;
      if (isMatch) {
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

    await updateRepairOrderInSupabase(updatedOrder);
  }

  // Sync to local storage db
  if (product) {
    db.saveProducts(updatedProducts);
  }
  db.saveRepairPartUsages(updatedPartUsages);
  db.saveRepairOrders(
    db.getRepairOrders().map(o => o.id === updatedOrder.id ? updatedOrder : o)
  );

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_products' } }));
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_repair_part_usages' } }));
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_repair_orders' } }));
  }

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
