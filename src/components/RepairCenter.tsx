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
  X
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
  const { orders, updateRepairOrder, deleteRepairOrder, deliverRepairOrder, reopenRepairOrder } = useRepairOrders();
  const { customers, updateCustomer } = useCustomers();
  const { products, updateProduct } = useProducts();
  const { settings } = useSettings();
  const { invoices, addInvoice } = useInvoices();
  const { partUsages, addPartUsage } = useRepairPartUsages();

  console.log("=== Repair Center: Component rendered ===");
  console.log("=== Repair Center: Orders count ===", orders.length);

  useEffect(() => {
    const handleDbChanged = (e: any) => {
      console.log("=== Repair Center: Event received ===", e?.detail);
    };
    window.addEventListener("atari_db_changed", handleDbChanged);
    return () => window.removeEventListener("atari_db_changed", handleDbChanged);
  }, []);

  useEffect(() => {
    console.log("=== Repair Center: Orders after refetch ===", orders.length);
    if (orders.length > 0) {
      const latest = orders[0];
      console.log("Latest created Repair Order ID:", latest.id);
      console.log("Latest status:", latest.status);
      console.log("Latest branch_id:", (latest as any).branch_id || (latest as any).branchId || "N/A");
      console.log("Latest customer_id:", latest.customerId || "N/A");
      console.log("Latest guest_name:", latest.guestCustomerName || latest.guest_name || latest.customerNameSnapshot || "N/A");
      console.log("Latest guest_phone:", latest.guestCustomerPhone || latest.guest_phone || latest.customerPhoneSnapshot || "N/A");
      console.log("Latest created_at:", latest.receivedDate || "N/A");
    }
  }, [orders]);

  const [activeTab, setActiveTab] = useState<string>(initialStatusFilter || "active_all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<RepairOrder | null>(
    initialOrderId ? orders.find(o => o.id === initialOrderId) || null : null
  );

  // Sync selectedOrder whenever orders array updates if content actually changed
  useEffect(() => {
    setSelectedOrder(prev => {
      if (!prev) return null;
      const fresh = orders.find(o => o.id === prev.id);
      if (!fresh) return prev;
      if (JSON.stringify(fresh) === JSON.stringify(prev)) return prev;
      return fresh;
    });
  }, [orders]);

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

    // Check admin / owner permission
    const isOwnerOrAdmin = currentLoggedUser?.role === "admin" || currentLoggedUser?.roleId === "OWNER" || currentLoggedUser?.role === "OWNER" || currentLoggedUser?.email === "elbannafc@gmail.com" || currentLoggedUser?.permissions?.includes("all");
    if (!isOwnerOrAdmin) {
      await dialog.alert({ message: "عذراً، خيار حذف أوامر الصيانة متاح حصرياً لمدير النظام (Admin/OWNER)!", variant: "error" });
      return;
    }

    const confirmed = await dialog.confirm({
      title: "حذف أمر صيانة",
      message: `هل أنت متأكد من حذف أمر الصيانة رقم [${orderId}] نهائياً من السجلات والبيانات؟`,
      variant: "danger",
      confirmText: "نعم، حذف"
    });

    if (confirmed) {
      deleteRepairOrder(orderId);
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(null);
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
    if (!selectedOrder) return;
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const qty = Math.max(1, Math.floor(qtyToAdd));
    if (product.quantity < qty) {
      dialog.alert({ message: "عفواً، هاته القطعة غير متوفرة بالمخزون حالياً!", variant: "error" });
      return;
    }

    const updatedDevices = [...selectedOrder.devices];
    const currentDevice = updatedDevices[deviceIdx];
    if (!currentDevice) return;

    const unitSellingPrice = Number(product.sellPrice || product.price || product.purchasePrice) || 0;
    const unitPurchaseCost = Number(product.purchasePrice || product.costPrice) || 0;
    const totalCost = unitPurchaseCost * qty;

    const ownership = selectedOrder.workOwnershipType || WorkOwnershipType.CUSTOMER_SHARED;
    let owner: 'SHOP' | 'AHMED' | 'ABDO' = 'SHOP';
    if (ownership === WorkOwnershipType.PARTNER_1_PRIVATE) owner = 'AHMED';
    else if (ownership === WorkOwnershipType.PARTNER_2_PRIVATE) owner = 'ABDO';

    try {
      // 1. Deduct Stock in local state
      const newQty = product.quantity - qty;
      updateProduct({
        ...product,
        quantity: newQty
      });

      // Background update to Supabase
      const productUuid = (await ensureProductUuidInSupabase(product)) || product.id;
      const repairOrderUuid = (await ensureRepairOrderUuidInSupabase(selectedOrder)) || selectedOrder.id;
      updateProductQuantityInSupabase(productUuid, newQty).catch(err => console.warn("Supabase qty update warn:", err));

      // 2. Create Inventory OUT Movement
      addInventoryMovementToSupabase({
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
        repairOrderId: selectedOrder.id,
        owner: owner,
        notes: `صرف قطعة غيار صيانة: ${product.nameAr || product.name} للجهاز (${getDeviceDisplayName(currentDevice)})`,
        createdAt: new Date().toISOString()
      }).catch(err => console.warn("Supabase movement warn:", err));

      // 3. Check if existing RepairPartUsage exists for this product and device
      const orderIdsToMatch = new Set<string>([
        String(selectedOrder.id || ''),
        String((selectedOrder as any).orderNumber || ''),
        String((selectedOrder as any).uuid || ''),
        String(repairOrderUuid || '')
      ].filter(Boolean));

      const allUsages = db.getRepairPartUsages();
      const existingUsage = allUsages.find(
        pu => orderIdsToMatch.has(String(pu.repairOrderId)) &&
              (pu.inventoryItemId === productUuid || pu.inventoryItemId === product.id) &&
              pu.accountingStatus !== 'RETURNED' &&
              pu.accountingStatus !== 'REVERSED' &&
              ((pu.notes && pu.notes.includes(`deviceId:${currentDevice.id || deviceIdx}`)) || selectedOrder.devices.length === 1)
      );

      let updatedUsageList = [...allUsages];

      if (existingUsage) {
        const newUsageQty = existingUsage.quantity + qty;
        const newUsageTotalCost = newUsageQty * unitPurchaseCost;
        const newUsageSellingTotal = newUsageQty * unitSellingPrice;
        const updatedUsageRecord = {
          ...existingUsage,
          quantity: newUsageQty,
          unitCost: unitPurchaseCost,
          totalCost: newUsageTotalCost,
          sellingPrice: unitSellingPrice,
          sellingTotal: newUsageSellingTotal
        };
        updatedUsageList = allUsages.map(pu => pu.id === existingUsage.id ? updatedUsageRecord : pu);
        db.saveRepairPartUsages(updatedUsageList);
        updateRepairPartUsageInSupabase(existingUsage.id, {
          quantity: newUsageQty,
          unitCost: unitPurchaseCost,
          totalCost: newUsageTotalCost,
          sellingPrice: unitSellingPrice,
          sellingTotal: newUsageSellingTotal
        }).catch(err => console.warn("Supabase update usage warn:", err));
      } else {
        const addedUsage = await addRepairPartUsageToSupabase({
          repairOrderId: repairOrderUuid,
          inventoryItemId: productUuid,
          partName: product.nameAr || product.name,
          sku: product.sku || product.id,
          quantity: qty,
          unitCost: unitPurchaseCost,
          totalCost: totalCost,
          sellingPrice: unitSellingPrice,
          sellingTotal: unitSellingPrice * qty,
          ownershipType: ownership,
          responsiblePartnerId: owner === 'AHMED' ? 'P-001' : owner === 'ABDO' ? 'P-002' : 'SHOP',
          accountingStatus: 'CONSUMED',
          notes: `deviceId:${currentDevice.id || deviceIdx}`
        });
        if (addedUsage) {
          const existsLocally = updatedUsageList.some(u => u.id === addedUsage.id);
          if (!existsLocally) {
            updatedUsageList.push(addedUsage);
          } else {
            updatedUsageList = updatedUsageList.map(u => u.id === addedUsage.id ? addedUsage : u);
          }
          db.saveRepairPartUsages(updatedUsageList);
        }
      }

      // 4. Recalculate device partsCost (using selling price)
      const activeUsagesForDevice = updatedUsageList.filter(
        pu => orderIdsToMatch.has(String(pu.repairOrderId)) &&
              pu.accountingStatus !== 'RETURNED' &&
              pu.accountingStatus !== 'REVERSED' &&
              ((pu.notes && pu.notes.includes(`deviceId:${currentDevice.id || deviceIdx}`)) || selectedOrder.devices.length === 1)
      );

      const newPartsCost = activeUsagesForDevice.reduce((sum, pu) => {
        const sellP = getUsageSellingUnitPrice(pu, products);
        return sum + (pu.quantity * sellP);
      }, 0);

      const tags = currentDevice.selectedQuickFaults || (currentDevice.issue ? currentDevice.issue.split(" - ").map(s => s.trim()) : []);
      const faultsCost = currentDevice.suggestedRepairPrice ?? calculateSuggestedPriceForFaults(tags);
      const newAutoPrice = faultsCost + newPartsCost;

      if (currentDevice.isPriceManuallyEdited) {
        updatedDevices[deviceIdx] = {
          ...currentDevice,
          partsCost: newPartsCost,
          priceOverrideAcknowledged: false
        };
      } else {
        updatedDevices[deviceIdx] = {
          ...currentDevice,
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

      setSelectedOrder(updatedOrder);
      updateRepairOrder(updatedOrder);
      updateRepairOrderInSupabase(updatedOrder).catch(err => console.warn("Supabase order update warn:", err));

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_repair_part_usages' } }));
        window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_inventory_movements' } }));
      }
    } catch (err: any) {
      console.error("❌ Exception adding part to repair order:", err);
    }
  };

  const handleRemovePartUsage = (usageId: string, deviceIdx: number, removeQty: number = 1) => {
    if (!selectedOrder) return;
    const allUsages = db.getRepairPartUsages();
    const usage = allUsages.find(pu => pu.id === usageId);
    if (!usage) return;

    const product = products.find(p => p.id === usage.inventoryItemId);

    const qtyToReturn = Math.min(usage.quantity, Math.max(1, removeQty));
    const isFullRemove = (usage.quantity <= qtyToReturn) || removeQty === -1; // -1 means remove all
    const actualReturnedQty = isFullRemove ? usage.quantity : qtyToReturn;

    // 1. Restore Product Stock
    if (product) {
      updateProduct({
        ...product,
        quantity: product.quantity + actualReturnedQty
      });
      updateProductQuantityInSupabase(product.id, product.quantity + actualReturnedQty).catch(err => console.warn("Supabase qty restore warn:", err));
    }

    // 2. Add Reversal Movement
    const ownership = selectedOrder.workOwnershipType || WorkOwnershipType.CUSTOMER_SHARED;
    let owner: 'SHOP' | 'AHMED' | 'ABDO' = 'SHOP';
    if (ownership === WorkOwnershipType.PARTNER_1_PRIVATE) owner = 'AHMED';
    else if (ownership === WorkOwnershipType.PARTNER_2_PRIVATE) owner = 'ABDO';

    addInventoryMovementToSupabase({
      id: `MOV-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      productId: usage.inventoryItemId,
      productNameSnapshot: usage.partName,
      movementType: 'IN',
      usageType: 'REPAIR_USAGE_RETURN',
      quantityChange: actualReturnedQty,
      previousQuantity: product ? product.quantity : 0,
      newQuantity: product ? product.quantity + actualReturnedQty : actualReturnedQty,
      costPriceSnapshot: usage.unitCost,
      sellingPriceSnapshot: 0,
      totalCost: usage.unitCost * actualReturnedQty,
      referenceId: selectedOrder.id,
      repairOrderId: selectedOrder.id,
      owner: owner,
      notes: `إرجاع قطعة غيار صيانة للمخزن: ${usage.partName}`,
      createdAt: new Date().toISOString()
    }).catch(err => console.warn("Supabase movement warn:", err));

    // 3. Update or Mark Usage as RETURNED
    let updatedUsages: RepairPartUsage[] = [];
    if (isFullRemove) {
      updateRepairPartUsageInSupabase(usageId, { accountingStatus: 'RETURNED' }).catch(err => console.warn(err));
      updatedUsages = allUsages.map(pu => {
        if (pu.id === usageId) {
          return { ...pu, accountingStatus: 'RETURNED' as const };
        }
        return pu;
      });
    } else {
      const newQty = usage.quantity - actualReturnedQty;
      const newTotalCost = newQty * usage.unitCost;
      const usageSellPrice = getUsageSellingUnitPrice(usage, products);
      const newSellingTotal = newQty * usageSellPrice;
      updateRepairPartUsageInSupabase(usageId, {
        quantity: newQty,
        totalCost: newTotalCost,
        sellingPrice: usageSellPrice,
        sellingTotal: newSellingTotal
      }).catch(err => console.warn(err));
      updatedUsages = allUsages.map(pu => {
        if (pu.id === usageId) {
          return {
            ...pu,
            quantity: newQty,
            totalCost: newTotalCost,
            sellingPrice: usageSellPrice,
            sellingTotal: newSellingTotal
          };
        }
        return pu;
      });
    }
    db.saveRepairPartUsages(updatedUsages);

    // 4. Recalculate device partsCost (using selling price)
    const orderIdsToMatch = new Set<string>([
      String(selectedOrder.id || ''),
      String((selectedOrder as any).orderNumber || ''),
      String((selectedOrder as any).uuid || ''),
      String(usage.repairOrderId || '')
    ].filter(Boolean));

    const updatedDevices = [...selectedOrder.devices];
    const currentDevice = updatedDevices[deviceIdx];
    if (currentDevice) {
      const remainingUsages = updatedUsages.filter(
        pu => orderIdsToMatch.has(String(pu.repairOrderId)) && pu.accountingStatus !== 'RETURNED' && pu.accountingStatus !== 'REVERSED'
      );
      const deviceRemainingUsages = remainingUsages.filter(
        pu => (pu.notes && pu.notes.includes(`deviceId:${currentDevice.id || deviceIdx}`)) || selectedOrder.devices.length === 1
      );

      const newPartsCost = deviceRemainingUsages.reduce((sum, pu) => {
        const sellP = getUsageSellingUnitPrice(pu, products);
        return sum + (pu.quantity * sellP);
      }, 0);

      const tags = currentDevice.selectedQuickFaults || (currentDevice.issue ? currentDevice.issue.split(" - ").map(s => s.trim()) : []);
      const faultsCost = currentDevice.suggestedRepairPrice ?? calculateSuggestedPriceForFaults(tags);
      const newAutoPrice = faultsCost + newPartsCost;

      if (currentDevice.isPriceManuallyEdited) {
        updatedDevices[deviceIdx] = {
          ...currentDevice,
          partsCost: newPartsCost,
          priceOverrideAcknowledged: false
        };
      } else {
        updatedDevices[deviceIdx] = {
          ...currentDevice,
          partsCost: newPartsCost,
          finalRepairPrice: newAutoPrice,
          estimatedCost: newAutoPrice
        };
      }

      const totalFinal = updatedDevices.reduce((sum, d) => sum + (d.finalRepairPrice ?? d.estimatedCost ?? 0), 0);

      const updatedOrder: RepairOrder = {
        ...selectedOrder,
        devices: updatedDevices,
        totalEstimatedCost: totalFinal,
        finalRepairPrice: totalFinal
      };

      setSelectedOrder(updatedOrder);
      updateRepairOrder(updatedOrder);
      updateRepairOrderInSupabase(updatedOrder).catch(err => console.warn(err));
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_repair_part_usages' } }));
      window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_inventory_movements' } }));
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

    // Order Completion Validation for Parts Cost
    if (isReady || isDelivered) {
      const totalOrderPartsCost = selectedOrder.devices.reduce((sum, d) => sum + (Number(d.partsCost) || 0), 0);
      if (totalOrderPartsCost > 0) {
        const linkedUsages = partUsages.filter(
          pu => pu.repairOrderId === selectedOrder.id && pu.accountingStatus !== 'RETURNED' && pu.accountingStatus !== 'REVERSED'
        );
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
    const updatedDevices = selectedOrder.devices.map(dev => {
      if (status === RepairStatus.Delivered || status === RepairStatus.Cancelled || status === RepairStatus.Ready) {
        return { ...dev, status };
      }
      return dev;
    });

    let updatedOrder: RepairOrder = {
      ...selectedOrder,
      status,
      devices: updatedDevices,
      isPaid: isDelivered ? true : selectedOrder.isPaid,
      completionDate: isReady || isDelivered ? new Date().toISOString() : selectedOrder.completionDate
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
                  {(currentLoggedUser?.role === "admin" || currentLoggedUser?.permissions?.includes("all")) && (
                    <button
                      type="button"
                      onClick={() => handleDeleteOrder(selectedOrder.id)}
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs py-2 px-3 rounded-xl border border-red-500/20 flex items-center gap-1.5 font-bold cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      حذف الأمر
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

                // Order matching set for RepairPartUsage
                const orderIdsToMatch = new Set<string>([
                  String(selectedOrder.id || ''),
                  String((selectedOrder as any).orderNumber || ''),
                  String((selectedOrder as any).uuid || '')
                ].filter(Boolean));

                // Linked part usages for current device
                const deviceLinkedUsages = partUsages.filter(
                  pu => orderIdsToMatch.has(String(pu.repairOrderId)) &&
                        pu.accountingStatus !== 'RETURNED' &&
                        pu.accountingStatus !== 'REVERSED' &&
                        ((pu.notes && pu.notes.includes(`deviceId:${currentDevice.id || devIdx}`)) || selectedOrder.devices.length === 1)
                );

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
                  <div className="space-y-5">
                    {/* -----------------------------------------
                        HEADER
                       ----------------------------------------- */}
                    <div className="bg-[#11131e] border border-[#2a2d42] p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-xl">
                      <div className="flex items-center gap-3">
                        <div className="px-3.5 py-2 bg-indigo-600/20 border border-indigo-500/40 rounded-xl text-indigo-400 font-black text-lg font-mono">
                          #{selectedOrder.orderNumber || selectedOrder.id.slice(0, 8)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-black text-white flex items-center gap-1.5">
                              <Gamepad2 className="w-5 h-5 text-indigo-400" />
                              <span>{currentDevice.type || "جهاز بلايستيشن"}</span>
                              {currentDevice.model && <span className="text-indigo-300 font-extrabold">- {currentDevice.model}</span>}
                            </h3>
                            {currentDevice.serialNumber && (
                              <span className="text-[11px] font-mono text-gray-400 bg-gray-900/90 px-2 py-0.5 rounded border border-gray-800">
                                S/N: {currentDevice.serialNumber}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-1 flex items-center gap-2">
                            <span>العميل: <strong className="text-white font-bold">{getCustomerNameHelper(selectedOrder, customers)}</strong></span>
                            <span className="text-gray-600">•</span>
                            <span className="font-mono text-cyan-400 font-bold">{getCustomerPhoneHelper(selectedOrder, customers)}</span>
                          </p>
                        </div>
                      </div>

                      {/* Current Status Dropdown */}
                      <div className="flex items-center gap-2 bg-[#181b2a] p-1.5 rounded-xl border border-indigo-500/30">
                        <span className="text-xs text-gray-400 font-bold px-2">الحالة الحالية:</span>
                        <select
                          value={selectedOrder.status}
                          onChange={(e) => handleUpdateOrderStatus(e.target.value as RepairStatus)}
                          className="bg-indigo-950/80 border border-indigo-500/50 text-white font-extrabold text-xs rounded-lg px-3 py-1.5 focus:outline-none cursor-pointer"
                        >
                          <option value={RepairStatus.Received}>📥 تم الاستلام</option>
                          <option value={RepairStatus.Diagnosing}>🔍 قيد التشخيص</option>
                          <option value={RepairStatus.Repairing}>🔧 قيد الإصلاح</option>
                          <option value={RepairStatus.WaitingParts}>⏳ بانتظار قطع الغيار</option>
                          <option value={RepairStatus.Ready}>✅ جاهز للتسليم</option>
                          <option value={RepairStatus.Delivered}>🎉 تم التسليم</option>
                          <option value={RepairStatus.Cancelled}>❌ ملغى</option>
                        </select>
                      </div>
                    </div>

                    {/* -----------------------------------------
                        PROBLEM & DIAGNOSIS
                       ----------------------------------------- */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Customer Complaint */}
                      <div className="bg-[#11131e] border border-[#2a2d42] p-4 rounded-2xl space-y-3">
                        <h4 className="text-xs font-extrabold text-amber-400 flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                          <span>شكوى العميل والأعطال (Customer Complaint)</span>
                        </h4>

                        {/* Quick Fault Chips */}
                        <div className="flex flex-wrap gap-1.5">
                          {QUICK_FAULTS_LIST.map((fault) => {
                            const isSelected = reportedFaults.includes(fault.label);
                            return (
                              <button
                                key={fault.id}
                                type="button"
                                onClick={() => handleToggleQuickFaultInRepairCenter(devIdx, fault.label)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer flex items-center gap-1 ${
                                  isSelected
                                    ? "bg-amber-600 text-white border-amber-400 shadow-md shadow-amber-950/50"
                                    : "bg-gray-900/90 text-gray-300 border-gray-800 hover:border-gray-700 hover:text-white"
                                }`}
                              >
                                <span className="text-[10px]">{isSelected ? "✓" : "+"}</span>
                                <span>{fault.label}</span>
                              </button>
                            );
                          })}
                        </div>

                        <input
                          type="text"
                          placeholder="تفاصيل العطل أو ملاحظات الاستلام..."
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
                          className="w-full bg-[#181b2a] border border-[#2a2d42] rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      {/* Diagnosis & Notes */}
                      <div className="bg-[#11131e] border border-[#2a2d42] p-4 rounded-2xl space-y-3">
                        <h4 className="text-xs font-extrabold text-cyan-400 flex items-center gap-1.5">
                          <Wrench className="w-4 h-4 text-cyan-400" />
                          <span>التشخيص الفني والملاحظات (Diagnosis)</span>
                        </h4>

                        <textarea
                          rows={3}
                          placeholder="أدخل نتائج الفحص، التشخيص الفني، الملاحظات..."
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
                          className="w-full bg-[#181b2a] border border-[#2a2d42] rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 resize-none"
                        />
                      </div>
                    </div>

                    {/* -----------------------------------------
                        USED PARTS (POS INSTANT SEARCH & TABLE)
                       ----------------------------------------- */}
                    <div className="bg-[#11131e] border border-rose-500/30 p-5 rounded-2xl space-y-4 shadow-xl">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-extrabold text-rose-300 flex items-center gap-2">
                          <Package className="w-4.5 h-4.5 text-rose-400" />
                          <span>قطع الغيار المستخدمة (Used Parts)</span>
                        </h4>
                        <span className="text-xs text-rose-300/80 font-semibold bg-rose-950/60 border border-rose-500/30 px-3 py-1 rounded-full">
                          قطع متوافقة مع {currentDevice.type} {currentDevice.model}
                        </span>
                      </div>

                      {/* Instant Search Input Box */}
                      <div className="relative">
                        <Search className="w-5 h-5 text-gray-400 absolute right-4 top-3.5" />
                        <input
                          type="text"
                          placeholder="🔍 Search inventory... (اسم القطعة، SKU، الباركود)"
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
                          className="w-full bg-[#181b2a] border-2 border-rose-500/40 rounded-2xl pr-11 pl-4 py-3 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-rose-500 font-medium shadow-inner"
                        />
                        {partSearch && (
                          <button
                            type="button"
                            onClick={() => setPartSearch('')}
                            className="absolute left-3 top-3 text-gray-400 hover:text-white bg-gray-800 rounded-full w-6 h-6 flex items-center justify-center text-xs cursor-pointer"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      {/* Matching Results Chips when typing */}
                      {partSearch.trim() !== '' && (
                        <div className="bg-[#181b2a] border-2 border-rose-500/50 p-3 rounded-2xl max-h-[220px] overflow-y-auto custom-scrollbar space-y-2">
                          <div className="flex justify-between items-center px-1">
                            <span className="text-[11px] text-gray-300 font-bold">نتائج البحث الفوري ({matchedSearchResults.length}):</span>
                            <span className="text-[10px] text-gray-400">اضغط Enter لإضافة النتيجة الأولى</span>
                          </div>
                          {matchedSearchResults.length === 0 ? (
                            <p className="text-xs text-rose-400 italic py-3 text-center">لا توجد قطع غيار مطابقة للبحث.</p>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                              {matchedSearchResults.map((p) => {
                                const price = Number(p.sellPrice || (p as any).price || p.purchasePrice || 0);
                                const isOutOfStock = p.quantity <= 0;
                                return (
                                  <button
                                    key={p.id}
                                    type="button"
                                    disabled={isOutOfStock}
                                    onClick={() => {
                                      handleAddPartToDevice(devIdx, p.id, 1);
                                      setPartSearch('');
                                    }}
                                    className={`p-2.5 rounded-xl text-xs font-bold border text-right transition flex items-center justify-between gap-2 cursor-pointer ${
                                      isOutOfStock
                                        ? "bg-gray-900 text-gray-600 border-gray-800 cursor-not-allowed opacity-50"
                                        : "bg-[#11131e] text-white border-rose-500/30 hover:border-rose-500 hover:bg-rose-950/50"
                                    }`}
                                  >
                                    <div className="truncate">
                                      <p className="font-bold text-white truncate">{p.nameAr || p.name}</p>
                                      <p className="text-[10px] text-gray-400 font-mono">المتاح: {p.quantity} قطعة</p>
                                    </div>
                                    <span className="font-mono font-extrabold text-emerald-400 bg-emerald-950/70 px-2.5 py-1 rounded-lg border border-emerald-500/30 shrink-0">
                                      {price.toLocaleString('ar-EG')}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Parts Table */}
                      <div className="overflow-x-auto rounded-xl border border-rose-500/30 bg-gray-950">
                        <table className="w-full text-xs text-right text-gray-200 border-collapse">
                          <thead className="bg-[#181b2a] text-gray-400 font-bold border-b border-[#2a2d42]">
                            <tr>
                              <th className="p-3">Product</th>
                              <th className="p-3 text-center">Price</th>
                              <th className="p-3 text-center">Quantity</th>
                              <th className="p-3 text-left font-bold text-emerald-400">Total</th>
                              <th className="p-3 text-center">Delete</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#1f2937]">
                            {deviceLinkedUsages.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="p-8 text-center text-gray-500 text-xs font-bold">
                                  لم يتم إضافة قطع غيار لهذا الجهاز بعد. ابحث في المربع أعلاه واضغط لإضافة القطعة مباشرة.
                                </td>
                              </tr>
                            ) : (
                              deviceLinkedUsages.map((pu) => {
                                const unitSellPrice = getUsageSellingUnitPrice(pu, products);
                                const lineTotal = pu.quantity * unitSellPrice;
                                const matchedProd = products.find(p => p.id === pu.inventoryItemId);
                                const stockAvail = matchedProd ? matchedProd.quantity : 0;

                                return (
                                  <tr key={pu.id} className="hover:bg-[#161927] transition-colors">
                                    {/* Product Name */}
                                    <td className="p-3 font-extrabold text-white">
                                      <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
                                        <span>{pu.partName}</span>
                                      </div>
                                    </td>

                                    {/* Selling Price */}
                                    <td className="p-3 text-center font-mono font-extrabold text-amber-300">
                                      {unitSellPrice.toLocaleString('ar-EG')}
                                    </td>

                                    {/* Quantity Controls */}
                                    <td className="p-3 text-center">
                                      <div className="inline-flex items-center gap-2 bg-[#181b2a] px-2.5 py-1 rounded-xl border border-gray-700">
                                        <button
                                          type="button"
                                          onClick={() => handleRemovePartUsage(pu.id, devIdx, 1)}
                                          className="w-6 h-6 flex items-center justify-center bg-rose-950 hover:bg-rose-800 text-rose-200 rounded-lg font-extrabold text-sm transition cursor-pointer"
                                          title="خصم قطعة واحدة (-)"
                                        >
                                          -
                                        </button>

                                        <span className="font-mono text-cyan-300 text-sm font-extrabold px-1.5 min-w-[24px]">
                                          {pu.quantity}
                                        </span>

                                        <button
                                          type="button"
                                          disabled={stockAvail <= 0}
                                          onClick={() => handleAddPartToDevice(devIdx, pu.inventoryItemId, 1)}
                                          className="w-6 h-6 flex items-center justify-center bg-emerald-950 hover:bg-emerald-800 text-emerald-200 rounded-lg font-extrabold text-sm transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                          title={stockAvail <= 0 ? "المخزون نفذ" : "إضافة قطعة أخرى (+)"}
                                        >
                                          +
                                        </button>
                                      </div>
                                    </td>

                                    {/* Line Total */}
                                    <td className="p-3 text-left font-mono font-extrabold text-emerald-400 text-sm">
                                      {lineTotal.toLocaleString('ar-EG')}
                                    </td>

                                    {/* Delete Button */}
                                    <td className="p-3 text-center">
                                      <button
                                        type="button"
                                        onClick={() => handleRemovePartUsage(pu.id, devIdx, -1)}
                                        className="p-2 bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white rounded-xl transition cursor-pointer"
                                        title="حذف القطعة وإرجاع المخزون"
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

                    {/* -----------------------------------------
                        BOTTOM SUMMARY
                       ----------------------------------------- */}
                    <div className="bg-[#11131e] border border-indigo-500/30 p-6 rounded-2xl shadow-xl space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                        {/* Parts Total */}
                        <div className="bg-[#181b2a] p-4 rounded-xl border border-rose-500/30">
                          <span className="text-xs text-gray-400 font-bold block mb-1">Parts Total</span>
                          <span className="text-2xl font-black font-mono text-rose-400">
                            {partsTotalSelling.toLocaleString('ar-EG')}
                          </span>
                        </div>

                        {/* Labor */}
                        <div className="bg-[#181b2a] p-4 rounded-xl border border-cyan-500/30">
                          <span className="text-xs text-gray-400 font-bold block mb-1">Labor</span>
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              min="0"
                              value={calculatedLabor}
                              onChange={(e) => {
                                const newLabor = Number(e.target.value) || 0;
                                const newGrand = partsTotalSelling + newLabor;
                                handleManualDevicePriceChange(devIdx, newGrand);
                              }}
                              className="w-32 bg-gray-950 border border-cyan-500/50 rounded-lg px-2 py-1 text-center text-xl font-black font-mono text-cyan-300 focus:outline-none"
                            />
                            <span className="text-xs text-cyan-400 font-bold">ج.م</span>
                          </div>
                        </div>

                        {/* Grand Total */}
                        <div className="bg-gradient-to-r from-emerald-950 via-[#12231c] to-emerald-950 p-4 rounded-xl border-2 border-emerald-500/50 shadow-md">
                          <span className="text-xs text-emerald-300 font-bold block mb-1">Grand Total</span>
                          <span className="text-3xl font-black font-mono text-emerald-400">
                            {grandTotal.toLocaleString('ar-EG')}
                          </span>
                        </div>
                      </div>

                      {/* -----------------------------------------
                          BOTTOM ACTIONS
                         ----------------------------------------- */}
                      <div className="pt-3 border-t border-[#2a2d42] flex flex-wrap items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            updateRepairOrder(selectedOrder);
                            dialog.alert({ message: "تم حفظ بيانات طلب الصيانة بنجاح", variant: "success" });
                          }}
                          className="flex-1 min-w-[140px] bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-sm py-3 px-6 rounded-xl shadow-lg transition cursor-pointer flex items-center justify-center gap-2"
                        >
                          <Save className="w-4.5 h-4.5" />
                          <span>Save</span>
                        </button>

                        <button
                          type="button"
                          onClick={async () => {
                            await handleUpdateOrderStatus(RepairStatus.Ready);
                            dialog.alert({ message: "تم تحديث حالة الجهاز إلى (جاهز للتسليم)", variant: "success" });
                          }}
                          className="flex-1 min-w-[140px] bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm py-3 px-6 rounded-xl shadow-lg transition cursor-pointer flex items-center justify-center gap-2"
                        >
                          <CheckCircle className="w-4.5 h-4.5" />
                          <span>Ready</span>
                        </button>

                        <button
                          type="button"
                          onClick={async () => {
                            await handleUpdateOrderStatus(RepairStatus.Delivered);
                            dialog.alert({ message: "تم تسليم الجهاز وإغلاق الطلب بنجاح", variant: "success" });
                          }}
                          className="flex-1 min-w-[140px] bg-cyan-600 hover:bg-cyan-500 text-white font-extrabold text-sm py-3 px-6 rounded-xl shadow-lg transition cursor-pointer flex items-center justify-center gap-2"
                        >
                          <Package className="w-4.5 h-4.5" />
                          <span>Delivered</span>
                        </button>
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
