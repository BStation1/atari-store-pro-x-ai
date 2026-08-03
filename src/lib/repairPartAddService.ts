import { Product, RepairOrder, RepairPartUsage, SelectedRepairItem, WorkOwnershipType } from '../types';
import { db } from './db';
import { ensureProductUuidInSupabase, updateProductQuantityInSupabase, addInventoryMovementToSupabase } from './supabaseProducts';
import { addRepairPartUsageToSupabase, fetchOrMigrateRepairPartUsages, updateRepairPartUsageInSupabase } from './supabasePartUsages';
import { ensureRepairOrderUuidInSupabase, updateRepairOrderInSupabase } from './supabaseRepairOrders';
import { getUsageSellingUnitPrice, calculateSuggestedPriceForFaults } from './repairOrderCalculations';
import { usageMatchesOrder, usageMatchesDevice } from './accountingEngineV2';
import { addAuditLogRecordHelper, addTimelineEventHelper } from './repairLogging';
import { getDeviceDisplayName } from './customerDisplayHelper';
import { productMatchesRepairUsage } from './productIdentity';

export interface ExecuteAddPartUsageOptions {
  product: Product;
  deviceIdx: number;
  qty: number;
  selectedOrder: RepairOrder;
  products: Product[];
  partUsages: RepairPartUsage[];
  currentUserForAction?: any;
}

export interface ExecuteAddPartUsageResult {
  success: boolean;
  error?: string;
  updatedProducts?: Product[];
  updatedPartUsages?: RepairPartUsage[];
  updatedOrder?: RepairOrder;
  createdUsage?: RepairPartUsage;
}

export async function executeAddPartUsageTransaction(
  options: ExecuteAddPartUsageOptions
): Promise<ExecuteAddPartUsageResult> {
  const { product, deviceIdx, qty, selectedOrder, products, partUsages, currentUserForAction } = options;

  if (!selectedOrder || !selectedOrder.devices || !selectedOrder.devices[deviceIdx]) {
    return { success: false, error: "أمر الصيانة غير مكتمل أو الجهاز غير موجود" };
  }

  if (product.quantity < qty) {
    return { success: false, error: `المخزون المتاح من قطعة الغيار (${product.quantity}) غير كافٍ لصرف كمية (${qty})` };
  }

  const currentDevice = selectedOrder.devices[deviceIdx];
  const newQty = product.quantity - qty;
  const unitPurchaseCost = Number(product.purchasePrice || 0);
  const unitSellingPrice = Number(product.sellPrice || unitPurchaseCost);
  const totalCost = unitPurchaseCost * qty;
  const sellingTotal = unitSellingPrice * qty;

  const ownership = selectedOrder.workOwnershipType || WorkOwnershipType.CUSTOMER_SHARED;
  let owner: 'SHOP' | 'AHMED' | 'ABDO' = 'SHOP';
  if (ownership === WorkOwnershipType.PARTNER_1_PRIVATE) owner = 'AHMED';
  else if (ownership === WorkOwnershipType.PARTNER_2_PRIVATE) owner = 'ABDO';

  let createdUsage: RepairPartUsage | null = null;
  let isNewUsageCreated = false;
  let productUuid = product.id;
  let repairOrderUuid = selectedOrder.id;

  try {
    const [resolvedProdUuid, resolvedOrderUuid] = await Promise.all([
      ensureProductUuidInSupabase(product).then(val => val || product.id),
      ensureRepairOrderUuidInSupabase(selectedOrder).then(val => val || selectedOrder.id)
    ]);
    productUuid = resolvedProdUuid;
    repairOrderUuid = resolvedOrderUuid;

    // Refresh immediately before deciding whether to reuse a usage. The order
    // screen may still hold a pre-removal snapshot, especially after another
    // tab/device returned the part. Reusing that stale row can increment a
    // RETURNED usage and resurrect deleted invoice lines.
    const canonicalUsageResult = await fetchOrMigrateRepairPartUsages();
    const allUsages = canonicalUsageResult.success
      ? [...canonicalUsageResult.partUsages]
      : [...partUsages];
    const existingUsage = allUsages.find(
      pu => productMatchesRepairUsage(product, pu) &&
            pu.accountingStatus !== 'RETURNED' &&
            pu.accountingStatus !== 'REVERSED' &&
            usageMatchesOrder(pu, selectedOrder) &&
            usageMatchesDevice(pu, currentDevice, deviceIdx, selectedOrder.devices.length)
    );

    let updatedUsageList: RepairPartUsage[] = [];

    if (existingUsage) {
      const newUsageQty = existingUsage.quantity + qty;
      const newUsageTotalCost = newUsageQty * unitPurchaseCost;
      const newUsageSellingTotal = newUsageQty * unitSellingPrice;
      const usageUpdate = {
        quantity: newUsageQty,
        unitCost: unitPurchaseCost,
        totalCost: newUsageTotalCost,
        sellingPrice: unitSellingPrice,
        sellingTotal: newUsageSellingTotal
      };

      const ok = await updateRepairPartUsageInSupabase(existingUsage.id, usageUpdate, existingUsage);
      if (!ok) {
        throw new Error("فشل تحديث سجل قطعة الغيار بفي قاعدة البيانات");
      }

      createdUsage = {
        ...existingUsage,
        ...usageUpdate
      };
      updatedUsageList = allUsages.map(pu => pu.id === existingUsage.id ? createdUsage! : pu);
    } else {
      isNewUsageCreated = true;
      const usageToInsert = {
        repairOrderId: repairOrderUuid,
        inventoryItemId: productUuid,
        partName: product.nameAr || product.name,
        sku: product.sku || product.id,
        quantity: qty,
        unitCost: unitPurchaseCost,
        totalCost: totalCost,
        sellingPrice: unitSellingPrice,
        sellingTotal: sellingTotal,
        ownershipType: ownership,
        responsiblePartnerId: owner === 'AHMED' ? 'P-001' : owner === 'ABDO' ? 'P-002' : 'SHOP',
        accountingStatus: 'CONSUMED' as const,
        notes: `deviceId:${currentDevice.id || deviceIdx}`
      };

      createdUsage = await addRepairPartUsageToSupabase(usageToInsert);
      if (!createdUsage || !createdUsage.id) {
        throw new Error("فشل إنشاء سجل قطعة الغيار بقاعدة البيانات");
      }
      updatedUsageList = [...allUsages, createdUsage];
    }

    // Step 2: Create inventory movement
    const movementOk = await addInventoryMovementToSupabase({
      productId: productUuid,
      productNameSnapshot: product.nameAr || product.name,
      movementType: 'REPAIR_USAGE',
      quantityChange: -qty,
      previousQuantity: product.quantity,
      newQuantity: newQty,
      costPriceSnapshot: unitPurchaseCost,
      sellingPriceSnapshot: unitSellingPrice,
      totalCost: totalCost,
      referenceId: selectedOrder.id,
      repairOrderId: repairOrderUuid,
      owner: owner,
      notes: `صرف قطعة غيار صيانة: ${product.nameAr || product.name} للجهاز (${getDeviceDisplayName(currentDevice)})`,
      createdAt: new Date().toISOString()
    });

    if (!movementOk) {
      throw new Error("فشل تسكيل حركة صرف المخزون بقاعدة البيانات");
    }

    // Step 3: Update Product Quantity
    const stockOk = await updateProductQuantityInSupabase(productUuid, newQty);
    if (!stockOk) {
      throw new Error("فشل خصم الكمية من المخزون بقاعدة البيانات");
    }

    // Step 4: Add persisted part to device.selectedRepairItems using REAL persisted usage id
    const itemToPut: SelectedRepairItem = {
      id: createdUsage.id,
      usageId: createdUsage.id,
      productId: product.id,
      name: product.nameAr || product.name,
      quantity: createdUsage.quantity,
      costPrice: unitPurchaseCost,
      repairPrice: unitSellingPrice,
      salePrice: unitSellingPrice,
      deviceId: currentDevice.id,
      deviceIndex: deviceIdx
    };

    const activeUsageIdsForDevice = new Set(
      updatedUsageList
        .filter(
          pu => usageMatchesOrder(pu, selectedOrder) &&
                pu.accountingStatus !== 'RETURNED' &&
                pu.accountingStatus !== 'REVERSED' &&
                usageMatchesDevice(pu, currentDevice, deviceIdx, selectedOrder.devices.length)
        )
        .map(pu => pu.id)
    );
    const existingItems = (currentDevice.selectedRepairItems || []).filter(
      item => activeUsageIdsForDevice.has(item.usageId || item.id)
    );
    const existingItemIdx = existingItems.findIndex(
      i => i.usageId === createdUsage!.id || i.id === createdUsage!.id || (i.productId && (i.productId === product.id || i.productId === productUuid))
    );

    let nextSelectedRepairItems: SelectedRepairItem[];
    if (existingItemIdx >= 0) {
      nextSelectedRepairItems = existingItems.map((item, idx) => idx === existingItemIdx ? itemToPut : item);
    } else {
      nextSelectedRepairItems = [...existingItems, itemToPut];
    }

    // Recalculate partsCost and order totals
    const activeUsagesForDevice = updatedUsageList.filter(
      pu => usageMatchesOrder(pu, selectedOrder) &&
            pu.accountingStatus !== 'RETURNED' &&
            pu.accountingStatus !== 'REVERSED' &&
            usageMatchesDevice(pu, currentDevice, deviceIdx, selectedOrder.devices.length)
    );

    const newPartsCost = activeUsagesForDevice.reduce((sum, pu) => {
      const sellP = getUsageSellingUnitPrice(pu, products);
      return sum + (pu.quantity * sellP);
    }, 0);

    const tags = currentDevice.selectedQuickFaults || (currentDevice.issue ? currentDevice.issue.split(" - ").map(s => s.trim()) : []);
    const faultsCost = currentDevice.suggestedRepairPrice ?? calculateSuggestedPriceForFaults(tags);
    const newAutoPrice = faultsCost + newPartsCost;

    const updatedDevices = [...selectedOrder.devices];
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

    let updatedOrder: RepairOrder = {
      ...selectedOrder,
      devices: updatedDevices,
      totalEstimatedCost: totalFinal,
      finalRepairPrice: totalFinal
    };

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

    // Step 5: Await updateRepairOrderInSupabase and verify success
    const orderSaveOk = await updateRepairOrderInSupabase(updatedOrder);
    if (!orderSaveOk) {
      throw new Error("فشل حفظ بيانات أمر الصيانة والتحديثات بجدول الصيانة في الخادم");
    }

    // Success: Update local DB collections
    const updatedProductsList = products.map(p => p.id === product.id ? { ...p, quantity: newQty } : p);
    db.saveProducts(updatedProductsList);
    db.saveRepairPartUsages(updatedUsageList);

    const allOrders = db.getRepairOrders();
    const updatedOrdersList = allOrders.map(o => o.id === updatedOrder.id || o.uuid === updatedOrder.uuid ? updatedOrder : o);
    db.saveRepairOrders(updatedOrdersList);

    return {
      success: true,
      updatedProducts: updatedProductsList,
      updatedPartUsages: updatedUsageList,
      updatedOrder,
      createdUsage
    };

  } catch (err: any) {
    console.error("❌ Add part transaction failed, executing rollback:", err);

    // Rollback stock in Supabase
    try {
      await updateProductQuantityInSupabase(productUuid, product.quantity);
    } catch (rbErr) {
      console.warn("⚠️ Rollback stock failed:", rbErr);
    }

    // Rollback created usage if new
    if (isNewUsageCreated && createdUsage?.id) {
      try {
        await updateRepairPartUsageInSupabase(createdUsage.id, { accountingStatus: 'REVERSED' }, createdUsage);
      } catch (rbErr) {
        console.warn("⚠️ Rollback usage failed:", rbErr);
      }
    }

    return {
      success: false,
      error: err?.message || "تعذر إكمال عملية إضافة قطعة الغيار وحفظها بالخادم."
    };
  }
}
