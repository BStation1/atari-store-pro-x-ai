import { Product, RepairOrder, RepairPartUsage, SelectedRepairItem, WorkOwnershipType } from '../types';
import { db } from './db';
import { ensureProductUuidInSupabase, updateProductQuantityInSupabase, addInventoryMovementToSupabase } from './supabaseProducts';
import { addRepairPartUsageToSupabase } from './supabasePartUsages';
import { ensureRepairOrderUuidInSupabase, updateRepairOrderInSupabaseStrict } from './supabaseRepairOrders';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { getUsageSellingUnitPrice, calculateSuggestedPriceForFaults } from './repairOrderCalculations';
import { usageMatchesOrder, usageMatchesDevice } from './accountingEngineV2';
import { addAuditLogRecordHelper, addTimelineEventHelper } from './repairLogging';
import { getDeviceDisplayName } from './customerDisplayHelper';
import { calculateActiveRepairPartsCostTotal, syncRepairOrderPartsCostTotal } from './repairOrderPartsCostSync';
import { beginRepairPartMutation, endRepairPartMutation } from './repairPartOptimisticBridge';

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

const activeAddPartTransactions = new Map<string, Promise<ExecuteAddPartUsageResult>>();

export function executeAddPartUsageTransaction(
  options: ExecuteAddPartUsageOptions
): Promise<ExecuteAddPartUsageResult> {
  const { product, deviceIdx, selectedOrder } = options;
  const orderKey = String((selectedOrder as any)?.uuid || (selectedOrder as any)?.databaseId || selectedOrder?.id || 'unknown-order');
  const deviceKey = String(selectedOrder?.devices?.[deviceIdx]?.id || deviceIdx);
  const productKey = String((product as any)?.uuid || product?.id || product?.sku || 'unknown-product');
  const lockKey = `${orderKey}::${deviceKey}::${productKey}`;

  const active = activeAddPartTransactions.get(lockKey);
  if (active) {
    console.log(`[AddPart] Reusing active transaction for ${lockKey}; duplicate rapid click ignored.`);
    return active;
  }

  const transaction = executeAddPartUsageTransactionUnlocked(options);
  activeAddPartTransactions.set(lockKey, transaction);

  return transaction.finally(() => {
    if (activeAddPartTransactions.get(lockKey) === transaction) {
      activeAddPartTransactions.delete(lockKey);
    }
  });
}

async function executeAddPartUsageTransactionUnlocked(
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

  // Publish an optimistic usage snapshot before the first network await. The hook will
  // read this local snapshot while the mutation bridge is active, so the + button feels
  // immediate without allowing a stale Supabase refetch to overwrite it mid-transaction.
  const optimisticExisting = partUsages.find(pu =>
    pu.accountingStatus !== 'RETURNED' &&
    pu.accountingStatus !== 'REVERSED' &&
    usageMatchesOrder(pu, selectedOrder) &&
    usageMatchesDevice(pu, currentDevice, deviceIdx, selectedOrder.devices.length) &&
    (
      pu.inventoryItemId === product.id ||
      (!!product.sku && pu.sku === product.sku) ||
      pu.partName === (product.nameAr || product.name)
    )
  );

  const optimisticUsage: RepairPartUsage = optimisticExisting
    ? {
        ...optimisticExisting,
        quantity: Number(optimisticExisting.quantity || 0) + qty,
        unitCost: unitPurchaseCost || optimisticExisting.unitCost || 0,
        totalCost: (Number(optimisticExisting.quantity || 0) + qty) * (unitPurchaseCost || optimisticExisting.unitCost || 0),
        sellingPrice: unitSellingPrice,
        sellingTotal: (Number(optimisticExisting.quantity || 0) + qty) * unitSellingPrice
      }
    : {
        id: `optimistic-${crypto.randomUUID()}`,
        repairOrderId: selectedOrder.id,
        inventoryItemId: product.id,
        partName: product.nameAr || product.name,
        sku: product.sku || product.id,
        quantity: qty,
        unitCost: unitPurchaseCost,
        totalCost,
        sellingPrice: unitSellingPrice,
        sellingTotal,
        ownershipType: ownership,
        responsiblePartnerId: owner === 'AHMED' ? 'P-001' : owner === 'ABDO' ? 'P-002' : 'SHOP',
        accountingStatus: 'CONSUMED',
        createdAt: new Date().toISOString(),
        notes: `deviceId:${currentDevice.id || deviceIdx}`
      } as RepairPartUsage;

  const optimisticUsages = optimisticExisting
    ? partUsages.map(pu => pu.id === optimisticExisting.id ? optimisticUsage : pu)
    : [...partUsages, optimisticUsage];

  db.saveRepairPartUsages(optimisticUsages);
  beginRepairPartMutation();

  try {
    const resolvedProdUuid = await ensureProductUuidInSupabase(product);
    if (!resolvedProdUuid) {
      throw new Error("فشل الربط بقاعدة بيانات المنتجات في الخادم Supabase");
    }
    productUuid = resolvedProdUuid;

    const resolvedOrderUuid = await ensureRepairOrderUuidInSupabase(selectedOrder);
    if (!resolvedOrderUuid) {
      throw new Error("فشل الربط بقاعدة بيانات أوامر الصيانة في الخادم Supabase");
    }
    repairOrderUuid = resolvedOrderUuid;

    const allUsages = [...partUsages];
    let existingUsage = allUsages.find(
      pu => (pu.inventoryItemId === product.id || pu.inventoryItemId === productUuid) &&
            pu.accountingStatus !== 'RETURNED' &&
            pu.accountingStatus !== 'REVERSED' &&
            usageMatchesOrder(pu, selectedOrder) &&
            usageMatchesDevice(pu, currentDevice, deviceIdx, selectedOrder.devices.length)
    );

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
        existingUsage = undefined;
      }
    }

    let updatedUsageList: RepairPartUsage[] = [];

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

      if (isSupabaseConfigured) {
        const { data: updatedUsageRow, error: usageUpdateError } = await supabase
          .from('repair_part_usages')
          .update({
            quantity: newUsageQty,
            cost_price_snapshot: effectiveUnitCost,
            selling_price_snapshot: unitSellingPrice
          })
          .eq('id', existingUsage.id)
          .select('id,repair_order_id,inventory_item_id,quantity,cost_price_snapshot,selling_price_snapshot')
          .maybeSingle();

        if (usageUpdateError) {
          throw new Error(`Supabase رفض تحديث سجل قطعة الغيار: ${usageUpdateError.message}`);
        }
        if (!updatedUsageRow) {
          throw new Error(`Supabase لم يُرجع سجل قطعة الغيار بعد التحديث (usage id: ${existingUsage.id})`);
        }
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

    const stockOk = await updateProductQuantityInSupabase(productUuid, newQty);
    if (!stockOk) {
      throw new Error("فشل خصم الكمية من المخزون بقاعدة البيانات Supabase");
    }
    isStockUpdated = true;

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

    const updatedProductsList = products.map(p => (p.id === product.id || p.id === productUuid) ? { ...p, id: productUuid, quantity: newQty } : p);
    db.saveProducts(updatedProductsList);
    db.saveRepairPartUsages(updatedUsageList);

    const allOrders = db.getRepairOrders();
    const updatedOrdersList = allOrders.map(o => o.id === finalOrder.id || o.uuid === finalOrder.uuid ? finalOrder : o);
    db.saveRepairOrders(updatedOrdersList);
    endRepairPartMutation();

    return {
      success: true,
      updatedProducts: updatedProductsList,
      updatedPartUsages: updatedUsageList,
      updatedOrder: finalOrder,
      createdUsage
    };

  } catch (err: any) {
    console.error("❌ Add part transaction failed, executing rollback:", err);

    if (isStockUpdated) {
      try {
        await updateProductQuantityInSupabase(productUuid, product.quantity);
      } catch (rbErr) {
        console.warn("⚠️ Rollback stock failed:", rbErr);
      }
    }

    if (createdMovementId && isSupabaseConfigured) {
      try {
        await supabase.from('inventory_movements').delete().eq('id', createdMovementId);
      } catch (rbErr) {
        console.warn("⚠️ Rollback movement failed:", rbErr);
      }
    }

    if (updatedExistingUsageId && previousExistingUsage && isSupabaseConfigured) {
      try {
        const { error: rollbackUsageError } = await supabase
          .from('repair_part_usages')
          .update({
            quantity: previousExistingUsage.quantity,
            cost_price_snapshot: previousExistingUsage.unitCost,
            selling_price_snapshot: previousExistingUsage.sellingPrice
          })
          .eq('id', updatedExistingUsageId);
        if (rollbackUsageError) {
          console.warn("⚠️ Rollback existing usage failed:", rollbackUsageError.message);
        }
      } catch (rbErr) {
        console.warn("⚠️ Rollback existing usage failed:", rbErr);
      }
    }

    if (createdUsageId && isNewUsageCreated && isSupabaseConfigured) {
      try {
        await supabase.from('repair_part_usages').delete().eq('id', createdUsageId);
      } catch (rbErr) {
        console.warn("⚠️ Rollback usage failed:", rbErr);
      }
    }

    db.saveRepairPartUsages(partUsages);
    endRepairPartMutation();

    return {
      success: false,
      error: err?.message || "تعذر إكمال عملية إضافة قطعة الغيار وحفظها بالخادم."
    };
  }
}
