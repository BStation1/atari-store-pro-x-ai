import { RepairOrder, Product, RepairPartUsage, Invoice, User, RepairStatus, WorkOwnershipType } from "../types";
import { updateProductQuantityInSupabase } from "./supabaseProducts";
import { updateRepairPartUsageInSupabase } from "./supabasePartUsages";
import { deleteRepairOrderFromSupabase, getLocalRepairOrdersBackup, saveLocalRepairOrdersBackup } from "./supabaseRepairOrders";
import { cancelInvoiceInSupabase } from "./supabaseInvoices";
import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { db } from "./db";
import { usageMatchesOrder } from "./accountingEngineV2";

export interface DeleteRepairOrderOptions {
  orderId: string;
  selectedOrder: RepairOrder;
  products: Product[];
  partUsages: RepairPartUsage[];
  invoices: Invoice[];
  currentUser?: User;
}

export interface DeleteRepairOrderResult {
  success: boolean;
  error?: string;
  updatedProducts?: Product[];
  updatedPartUsages?: RepairPartUsage[];
  updatedInvoices?: Invoice[];
  deletedOrderId?: string;
}

/**
 * Executes full pre-delivery deletion of a repair order:
 * 1. Restores used parts back to inventory stock in Supabase and local DB.
 * 2. Marks active part usages as RETURNED.
 * 3. Cancels/Removes associated invoices/sales from sales & accounting.
 * 4. Cleans up partner ledger entries for partner accounting.
 * 5. Deletes the repair order.
 */
export async function executeDeleteRepairOrderTransaction(
  options: DeleteRepairOrderOptions
): Promise<DeleteRepairOrderResult> {
  const { orderId, selectedOrder, products, partUsages, invoices, currentUser } = options;

  if (!selectedOrder || selectedOrder.id !== orderId) {
    return { success: false, error: 'أمر الصيانة المطلوب حذف غير موجود.' };
  }

  // Check pre-delivery constraint
  if (selectedOrder.status === RepairStatus.Delivered || selectedOrder.deliveryStatus === 'DELIVERED') {
    return {
      success: false,
      error: 'عذراً، هذا الجهاز تم تسليمه وإغلاق طلبه سابقاً! لا يمكن حذفه مباشرة من هذا الزر. يرجى إعادة فتح الطلب وإلغاء التسليم أولاً إن لزم الأمر.'
    };
  }

  try {
    let updatedProducts = [...products];
    let updatedPartUsages = [...partUsages];
    let updatedInvoices = [...invoices];

    // STEP 1: Identify all active part usages belonging to this order
    const activeUsages = partUsages.filter(
      pu => (pu.repairOrderId === selectedOrder.id || usageMatchesOrder(pu, selectedOrder)) && pu.accountingStatus !== 'RETURNED'
    );

    // Also collect items from devices if not present in partUsages
    const usagesToReturn: { usageId?: string; productId: string; name: string; qty: number; unitCost: number }[] = [];

    activeUsages.forEach(pu => {
      usagesToReturn.push({
        usageId: pu.id,
        productId: pu.inventoryItemId,
        name: pu.partName,
        qty: pu.quantity || 1,
        unitCost: pu.unitCost || 0
      });
    });

    // Check device selectedRepairItems for any un-synced items
    if (selectedOrder.devices) {
      selectedOrder.devices.forEach(dev => {
        if (dev.selectedRepairItems) {
          dev.selectedRepairItems.forEach(item => {
            const alreadyInList = usagesToReturn.some(
              u => u.usageId === item.usageId || u.usageId === item.id || u.productId === item.productId || u.productId === item.id
            );
            if (!alreadyInList) {
              usagesToReturn.push({
                usageId: item.usageId || item.id,
                productId: item.productId || item.id,
                name: item.name,
                qty: item.quantity || 1,
                unitCost: item.costPrice || 0
              });
            }
          });
        }
      });
    }

    // STEP 2: Restore stock for each part and mark usages RETURNED
    for (const item of usagesToReturn) {
      const prodIdx = updatedProducts.findIndex(p => p.id === item.productId);
      if (prodIdx !== -1) {
        const prod = updatedProducts[prodIdx];
        const newStock = prod.quantity + item.qty;
        updatedProducts[prodIdx] = { ...prod, quantity: newStock };

        // Sync to Supabase
        await updateProductQuantityInSupabase(prod.id, newStock).catch(err => {
          console.warn(`[DeleteOrder] Stock update failed for product ${prod.id}:`, err);
        });

        // Sync to Local DB
        const localProds = db.getProducts();
        const localIdx = localProds.findIndex(p => p.id === prod.id);
        if (localIdx !== -1) {
          localProds[localIdx] = { ...localProds[localIdx], quantity: newStock };
          db.saveProducts(localProds);
        }
      }

      // Mark usage as RETURNED
      if (item.usageId) {
        const puIdx = updatedPartUsages.findIndex(pu => pu.id === item.usageId);
        if (puIdx !== -1) {
          updatedPartUsages[puIdx] = { ...updatedPartUsages[puIdx], accountingStatus: 'RETURNED' };
        }

        await updateRepairPartUsageInSupabase(item.usageId, { accountingStatus: 'RETURNED' }).catch(err => {
          console.warn(`[DeleteOrder] Usage RETURNED update failed for ${item.usageId}:`, err);
        });
      }
    }

    // Update local part usages
    const localUsages = db.getRepairPartUsages();
    const updatedLocalUsages = localUsages.map(pu => {
      if (pu.repairOrderId === selectedOrder.id || usagesToReturn.some(u => u.usageId === pu.id)) {
        return { ...pu, accountingStatus: 'RETURNED' as const };
      }
      return pu;
    });
    db.saveRepairPartUsages(updatedLocalUsages);

    // STEP 3: Remove / Cancel associated invoices & sales
    const linkedInvoices = invoices.filter(
      inv => inv.orderId === selectedOrder.id || Boolean((inv as any).notes && (inv as any).notes.includes(selectedOrder.id))
    );

    for (const inv of linkedInvoices) {
      await cancelInvoiceInSupabase(inv.id, "حذف أمر الصيانة قبل التسليم", currentUser).catch(err => {
        console.warn(`[DeleteOrder] Cancel invoice ${inv.id} failed:`, err);
      });

      updatedInvoices = updatedInvoices.map(i => i.id === inv.id ? { ...i, isPaid: false, totalAmount: 0, paidAmount: 0, status: 'cancelled' as const } : i);
    }

    // Update local DB invoices
    const localInvoices = db.getInvoices().filter(inv => inv.orderId !== selectedOrder.id);
    db.saveInvoices(localInvoices);

    // STEP 4: Clean up Partner Ledger entries for Partner Accounting
    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('partner_ledger')
          .delete()
          .or(`reference_id.eq.${selectedOrder.id},notes.ilike.%${selectedOrder.id}%`);

        for (const inv of linkedInvoices) {
          await supabase
            .from('partner_ledger')
            .delete()
            .or(`reference_id.eq.${inv.id},notes.ilike.%${inv.id}%`);
        }
      } catch (err: any) {
        console.warn("[DeleteOrder] Partner ledger cleanup error:", err?.message || err);
      }
    }

    // STEP 5: Delete the repair order from Supabase & Local DB
    await deleteRepairOrderFromSupabase(selectedOrder.id, currentUser).catch(err => {
      console.warn(`[DeleteOrder] Supabase delete repair order failed:`, err);
    });

    db.deleteRepairOrder(selectedOrder.id);

    const localOrders = getLocalRepairOrdersBackup().filter(o => o.id !== selectedOrder.id);
    saveLocalRepairOrdersBackup(localOrders, true);

    return {
      success: true,
      updatedProducts,
      updatedPartUsages,
      updatedInvoices,
      deletedOrderId: selectedOrder.id
    };
  } catch (err: any) {
    console.error("⚠️ Exception in executeDeleteRepairOrderTransaction:", err);
    return {
      success: false,
      error: err?.message || 'حدث خطأ غير متوقع أثناء عملية حذف أمر الصيانة.'
    };
  }
}
