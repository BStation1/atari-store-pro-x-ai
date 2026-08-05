import { Product, RepairOrder, RepairPartUsage, WorkOwnershipType, SelectedRepairItem } from '../types';
import { updateProductQuantityInSupabase, addInventoryMovementToSupabase } from './supabaseProducts';
import { updateRepairPartUsageInSupabase } from './supabasePartUsages';
import { updateRepairOrderInSupabaseStrict } from './supabaseRepairOrders';
import { calculateSuggestedPriceForFaults, getUsageSellingUnitPrice } from './repairOrderCalculations';
import { usageMatchesDevice, usageMatchesOrder } from './accountingEngineV2';
import { db } from './db';
import { findProductForRepairUsage } from './productIdentity';

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
 * Repair usages may store the remote Supabase UUID while the UI still holds a
 * local product id. Match all stable identifiers so a full removal can always
 * restore the correct stock item.
 */
export { findProductForRepairUsage } from './productIdentity';

export async function executeRemovePartUsageTransaction(
  options: ExecuteRemovePartUsageOptions
): Promise<RemovePartUsageResult> {
  const { usageId, deviceIdx, removeQty = 1, selectedOrder, products, partUsages } = options;

  if (!selectedOrder) {
    return { success: false, error: 'لم يتم تحديد أمر الصيانة.' };
  }

  const usage = partUsages.find(pu => pu.id === usageId);
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

  const product = findProductForRepairUsage(products, usage);
  if (!product) {
    return {
      success: false,
      error: `تعذر العثور على قطعة المخزون المرتبطة (${usage.sku || usage.partName}). لم يتم حذفها حتى لا تضيع كمية المخزون.`
    };
  }
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
    productId: usage.inventoryItemId || (product as Product & { uuid?: string }).uuid || product.id,
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
  stockOk = await updateProductQuantityInSupabase(product.id, newProductQuantity, product);
  stockUpdateResult = { ok: stockOk, newQuantity: newProductQuantity };
  if (!stockOk) {
    return {
      success: false,
      error: 'فشل إرجاع الكمية إلى المخزون في Supabase. لم يتم حذف القطعة من أمر الصيانة.',
      stockUpdateResult
    };
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

  const usageOk = await updateRepairPartUsageInSupabase(usageId, usageUpdates, usage);
  const usageUpdateResult = { ok: usageOk, updates: usageUpdates };
  if (!usageOk) {
    await updateProductQuantityInSupabase(product.id, previousProductQty, product);
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
    await updateRepairPartUsageInSupabase(usageId, {
      quantity: usage.quantity,
      totalCost: usage.totalCost,
      sellingPrice: usage.sellingPrice,
      sellingTotal: usage.sellingTotal,
      accountingStatus: usage.accountingStatus
    }, usage);
    await updateProductQuantityInSupabase(product.id, previousProductQty, product);
    return {
      success: false,
      error: 'فشل تسجيل حركة إرجاع المخزون REPAIR_USAGE_RETURN في Supabase.',
      stockUpdateResult,
      usageUpdateResult,
      movementInsertResult
    };
  }

  // ALL THREE SUCCEEDED -> NOW RECALCULATE LOCAL STATE & PERSIST ORDER
  let updatedProducts = products;
  updatedProducts = products.map(p => p.id === product.id ? { ...p, quantity: newProductQuantity } : p);

  let updatedPartUsages: RepairPartUsage[] = [];
  if (isFullRemove) {
    updatedPartUsages = partUsages.map(pu => pu.id === usageId ? { ...pu, accountingStatus: 'RETURNED' as const } : pu);
  } else {
    updatedPartUsages = partUsages.map(pu => pu.id === usageId ? { ...pu, ...usageUpdates } : pu);
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
      if (i.id === usageId || i.usageId === usageId) {
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

    const orderSaveOk = await updateRepairOrderInSupabaseStrict(updatedOrder);
    if (!orderSaveOk) {
      // Restore the remote usage and stock first. The RETURN movement is
      // append-only, so add an equal outgoing movement to neutralize it.
      await updateRepairPartUsageInSupabase(usageId, {
        quantity: usage.quantity,
        totalCost: usage.totalCost,
        sellingPrice: usage.sellingPrice,
        sellingTotal: usage.sellingTotal,
        accountingStatus: usage.accountingStatus
      }, usage);
      await updateProductQuantityInSupabase(product.id, previousProductQty, product);
      await addInventoryMovementToSupabase({
        productId: usage.inventoryItemId || (product as Product & { uuid?: string }).uuid || product.id,
        productNameSnapshot: usage.partName,
        movementType: 'REPAIR_USAGE',
        usageType: 'REPAIR_USAGE',
        quantityChange: -actualReturnedQty,
        previousQuantity: newProductQuantity,
        newQuantity: previousProductQty,
        costPriceSnapshot: usage.unitCost,
        sellingPriceSnapshot: usageSellPrice,
        totalCost: usage.unitCost * actualReturnedQty,
        referenceId: selectedOrder.id,
        repairOrderId: selectedOrder.id,
        owner,
        notes: `عكس إرجاع فاشل بعد تعذر حفظ أمر الصيانة: ${usage.partName}`,
        createdAt: new Date().toISOString()
      });
      return {
        success: false,
        error: 'فشل حفظ أمر الصيانة بعد إرجاع القطعة، وتم عكس تغييرات المخزون وسجل الاستخدام.',
        stockUpdateResult,
        usageUpdateResult,
        movementInsertResult
      };
    }
  }

  // Sync to local storage db
  db.saveProducts(updatedProducts);
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
