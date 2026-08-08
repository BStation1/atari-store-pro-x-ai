import { Product, RepairOrder, RepairPartUsage, SelectedRepairItem, WorkOwnershipType } from '../types';
import { db } from './db';
import { ensureProductUuidInSupabase, updateProductQuantityInSupabase, addInventoryMovementToSupabase } from './supabaseProducts';
import { addRepairPartUsageToSupabase, updateRepairPartUsageInSupabase } from './supabasePartUsages';
import { ensureRepairOrderUuidInSupabase, updateRepairOrderInSupabaseStrict } from './supabaseRepairOrders';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { getUsageSellingUnitPrice, calculateSuggestedPriceForFaults } from './repairOrderCalculations';
import { usageMatchesOrder, usageMatchesDevice } from './accountingEngineV2';
import { addAuditLogRecordHelper, addTimelineEventHelper } from './repairLogging';
import { getDeviceDisplayName } from './customerDisplayHelper';
import { calculateActiveRepairPartsCostTotal, syncRepairOrderPartsCostTotal } from './repairOrderPartsCostSync';

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
  const resolvedProd = products.find(p => p.id === product.id) || product;
  const unitPurchaseCost = Number(
    product.purchasePrice ||
    (product as any).costPrice ||
    (product as any).cost_price ||
    resolvedProd.purchasePrice ||
    (resolvedProd as any).costPrice ||
    (resolvedProd as any).cost_price ||
    0
  );
  const unitSellingPrice = Number(product.sellPrice || (product as any).price || (product as any).sellingPrice || unitPurchaseCost);
  const totalCost = unitPurchaseCost * qty;
  const sellingTotal = unitSellingPrice * qty;

  const ownership = selectedOrder.workOwnershipType || WorkOwnershipType.CUSTOMER_SHARED;
  let owner: 'SHOP' | 'AHMED' | 'ABDO' = 'SHOP';
  if (ownership === WorkOwnershipType.PARTNER_1_PRIVATE) owner = 'AHMED';
  else if (ownership === WorkOwnershipType.PARTNER_2_PRIVATE) owner = 'ABDO';

  let createdUsage: RepairPartUsage | null = null;
  let createdUsageId: string | null = null;
  let createdMovementId: string | null = null;
  let isNewUsageCreated = false;
  let isStockUpdated = false;
  let productUuid: string = product.id;
  let repairOrderUuid: string = selectedOrder.id;
  let previousExistingUsage: RepairPartUsage | null = null;
  let updatedExistingUsageId: string | null = null;

  try {
    // STEP A: Ensure canonical product exists remotely
    const resolvedProdUuid = await ensureProductUuidInSupabase(product);
    if (!resolvedProdUuid) {
      throw new Error("فشل الربط بقاعدة بيانات المنتجات في الخادم Supabase");
    }
    productUuid = resolvedProdUuid;

    // Ensure repair order exists remotely
    const resolvedOrderUuid = await ensureRepairOrderUuidInSupabase(selectedOrder);
    if (!resolvedOrderUuid) {
      throw new Error("فشل الربط بقاعدة بيانات أوامر الصيانة في الخادم Supabase");
    }
    repairOrderUuid = resolvedOrderUuid;

    // Start with the local cache, but NEVER trust it as the authority for deciding whether to INSERT.
    // A stale local cache was the source of duplicate repair_part_usages rows in production.
    const allUsages = [...partUsages];
    let existingUsage = allUsages.find(
      pu => (pu.inventoryItemId === product.id || pu.inventoryItemId === productUuid) &&
            pu.accountingStatus !== 'RETURNED' &&
            pu.accountingStatus !== 'REVERSED' &&
            usageMatchesOrder(pu, selectedOrder) &&
            usageMatchesDevice(pu, currentDevice, deviceIdx, selectedOrder.devices.length)
    );

    // Server-side duplicate guard: query the actual production table before any INSERT.
    // The live schema does not store a device id, so the canonical uniqueness scope is
    // repair_order_id + inventory_item_id for active (quantity > 0) usage rows.
    if (isSupabaseConfigured) {
      const { data: remoteUsageRows, error: remoteUsageError } = await supabase
        .from('repair_part_usages')
        .select('id,repair_order_id,inventory_item_id,part_name_snapshot,quantity,cost_price_snapshot,selling_price_snapshot,stock_ownership_snapshot,created_at')
        .eq('repair_order_id', repairOrderUuid)
        .eq('inventory_item_id', productUuid)
        .gt('quantity', 0)
        .order('created_at', { ascending: true });

      if (remoteUsageError) {
        throw new Error(`تعذر التحقق من سجلات استخدام قطعة الغيار الحالية في Supabase: ${remoteUsageError.message}`);
      }

      if ((remoteUsageRows || []).length > 1) {
        throw new Error('يوجد أكثر من سجل استخدام نشط لنفس قطعة الغيار في أمر الصيانة. تم إيقاف الإضافة لمنع تكرار إضافي. يلزم تنظيف السجلات المكررة أولاً.');
      }

      if (remoteUsageRows && remoteUsageRows.length === 1) {
        const row: any = remoteUsageRows[0];
        const remoteUsage: RepairPartUsage = {
          id: String(row.id),
          repairOrderId: String(row.repair_order_id),
          inventoryItemId: String(row.inventory_item_id),
          partName: String(row.part_name_snapshot || product.nameAr || product.name || ''),
          sku: product.sku || product.id,
          quantity: Number(row.quantity || 0),
          unitCost: Number(row.cost_price_snapshot || unitPurchaseCost || 0),
          totalCost: Number(row.quantity || 0) * Number(row.cost_price_snapshot || unitPurchaseCost || 0),
          sellingPrice: Number(row.selling_price_snapshot || unitSellingPrice || 0),
          sellingTotal: Number(row.quantity || 0) * Number(row.selling_price_snapshot || unitSellingPrice || 0),
          ownershipType: ownership,
          responsiblePartnerId: owner === 'AHMED' ? 'P-001' : owner === 'ABDO' ? 'P-002' : 'SHOP',
          accountingStatus: 'CONSUMED',
          createdAt: row.created_at || new Date().toISOString(),
          notes: `deviceId:${currentDevice.id || deviceIdx}`
        } as RepairPartUsage;

        existingUsage = remoteUsage;
        const localIdx = allUsages.findIndex(pu => pu.id === remoteUsage.id);
        if (localIdx >= 0) {
          allUsages[localIdx] = { ...allUsages[localIdx], ...remoteUsage };
        } else {
          allUsages.push(remoteUsage);
        }
      } else {
        // No active remote row means a stale local row must never prevent a clean INSERT decision.
        existingUsage = undefined;
      }
    }

    let updatedUsageList: RepairPartUsage[] = [];

    // STEP B: Insert or update repair_part_usage with canonical remote product ID
    if (existingUsage) {
      previousExistingUsage = { ...existingUsage };
      updatedExistingUsageId = existingUsage.id;

      const effectiveUnitCost = unitPurchaseCost > 0 ? unitPurchaseCost : (existingUsage.unitCost || 0);
      const newUsageQty = existingUsage.quantity + qty;
      const newUsageTotalCost = newUsageQty * effectiveUnitCost;
      const newUsageSellingTotal = newUsageQty * unitSellingPrice;
      const usageUpdate = {
        quantity: newUsageQty,
        unitCost: effectiveUnitCost,
        totalCost: newUsageTotalCost,
        sellingPrice: unitSellingPrice,
        sellingTotal: newUsageSellingTotal
      };

      const ok = await updateRepairPartUsageInSupabase(existingUsage.id, usageUpdate);
      if (!ok) {
        throw new Error("فشل تحديث سجل قطعة الغيار في قاعدة البيانات Supabase");
      }

      createdUsage = {
        ...existingUsage,
        ...usageUpdate
      };
      const existingLocalIdx = allUsages.findIndex(pu => pu.id === existingUsage.id);
      if (existingLocalIdx >= 0) {
        updatedUsageList = allUsages.map(pu => pu.id === existingUsage!.id ? createdUsage! : pu);
      } else {
        updatedUsageList = [...allUsages, createdUsage];
      }
    } else {
      isNewUsageCreated = true;
      const generatedUsageId = crypto.randomUUID();
      createdUsageId = generatedUsageId;

      const usageToInsert = {
        id: generatedUsageId,
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
        throw new Error("فشل إنشاء سجل قطعة الغيار بقاعدة البيانات Supabase");
      }
      updatedUsageList = [...allUsages, createdUsage];
    }

    // STEP C: Insert REPAIR_USAGE inventory movement
    const generatedMovementId = crypto.randomUUID();
    createdMovementId = generatedMovementId;

    const movementOk = await addInventoryMovementToSupabase({
      id: generatedMovementId,
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
      throw new Error("فشل تسجيل حركة صرف المخزون بقاعدة البيانات Supabase");
    }

    // STEP D: Update remote product stock quantity
    const stockOk = await updateProductQuantityInSupabase(productUuid, newQty);
    if (!stockOk) {
      throw new Error("فشل خصم الكمية من المخزون بقاعدة البيانات Supabase");
    }
    isStockUpdated = true;

    // STEP E: Persist repair order snapshot
    const itemToPut: SelectedRepairItem = {
      id: createdUsage.id,
      usageId: createdUsage.id,
      productId: productUuid,
      name: product.nameAr || product.name,
      quantity: createdUsage.quantity,
      costPrice: unitPurchaseCost,
      repairPrice: unitSellingPrice,
      salePrice: unitSellingPrice,
      deviceId: currentDevice.id,
      deviceIndex: deviceIdx
    };

    const existingItems = currentDevice.selectedRepairItems || [];
    const existingItemIdx = existingItems.findIndex(
      i => i.usageId === createdUsage!.id || i.id === createdUsage!.id || (i.productId && (i.productId === product.id || i.productId === productUuid))
    );

    let nextSelectedRepairItems: SelectedRepairItem[];
    if (existingItemIdx >= 0) {
      nextSelectedRepairItems = existingItems.map((item, idx) => idx === existingItemIdx ? itemToPut : item);
    } else {
      nextSelectedRepairItems = [...existingItems, itemToPut];
    }

    // Recalculate partsCost and order totals. Device partsCost is a sale-price total for UI pricing.
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

    const canonicalPartsCostTotal = calculateActiveRepairPartsCostTotal(updatedUsageList, selectedOrder, repairOrderUuid);

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
      finalRepairPrice: totalFinal,
      partsCostTotal: canonicalPartsCostTotal,
      parts_cost_total: canonicalPartsCostTotal
    } as RepairOrder;

    updatedOrder = addAuditLogRecordHelper(
      updatedOrder,
      "ADD_PART",
      `قطع غيار جهاز ${currentDevice.type}`,
      null,
      `${product.nameAr || product.name} (سعر البيع: ${unitSellingPrice} ج.م | كمية: ${qty})`,
      "صرف قطعة غيار من المخزون وتوثيق حركة السحب",
      currentUserForAction,
      currentDevice.id
    );

    updatedOrder = addTimelineEventHelper(
      updatedOrder,
      "PART_ADDED",
      `صرف قطعة غيار من المخزون: ${product.nameAr || product.name} (كمية ${qty} بسعر بيع ${unitSellingPrice} ج.م)`,
      currentUserForAction,
      currentDevice.id
    );

    const orderSaveRes = await updateRepairOrderInSupabaseStrict(updatedOrder);
    if (!orderSaveRes.success) {
      throw new Error(`فشل حفظ بيانات أمر الصيانة بجدول الصيانة في الخادم Supabase: ${orderSaveRes.error || "خطأ غير معروف"}`);
    }

    const costSync = await syncRepairOrderPartsCostTotal({
      repairOrderUuid,
      orderNumber: selectedOrder.id,
      partsCostTotal: canonicalPartsCostTotal
    });
    if (!costSync.success) {
      throw new Error(`فشل حفظ إجمالي تكلفة قطع الغيار في أمر الصيانة: ${costSync.error || "خطأ غير معروف"}`);
    }

    const finalOrder = {
      ...(orderSaveRes.updatedOrder || updatedOrder),
      partsCostTotal: canonicalPartsCostTotal,
      parts_cost_total: canonicalPartsCostTotal
    } as RepairOrder;

    // Success: Update local DB collections
    const updatedProductsList = products.map(p => (p.id === product.id || p.id === productUuid) ? { ...p, id: productUuid, quantity: newQty } : p);
    db.saveProducts(updatedProductsList);
    db.saveRepairPartUsages(updatedUsageList);

    const allOrders = db.getRepairOrders();
    const updatedOrdersList = allOrders.map(o => o.id === finalOrder.id || o.uuid === finalOrder.uuid ? finalOrder : o);
    db.saveRepairOrders(updatedOrdersList);

    return {
      success: true,
      updatedProducts: updatedProductsList,
      updatedPartUsages: updatedUsageList,
      updatedOrder: finalOrder,
      createdUsage
    };

  } catch (err: any) {
    console.error("❌ Add part transaction failed, executing rollback:", err);

    // SAFE ROLLBACK IN REVERSE ORDER:

    // Rollback Step D: Product Quantity
    if (isStockUpdated) {
      try {
        await updateProductQuantityInSupabase(productUuid, product.quantity);
      } catch (rbErr) {
        console.warn("⚠️ Rollback stock failed:", rbErr);
      }
    }

    // Rollback Step C: Inventory Movement
    if (createdMovementId && isSupabaseConfigured) {
      try {
        await supabase.from('inventory_movements').delete().eq('id', createdMovementId);
      } catch (rbErr) {
        console.warn("⚠️ Rollback movement failed:", rbErr);
      }
    }

    // Roll back an existing usage quantity/cost if this transaction updated it before a later step failed.
    if (updatedExistingUsageId && previousExistingUsage) {
      try {
        await updateRepairPartUsageInSupabase(updatedExistingUsageId, {
          quantity: previousExistingUsage.quantity,
          unitCost: previousExistingUsage.unitCost,
          totalCost: previousExistingUsage.totalCost,
          sellingPrice: previousExistingUsage.sellingPrice,
          sellingTotal: previousExistingUsage.sellingTotal,
          accountingStatus: previousExistingUsage.accountingStatus
        });
      } catch (rbErr) {
        console.warn("⚠️ Rollback existing usage failed:", rbErr);
      }
    }

    // Rollback Step B: Repair Part Usage if this transaction created a brand-new row.
    if (createdUsageId && isNewUsageCreated && isSupabaseConfigured) {
      try {
        await supabase.from('repair_part_usages').delete().eq('id', createdUsageId);
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
