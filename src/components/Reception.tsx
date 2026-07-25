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
  Scan,
  X,
  Upload,
  UserPlus,
  UserCheck,
  DollarSign
} from "lucide-react";
import { 
  useCustomers, 
  useRepairOrders, 
  useSettings, 
  useDeviceTypes, 
  useDeviceModels, 
  useCommonFaults, 
  useDefaultPrices,
  useReceivedAccessories,
  useDeviceConditions
} from "../hooks/useData";
import { Customer, CustomerType, DeviceType, RepairStatus, RepairDevice, RepairOrder, WorkOwnershipType, WarrantyDurationOption } from "../types";
import { normalizePhoneNumber, formatPhoneDisplay } from "../utils/phone";
import { PhoneDisplay } from "./PhoneDisplay";
import { getCustomerNameHelper, getCustomerPhoneHelper } from "../lib/customerDisplayHelper";
import PrintReceiptModal from "./PrintReceiptModal";

export interface QuickFaultItem {
  id: string;
  label: string;
  defaultSellingPrice: number;
}

export const QUICK_FAULTS_LIST: QuickFaultItem[] = [
  { id: "no_fault", label: "لا توجد أعطال ظاهرية", defaultSellingPrice: 0 },
  { id: "internal_cleaning", label: "تنظيف داخلي فقط", defaultSellingPrice: 200 },
  { id: "cleaning_thermal_paste", label: "تنظيف وتغيير معجون", defaultSellingPrice: 350 },
  { id: "no_power", label: "لا يعمل نهائياً", defaultSellingPrice: 600 },
  { id: "shuts_off", label: "يفصل بعد التشغيل", defaultSellingPrice: 500 },
  { id: "overheating", label: "يسخن بسرعة", defaultSellingPrice: 300 },
  { id: "no_display", label: "لا يعرض صورة", defaultSellingPrice: 450 },
  { id: "hdd_issue", label: "لا يقرأ الهارد", defaultSellingPrice: 300 },
  { id: "hdmi_issue", label: "مشكلة في HDMI", defaultSellingPrice: 500 },
  { id: "usb_issue", label: "مشكلة في USB", defaultSellingPrice: 300 },
  { id: "audio_issue", label: "لا يخرج صوت", defaultSellingPrice: 350 },
  { id: "network_issue", label: "لا يتصل بالإنترنت", defaultSellingPrice: 350 },
  { id: "controller_charge", label: "لا يشحن اليد", defaultSellingPrice: 200 },
  { id: "bluetooth_issue", label: "مشكلة في البلوتوث", defaultSellingPrice: 300 },
  { id: "loud_fan", label: "مروحة مرتفعة الصوت", defaultSellingPrice: 250 },
  { id: "lag_slowness", label: "تهنيج أو بطء", defaultSellingPrice: 250 },
  { id: "auto_restart", label: "إعادة تشغيل تلقائية", defaultSellingPrice: 400 },
  { id: "drop_impact", label: "سقوط أو صدمة", defaultSellingPrice: 400 },
  { id: "liquid_damage", label: "آثار سوائل أو رطوبة", defaultSellingPrice: 500 },
  { id: "opened_elsewhere", label: "تم فتحه في مركز صيانة آخر", defaultSellingPrice: 0 },
  { id: "missing_screws", label: "الجهاز مفكوك أو ناقص مسامير", defaultSellingPrice: 0 },
  { id: "case_damage", label: "كسر أو خدش في الهيكل", defaultSellingPrice: 0 },
  { id: "other", label: "أخرى...", defaultSellingPrice: 0 }
];

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
  const { commonFaults } = useCommonFaults();
  const { defaultPrices } = useDefaultPrices();
  const { receivedAccessories } = useReceivedAccessories();
  const { deviceConditions } = useDeviceConditions();

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
  const [scanDeviceIndex, setScanDeviceIndex] = useState<number | null>(null);
  const [devices, setDevices] = useState<Partial<RepairDevice>[]>([
    {
      type: undefined,
      model: "",
      serialNumber: "",
      color: "أبيض/أسود",
      accessories: "",
      issue: "",
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
  const [isWarrantyClaim, setIsWarrantyClaim] = useState<boolean>(false);
  const [parentOrderId, setParentOrderId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Active warranty check for selected customer
  const activeWarrantyOrders = useMemo(() => {
    if (!selectedCustomer) return [];
    return repairOrders.filter(o => 
      o.customerId === selectedCustomer.id && 
      (o.warrantyStatus === "IN_WARRANTY" || (o.warrantyEndDate && new Date(o.warrantyEndDate).getTime() > Date.now()))
    );
  }, [selectedCustomer, repairOrders]);

  const handleWorkOwnershipChange = (type: WorkOwnershipType) => {
    setWorkOwnershipType(type);
    if (type === WorkOwnershipType.PARTNER_2_PRIVATE) {
      setPartnerDeductionRate(25);
    } else {
      setPartnerDeductionRate(0);
    }
  };

  // Printing State
  const [printOrder, setPrintOrder] = useState<RepairOrder | undefined>(undefined);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Success and Post-Save Banner State
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [lastSavedOrder, setLastSavedOrder] = useState<RepairOrder | null>(null);
  const [lastSavedCustomer, setLastSavedCustomer] = useState<Customer | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Filter customers
  const filteredCustomers = searchQuery.trim()
    ? customers.filter(
        c =>
          c.name.includes(searchQuery) ||
          c.phone.includes(normalizePhoneNumber(searchQuery))
      )
    : [];

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
      // Reset inputs
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
      message: "هل أنت متأكد من رغبتك في حذف هذا الجهاز وإزالته من أمر الاستقبال الحالي؟ سيتم إعادة احتساب التكاليف الإجمالية للطلب.",
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

  // Dynamic dropdown change: Device Type selected -> filter models & suggest prices
  const handleDeviceTypeChange = (idx: number, typeName: string) => {
    // Find the corresponding device type object in the DB
    const selectedTypeObj = deviceTypes.find(t => t.nameAr === typeName || t.nameEn === typeName);
    const typeId = selectedTypeObj ? selectedTypeObj.id : "";

    const updated = [...devices];
    updated[idx] = {
      ...updated[idx],
      type: typeName as any,
      model: "", // reset model
      issue: "", // reset issue
      estimatedCost: 0
    };
    setDevices(updated);
  };

  // Dynamic dropdown change: Model selected -> auto suggest inspection & repair prices
  const handleDeviceModelChange = (idx: number, modelName: string) => {
    const updated = [...devices];
    const devBlock = updated[idx];

    // Find the model object
    const modelObj = deviceModels.find(m => m.nameAr === modelName || m.nameEn === modelName);
    const suggestedPrice = modelObj ? modelObj.defaultRepairPrice : 0;

    updated[idx] = {
      ...devBlock,
      model: modelName,
      estimatedCost: suggestedPrice,
      laborCost: modelObj ? Math.round(suggestedPrice * 0.6) : 0,
      partsCost: modelObj ? Math.round(suggestedPrice * 0.4) : 0
    };
    setDevices(updated);
  };

  // Dynamic dropdown change: Common Fault selected -> prefill fault description & look up pricing matrix
  const handleFaultChange = (idx: number, faultId: string) => {
    if (!faultId) return;
    const faultObj = commonFaults.find(f => f.id === faultId);
    if (!faultObj) return;

    const updated = [...devices];
    const devBlock = updated[idx];

    // Attempt to lookup customized pricing in DefaultPrices based on device type & customer type
    let finalSuggestedPrice = faultObj.defaultRepairPrice;
    
    if (selectedCustomer) {
      const customPriceMatch = defaultPrices.find(
        p => p.deviceTypeId === faultObj.deviceTypeId && 
             p.commonFaultId === faultId && 
             p.customerType === selectedCustomer.type
      );
      if (customPriceMatch) {
        finalSuggestedPrice = customPriceMatch.defaultRepairPrice;
      }
    }

    updated[idx] = {
      ...devBlock,
      issue: faultObj.nameAr,
      estimatedCost: finalSuggestedPrice,
      laborCost: Math.round(finalSuggestedPrice * 0.6),
      partsCost: Math.round(finalSuggestedPrice * 0.4)
    };
    setDevices(updated);
  };

  // Quick select accessories
  const handleToggleAccessory = (idx: number, accName: string) => {
    const currentAccStr = devices[idx].accessories || "";
    const currentAccs = currentAccStr.split("، ").filter(Boolean);
    
    let newAccs = [];
    if (currentAccs.includes(accName)) {
      newAccs = currentAccs.filter(a => a !== accName);
    } else {
      newAccs = [...currentAccs, accName];
    }

    handleDeviceChange(idx, "accessories", newAccs.join("، "));
  };

  // Quick select condition appearance
  const handleToggleCondition = (idx: number, condName: string) => {
    const currentIssueStr = devices[idx].color || ""; // we store outer conditions in color field or as notes
    const currentConds = currentIssueStr.split("، ").filter(Boolean);

    let newConds = [];
    if (currentConds.includes(condName)) {
      newConds = currentConds.filter(c => c !== condName);
    } else {
      newConds = [...currentConds, condName];
    }

    handleDeviceChange(idx, "color", newConds.join("، "));
  };

  // Calculate suggested repair price from array of fault labels
  const calculateSuggestedPriceForFaults = (faultLabels: string[]): number => {
    return faultLabels.reduce((sum, label) => {
      const match = QUICK_FAULTS_LIST.find(f => f.label === label);
      return sum + (match ? match.defaultSellingPrice : 0);
    }, 0);
  };

  // Quick select issue tag with automatic sum calculation & manual edit preservation
  const handleToggleIssueTag = (idx: number, tagName: string) => {
    if (tagName === "أخرى...") return;
    const devBlock = devices[idx] || {};
    const currentIssueStr = devBlock.issue || "";
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

    const newSuggestedPrice = calculateSuggestedPriceForFaults(newTags);
    const updatedDevices = [...devices];

    if (devBlock.isPriceManuallyEdited) {
      // User manually modified price -> keep custom final price, but record new suggested price & faults
      updatedDevices[idx] = {
        ...devBlock,
        issue: newTags.join(" - "),
        selectedQuickFaults: newTags,
        suggestedRepairPrice: newSuggestedPrice,
        priceOverrideAcknowledged: false // reset acknowledgment to notify user if price differs
      };
    } else {
      // Auto-update both suggested and final repair price
      updatedDevices[idx] = {
        ...devBlock,
        issue: newTags.join(" - "),
        selectedQuickFaults: newTags,
        suggestedRepairPrice: newSuggestedPrice,
        finalRepairPrice: newSuggestedPrice,
        estimatedCost: newSuggestedPrice
      };
    }

    setDevices(updatedDevices);
  };

  // Handle user typing a custom price manually
  const handleManualPriceChange = (idx: number, newPrice: number) => {
    const updatedDevices = [...devices];
    const devBlock = updatedDevices[idx] || {};
    updatedDevices[idx] = {
      ...devBlock,
      finalRepairPrice: newPrice,
      estimatedCost: newPrice,
      isPriceManuallyEdited: true,
      priceOverrideAcknowledged: false
    };
    setDevices(updatedDevices);
  };

  // Reset price to auto-suggested sum when requested
  const handleResetPriceToSuggested = (idx: number) => {
    const updatedDevices = [...devices];
    const devBlock = updatedDevices[idx] || {};
    const sug = devBlock.suggestedRepairPrice ?? 0;
    updatedDevices[idx] = {
      ...devBlock,
      finalRepairPrice: sug,
      estimatedCost: sug,
      isPriceManuallyEdited: false,
      priceOverrideAcknowledged: true
    };
    setDevices(updatedDevices);
  };

  // Keep current manual custom price
  const handleKeepManualPrice = (idx: number) => {
    const updatedDevices = [...devices];
    const devBlock = updatedDevices[idx] || {};
    updatedDevices[idx] = {
      ...devBlock,
      priceOverrideAcknowledged: true
    };
    setDevices(updatedDevices);
  };

  // Click to Chat message generator
  const triggerWhatsAppMsg = (order: RepairOrder, customer: Customer) => {
    const trackingLink = `https://atari-store-pro-x.web.app/track?orderId=${order.id}`;
    const remaining = order.totalEstimatedCost - order.advancePayment;

    let devicesListText = order.devices
      .map(
        (d, i) =>
          `${i + 1}. جهاز ${d.type} (${d.model})\n   - العطل: ${d.issue}\n   - التكلفة التقديرية: ${d.estimatedCost} ج.م\n   - كود الصيانة: ${order.id}-${i + 1}`
      )
      .join("\n\n");

    let msg = `تم استلام أجهزة صيانة - Atari Store Pro X 🛠️

العميل العزيز: ${customer.name}

يسعدنا إبلاغك بأنه تم استقبال طلب الصيانة الخاص بك برقم دفعة: ${order.id} ويحتوي على الأجهزة التالية:

${devicesListText}

إجمالي التكلفة التقديرية: ${order.totalEstimatedCost} ج.م
المدفوع مقدمًا: ${order.advancePayment} ج.م
المتبقي: ${remaining} ج.م

رابط التتبع الموحد لأجهزتك:
${trackingLink}`;

    const formattedPhone = normalizePhoneNumber(customer.phone);
    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  const handleSaveOrder = () => {
    setValidationError(null);
    setSuccessMsg(null);

    if (isSubmitting) return;

    const isGuest = receptionCustomerType === "GUEST";

    if (isGuest) {
      if (!guestName || !guestName.trim()) {
        setValidationError("⚠️ الرجاء إدخال اسم العميل الزائر أولاً لحفظ طلب الصيانة!");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      if (!guestPhone || !guestPhone.trim()) {
        setValidationError("⚠️ الرجاء إدخال رقم هاتف العميل الزائر لحفظ طلب الصيانة!");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
    } else {
      if (!selectedCustomer) {
        setValidationError("⚠️ الرجاء تحديد عميل مسجل أولاً من القائمة أو إضافة عميل دائم جديد!");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
    }

    setIsSubmitting(true);

    // Calculate Warranty Days based on selection
    let calculatedWarrantyDays = 0;
    switch (warrantyOption) {
      case "NO_WARRANTY": calculatedWarrantyDays = 0; break;
      case "DAYS_7": calculatedWarrantyDays = 7; break;
      case "DAYS_15": calculatedWarrantyDays = 15; break;
      case "DAYS_30": calculatedWarrantyDays = 30; break;
      case "DAYS_60": calculatedWarrantyDays = 60; break;
      case "DAYS_90": calculatedWarrantyDays = 90; break;
      case "DAYS_180": calculatedWarrantyDays = 180; break;
      case "YEAR_1": calculatedWarrantyDays = 365; break;
      case "CUSTOM": calculatedWarrantyDays = Math.max(0, Number(customWarrantyDays) || 0); break;
      default: calculatedWarrantyDays = 30;
    }

    // Map Partial Devices with safe fallback defaults so it never fails
    const completeDevices: RepairDevice[] = devices.map((d, index) => {
      const typeStr = d.type || (deviceTypes[0]?.nameAr ? (deviceTypes[0].nameAr as DeviceType) : DeviceType.PS5);
      const modelStr = d.model?.trim() || "موديل قياسي";
      const issueStr = d.issue?.trim() || "فحص ومعاينة الكشف العام";
      const sugPrice = Number(d.suggestedRepairPrice) || 0;
      const finPrice = d.finalRepairPrice !== undefined ? Number(d.finalRepairPrice) : (Number(d.estimatedCost) || sugPrice);

      return {
        id: `D-${Date.now()}-${index}`,
        type: typeStr,
        model: modelStr,
        serialNumber: d.serialNumber || "",
        color: d.color || "قياسي",
        accessories: d.accessories || "بدون ملحقات",
        devicePassword: d.devicePassword || "",
        issue: issueStr,
        selectedQuickFaults: d.selectedQuickFaults || [],
        suggestedRepairPrice: sugPrice,
        finalRepairPrice: finPrice,
        estimatedCost: finPrice, // backwards compatibility fallback
        partsCost: Number(d.partsCost) || 0,
        laborCost: Number(d.laborCost) || 0,
        status: d.status || RepairStatus.Received,
        warrantyOption: d.warrantyOption || warrantyOption,
        warrantyDays: d.warrantyDays || calculatedWarrantyDays,
        technicianNotes: d.technicianNotes || "",
        internalNotes: d.internalNotes || ""
      };
    });

    const totalSuggested = completeDevices.reduce((sum, d) => sum + (d.suggestedRepairPrice || 0), 0);
    const totalFinal = completeDevices.reduce((sum, d) => sum + (d.finalRepairPrice || d.estimatedCost || 0), 0);
    const allQuickFaults = completeDevices.flatMap(d => d.selectedQuickFaults || []);

    const savedOrder = addRepairOrder({
      customerId: isGuest ? undefined : selectedCustomer!.id,
      customerType: isGuest ? "GUEST" : "REGISTERED",
      guestCustomerName: isGuest ? guestName.trim() : undefined,
      guestCustomerPhone: isGuest ? guestPhone.trim() : undefined,
      guestCustomerAltPhone: isGuest ? (guestAltPhone.trim() || undefined) : undefined,
      guestCustomerNote: isGuest ? (guestNote.trim() || undefined) : undefined,
      customerNameSnapshot: isGuest ? guestName.trim() : selectedCustomer!.name,
      customerPhoneSnapshot: isGuest ? guestPhone.trim() : selectedCustomer!.phone,
      devices: completeDevices,
      selectedQuickFaults: allQuickFaults,
      suggestedRepairPrice: totalSuggested,
      finalRepairPrice: totalFinal,
      totalEstimatedCost: totalFinal, // backwards compatibility fallback
      advancePayment: Number(advancePayment) || 0,
      status: RepairStatus.Received,
      isPaid: false,
      notes: orderNotes,
      warrantyOption,
      warrantyDays: calculatedWarrantyDays,
      isWarrantyClaim,
      parentOrderId: isWarrantyClaim ? parentOrderId : undefined,
      workOwnershipType,
      workOwnerPartnerId: workOwnershipType === WorkOwnershipType.PARTNER_2_PRIVATE ? "P-002" : workOwnershipType === WorkOwnershipType.PARTNER_1_PRIVATE ? "P-001" : undefined,
      partnerDeductionRate: Number(partnerDeductionRate) || 0
    });

    setIsSubmitting(false);

    // Dummy customer structure for WhatsApp / Post-save actions
    const dummyCustForWa: Customer = isGuest
      ? {
          id: "GUEST",
          name: guestName.trim(),
          phone: guestPhone.trim(),
          type: CustomerType.Guest,
          createdAt: new Date().toISOString()
        }
      : selectedCustomer!;

    // Store for post-reception actions banner & WhatsApp trigger
    setLastSavedOrder(savedOrder);
    setLastSavedCustomer(dummyCustForWa);

    // Prompt receipt printing
    setPrintOrder(savedOrder);
    setIsPrintModalOpen(true);

    // Trigger automatic WhatsApp message send
    triggerWhatsAppMsg(savedOrder, dummyCustForWa);

    setSuccessMsg(`تم حفظ وتسجيل طلب الصيانة بنجاح برقم [${savedOrder.id}]!`);

    // Reset customer form
    setGuestName("");
    setGuestPhone("");
    setGuestAltPhone("");
    setGuestNote("");
    setSelectedCustomer(null);
    setSearchQuery("");
    setReceptionCustomerType("GUEST");

    // Reset Form for next order
    setDevices([
      {
        type: undefined,
        model: "",
        serialNumber: "",
        color: "أبيض/أسود",
        accessories: "",
        issue: "",
        estimatedCost: 0,
        partsCost: 0,
        laborCost: 0,
        status: RepairStatus.Received
      }
    ]);
    setOrderNotes("");
    setAdvancePayment(0);
    setSelectedCustomer(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="space-y-6 text-right">
      {/* Print Receipt Modal integration */}
      {isPrintModalOpen && printOrder && (
        <PrintReceiptModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          order={printOrder}
          customer={customers.find(c => c.id === printOrder.customerId) || lastSavedCustomer || undefined}
          settings={settings}
        />
      )}

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Smartphone className="w-6 h-6 text-indigo-400" />
          قسم الاستقبال وتسجيل الأجهزة الصيانة
        </h2>
        <p className="text-gray-400 text-xs mt-1">البحث عن عميل حالي برقم الهاتف أو الاسم، أو تسجيل عميل جديد فوراً لإنشاء أمر صيانة</p>
      </div>

      {validationError && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs py-3 px-4 rounded-xl flex items-center justify-between gap-2 font-bold animate-pulse">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{validationError}</span>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs py-3 px-4 rounded-xl flex items-center gap-2 font-bold">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* POST-RECEIPT SUCCESS & ACTION PANEL (Matching User Design) */}
      {lastSavedOrder && lastSavedCustomer && (
        <div className="bg-[#10121d] border-2 border-emerald-500/40 p-5 rounded-2xl space-y-4 shadow-2xl animate-fade-in text-right">
          {/* Internal Label Instruction Box */}
          <div className="bg-[#181510] border border-amber-500/40 p-4 rounded-xl flex items-center justify-between gap-3">
            <div className="space-y-1">
              <span className="text-amber-400 font-bold text-xs flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-amber-400" /> تعليمات الملصق الداخلي:
              </span>
              <p className="text-xs text-amber-100/90 leading-relaxed">
                اكتب الكود <span className="bg-amber-500/30 text-amber-300 font-mono font-bold px-2.5 py-0.5 rounded border border-amber-500/40 text-xs">{lastSavedOrder.id}</span> يدوياً على الملصق الورقي وضعه على جهاز العميل لتطابق البيانات مع التتبع الإلكتروني الفوري.
              </p>
            </div>
          </div>

          {/* Large Green WhatsApp Button */}
          <button
            type="button"
            onClick={() => triggerWhatsAppMsg(lastSavedOrder, lastSavedCustomer)}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 px-6 rounded-2xl flex items-center justify-center gap-3 text-base shadow-xl shadow-emerald-950/40 transition-all cursor-pointer active:scale-98"
          >
            <MessageSquare className="w-6 h-6 fill-current text-white" />
            إرسال رسالة الاستلام عبر WhatsApp
          </button>

          {/* Action Buttons Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => {
                setLastSavedOrder(null);
                setLastSavedCustomer(null);
              }}
              className="bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-500/40 text-indigo-200 font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-indigo-400" />
              تسجيل جهاز جديد
            </button>

            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(lastSavedOrder.id);
                setCopiedCode(true);
                setTimeout(() => setCopiedCode(false), 2500);
              }}
              className="bg-gray-900 hover:bg-gray-800 border border-[#2a2d42] text-gray-200 font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
              {copiedCode ? "تم النسخ!" : "نسخ الكود"}
            </button>

            <button
              type="button"
              onClick={() => onNavigate?.("repair-center", { orderId: lastSavedOrder.id })}
              className="bg-gray-900 hover:bg-gray-800 border border-[#2a2d42] text-indigo-300 font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Edit className="w-4 h-4 text-indigo-400" />
              تفاصيل وتعديل
            </button>

            <button
              type="button"
              onClick={() => onNavigate?.("tracking", { orderId: lastSavedOrder.id })}
              className="bg-gray-900 hover:bg-gray-800 border border-[#2a2d42] text-indigo-300 font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-4 h-4 text-indigo-400" />
              بوابة التتبع
            </button>

            <button
              type="button"
              onClick={() => {
                setPrintOrder(lastSavedOrder);
                setIsPrintModalOpen(true);
              }}
              className="col-span-2 sm:col-span-1 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-300 font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              طباعة الإيصال
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Customer Selection & Creation */}
        <div className="bg-[#11131e] border border-[#2a2d42] p-5 rounded-2xl space-y-4 h-fit">
          <h3 className="text-md font-bold text-white flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-400" />
            بيانات العميل المستلم منه
          </h3>

          {/* Customer Type Selection Toggle */}
          <div className="bg-gray-950 p-3 rounded-xl border border-[#2a2d42] space-y-2">
            <label className="text-xs font-bold text-gray-300 block mb-1">نوع العميل:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setReceptionCustomerType("GUEST");
                  setSelectedCustomer(null);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  receptionCustomerType === "GUEST"
                    ? "bg-indigo-600 text-white shadow-lg"
                    : "bg-gray-900 text-gray-400 border border-[#2a2d42] hover:bg-gray-850"
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full border-2 ${receptionCustomerType === "GUEST" ? "border-white bg-white" : "border-gray-500"}`} />
                عميل زائر (افتراضي)
              </button>

              <button
                type="button"
                onClick={() => setReceptionCustomerType("REGISTERED")}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  receptionCustomerType === "REGISTERED"
                    ? "bg-indigo-600 text-white shadow-lg"
                    : "bg-gray-900 text-gray-400 border border-[#2a2d42] hover:bg-gray-850"
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full border-2 ${receptionCustomerType === "REGISTERED" ? "border-white bg-white" : "border-gray-500"}`} />
                عميل مسجل
              </button>
            </div>
          </div>

          {/* GUEST CUSTOMER FORM */}
          {receptionCustomerType === "GUEST" && (
            <div className="space-y-3 bg-gray-950/40 p-4 rounded-xl border border-[#2a2d42]">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                  <UserPlus className="w-4 h-4" />
                  بيانات العميل الزائر
                </span>
                <button
                  type="button"
                  onClick={handleSaveGuestAsRegistered}
                  className="text-[10px] bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer"
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
                  className="w-full bg-gray-900 border border-[#2a2d42] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
                />
              </div>

              <div>
                <label className="text-[11px] text-gray-300 block mb-1">رقم الهاتف *</label>
                <input
                  type="tel"
                  required
                  placeholder="01xxxxxxxxx"
                  value={guestPhone}
                  onChange={e => setGuestPhone(e.target.value)}
                  className="w-full bg-gray-900 border border-[#2a2d42] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono text-left"
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
                  className="w-full bg-gray-900 border border-[#2a2d42] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono text-left"
                  style={{ direction: "ltr" }}
                />
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">ملاحظات العميل (اختيارية)</label>
                <input
                  type="text"
                  placeholder="أية ملاحظات إضافية عن العميل..."
                  value={guestNote}
                  onChange={e => setGuestNote(e.target.value)}
                  className="w-full bg-gray-900 border border-[#2a2d42] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          {/* REGISTERED CUSTOMER SECTION */}
          {receptionCustomerType === "REGISTERED" && (
            <>
              {selectedCustomer ? (
                <div className="bg-indigo-950/40 border border-indigo-500/30 p-4 rounded-xl space-y-3 relative">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] text-indigo-400 font-bold block">العميل المسجل المحدد:</span>
                      <h4 className="text-sm font-bold text-white mt-0.5">{selectedCustomer.name}</h4>
                      <div className="mt-1">
                        <PhoneDisplay phone={selectedCustomer.phone} className="text-xs text-gray-300 font-mono" />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedCustomer(null)}
                      className="text-[10px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 px-2 py-1 rounded-lg font-bold transition cursor-pointer"
                    >
                      تغيير العميل
                    </button>
                  </div>
                </div>
              ) : !isAddingNewCustomer ? (
                <div className="space-y-3">
                  <label className="text-xs text-gray-400 block">البحث عن عميل مسجل بالاسم أو رقم الهاتف</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="مثال: 010123... أو محمد عبد الرحمن"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 pr-10"
                    />
                    <Search className="w-5 h-5 text-gray-500 absolute left-3 top-3" />
                  </div>

                  {/* Dynamic Search Results list */}
                  {filteredCustomers.length > 0 && (
                    <div className="bg-gray-950 border border-[#2a2d42] rounded-xl overflow-hidden max-h-[220px] overflow-y-auto divide-y divide-[#2a2d42]/60">
                      {filteredCustomers.map(cust => (
                        <button
                          key={cust.id}
                          type="button"
                          onClick={() => handleSelectCustomer(cust)}
                          className="w-full text-right px-4 py-3 hover:bg-indigo-600/10 text-xs text-gray-300 transition-colors flex justify-between items-center cursor-pointer"
                        >
                          <div>
                            <span className="font-bold text-white block">{cust.name}</span>
                            <PhoneDisplay phone={cust.phone} className="text-[10px] text-gray-500 font-mono mt-0.5 block" />
                          </div>
                          <span className="bg-indigo-500/10 text-indigo-400 text-[10px] px-2.5 py-1 rounded-md border border-indigo-500/20 font-bold">
                            {cust.type === "VIP" ? "VIP" : "اختر العميل"}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {searchQuery.trim() && filteredCustomers.length === 0 && (
                    <div className="text-center p-4 bg-gray-950/40 rounded-xl border border-dashed border-[#2a2d42]">
                      <p className="text-xs text-gray-400">لا يوجد عملاء مطابقين للبحث</p>
                      <button
                        type="button"
                        onClick={() => {
                          setNewCustPhone(searchQuery);
                          setIsAddingNewCustomer(true);
                        }}
                        className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        تسجيل {searchQuery} كعميل دائم جديد
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsAddingNewCustomer(true)}
                    className="w-full bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-300 text-xs py-3 px-4 rounded-xl border border-indigo-500/20 flex items-center justify-center gap-1.5 transition-colors font-medium cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    إضافة عميل دائم جديد
                  </button>
                </div>
              ) : (
                <form onSubmit={handleCreateCustomer} className="space-y-3 bg-gray-950/40 p-4 rounded-xl border border-[#2a2d42]">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-indigo-400">تسجيل عميل دائم جديد</span>
                    <button
                      type="button"
                      onClick={() => setIsAddingNewCustomer(false)}
                      className="text-[10px] text-red-400 hover:underline cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">الاسم بالكامل *</label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: أحمد عبد الله"
                      value={newCustName}
                      onChange={e => setNewCustName(e.target.value)}
                      className="w-full bg-gray-950 border border-[#2a2d42] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">رقم الهاتف *</label>
                    <input
                      type="tel"
                      required
                      placeholder="مثال: 010xxxxxxxx"
                      value={newCustPhone}
                      onChange={e => setNewCustPhone(e.target.value)}
                      className="w-full bg-gray-950 border border-[#2a2d42] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 text-left font-mono"
                      style={{ direction: "ltr" }}
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">فئة العميل</label>
                    <select
                      value={newCustType}
                      onChange={e => setNewCustType(e.target.value as CustomerType)}
                      className="w-full bg-gray-950 border border-[#2a2d42] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value={CustomerType.Individual}>عميل فردي</option>
                      <option value={CustomerType.VIP}>عميل VIP مميز</option>
                      <option value={CustomerType.Shop}>محل ألعاب / تاجر</option>
                      <option value={CustomerType.Wholesale}>عميل جملة</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">ملاحظات العميل</label>
                    <textarea
                      placeholder="أية ملاحظات إضافية عن العميل"
                      value={newCustNotes}
                      onChange={e => setNewCustNotes(e.target.value)}
                      className="w-full bg-gray-950 border border-[#2a2d42] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 h-16 resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs py-2 px-4 rounded-lg font-bold transition-all-custom cursor-pointer"
                  >
                    حفظ وتسجيل العميل الدائم
                  </button>
                </form>
              )}
            </>
          )}

          {/* Customer Profile Card (If Selected) */}
          {selectedCustomer && (
            <div className="bg-indigo-950/20 border border-indigo-500/20 p-4 rounded-xl space-y-3 relative">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-white font-bold text-sm">{selectedCustomer.name}</h4>
                  <PhoneDisplay phone={selectedCustomer.phone} className="text-[10px] text-gray-400 font-mono block mt-1" />
                </div>
                <span className="bg-indigo-500/10 text-indigo-400 text-[10px] px-2 py-0.5 rounded-md border border-indigo-500/20 font-bold">
                  {selectedCustomer.type === "VIP" && "VIP المميز"}
                  {selectedCustomer.type === "Individual" && "عميل فردي"}
                  {selectedCustomer.type === "Shop" && "محل صيانة/شريك"}
                  {selectedCustomer.type === "Wholesale" && "عميل جملة"}
                </span>
              </div>

              {selectedCustomer.notes && (
                <p className="text-[11px] text-gray-400 bg-black/40 p-2 rounded-lg border border-[#2a2d42]/40">
                  {selectedCustomer.notes}
                </p>
              )}

              {/* Active Warranty Warning Banner */}
              {activeWarrantyOrders.length > 0 && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-amber-400">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    تنبيه: العميل يمتلك أجهزة سابقة داخل الضمان!
                  </div>
                  {activeWarrantyOrders.map(ao => (
                    <div key={ao.id} className="p-2 bg-slate-900/80 rounded-lg border border-amber-500/20 text-[11px] text-slate-200">
                      <div className="flex justify-between items-center font-bold">
                        <span>طلب #{ao.id}</span>
                        <span className="text-amber-400">
                          ينتهي: {ao.warrantyEndDate ? new Date(ao.warrantyEndDate).toLocaleDateString("ar-EG") : "ساري"}
                        </span>
                      </div>
                      <p className="text-slate-400 text-[10px] mt-0.5">
                        الجهاز: {ao.devices?.map(d => `${d.type} ${d.model}`).join("، ")}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setIsWarrantyClaim(true);
                          setParentOrderId(ao.id);
                        }}
                        className={`mt-1.5 w-full py-1 rounded text-[10px] font-bold border transition ${
                          isWarrantyClaim && parentOrderId === ao.id
                            ? "bg-amber-500 text-slate-950 border-amber-400"
                            : "bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30"
                        }`}
                      >
                        {isWarrantyClaim && parentOrderId === ao.id ? "✓ مرتبط كمرتجع صيانة داخل الضمان" : "ربط الطلب الجديد مع هذا الضمان"}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setSelectedCustomer(null);
                  setIsWarrantyClaim(false);
                  setParentOrderId("");
                }}
                className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] py-1.5 rounded-lg border border-red-500/20 transition-colors cursor-pointer"
              >
                تغيير العميل
              </button>
            </div>
          )}
        </div>

        {/* Middle & Right Column: Repair Order Devices (Unlimited) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#11131e] border border-[#2a2d42] p-5 rounded-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-indigo-400" />
                أجهزة الصيانة المطلوبة ({devices.length})
              </h3>
              <button
                type="button"
                onClick={handleAddDeviceBlock}
                className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 px-3 rounded-lg flex items-center gap-1 transition-all-custom cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                إضافة جهاز آخر للطلب
              </button>
            </div>

            {/* Devices Loop */}
            <div className="space-y-4">
              {devices.map((device, index) => {
                // Filter models based on selected device type
                const selectedTypeObj = deviceTypes.find(t => t.nameAr === device.type || t.nameEn === device.type);
                const filteredModelsList = selectedTypeObj 
                  ? deviceModels.filter(m => m.deviceTypeId === selectedTypeObj.id) 
                  : [];

                // Filter faults based on selected device type
                const filteredFaultsList = selectedTypeObj
                  ? commonFaults.filter(f => f.deviceTypeId === selectedTypeObj.id)
                  : [];

                return (
                  <div
                    key={index}
                    className="bg-gray-950/40 border border-[#2a2d42] p-4 rounded-xl space-y-4 relative group"
                  >
                    <div className="flex justify-between items-center pb-2 border-b border-[#2a2d42]/60">
                      <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-indigo-500" />
                        الجهاز #{index + 1}
                      </span>
                      {devices.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveDeviceBlock(index)}
                          className="text-red-400 hover:text-red-300 p-1 rounded-md transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Device Type - Dynamic from DB */}
                      <div>
                        <label className="text-[11px] text-gray-400 block mb-1">نوع الكونسول الرئيسي *</label>
                        <select
                          required
                          value={device.type || ""}
                          onChange={e => handleDeviceTypeChange(index, e.target.value)}
                          className="w-full bg-gray-950 border border-[#2a2d42] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
                        >
                          <option value="">-- اختر الفئة --</option>
                          {deviceTypes.filter(t => !t.isArchived).map(type => (
                            <option key={type.id} value={type.nameAr}>
                              {type.nameAr} ({type.brand})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Device Model - Dynamic depending on Device Type */}
                      <div>
                        <label className="text-[11px] text-gray-400 block mb-1">الموديل / الإصدار الدقيق *</label>
                        <select
                          required
                          disabled={!device.type}
                          value={device.model || ""}
                          onChange={e => handleDeviceModelChange(index, e.target.value)}
                          className="w-full bg-gray-950 border border-[#2a2d42] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="">-- اختر الموديل --</option>
                          {filteredModelsList.map(m => (
                            <option key={m.id} value={m.nameAr}>
                              {m.nameAr}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Common Fault Select to Suggest Pricing automatically */}
                      {device.type && filteredFaultsList.length > 0 && (
                        <div className="md:col-span-2 bg-indigo-950/10 border border-indigo-500/20 p-2.5 rounded-lg">
                          <label className="text-[11px] text-indigo-300 font-bold block mb-1">🎯 هل هناك عطل شائع ينطبق على شكوى العميل؟</label>
                          <select
                            onChange={e => handleFaultChange(index, e.target.value)}
                            className="w-full bg-gray-950 border border-[#2a2d42] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                          >
                            <option value="">-- كشف وفحص عام --</option>
                            {filteredFaultsList.map(f => (
                              <option key={f.id} value={f.id}>
                                {f.nameAr} (السعر المتوقع: {f.defaultRepairPrice} ج.م)
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Serial Number & Password conditional config */}
                      {(() => {
                        const lockCodeConfig = getLockCodeConfig(device.type, device.model);
                        return (
                          <>
                            {/* Serial Number */}
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[11px] text-gray-400">الرقم التسلسلي للجهاز (Serial No)</label>
                                <button
                                  type="button"
                                  onClick={() => setScanDeviceIndex(index)}
                                  className="px-2 py-0.5 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 rounded-md text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                  title="مسح الرقم التسلسلي باستخدام الكاميرا أو القارئ"
                                >
                                  <Camera className="w-3 h-3 text-indigo-400" />
                                  <span>📷 مسح</span>
                                </button>
                              </div>
                              <input
                                type="text"
                                placeholder="مثال: 03-27452819-..."
                                value={device.serialNumber || ""}
                                onChange={e => handleDeviceChange(index, "serialNumber", e.target.value)}
                                className="w-full bg-gray-950 border border-[#2a2d42] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 text-left font-mono"
                              />
                            </div>

                            {/* Device Password / Pin code - Conditional display */}
                            {lockCodeConfig.shouldShow && (
                              <div>
                                <label className="text-[11px] text-amber-400 font-semibold block mb-0.5">
                                  {lockCodeConfig.label}
                                </label>
                                {lockCodeConfig.note && (
                                  <span className="text-[10px] text-gray-400 block mb-1">
                                    {lockCodeConfig.note}
                                  </span>
                                )}
                                <input
                                  type="text"
                                  placeholder="رمز الفتح، كلمة سر الحساب، أو النمط"
                                  value={device.devicePassword || ""}
                                  onChange={e => handleDeviceChange(index, "devicePassword", e.target.value)}
                                  className="w-full bg-gray-950 border border-amber-500/30 rounded-lg px-3 py-2 text-xs text-amber-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                                />
                              </div>
                            )}
                          </>
                        );
                      })()}

                      {/* Appearance / Device outer conditions */}
                      <div>
                        <label className="text-[11px] text-gray-400 block mb-1">اللون والمظهر الخارجي</label>
                        <input
                          type="text"
                          placeholder="مثال: أبيض / خدوش خفيفة"
                          value={device.color || ""}
                          onChange={e => handleDeviceChange(index, "color", e.target.value)}
                          className="w-full bg-gray-950 border border-[#2a2d42] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      {/* Quick outer conditions helpers */}
                      {deviceConditions.length > 0 && (
                        <div className="md:col-span-2 flex flex-wrap gap-1.5 pt-0.5">
                          <span className="text-[10px] text-gray-500 block w-full">تحديد مظهر خارجي سريع:</span>
                          {deviceConditions.map(c => {
                            const isChecked = (device.color || "").includes(c.nameAr);
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => handleToggleCondition(index, c.nameAr)}
                                className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                                  isChecked 
                                    ? "bg-teal-600/20 text-teal-300 border-teal-500/30" 
                                    : "bg-gray-950 text-gray-400 border-[#2a2d42] hover:text-white"
                                }`}
                              >
                                {c.nameAr}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Accessories selection from dynamic DB list */}
                      <div className="md:col-span-2">
                        <label className="text-[11px] text-gray-400 block mb-1">الملحقات المستلمة مع الجهاز</label>
                        <input
                          type="text"
                          placeholder="مثال: كابل باور، ذراع تحكم لون أسود، بدون علبة"
                          value={device.accessories || ""}
                          onChange={e => handleDeviceChange(index, "accessories", e.target.value)}
                          className="w-full bg-gray-950 border border-[#2a2d42] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 mb-2"
                        />

                        {receivedAccessories.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {receivedAccessories.map(acc => {
                              const isChecked = (device.accessories || "").includes(acc.nameAr);
                              return (
                                <button
                                  key={acc.id}
                                  type="button"
                                  onClick={() => handleToggleAccessory(index, acc.nameAr)}
                                  className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                                    isChecked 
                                      ? "bg-indigo-600/20 text-indigo-300 border-indigo-500/30" 
                                      : "bg-gray-950 text-gray-400 border-[#2a2d42] hover:text-white"
                                  }`}
                                >
                                  {acc.nameAr}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Quick Checklist Checklist options */}
                      <div className="md:col-span-2 bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <label className="text-[11px] text-indigo-300 font-bold flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                            <span>📋 قائمة الفحص والأعطال السريعة (اضغط لاختيار الشكوى وتحديد السعر تلقائياً):</span>
                          </label>
                          <span className="text-[10px] text-gray-400">تُجمع الأسعار الافتراضية تلقائياً عند اختيار أكثر من عطل</span>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {QUICK_FAULTS_LIST.map((fault) => {
                            const isSelected = (device.issue || "").includes(fault.label);
                            return (
                              <button
                                key={fault.id}
                                type="button"
                                onClick={() => handleToggleIssueTag(index, fault.label)}
                                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                                  isSelected
                                    ? "bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-950/50"
                                    : "bg-gray-950/80 text-gray-300 border-gray-800 hover:border-gray-700 hover:text-white"
                                }`}
                              >
                                <span className={`text-[11px] ${isSelected ? "text-amber-300 font-bold" : "text-gray-500"}`}>
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

                      {/* Diagnostic issue / describe problem */}
                      <div className="md:col-span-2">
                        <label className="text-[11px] text-gray-400 block mb-1 font-medium">المشكلة / العطل الموصوف تفصيلياً من العميل *</label>
                        <textarea
                          required
                          placeholder="اكتب تفاصيل المشكلة بدقة (مثال: الجهاز يفصل باور بعد نصف ساعة، أو درفت بالأنالوج)"
                          value={device.issue || ""}
                          onChange={e => handleDeviceChange(index, "issue", e.target.value)}
                          className="w-full bg-gray-950 border border-[#2a2d42] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 h-20 resize-none font-medium"
                        />
                      </div>

                      {/* Single Final Price Field (No Parts/Labor Breakdown on Reception) */}
                      <div className="md:col-span-2 bg-gradient-to-r from-indigo-950/60 via-slate-900 to-indigo-950/60 p-4 rounded-xl border border-indigo-500/30 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <label className="text-xs text-indigo-300 font-bold flex items-center gap-1.5">
                            <DollarSign className="w-4 h-4 text-emerald-400" />
                            <span>سعر الصيانة المتفق عليه مع العميل (السعر النهائي ج.م) *</span>
                          </label>
                          {device.suggestedRepairPrice !== undefined && device.suggestedRepairPrice > 0 && (
                            <span className="text-[11px] text-gray-300 bg-gray-950/90 px-2.5 py-1 rounded-md border border-[#2a2d42]">
                              المجموع التلقائي للأعطال: <span className="text-amber-400 font-bold font-mono">{device.suggestedRepairPrice} ج.م</span>
                            </span>
                          )}
                        </div>

                        <div className="relative">
                          <input
                            type="number"
                            required
                            min="0"
                            placeholder="0.00"
                            value={device.finalRepairPrice ?? device.estimatedCost ?? ""}
                            onChange={e => {
                              const val = e.target.value === "" ? 0 : Number(e.target.value);
                              handleManualPriceChange(index, val);
                            }}
                            className="w-full bg-gray-950 border border-indigo-500/50 rounded-lg px-3.5 py-2.5 text-base text-white focus:outline-none focus:border-indigo-400 font-bold text-emerald-400 font-mono shadow-inner"
                          />
                        </div>

                        {/* Requirement 12: Confirmation banner if price manually edited & fault selection changed */}
                        {device.isPriceManuallyEdited &&
                         device.suggestedRepairPrice !== undefined &&
                         device.suggestedRepairPrice !== device.finalRepairPrice &&
                         !device.priceOverrideAcknowledged && (
                          <div className="bg-amber-950/80 border border-amber-500/50 p-3 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs mt-2 animate-fadeIn">
                            <div className="text-amber-200 font-medium leading-relaxed">
                              <span>⚠️ تم تعديل السعر يدوياً ({device.finalRepairPrice} ج.م). السعر التلقائي للأعطال المختارة حالياً: ({device.suggestedRepairPrice} ج.م). هل تريد تحديثه؟</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleResetPriceToSuggested(index)}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-sm"
                              >
                                تحديث السعر ({device.suggestedRepairPrice} ج.م)
                              </button>
                              <button
                                type="button"
                                onClick={() => handleKeepManualPrice(index)}
                                className="bg-gray-800 hover:bg-gray-700 text-gray-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer border border-gray-700"
                              >
                                الاحتفاظ بالسعر الحالي ({device.finalRepairPrice} ج.م)
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-[#2a2d42] pt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-xs text-amber-400 font-bold block mb-1">🛡️ مدة الضمان الممنوحة *</label>
                <select
                  value={warrantyOption}
                  onChange={e => setWarrantyOption(e.target.value as WarrantyDurationOption)}
                  className="w-full bg-gray-950 border border-amber-500/40 rounded-xl px-3 py-3 text-xs text-amber-300 font-bold focus:outline-none focus:border-amber-500"
                >
                  <option value="NO_WARRANTY">بدون ضمان (0 يوم)</option>
                  <option value="DAYS_7">ضمان 7 أيام</option>
                  <option value="DAYS_15">ضمان 15 يومًا</option>
                  <option value="DAYS_30">ضمان شهر (30 يومًا)</option>
                  <option value="DAYS_60">ضمان شهرين (60 يومًا)</option>
                  <option value="DAYS_90">ضمان 3 أشهر (90 يومًا)</option>
                  <option value="DAYS_180">ضمان 6 أشهر (180 يومًا)</option>
                  <option value="YEAR_1">ضمان سنة كاملة (365 يومًا)</option>
                  <option value="CUSTOM">تحديد عدد أيام مخصص...</option>
                </select>

                {warrantyOption === "CUSTOM" && (
                  <div className="mt-2">
                    <input
                      type="number"
                      min="1"
                      placeholder="أدخل عدد أيام الضمان..."
                      value={customWarrantyDays || ""}
                      onChange={e => setCustomWarrantyDays(Number(e.target.value))}
                      className="w-full bg-gray-950 border border-amber-500/40 rounded-lg px-3 py-1.5 text-xs text-amber-200 font-bold font-mono focus:outline-none"
                    />
                  </div>
                )}
                <p className="text-[10px] text-slate-400 mt-1">يبدأ الضمان تلقائياً فور تسليم الجهاز للعميل</p>
              </div>

              <div>
                <label className="text-xs text-cyan-400 font-semibold block mb-1">نوع الشغل *</label>
                <select
                  value={workOwnershipType}
                  onChange={e => handleWorkOwnershipChange(e.target.value as WorkOwnershipType)}
                  className="w-full bg-gray-950 border border-cyan-500/30 rounded-xl px-3 py-3 text-xs text-white focus:outline-none focus:border-cyan-500 font-semibold"
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

                <div className="mt-2">
                  <label className="text-xs text-amber-400 font-semibold block mb-1">نسبة الخصم (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={partnerDeductionRate}
                    onChange={e => setPartnerDeductionRate(Math.max(0, Math.min(100, Number(e.target.value))))}
                    className="w-full bg-gray-950 border border-amber-500/30 rounded-xl px-3 py-2 text-xs text-amber-300 focus:outline-none focus:border-amber-500 font-bold font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">المبلغ المدفوع مقدماً (ج.م)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={advancePayment || ""}
                  onChange={e => setAdvancePayment(Number(e.target.value))}
                  className="w-full bg-gray-950 border border-emerald-500/20 rounded-xl px-4 py-3 text-sm text-green-400 focus:outline-none focus:border-emerald-500 font-bold font-mono"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">ملاحظات إدارية عامة</label>
                <input
                  type="text"
                  placeholder="ملاحظات تظهر على الإيصال العام"
                  value={orderNotes}
                  onChange={e => setOrderNotes(e.target.value)}
                  className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleSaveOrder}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all-custom cursor-pointer shadow-lg shadow-emerald-950/20"
              >
                <Save className="w-5 h-5" />
                حفظ وطباعة إيصال الصيانة وإصدار الطلب الرسمي
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Serial Number Scanner Modal */}
      {scanDeviceIndex !== null && (
        <SerialScannerModal
          isOpen={scanDeviceIndex !== null}
          onClose={() => setScanDeviceIndex(null)}
          deviceTitle={
            devices[scanDeviceIndex]?.type
              ? `${devices[scanDeviceIndex].type} ${devices[scanDeviceIndex].model || ""}`
              : `جهاز #${scanDeviceIndex + 1}`
          }
          onScanComplete={(scannedVal) => {
            handleDeviceChange(scanDeviceIndex, "serialNumber", scannedVal);
          }}
        />
      )}
    </div>
  );
}

interface SerialScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanComplete: (scannedValue: string) => void;
  deviceTitle?: string;
}

function SerialScannerModal({ isOpen, onClose, onScanComplete, deviceTitle }: SerialScannerModalProps) {
  const [manualCode, setManualCode] = useState("");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string>("جاري الاتصال بالكاميرا...");
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  React.useEffect(() => {
    if (!isOpen) {
      setCameraError(null);
      setManualCode("");
      return;
    }

    let stream: MediaStream | null = null;
    let animFrameId: number;

    async function initCamera() {
      setCameraError(null);
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("المتصفح لا يدعم الوصول المباشر للكاميرا.");
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setStatusMsg("قم بتوجيه الكاميرا نحو الرقم التسلسلي (Serial No) أو الباركوود...");

        if ("BarcodeDetector" in window) {
          const barcodeDetector = new (window as any).BarcodeDetector({
            formats: ["code_128", "code_39", "code_93", "ean_13", "ean_8", "qr_code", "data_matrix", "upc_a", "upc_e"]
          });

          const scanLoop = async () => {
            if (videoRef.current && videoRef.current.readyState === 4) {
              try {
                const barcodes = await barcodeDetector.detect(videoRef.current);
                if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                  const val = barcodes[0].rawValue.trim();
                  if (val) {
                    onScanComplete(val);
                    onClose();
                    return;
                  }
                }
              } catch (e) {
                // frame catch
              }
            }
            animFrameId = requestAnimationFrame(scanLoop);
          };
          scanLoop();
        } else {
          setStatusMsg("الكاميرا تعمل. يمكنك توجيهها أو استخدام القارئ اللاسلكي / رفع صورة الباركوود.");
        }
      } catch (err: any) {
        console.warn("Camera scan error:", err);
        setCameraError(err.message || "تعذر فتح الكاميرا. يمكنك رفع صورة أو إدخال الرقم يدويًا.");
      }
    }

    initCamera();

    return () => {
      if (animFrameId) cancelAnimationFrame(animFrameId);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isOpen]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await new Promise(resolve => (img.onload = resolve));

      if ("BarcodeDetector" in window) {
        const barcodeDetector = new (window as any).BarcodeDetector({
          formats: ["code_128", "code_39", "code_93", "ean_13", "ean_8", "qr_code", "data_matrix", "upc_a", "upc_e"]
        });
        const barcodes = await barcodeDetector.detect(img);
        if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
          onScanComplete(barcodes[0].rawValue.trim());
          onClose();
          return;
        }
      }
      alert("لم يتم التعرف على باركود تلقائياً. يمكنك كتابته يدويًا في المربع أدناه.");
    } catch (err) {
      alert("تعذر قراءة الصورة. يرجى محاولة التقاط صورة أوضح أو إدخال الرقم يدويًا.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl text-slate-100 flex flex-col">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-sm text-white">📷 مسح الرقم التسلسلي (Serial No)</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 space-y-4">
          {deviceTitle && (
            <p className="text-xs text-indigo-300 font-semibold bg-indigo-950/30 px-3 py-1.5 rounded-lg border border-indigo-500/20">
              الجهاز الحالي: {deviceTitle}
            </p>
          )}

          {/* Camera Stream View */}
          <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
            {!cameraError ? (
              <>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 border-2 border-indigo-500/40 rounded-xl pointer-events-none flex items-center justify-center">
                  <div className="w-3/4 h-2/4 border-2 border-dashed border-indigo-400 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                    <span className="text-[10px] text-indigo-200 bg-black/70 px-2.5 py-1 rounded-md font-mono">
                      ضع الباركوود في المنتصف
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-4 text-center space-y-2">
                <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
                <p className="text-xs text-amber-200">{cameraError}</p>
              </div>
            )}
          </div>

          <p className="text-[11px] text-gray-400 text-center font-medium">
            {statusMsg}
          </p>

          {/* Quick Upload / Cancel actions */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
            <label className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl cursor-pointer transition border border-slate-700">
              <Upload className="w-4 h-4 text-indigo-400" />
              <span>رفع صورة باركود</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 bg-gray-950 hover:bg-slate-800 text-gray-300 hover:text-white text-xs font-semibold rounded-xl border border-slate-800 transition cursor-pointer"
            >
              إلغاء / إدخال يدوي
            </button>
          </div>

          {/* Manual Entry or USB Barcode Scanner */}
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
            <label className="text-[11px] text-gray-300 block font-semibold">
              أو ادخل الرقم مباشرة (يدعم قارئ الباركوود اللاسلكي / USB):
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                autoFocus
                placeholder="امسح بقارئ الـ USB أو اكتب السيريال..."
                value={manualCode}
                onChange={e => setManualCode(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && manualCode.trim()) {
                    e.preventDefault();
                    onScanComplete(manualCode.trim());
                    onClose();
                  }
                }}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
              <button
                type="button"
                onClick={() => {
                  if (manualCode.trim()) {
                    onScanComplete(manualCode.trim());
                    onClose();
                  }
                }}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition cursor-pointer"
              >
                حفظ
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
