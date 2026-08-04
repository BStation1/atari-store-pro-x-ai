/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { useDialog } from "../context/DialogContext";
import {
  Wrench,
  Clock,
  CheckCircle,
  TrendingUp,
  AlertTriangle,
  User,
  PlusCircle,
  Trash2,
  Save,
  MessageSquare,
  Activity,
  Layers,
  ChevronLeft,
  FileText,
  Lock,
  ShieldCheck,
  ShieldAlert,
  DollarSign,
  RotateCcw,
  Calculator,
  History,
  ListCheck,
  Search,
  Sparkles,
  Filter,
  ArrowUpDown,
  CheckCircle2,
  PackageCheck,
  Package,
  Tag,
  Plus,
  Gamepad2,
  X,
  Truck
} from "lucide-react";
import { useRepairOrders, useCustomers, useProducts, useSettings, useInvoices, useCurrentUser, useRepairPartUsages } from "../hooks/useData";
import { RepairOrder, RepairDevice, RepairStatus, DeviceType, PaymentMethod, WorkOwnershipType, User as UserType, QUICK_FAULTS_LIST, SelectedRepairItem, RepairPartUsage, Product } from "../types";
import { getCustomerNameHelper, getCustomerPhoneHelper, getCustomerBadgeHelper, getDeviceDisplayName } from "../lib/customerDisplayHelper";
import { PhoneDisplay } from "./PhoneDisplay";
import PrintReceiptModal from "./PrintReceiptModal";
import DeliverDeviceModal from "./DeliverDeviceModal";
import ReopenOrderModal from "./ReopenOrderModal";
import CancelWarrantyModal from "./CancelWarrantyModal";
import { canDeliverDevice, canReopenDeliveredOrder, canCancelWarranty } from "../lib/authPermissions";
import { db } from "../lib/data";
import { addInventoryMovementToSupabase, ensureProductUuidInSupabase, updateProductQuantityInSupabase } from "../lib/supabaseProducts";
import { addRepairPartUsageToSupabase, updateRepairPartUsageInSupabase } from "../lib/supabasePartUsages";
import { ensureRepairOrderUuidInSupabase, updateRepairOrderInSupabase } from "../lib/supabaseRepairOrders";
import { executeRemovePartUsageTransaction } from "../lib/repairPartRemovalService";
import { executeAddPartUsageTransaction } from "../lib/repairPartAddService";
import { executeDeleteRepairOrderTransaction } from "../lib/repairOrderDeleteService";
import { usageMatchesOrder, usageMatchesDevice, syncOrderSelectedRepairItemsFromUsages, getActiveRepairUsagesForDevice, getActiveRepairUsagesForOrder } from "../lib/accountingEngineV2";
import { sendRepairNotificationWorkflow } from "../lib/whatsapp";
import { 
  addTimelineEventHelper, 
  addAuditLogRecordHelper, 
  EVENT_TYPE_LABELS, 
  AUDIT_ACTION_LABELS 
} from "../lib/repairLogging";

export function getUsageSellingUnitPrice(pu: RepairPartUsage, productsList: Product[]): number {
  if (pu.sellingPrice && pu.sellingPrice > 0) return pu.sellingPrice;
  const prod = productsList.find(p => p.id === pu.inventoryItemId || (p.nameAr || p.name) === pu.partName);
  if (prod && Number(prod.sellPrice || (prod as any).price) > 0) {
    return Number(prod.sellPrice || (prod as any).price);
  }
  return pu.unitCost || 0;
}

export function isProductCompatibleWithDevice(product: Product, deviceType?: string, deviceModel?: string): boolean {
  if (!product) return false;
  const compTypes = product.compatibleDeviceTypes || [];
  const compModels = product.compatibleModels || [];

  if (compTypes.length === 0 && compModels.length === 0) {
    return true; // Universal part if no restrictions
  }

  const dType = (deviceType || "").trim().toLowerCase();
  const dModel = (deviceModel || "").trim().toLowerCase();

  const typeMatch = compTypes.some(t => {
    const tClean = t.trim().toLowerCase();
    return tClean === dType || (dType && dType.includes(tClean)) || tClean.includes(dType);
  });

  const modelMatch = compModels.some(m => {
    const mClean = m.trim().toLowerCase();
    return mClean === dModel || (dModel && dModel.includes(mClean)) || mClean.includes(dModel) || (dType && dType.includes(mClean));
  });

  if (compTypes.length > 0 && compModels.length > 0) {
    return typeMatch || modelMatch;
  }
  if (compTypes.length > 0) return typeMatch;
  if (compModels.length > 0) return modelMatch;

  return true;
}

interface RepairCenterProps {
  initialStatusFilter?: RepairStatus;
  initialOrderId?: string;
}

export default function RepairCenter({ initialStatusFilter, initialOrderId }: RepairCenterProps) {
  const { user: currentLoggedUser } = useCurrentUser();
  const { orders, updateRepairOrder, setRepairOrderLocal, deleteRepairOrder, deliverRepairOrder, reopenRepairOrder } = useRepairOrders();
  const { customers, updateCustomer } = useCustomers();
  const { products, updateProduct, setProductLocal } = useProducts();
  const { settings } = useSettings();
  const { invoices, addInvoice } = useInvoices();
  const { partUsages, partUsagesLoaded, persistLocalUsages, upsertPartUsageLocal, replacePartUsageIdLocal } = useRepairPartUsages();

  const [activeTab, setActiveTab] = useState<string>(initialStatusFilter || "active_all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<RepairOrder | null>(
    initialOrderId ? orders.find(o => o.id === initialOrderId) || null : null
  );

  useEffect(() => {
    if (selectedOrder && partUsagesLoaded) {
      const synced = syncOrderSelectedRepairItemsFromUsages(
        selectedOrder,
        partUsages,
        (pu) => getUsageSellingUnitPrice(pu, products),
        { usagesLoaded: partUsagesLoaded, allowClear: true }
      );
      if (synced !== selectedOrder) {
        setSelectedOrder(synced);
      }
    }
  }, [partUsages, partUsagesLoaded, products, selectedOrder?.id]);

  // Sub-Navigation Tabs inside Order Workspace
  const [workspaceTab, setWorkspaceTab] = useState<"workshop" | "timeline" | "audit">("workshop");
  const [timelineSortOrder, setTimelineSortOrder] = useState<"desc" | "asc">("desc");
  const [auditFilter, setAuditFilter] = useState<string>("all");

  // Custom Procedure Addition Modal
  const [newProcedureModalDevIdx, setNewProcedureModalDevIdx] = useState<number | null>(null);
  const [newProcedureName, setNewProcedureName] = useState("");
  const [newProcedureCost, setNewProcedureCost] = useState<number>(0);
  const [newProcedurePrice, setNewProcedurePrice] = useState<number>(0);

  // Add Part Modal State
  const [addPartModalOpen, setAddPartModalOpen] = useState(false);
  const [addPartDevIdx, setAddPartDevIdx] = useState<number>(0);
  const [addPartProductId, setAddPartProductId] = useState<string>('');
  const [addPartQty, setAddPartQty] = useState<number>(1);

  const dialog = useDialog();

  const handleDeleteOrder = async (orderId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    const targetOrder = orders.find(o => o.id === orderId) || (selectedOrder?.id === orderId ? selectedOrder : null);
    if (!targetOrder) {
      await dialog.alert({ message: "أمر الصيانة المطلوب حذف غير موجود!", variant: "error" });
      return;
    }

    // Pre-delivery check
    if (targetOrder.status === RepairStatus.Delivered || targetOrder.deliveryStatus === "DELIVERED") {
      await dialog.alert({
        title: "غير مسموح بالحذف المباشر",
        message: "هذا الجهاز تم تسليمه وإغلاق طلبه سابقاً! لا يمكن حذفه مباشرة عبر هذا الزر. يرجى إعادة فتح الطلب وإلغاء التسليم أولاً إن لزم الأمر.",
        variant: "warning"
      });
      return;
    }

    // Check admin / owner permission
    const isOwnerOrAdmin = currentLoggedUser?.role === "admin" || currentLoggedUser?.roleId === "OWNER" || currentLoggedUser?.role === "OWNER" || currentLoggedUser?.email === "elbannafc@gmail.com" || currentLoggedUser?.permissions?.includes("all");
    if (!isOwnerOrAdmin) {
      await dialog.alert({ message: "عذراً، خيار حذف أوامر الصيانة متاح حصرياً لمدير النظام (Admin/OWNER)!", variant: "error" });
      return;
    }

    const confirmed = await dialog.confirm({
      title: "حذف أمر الصيانة قبل التسليم",
      message: `هل أنت متأكد من حذف أمر الصيانة رقم [${orderId}] نهائياً؟\n\nإجراءات الحذف التلقائية:\n1. إرجاع جميع قطع الغيار المستهلكة بالطلب إلى المخزن وزيادة كمياتها.\n2. إلغاء ومسح المبيعات والفواتير المرتبطة بالأوردر.\n3. خصم/إعادة ضبط أرباح وحسابات الشركاء الخاصة بالأوردر.`,
      variant: "danger",
      confirmText: "نعم، إرجاع القطع وحذف الأوردر"
    });

    if (confirmed) {
      const res = await executeDeleteRepairOrderTransaction({
        orderId,
        selectedOrder: targetOrder,
        products,
        partUsages,
        invoices,
        currentUser: currentLoggedUser
      });

      if (res.success) {
        if (res.updatedProducts) {
          res.updatedProducts.forEach(p => updateProduct(p));
        }
        if (res.updatedPartUsages) {
          persistLocalUsages(res.updatedPartUsages);
        }
        deleteRepairOrder(orderId);

        if (selectedOrder?.id === orderId) {
          setSelectedOrder(null);
        }

        window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_repair_orders' } }));
        window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_products' } }));
        window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_repair_part_usages' } }));
        window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_invoices' } }));
        window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_partner_ledger' } }));

        await dialog.alert({
          title: "تم الحذف بنجاح",
          message: `تم حذف أمر الصيانة رقم [${orderId}] وإعادة قطع الغيار إلى المخزن، وإلغاء المبيعات وتسوية حسابات الشركاء بنجاح.`,
          variant: "success"
        });
      } else {
        await dialog.alert({
          title: "فشل الحذف",
          message: res.error || "تعذر إتمام عملية حذف أمر الصيانة.",
          variant: "error"
        });
      }
    }
  };

  const handleSendWhatsAppUpdate = async (order: RepairOrder, customReason?: string) => {
    const custName = getCustomerNameHelper(order, customers);
    const custPhone = getCustomerPhoneHelper(order, customers);

    let template: "REPAIR_ORDER_CREATED" | "APPROVAL_REQUIRED" | "READY_FOR_PICKUP" | "DELIVERED" = "REPAIR_ORDER_CREATED";

    if (order.status === RepairStatus.Ready) {
      template = "READY_FOR_PICKUP";
    } else if (order.status === RepairStatus.WaitingCustomerApproval) {
      template = "APPROVAL_REQUIRED";
    } else if (order.status === RepairStatus.Delivered) {
      template = "DELIVERED";
    }

    const waRes = await sendRepairNotificationWorkflow({
      template,
      order,
      customerName: custName,
      customerPhone: custPhone,
      extra: {
        reason: customReason || "مطلوب موافقة العميل على تفاصيل وتكلفة الصيانة",
        additionalCost: 0,
        newTotal: order.finalRepairPrice ?? order.totalEstimatedCost,
        repairedItems: order.devices?.map(d => `${getDeviceDisplayName(d)}: ${d.issue || "إصلاح بنجاح"}`).join(" + "),
        warrantyInfo: order.warrantyDays ? `ضمان لمدة ${order.warrantyDays} يوم` : "حسب الشروط المدونة بالإيصال"
      }
    });

    if (!waRes.success) {
      dialog.alert({
        title: "تنبيه الإشعارات",
        message: "تم حفظ العملية ولكن تعذر إرسال رسالة واتساب.",
        variant: "warning"
      });
    }
  };

  // Parts Used Search state
  const [partSearch, setPartSearch] = useState("");
  const [selectedPartIndex, setSelectedPartIndex] = useState<number | null>(null);
  const [showQuickFaultsDropdown, setShowQuickFaultsDropdown] = useState(false);
  const [busyProductIds, setBusyProductIds] = useState<Set<string>>(new Set());

  // Keep the open order fresh, but never replace an optimistic workshop edit while a part mutation is running.
  useEffect(() => {
    if (busyProductIds.size > 0) return;
    setSelectedOrder(prev => {
      if (!prev) return null;
      const fresh = orders.find(order => order.id === prev.id);
      if (!fresh || fresh === prev) return prev;
      if (JSON.stringify(fresh) === JSON.stringify(prev)) return prev;
      return fresh;
    });
  }, [orders, busyProductIds.size]);

  // Receipt Modal trigger
  const [receiptOrder, setReceiptOrder] = useState<RepairOrder | undefined>(undefined);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // Delivery, Reopen & Cancel Warranty Modal triggers
  const [isDeliverModalOpen, setIsDeliverModalOpen] = useState(false);
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
  const [isCancelWarrantyModalOpen, setIsCancelWarrantyModalOpen] = useState(false);

  const handleConfirmCancelWarranty = (reason: string) => {
    if (!selectedOrder) return { success: false, error: "لا يوجد طلب صيانة مفيّم" };
    const res = db.cancelWarranty({
      orderId: selectedOrder.id,
      reason,
      currentUser: currentUserForAction
    });
    if (res.success && res.order) {
      setSelectedOrder(res.order);
      updateRepairOrder(res.order);
    }
    return res;
  };

  // Fallback default user if currentLoggedUser is not defined
  const currentUserForAction: UserType = currentLoggedUser || {
    id: "U-101",
    username: "elbanna",
    name: "أحمد البنا",
    fullName: "أحمد البنا (الشريك الأول)",
    role: "OWNER",
    roleId: "OWNER",
    email: "elbannafc@gmail.com",
    isActive: true,
    createdAt: new Date().toISOString()
  };

  // Status mapping colors & texts
  const statusConfig = {
    [RepairStatus.Received]: { text: "مستلمة", class: "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" },
    [RepairStatus.Diagnosing]: { text: "تحت الفحص", class: "bg-blue-500/10 text-blue-400 border border-blue-500/20" },
    [RepairStatus.WaitingCustomerApproval]: { text: "بانتظار موافقة العميل", class: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20" },
    [RepairStatus.Repairing]: { text: "جاري الإصلاح", class: "bg-purple-500/10 text-purple-400 border border-purple-500/20" },
    [RepairStatus.Ready]: { text: "جاهز للتسليم", class: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" },
    [RepairStatus.Delivered]: { text: "تم التسليم", class: "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" },
    [RepairStatus.Cancelled]: { text: "ملغي / مرفوض", class: "bg-rose-500/10 text-rose-400 border border-rose-500/20" }
  };

  const calculateSuggestedPriceForFaults = (faultLabels: string[]): number => {
    return faultLabels.reduce((sum, label) => {
      const match = QUICK_FAULTS_LIST.find(f => f.label === label);
      return sum + (match ? match.defaultSellingPrice : 0);
    }, 0);
  };

  const handleUpdateDeviceDetails = (
    deviceIdx: number,
    field: keyof RepairDevice,
    value: any
  ) => {
    if (!selectedOrder) return;

    const updatedDevices = [...selectedOrder.devices];
    updatedDevices[deviceIdx] = {
      ...updatedDevices[deviceIdx],
      [field]: value
    };

    const totalFinal = updatedDevices.reduce((sum, d) => {
      return sum + (d.finalRepairPrice ?? d.estimatedCost ?? 0);
    }, 0);

    const updatedOrder: RepairOrder = {
      ...selectedOrder,
      devices: updatedDevices,
      totalEstimatedCost: totalFinal,
      finalRepairPrice: totalFinal
    };

    setSelectedOrder(updatedOrder);
    updateRepairOrder(updatedOrder);
  };

  // Save technician diagnosis and log audit & timeline events
  const handleSaveDiagnosis = (deviceIdx: number) => {
    if (!selectedOrder) return;
    const currentDevice = selectedOrder.devices[deviceIdx];
    if (!currentDevice) return;

    const oldDiag = currentDevice.diagnosisText || currentDevice.technicianNotes || "غير محدد";
    const newDiag = currentDevice.diagnosisText || currentDevice.technicianNotes || "";

    let updatedOrder = addAuditLogRecordHelper(
      selectedOrder,
      "CHANGE_DIAGNOSIS",
      `تشخيص جهاز ${currentDevice.type} (${currentDevice.model})`,
      oldDiag,
      newDiag || "لا يوجد",
      "حفظ التقرير والتشخيص الفني للمهندس",
      currentUserForAction,
      currentDevice.id
    );

    updatedOrder = addTimelineEventHelper(
      updatedOrder,
      "DIAGNOSIS_SET",
      `تسجيل التشخيص الفني: ${newDiag.substring(0, 50)}${newDiag.length > 50 ? "..." : ""}`,
      currentUserForAction,
      currentDevice.id
    );

    setSelectedOrder(updatedOrder);
    updateRepairOrder(updatedOrder);
    dialog.alert({ message: "تم حفظ التقرير والتشخيص الفني وتسجيل العملية في السجل بنجاح", variant: "success" });
  };

  // Add custom technical procedure
  const handleAddCustomProcedure = (deviceIdx: number) => {
    if (!selectedOrder || !newProcedureName.trim()) return;
    const currentDevice = selectedOrder.devices[deviceIdx];
    if (!currentDevice) return;

    const currentProcedures: SelectedRepairItem[] = currentDevice.technicalProcedures || currentDevice.selectedRepairItems || [];
    const newItem: SelectedRepairItem = {
      id: `PROC-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      name: newProcedureName.trim(),
      quantity: 1,
      costPrice: Number(newProcedureCost) || 0,
      repairPrice: Number(newProcedurePrice) || 0
    };

    const updatedProcedures = [...currentProcedures, newItem];
    const newPartsCost = updatedProcedures.reduce((sum, i) => sum + (i.costPrice * i.quantity), 0);
    const newRepairPrice = updatedProcedures.reduce((sum, i) => sum + (i.repairPrice * i.quantity), 0);

    const updatedDevices = [...selectedOrder.devices];
    updatedDevices[deviceIdx] = {
      ...currentDevice,
      technicalProcedures: updatedProcedures,
      selectedRepairItems: updatedProcedures,
      partsCost: newPartsCost,
      finalRepairPrice: currentDevice.isPriceManuallyEdited ? currentDevice.finalRepairPrice : (newRepairPrice + (currentDevice.suggestedRepairPrice || 0)),
      estimatedCost: currentDevice.isPriceManuallyEdited ? (currentDevice.finalRepairPrice || 0) : (newRepairPrice + (currentDevice.suggestedRepairPrice || 0))
    };

    const totalFinal = updatedDevices.reduce((sum, d) => sum + (d.finalRepairPrice ?? d.estimatedCost ?? 0), 0);

    let updatedOrder: RepairOrder = {
      ...selectedOrder,
      devices: updatedDevices,
      totalEstimatedCost: totalFinal,
      finalRepairPrice: totalFinal
    };

    updatedOrder = addAuditLogRecordHelper(
      updatedOrder,
      "ADD_PROCEDURE",
      `إجراءات جهاز ${currentDevice.type}`,
      null,
      `${newProcedureName.trim()} (بسعر: ${newProcedurePrice} ج.م)`,
      "إضافة إجراء فني إصلاحي معتمد للجهاز",
      currentUserForAction,
      currentDevice.id
    );

    updatedOrder = addTimelineEventHelper(
      updatedOrder,
      "PROCEDURE_ADDED",
      `إضافة إجراء فني: ${newProcedureName.trim()} (${newProcedurePrice} ج.م)`,
      currentUserForAction,
      currentDevice.id
    );

    setSelectedOrder(updatedOrder);
    updateRepairOrder(updatedOrder);

    // Reset modal
    setNewProcedureModalDevIdx(null);
    setNewProcedureName("");
    setNewProcedureCost(0);
    setNewProcedurePrice(0);
  };

  // Remove technical procedure
  const handleRemoveProcedure = (deviceIdx: number, itemIdx: number) => {
    if (!selectedOrder) return;
    const currentDevice = selectedOrder.devices[deviceIdx];
    if (!currentDevice) return;

    const currentProcedures: SelectedRepairItem[] = currentDevice.technicalProcedures || currentDevice.selectedRepairItems || [];
    const removedItem = currentProcedures[itemIdx];
    if (!removedItem) return;

    const updatedProcedures = currentProcedures.filter((_, i) => i !== itemIdx);
    const newPartsCost = updatedProcedures.reduce((sum, i) => sum + (i.costPrice * i.quantity), 0);
    const newRepairPrice = updatedProcedures.reduce((sum, i) => sum + (i.repairPrice * i.quantity), 0);

    const updatedDevices = [...selectedOrder.devices];
    updatedDevices[deviceIdx] = {
      ...currentDevice,
      technicalProcedures: updatedProcedures,
      selectedRepairItems: updatedProcedures,
      partsCost: newPartsCost,
      finalRepairPrice: currentDevice.isPriceManuallyEdited ? currentDevice.finalRepairPrice : (newRepairPrice + (currentDevice.suggestedRepairPrice || 0)),
      estimatedCost: currentDevice.isPriceManuallyEdited ? (currentDevice.finalRepairPrice || 0) : (newRepairPrice + (currentDevice.suggestedRepairPrice || 0))
    };

    const totalFinal = updatedDevices.reduce((sum, d) => sum + (d.finalRepairPrice ?? d.estimatedCost ?? 0), 0);

    let updatedOrder: RepairOrder = {
      ...selectedOrder,
      devices: updatedDevices,
      totalEstimatedCost: totalFinal,
      finalRepairPrice: totalFinal
    };

    updatedOrder = addAuditLogRecordHelper(
      updatedOrder,
      "DELETE_PROCEDURE",
      `إجراءات جهاز ${currentDevice.type}`,
      removedItem.name,
      null,
      "حذف إجراء فني من قائمة الصيانة",
      currentUserForAction,
      currentDevice.id
    );

    updatedOrder = addTimelineEventHelper(
      updatedOrder,
      "PROCEDURE_REMOVED",
      `حذف الإجراء الفني: ${removedItem.name}`,
      currentUserForAction,
      currentDevice.id
    );

    setSelectedOrder(updatedOrder);
    updateRepairOrder(updatedOrder);
  };

  // Toggle quick fault in Repair Center with live pricing updates
  const handleToggleQuickFaultInRepairCenter = (deviceIdx: number, tagName: string) => {
    if (!selectedOrder) return;
    const currentDevice = selectedOrder.devices[deviceIdx];
    if (!currentDevice) return;

    const currentIssueStr = currentDevice.issue || "";
    const currentTags = currentIssueStr.split(" - ").map(s => s.trim()).filter(Boolean);

    let newTags: string[] = [];
    if (currentTags.includes(tagName)) {
      newTags = currentTags.filter(t => t !== tagName);
    } else {
      if (tagName === "لا توجد أعطال ظاهرية") {
        newTags = [tagName];
      } else {
        newTags = [...currentTags.filter(t => t !== "لا توجد أعطال ظاهرية"), tagName];
      }
    }

    const faultSum = calculateSuggestedPriceForFaults(newTags);
    const partsSum = Number(currentDevice.partsCost) || 0;
    const autoPrice = faultSum + partsSum;

    const updatedDevices = [...selectedOrder.devices];
    if (currentDevice.isPriceManuallyEdited) {
      updatedDevices[deviceIdx] = {
        ...currentDevice,
        issue: newTags.join(" - "),
        reportedFaults: newTags,
        selectedQuickFaults: newTags,
        suggestedRepairPrice: faultSum,
        priceOverrideAcknowledged: false
      };
    } else {
      updatedDevices[deviceIdx] = {
        ...currentDevice,
        issue: newTags.join(" - "),
        reportedFaults: newTags,
        selectedQuickFaults: newTags,
        suggestedRepairPrice: faultSum,
        finalRepairPrice: autoPrice,
        estimatedCost: autoPrice
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
      "CHANGE_FAULTS",
      `أعطال جهاز ${currentDevice.type}`,
      currentTags.join(", ") || "لا يوجد",
      newTags.join(", ") || "لا يوجد",
      "تحديث قائمة شكاوى وأعطال الجهاز",
      currentUserForAction,
      currentDevice.id
    );

    setSelectedOrder(updatedOrder);
    updateRepairOrder(updatedOrder);
  };

  // Manual device price change
  const handleManualDevicePriceChange = (deviceIdx: number, newPrice: number) => {
    if (!selectedOrder) return;
    const updatedDevices = [...selectedOrder.devices];
    const currentDevice = updatedDevices[deviceIdx];
    if (!currentDevice) return;

    const oldPrice = currentDevice.finalRepairPrice ?? currentDevice.estimatedCost ?? 0;

    updatedDevices[deviceIdx] = {
      ...currentDevice,
      finalRepairPrice: newPrice,
      estimatedCost: newPrice,
      isPriceManuallyEdited: true,
      priceOverrideAcknowledged: true
    };

    const totalFinal = updatedDevices.reduce((sum, d) => sum + (d.finalRepairPrice ?? d.estimatedCost ?? 0), 0);

    let updatedOrder: RepairOrder = {
      ...selectedOrder,
      devices: updatedDevices,
      totalEstimatedCost: totalFinal,
      finalRepairPrice: totalFinal
    };

    updatedOrder = addAuditLogRecordHelper(
      updatedOrder,
      "CHANGE_SELL_PRICE",
      `سعر صيانة جهاز ${currentDevice.type}`,
      `${oldPrice} ج.م`,
      `${newPrice} ج.م`,
      "تعديل السعر النهائي للجهاز يدوياً",
      currentUserForAction,
      currentDevice.id
    );

    setSelectedOrder(updatedOrder);
    updateRepairOrder(updatedOrder);
  };

  // Recalculate device price from faults + parts
  const handleRecalculateDevicePrice = (deviceIdx: number) => {
    if (!selectedOrder) return;
    const updatedDevices = [...selectedOrder.devices];
    const currentDevice = updatedDevices[deviceIdx];
    if (!currentDevice) return;

    const tags = currentDevice.selectedQuickFaults || (currentDevice.issue ? currentDevice.issue.split(" - ").map(s => s.trim()) : []);
    const faultsCost = currentDevice.suggestedRepairPrice ?? calculateSuggestedPriceForFaults(tags);
    const partsCost = Number(currentDevice.partsCost) || 0;
    const autoPrice = faultsCost + partsCost;

    updatedDevices[deviceIdx] = {
      ...currentDevice,
      finalRepairPrice: autoPrice,
      estimatedCost: autoPrice,
      isPriceManuallyEdited: false,
      priceOverrideAcknowledged: false
    };

    const totalFinal = updatedDevices.reduce((sum, d) => sum + (d.finalRepairPrice ?? d.estimatedCost ?? 0), 0);

    const updatedOrder: RepairOrder = {
      ...selectedOrder,
      devices: updatedDevices,
      totalEstimatedCost: totalFinal,
      finalRepairPrice: totalFinal
    };

    setSelectedOrder(updatedOrder);
    updateRepairOrder(updatedOrder);
  };

  // Acknowledge manual price override
  const handleKeepManualDevicePrice = (deviceIdx: number) => {
    if (!selectedOrder) return;
    const updatedDevices = [...selectedOrder.devices];
    const currentDevice = updatedDevices[deviceIdx];
    if (!currentDevice) return;

    updatedDevices[deviceIdx] = {
      ...currentDevice,
      priceOverrideAcknowledged: true
    };

    const updatedOrder: RepairOrder = {
      ...selectedOrder,
      devices: updatedDevices
    };

    setSelectedOrder(updatedOrder);
    updateRepairOrder(updatedOrder);
  };

  // Add inventory part to device
  const handleAddPartToDevice = async (deviceIdx: number, productId: string, qtyToAdd: number = 1) => {
    const t0 = performance.now();
    console.log(`⏱️ [AddPart] Click received for productId=${productId} at ${t0.toFixed(2)}ms`);

    if (!selectedOrder) return;

    if (busyProductIds.has(productId)) {
      console.log(`[AddPart] Product ${productId} is busy. Ignoring click.`);
      return;
    }

    const product = products.find(p => p.id === productId);
    if (!product) return;

    const qty = Math.max(1, Math.floor(qtyToAdd));
    if (product.quantity < qty) {
      dialog.alert({ message: "عفواً، هاته القطعة غير متوفرة بالمخزون حالياً!", variant: "error" });
      return;
    }

    setBusyProductIds(prev => new Set(prev).add(productId));

    try {
      const res = await executeAddPartUsageTransaction({
        product,
        deviceIdx,
        qty,
        selectedOrder,
        products,
        partUsages,
        currentUserForAction
      });

      if (res.success && res.updatedOrder && res.updatedProducts && res.updatedPartUsages) {
        setSelectedOrder(res.updatedOrder);
        setRepairOrderLocal(res.updatedOrder);
        updateRepairOrder(res.updatedOrder, currentUserForAction);
        setProductLocal(res.updatedProducts.find(p => p.id === product.id) || product);
        res.updatedProducts.forEach(p => updateProduct(p));
        persistLocalUsages(res.updatedPartUsages);
        console.log(`⏱️ [AddPart] Atomic add part transaction completed in ${(performance.now() - t0).toFixed(2)}ms`);
      } else {
        dialog.alert({
          message: res.error || "حدث خطأ أثناء إضافة قطعة الغيار وحفظها بالخادم.",
          variant: "error"
        });
      }
    } catch (err: any) {
      dialog.alert({
        message: err?.message || "حدث خطأ غير متوقع أثناء إضافة قطعة الغيار.",
        variant: "error"
      });
    } finally {
      setBusyProductIds(prev => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
    }
  };

  const handleRemovePartUsage = async (usageId: string, deviceIdx: number, removeQty: number = 1) => {
    if (!selectedOrder) return;
    let usage = partUsages.find(pu => pu.id === usageId);
    if (!usage) {
      usage = partUsages.find(pu => pu.inventoryItemId === usageId && usageMatchesOrder(pu, selectedOrder) && pu.accountingStatus !== 'RETURNED');
    }

    const currentDevice = selectedOrder.devices?.[deviceIdx];
    const targetItem = currentDevice?.selectedRepairItems?.find(
      i => i.id === usageId || i.usageId === usageId || i.productId === usageId || i.name === usageId
    );

    if (usage && usage.accountingStatus === 'RETURNED') return;

    const inventoryItemId = usage ? usage.inventoryItemId : (targetItem?.productId || targetItem?.id || usageId);
    if (busyProductIds.has(inventoryItemId)) return;

    setBusyProductIds(prev => new Set(prev).add(inventoryItemId));

    try {
      const res = await executeRemovePartUsageTransaction({
        usageId,
        deviceIdx,
        removeQty,
        selectedOrder,
        products,
        partUsages
      });

      if (!res.success) {
        dialog.alert({
          message: res.error || "تعذر إكمال عملية إرجاع قطعة الغيار. تبقى القطعة قائمة كما هي.",
          variant: "error"
        });
        return;
      }

      // UI updates ONLY AFTER all persistence operations succeed
      if (res.updatedProducts) {
        res.updatedProducts.forEach(p => {
          setProductLocal(p);
          updateProduct(p);
        });
      }
      if (res.updatedPartUsages) {
        persistLocalUsages(res.updatedPartUsages);
      }
      if (res.updatedOrder) {
        setSelectedOrder(res.updatedOrder);
        setRepairOrderLocal(res.updatedOrder);
        updateRepairOrder(res.updatedOrder, currentUserForAction);
      }
    } catch (err: any) {
      console.error("Removal transaction exception:", err);
      dialog.alert({
        message: err?.message || "خطأ أثناء إرجاع قطعة الغيار.",
        variant: "error"
      });
    } finally {
      setBusyProductIds(prev => {
        const next = new Set(prev);
        next.delete(inventoryItemId);
        return next;
      });
    }
  };

  // Update Work Ownership Type (شغل المحل / أحمد البنا / عبده)
  const handleUpdateOwnershipType = (newOwnership: WorkOwnershipType) => {
    if (!selectedOrder) return;
    if (selectedOrder.isSettled) {
      dialog.alert({ message: "عذراً، لا يمكن تغيير نوع الشغل لطلب صيانة مدرج بتسوية مالية مقفلة!", variant: "error" });
      return;
    }

    const oldOwnership = selectedOrder.workOwnershipType || WorkOwnershipType.CUSTOMER_SHARED;

    let updatedOrder: RepairOrder = {
      ...selectedOrder,
      workOwnershipType: newOwnership
    };

    if (newOwnership === WorkOwnershipType.PARTNER_2_PRIVATE) {
      if (typeof updatedOrder.partnerDeductionRate !== "number") {
        updatedOrder.partnerDeductionRate = 25; // Default 25% for Abdou
      }
    } else {
      updatedOrder.partnerDeductionRate = 0;
    }

    updatedOrder = addAuditLogRecordHelper(
      updatedOrder,
      "CHANGE_OWNERSHIP",
      "ملكية العمل وتوزيع المستحقات",
      oldOwnership,
      newOwnership,
      "تعديل طبيعة ملكية العمل ونسب التوزيع",
      currentUserForAction
    );

    setSelectedOrder(updatedOrder);
    updateRepairOrder(updatedOrder);
  };

  // Update Partner Deduction Rate (%)
  const handleUpdateDeductionRate = (newRate: number) => {
    if (!selectedOrder) return;
    if (selectedOrder.isSettled) {
      dialog.alert({ message: "عذراً، لا يمكن تغيير نسبة الخصم لطلب صيانة مدرج بتسوية مقفلة!", variant: "error" });
      return;
    }

    const oldRate = selectedOrder.partnerDeductionRate ?? 0;

    let updatedOrder: RepairOrder = {
      ...selectedOrder,
      partnerDeductionRate: newRate
    };

    updatedOrder = addAuditLogRecordHelper(
      updatedOrder,
      "CHANGE_DEDUCTION_RATE",
      "نسبة الخصم للشريك",
      `${oldRate}%`,
      `${newRate}%`,
      "تعديل نسبة الخصم المقتطعة للمحل",
      currentUserForAction
    );

    setSelectedOrder(updatedOrder);
    updateRepairOrder(updatedOrder);
  };

  const handleUpdateOrderStatus = async (status: RepairStatus) => {
    if (!selectedOrder) return;

    const oldStatus = selectedOrder.status;
    const isDelivered = status === RepairStatus.Delivered;
    const isReady = status === RepairStatus.Ready;

    // Merge/sync with canonical active part usages to preserve selectedRepairItems, partsCost, and procedures
    const activeUsages = partUsages.filter(
      pu => pu.accountingStatus !== 'RETURNED' && pu.accountingStatus !== 'REVERSED'
    );
    const syncedBaseOrder = syncOrderSelectedRepairItemsFromUsages(
      selectedOrder,
      activeUsages,
      (pu) => getUsageSellingUnitPrice(pu, products),
      { usagesLoaded: partUsagesLoaded, allowClear: false }
    );

    // Order Completion Validation for Parts Cost
    if (isReady || isDelivered) {
      const totalOrderPartsCost = syncedBaseOrder.devices.reduce((sum, d) => sum + (Number(d.partsCost) || 0), 0);
      if (totalOrderPartsCost > 0) {
        const linkedUsages = activeUsages.filter(pu => usageMatchesOrder(pu, syncedBaseOrder));
        if (linkedUsages.length === 0) {
          dialog.alert({
            message: "لا يمكن إكمال أمر الصيانة لأن تكلفة قطع الغيار غير مرتبطة بقطع فعلية من المخزن.",
            variant: "error"
          });
          return;
        }
      }
    }

    // Update both main order status and all unfinished devices status
    const updatedDevices = syncedBaseOrder.devices.map(dev => {
      if (status === RepairStatus.Delivered || status === RepairStatus.Cancelled || status === RepairStatus.Ready) {
        return { ...dev, status };
      }
      return dev;
    });

    let updatedOrder: RepairOrder = {
      ...syncedBaseOrder,
      status,
      devices: updatedDevices,
      isPaid: isDelivered ? true : syncedBaseOrder.isPaid,
      completionDate: isReady || isDelivered ? new Date().toISOString() : syncedBaseOrder.completionDate
    };

    // Audit and Timeline logging
    updatedOrder = addAuditLogRecordHelper(
      updatedOrder,
      "CHANGE_STATUS",
      "حالة أمر الصيانة",
      statusConfig[oldStatus]?.text || oldStatus || "غير محدد",
      statusConfig[status]?.text || status || "غير محدد",
      `تحديث مرحلة الصيانة إلى (${statusConfig[status]?.text || status || "غير محدد"})`,
      currentUserForAction
    );

    const timelineEvt = status === RepairStatus.Delivered 
      ? "DELIVERED_TO_CUSTOMER" 
      : status === RepairStatus.Ready 
      ? "READY_FOR_DELIVERY" 
      : status === RepairStatus.Repairing 
      ? "INSPECTION_STARTED" 
      : "STATUS_CHANGED";

    updatedOrder = addTimelineEventHelper(
      updatedOrder,
      timelineEvt,
      `تغيير مرحلة الصيانة إلى: ${statusConfig[status]?.text || status || "غير محدد"}`,
      currentUserForAction
    );

    setSelectedOrder(updatedOrder);
    updateRepairOrder(updatedOrder);

    // If marked as Delivered, automatically generate a Paid Sales/Repair Invoice in Accounting!
    if (isDelivered) {
      const totalAmount = updatedOrder.totalEstimatedCost;
      const paid = totalAmount;

      await addInvoice({
        customerId: updatedOrder.customerId,
        orderId: updatedOrder.id,
        items: updatedOrder.devices.map(d => ({
          name: `صيانة ${getDeviceDisplayName(d)} - ${d.issue}`,
          quantity: 1,
          price: d.estimatedCost,
          costPrice: d.partsCost || 0
        })),
        totalAmount,
        discount: 0,
        paidAmount: paid,
        paymentMethod: PaymentMethod.Cash,
        type: "repair",
        isPaid: true
      }, currentLoggedUser);

      // Clear outstanding balance
      const customer = customers.find(c => c.id === updatedOrder.customerId);
      if (customer && customer.balance > 0) {
        updateCustomer({
          ...customer,
          balance: Math.max(0, customer.balance - (totalAmount - updatedOrder.advancePayment))
        });
      }
    }

    // WhatsApp notification workflow trigger after DB save
    if (isReady || status === RepairStatus.WaitingCustomerApproval || isDelivered) {
      await handleSendWhatsAppUpdate(updatedOrder);
    } else {
      const sendWa = await dialog.confirm({
        title: "إرسال إشعار إنجاز",
        message: `تم تحديث حالة الطلب إلى "${statusConfig[status]?.text || status || "غير محدد"}". هل تود إرسال إشعار فوري للعميل عبر الواتس آب؟`,
        confirmText: "إرسال واتساب",
        cancelText: "تخطي"
      });

      if (sendWa) {
        await handleSendWhatsAppUpdate(updatedOrder);
      }
    }
  };

  // Search matching function
  const matchesWorkshopSearch = (order: RepairOrder, query: string): boolean => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return true;

    // 1. Order ID / Order Number match
    if (order.id.toLowerCase().includes(trimmed)) return true;

    // 2. Customer or Guest Name match
    const custName = getCustomerNameHelper(order, customers).toLowerCase();
    if (custName.includes(trimmed)) return true;

    if (order.guestCustomerName && order.guestCustomerName.toLowerCase().includes(trimmed)) return true;
    if ((order as any).guest_name && String((order as any).guest_name).toLowerCase().includes(trimmed)) return true;
    if ((order as any).customer_name && String((order as any).customer_name).toLowerCase().includes(trimmed)) return true;

    // 3. Device Name & Serial Number match
    if (Array.isArray(order.devices)) {
      for (const d of order.devices) {
        const devDisplayName = getDeviceDisplayName(d).toLowerCase();
        if (devDisplayName.includes(trimmed)) return true;

        if (d.type && d.type.toLowerCase().includes(trimmed)) return true;
        if (d.model && d.model.toLowerCase().includes(trimmed)) return true;
        if (d.serialNumber && d.serialNumber.toLowerCase().includes(trimmed)) return true;
        if ((d as any).deviceCode && String((d as any).deviceCode).toLowerCase().includes(trimmed)) return true;
      }
    }

    // 4. Phone matching (ONLY if query contains digits!)
    const queryDigits = trimmed.replace(/\D/g, "");
    if (queryDigits.length > 0) {
      const custPhone = getCustomerPhoneHelper(order, customers);
      if (custPhone && custPhone !== "بدون رقم هاتف" && custPhone !== "0000000000") {
        const phoneDigits = custPhone.replace(/\D/g, "");
        if (phoneDigits) {
          const localPhoneDigits = phoneDigits.startsWith("201") && phoneDigits.length === 12 
            ? "0" + phoneDigits.slice(2) 
            : phoneDigits;
          
          const localQueryDigits = queryDigits.startsWith("201") && queryDigits.length === 12
            ? "0" + queryDigits.slice(2)
            : queryDigits;

          if (phoneDigits.includes(queryDigits) || localPhoneDigits.includes(localQueryDigits) || queryDigits.includes(phoneDigits) || localPhoneDigits.includes(queryDigits)) {
            return true;
          }
        }
      }
    }

    return false;
  };

  // Helper counts for tabs
  const countActiveAll = orders.filter(o => o.status !== RepairStatus.Delivered && o.status !== RepairStatus.Cancelled).length;
  const countDeliveredArchive = orders.filter(o => o.status === RepairStatus.Delivered || o.status === RepairStatus.Cancelled).length;

  // Filter orders by active status tab (Delivered orders excluded by default in active workshop)
  const statusFilteredOrders = orders.filter(o => {
    const isDeliveredOrCancelled = o.status === RepairStatus.Delivered || o.status === RepairStatus.Cancelled;
    if (activeTab === "active_all" || activeTab === "all") {
      return !isDeliveredOrCancelled;
    }
    if (activeTab === "delivered_archive") {
      return isDeliveredOrCancelled;
    }
    return o.status === activeTab;
  });

  const filteredOrders = statusFilteredOrders.filter(o => matchesWorkshopSearch(o, searchQuery));

  console.log("=== Repair Center: Orders after filter ===", statusFilteredOrders.length);
  console.log("=== Repair Center: Displayed orders ===", filteredOrders.length);

  return (
    <div className="space-y-6 text-right">
      {/* Top Header Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#11131e] p-5 rounded-2xl border border-[#2a2d42]">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Wrench className="w-6 h-6 text-indigo-400" />
            ورشة الفحص والصيانة المتقدمة
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            إدارة أجهزة الصيانة، الفصل الدقيق بين الأعطال والإجراءات، تتبع خط السير الزمني، وسجل التعديلات الفنية
          </p>
        </div>

        {/* Status Filters Bar */}
        <div className="flex flex-wrap gap-1.5 bg-gray-950 p-1.5 rounded-xl border border-[#2a2d42]">
          <button
            type="button"
            onClick={() => setActiveTab("active_all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "active_all" || activeTab === "all" ? "bg-indigo-600 text-white shadow-md shadow-indigo-950/50" : "text-gray-400 hover:text-white"
            }`}
          >
            الكل النشط ({countActiveAll})
          </button>
          
          {Object.entries(statusConfig).map(([st, cfg]) => {
            if (st === RepairStatus.Delivered || st === RepairStatus.Cancelled) return null;
            const count = orders.filter(o => o.status === st).length;
            return (
              <button
                key={st}
                type="button"
                onClick={() => setActiveTab(st)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === st ? cfg.class : "text-gray-400 hover:text-white"
                }`}
              >
                {cfg?.text ?? st} ({count})
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setActiveTab("delivered_archive")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "delivered_archive" ? "bg-cyan-600/30 border border-cyan-500/50 text-cyan-300 shadow-md shadow-cyan-950/50" : "text-gray-400 hover:text-white"
            }`}
          >
            تم التسليم / الأرشيف ({countDeliveredArchive})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Orders List Sidebar Column */}
        <div className="lg:col-span-1 bg-[#11131e] border border-[#2a2d42] rounded-2xl p-4 space-y-3 max-h-[800px] overflow-y-auto">
          <div className="flex justify-between items-center border-b border-[#2a2d42] pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              أجهزة الورشة النشطة ({filteredOrders.length})
            </h3>
          </div>

          {/* Workshop Search Bar */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="بحث بالاسم، رقم الهاتف، رقم الإيصال، السيريال..."
              className="w-full bg-gray-950 border border-[#2a2d42] focus:border-indigo-500 text-xs text-white rounded-xl pr-9 pl-8 py-2.5 outline-none transition-all placeholder:text-gray-500"
            />
            <Search className="w-4 h-4 text-gray-400 absolute right-3 top-3" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute left-3 top-2.5 text-gray-400 hover:text-white p-0.5 rounded-full"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {filteredOrders.length === 0 ? (
            <div className="text-center py-10 bg-[#16192a] rounded-xl border border-[#2a2d42] p-4 text-gray-400 space-y-2">
              <Search className="w-8 h-8 mx-auto opacity-40 text-indigo-400" />
              <p className="text-xs font-bold text-gray-300">لا توجد أوامر صيانة مطابقة</p>
              <p className="text-[11px] text-gray-500">
                {searchQuery ? "يرجى التحقق من كلمات البحث أو رقم الهاتف المدخل" : "لا توجد أجهزة متواجدة ضمن هذا القسم حالياً"}
              </p>
            </div>
          ) : (
            filteredOrders.map(order => {
              const isSelected = selectedOrder?.id === order.id;
              const customerName = getCustomerNameHelper(order, customers);
              const customerPhone = getCustomerPhoneHelper(order, customers);
              const cfg = statusConfig[order.status] || { text: order.status || "غير محدد", class: "bg-gray-800 text-gray-300" };

              return (
                <div
                  key={order.id}
                  onClick={() => {
                    setSelectedOrder(order);
                    setWorkspaceTab("workshop");
                  }}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer relative group ${
                    isSelected
                      ? "bg-indigo-950/40 border-indigo-500 shadow-md shadow-indigo-950/30"
                      : "bg-[#16192a] border-[#2a2d42] hover:border-gray-700 hover:bg-[#1a1e32]"
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-xs font-mono font-extrabold text-indigo-400">{order.id}</span>
                      <h4 className="text-xs font-bold text-white mt-0.5">{customerName}</h4>
                      <PhoneDisplay phone={customerPhone} className="text-[10px] text-gray-400 font-mono" />
                    </div>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${cfg.class}`}>
                      {cfg?.text ?? order.status ?? "غير محدد"}
                    </span>
                  </div>

                  {/* Devices Brief */}
                  <div className="space-y-1 mt-2 border-t border-[#2a2d42]/60 pt-2">
                    {order.devices.map((d, i) => (
                      <div key={i} className="flex justify-between items-center text-[11px] text-gray-300">
                        <span className="font-semibold">{getDeviceDisplayName(d)}</span>
                        <span className="text-emerald-400 font-mono font-bold">{d.finalRepairPrice ?? d.estimatedCost} ج.م</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center mt-3 text-[10px] text-gray-400 border-t border-[#2a2d42]/40 pt-2">
                    <span>{new Date(order.receivedDate).toLocaleDateString("ar-EG")}</span>
                    <span className="text-indigo-300 font-bold">إجمالي: {order.totalEstimatedCost} ج.م</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Selected Order Workspace Details Column */}
        <div className="lg:col-span-2">
          {selectedOrder ? (
            <div className="bg-[#11131e] border border-[#2a2d42] p-6 rounded-2xl space-y-6 text-right">
              {/* Order Detail Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-[#2a2d42]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-mono font-bold text-indigo-400">{selectedOrder.id}</span>
                    <span className="text-xs text-gray-400">| أمر صيانة متكامل</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-gray-400">العميل:</span>
                    <span className="font-bold text-white text-xs">{getCustomerNameHelper(selectedOrder, customers)}</span>
                    <PhoneDisplay phone={getCustomerPhoneHelper(selectedOrder, customers)} className="text-xs text-gray-400 font-mono" />
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      getCustomerBadgeHelper(selectedOrder).type === 'REGISTERED' 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    }`}>
                      {getCustomerBadgeHelper(selectedOrder).label}
                    </span>
                  </div>
                </div>

                {/* Order Overall Status Dropdown Selector & Quick Actions */}
                <div className="flex flex-wrap gap-2.5 items-center">
                  <div className="flex gap-2 items-center">
                    <span className="text-xs text-gray-400">حالة الصيانة:</span>
                    <select
                      value={selectedOrder.status}
                      onChange={e => handleUpdateOrderStatus(e.target.value as RepairStatus)}
                      className="bg-gray-950 border border-indigo-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
                    >
                      {Object.values(RepairStatus).map(st => (
                        <option key={st} value={st}>
                          {statusConfig[st]?.text ?? st}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* DELIVER DEVICE BUTTON */}
                  {selectedOrder.status !== RepairStatus.Delivered &&
                    selectedOrder.status !== RepairStatus.Cancelled &&
                    selectedOrder.deliveryStatus !== "DELIVERED" && (
                      <button
                        type="button"
                        onClick={() => setIsDeliverModalOpen(true)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs py-2 px-3.5 rounded-xl font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-950/40 cursor-pointer transition-all border border-emerald-400/30"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        تسليم الجهاز
                      </button>
                    )}

                  {/* REOPEN ORDER BUTTON */}
                  {(selectedOrder.status === RepairStatus.Delivered ||
                    selectedOrder.deliveryStatus === "DELIVERED") &&
                    canReopenDeliveredOrder(currentUserForAction) && (
                      <button
                        type="button"
                        onClick={() => setIsReopenModalOpen(true)}
                        className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs py-2 px-3 rounded-xl border border-amber-500/30 flex items-center gap-1.5 font-bold cursor-pointer transition-colors"
                      >
                        <Lock className="w-4 h-4 text-amber-400" />
                        إعادة فتح أمر الصيانة
                      </button>
                    )}

                  {/* CANCEL WARRANTY BUTTON */}
                  {selectedOrder.warrantyStatus === "IN_WARRANTY" &&
                    canCancelWarranty(currentUserForAction) && (
                      <button
                        type="button"
                        onClick={() => setIsCancelWarrantyModalOpen(true)}
                        className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs py-2 px-3 rounded-xl border border-rose-500/30 flex items-center gap-1.5 font-bold cursor-pointer transition-colors"
                      >
                        <ShieldAlert className="w-4 h-4 text-rose-400" />
                        إلغاء الضمان
                      </button>
                    )}

                  {/* Send WhatsApp notification button */}
                  <button
                    type="button"
                    onClick={() => handleSendWhatsAppUpdate(selectedOrder)}
                    className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs py-2 px-3 rounded-xl border border-emerald-500/30 flex items-center gap-1.5 font-bold cursor-pointer transition-colors"
                  >
                    <MessageSquare className="w-4 h-4 fill-current" />
                    إشعار الواتساب
                  </button>

                  {/* Print Receipt button */}
                  <button
                    type="button"
                    onClick={() => {
                      setReceiptOrder(selectedOrder);
                      setIsReceiptOpen(true);
                    }}
                    className="bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs py-2 px-3 rounded-xl border border-indigo-500/30 flex items-center gap-1.5 font-bold cursor-pointer transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    طباعة الإيصال
                  </button>

                  {/* Delete Button */}
                  {(currentLoggedUser?.role === "admin" || currentLoggedUser?.permissions?.includes("all")) && selectedOrder.status !== RepairStatus.Delivered && selectedOrder.deliveryStatus !== "DELIVERED" && (
                    <button
                      type="button"
                      onClick={() => handleDeleteOrder(selectedOrder.id)}
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs py-2 px-3 rounded-xl border border-red-500/20 flex items-center gap-1.5 font-bold cursor-pointer transition-colors"
                      title="حذف الأوردر نهائياً قبل التسليم مع إرجاع قطع الغيار للمخزن وإلغاء المبيعات وحسابات الشركاء"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                      حذف الأمر قبل التسليم
                    </button>
                  )}
                </div>
              </div>

              {/* Order Workspace Navigation Tabs Bar */}
              <div className="bg-gray-950 p-1.5 rounded-xl border border-[#2a2d42] flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setWorkspaceTab("workshop")}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      workspaceTab === "workshop"
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-950/50"
                        : "text-gray-400 hover:text-white hover:bg-gray-900"
                    }`}
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>الورشة والإصلاح</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWorkspaceTab("timeline")}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      workspaceTab === "timeline"
                        ? "bg-cyan-600 text-white shadow-md shadow-cyan-950/50"
                        : "text-gray-400 hover:text-white hover:bg-gray-900"
                    }`}
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>سجل مراحل الصيانة ({selectedOrder.timelineEvents?.length || 0})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWorkspaceTab("audit")}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      workspaceTab === "audit"
                        ? "bg-purple-600 text-white shadow-md shadow-purple-950/50"
                        : "text-gray-400 hover:text-white hover:bg-gray-900"
                    }`}
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>سجل التعديلات الفنية ({selectedOrder.auditLogs?.length || 0})</span>
                  </button>
                </div>
              </div>

              {/* Delivered Order Lock Banner */}
              {(selectedOrder.status === RepairStatus.Delivered || selectedOrder.deliveryStatus === "DELIVERED") && (
                <div className="bg-emerald-950/40 border border-emerald-500/40 p-4 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 text-emerald-300 font-bold">
                    <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-sm text-emerald-200">🔒 تم تسليم الجهاز وقفل أمر الصيانة نهائياً</p>
                      <p className="text-[11px] text-gray-300 font-normal mt-0.5">
                        التاريخ: {selectedOrder.deliveredAt ? new Date(selectedOrder.deliveredAt).toLocaleString("ar-EG") : "مسلّم"} | القائم بالتسليم: <strong className="text-emerald-400">{selectedOrder.deliveredByUserName || "أحمد البنا"}</strong>
                      </p>
                    </div>
                  </div>
                  {canReopenDeliveredOrder(currentUserForAction) && (
                    <button
                      type="button"
                      onClick={() => setIsReopenModalOpen(true)}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-1.5 px-3 rounded-lg text-xs transition-colors cursor-pointer shadow-md shadow-amber-950/40"
                    >
                      إعادة فتح للأهمية (أحمد البنا)
                    </button>
                  )}
                </div>
              )}

              {/* ==================== WORKSPACE TAB 1: POS WORKSHOP & REPAIR ==================== */}
              {workspaceTab === "workshop" && (() => {
                const currentDevice = selectedOrder.devices[0] || { type: 'PlayStation', model: 'PS5', issue: '' };
                const devIdx = 0;

                // Linked part usages for current device (canonical usages dataset when loaded, snapshot fallback when unhydrated)
                const usagesFromStore = partUsagesLoaded
                  ? getActiveRepairUsagesForDevice(selectedOrder, currentDevice, devIdx, partUsages)
                  : [];
                const deviceLinkedUsages: RepairPartUsage[] = (usagesFromStore.length > 0)
                  ? usagesFromStore
                  : (currentDevice.selectedRepairItems || []).map((item, idx) => ({
                      id: item.usageId || item.id || `fallback-${idx}`,
                      repairOrderId: selectedOrder.id,
                      inventoryItemId: item.productId || item.id || '',
                      partName: item.name,
                      quantity: item.quantity || 1,
                      unitCost: item.costPrice || 0,
                      totalCost: (item.costPrice || 0) * (item.quantity || 1),
                      sellingPrice: item.repairPrice ?? item.salePrice ?? 0,
                      sellingTotal: (item.repairPrice ?? item.salePrice ?? 0) * (item.quantity || 1),
                      ownershipType: selectedOrder.workOwnershipType || WorkOwnershipType.CUSTOMER_SHARED,
                      responsiblePartnerId: 'SHOP',
                      accountingStatus: 'CONSUMED',
                      createdAt: selectedOrder.createdAt || new Date().toISOString()
                    }));

                const matchedOrderUsages = getActiveRepairUsagesForOrder(selectedOrder, partUsages);
                console.log("REPAIR_UI_RUNTIME=", {
                  orderId: selectedOrder.id,
                  orderNumber: selectedOrder.orderNumber,
                  partUsagesLoaded,
                  allPartUsagesCount: partUsages.length,
                  matchedOrderUsages: matchedOrderUsages.map(pu => ({
                    id: pu.id,
                    repairOrderId: pu.repairOrderId || (pu as any).repair_order_id,
                    deviceId: (pu as any).deviceId || (pu as any).device_id,
                    deviceIndex: (pu as any).deviceIndex ?? (pu as any).device_index,
                    inventoryItemId: pu.inventoryItemId,
                    partName: pu.partName,
                    quantity: pu.quantity,
                    sellingPrice: pu.sellingPrice,
                    accountingStatus: pu.accountingStatus
                  })),
                  matchedDeviceUsages: deviceLinkedUsages.map(pu => ({
                    id: pu.id,
                    repairOrderId: pu.repairOrderId || (pu as any).repair_order_id,
                    deviceId: (pu as any).deviceId || (pu as any).device_id,
                    deviceIndex: (pu as any).deviceIndex ?? (pu as any).device_index,
                    inventoryItemId: pu.inventoryItemId,
                    partName: pu.partName,
                    quantity: pu.quantity,
                    sellingPrice: pu.sellingPrice,
                    accountingStatus: pu.accountingStatus
                  })),
                  selectedRepairItemsSnapshot: currentDevice.selectedRepairItems || []
                });

                // Total selling price of all linked used parts
                const partsTotalSelling = deviceLinkedUsages.reduce((sum, pu) => {
                  const sellP = getUsageSellingUnitPrice(pu, products);
                  return sum + (pu.quantity * sellP);
                }, 0);

                // Reported faults / complaint
                const reportedFaults = currentDevice.reportedFaults || (currentDevice.issue ? currentDevice.issue.split(" - ").map(s => s.trim()) : []);

                // Labor Price calculation:
                const faultsLaborCost = currentDevice.suggestedRepairPrice ?? calculateSuggestedPriceForFaults(reportedFaults);
                const grandTotal = (currentDevice.finalRepairPrice ?? currentDevice.estimatedCost) || (partsTotalSelling + faultsLaborCost);
                const calculatedLabor = Math.max(0, grandTotal - partsTotalSelling);

                // Instant Search filtering (compatible parts with search text matching name, nameAr, SKU, or barcode)
                const query = partSearch.trim().toLowerCase();
                const availableInventory = products.filter(p => !p.isArchived);
                const compatibleInventory = availableInventory.filter(p => isProductCompatibleWithDevice(p, currentDevice.type, currentDevice.model));
                const baseListToSearch = (compatibleInventory.length > 0 ? compatibleInventory : availableInventory);

                const matchedSearchResults = baseListToSearch.filter(p => {
                  if (!query) return true;
                  const nameMatch = p.name.toLowerCase().includes(query) || (p.nameAr && p.nameAr.toLowerCase().includes(query));
                  const skuMatch = p.sku ? p.sku.toLowerCase().includes(query) : false;
                  const barcodeMatch = p.barcode ? p.barcode.toLowerCase().includes(query) : false;
                  const catMatch = p.category ? p.category.toLowerCase().includes(query) : false;
                  return nameMatch || skuMatch || barcodeMatch || catMatch;
                });

                return (
                  <div className="space-y-4 font-sans text-right">
                    {/* -----------------------------------------
                        SECTION 1: COMPACT HEADER CARD
                       ----------------------------------------- */}
                    <div className="bg-[#11131e] border border-[#2a2d42] p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex flex-wrap items-center gap-4 text-white">
                        <div className="flex items-center gap-1.5 bg-[#181b2a] px-3 py-1.5 rounded-lg border border-[#2a2d42]">
                          <span className="text-gray-400 font-medium">رقم أمر الصيانة:</span>
                          <span className="font-extrabold text-indigo-400 font-mono text-sm">
                            #{selectedOrder.orderNumber || selectedOrder.id.slice(0, 8)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-400 font-medium">الجهاز:</span>
                          <span className="font-bold text-white">{currentDevice.type || "غير محدد"}</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-400 font-medium">الموديل:</span>
                          <span className="font-bold text-white">{currentDevice.model || "غير محدد"}</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-400 font-medium">الرقم التسلسلي:</span>
                          <span className="font-mono text-gray-300 bg-gray-900 px-2 py-0.5 rounded border border-gray-800">
                            {currentDevice.serialNumber || "غير متوفر"}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-400 font-medium">اسم العميل:</span>
                          <span className="font-bold text-white">{getCustomerNameHelper(selectedOrder, customers)}</span>
                          <span className="text-cyan-400 font-mono font-bold mr-1">({getCustomerPhoneHelper(selectedOrder, customers)})</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 font-medium whitespace-nowrap">الحالة الحالية:</span>
                        <select
                          value={selectedOrder.status}
                          onChange={(e) => handleUpdateOrderStatus(e.target.value as RepairStatus)}
                          className="bg-[#181b2a] border border-indigo-500/40 text-white font-bold text-xs rounded-lg px-3 py-1.5 focus:outline-none cursor-pointer hover:border-indigo-500"
                        >
                          <option value={RepairStatus.Received}>تم الاستلام</option>
                          <option value={RepairStatus.Diagnosing}>قيد التشخيص</option>
                          <option value={RepairStatus.Repairing}>قيد الإصلاح</option>
                          <option value={RepairStatus.WaitingParts}>بانتظار قطع الغيار</option>
                          <option value={RepairStatus.Ready}>جاهز للتسليم</option>
                          <option value={RepairStatus.Delivered}>تم التسليم</option>
                          <option value={RepairStatus.Cancelled}>ملغى</option>
                        </select>
                      </div>
                    </div>

                    {/* TWO-COLUMN WORKSHOP LAYOUT ON DESKTOP */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      {/* MAIN WORKFLOW AREA (2 Spans) */}
                      <div className="lg:col-span-2 space-y-4">
                        {/* SECTION 2 & 3: COMPLAINT & DIAGNOSIS */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* SECTION 2: CUSTOMER COMPLAINT */}
                          <div className="bg-[#11131e] border border-[#2a2d42] p-4 rounded-xl space-y-2.5">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-extrabold text-white">
                                شكوى العميل
                              </label>

                              {/* Dropdown Button */}
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() => setShowQuickFaultsDropdown(!showQuickFaultsDropdown)}
                                  className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-500/30 px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer"
                                >
                                  <span>+ إدراج شكوى شائعة</span>
                                </button>

                                {showQuickFaultsDropdown && (
                                  <div className="absolute left-0 top-full mt-1.5 w-64 bg-[#181b2a] border border-[#2a2d42] rounded-xl shadow-2xl p-2 z-30 max-h-56 overflow-y-auto custom-scrollbar">
                                    <div className="text-[10px] text-gray-400 font-bold px-2 py-1 border-b border-gray-800 mb-1 flex justify-between items-center">
                                      <span>اختر شكوى شائعة لإدراجها:</span>
                                      <button
                                        type="button"
                                        onClick={() => setShowQuickFaultsDropdown(false)}
                                        className="text-gray-400 hover:text-white"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                    <div className="space-y-1">
                                      {QUICK_FAULTS_LIST.map((fault) => (
                                        <button
                                          key={fault.id}
                                          type="button"
                                          onClick={() => {
                                            handleToggleQuickFaultInRepairCenter(devIdx, fault.label);
                                            setShowQuickFaultsDropdown(false);
                                          }}
                                          className="w-full text-right px-2.5 py-1.5 text-xs text-gray-200 hover:text-white hover:bg-indigo-600/30 rounded-lg transition flex items-center justify-between cursor-pointer"
                                        >
                                          <span>{fault.label}</span>
                                          {fault.defaultSellingPrice > 0 && (
                                            <span className="text-[10px] text-emerald-400 font-mono">+{fault.defaultSellingPrice} ج.م</span>
                                          )}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            <textarea
                              rows={4}
                              placeholder="أدخل شكوى العميل بالتفصيل..."
                              value={currentDevice.issue || ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                const updatedDevices = [...selectedOrder.devices];
                                if (updatedDevices[devIdx]) {
                                  updatedDevices[devIdx].issue = val;
                                  const updatedOrder = { ...selectedOrder, devices: updatedDevices };
                                  setSelectedOrder(updatedOrder);
                                  updateRepairOrder(updatedOrder);
                                }
                              }}
                              className="w-full bg-[#181b2a] border border-[#2a2d42] rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none font-medium leading-relaxed"
                            />
                          </div>

                          {/* SECTION 3: TECHNICAL DIAGNOSIS */}
                          <div className="bg-[#11131e] border border-[#2a2d42] p-4 rounded-xl space-y-2.5">
                            <label className="text-xs font-extrabold text-white block">
                              تشخيص الفني
                            </label>
                            <textarea
                              rows={4}
                              placeholder="أدخل نتيجة التشخيص الفني، الفحص، والإجراءات المتبعة..."
                              value={currentDevice.technicalNotes || selectedOrder.notes || ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                const updatedDevices = [...selectedOrder.devices];
                                if (updatedDevices[devIdx]) {
                                  updatedDevices[devIdx].technicalNotes = val;
                                }
                                const updatedOrder = { ...selectedOrder, notes: val, devices: updatedDevices };
                                setSelectedOrder(updatedOrder);
                                updateRepairOrder(updatedOrder);
                              }}
                              className="w-full bg-[#181b2a] border border-[#2a2d42] rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none font-medium leading-relaxed"
                            />
                          </div>
                        </div>

                        {/* SECTION 4: SPARE PARTS & PARTS TABLE */}
                        <div className="bg-[#11131e] border border-[#2a2d42] p-4 rounded-xl space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-extrabold text-white">
                              قطع الغيار
                            </label>
                            <span className="text-[11px] text-gray-400 font-semibold">
                              قطع متوافقة مع {currentDevice.type} {currentDevice.model}
                            </span>
                          </div>

                          {/* Persistent Search Field */}
                          <div className="relative">
                            <Search className="w-4 h-4 text-gray-400 absolute right-3.5 top-3.5" />
                            <input
                              type="text"
                              placeholder="🔍 ابحث باسم القطعة أو SKU أو Barcode..."
                              value={partSearch}
                              onChange={(e) => setPartSearch(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && matchedSearchResults.length > 0) {
                                  e.preventDefault();
                                  const firstP = matchedSearchResults[0];
                                  if (firstP && firstP.quantity > 0) {
                                    handleAddPartToDevice(devIdx, firstP.id, 1);
                                    setPartSearch('');
                                  }
                                }
                              }}
                              className="w-full bg-[#181b2a] border border-[#2a2d42] rounded-xl pr-10 pl-4 py-2.5 text-xs text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 font-medium"
                            />
                            {partSearch && (
                              <button
                                type="button"
                                onClick={() => setPartSearch('')}
                                className="absolute left-3 top-2.5 text-gray-400 hover:text-white bg-gray-800 rounded-full w-5 h-5 flex items-center justify-center text-[10px] cursor-pointer"
                              >
                                ✕
                              </button>
                            )}
                          </div>

                          {/* Quick Add Compatible Items Grid */}
                          <div className="bg-[#181b2a] border border-[#2a2d42] p-3 rounded-xl max-h-[340px] overflow-y-auto custom-scrollbar space-y-2.5">
                            <div className="text-[11px] text-gray-300 font-bold px-1 flex items-center justify-between">
                              <span>{partSearch.trim() ? `نتائج البحث (${matchedSearchResults.length}):` : `القطع المتوافقة القابلة للإضافة السريعة:`}</span>
                            </div>
                            {matchedSearchResults.length === 0 ? (
                              <p className="text-xs text-gray-400 italic py-3 text-center">لا توجد قطع غيار مطابقة.</p>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {matchedSearchResults.slice(0, 12).map((p) => {
                                  const price = Number(p.sellPrice || (p as any).price || p.purchasePrice || 0);
                                  const isBusy = busyProductIds.has(p.id);
                                  const isOutOfStock = p.quantity <= 0;
                                  return (
                                    <button
                                      key={p.id}
                                      type="button"
                                      disabled={isOutOfStock || isBusy}
                                      onClick={() => {
                                        handleAddPartToDevice(devIdx, p.id, 1);
                                        setPartSearch('');
                                      }}
                                      className={`p-3.5 rounded-xl text-xs font-bold border text-right transition flex flex-col justify-between gap-2.5 w-full min-h-[135px] ${
                                        isOutOfStock || isBusy
                                          ? "bg-gray-900/80 text-gray-500 border-gray-800 cursor-not-allowed opacity-60"
                                          : "bg-[#11131e] text-white border-[#2a2d42] hover:border-indigo-500 hover:bg-indigo-950/30 cursor-pointer shadow-sm hover:shadow-md"
                                      }`}
                                    >
                                      {/* Full Product Name (Wrap to 2 lines if needed, no truncate) */}
                                      <div className="w-full">
                                        <p className="font-bold text-gray-100 text-xs leading-snug line-clamp-2 break-words whitespace-normal">
                                          {p.nameAr || p.name}
                                        </p>
                                      </div>

                                      {/* Available Stock Line */}
                                      <div className="text-[11px] text-gray-300 font-medium flex items-center justify-between gap-1 border-t border-[#2a2d42]/60 pt-2 w-full">
                                        <span className="text-gray-400 text-[10px]">المخزون المتاح:</span>
                                        <span className="font-mono font-bold text-gray-100">{p.quantity} قطعة</span>
                                        {isBusy && <span className="text-amber-400 font-bold animate-pulse text-[10px]">(جاري الحفظ...)</span>}
                                      </div>

                                      {/* Selling Price Line */}
                                      <div className="text-[11px] text-gray-300 font-medium flex items-center justify-between gap-1 border-t border-[#2a2d42]/60 pt-2 w-full">
                                        <span className="text-gray-400 text-[10px]">سعر البيع:</span>
                                        <span className="font-mono font-extrabold text-emerald-400 text-xs bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                                          {price.toLocaleString('ar-EG')} ج.م
                                        </span>
                                      </div>

                                      {/* Action Button Line */}
                                      <div className="w-full pt-1">
                                        <span className={`flex items-center justify-center gap-1.5 text-xs font-extrabold py-1.5 px-3 rounded-lg w-full transition ${
                                          isOutOfStock || isBusy
                                            ? "bg-gray-800 text-gray-500 border border-gray-700"
                                            : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm"
                                        }`}>
                                          <span>{isOutOfStock ? "غير متوفر" : isBusy ? "جاري الإضافة..." : "إضافة للطلب"}</span>
                                          {!isOutOfStock && !isBusy && <Plus className="w-3.5 h-3.5" />}
                                        </span>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Parts Table */}
                          <div className="overflow-x-auto rounded-xl border border-[#2a2d42] bg-[#141624]">
                            <table id="repair-center-workshop-parts-table" className="w-full text-xs text-right text-gray-200 border-collapse">
                              <thead className="bg-[#181b2a] text-gray-400 font-bold border-b border-[#2a2d42]">
                                <tr>
                                  <th className="p-3">القطعة</th>
                                  <th className="p-3 text-center">السعر</th>
                                  <th className="p-3 text-center">الكمية</th>
                                  <th className="p-3 text-left font-bold text-emerald-400">الإجمالي</th>
                                  <th className="p-3 text-center">حذف</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#2a2d42]">
                                {deviceLinkedUsages.length === 0 ? (
                                  <tr>
                                    <td colSpan={5} className="p-6 text-center text-gray-500 text-xs font-bold">
                                      لم يتم إضافة قطع غيار لهذا الجهاز بعد. اضغط على أي قطعة من القائمة أعلاه لإضافتها فوراً.
                                    </td>
                                  </tr>
                                ) : (
                                  deviceLinkedUsages.map((pu) => {
                                    const unitSellPrice = getUsageSellingUnitPrice(pu, products);
                                    const lineTotal = pu.quantity * unitSellPrice;
                                    const matchedProd = products.find(p => p.id === pu.inventoryItemId);
                                    const stockAvail = matchedProd ? matchedProd.quantity : 0;
                                    const isBusy = busyProductIds.has(pu.inventoryItemId);

                                    return (
                                      <tr key={pu.id} className="hover:bg-[#181b2a] transition-colors">
                                        <td className="p-3 font-bold text-white">
                                          <div className="flex items-center gap-2">
                                            <span>{pu.partName}</span>
                                            {isBusy && (
                                              <span className="text-[10px] text-amber-400 bg-amber-950/60 border border-amber-500/30 px-1.5 py-0.5 rounded font-bold animate-pulse">
                                                جاري التحديث...
                                              </span>
                                            )}
                                          </div>
                                        </td>

                                        <td className="p-3 text-center font-mono font-bold text-gray-300">
                                          {unitSellPrice.toLocaleString('ar-EG')} ج.م
                                        </td>

                                        <td className="p-3 text-center">
                                          <div className="inline-flex items-center gap-2 bg-[#181b2a] px-2 py-1 rounded-lg border border-[#2a2d42]">
                                            <button
                                              type="button"
                                              disabled={isBusy}
                                              onClick={() => handleRemovePartUsage(pu.id, devIdx, 1)}
                                              className="w-7 h-7 flex items-center justify-center bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-md font-bold text-base transition cursor-pointer"
                                              title="خصم قطعة (-)"
                                            >
                                              -
                                            </button>

                                            <span className="font-mono text-white text-sm font-extrabold px-1.5 min-w-[20px]">
                                              {pu.quantity}
                                            </span>

                                            <button
                                              type="button"
                                              disabled={stockAvail <= 0 || isBusy}
                                              onClick={() => handleAddPartToDevice(devIdx, pu.inventoryItemId, 1)}
                                              className="w-7 h-7 flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 text-white rounded-md font-bold text-base transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                              title={stockAvail <= 0 ? "المخزون نفذ" : "إضافة قطعة (+)"}
                                            >
                                              +
                                            </button>
                                          </div>
                                        </td>

                                        <td className="p-3 text-left font-mono font-extrabold text-emerald-400 text-xs">
                                          {lineTotal.toLocaleString('ar-EG')} ج.م
                                        </td>

                                        <td className="p-3 text-center">
                                          <button
                                            type="button"
                                            disabled={isBusy}
                                            onClick={() => handleRemovePartUsage(pu.id, devIdx, -1)}
                                            className="p-1.5 bg-rose-500/10 hover:bg-rose-600 disabled:opacity-30 disabled:cursor-not-allowed text-rose-400 hover:text-white rounded-lg transition cursor-pointer"
                                            title="حذف القطعة"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>

                      {/* RIGHT SIDEBAR (Quick info, Summary, Actions) */}
                      <div className="space-y-4">
                        {/* DEVICE QUICK INFO CARD */}
                        <div className="bg-[#11131e] border border-[#2a2d42] p-4 rounded-xl space-y-3">
                          <div className="flex items-center gap-3 border-b border-[#2a2d42] pb-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                              <Gamepad2 className="w-5 h-5 text-indigo-400" />
                            </div>
                            <div>
                              <h4 className="text-sm font-extrabold text-white">
                                {currentDevice.type} {currentDevice.model}
                              </h4>
                              <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                                S/N: {currentDevice.serialNumber || "غير مسجل"}
                              </p>
                            </div>
                          </div>

                          <div className="text-xs space-y-2 text-gray-300">
                            <div className="flex justify-between">
                              <span className="text-gray-400">تاريخ الاستلام:</span>
                              <span className="font-mono text-white">
                                {new Date(selectedOrder.createdAt).toLocaleDateString('ar-EG')}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">القائم بالفحص:</span>
                              <span className="text-white font-bold">{selectedOrder.assignedTechnicianName || "فني الورشة"}</span>
                            </div>
                          </div>
                        </div>

                        {/* SUMMARY PANEL */}
                        <div className="bg-[#11131e] border border-[#2a2d42] p-5 rounded-xl space-y-3">
                          <div className="flex items-center justify-between text-xs text-gray-300">
                            <span className="font-bold">قطع الغيار</span>
                            <span className="font-mono font-extrabold text-white text-sm">
                              {partsTotalSelling.toLocaleString('ar-EG')} ج.م
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-xs text-gray-300">
                            <span className="font-bold">المصنعية</span>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min="0"
                                value={calculatedLabor}
                                onChange={(e) => {
                                  const newLabor = Math.max(0, Number(e.target.value) || 0);
                                  const newGrand = partsTotalSelling + newLabor;
                                  handleManualDevicePriceChange(devIdx, newGrand);
                                }}
                                className="w-24 bg-[#181b2a] border border-[#2a2d42] rounded-lg px-2 py-1 text-center font-mono font-extrabold text-white text-xs focus:outline-none focus:border-indigo-500"
                              />
                              <span className="text-gray-400 font-bold text-[11px]">ج.م</span>
                            </div>
                          </div>

                          <div className="border-t border-[#2a2d42] pt-3 flex items-center justify-between">
                            <span className="text-sm font-extrabold text-white">الإجمالي</span>
                            <span className="text-2xl font-black font-mono text-emerald-400">
                              {grandTotal.toLocaleString('ar-EG')} <span className="text-sm font-sans">ج.م</span>
                            </span>
                          </div>
                        </div>

                        {/* BOTTOM ACTIONS */}
                        <div className="bg-[#11131e] border border-[#2a2d42] p-4 rounded-xl space-y-2.5">
                          {/* 💾 حفظ */}
                          <button
                            type="button"
                            onClick={() => {
                              updateRepairOrder(selectedOrder);
                              dialog.alert({ message: "تم حفظ بيانات طلب الصيانة بنجاح", variant: "success" });
                            }}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs py-3 px-4 rounded-xl shadow transition cursor-pointer flex items-center justify-center gap-2"
                          >
                            <Save className="w-4 h-4" />
                            <span>💾 حفظ</span>
                          </button>

                          {/* 🛠 جاهز */}
                          <button
                            type="button"
                            onClick={async () => {
                              await handleUpdateOrderStatus(RepairStatus.Ready);
                              dialog.alert({ message: "تم تحديث حالة الجهاز إلى (جاهز للتسليم)", variant: "success" });
                            }}
                            className="w-full bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold text-xs py-3 px-4 rounded-xl shadow transition cursor-pointer flex items-center justify-center gap-2"
                          >
                            <CheckCircle className="w-4 h-4" />
                            <span>🛠 جاهز</span>
                          </button>

                          {/* 🚚 تم التسليم */}
                          <button
                            type="button"
                            disabled={selectedOrder.status === RepairStatus.Delivered}
                            onClick={async () => {
                              await handleUpdateOrderStatus(RepairStatus.Delivered);
                              dialog.alert({ message: "تم تسليم الجهاز وإغلاق الطلب بنجاح", variant: "success" });
                            }}
                            className="w-full bg-cyan-700 hover:bg-cyan-600 text-white font-extrabold text-xs py-3 px-4 rounded-xl shadow transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            <Truck className="w-4 h-4" />
                            <span>🚚 تم التسليم</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ==================== WORKSPACE TAB 2: TIMELINE LOG ==================== */}
              {workspaceTab === "timeline" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-[#2a2d42] pb-3">
                    <h4 className="text-sm font-bold text-cyan-300 flex items-center gap-2">
                      <History className="w-4 h-4 text-cyan-400" />
                      سجل خط السير الزمني (Timeline Log)
                    </h4>

                    <button
                      type="button"
                      onClick={() => setTimelineSortOrder(timelineSortOrder === "desc" ? "asc" : "desc")}
                      className="bg-gray-900 border border-gray-800 text-gray-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <ArrowUpDown className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{timelineSortOrder === "desc" ? "الأحدث أولاً" : "الأقدم أولاً"}</span>
                    </button>
                  </div>

                  {!selectedOrder.timelineEvents || selectedOrder.timelineEvents.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-[#2a2d42] rounded-2xl bg-[#141624]">
                      <Clock className="w-10 h-10 text-cyan-500/50 mx-auto mb-2" />
                      <p className="text-xs font-bold text-gray-400">لا توجد مراحل مسجلة بالخط الزمني لهذا الطلب بعد</p>
                    </div>
                  ) : (
                    <div className="relative border-r-2 border-cyan-500/30 pr-6 space-y-6 mr-3 my-4">
                      {[...selectedOrder.timelineEvents]
                        .sort((a, b) => {
                          const dateA = new Date(a.createdAt).getTime();
                          const dateB = new Date(b.createdAt).getTime();
                          return timelineSortOrder === "desc" ? dateB - dateA : dateA - dateB;
                        })
                        .map((evt) => {
                          const meta = EVENT_TYPE_LABELS[evt.eventType] || { label: evt.eventType || "حدث صيانة", badgeClass: "bg-gray-800 text-gray-300 border-gray-700" };
                          return (
                            <div key={evt.id} className="relative group">
                              {/* Dot */}
                              <div className="absolute -right-[31px] top-1.5 w-4 h-4 rounded-full bg-cyan-500 border-4 border-[#11131e] shadow-md shadow-cyan-500/50"></div>

                              <div className="bg-[#16192a] border border-[#2a2d42] p-4 rounded-xl space-y-2 hover:border-cyan-500/40 transition">
                                <div className="flex flex-wrap justify-between items-center gap-2">
                                  <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold border ${meta.badgeClass || (meta as any).class || 'bg-gray-800 text-gray-300'}`}>
                                    {meta.label}
                                  </span>
                                  <span className="text-[11px] text-gray-400 font-mono">
                                    {new Date(evt.createdAt).toLocaleString("ar-EG")}
                                  </span>
                                </div>

                                <p className="text-xs font-bold text-white leading-relaxed">{evt.description}</p>

                                {evt.notes && (
                                  <p className="text-[11px] text-gray-300 bg-gray-950/80 p-2 rounded-lg border border-gray-800">
                                    {evt.notes}
                                  </p>
                                )}

                                <div className="text-[10px] text-cyan-400/80 font-semibold flex items-center gap-1 pt-1 border-t border-[#2a2d42]/60">
                                  <User className="w-3 h-3 text-cyan-400" />
                                  <span>القائم بالإجراء: {evt.createdByName || "أحمد البنا"}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}

              {/* ==================== WORKSPACE TAB 3: TECHNICAL AUDIT LOG ==================== */}
              {workspaceTab === "audit" && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[#2a2d42] pb-3">
                    <div>
                      <h4 className="text-sm font-bold text-purple-300 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-purple-400" />
                        سجل التعديلات الفنية (Audit Log)
                      </h4>
                      <p className="text-[10px] text-gray-400 mt-0.5">سجل التغييرات الكامل على قطع الغيار، الأسعار، التشخيص، والحالات</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 font-bold">تصفية:</span>
                      <select
                        value={auditFilter}
                        onChange={e => setAuditFilter(e.target.value)}
                        className="bg-gray-950 border border-[#2a2d42] text-xs text-white rounded-lg px-2.5 py-1 font-bold focus:outline-none"
                      >
                        <option value="all">جميع التعديلات</option>
                        <option value="CHANGE_STATUS">حالة الطلب</option>
                        <option value="CHANGE_DIAGNOSIS">التشخيص الفني</option>
                        <option value="ADD_PROCEDURE">الإجراءات الفنية</option>
                        <option value="ADD_PART">قطع الغيار</option>
                        <option value="CHANGE_SELL_PRICE">الأسعار</option>
                      </select>
                    </div>
                  </div>

                  <div className="bg-purple-950/30 border border-purple-500/30 p-3 rounded-xl flex items-center gap-2 text-xs text-purple-200">
                    <Lock className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>🔒 هذا السجل محمي وغير قابل للتعديل أو الحذف لضمان معايير الشفافية والأمان المحاسبي.</span>
                  </div>

                  {!selectedOrder.auditLogs || selectedOrder.auditLogs.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-[#2a2d42] rounded-2xl bg-[#141624]">
                      <Activity className="w-10 h-10 text-purple-500/50 mx-auto mb-2" />
                      <p className="text-xs font-bold text-gray-400">لا توجد سجلات تعديل فني لهذا الطلب حتى الآن</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-xs">
                        <thead>
                          <tr className="bg-[#16192a] text-gray-400 border-b border-[#2a2d42]">
                            <th className="p-2.5 font-bold">القائم بالتعديل</th>
                            <th className="p-2.5 font-bold">التوقيت</th>
                            <th className="p-2.5 font-bold">نوع التعديل</th>
                            <th className="p-2.5 font-bold">الحقل</th>
                            <th className="p-2.5 font-bold">التغيير (من ➔ إلى)</th>
                            <th className="p-2.5 font-bold">ملاحظات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#2a2d42]/60 text-gray-200">
                          {selectedOrder.auditLogs
                            .filter(log => auditFilter === "all" || log.actionType === auditFilter)
                            .map((log) => {
                              const meta = AUDIT_ACTION_LABELS[log.actionType] || { label: log.actionType || "تعديل", badgeClass: "bg-gray-800 text-gray-300" };
                              return (
                                <tr key={log.id} className="hover:bg-[#16192a]/80 transition">
                                  <td className="p-2.5 font-bold text-purple-300 whitespace-nowrap">
                                    {log.userName || "أحمد البنا"}
                                  </td>
                                  <td className="p-2.5 font-mono text-[11px] text-gray-400 whitespace-nowrap">
                                    {new Date(log.timestamp).toLocaleString("ar-EG")}
                                  </td>
                                  <td className="p-2.5 whitespace-nowrap">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${meta.badgeClass || (meta as any).class || 'bg-gray-800 text-gray-300'}`}>
                                      {meta.label}
                                    </span>
                                  </td>
                                  <td className="p-2.5 font-bold text-white whitespace-nowrap">
                                    {log.fieldName || "-"}
                                  </td>
                                  <td className="p-2.5 text-[11px] leading-relaxed">
                                    <span className="text-rose-400 line-through">{log.oldValue || "لا يوجد"}</span>
                                    <span className="text-gray-400 mx-1">➔</span>
                                    <span className="text-emerald-400 font-bold">{log.newValue || "لا يوجد"}</span>
                                  </td>
                                  <td className="p-2.5 text-[11px] text-gray-400">
                                    {log.notes || "-"}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Order Financial & Printing actions Footer */}
              <div className="border-t border-[#2a2d42] pt-4 flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-950/40 p-4 rounded-xl border border-dashed border-[#2a2d42]">
                <div className="text-right">
                  <p className="text-xs text-gray-400 font-medium">الحسابات الإجمالية للطلب:</p>
                  <h4 className="text-lg font-bold text-white mt-1">
                    السعر النهائي المعتمد للعميل: <span className="text-emerald-400 font-extrabold">{selectedOrder.finalRepairPrice ?? selectedOrder.totalEstimatedCost} ج.م</span>
                  </h4>
                  <p className="text-[10px] text-gray-400 mt-1">
                    المدفوع مقدماً: {selectedOrder.advancePayment} ج.م | المتبقي عند الاستلام:{" "}
                    <span className="font-bold text-red-400">{Math.max(0, (selectedOrder.finalRepairPrice ?? selectedOrder.totalEstimatedCost) - selectedOrder.advancePayment)} ج.م</span>
                  </p>
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setReceiptOrder(selectedOrder);
                      setIsReceiptOpen(true);
                    }}
                    className="flex-1 md:flex-initial bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <FileText className="w-4 h-4" />
                    معاينة وطباعة الفاتورة
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#11131e] border border-[#2a2d42] rounded-2xl p-16 text-center text-gray-500 h-full flex flex-col justify-center items-center">
              <Wrench className="w-12 h-12 text-[#2a2d42] mb-3" />
              <h4 className="text-white font-bold mb-1.5">لوحة تشخيص المهندس</h4>
              <p className="text-xs text-gray-400 max-w-sm">الرجاء اختيار أحد طلبات الصيانة من القائمة الجانبية لبدء الفحص، والصرف المالي، وتعديل حالة الإصلاح</p>
            </div>
          )}
        </div>
      </div>

      {/* Custom Technical Procedure Addition Modal */}
      {newProcedureModalDevIdx !== null && selectedOrder && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#11131e] border border-purple-500/40 rounded-2xl max-w-md w-full p-5 space-y-4 text-right">
            <div className="flex justify-between items-center border-b border-[#2a2d42] pb-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Wrench className="w-4 h-4 text-purple-400" />
                إضافة إجراء فني / إصلاح للجهاز
              </h4>
              <button
                type="button"
                onClick={() => setNewProcedureModalDevIdx(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">اسم الإجراء الفني / عملية الإصلاح:</label>
                <input
                  type="text"
                  placeholder="مثال: تغيير HDMI، تغيير أنالوج، تنظيف ومعجون..."
                  value={newProcedureName}
                  onChange={e => setNewProcedureName(e.target.value)}
                  className="w-full bg-[#181a29] border border-[#2a2d42] text-white rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">التكلفة (ج.م):</label>
                  <input
                    type="number"
                    min="0"
                    value={newProcedureCost}
                    onChange={e => setNewProcedureCost(Number(e.target.value))}
                    className="w-full bg-[#181a29] border border-[#2a2d42] text-white rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">سعر الإصلاح للعميل (ج.م):</label>
                  <input
                    type="number"
                    min="0"
                    value={newProcedurePrice}
                    onChange={e => setNewProcedurePrice(Number(e.target.value))}
                    className="w-full bg-[#181a29] border border-[#2a2d42] text-white rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-[#2a2d42]">
              <button
                type="button"
                onClick={() => handleAddCustomProcedure(newProcedureModalDevIdx)}
                className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 px-4 rounded-xl text-xs transition cursor-pointer"
              >
                إضافة الإجراء وتحديث الحسابات
              </button>
              <button
                type="button"
                onClick={() => setNewProcedureModalDevIdx(null)}
                className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-2 px-4 rounded-xl text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {receiptOrder && (
        <PrintReceiptModal
          isOpen={isReceiptOpen}
          onClose={() => setIsReceiptOpen(false)}
          order={receiptOrder}
          settings={settings}
        />
      )}

      {selectedOrder && (
        <DeliverDeviceModal
          isOpen={isDeliverModalOpen}
          onClose={() => setIsDeliverModalOpen(false)}
          order={selectedOrder}
          currentUser={currentUserForAction}
          invoices={invoices}
          onOpenReceiptPrint={(ord) => {
            setReceiptOrder(ord);
            setIsReceiptOpen(true);
          }}
          onConfirmDelivery={async (deliverData) => {
            const res = await deliverRepairOrder({
              orderId: selectedOrder.id,
              paymentNow: deliverData.paymentNow,
              paymentMethod: deliverData.paymentMethod,
              deliveryNotes: deliverData.deliveryNotes,
              currentUser: currentUserForAction
            });
            if (res.success && res.order) {
              setSelectedOrder(res.order);
            }
            return res;
          }}
        />
      )}

      {selectedOrder && (
        <ReopenOrderModal
          isOpen={isReopenModalOpen}
          onClose={() => setIsReopenModalOpen(false)}
          order={selectedOrder}
          currentUser={currentUserForAction}
          onConfirmReopen={async (reason) => {
            const res = await reopenRepairOrder(selectedOrder.id, currentUserForAction, reason);
            if (res.success && res.order) {
              setSelectedOrder(res.order);
            }
            return res;
          }}
        />
      )}

      {selectedOrder && (
        <CancelWarrantyModal
          isOpen={isCancelWarrantyModalOpen}
          onClose={() => setIsCancelWarrantyModalOpen(false)}
          order={selectedOrder}
          currentUser={currentUserForAction}
          onConfirmCancel={handleConfirmCancelWarranty}
        />
      )}

      {/* MODAL: Add Part From Inventory with Quantity & Purchase Cost Preview */}
      {addPartModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 dir-rtl text-right">
          <div className="bg-[#11131e] border border-[#2a2d42] rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#2a2d42] pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30">
                  <Package className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-black text-white">إضافة قطعة من المخزن للجهاز</h4>
              </div>
              <button
                type="button"
                onClick={() => setAddPartModalOpen(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Product Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-300 block">اختر قطعة الغيار من المخزن *</label>
              <select
                value={addPartProductId}
                onChange={(e) => {
                  setAddPartProductId(e.target.value);
                  setAddPartQty(1);
                }}
                className="w-full bg-[#181b2a] border border-[#2a2d42] text-white text-xs p-2.5 rounded-xl outline-none focus:border-rose-500"
              >
                <option value="">-- اختر قطعة --</option>
                {products.filter(p => !p.isArchived).map((p) => {
                  const currentDevice = selectedOrder?.devices?.[addPartDevIdx];
                  const isComp = currentDevice ? isProductCompatibleWithDevice(p, currentDevice.type, currentDevice.model) : true;
                  const price = Number(p.sellPrice || (p as any).price || p.purchasePrice || 0);
                  return (
                    <option key={p.id} value={p.id} disabled={p.quantity <= 0}>
                      {p.nameAr || p.name} {isComp ? '✓' : '(غير محدد)'} - (المتاح: {p.quantity} | سعر البيع: {price} ج.م)
                    </option>
                  );
                })}
              </select>
            </div>

            {(() => {
              const selectedProd = products.find(p => p.id === addPartProductId);
              const unitSellingPrice = selectedProd ? Number(selectedProd.sellPrice || (selectedProd as any).price || selectedProd.purchasePrice || 0) : 0;
              const maxQty = selectedProd ? selectedProd.quantity : 1;
              const lineTotalSelling = addPartQty * unitSellingPrice;

              return (
                <>
                  {/* Stock & Selling Price Info */}
                  {selectedProd && (
                    <div className="bg-[#181b2a] p-3 rounded-xl border border-[#2a2d42] space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">الكمية المتاحة بالمخزن:</span>
                        <span className={`font-bold font-mono ${selectedProd.quantity > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {selectedProd.quantity} قطعة
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">سعر البيع للقطعة:</span>
                        <span className="font-bold font-mono text-amber-300">{unitSellingPrice.toLocaleString('ar-EG')} ج.م</span>
                      </div>
                    </div>
                  )}

                  {/* Quantity Selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-300 block">الكمية المطلوبة *</label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        disabled={addPartQty <= 1}
                        onClick={() => setAddPartQty(prev => Math.max(1, prev - 1))}
                        className="w-10 h-10 bg-[#181b2a] border border-[#2a2d42] hover:bg-[#25293e] text-white font-black rounded-xl flex items-center justify-center cursor-pointer transition disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        max={maxQty}
                        value={addPartQty}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 1;
                          setAddPartQty(Math.min(maxQty, Math.max(1, val)));
                        }}
                        className="flex-1 bg-[#181b2a] border border-[#2a2d42] text-center text-white text-base font-mono font-black p-2 rounded-xl outline-none focus:border-rose-500"
                      />
                      <button
                        type="button"
                        disabled={!selectedProd || addPartQty >= maxQty}
                        onClick={() => setAddPartQty(prev => Math.min(maxQty, prev + 1))}
                        className="w-10 h-10 bg-[#181b2a] border border-[#2a2d42] hover:bg-[#25293e] text-white font-black rounded-xl flex items-center justify-center cursor-pointer transition disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Calculated Total Selling Price */}
                  <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl flex justify-between items-center text-xs">
                    <span className="font-bold text-rose-300">إجمالي سعر بيع القطع:</span>
                    <span className="font-extrabold font-mono text-emerald-400 text-sm">
                      {lineTotalSelling.toLocaleString('ar-EG')} ج.م
                    </span>
                  </div>

                  {/* Confirm / Cancel Buttons */}
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      disabled={!selectedProd || selectedProd.quantity < addPartQty || addPartQty <= 0}
                      onClick={async () => {
                        await handleAddPartToDevice(addPartDevIdx, addPartProductId, addPartQty);
                        setAddPartModalOpen(false);
                      }}
                      className="flex-1 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold py-2.5 rounded-xl transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      تأكيد إضافة القطعة
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddPartModalOpen(false)}
                      className="px-4 bg-[#1a1d2d] hover:bg-[#25293e] text-gray-300 text-xs font-bold py-2.5 rounded-xl transition cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
