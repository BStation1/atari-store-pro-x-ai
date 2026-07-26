/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
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
  Tag,
  Plus,
  X
} from "lucide-react";
import { useRepairOrders, useCustomers, useProducts, useSettings, useInvoices, useCurrentUser } from "../hooks/useData";
import { RepairOrder, RepairDevice, RepairStatus, DeviceType, PaymentMethod, WorkOwnershipType, User as UserType, QUICK_FAULTS_LIST, SelectedRepairItem } from "../types";
import { getCustomerNameHelper, getCustomerPhoneHelper, getCustomerBadgeHelper } from "../lib/customerDisplayHelper";
import { PhoneDisplay } from "./PhoneDisplay";
import PrintReceiptModal from "./PrintReceiptModal";
import DeliverDeviceModal from "./DeliverDeviceModal";
import ReopenOrderModal from "./ReopenOrderModal";
import CancelWarrantyModal from "./CancelWarrantyModal";
import { canDeliverDevice, canReopenDeliveredOrder, canCancelWarranty } from "../lib/authPermissions";
import { db } from "../lib/db";
import { 
  addTimelineEventHelper, 
  addAuditLogRecordHelper, 
  EVENT_TYPE_LABELS, 
  AUDIT_ACTION_LABELS 
} from "../lib/repairLogging";

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

  const [activeTab, setActiveTab] = useState<string>(initialStatusFilter || "all");
  const [selectedOrder, setSelectedOrder] = useState<RepairOrder | null>(
    initialOrderId ? orders.find(o => o.id === initialOrderId) || null : null
  );

  // Sub-Navigation Tabs inside Order Workspace
  const [workspaceTab, setWorkspaceTab] = useState<"workshop" | "timeline" | "audit">("workshop");
  const [timelineSortOrder, setTimelineSortOrder] = useState<"desc" | "asc">("desc");
  const [auditFilter, setAuditFilter] = useState<string>("all");

  // Custom Procedure Addition Modal
  const [newProcedureModalDevIdx, setNewProcedureModalDevIdx] = useState<number | null>(null);
  const [newProcedureName, setNewProcedureName] = useState("");
  const [newProcedureCost, setNewProcedureCost] = useState<number>(0);
  const [newProcedurePrice, setNewProcedurePrice] = useState<number>(0);

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

  const handleSendWhatsAppUpdate = (order: RepairOrder) => {
    const custName = getCustomerNameHelper(order, customers);
    const custPhone = getCustomerPhoneHelper(order, customers);

    if (!custPhone || custPhone === "بدون رقم") {
      dialog.alert({ message: "لا يوجد رقم هاتف مسجل لهذا العميل لإرسال الواتس آب!", variant: "warning" });
      return;
    }

    const statusHeader = (order.status && statusConfig[order.status]?.text) || order.status || "غير محدد";
    const remaining = Math.max(0, (order.finalRepairPrice ?? order.totalEstimatedCost) - order.advancePayment);
    const trackingLink = `${window.location.origin}/track?id=${order.id}`;

    const devicesListText = order.devices.map(d => `- ${d.type} (${d.model}): ${d.issue}`).join("\n");

    const msg = `تحديث حالة الصيانة - Atari Store Pro X 🎮🛠️

العميل العزيز: ${custName}

نود إعلامك بتحديث جديد لحالة أجهزة الصيانة الخاصة بك (طلب رقم: ${order.id}):

الأجهزة:
${devicesListText}

📌 المرحلة الحالية: [ ${statusHeader} ]

💰 إجمالي التكلفة: ${order.totalEstimatedCost} ج.م
💳 المدفوع مقدمًا: ${order.advancePayment} ج.م
بقيمة متبقية: ${remaining} ج.م

🔗 رابط تتبع حالة الصيانة الفوري:
${trackingLink}

شكراً لتعاملك معنا!`;

    const formattedPhone = custPhone.startsWith("2") ? custPhone : "2" + custPhone;
    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
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
  const handleAddPartToDevice = (deviceIdx: number, productId: string) => {
    if (!selectedOrder) return;
    const product = products.find(p => p.id === productId);
    if (!product) return;

    if (product.quantity <= 0) {
      dialog.alert({ message: "عفواً، هاته القطعة غير متوفرة بالمخزون حالياً!", variant: "error" });
      return;
    }

    const updatedDevices = [...selectedOrder.devices];
    const currentDevice = updatedDevices[deviceIdx];
    if (!currentDevice) return;

    const currentPartsCost = Number(currentDevice.partsCost) || 0;
    const newPartsCost = currentPartsCost + product.sellPrice;

    const currentProcedures = currentDevice.technicalProcedures || currentDevice.selectedRepairItems || [];
    const newPartItem: SelectedRepairItem = {
      id: `PART-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      productId: product.id,
      name: product.name,
      quantity: 1,
      costPrice: product.purchasePrice || 0,
      repairPrice: product.sellPrice || 0
    };

    const updatedProcedures = [...currentProcedures, newPartItem];

    const tags = currentDevice.selectedQuickFaults || (currentDevice.issue ? currentDevice.issue.split(" - ").map(s => s.trim()) : []);
    const faultsCost = currentDevice.suggestedRepairPrice ?? calculateSuggestedPriceForFaults(tags);
    const newAutoPrice = faultsCost + newPartsCost;

    if (currentDevice.isPriceManuallyEdited) {
      updatedDevices[deviceIdx] = {
        ...currentDevice,
        partsCost: newPartsCost,
        technicalProcedures: updatedProcedures,
        selectedRepairItems: updatedProcedures,
        priceOverrideAcknowledged: false
      };
    } else {
      updatedDevices[deviceIdx] = {
        ...currentDevice,
        partsCost: newPartsCost,
        technicalProcedures: updatedProcedures,
        selectedRepairItems: updatedProcedures,
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

    // Deduct quantity from inventory
    updateProduct({
      ...product,
      quantity: product.quantity - 1
    });

    updatedOrder = addAuditLogRecordHelper(
      updatedOrder,
      "ADD_PART",
      `قطع غيار جهاز ${currentDevice.type}`,
      null,
      `${product.name} (${product.sellPrice} ج.م)`,
      "صرف قطعة غيار من المخزون مباشرة للتركيب",
      currentUserForAction,
      currentDevice.id
    );

    updatedOrder = addTimelineEventHelper(
      updatedOrder,
      "PART_ADDED",
      `صرف قطعة غيار من المخزون: ${product.name} (${product.sellPrice} ج.م)`,
      currentUserForAction,
      currentDevice.id
    );

    setSelectedOrder(updatedOrder);
    updateRepairOrder(updatedOrder);

    setPartSearch("");
    setSelectedPartIndex(null);
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

    // Update both main order status and all unfinished devices status
    const updatedDevices = selectedOrder.devices.map(dev => {
      if (status === RepairStatus.Delivered || status === RepairStatus.Cancelled || status === RepairStatus.Ready) {
        return { ...dev, status };
      }
      return dev;
    });

    const isDelivered = status === RepairStatus.Delivered;
    const isReady = status === RepairStatus.Ready;

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
          name: `صيانة ${d.type} (${d.model}) - ${d.issue}`,
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

    // WhatsApp status step alert trigger
    const sendWa = await dialog.confirm({
      title: "إرسال إشعار إنجاز",
      message: `تم تحديث حالة الطلب إلى "${statusConfig[status]?.text || status || "غير محدد"}". هل تود إرسال إشعار فوري للعميل عبر الواتس آب؟`,
      confirmText: "إرسال واتساب",
      cancelText: "تخطي"
    });

    if (sendWa) {
      handleSendWhatsAppUpdate(updatedOrder);
    }
  };

  // Filter orders by active status tab
  const filteredOrders = orders.filter(o => {
    if (activeTab === "all") return true;
    return o.status === activeTab;
  });

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
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "all" ? "bg-indigo-600 text-white shadow-md shadow-indigo-950/50" : "text-gray-400 hover:text-white"
            }`}
          >
            الكل ({orders.length})
          </button>
          {Object.entries(statusConfig).map(([st, cfg]) => {
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
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Orders List Sidebar Column */}
        <div className="lg:col-span-1 bg-[#11131e] border border-[#2a2d42] rounded-2xl p-4 space-y-3 max-h-[800px] overflow-y-auto">
          <div className="flex justify-between items-center border-b border-[#2a2d42] pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              قائمة أجهزة الورشه ({filteredOrders.length})
            </h3>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-40 text-indigo-400" />
              <p className="text-xs">لا توجد طلبات صيانة ضمن هذه الحالة</p>
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
                        <span className="font-semibold">{d.type} - {d.model}</span>
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

              {/* ==================== WORKSPACE TAB 1: WORKSHOP & REPAIR ==================== */}
              {workspaceTab === "workshop" && (
                <div className="space-y-6">
                  {/* Work Ownership Card */}
                  {(() => {
                    const ownership = selectedOrder.workOwnershipType || WorkOwnershipType.CUSTOMER_SHARED;
                    const totalOrderPartsCost = selectedOrder.devices.reduce((sum, d) => sum + (Number(d.partsCost) || 0), 0);
                    const totalOrderRevenue = selectedOrder.totalEstimatedCost || 0;
                    const directCosts = selectedOrder.otherDirectCosts || 0;
                    const netProfit = Math.max(0, totalOrderRevenue - totalOrderPartsCost - directCosts);

                    const deductionRate = typeof selectedOrder.partnerDeductionRate === "number" 
                      ? selectedOrder.partnerDeductionRate 
                      : (ownership === WorkOwnershipType.PARTNER_2_PRIVATE ? 25 : 0);

                    let ownerShare = 0;
                    let partnerShare = 0;

                    if (ownership === WorkOwnershipType.PARTNER_1_PRIVATE) {
                      ownerShare = netProfit;
                      partnerShare = 0;
                    } else if (ownership === WorkOwnershipType.PARTNER_2_PRIVATE) {
                      ownerShare = Math.round(netProfit * (deductionRate / 100));
                      partnerShare = netProfit - ownerShare;
                    } else {
                      ownerShare = Math.round(netProfit * 0.5);
                      partnerShare = Math.round(netProfit * 0.5);
                    }

                    return (
                      <div className="bg-gradient-to-r from-slate-950 via-[#161928] to-slate-950 p-5 rounded-xl border border-cyan-500/30 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[#2a2d42]">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-cyan-400" />
                            <div>
                              <h4 className="text-xs font-bold text-cyan-300">طبيعة ملكية العمل وتوزيع المستحقات</h4>
                              <p className="text-[10px] text-slate-400 mt-0.5">تحديد استحقاق الإيراد ونسبة الخصم وخصم تكلفة بضاعة قطع الغيار</p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-3">
                            {selectedOrder.isSettled ? (
                              <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl text-xs font-bold flex items-center gap-1.5">
                                <Lock className="w-3.5 h-3.5" />
                                مدرج بتسوية مقفلة
                              </span>
                            ) : (
                              <>
                                <div>
                                  <label className="text-[10px] text-cyan-400 font-bold block mb-1">نوع الشغل</label>
                                  <select
                                    value={ownership}
                                    onChange={e => handleUpdateOwnershipType(e.target.value as WorkOwnershipType)}
                                    className="bg-gray-950 border border-cyan-500/40 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none font-bold text-cyan-300 cursor-pointer"
                                  >
                                    <option value={WorkOwnershipType.CUSTOMER_SHARED}>
                                      شغل المحل
                                    </option>
                                    <option value={WorkOwnershipType.PARTNER_1_PRIVATE}>
                                      شغل أحمد
                                    </option>
                                    <option value={WorkOwnershipType.PARTNER_2_PRIVATE}>
                                      شغل عبده
                                    </option>
                                  </select>
                                </div>

                                <div>
                                  <label className="text-[10px] text-amber-400 font-bold block mb-1">نسبة الخصم (%)</label>
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={deductionRate}
                                    onChange={e => handleUpdateDeductionRate(Math.max(0, Math.min(100, Number(e.target.value))))}
                                    className="w-20 bg-gray-950 border border-amber-500/40 rounded-xl px-2.5 py-1.5 text-xs text-amber-300 font-mono font-bold focus:outline-none"
                                  />
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
                          <div className="bg-[#11131e] p-2.5 rounded-lg border border-[#2a2d42]">
                            <span className="text-[10px] text-gray-400 block">إجمالي الإيراد</span>
                            <span className="font-extrabold text-white text-sm mt-0.5 block">{totalOrderRevenue} ج.م</span>
                          </div>
                          <div className="bg-[#11131e] p-2.5 rounded-lg border border-[#2a2d42]">
                            <span className="text-[10px] text-gray-400 block">تكلفة قطع الغيار المسحوبة</span>
                            <span className="font-extrabold text-rose-400 text-sm mt-0.5 block">{totalOrderPartsCost} ج.م</span>
                          </div>
                          <div className="bg-[#11131e] p-2.5 rounded-lg border border-[#2a2d42]">
                            <span className="text-[11px] text-gray-400 block">نصيب أحمد البنا</span>
                            <span className="font-extrabold text-emerald-400 text-sm mt-0.5 block">{ownerShare} ج.م</span>
                          </div>
                          <div className="bg-[#11131e] p-2.5 rounded-lg border border-[#2a2d42]">
                            <span className="text-[11px] text-gray-400 block">نصيب عبده</span>
                            <span className="font-extrabold text-cyan-400 text-sm mt-0.5 block">{partnerShare} ج.م</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Devices List with 3-Part Separation */}
                  <div className="space-y-6">
                    {selectedOrder.devices.map((device, devIdx) => {
                      const reportedFaults = device.reportedFaults || (device.issue ? device.issue.split(" - ").map(s => s.trim()) : []);
                      const proceduresList: SelectedRepairItem[] = device.technicalProcedures || device.selectedRepairItems || [];

                      return (
                        <div key={device.id} className="bg-gray-950/50 p-5 rounded-2xl border border-[#2a2d42] space-y-5">
                          {/* Device Header */}
                          <div className="flex justify-between items-center pb-3 border-b border-[#2a2d42]/60">
                            <h4 className="text-sm font-bold text-indigo-400 flex items-center gap-2">
                              <Layers className="w-4 h-4 text-indigo-500" />
                              جهاز #{devIdx + 1}: {device.type} - {device.model}
                            </h4>
                            <span className="text-xs text-gray-400 font-mono">سيريال: {device.serialNumber || "غير متوفر"}</span>
                          </div>

                          {/* ================= PART 1: FAULT / CUSTOMER COMPLAINT ================= */}
                          <div className="bg-amber-950/20 border border-amber-500/30 p-4 rounded-xl space-y-3">
                            <div className="flex justify-between items-center">
                              <h5 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                                <AlertTriangle className="w-4 h-4 text-amber-400" />
                                <span>1. العطل أو شكوى العميل (Customer Complaint)</span>
                              </h5>
                              <span className="text-[10px] text-amber-300/80 font-mono">شكوى العميل الظاهرية عند الاستلام</span>
                            </div>

                            {/* Tags list */}
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {QUICK_FAULTS_LIST.map((fault) => {
                                const isSelected = reportedFaults.includes(fault.label);
                                return (
                                  <button
                                    key={fault.id}
                                    type="button"
                                    onClick={() => handleToggleQuickFaultInRepairCenter(devIdx, fault.label)}
                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                                      isSelected
                                        ? "bg-amber-600 text-white border-amber-400 shadow-md shadow-amber-950/50"
                                        : "bg-gray-950/80 text-gray-300 border-gray-800 hover:border-gray-700 hover:text-white"
                                    }`}
                                  >
                                    <span className="text-[10px]">{isSelected ? "☑" : "□"}</span>
                                    <span>{fault.label}</span>
                                    {fault.defaultSellingPrice > 0 && (
                                      <span className={`text-[10px] px-1 rounded font-mono font-bold ${
                                        isSelected ? "bg-amber-800/80 text-white" : "bg-gray-900 text-gray-400"
                                      }`}>
                                        +{fault.defaultSellingPrice} ج.م
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* ================= PART 2: TECHNICIAN DIAGNOSIS REPORT ================= */}
                          <div className="bg-blue-950/20 border border-blue-500/30 p-4 rounded-xl space-y-3">
                            <div className="flex justify-between items-center">
                              <h5 className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                                <FileText className="w-4 h-4 text-blue-400" />
                                <span>2. التقرير والتشخيص الفني للمهندس (Technician Diagnosis)</span>
                              </h5>
                              <button
                                type="button"
                                onClick={() => handleSaveDiagnosis(devIdx)}
                                className="bg-blue-600 hover:bg-blue-500 text-white text-[11px] px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition cursor-pointer"
                              >
                                <Save className="w-3.5 h-3.5" />
                                <span>حفظ التشخيص في السجل</span>
                              </button>
                            </div>

                            <textarea
                              placeholder="أدخل تشخيصك الفني الدقيق للجهاز، المشاكل المكتشفة بالبوردة، المكونات التالفة..."
                              value={device.diagnosisText || device.technicianNotes || ""}
                              onChange={e => {
                                handleUpdateDeviceDetails(devIdx, "diagnosisText", e.target.value);
                                handleUpdateDeviceDetails(devIdx, "technicianNotes", e.target.value);
                              }}
                              className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl p-3 text-xs text-white focus:outline-none focus:border-blue-500 h-20 resize-none font-sans leading-relaxed"
                            />
                          </div>

                          {/* ================= PART 3: TECHNICAL PROCEDURES & REPAIRS ================= */}
                          <div className="bg-purple-950/20 border border-purple-500/30 p-4 rounded-xl space-y-3">
                            <div className="flex justify-between items-center">
                              <h5 className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                                <Wrench className="w-4 h-4 text-purple-400" />
                                <span>3. الإجراءات الفنية والإصلاحات وقطع الغيار المعتمدة</span>
                              </h5>

                              <button
                                type="button"
                                onClick={() => setNewProcedureModalDevIdx(devIdx)}
                                className="bg-purple-600 hover:bg-purple-500 text-white text-[11px] px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>إضافة إجراء فني / إصلاح</span>
                              </button>
                            </div>

                            {/* Active Procedures List */}
                            {proceduresList.length === 0 ? (
                              <div className="text-center py-6 border border-dashed border-purple-500/20 rounded-xl bg-gray-950/40">
                                <p className="text-xs text-gray-400">لم يتم تسجيل إجراءات فنية لهذا الجهاز بعد</p>
                                <p className="text-[10px] text-gray-500 mt-1">انقر على "إضافة إجراء فني" لتسجيل الأعمال المستبدلة أو اختر من المخزون أدناه</p>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {proceduresList.map((proc, pIdx) => (
                                  <div
                                    key={proc.id || pIdx}
                                    className="bg-gray-950 border border-purple-500/30 p-3 rounded-xl flex justify-between items-center text-xs"
                                  >
                                    <div>
                                      <span className="font-bold text-white block">{proc.name}</span>
                                      <span className="text-[10px] text-purple-300">
                                        سعر الإصلاح: {proc.repairPrice} ج.م | التكلفة: {proc.costPrice} ج.م
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveProcedure(devIdx, pIdx)}
                                      className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition cursor-pointer"
                                      title="حذف الإجراء"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Pull Spare Part directly from Stock Inventory */}
                            <div className="pt-2 border-t border-purple-500/20">
                              <div className="flex justify-between items-center mb-1.5">
                                <label className="text-[11px] text-gray-300 block font-bold">صرف قطعة غيار من المخزون مباشرة للتركيب:</label>
                                {Number(device.partsCost) > 0 && (
                                  <span className="text-[10px] text-rose-400 font-mono font-bold bg-rose-950/40 px-2 py-0.5 rounded border border-rose-500/20">
                                    إجمالي تكلفة بضاعة القطع المصروفة: {device.partsCost} ج.م
                                  </span>
                                )}
                              </div>
                              <div className="relative">
                                <input
                                  type="text"
                                  placeholder="ابحث في المخزون عن سوكيت، IC، باورسبلاي، أنالوج..."
                                  value={selectedPartIndex === devIdx ? partSearch : ""}
                                  onChange={e => {
                                    setSelectedPartIndex(devIdx);
                                    setPartSearch(e.target.value);
                                  }}
                                  className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                                />
                                {selectedPartIndex === devIdx && partSearch.trim() && (
                                  <div className="absolute right-0 left-0 bg-[#11131e] border border-[#2a2d42] mt-1 rounded-xl max-h-[160px] overflow-y-auto z-40 divide-y divide-[#2a2d42] shadow-2xl">
                                    {products
                                      .filter(p => !p.isArchived && (p.name.includes(partSearch) || p.category.includes("قطع غيار")))
                                      .map(p => (
                                        <button
                                          key={p.id}
                                          type="button"
                                          onClick={() => handleAddPartToDevice(devIdx, p.id)}
                                          className="w-full text-right px-4 py-2.5 text-xs text-gray-300 hover:bg-indigo-600/10 flex justify-between items-center cursor-pointer"
                                        >
                                          <span>{p.name}</span>
                                          <span className="font-bold text-green-400">{p.sellPrice} ج.م (متاح: {p.quantity})</span>
                                        </button>
                                      ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Device Price Summary & Manual Override */}
                          {(() => {
                            const faultsCost = device.suggestedRepairPrice ?? calculateSuggestedPriceForFaults(reportedFaults);
                            const partsCost = Number(device.partsCost) || 0;
                            const calculatedTotal = faultsCost + partsCost;
                            const currentFinalPrice = device.finalRepairPrice ?? device.estimatedCost ?? calculatedTotal;

                            return (
                              <div className="bg-gradient-to-r from-indigo-950/70 via-slate-900 to-indigo-950/70 p-4 rounded-2xl border border-indigo-500/40 space-y-3 shadow-lg">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <label className="text-xs text-emerald-400 font-extrabold flex items-center gap-1.5">
                                    <DollarSign className="w-4 h-4 text-emerald-400" />
                                    <span>💰 السعر النهائي للعميل لهذا الجهاز (ج.م) *</span>
                                  </label>

                                  <button
                                    type="button"
                                    onClick={() => handleRecalculateDevicePrice(devIdx)}
                                    className="bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 hover:text-white border border-indigo-400/40 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5 text-indigo-300" />
                                    <span>↻ إعادة الحساب</span>
                                  </button>
                                </div>

                                <div className="relative">
                                  <input
                                    type="number"
                                    required
                                    min="0"
                                    placeholder="0.00"
                                    value={currentFinalPrice}
                                    onChange={e => {
                                      const val = e.target.value === "" ? 0 : Number(e.target.value);
                                      handleManualDevicePriceChange(devIdx, val);
                                    }}
                                    className="w-full bg-gray-950 border border-emerald-500/60 rounded-xl px-4 py-3 text-lg text-emerald-400 font-extrabold font-mono focus:outline-none focus:border-emerald-400 shadow-inner"
                                  />
                                </div>

                                <div className="bg-gray-950/90 p-3 rounded-xl border border-slate-800 text-xs space-y-1.5 text-gray-300">
                                  <div className="flex justify-between items-center text-[11px]">
                                    <span className="text-gray-400">سعر الأعطال المحددة:</span>
                                    <span className="font-mono font-bold text-indigo-300">{faultsCost} ج.م</span>
                                  </div>
                                  <div className="flex justify-between items-center text-[11px]">
                                    <span className="text-gray-400">قطع الغيار والإجراءات الفنية:</span>
                                    <span className="font-mono font-bold text-rose-300">{partsCost} ج.م</span>
                                  </div>
                                  <div className="border-t border-gray-800 pt-1.5 flex justify-between items-center text-xs font-bold">
                                    <span className="text-gray-200">السعر المحسوب تلقائياً:</span>
                                    <span className="font-mono text-emerald-400">{calculatedTotal} ج.م</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

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
    </div>
  );
}
