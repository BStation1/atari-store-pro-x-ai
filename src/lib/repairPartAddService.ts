import { Product, RepairOrder, RepairPartUsage, SelectedRepairItem, WorkOwnershipType } from '../types';
import { db } from './db';
import { ensureProductUuidInSupabase, updateProductQuantityInSupabase, addInventoryMovementToSupabase } from './supabaseProducts';
import { addRepairPartUsageToSupabase, fetchRepairPartUsagesForOrderId, updateRepairPartUsageInSupabase } from './supabasePartUsages';
import { ensureRepairOrderUuidInSupabase, updateRepairOrderInSupabaseStrict } from './supabaseRepairOrders';
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
  let previousUsageSnapshot: RepairPartUsage | null = null;
  let movementCreated = false;
  let stockChanged = false;
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
    const canonicalUsageResult = await fetchRepairPartUsagesForOrderId(repairOrderUuid);
    const usagesOutsideOrder = partUsages.filter(pu => !usageMatchesOrder(pu, selectedOrder));
    const allUsages = canonicalUsageResult.success
      ? [...usagesOutsideOrder, ...canonicalUsageResult.partUsages]
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
      previousUsageSnapshot = { ...existingUsage };
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
      throw new Error("فشل تسجيل حركة صرف المخزون بقاعدة البيانات");
    }
    movementCreated = true;

    // Step 3: Update Product Quantity
    const stockOk = await updateProductQuantityInSupabase(productUuid, newQty);
    if (!stockOk) {
      throw new Error("فشل خصم الكمية من المخزون بقاعدة البيانات");
    }
    stockChanged = true;

    // Step 4: Rebuild the complete device snapshot from canonical active
    // usages. Never append to the React snapshot because two quick additions
    // may have started from the same old order object.
    const activeUsagesForDevice = updatedUsageList.filter(
      pu => usageMatchesOrder(pu, selectedOrder) &&
            pu.accountingStatus !== 'RETURNED' &&
            pu.accountingStatus !== 'REVERSED' &&
            usageMatchesDevice(pu, currentDevice, deviceIdx, selectedOrder.devices.length)
    );

    const nextSelectedRepairItems: SelectedRepairItem[] = activeUsagesForDevice.map(pu => {
      const matchedProduct = products.find(candidate => productMatchesRepairUsage(candidate, pu));
      const sellPrice = getUsageSellingUnitPrice(pu, products);
      return {
        id: pu.id,
        usageId: pu.id,
        productId: matchedProduct?.id || pu.inventoryItemId,
        name: pu.partName,
        quantity: pu.quantity,
        costPrice: pu.unitCost,
        repairPrice: sellPrice,
        salePrice: sellPrice,
        deviceId: currentDevice.id,
        deviceIndex: deviceIdx
      };
    });

    // Recalculate partsCost and order totals

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
    const orderSaveOk = await updateRepairOrderInSupabaseStrict(updatedOrder);
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

    // Roll back only the remote steps that actually succeeded.
    if (stockChanged) {
      try {
        const stockRollbackOk = await updateProductQuantityInSupabase(productUuid, product.quantity, product);
        if (!stockRollbackOk) console.warn("⚠️ Rollback stock returned false");
      } catch (rbErr) {
        console.warn("⚠️ Rollback stock failed:", rbErr);
      }
    }

    // Restore an updated usage to its exact previous values, or reverse a newly
    // created usage. This prevents a failed order save from leaving quantity
    // and accounting totals ahead of the real stock state.
    if (createdUsage?.id) {
      try {
        if (isNewUsageCreated) {
          await updateRepairPartUsageInSupabase(
            createdUsage.id,
            { accountingStatus: 'REVERSED' },
            createdUsage
          );
        } else if (previousUsageSnapshot) {
          await updateRepairPartUsageInSupabase(
            createdUsage.id,
            {
              quantity: previousUsageSnapshot.quantity,
              unitCost: previousUsageSnapshot.unitCost,
              totalCost: previousUsageSnapshot.totalCost,
              sellingPrice: previousUsageSnapshot.sellingPrice,
              sellingTotal: previousUsageSnapshot.sellingTotal,
              accountingStatus: previousUsageSnapshot.accountingStatus
            },
            createdUsage
          );
        }
      } catch (rbErr) {
        console.warn("⚠️ Rollback usage failed:", rbErr);
      }
    }

    // Inventory movements are append-only. Compensate a created outgoing row
    // with a linked RETURN row so reports net the failed operation back to zero.
    if (movementCreated) {
      try {
        const compensationOk = await addInventoryMovementToSupabase({
          productId: productUuid,
          productNameSnapshot: product.nameAr || product.name,
          movementType: 'RETURN',
          usageType: 'REPAIR_USAGE_RETURN',
          quantityChange: qty,
          previousQuantity: newQty,
          newQuantity: product.quantity,
          costPriceSnapshot: unitPurchaseCost,
          sellingPriceSnapshot: 0,
          totalCost,
          referenceId: selectedOrder.id,
          repairOrderId: repairOrderUuid,
          owner,
          notes: `عكس صرف فاشل لقطعة صيانة: ${product.nameAr || product.name}`,
          createdAt: new Date().toISOString()
        });
        if (!compensationOk) console.warn("⚠️ Rollback movement compensation returned false");
      } catch (rbErr) {
        console.warn("⚠️ Rollback movement compensation failed:", rbErr);
      }
    }

    return {
      success: false,
      error: err?.message || "تعذر إكمال عملية إضافة قطعة الغيار وحفظها بالخادم."
    };
  }
}
