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
  Calculator
} from "lucide-react";
import { useRepairOrders, useCustomers, useProducts, useSettings, useInvoices, useCurrentUser } from "../hooks/useData";
import { RepairOrder, RepairDevice, RepairStatus, DeviceType, PaymentMethod, WorkOwnershipType, User as UserType } from "../types";
import { getCustomerNameHelper, getCustomerPhoneHelper, getCustomerBadgeHelper } from "../lib/customerDisplayHelper";
import PrintReceiptModal from "./PrintReceiptModal";
import DeliverDeviceModal from "./DeliverDeviceModal";
import ReopenOrderModal from "./ReopenOrderModal";
import CancelWarrantyModal from "./CancelWarrantyModal";
import { canDeliverDevice, canReopenDeliveredOrder, canCancelWarranty } from "../lib/authPermissions";
import { db } from "../lib/db";
import { QUICK_FAULTS_LIST } from "./Reception";

interface RepairCenterProps {
  initialStatusFilter?: RepairStatus;
  initialOrderId?: string;
}

export default function RepairCenter({
  initialStatusFilter,
  initialOrderId
}: RepairCenterProps) {
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
      const res = deleteRepairOrder(orderId);
      if (res.success) {
        if (selectedOrder?.id === orderId) {
          setSelectedOrder(null);
        }
        await dialog.alert({ message: "تم حذف أمر الصيانة رقم " + orderId + " بنجاح!", variant: "success" });
      } else {
        await dialog.alert({ message: res.error || "تعذر حذف أمر الصيانة", variant: "error" });
      }
    }
  };

  const handleSendWhatsAppUpdate = async (order: RepairOrder) => {
    const custName = getCustomerNameHelper(order, customers);
    const custPhone = getCustomerPhoneHelper(order, customers);
    if (!custPhone) {
      await dialog.alert({ message: "بيانات هاتف العميل غير متوفرة لهذا الطلب!", variant: "warning" });
      return;
    }

    const trackingLink = `https://atari-store-pro-x.web.app/track?orderId=${order.id}`;
    const remaining = order.totalEstimatedCost - order.advancePayment;

    const devicesListText = order.devices
      .map((d, i) => `${i + 1}. ${d.type} (${d.model})\n   - العطل: ${d.issue}${d.technicianNotes ? `\n   - تقرير الفحص: ${d.technicianNotes}` : ""}`)
      .join("\n\n");

    const statusHeader = statusConfig[order.status]?.text || order.status;

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
    [RepairStatus.WaitingParts]: { text: "بانتظار قطع الغيار", class: "bg-orange-500/10 text-orange-400 border border-orange-500/20" },
    [RepairStatus.Repairing]: { text: "قيد الإصلاح", class: "bg-green-500/10 text-green-400 border border-green-500/20" },
    [RepairStatus.Testing]: { text: "تحت التجربة", class: "bg-lime-500/10 text-lime-400 border border-lime-500/20" },
    [RepairStatus.Ready]: { text: "جاهزة للاستلام", class: "bg-purple-500/10 text-purple-400 border border-purple-500/20" },
    [RepairStatus.Delivered]: { text: "تم التسليم", class: "bg-gray-500/10 text-gray-400 border border-gray-500/20" },
    [RepairStatus.Cancelled]: { text: "ملغاة", class: "bg-red-500/10 text-red-400 border border-red-500/20" }
  };

  // Filter orders
  const filteredOrders = orders.filter(order => {
    if (activeTab === "all") return true;
    return order.status === activeTab;
  });

  const handleSelectOrder = (order: RepairOrder) => {
    setSelectedOrder(order);
  };

  // Helper: Calculate suggested faults cost from fault labels array
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

    // Calculate total final price based on all devices
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
        selectedQuickFaults: newTags,
        suggestedRepairPrice: faultSum,
        priceOverrideAcknowledged: false
      };
    } else {
      updatedDevices[deviceIdx] = {
        ...currentDevice,
        issue: newTags.join(" - "),
        selectedQuickFaults: newTags,
        suggestedRepairPrice: faultSum,
        finalRepairPrice: autoPrice,
        estimatedCost: autoPrice
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
  };

  // Manual device price change
  const handleManualDevicePriceChange = (deviceIdx: number, newPrice: number) => {
    if (!selectedOrder) return;
    const updatedDevices = [...selectedOrder.devices];
    const currentDevice = updatedDevices[deviceIdx];
    if (!currentDevice) return;

    updatedDevices[deviceIdx] = {
      ...currentDevice,
      finalRepairPrice: newPrice,
      estimatedCost: newPrice,
      isPriceManuallyEdited: true,
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

  // Recalculate device price button: (Faults sum + Spare parts sum)
  const handleRecalculateDevicePrice = (deviceIdx: number) => {
    if (!selectedOrder) return;
    const updatedDevices = [...selectedOrder.devices];
    const currentDevice = updatedDevices[deviceIdx];
    if (!currentDevice) return;

    const tags = currentDevice.selectedQuickFaults || (currentDevice.issue ? currentDevice.issue.split(" - ").map(s => s.trim()) : []);
    const faultSum = calculateSuggestedPriceForFaults(tags);
    const partsSum = Number(currentDevice.partsCost) || 0;
    const autoPrice = faultSum + partsSum;

    updatedDevices[deviceIdx] = {
      ...currentDevice,
      suggestedRepairPrice: faultSum,
      finalRepairPrice: autoPrice,
      estimatedCost: autoPrice,
      isPriceManuallyEdited: false,
      priceOverrideAcknowledged: true
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

  // Keep manual price
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

  const handleUpdateOrderStatus = async (status: RepairStatus) => {
    if (!selectedOrder) return;

    // Update both main order status and all unfinished devices status
    const updatedDevices = selectedOrder.devices.map(dev => {
      // If order is delivered or cancelled, apply to all devices
      if (status === RepairStatus.Delivered || status === RepairStatus.Cancelled || status === RepairStatus.Ready) {
        return { ...dev, status };
      }
      return dev;
    });

    const isDelivered = status === RepairStatus.Delivered;
    const isReady = status === RepairStatus.Ready;

    const updatedOrder: RepairOrder = {
      ...selectedOrder,
      status,
      devices: updatedDevices,
      isPaid: isDelivered ? true : selectedOrder.isPaid,
      completionDate: isReady || isDelivered ? new Date().toISOString() : selectedOrder.completionDate
    };

    setSelectedOrder(updatedOrder);
    updateRepairOrder(updatedOrder);

    // If marked as Delivered, automatically generate a Paid Sales/Repair Invoice in Accounting!
    if (isDelivered) {
      const totalAmount = updatedOrder.totalEstimatedCost;
      const paid = totalAmount; // fully paid
      
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
      message: `تم تحديث حالة الطلب إلى "${statusConfig[status].text}". هل تود إرسال إشعار فوري للعميل عبر الواتس آب؟`,
      confirmText: "إرسال واتساب",
      cancelText: "تخطي"
    });
    if (sendWa) {
      const customer = customers.find(c => c.id === updatedOrder.customerId);
      if (customer) {
        const trackingLink = `https://atari-store-pro-x.web.app/track?orderId=${updatedOrder.id}`;
        const remaining = updatedOrder.totalEstimatedCost - updatedOrder.advancePayment;

        const devicesListText = updatedOrder.devices
          .map((d, i) => `${i + 1}. ${d.type} (${d.model})\n   - العطل: ${d.issue}${d.technicianNotes ? `\n   - ملاحظات المهندس: ${d.technicianNotes}` : ""}`)
          .join("\n\n");

        const statusHeader = statusConfig[status]?.text || status;

        const msg = `تحديث حالة الصيانة - Atari Store Pro X 🎮🛠️

العميل العزيز: ${customer.name}

نود إعلامك بتحديث جديد لحالة أجهزة الصيانة الخاصة بك (طلب رقم: ${updatedOrder.id}):

الأجهزة:
${devicesListText}

📌 المرحلة الحالية: [ ${statusHeader} ]

💰 إجمالي التكلفة: ${updatedOrder.totalEstimatedCost} ج.م
💳 المدفوع مقدمًا: ${updatedOrder.advancePayment} ج.م
بقيمة متبقية: ${remaining} ج.م

🔗 يمكنك تتبع خط سير صيانة جهازك لحظة بلحظة:
${trackingLink}

شكراً لتعاملك معنا!`;

        const formattedPhone = customer.phone.startsWith("2") ? customer.phone : "2" + customer.phone;
        const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`;
        window.open(url, "_blank");
      }
    }
  };

  // Add Part Consumed from stock
  const handleAddPartToDevice = async (deviceIdx: number, partId: string) => {
    const part = products.find(p => p.id === partId);
    if (!part) return;

    if (part.quantity <= 0) {
      await dialog.alert({ message: "المنتج نافد تماماً من المخزون، يرجى تعزيز الشراء أولاً", variant: "warning" });
      return;
    }

    // Deduct stock quantity by 1
    updateProduct({
      ...part,
      quantity: part.quantity - 1
    });

    const currentDevice = selectedOrder?.devices[deviceIdx];
    if (!currentDevice || !selectedOrder) return;

    const newPartsCost = (Number(currentDevice.partsCost) || 0) + part.sellPrice;
    const tags = currentDevice.selectedQuickFaults || (currentDevice.issue ? currentDevice.issue.split(" - ").map(s => s.trim()) : []);
    const faultSum = currentDevice.suggestedRepairPrice ?? calculateSuggestedPriceForFaults(tags);
    const autoPrice = faultSum + newPartsCost;

    const partNotes = `${currentDevice.technicianNotes || ""}\n- تم استخدام قطعة الغيار: ${part.name} بقيمة ${part.sellPrice} ج.م`.trim();

    const isManual = currentDevice.isPriceManuallyEdited;
    const finalPrice = isManual ? (currentDevice.finalRepairPrice ?? autoPrice) : autoPrice;

    const updatedDevices = [...selectedOrder.devices];
    updatedDevices[deviceIdx] = {
      ...currentDevice,
      partsCost: newPartsCost,
      suggestedRepairPrice: faultSum,
      finalRepairPrice: finalPrice,
      estimatedCost: finalPrice,
      technicianNotes: partNotes
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

    setPartSearch("");
    setSelectedPartIndex(null);
  };

  const handleUpdateOwnershipType = async (type: WorkOwnershipType) => {
    if (!selectedOrder) return;
    if (selectedOrder.isSettled) {
      await dialog.alert({ message: "عذراً، هذا الطلب تم إغلاقه واعتماده ضمن تسوية شهرية معتمدة، ولا يمكن تعديل نوع الملكية!", variant: "error" });
      return;
    }

    const defaultRate = type === WorkOwnershipType.PARTNER_2_PRIVATE ? 25 : 0;

    const updatedOrder: RepairOrder = {
      ...selectedOrder,
      workOwnershipType: type,
      workOwnerPartnerId: type === WorkOwnershipType.PARTNER_2_PRIVATE ? "P-002" : type === WorkOwnershipType.PARTNER_1_PRIVATE ? "P-001" : undefined,
      partnerDeductionRate: defaultRate
    };

    setSelectedOrder(updatedOrder);
    updateRepairOrder(updatedOrder);
  };

  const handleUpdateDeductionRate = async (rate: number) => {
    if (!selectedOrder) return;
    if (selectedOrder.isSettled) {
      await dialog.alert({ message: "عذراً، هذا الطلب تم إغلاقه واعتماده ضمن تسوية شهرية معتمدة، ولا يمكن تعديل نسبة الخصم!", variant: "error" });
      return;
    }

    const updatedOrder: RepairOrder = {
      ...selectedOrder,
      partnerDeductionRate: rate
    };

    setSelectedOrder(updatedOrder);
    updateRepairOrder(updatedOrder);
  };

  return (
    <div className="space-y-6">
      {/* Receipts Drawer Modal */}
      {isReceiptOpen && receiptOrder && (
        <PrintReceiptModal
          isOpen={isReceiptOpen}
          onClose={() => setIsReceiptOpen(false)}
          order={receiptOrder}
          customer={customers.find(c => c.id === receiptOrder.customerId)}
          settings={settings}
        />
      )}

      {/* Deliver Device Modal */}
      {isDeliverModalOpen && selectedOrder && (
        <DeliverDeviceModal
          isOpen={isDeliverModalOpen}
          onClose={() => setIsDeliverModalOpen(false)}
          order={selectedOrder}
          customer={customers.find(c => c.id === selectedOrder.customerId)}
          currentUser={currentUserForAction}
          invoices={invoices}
          onConfirmDelivery={params => {
            const res = deliverRepairOrder({
              ...params,
              orderId: selectedOrder.id,
              currentUser: currentUserForAction
            });
            if (res.success && res.order) {
              setSelectedOrder(res.order);
            }
            return res;
          }}
          onOpenReceiptPrint={(ord) => {
            setIsDeliverModalOpen(false);
            setReceiptOrder(ord);
            setIsReceiptOpen(true);
          }}
        />
      )}

      {/* Reopen Order Modal */}
      {isReopenModalOpen && selectedOrder && (
        <ReopenOrderModal
          isOpen={isReopenModalOpen}
          onClose={() => setIsReopenModalOpen(false)}
          order={selectedOrder}
          customer={customers.find(c => c.id === selectedOrder.customerId)}
          currentUser={currentUserForAction}
          onConfirmReopen={(orderId, reason) => {
            const res = reopenRepairOrder(orderId, currentUserForAction, reason);
            if (res.success && res.order) {
              setSelectedOrder(res.order);
            }
            return res;
          }}
        />
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Wrench className="w-6 h-6 text-indigo-400" />
            مركز الصيانة وورشة المهندسين
          </h2>
          <p className="text-gray-400 text-xs mt-1">تحديث حالات الصيانة، تدوين ملاحظات الفحص والتركيب، وتكلفة المصنعية لقطع الغيار</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Repairs List */}
        <div className="space-y-4">
          <div className="bg-[#11131e] border border-[#2a2d42] p-4 rounded-xl flex flex-wrap gap-1">
            <button
              onClick={() => setActiveTab("all")}
              className={`flex-1 text-center py-2 px-1 text-[11px] rounded-lg transition-colors font-medium cursor-pointer ${
                activeTab === "all" ? "bg-indigo-600 text-white" : "bg-gray-950 text-gray-400 hover:text-white"
              }`}
            >
              الكل
            </button>
            <button
              onClick={() => setActiveTab(RepairStatus.Diagnosing)}
              className={`flex-1 text-center py-2 px-1 text-[11px] rounded-lg transition-colors font-medium cursor-pointer ${
                activeTab === RepairStatus.Diagnosing ? "bg-indigo-600 text-white" : "bg-gray-950 text-gray-400 hover:text-white"
              }`}
            >
              فحص
            </button>
            <button
              onClick={() => setActiveTab(RepairStatus.Repairing)}
              className={`flex-1 text-center py-2 px-1 text-[11px] rounded-lg transition-colors font-medium cursor-pointer ${
                activeTab === RepairStatus.Repairing ? "bg-indigo-600 text-white" : "bg-gray-950 text-gray-400 hover:text-white"
              }`}
            >
              إصلاح
            </button>
            <button
              onClick={() => setActiveTab(RepairStatus.Ready)}
              className={`flex-1 text-center py-2 px-1 text-[11px] rounded-lg transition-colors font-medium cursor-pointer ${
                activeTab === RepairStatus.Ready ? "bg-indigo-600 text-white" : "bg-gray-950 text-gray-400 hover:text-white"
              }`}
            >
              جاهز
            </button>
          </div>

          <div className="bg-[#11131e] border border-[#2a2d42] p-4 rounded-2xl max-h-[550px] overflow-y-auto space-y-3">
            <h3 className="text-xs font-bold text-gray-400">طلبات الصيانة النشطة ({filteredOrders.length})</h3>
            {filteredOrders.length > 0 ? (
              filteredOrders.map(order => {
                const custName = getCustomerNameHelper(order, customers);
                const custBadge = getCustomerBadgeHelper(order);
                const firstDevice = order.devices[0];
                const statusStyle = statusConfig[order.status];
                const isSelected = selectedOrder?.id === order.id;

                return (
                  <div
                    key={order.id}
                    onClick={() => handleSelectOrder(order)}
                    className={`p-3.5 rounded-xl border transition-all-custom cursor-pointer text-right relative ${
                      isSelected
                        ? "bg-indigo-600/10 border-indigo-500 glow-primary"
                        : "bg-gray-950 border-[#2a2d42] hover:border-[#3a3e5c]"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-mono font-bold text-indigo-400 text-xs">{order.id}</span>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <h4 className="text-white font-bold text-xs">{custName}</h4>
                          <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${
                            custBadge.type === 'REGISTERED' 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          }`}>
                            {custBadge.label}
                          </span>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${statusStyle.class}`}>
                        {statusStyle.text}
                      </span>
                    </div>

                    <div className="mt-2.5 text-[11px] text-gray-400 space-y-1">
                      <p>
                        جهاز: <span className="font-bold text-gray-200">{firstDevice?.type}</span> {firstDevice?.model}
                      </p>
                      {order.devices.length > 1 && (
                        <p className="text-indigo-400 font-bold">+ {order.devices.length - 1} أجهزة أخرى في الفاتورة</p>
                      )}
                    </div>

                    <div className="border-t border-[#2a2d42]/60 mt-3 pt-2.5 flex justify-between items-center text-[10px] text-gray-500">
                      <span>{new Date(order.receivedDate).toLocaleDateString("ar-EG")}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white bg-gray-950 px-2 py-0.5 rounded border border-[#2a2d42]">
                          {order.totalEstimatedCost} ج.م
                        </span>

                        {/* Delete Order Button - Visible for Admin / Owner Role */}
                        {(currentLoggedUser?.role === "admin" || currentLoggedUser?.roleId === "OWNER" || currentLoggedUser?.role === "OWNER" || currentLoggedUser?.email === "elbannafc@gmail.com" || currentLoggedUser?.permissions?.includes("all")) && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteOrder(order.id, e)}
                            title="حذف أمر الصيانة (صلاحية مدير)"
                            className="p-1 text-red-400 hover:text-white hover:bg-red-600/30 rounded-md transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center p-8 text-gray-500 bg-gray-950 rounded-xl border border-dashed border-[#2a2d42]">
                لا توجد أجهزة متطابقة حالياً.
              </div>
            )}
          </div>
        </div>

        {/* Middle & Right columns: Order Workspace Details */}
        <div className="lg:col-span-2 space-y-6">
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
                          {statusConfig[st].text}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* DELIVER DEVICE BUTTON - Prominent delivery action */}
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

                  {/* REOPEN ORDER BUTTON - Only for delivered orders (Ahmed Elbanna / OWNER) */}
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

                  {/* CANCEL WARRANTY BUTTON - OWNER ONLY */}
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

                  {/* Delete Button - ONLY Visible for Admin Role */}
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

              {/* Work Ownership & Financial Distribution Card */}
              {selectedOrder && (() => {
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
                  // Owner's Private Work (شغل أحمد البنا)
                  ownerShare = netProfit;
                  partnerShare = 0;
                } else if (ownership === WorkOwnershipType.PARTNER_2_PRIVATE) {
                  // Abdou's Private Work (شغل عبده)
                  ownerShare = Math.round(netProfit * (deductionRate / 100));
                  partnerShare = netProfit - ownerShare;
                } else {
                  // Shared Customer Work (شغل عملاء)
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

                    {ownership === WorkOwnershipType.PARTNER_1_PRIVATE && (
                      <p className="text-[11px] text-amber-300/90 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
                        💡 <strong>شغل أحمد البنا:</strong> الإيراد والأرباح خاصة بأحمد البنا بالكامل ({ownerShare} ج.م). يتم استرداد تكلفة بضاعة قطع الغيار ({totalOrderPartsCost} ج.م) لحساب مخزن الشراكة ولا يستحق الشريك عبده أرباحاً عن هذا الطلب (0 ج.م).
                      </p>
                    )}
                    {ownership === WorkOwnershipType.PARTNER_2_PRIVATE && (
                      <p className="text-[11px] text-cyan-300/90 bg-cyan-500/10 p-2.5 rounded-lg border border-cyan-500/20">
                        💡 <strong>شغل عبده:</strong> يتم خصم تكلفة بضاعة قطع الغيار ({totalOrderPartsCost} ج.م) والمصروفات ({directCosts} ج.م) ⬅️ ثم تقسيم صافي الربح ({netProfit} ج.م) بنسبة خصم ({deductionRate}% لأحمد البنا = {ownerShare} ج.م / {100 - deductionRate}% لعبده = {partnerShare} ج.م).
                      </p>
                    )}
                    {ownership === WorkOwnershipType.CUSTOMER_SHARED && (
                      <p className="text-[11px] text-slate-300 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                        🤝 <strong>شغل عملاء:</strong> يتم خصم التكاليف كاملة ⬅️ ثم تقسيم صافي أرباح الصيانة مناصفة بين أحمد البنا وعبده (50% / 50%).
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Devices Workspace loop inside Workspace */}
              <div className="space-y-6">
                {selectedOrder.devices.map((device, devIdx) => (
                  <div key={device.id} className="bg-gray-950/40 p-5 rounded-xl border border-[#2a2d42] space-y-4">
                    <div className="flex justify-between items-center pb-2 border-b border-[#2a2d42]/60">
                      <h4 className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-indigo-500" />
                        الورشة: {device.type} - {device.model}
                      </h4>
                      <span className="text-[10px] text-gray-400 font-mono">سيريال: {device.serialNumber || "غير متوفر"}</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-[#11131e] p-3 rounded-xl border border-[#2a2d42]">
                        <span className="text-[10px] text-gray-400 block">العطل الموصوف</span>
                        <p className="text-xs font-bold text-white mt-1">{device.issue}</p>
                      </div>

                      <div className="bg-[#11131e] p-3 rounded-xl border border-[#2a2d42]">
                        <span className="text-[10px] text-gray-400 block">الملحقات المستلمة</span>
                        <p className="text-xs text-gray-300 mt-1">{device.accessories || "جهاز فقط"}</p>
                      </div>

                      <div className="bg-[#11131e] p-3 rounded-xl border border-[#2a2d42]">
                        <span className="text-[10px] text-gray-400 block">توقيت الاستلام</span>
                        <p className="text-xs text-gray-300 mt-1">{new Date(selectedOrder.receivedDate).toLocaleString("ar-EG")}</p>
                      </div>
                    </div>

                    {/* Quick Faults Selector for Workshop Technician */}
                    <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="text-[11px] text-indigo-300 font-bold flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                          <span>📋 الأعطال المحددة للجهاز (انقر لإضافة/إزالة عطل وتحديث السعر):</span>
                        </label>
                        <span className="text-[10px] text-gray-400">التحديث المباشر يتغير فوراً مع تغيير الأعطال وقطع الغيار</span>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {QUICK_FAULTS_LIST.map((fault) => {
                          const isSelected = (device.issue || "").includes(fault.label);
                          return (
                            <button
                              key={fault.id}
                              type="button"
                              onClick={() => handleToggleQuickFaultInRepairCenter(devIdx, fault.label)}
                              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                                isSelected
                                  ? "bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-950/50"
                                  : "bg-gray-950/80 text-gray-300 border-gray-800 hover:border-gray-700 hover:text-white"
                              }`}
                            >
                              <span className="text-[10px]">
                                {isSelected ? "☑" : "□"}
                              </span>
                              <span>{fault.label}</span>
                              {fault.defaultSellingPrice > 0 && (
                                <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${
                                  isSelected ? "bg-indigo-800/80 text-emerald-300" : "bg-gray-900 text-gray-400"
                                }`}>
                                  +{fault.defaultSellingPrice} ج.م
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Single Primary Final Price Input Field & Recalculate Button */}
                    {(() => {
                      const tags = device.selectedQuickFaults || (device.issue ? device.issue.split(" - ").map(s => s.trim()) : []);
                      const faultsCost = device.suggestedRepairPrice ?? calculateSuggestedPriceForFaults(tags);
                      const partsCost = Number(device.partsCost) || 0;
                      const calculatedTotal = faultsCost + partsCost;
                      const currentFinalPrice = device.finalRepairPrice ?? device.estimatedCost ?? calculatedTotal;

                      return (
                        <div className="bg-gradient-to-r from-indigo-950/70 via-slate-900 to-indigo-950/70 p-4 rounded-2xl border border-indigo-500/40 space-y-3 shadow-lg">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <label className="text-xs text-emerald-400 font-extrabold flex items-center gap-1.5">
                              <DollarSign className="w-4 h-4 text-emerald-400" />
                              <span>💰 السعر النهائي للعميل (ج.م) *</span>
                            </label>

                            {/* Recalculate Button */}
                            <button
                              type="button"
                              onClick={() => handleRecalculateDevicePrice(devIdx)}
                              className="bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 hover:text-white border border-indigo-400/40 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                              title="إعادة احتساب السعر تلقائياً من الأعطال وقطع الغيار"
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

                          {/* Read-Only Price Summary Breakdown */}
                          <div className="bg-gray-950/90 p-3 rounded-xl border border-slate-800 text-xs space-y-1.5 text-gray-300">
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="text-gray-400">سعر الأعطال المختارة:</span>
                              <span className="font-mono font-bold text-indigo-300">{faultsCost} ج.م</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="text-gray-400">قطع الغيار المصروفة من المخزون:</span>
                              <span className="font-mono font-bold text-rose-300">{partsCost} ج.م</span>
                            </div>
                            <div className="border-t border-gray-800 pt-1.5 flex justify-between items-center text-xs font-bold">
                              <span className="text-gray-200">السعر المحسوب تلقائياً:</span>
                              <span className="font-mono text-emerald-400">{calculatedTotal} ج.م</span>
                            </div>
                          </div>

                          {/* Warning / Confirmation Banner if price modified manually */}
                          {device.isPriceManuallyEdited &&
                           calculatedTotal !== currentFinalPrice &&
                           !device.priceOverrideAcknowledged && (
                            <div className="bg-amber-950/90 border border-amber-500/50 p-3 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs">
                              <div className="text-amber-200 font-medium leading-relaxed">
                                <span>⚠️ تم تعديل السعر يدوياً ({currentFinalPrice} ج.م). السعر المحسوب للأعطال والقطع: ({calculatedTotal} ج.م). هل تريد تحديثه؟</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleRecalculateDevicePrice(devIdx)}
                                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-sm"
                                >
                                  تحديث السعر ({calculatedTotal} ج.م)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleKeepManualDevicePrice(devIdx)}
                                  className="bg-gray-800 hover:bg-gray-700 text-gray-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer border border-gray-700"
                                >
                                  الاحتفاظ بالسعر الحالي ({currentFinalPrice} ج.م)
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Parts Consumed Selector from Live Inventory */}
                    <div className="pt-2">
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[11px] text-gray-300 block font-bold">صرف قطعة غيار للتركيب من المخزون مباشرة</label>
                        {Number(device.partsCost) > 0 && (
                          <span className="text-[10px] text-rose-400 font-mono font-bold bg-rose-950/40 px-2 py-0.5 rounded border border-rose-500/20">
                            إجمالي القطع المصروفة: {device.partsCost} ج.م
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="ابحث في المخزون عن قطع غيار للبلايستيشن أو سوكيتات أو باورسبلاي..."
                          value={selectedPartIndex === devIdx ? partSearch : ""}
                          onChange={e => {
                            setSelectedPartIndex(devIdx);
                            setPartSearch(e.target.value);
                          }}
                          className="w-full bg-gray-950 border border-[#2a2d42] rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                        />
                        {selectedPartIndex === devIdx && partSearch.trim() && (
                          <div className="absolute right-0 left-0 bg-[#11131e] border border-[#2a2d42] mt-1 rounded-lg max-h-[150px] overflow-y-auto z-40 divide-y divide-[#2a2d42]">
                            {products
                              .filter(p => p.name.includes(partSearch) || p.category.includes("قطع غيار"))
                              .map(p => (
                                <button
                                  key={p.id}
                                  onClick={() => handleAddPartToDevice(devIdx, p.id)}
                                  className="w-full text-right px-4 py-2.5 text-xs text-gray-300 hover:bg-indigo-600/10 flex justify-between items-center cursor-pointer"
                                >
                                  <span>{p.name}</span>
                                  <span className="font-bold text-green-400">{p.sellPrice} ج.م (متبقي: {p.quantity})</span>
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Technician Diagnosis & Work notes */}
                    <div>
                      <label className="text-[11px] text-gray-400 block mb-1 font-medium">تقرير تشخيص المهندس والصيانة المنجزة</label>
                      <textarea
                        placeholder="أدخل تشخيصك، وما تم إصلاحه، والقطع المستبدلة..."
                        value={device.technicianNotes || ""}
                        onChange={e => handleUpdateDeviceDetails(devIdx, "technicianNotes", e.target.value)}
                        className="w-full bg-gray-950 border border-[#2a2d42] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 h-20 resize-none"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Order Financial & Printing actions */}
              <div className="border-t border-[#2a2d42] pt-4 flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-950/20 p-4 rounded-xl border border-dashed border-[#2a2d42]">
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
                    className="flex-1 md:flex-initial bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all-custom cursor-pointer"
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

      {/* Cancel Warranty Modal (Owner Exclusive) */}
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
