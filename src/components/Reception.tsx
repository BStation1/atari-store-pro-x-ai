/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { useDialog } from "../context/DialogContext";
import {
  User,
  Phone,
  Search,
  Plus,
  Trash2,
  Save,
  Printer,
  MessageSquare,
  Sparkles,
  Smartphone,
  Layers,
  FileText,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Tag,
  Copy,
  Check,
  ExternalLink,
  Edit,
  PlusCircle,
  ShieldAlert,
  Camera,
  X,
  UserPlus,
  UserCheck,
  DollarSign,
  Wrench,
  SearchCode,
  PackageCheck
} from "lucide-react";
import { 
  useCustomers, 
  useRepairOrders, 
  useSettings, 
  useDeviceTypes, 
  useDeviceModels,
  useRepairTemplates
} from "../hooks/useData";
import { Customer, CustomerType, RepairStatus, RepairDevice, RepairOrder, WorkOwnershipType, WarrantyDurationOption, SelectedRepairItem } from "../types";
import { normalizePhoneNumber } from "../utils/phone";
import { PhoneDisplay } from "./PhoneDisplay";
import PrintReceiptModal from "./PrintReceiptModal";
import { sendRepairNotificationWorkflow } from "../lib/whatsapp";

const getLockCodeConfig = (typeStr: string = "", modelStr: string = "") => {
  const combined = `${typeStr} ${modelStr}`.toLowerCase();

  const gamingKeywords = [
    "playstation", "ps5", "ps4", "ps3", "ps2", "xbox", "nintendo", "switch", "steam deck",
    "بلايستيشن", "اكس بوكس", "إكس بوكس", "نينتندو", "سويتش", "ستيم ديك", "العاب", "ألعاب",
    "ذراع", "يد", "كنترولر", "controller", "console", "كونسول"
  ];

  if (gamingKeywords.some(k => combined.includes(k))) {
    return { shouldShow: false, label: "", note: "" };
  }

  const mobileKeywords = [
    "موبايل", "هاتف", "جوال", "تابلت", "ايباد", "آيفون", "ايفون", "سامسونج", "أندرويد", "اندرويد",
    "mobile", "phone", "tablet", "ipad", "iphone", "samsung", "android", "smartphone"
  ];

  const computerKeywords = [
    "لابتوب", "كمبيوتر", "حاسوب", "ماك بوك", "laptop", "pc", "macbook", "computer"
  ];

  if (mobileKeywords.some(k => combined.includes(k)) || computerKeywords.some(k => combined.includes(k))) {
    return {
      shouldShow: true,
      label: "رمز القفل / كلمة المرور (إن وجدت)",
      note: "يُستخدم فقط إذا احتاج الفني لفتح الجهاز أثناء الفحص."
    };
  }

  return { shouldShow: false, label: "", note: "" };
};

interface ReceptionProps {
  prefillData?: any;
  onNavigate?: (view: string, params?: any) => void;
}

export default function Reception({ prefillData, onNavigate }: ReceptionProps) {
  const dialog = useDialog();
  const { customers, addCustomer } = useCustomers();
  const { orders: repairOrders, addRepairOrder } = useRepairOrders();
  const { settings } = useSettings();

  // Dynamic Metadata hooks
  const { deviceTypes } = useDeviceTypes();
  const { deviceModels } = useDeviceModels();
  const { repairTemplates } = useRepairTemplates();

  // Customer type and state
  const [receptionCustomerType, setReceptionCustomerType] = useState<"GUEST" | "REGISTERED">("GUEST");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestAltPhone, setGuestAltPhone] = useState("");
  const [guestNote, setGuestNote] = useState("");

  // Search customer state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // New customer form state
  const [isAddingNewCustomer, setIsAddingNewCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustType, setNewCustType] = useState<CustomerType>(CustomerType.Individual);
  const [newCustNotes, setNewCustNotes] = useState("");

  // Custom Item Modal State for adding non-template item
  const [customItemModalIdx, setCustomItemModalIdx] = useState<number | null>(null);
  const [customItemName, setCustomItemName] = useState("");
  const [customItemCost, setCustomItemCost] = useState<number>(0);
  const [customItemPrice, setCustomItemPrice] = useState<number>(0);

  const handleSaveGuestAsRegistered = async () => {
    if (!guestName || !guestName.trim()) {
      await dialog.alert({ message: "يرجى كتابة اسم العميل الزائر أولاً", variant: "warning" });
      return;
    }
    if (!guestPhone || !guestPhone.trim()) {
      await dialog.alert({ message: "يرجى كتابة رقم هاتف العميل الزائر أولاً", variant: "warning" });
      return;
    }

    const normPhone = normalizePhoneNumber(guestPhone);
    const existing = customers.find(c => c.phone === normPhone || (c.phone && c.phone.includes(normPhone)));
    if (existing) {
      const useExisting = await dialog.confirm({
        title: "عميل مسجل موجود بالفعل",
        message: `يوجد عميل مسجل بالفعل بنفس رقم الهاتف: (${existing.name} - ${existing.phone}).\n\nهل ترغب في تحديد هذا العميل المسجل؟`,
        confirmText: "تحديد العميل المسجل",
        cancelText: "إلغاء"
      });
      if (useExisting) {
        setSelectedCustomer(existing);
        setReceptionCustomerType("REGISTERED");
        setGuestName("");
        setGuestPhone("");
        setGuestAltPhone("");
        setGuestNote("");
      }
      return;
    }

    try {
      const created = await addCustomer({
        name: guestName.trim(),
        phone: normPhone,
        type: CustomerType.Individual,
        notes: guestNote.trim() ? `عميل محول من زائر: ${guestNote.trim()}` : "عميل محول من زائر"
      });
      setSelectedCustomer(created);
      setReceptionCustomerType("REGISTERED");
      setGuestName("");
      setGuestPhone("");
      setGuestAltPhone("");
      setGuestNote("");
      await dialog.alert({ message: `تم حفظ العميل (${created.name}) كعميل دائم وتحديده بنجاح!`, variant: "success" });
    } catch (err: any) {
      await dialog.alert({ message: err.message || "تعذر حفظ العميل", variant: "error" });
    }
  };

  // Devices Array in Order
  const [devices, setDevices] = useState<Partial<RepairDevice>[]>([
    {
      type: undefined,
      model: "",
      serialNumber: "",
      color: "أبيض/أسود",
      accessories: "",
      issue: "",
      needsInspection: false,
      selectedRepairItems: [],
      estimatedCost: 0,
      partsCost: 0,
      laborCost: 0,
      status: RepairStatus.Received
    }
  ]);

  const [orderNotes, setOrderNotes] = useState("");
  const [advancePayment, setAdvancePayment] = useState(0);
  const [workOwnershipType, setWorkOwnershipType] = useState<WorkOwnershipType>(WorkOwnershipType.CUSTOMER_SHARED);
  const [partnerDeductionRate, setPartnerDeductionRate] = useState<number>(0);

  // Warranty System state
  const [warrantyOption, setWarrantyOption] = useState<WarrantyDurationOption>("DAYS_30");
  const [customWarrantyDays, setCustomWarrantyDays] = useState<number>(30);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Printing State
  const [printOrder, setPrintOrder] = useState<RepairOrder | undefined>(undefined);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Success Banner State
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [lastSavedOrder, setLastSavedOrder] = useState<RepairOrder | null>(null);
  const [lastSavedCustomer, setLastSavedCustomer] = useState<Customer | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Filter customers
  const query = searchQuery.trim().toLowerCase();
  const cleanPhoneQuery = normalizePhoneNumber(query);

  const filteredCustomers = !query
    ? customers
    : customers.filter(c => {
        const nameMatch = c.name ? c.name.toLowerCase().includes(query) : false;

        const phoneRawMatch = c.phone ? c.phone.toLowerCase().includes(query) : false;
        const phoneNormalizedMatch =
          cleanPhoneQuery.length > 0 && c.phone
            ? (c.phone.includes(cleanPhoneQuery) || normalizePhoneNumber(c.phone).includes(cleanPhoneQuery))
            : false;
        const phoneMatch = phoneRawMatch || phoneNormalizedMatch;

        const custCode = (c as any).code || (c as any).customerCode || c.id || '';
        const codeMatch = custCode ? custCode.toLowerCase().includes(query) : false;

        return nameMatch || phoneMatch || codeMatch;
      });

  const handleSelectCustomer = (cust: Customer) => {
    setSelectedCustomer(cust);
    setSearchQuery("");
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName || !newCustPhone) return;

    try {
      const normalized = normalizePhoneNumber(newCustPhone);
      const created = await addCustomer({
        name: newCustName,
        phone: normalized,
        type: newCustType,
        notes: newCustNotes
      });

      setSelectedCustomer(created);
      setIsAddingNewCustomer(false);
      setNewCustName("");
      setNewCustPhone("");
      setNewCustType(CustomerType.Individual);
      setNewCustNotes("");
      setSuccessMsg("تم تسجيل العميل الجديد واختياره بنجاح!");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      await dialog.alert({ message: err?.message || "حدث خطأ أثناء إضافة العميل", variant: "error" });
    }
  };

  const handleAddDeviceBlock = () => {
    setDevices([
      ...devices,
      {
        type: undefined,
        model: "",
        serialNumber: "",
        color: "أبيض/أسود",
        accessories: "",
        issue: "",
        needsInspection: false,
        selectedRepairItems: [],
        estimatedCost: 0,
        partsCost: 0,
        laborCost: 0,
        status: RepairStatus.Received
      }
    ]);
  };

  const handleRemoveDeviceBlock = async (idx: number) => {
    if (devices.length === 1) return;
    const confirmed = await dialog.confirm({
      title: "إزالة جهاز من طلب الاستقبال",
      message: "هل أنت متأكد من رغبتك في حذف هذا الجهاز وإزالته من أمر الاستقبال الحالي؟",
      variant: "warning",
      confirmText: "إزالة الجهاز"
    });
    if (confirmed) {
      setDevices(devices.filter((_, i) => i !== idx));
    }
  };

  const handleDeviceChange = (idx: number, field: keyof RepairDevice, value: any) => {
    const updated = [...devices];
    updated[idx] = { ...updated[idx], [field]: value };
    setDevices(updated);
  };

  // When Device Section / Category changes
  const handleDeviceTypeChange = (idx: number, typeVal: string) => {
    const updated = [...devices];
    updated[idx] = {
      ...updated[idx],
      type: typeVal as any,
      model: "",
      selectedRepairItems: [],
      estimatedCost: 0,
      partsCost: 0,
      laborCost: 0
    };
    setDevices(updated);
  };

  // When Device Model changes
  const handleDeviceModelChange = (idx: number, modelVal: string) => {
    const updated = [...devices];
    updated[idx] = {
      ...updated[idx],
      model: modelVal,
      selectedRepairItems: [],
      estimatedCost: 0,
      partsCost: 0,
      laborCost: 0
    };
    setDevices(updated);
  };

  // Toggle Template Item Selection
  const handleToggleTemplateItem = (deviceIdx: number, templateItem: any) => {
    const dev = devices[deviceIdx];
    const currentItems: SelectedRepairItem[] = dev.selectedRepairItems || [];
    const existsIndex = currentItems.findIndex(i => i.name === templateItem.nameAr || i.id === templateItem.id);

    let nextItems: SelectedRepairItem[] = [];
    if (existsIndex >= 0) {
      // Remove item
      nextItems = currentItems.filter((_, i) => i !== existsIndex);
    } else {
      // Add item
      nextItems = [
        ...currentItems,
        {
          id: templateItem.id,
          name: templateItem.nameAr,
          quantity: 1,
          costPrice: templateItem.defaultCostPrice || 0,
          repairPrice: templateItem.defaultRepairPrice || 0,
          productId: templateItem.productId
        }
      ];
    }

    const totalRepairPrice = nextItems.reduce((sum, item) => sum + (item.repairPrice * item.quantity), 0);
    const totalCostPrice = nextItems.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0);

    // Auto-update issue complaint summary if empty or based on selection
    const itemsSummary = nextItems.map(i => i.name).join(" + ");

    const updated = [...devices];
    updated[deviceIdx] = {
      ...updated[deviceIdx],
      selectedRepairItems: nextItems,
      estimatedCost: dev.needsInspection ? 0 : totalRepairPrice,
      partsCost: totalCostPrice,
      laborCost: Math.max(0, totalRepairPrice - totalCostPrice),
      issue: dev.issue && dev.issue.trim() !== "" ? dev.issue : itemsSummary
    };
    setDevices(updated);
  };

  // Add Custom Repair Item
  const handleAddCustomRepairItem = () => {
    if (customItemModalIdx === null) return;
    if (!customItemName.trim()) {
      dialog.alert({ message: "يرجى إدخال اسم عملية أو عطل الصيانة المخصص", variant: "warning" });
      return;
    }

    const dev = devices[customItemModalIdx];
    const currentItems: SelectedRepairItem[] = dev.selectedRepairItems || [];

    const newItem: SelectedRepairItem = {
      id: `custom_${Date.now()}`,
      name: customItemName.trim(),
      quantity: 1,
      costPrice: Number(customItemCost) || 0,
      repairPrice: Number(customItemPrice) || 0,
      isCustom: true
    };

    const nextItems = [...currentItems, newItem];
    const totalRepairPrice = nextItems.reduce((sum, item) => sum + (item.repairPrice * item.quantity), 0);
    const totalCostPrice = nextItems.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0);

    const updated = [...devices];
    updated[customItemModalIdx] = {
      ...updated[customItemModalIdx],
      selectedRepairItems: nextItems,
      estimatedCost: dev.needsInspection ? 0 : totalRepairPrice,
      partsCost: totalCostPrice,
      laborCost: Math.max(0, totalRepairPrice - totalCostPrice)
    };
    setDevices(updated);

    // Reset Modal
    setCustomItemModalIdx(null);
    setCustomItemName("");
    setCustomItemCost(0);
    setCustomItemPrice(0);
  };

  // Toggle "Needs Inspection" Mode
  const handleToggleNeedsInspection = (deviceIdx: number, value: boolean) => {
    const updated = [...devices];
    const dev = updated[deviceIdx];
    const totalRepairPrice = (dev.selectedRepairItems || []).reduce((sum, item) => sum + (item.repairPrice * item.quantity), 0);

    updated[deviceIdx] = {
      ...dev,
      needsInspection: value,
      status: value ? RepairStatus.Diagnosing : RepairStatus.Received,
      estimatedCost: value ? 0 : totalRepairPrice
    };
    setDevices(updated);
  };

  // Submit Order
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Customer Validation
    let finalCustomerName = "";
    let finalCustomerPhone = "";
    let finalCustomerId: string | undefined = undefined;

    if (receptionCustomerType === "REGISTERED") {
      if (!selectedCustomer) {
        setValidationError("يرجى اختيار عميل مسجل أو التبديل لنمط العميل الزائر.");
        return;
      }
      finalCustomerId = selectedCustomer.id;
      finalCustomerName = selectedCustomer.name;
      finalCustomerPhone = selectedCustomer.phone;
    } else {
      if (!guestName || !guestName.trim()) {
        setValidationError("يرجى كتابة اسم العميل الزائر.");
        return;
      }
      if (!guestPhone || !guestPhone.trim()) {
        setValidationError("يرجى كتابة رقم هاتف العميل الزائر.");
        return;
      }
      finalCustomerName = guestName.trim();
      finalCustomerPhone = normalizePhoneNumber(guestPhone);
    }

    // Devices Validation
    for (let i = 0; i < devices.length; i++) {
      const d = devices[i];
      if (!d.type) {
        setValidationError(`يرجى تحديد قسم/نوع الجهاز #${i + 1}`);
        return;
      }
      if (!d.model) {
        setValidationError(`يرجى تحديد موديل الجهاز #${i + 1}`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // Build final devices list
      const preparedDevices: RepairDevice[] = devices.map((d, index) => {
        const selectedItems = d.selectedRepairItems || [];
        const totalRepairPrice = selectedItems.reduce((sum, item) => sum + (item.repairPrice * item.quantity), 0);
        const totalCostPrice = selectedItems.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0);

        return {
          id: `DEV-${Date.now()}-${index}`,
          type: d.type!,
          model: d.model || "قياسي",
          serialNumber: d.serialNumber || "N/A",
          color: d.color || "أصلية",
          accessories: d.accessories || "بدون ملحقات",
          issue: d.issue || (selectedItems.length > 0 ? selectedItems.map(i => i.name).join(" + ") : "فحص ومعاينة شاملة"),
          reportedFaults: d.reportedFaults || d.selectedQuickFaults || [],
          technicalProcedures: selectedItems,
          needsInspection: d.needsInspection || false,
          selectedRepairItems: selectedItems,
          estimatedCost: d.needsInspection ? 0 : (d.estimatedCost || totalRepairPrice),
          partsCost: totalCostPrice,
          laborCost: Math.max(0, (d.estimatedCost || totalRepairPrice) - totalCostPrice),
          status: d.needsInspection ? RepairStatus.Diagnosing : RepairStatus.Received,
          devicePassword: d.devicePassword
        };
      });

      const totalEstimatedCost = preparedDevices.reduce((sum, dev) => sum + dev.estimatedCost, 0);

      console.log("=== Reception: Before save ===");
      console.log("Saving payload:", { finalCustomerId, finalCustomerName, finalCustomerPhone, totalEstimatedCost });

      const createdOrder = await addRepairOrder({
        customerId: finalCustomerId,
        customerName: finalCustomerName,
        customerPhone: finalCustomerPhone,
        customerType: receptionCustomerType === "REGISTERED" ? "REGISTERED" : "GUEST",
        guestCustomerName: receptionCustomerType === "GUEST" ? finalCustomerName : undefined,
        guestCustomerPhone: receptionCustomerType === "GUEST" ? finalCustomerPhone : undefined,
        guest_name: receptionCustomerType === "GUEST" ? finalCustomerName : undefined,
        guest_phone: receptionCustomerType === "GUEST" ? finalCustomerPhone : undefined,
        customer_name: finalCustomerName,
        customer_phone: finalCustomerPhone,
        customerNameSnapshot: finalCustomerName,
        customerPhoneSnapshot: finalCustomerPhone,
        customerAltPhone: guestAltPhone ? normalizePhoneNumber(guestAltPhone) : undefined,
        devices: preparedDevices,
        totalEstimatedCost,
        isPaid: false,
        notes: orderNotes ? `${guestNote ? guestNote + " | " : ""}${orderNotes}` : (guestNote || undefined),
        advancePayment: Number(advancePayment) || 0,
        workOwnershipType,
        partnerDeductionRate,
        warrantyOption,
        warrantyDays: warrantyOption === "CUSTOM" ? customWarrantyDays : undefined,
        status: preparedDevices.some(d => d.needsInspection) ? RepairStatus.Diagnosing : RepairStatus.Received
      });

      console.log("=== Reception: After Supabase insert ===");
      console.log("=== Reception: Returned order ===", createdOrder);
      console.log("=== Reception: Dispatch event ===");

      setLastSavedOrder(createdOrder);
      setLastSavedCustomer(selectedCustomer || {
        id: "GUEST",
        name: finalCustomerName,
        phone: finalCustomerPhone,
        type: CustomerType.Individual,
        createdAt: new Date().toISOString(),
        balance: 0
      });

      // Send WhatsApp Notification after successful DB save
      const waRes = await sendRepairNotificationWorkflow({
        template: "REPAIR_ORDER_CREATED",
        order: createdOrder,
        customerName: finalCustomerName,
        customerPhone: finalCustomerPhone
      });

      if (!waRes.success) {
        setSuccessMsg("تم حفظ العملية ولكن تعذر إرسال رسالة واتساب.");
      } else {
        setSuccessMsg("تم حفظ أمر الاستلام بنجاح!");
      }

      // Reset Form for next order
      setGuestName("");
      setGuestPhone("");
      setGuestAltPhone("");
      setGuestNote("");
      setSelectedCustomer(null);
      setOrderNotes("");
      setAdvancePayment(0);
      setDevices([
        {
          type: undefined,
          model: "",
          serialNumber: "",
          color: "أبيض/أسود",
          accessories: "",
          issue: "",
          needsInspection: false,
          selectedRepairItems: [],
          estimatedCost: 0,
          partsCost: 0,
          laborCost: 0,
          status: RepairStatus.Received
        }
      ]);
    } catch (err: any) {
      await dialog.alert({ message: err?.message || "حدث خطأ أثناء حفظ أمر الاستلام", variant: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 text-right">
      {/* Top Header Banner */}
      <div className="bg-gradient-to-r from-indigo-950 via-[#181b2f] to-[#11131e] border border-indigo-500/30 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Wrench className="w-6 h-6 text-indigo-400 animate-pulse" />
            استلام أجهزة الصيانة (سير العمل السريع)
          </h2>
          <p className="text-gray-400 text-xs mt-1">
            حدد قسم وموديل الجهاز لاختيار عناصر وقوالب الصيانة المعالجة فورياً بدون حقول زائدة
          </p>
        </div>
      </div>

      {/* Success Notification Banner */}
      {lastSavedOrder && (
        <div className="bg-emerald-950/80 border border-emerald-500/50 p-5 rounded-2xl space-y-3 shadow-xl">
          <div className="flex justify-between items-center border-b border-emerald-500/30 pb-3">
            <span className="text-sm font-bold text-emerald-300 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              تم تسجيل أمر الصيانة بنجاح برقم: <span className="font-mono text-white text-base">#{lastSavedOrder.id}</span>
            </span>
            <button
              onClick={() => {
                setLastSavedOrder(null);
                setLastSavedCustomer(null);
              }}
              className="text-gray-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setPrintOrder(lastSavedOrder);
                setIsPrintModalOpen(true);
              }}
              className="bg-amber-600 hover:bg-amber-500 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-2 transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              طباعة إيصال الاستلام
            </button>

            <button
              type="button"
              onClick={() => onNavigate?.("repair-center", { orderId: lastSavedOrder.id })}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-2 transition cursor-pointer"
            >
              <Edit className="w-4 h-4" />
              الانتقال إلى مركز الصيانة للفحص والتنفيذ
            </button>
          </div>
        </div>
      )}

      {validationError && (
        <div className="bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs py-3 px-4 rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          <span>{validationError}</span>
        </div>
      )}

      <form onSubmit={handleSubmitOrder} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Customer Selection */}
        <div className="bg-[#11131e] border border-[#2a2d42] p-5 rounded-2xl space-y-4 h-fit">
          <h3 className="text-md font-bold text-white flex items-center gap-2 border-b border-[#2a2d42] pb-3">
            <User className="w-5 h-5 text-indigo-400" />
            بيانات العميل المستلم منه
          </h3>

          {/* Customer Type Toggle */}
          <div className="grid grid-cols-2 gap-2 bg-[#181a29] p-1.5 rounded-xl border border-[#2a2d42]">
            <button
              type="button"
              onClick={() => {
                setReceptionCustomerType("GUEST");
                setSelectedCustomer(null);
              }}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                receptionCustomerType === "GUEST"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              زائر (سريع)
            </button>

            <button
              type="button"
              onClick={() => setReceptionCustomerType("REGISTERED")}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                receptionCustomerType === "REGISTERED"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              عميل مسجل
            </button>
          </div>

          {/* Guest Customer Inputs */}
          {receptionCustomerType === "GUEST" && (
            <div className="space-y-3 bg-[#161827] p-3.5 rounded-xl border border-[#2a2d42]">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                  <UserPlus className="w-3.5 h-3.5" />
                  بيانات العميل الزائر
                </span>
                <button
                  type="button"
                  onClick={handleSaveGuestAsRegistered}
                  className="text-[10px] bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-md font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <UserCheck className="w-3 h-3" />
                  حفظ كعميل دائم
                </button>
              </div>

              <div>
                <label className="text-[11px] text-gray-300 block mb-1">اسم العميل *</label>
                <input
                  type="text"
                  required
                  placeholder="اسم العميل الزائر..."
                  value={guestName}
                  onChange={e => setGuestName(e.target.value)}
                  className="w-full bg-[#11131e] border border-[#2a2d42] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
                />
              </div>

              <div>
                <label className="text-[11px] text-gray-300 block mb-1">رقم الهاتف الرئيسي *</label>
                <input
                  type="tel"
                  required
                  placeholder="01xxxxxxxxx"
                  value={guestPhone}
                  onChange={e => setGuestPhone(e.target.value)}
                  className="w-full bg-[#11131e] border border-[#2a2d42] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono text-left"
                  style={{ direction: "ltr" }}
                />
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">رقم هاتف إضافي (اختياري)</label>
                <input
                  type="tel"
                  placeholder="01xxxxxxxxx"
                  value={guestAltPhone}
                  onChange={e => setGuestAltPhone(e.target.value)}
                  className="w-full bg-[#11131e] border border-[#2a2d42] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono text-left"
                  style={{ direction: "ltr" }}
                />
              </div>
            </div>
          )}

          {/* Registered Customer Search & Select */}
          {receptionCustomerType === "REGISTERED" && (
            <div className="space-y-3">
              {selectedCustomer ? (
                <div className="bg-indigo-950/40 border border-indigo-500/30 p-3.5 rounded-xl space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-sm font-bold text-white">{selectedCustomer.name}</h4>
                      <p className="text-xs text-indigo-300 font-mono">{selectedCustomer.phone}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedCustomer(null)}
                      className="text-xs text-rose-400 hover:text-rose-300 cursor-pointer"
                    >
                      تغيير
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-4 h-4 text-gray-400 absolute right-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="ابحث باسم العميل أو رقم الهاتف..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full bg-[#181a29] border border-[#2a2d42] rounded-xl pr-9 pl-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
                    />
                  </div>

                  {filteredCustomers.length > 0 ? (
                    <div className="max-h-40 overflow-y-auto bg-[#161827] border border-[#2a2d42] rounded-xl divide-y divide-[#2a2d42]">
                      {filteredCustomers.map(cust => (
                        <div
                          key={cust.id}
                          onClick={() => handleSelectCustomer(cust)}
                          className="p-2.5 hover:bg-indigo-600/20 cursor-pointer transition flex justify-between items-center text-xs"
                        >
                          <span className="font-bold text-white">{cust.name}</span>
                          <span className="font-mono text-gray-400">{cust.phone}</span>
                        </div>
                      ))}
                    </div>
                  ) : searchQuery.trim() ? (
                    <div className="bg-[#161827] border border-[#2a2d42] rounded-xl p-3 text-center text-xs text-gray-400">
                      لا يوجد عميل مطابق
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}

          {/* Order Financials & Ownership */}
          <div className="pt-2 space-y-3 border-t border-[#2a2d42]">
            <div>
              <label className="text-xs font-bold text-gray-300 block mb-1">الدفعة المقدمة / العربون (ج.م):</label>
              <input
                type="number"
                min="0"
                value={advancePayment}
                onChange={e => setAdvancePayment(Number(e.target.value))}
                className="w-full bg-[#181a29] border border-[#2a2d42] rounded-xl px-3 py-2 text-xs text-emerald-400 font-bold focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-300 block mb-1">ملاحظات عامة على الطلب:</label>
              <textarea
                rows={2}
                placeholder="أي توجيهات أو ملاحظات خاصة بالاستلام..."
                value={orderNotes}
                onChange={e => setOrderNotes(e.target.value)}
                className="w-full bg-[#181a29] border border-[#2a2d42] rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Devices & Dynamic Template Repair Selection */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-[#11131e] border border-[#2a2d42] p-5 rounded-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-[#2a2d42] pb-3">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-indigo-400" />
                بيانات الاستلام وقوالب الصيانة ({devices.length})
              </h3>
              <button
                type="button"
                onClick={handleAddDeviceBlock}
                className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-1.5 px-3 rounded-xl flex items-center gap-1 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                إضافة جهاز آخر للطلب
              </button>
            </div>

            {/* Devices Loop */}
            <div className="space-y-6">
              {devices.map((device, index) => {
                // Find selected category object (matching by ID first, then nameAr/nameEn as fallback)
                const selectedTypeObj = deviceTypes.find(t => t.id === device.type || t.nameAr === device.type || t.nameEn === device.type);
                const selectedCategoryId = selectedTypeObj ? selectedTypeObj.id : device.type;

                // Filter models strictly by category ID (and not archived)
                const filteredModelsList = selectedCategoryId
                  ? deviceModels.filter(m => (m.deviceTypeId === selectedCategoryId || m.categoryId === selectedCategoryId) && !m.isArchived)
                  : [];

                // Find selected model object
                const selectedModelObj = deviceModels.find(m => m.id === device.model || m.nameAr === device.model);
                const selectedModelId = selectedModelObj ? selectedModelObj.id : device.model;

                // Filter repair templates strictly by selected model ID
                const filteredTemplates = repairTemplates.filter(t => {
                  if (t.isActive === false) return false;

                  // 1. Primary: Match by Model ID
                  if (selectedModelId) {
                    if (t.deviceModelId === selectedModelId || t.modelId === selectedModelId) {
                      return true;
                    }
                  }

                  // 2. Fallback: If template has no specific model assigned, match by Category ID
                  if (!t.deviceModelId && !t.modelId && selectedCategoryId) {
                    if (t.deviceTypeId === selectedCategoryId || t.categoryId === selectedCategoryId) {
                      return true;
                    }
                  }

                  return false;
                });

                const lockCodeConfig = getLockCodeConfig(selectedTypeObj?.nameAr || device.type || "", selectedModelObj?.nameAr || device.model || "");

                return (
                  <div
                    key={index}
                    className="bg-[#161827] border border-[#2a2d42] p-4 rounded-2xl space-y-4 relative"
                  >
                    <div className="flex justify-between items-center border-b border-[#2a2d42] pb-2">
                      <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-indigo-400" />
                        الجهاز #{index + 1}
                      </span>
                      {devices.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveDeviceBlock(index)}
                          className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Step 1 & 2: Section and Model Selection */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-gray-300 block mb-1">1. اختر القسم (Category) *</label>
                        <select
                          required
                          value={device.type || ""}
                          onChange={e => handleDeviceTypeChange(index, e.target.value)}
                          className="w-full bg-[#11131e] border border-[#2a2d42] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
                        >
                          <option value="">-- اختر القسم --</option>
                          {deviceTypes.filter(t => !t.isArchived).map(type => (
                            <option key={type.id} value={type.id}>
                              {type.nameAr} {type.brand ? `(${type.brand})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-gray-300 block mb-1">2. اختر الموديل *</label>
                        <select
                          required
                          disabled={!device.type}
                          value={device.model || ""}
                          onChange={e => handleDeviceModelChange(index, e.target.value)}
                          className="w-full bg-[#11131e] border border-[#2a2d42] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold disabled:opacity-50"
                        >
                          <option value="">-- اختر الموديل --</option>
                          {filteredModelsList.map(m => (
                            <option key={m.id} value={m.id}>
                              {m.nameAr} {m.modelCode ? `(${m.modelCode})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Step 3: Repair Template Items Selection */}
                    {device.type && (
                      <div className="bg-[#11131e] border border-[#2a2d42] p-3.5 rounded-xl space-y-3">
                        <div className="flex flex-wrap justify-between items-center gap-2">
                          <label className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                            <Wrench className="w-4 h-4 text-indigo-400" />
                            <span>قالب عناصر الصيانة لـ ({selectedTypeObj ? selectedTypeObj.nameAr : (device.type || "عام")}{selectedModelObj ? ` - ${selectedModelObj.nameAr}` : ''}):</span>
                          </label>

                          <button
                            type="button"
                            onClick={() => setCustomItemModalIdx(index)}
                            className="text-[11px] bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>إضافة بند صيانة مخصص</span>
                          </button>
                        </div>

                        {/* Template Chips */}
                        {filteredTemplates.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {filteredTemplates.map((template) => {
                              const isSelected = (device.selectedRepairItems || []).some(i => i.name === template.nameAr);
                              return (
                                <button
                                  key={template.id}
                                  type="button"
                                  onClick={() => handleToggleTemplateItem(index, template)}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                                    isSelected
                                      ? "bg-indigo-600 text-white border-indigo-400 shadow-md scale-105"
                                      : "bg-[#181a29] text-gray-300 border-[#2a2d42] hover:border-indigo-500/50 hover:text-white"
                                  }`}
                                >
                                  <span>{template.nameAr}</span>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${isSelected ? "bg-indigo-700 text-white" : "bg-[#11131e] text-indigo-300"}`}>
                                    {template.defaultRepairPrice} ج.م
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 italic">
                            لا توجد عناصر جاهزة بالقالب لهذا القسم. يمكنك استخدام زر "إضافة بند صيانة مخصص".
                          </p>
                        )}

                        {/* Selected Repair Items Summary Table */}
                        {(device.selectedRepairItems || []).length > 0 && (
                          <div className="bg-[#181a29] border border-[#2a2d42] rounded-xl p-3 space-y-2 mt-2">
                            <span className="text-[11px] font-bold text-gray-300 block">العناصر والعمليات المختارة:</span>
                            <div className="space-y-1.5">
                              {(device.selectedRepairItems || []).map((item, itemIdx) => (
                                <div key={itemIdx} className="flex justify-between items-center text-xs bg-[#11131e] p-2 rounded-lg border border-[#2a2d42]">
                                  <span className="font-bold text-white flex items-center gap-1">
                                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                                    {item.name}
                                  </span>
                                  <span className="font-bold text-emerald-400">
                                    {item.repairPrice} ج.م
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Step 4: Needs Inspection Toggle Mode */}
                    <div className="bg-[#11131e] border border-amber-500/30 p-3 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <SearchCode className="w-5 h-5 text-amber-400" />
                        <div>
                          <span className="text-xs font-bold text-amber-300 block">تحويل الجهاز للفحص المعمق (Needs Inspection)</span>
                          <span className="text-[10px] text-gray-400 block">عند التفعيل، تكون حالة الجهاز "تحت الفحص" ولا تُخصم أي قطع من المخزون حتى اعتماد الفني</span>
                        </div>
                      </div>

                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={device.needsInspection || false}
                          onChange={e => handleToggleNeedsInspection(index, e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                      </label>
                    </div>

                    {/* Basic Receipt Data ONLY */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-[#2a2d42]">
                      <div>
                        <label className="text-[11px] text-gray-300 block mb-1">الرقم التسلسلي (Serial Number):</label>
                        <input
                          type="text"
                          placeholder="مثال: 03-27452819-..."
                          value={device.serialNumber || ""}
                          onChange={e => handleDeviceChange(index, "serialNumber", e.target.value)}
                          className="w-full bg-[#11131e] border border-[#2a2d42] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono text-left"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] text-gray-300 block mb-1">اللون والمظهر العام:</label>
                        <input
                          type="text"
                          placeholder="أبيض / أسود / أحمر..."
                          value={device.color || ""}
                          onChange={e => handleDeviceChange(index, "color", e.target.value)}
                          className="w-full bg-[#11131e] border border-[#2a2d42] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      {lockCodeConfig.shouldShow && (
                        <div>
                          <label className="text-[11px] text-amber-300 block mb-1">{lockCodeConfig.label}</label>
                          <input
                            type="text"
                            placeholder="رمز الفتح أو النمط..."
                            value={device.devicePassword || ""}
                            onChange={e => handleDeviceChange(index, "devicePassword", e.target.value)}
                            className="w-full bg-[#11131e] border border-amber-500/30 rounded-xl px-3 py-2 text-xs text-amber-200 font-mono focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      )}

                      <div className={lockCodeConfig.shouldShow ? "" : "md:col-span-2"}>
                        <label className="text-[11px] text-gray-300 block mb-1">ملاحظات العميل وشرح العطل:</label>
                        <input
                          type="text"
                          placeholder="مثال: فصل مفاجئ، لمبة حمراء، الصوت مكتوم..."
                          value={device.issue || ""}
                          onChange={e => handleDeviceChange(index, "issue", e.target.value)}
                          className="w-full bg-[#11131e] border border-[#2a2d42] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    {/* Cost & Price Summary for this Device */}
                    {!device.needsInspection && (
                      <div className="bg-[#11131e] border border-[#2a2d42] p-3 rounded-xl flex justify-between items-center text-xs">
                        <span className="text-gray-400">إجمالي تكلفة صيانة هذا الجهاز المتوقعة:</span>
                        <span className="text-sm font-bold text-emerald-400">
                          {device.estimatedCost || 0} ج.م
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Submit Order Button */}
            <div className="pt-4 border-t border-[#2a2d42]">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3.5 px-6 rounded-2xl text-sm flex items-center justify-center gap-2 transition shadow-xl cursor-pointer"
              >
                <Save className="w-5 h-5" />
                <span>{isSubmitting ? "جاري حفظ أمر الاستلام..." : "حفظ أمر صيانة الجهاز بالكامل"}</span>
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Modal for adding custom non-template repair item */}
      {customItemModalIdx !== null && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#11131e] border border-[#2a2d42] rounded-2xl p-5 max-w-md w-full space-y-4 text-right">
            <div className="flex justify-between items-center border-b border-[#2a2d42] pb-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" />
                إضافة بند / عملية صيانة مخصصة
              </h4>
              <button
                type="button"
                onClick={() => setCustomItemModalIdx(null)}
                className="text-gray-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-300 block mb-1">اسم العطل / الخدمة المخصصة:</label>
                <input
                  type="text"
                  placeholder="مثال: تغيير مسار نحاسي، تعديل بوردة..."
                  value={customItemName}
                  onChange={e => setCustomItemName(e.target.value)}
                  className="w-full bg-[#181a29] border border-[#2a2d42] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-300 block mb-1">التكلفة (ج.م):</label>
                  <input
                    type="number"
                    min="0"
                    value={customItemCost}
                    onChange={e => setCustomItemCost(Number(e.target.value))}
                    className="w-full bg-[#181a29] border border-[#2a2d42] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-300 block mb-1">سعر الخدمة للعميل:</label>
                  <input
                    type="number"
                    min="0"
                    value={customItemPrice}
                    onChange={e => setCustomItemPrice(Number(e.target.value))}
                    className="w-full bg-[#181a29] border border-[#2a2d42] rounded-xl px-3 py-2 text-xs text-emerald-400 focus:outline-none focus:border-indigo-500 font-bold"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleAddCustomRepairItem}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Check className="w-4 h-4" />
                تأكيد الإضافة للجهاز
              </button>
              <button
                type="button"
                onClick={() => setCustomItemModalIdx(null)}
                className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-2.5 px-4 rounded-xl text-xs transition cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Receipt Modal */}
      {isPrintModalOpen && printOrder && (
        <PrintReceiptModal
          order={printOrder}
          customer={lastSavedCustomer || undefined}
          settings={settings}
          isOpen={isPrintModalOpen}
          onClose={() => {
            setIsPrintModalOpen(false);
            setPrintOrder(undefined);
          }}
        />
      )}
    </div>
  );
}
