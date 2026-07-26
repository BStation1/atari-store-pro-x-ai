/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useDialog } from "../context/DialogContext";
import {
  Settings,
  Building,
  Printer,
  MessageSquare,
  Save,
  CheckCircle,
  HelpCircle,
  Lock,
  Globe,
  Layers,
  Smartphone,
  Wrench,
  Plus,
  Edit,
  Trash2,
  Archive,
  AlertTriangle,
  ChevronLeft,
  X,
  RefreshCw,
  Sliders,
  ClipboardList,
  Calendar,
  Check,
  ShieldAlert,
  ShieldCheck,
  Database,
  Key,
  FileText,
  CheckSquare,
  Square,
  Download,
  Info,
  Radio,
  RotateCcw,
  Users,
  HardDrive
} from "lucide-react";
import { 
  useSettings,
  useCategories,
  useDeviceTypes,
  useDeviceModels,
  useCommonFaults,
  useRepairServices,
  useDefaultPrices,
  useReceivedAccessories,
  useDeviceConditions,
  useCurrentUser
} from "../hooks/useData";
import { db } from "../lib/db";
import { runCategoriesTestSuite } from "../lib/supabaseCategories";
import { runProductsTestSuite } from "../lib/supabaseProducts";
import { runCustomersAndSuppliersTestSuite } from "../lib/supabaseCustomersSuppliersTest";
import { runInvoicesTestSuite } from "../lib/supabaseInvoicesTest";
import { runAccountingTestSuite } from "../lib/accountingEngineTest";
import { runPartnerLedgerTestSuite } from "../lib/partnerLedgerEngineTest";
import { runMonthlySettlementTestSuite } from "../lib/monthlySettlementEngineTest";
import { runFinalReportsTestSuite, TestCaseResult } from "../lib/finalReportsEngineTest";
import { canResetOperationalData } from "../lib/authPermissions";
import { authStore, hashPassword } from "../lib/authStore";
import { CustomerType, OperationalResetOptions, SystemResetSecurityLog } from "../types";
import OperationalResetPanel from "./OperationalResetPanel";
import BackupManagementPanel from "./BackupManagementPanel";
import RepairTemplatesTab from "./RepairTemplatesTab";

export default function SettingsView() {
  const dialog = useDialog();
  const { settings, updateSettings } = useSettings();
  const { user: currentUser } = useCurrentUser();
  
  // Metadata Hooks
  const { categories, addCategory, updateCategory, deleteCategory } = useCategories();
  const { deviceTypes, addDeviceType, updateDeviceType, deleteDeviceType } = useDeviceTypes();
  const { deviceModels, addDeviceModel, updateDeviceModel, deleteDeviceModel } = useDeviceModels();
  const { commonFaults, addCommonFault, updateCommonFault, deleteCommonFault } = useCommonFaults();
  const { repairServices, addRepairService, updateRepairService, deleteRepairService } = useRepairServices();
  const { defaultPrices, addDefaultPrice, updateDefaultPrice, deleteDefaultPrice } = useDefaultPrices();
  const { receivedAccessories, addReceivedAccessory, updateReceivedAccessory, deleteReceivedAccessory } = useReceivedAccessories();
  const { deviceConditions, addDeviceCondition, updateDeviceCondition, deleteDeviceCondition } = useDeviceConditions();

  // Settings Sub-Tabs
  const [activeTab, setActiveTab] = useState<"general" | "categories" | "devices" | "pricing" | "configurators" | "repair-templates" | "system-reset" | "data-management" | "backup-management">("general");

  // Loading and Error Handling States for System Settings Data
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [settingsLoadError, setSettingsLoadError] = useState<string | null>(null);

  React.useEffect(() => {
    let isMounted = true;
    try {
      if (settings) {
        if (isMounted) setIsLoadingSettings(false);
      } else {
        if (isMounted) {
          setSettingsLoadError("تعذر التحقق من وجود إعدادات النظام.");
          setIsLoadingSettings(false);
        }
      }
    } catch (err: any) {
      if (isMounted) {
        setSettingsLoadError(err?.message || "حدث خطأ غير متوقع أثناء تحميل بيانات إعدادات النظام.");
        setIsLoadingSettings(false);
      }
    }
  }, [settings]);

  // System Reset Modal State
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetOptions, setResetOptions] = useState<OperationalResetOptions>({
    salesAndReturns: true,
    accounting: true,
    repairOrders: true,
    monthlyClosings: true,
    notificationsAndLogs: true,
    customers: false, // Default FALSE
    inventoryMode: "RESTORE" // Default RESTORE
  });
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [isExecutingReset, setIsExecutingReset] = useState(false);

  // Success/Error notifications
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const showNotification = (msg: string, isError = false) => {
    if (isError) {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(null), 5000);
    } else {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  // ==========================================
  // TAB 1: GENERAL SYSTEM SETTINGS STATE & HANDLERS
  // ==========================================
  const [companyName, setCompanyName] = useState(settings.companyName);
  const [phone, setPhone] = useState(settings.phone);
  const [address, setAddress] = useState(settings.address);
  const [receiptHeader, setReceiptHeader] = useState(settings.receiptHeader);
  const [receiptFooter, setReceiptFooter] = useState(settings.receiptFooter);
  const [whatsAppTemplateReceived, setWhatsAppTemplateReceived] = useState(settings.whatsAppTemplateReceived);
  const [whatsAppTemplateReady, setWhatsAppTemplateReady] = useState(settings.whatsAppTemplateReady);
  const [whatsAppTemplateInvoice, setWhatsAppTemplateInvoice] = useState(settings.whatsAppTemplateInvoice);
  const [taxRate, setTaxRate] = useState(settings.taxRate);

  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      companyName,
      phone,
      address,
      receiptHeader,
      receiptFooter,
      whatsAppTemplateReceived,
      whatsAppTemplateReady,
      whatsAppTemplateInvoice,
      taxRate,
      currency: "ج.م."
    });
    showNotification("تم حفظ وتحديث إعدادات الفواتير والنظام بنجاح!");
  };

  // Categories Sub-Tab State
  const [catName, setCatName] = useState("");
  const [catSort, setCatSort] = useState<number>(1);
  const [catActive, setCatActive] = useState(true);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [isRunningCatTests, setIsRunningCatTests] = useState(false);
  const [catTestLogs, setCatTestLogs] = useState<string[]>([]);
  const [isRunningProdTests, setIsRunningProdTests] = useState(false);
  const [prodTestLogs, setProdTestLogs] = useState<string[]>([]);
  const [isRunningCustSupTests, setIsRunningCustSupTests] = useState(false);
  const [custSupTestLogs, setCustSupTestLogs] = useState<string[]>([]);
  const [isRunningInvTests, setIsRunningInvTests] = useState(false);
  const [invTestLogs, setInvTestLogs] = useState<string[]>([]);
  const [isRunningAccountingTests, setIsRunningAccountingTests] = useState(false);
  const [accountingTestLogs, setAccountingTestLogs] = useState<string[]>([]);
  const [isRunningPartnerLedgerTests, setIsRunningPartnerLedgerTests] = useState(false);
  const [partnerLedgerTestLogs, setPartnerLedgerTestLogs] = useState<string[]>([]);
  const [isRunningMonthlySettlementTests, setIsRunningMonthlySettlementTests] = useState(false);
  const [monthlySettlementTestLogs, setMonthlySettlementTestLogs] = useState<string[]>([]);
  const [isRunningFinalReportsTests, setIsRunningFinalReportsTests] = useState(false);
  const [finalReportsTestResults, setFinalReportsTestResults] = useState<TestCaseResult[]>([]);

  const handleRunCatTests = async () => {
    setIsRunningCatTests(true);
    setCatTestLogs(["جاري بدء اختبارات categories مع Supabase..."]);
    const res = await runCategoriesTestSuite();
    setCatTestLogs(res.logs);
    setIsRunningCatTests(false);
    if (res.success) {
      showNotification("اكتملت جميع اختبارات الترحيل والتأكيد لـ Supabase بنجاح!");
    } else {
      showNotification("حدث خطأ أثناء تشغيل الاختبارات", true);
    }
  };

  const handleRunProdTests = async () => {
    setIsRunningProdTests(true);
    setProdTestLogs(["جاري بدء اختبارات Products & Inventory مع Supabase..."]);
    const res = await runProductsTestSuite();
    setProdTestLogs(res.logs);
    setIsRunningProdTests(false);
    if (res.success) {
      showNotification("اكتملت جميع اختبارات المنتجات والمخزون مع Supabase بنجاح!");
    } else {
      showNotification("حدث خطأ أثناء تشغيل اختبارات المنتجات", true);
    }
  };

  const handleRunCustSupTests = async () => {
    setIsRunningCustSupTests(true);
    setCustSupTestLogs(["جاري بدء اختبارات Customers & Suppliers (Phase 4) مع Supabase..."]);
    const res = await runCustomersAndSuppliersTestSuite();
    setCustSupTestLogs(res.logs);
    setIsRunningCustSupTests(false);
    if (res.success) {
      showNotification("اكتملت جميع اختبارات العملاء والموردين لـ Supabase بنجاح!");
    } else {
      showNotification("حدث خطأ أثناء تشغيل اختبارات العملاء والموردين", true);
    }
  };

  const handleRunInvTests = async () => {
    setIsRunningInvTests(true);
    setInvTestLogs(["جاري بدء اختبارات Invoices & Invoice Items (Phase 5) مع Supabase..."]);
    const res = await runInvoicesTestSuite();
    setInvTestLogs(res.logs);
    setIsRunningInvTests(false);
    if (res.success) {
      showNotification("اكتملت جميع اختبارات الفواتير وبنود الفواتير لـ Phase 5 بنجاح!");
    } else {
      showNotification("حدث خطأ أثناء تشغيل اختبارات الفواتير", true);
    }
  };

  const handleRunAccountingTests = async () => {
    setIsRunningAccountingTests(true);
    setAccountingTestLogs(["جاري بدء اختبار محرك الأرباح المحاسبي — Phase 6.1..."]);
    const res = await runAccountingTestSuite();
    setAccountingTestLogs(res.logs);
    setIsRunningAccountingTests(false);
    if (res.success) {
      showNotification("اكتملت جميع اختبارات محرك الأرباح Phase 6.1 بنجاح (10/10)! ✅");
    } else {
      showNotification("حدث خطأ أثناء تشغيل اختبارات محرك الأرباح", true);
    }
  };

  const handleRunPartnerLedgerTests = async () => {
    setIsRunningPartnerLedgerTests(true);
    setPartnerLedgerTestLogs(["جاري تشغيل اختبارات دفتر الشركاء والمعاملات — Phase 6.2..."]);
    const res = await runPartnerLedgerTestSuite();
    const logs = [
      `النتيجة الإجمالية: ${res.passed}/${res.total} نجحت (${res.failed} فشلت)`,
      ...res.results.map(
        (r) =>
          `[${r.passed ? 'PASSED ✅' : 'FAILED ❌'}] ${r.title}\n - المتوقع: ${r.expected}\n - الفعلي: ${r.actual}`
      )
    ];
    setPartnerLedgerTestLogs(logs);
    setIsRunningPartnerLedgerTests(false);
    if (res.failed === 0) {
      showNotification("اكتملت جميع اختبارات دفتر المعاملات لـ Phase 6.2 بنجاح (10/10)! ✅");
    } else {
      showNotification(`فشلت ${res.failed} من أصل ${res.total} اختبارات في دفتر الشركاء`, true);
    }
  };

  const handleRunMonthlySettlementTests = async () => {
    setIsRunningMonthlySettlementTests(true);
    setMonthlySettlementTestLogs(["جاري تشغيل اختبارات التسويات الشهرية والصندوق والمصروفات — Phase 6.3..."]);
    const res = await runMonthlySettlementTestSuite();
    const logs = [
      `النتيجة الإجمالية: ${res.passed}/${res.total} نجحت (${res.failed} فشلت)`,
      ...res.results.map(
        (r) =>
          `[${r.passed ? 'PASSED ✅' : 'FAILED ❌'}] ${r.title}\n - المتوقع: ${r.expected}\n - الفعلي: ${r.actual}`
      )
    ];
    setMonthlySettlementTestLogs(logs);
    setIsRunningMonthlySettlementTests(false);
    if (res.failed === 0) {
      showNotification("اكتملت جميع اختبارات التسويات الشهرية والصندوق والمصروفات لـ Phase 6.3 بنجاح (10/10)! ✅");
    } else {
      showNotification(`فشلت ${res.failed} من أصل ${res.total} اختبارات في التسويات الشهرية`, true);
    }
  };

  const handleRunFinalReportsTests = async () => {
    setIsRunningFinalReportsTests(true);
    const res = await runFinalReportsTestSuite();
    setFinalReportsTestResults(res.results);
    setIsRunningFinalReportsTests(false);
    if (res.failed === 0) {
      showNotification(`اكتملت جميع اختبارات التقارير واللوحات المالية لـ Phase 6.4 بنجاح (${res.passed}/${res.total})! ✅`);
    } else {
      showNotification(`اكتملت الاختبارات مع وجود ${res.failed} ملاحظات`, true);
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;

    try {
      if (editingCatId) {
        await updateCategory({ id: editingCatId, name: catName, sortOrder: Number(catSort), isActive: catActive });
        showNotification("تم تحديث تصنيف المنتجات بنجاح في Supabase!");
        setEditingCatId(null);
      } else {
        await addCategory({ name: catName, sortOrder: Number(catSort), isActive: catActive });
        showNotification("تم إضافة تصنيف المنتجات بنجاح إلى Supabase!");
      }
      setCatName("");
      setCatSort(categories.length + 2);
      setCatActive(true);
    } catch (err: any) {
      showNotification(err?.message || "خطأ أثناء حفظ التصنيف في Supabase", true);
    }
  };

  const handleEditCategory = (cat: any) => {
    setEditingCatId(cat.id);
    setCatName(cat.name);
    setCatSort(cat.sortOrder);
    setCatActive(cat.isActive !== false);
  };

  const handleDeleteCategoryAction = async (id: string) => {
    const confirmed = await dialog.confirm({
      title: "حذف التصنيف",
      message: "هل أنت متأكد من رغبتك في حذف هذا التصنيف؟",
      variant: "danger",
      confirmText: "نعم، حذف"
    });
    if (confirmed) {
      const target = categories.find(c => c.id === id);
      const res = await deleteCategory(id, target?.name);
      if (res.success) {
        showNotification("تم حذف التصنيف بنجاح من Supabase");
      } else {
        showNotification(res.error || "خطأ أثناء حذف التصنيف", true);
      }
    }
  };

  // ==========================================
  // TAB 3: DEVICE TYPE & MODEL STATE & HANDLERS
  // ==========================================
  // Device Type states
  const [dtNameAr, setDtNameAr] = useState("");
  const [dtNameEn, setDtNameEn] = useState("");
  const [dtBrand, setDtBrand] = useState("Sony");
  const [dtSort, setDtSort] = useState<number>(1);
  const [dtActive, setDtActive] = useState(true);
  const [editingDtId, setEditingDtId] = useState<string | null>(null);

  // Device Model states
  const [dmDeviceTypeId, setDmDeviceTypeId] = useState("");
  const [dmNameAr, setDmNameAr] = useState("");
  const [dmNameEn, setDmNameEn] = useState("");
  const [dmCode, setDmCode] = useState("");
  const [dmStorage, setDmStorage] = useState("1TB");
  const [dmWarranty, setDmWarranty] = useState<number>(90);
  const [dmInspPrice, setDmInspPrice] = useState<number>(200);
  const [dmRepPrice, setDmRepPrice] = useState<number>(1200);
  const [dmNotes, setDmNotes] = useState("");
  const [dmActive, setDmActive] = useState(true);
  const [editingDmId, setEditingDmId] = useState<string | null>(null);

  const handleSaveDeviceType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dtNameAr.trim() || !dtNameEn.trim()) return;

    try {
      if (editingDtId) {
        await updateDeviceType({ id: editingDtId, nameAr: dtNameAr, nameEn: dtNameEn, brand: dtBrand, sortOrder: Number(dtSort), isActive: dtActive });
        showNotification("تم تحديث نوع الجهاز بنجاح");
        setEditingDtId(null);
      } else {
        await addDeviceType({ nameAr: dtNameAr, nameEn: dtNameEn, brand: dtBrand, sortOrder: Number(dtSort), isActive: dtActive });
        showNotification("تم تسجيل نوع الجهاز الجديد بنجاح");
      }
      setDtNameAr("");
      setDtNameEn("");
      setDtBrand("Sony");
      setDtSort(deviceTypes.length + 2);
    } catch (err: any) {
      showNotification(err?.message || "حدث خطأ أثناء حفظ نوع الجهاز", true);
    }
  };

  const handleSaveDeviceModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dmDeviceTypeId || !dmNameAr.trim()) {
      showNotification("يرجى تحديد نوع الجهاز وإدخال اسم الموديل بالعربية", true);
      return;
    }

    const payload = {
      deviceTypeId: dmDeviceTypeId,
      brand: deviceTypes.find(t => t.id === dmDeviceTypeId)?.brand || "Sony",
      nameAr: dmNameAr,
      nameEn: dmNameEn,
      modelCode: dmCode,
      storageOptions: dmStorage,
      defaultWarrantyDays: Number(dmWarranty),
      defaultInspectionPrice: Number(dmInspPrice),
      defaultRepairPrice: Number(dmRepPrice),
      notes: dmNotes,
      isActive: dmActive,
      sortOrder: deviceModels.length + 1
    };

    try {
      if (editingDmId) {
        await updateDeviceModel({ id: editingDmId, ...payload });
        showNotification("تم تحديث موديل الجهاز بنجاح");
        setEditingDmId(null);
      } else {
        await addDeviceModel(payload);
        showNotification("تم إضافة موديل الجهاز الجديد بنجاح");
      }

      setDmNameAr("");
      setDmNameEn("");
      setDmCode("");
      setDmStorage("1TB");
      setDmNotes("");
    } catch (err: any) {
      showNotification(err?.message || "حدث خطأ أثناء حفظ الموديل", true);
    }
  };

  const handleDeleteDeviceTypeAction = async (id: string) => {
    const confirmed = await dialog.confirm({
      title: "حذف نوع الجهاز",
      message: "هل أنت متأكد من رغبتك في حذف نوع الجهاز هذا؟ في حال وجود سجلات مرتبطة به، سيتم أرشفته للمحافظة على الفواتير.",
      variant: "danger",
      confirmText: "نعم، حذف/أرشفة"
    });
    if (confirmed) {
      const res = await deleteDeviceType(id);
      if (res.success) {
        showNotification(res.error || "تم حذف نوع الجهاز بنجاح");
      } else {
        showNotification(res.error || "حدث خطأ أثناء الحذف", true);
      }
    }
  };

  const handleDeleteDeviceModelAction = async (id: string) => {
    const confirmed = await dialog.confirm({
      title: "حذف موديل الجهاز",
      message: "هل أنت متأكد من حذف هذا الموديل؟",
      variant: "danger",
      confirmText: "نعم، حذف"
    });
    if (confirmed) {
      const res = await deleteDeviceModel(id);
      if (res.success) {
        showNotification(res.error || "تم حذف موديل الجهاز بنجاح");
      } else {
        showNotification(res.error || "حدث خطأ أثناء حذف الموديل", true);
      }
    }
  };

  // ==========================================
  // TAB 4: COMMON FAULTS & PRICING
  // ==========================================
  // Fault states
  const [fNameAr, setFNameAr] = useState("");
  const [fNameEn, setFNameEn] = useState("");
  const [fDeviceType, setFDeviceType] = useState("");
  const [fCategory, setFCategory] = useState("أعطال الباور الكهربائي");
  const [fCustDesc, setFCustDesc] = useState("");
  const [fTechDiag, setFTechDiag] = useState("");
  const [fNotes, setFNotes] = useState("");
  const [fInspPrice, setFInspPrice] = useState<number>(200);
  const [fRepPrice, setFRepPrice] = useState<number>(1200);
  const [fWarranty, setFWarranty] = useState<number>(90);
  const [fPriority, setFPriority] = useState<"low" | "medium" | "high">("medium");
  const [editingFaultId, setEditingFaultId] = useState<string | null>(null);

  // Pricing Matrix states
  const [prDeviceType, setPrDeviceType] = useState("");
  const [prFaultId, setPrFaultId] = useState("");
  const [prCustType, setPrCustType] = useState<CustomerType>(CustomerType.Individual);
  const [prInspPrice, setPrInspPrice] = useState<number>(200);
  const [prRepPrice, setPrRepPrice] = useState<number>(1200);
  const [prMinPrice, setPrMinPrice] = useState<number>(1000);
  const [prLaborCost, setPrLaborCost] = useState<number>(600);
  const [prPartCost, setPrPartCost] = useState<number>(400);
  const [prWholesale, setPrWholesale] = useState<number>(900);
  const [prShopPrice, setPrShopPrice] = useState<number>(950);
  const [prVipPrice, setPrVipPrice] = useState<number>(1100);
  const [prWarranty, setPrWarranty] = useState<number>(30);

  const handleSaveCommonFault = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fNameAr.trim() || !fDeviceType) {
      showNotification("يرجى ملء الاسم وتحديد نوع الكونسول المتوافق", true);
      return;
    }

    const payload = {
      nameAr: fNameAr,
      nameEn: fNameEn,
      deviceTypeId: fDeviceType,
      faultCategory: fCategory,
      customerDescriptionAr: fCustDesc,
      techDiagnosisTemplateAr: fTechDiag,
      defaultRepairNotesAr: fNotes,
      defaultInspectionPrice: Number(fInspPrice),
      defaultRepairPrice: Number(fRepPrice),
      estimatedHours: 1.5,
      suggestedParts: "",
      warrantyDays: Number(fWarranty),
      priority: fPriority,
      isActive: true,
      sortOrder: commonFaults.length + 1
    };

    if (editingFaultId) {
      updateCommonFault({ id: editingFaultId, ...payload });
      showNotification("تم تحديث العطل الشائع وقالب التشخيص بنجاح");
      setEditingFaultId(null);
    } else {
      addCommonFault(payload);
      showNotification("تم تسجيل عطل شائع جديد وقالب تشخيصه بنجاح");
    }

    setFNameAr("");
    setFNameEn("");
    setFCustDesc("");
    setFTechDiag("");
    setFNotes("");
  };

  const handleSaveDefaultPrice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prDeviceType) {
      showNotification("يرجى اختيار الكونسول لتخصيص جدول الأسعار", true);
      return;
    }

    const payload = {
      deviceTypeId: prDeviceType,
      commonFaultId: prFaultId || undefined,
      customerType: prCustType,
      defaultInspectionPrice: Number(prInspPrice),
      defaultRepairPrice: Number(prRepPrice),
      minRepairPrice: Number(prMinPrice),
      maxEstimatedPrice: Number(prRepPrice) + 400,
      laborCost: Number(prLaborCost),
      partCostEstimate: Number(prPartCost),
      wholesalePrice: Number(prWholesale),
      shopPrice: Number(prShopPrice),
      vipPrice: Number(prVipPrice),
      warrantyPeriodDays: Number(prWarranty)
    };

    addDefaultPrice(payload);
    showNotification("تم تسجيل وتخصيص التسعيرة الموحدة للأجهزة بنجاح");
  };

  const handleDeleteFaultAction = async (id: string) => {
    const confirmed = await dialog.confirm({
      title: "حذف العطل الشائع",
      message: "هل تريد حذف هذا العطل الشائع؟",
      variant: "danger",
      confirmText: "نعم، حذف"
    });
    if (confirmed) {
      const res = deleteCommonFault(id);
      if (res.success) {
        showNotification(res.error || "تم حذف العطل بنجاح");
      } else {
        showNotification(res.error || "حدث خطأ أثناء حذف العطل", true);
      }
    }
  };

  // ==========================================
  // TAB 5: SERVICES, ACCESSORIES & CONDITIONS
  // ==========================================
  // Labor/Service states
  const [srvNameAr, setSrvNameAr] = useState("");
  const [srvDeviceType, setSrvDeviceType] = useState("");
  const [srvLabor, setSrvLabor] = useState<number>(500);
  const [srvMin, setSrvMin] = useState<number>(400);
  const [srvWarranty, setSrvWarranty] = useState<number>(30);
  const [srvInstructions, setSrvInstructions] = useState("");
  const [srvDesc, setSrvDesc] = useState("");

  // Accessory state
  const [accName, setAccName] = useState("");

  // Condition state
  const [condName, setCondName] = useState("");

  const handleSaveRepairService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!srvNameAr.trim() || !srvDeviceType) {
      showNotification("يرجى ملء اسم الخدمة واختيار الجهاز المتوافق", true);
      return;
    }

    addRepairService({
      nameAr: srvNameAr,
      deviceTypeId: srvDeviceType,
      defaultLaborPrice: Number(srvLabor),
      minPrice: Number(srvMin),
      estimatedHours: 1,
      warrantyDays: Number(srvWarranty),
      technicianInstructions: srvInstructions,
      customerDescription: srvDesc,
      isActive: true
    });

    showNotification("تم إضافة خدمة صيانة جديدة للكتالوج المعتمد بنجاح");
    setSrvNameAr("");
    setSrvInstructions("");
    setSrvDesc("");
  };

  const handleAddAccessoryAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accName.trim()) return;
    addReceivedAccessory({
      nameAr: accName,
      sortOrder: receivedAccessories.length + 1
    });
    showNotification("تم إضافة ملحق استلام جديد بنجاح");
    setAccName("");
  };

  const handleAddConditionAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!condName.trim()) return;
    addDeviceCondition({
      nameAr: condName,
      sortOrder: deviceConditions.length + 1
    });
    showNotification("تم تسجيل مظهر فحص خارجي جديد بنجاح");
    setCondName("");
  };

  return (
    <div className="space-y-6 text-right">
      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b border-[#2a2d42]">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="text-indigo-400 w-6 h-6" />
            إعدادات النظام الفنية وتكوين الأجهزة
          </h2>
          <p className="text-gray-400 text-xs mt-1">تخصيص الفواتير، الرسائل، تصنيفات المخازن، عائلات الأجهزة والموديلات، الأعطال الشائعة، والتسعير التلقائي</p>
        </div>
      </div>

      {/* Success/Error banners */}
      {successMsg && (
        <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-xs py-3 px-4 rounded-xl flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs py-3 px-4 rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Loading state for System Settings */}
      {isLoadingSettings && (
        <div className="p-8 bg-[#11131e] border border-[#2a2d42] rounded-2xl text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
          <p className="text-xs font-bold text-gray-300">جاري تحميل إعدادات وبيانات النظام...</p>
        </div>
      )}

      {/* Error state for System Settings */}
      {settingsLoadError && (
        <div className="p-6 bg-rose-950/40 border border-rose-500/50 rounded-2xl text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
          <h3 className="text-sm font-bold text-rose-300">فشل جلب بيانات النظام والبيانات الأساسية</h3>
          <p className="text-xs text-rose-200">{settingsLoadError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition cursor-pointer"
          >
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* Tab Navigation row matching the Arabic mockup */}
      <div className="flex flex-wrap border-b border-[#2a2d42] gap-6">
        <button
          onClick={() => setActiveTab("general")}
          className={`pb-3 text-sm font-bold transition-colors cursor-pointer relative ${
            activeTab === "general" ? "text-indigo-400" : "text-gray-400 hover:text-white"
          }`}
        >
          الفواتير ورسائل الواتساب
          {activeTab === "general" && <span className="absolute bottom-0 right-0 left-0 h-0.5 bg-indigo-500"></span>}
        </button>
        <button
          onClick={() => setActiveTab("categories")}
          className={`pb-3 text-sm font-bold transition-colors cursor-pointer relative ${
            activeTab === "categories" ? "text-indigo-400" : "text-gray-400 hover:text-white"
          }`}
        >
          إدارة تصنيفات المخزن
          {activeTab === "categories" && <span className="absolute bottom-0 right-0 left-0 h-0.5 bg-indigo-500"></span>}
        </button>
        <button
          onClick={() => setActiveTab("devices")}
          className={`pb-3 text-sm font-bold transition-colors cursor-pointer relative ${
            activeTab === "devices" ? "text-indigo-400" : "text-gray-400 hover:text-white"
          }`}
        >
          أنواع الكونسول والموديلات
          {activeTab === "devices" && <span className="absolute bottom-0 right-0 left-0 h-0.5 bg-indigo-500"></span>}
        </button>
        <button
          onClick={() => setActiveTab("pricing")}
          className={`pb-3 text-sm font-bold transition-colors cursor-pointer relative ${
            activeTab === "pricing" ? "text-indigo-400" : "text-gray-400 hover:text-white"
          }`}
        >
          الأعطال الشائعة وتسعير الصيانة
          {activeTab === "pricing" && <span className="absolute bottom-0 right-0 left-0 h-0.5 bg-indigo-500"></span>}
        </button>
        <button
          onClick={() => setActiveTab("configurators")}
          className={`pb-3 text-sm font-bold transition-colors cursor-pointer relative ${
            activeTab === "configurators" ? "text-indigo-400" : "text-gray-400 hover:text-white"
          }`}
        >
          الخدمات، الملحقات والظروف
          {activeTab === "configurators" && <span className="absolute bottom-0 right-0 left-0 h-0.5 bg-indigo-500"></span>}
        </button>

        <button
          onClick={() => setActiveTab("repair-templates")}
          className={`pb-3 text-sm font-bold transition-colors cursor-pointer relative flex items-center gap-1.5 ${
            activeTab === "repair-templates" ? "text-indigo-400" : "text-gray-400 hover:text-white"
          }`}
        >
          <Wrench className="w-4 h-4 text-indigo-400" />
          <span>قوالب الصيانة (Repair Templates)</span>
          {activeTab === "repair-templates" && <span className="absolute bottom-0 right-0 left-0 h-0.5 bg-indigo-500"></span>}
        </button>

        {canResetOperationalData(currentUser) && (
          <button
            onClick={() => setActiveTab("data-management")}
            className={`pb-3 text-sm font-bold transition-colors cursor-pointer relative flex items-center gap-1.5 ${
              activeTab === "data-management" || activeTab === "system-reset" ? "text-red-400" : "text-red-400/80 hover:text-red-300"
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-red-500 animate-pulse" />
            <span>حذف البيانات التجريبية وبدء نظام جديد</span>
            {(activeTab === "data-management" || activeTab === "system-reset") && <span className="absolute bottom-0 right-0 left-0 h-0.5 bg-red-500"></span>}
          </button>
        )}

        <button
          onClick={() => setActiveTab("backup-management")}
          className={`pb-3 text-sm font-bold transition-colors cursor-pointer relative flex items-center gap-1.5 ${
            activeTab === "backup-management" ? "text-indigo-400" : "text-gray-400 hover:text-white"
          }`}
        >
          <HardDrive className="w-4 h-4 text-indigo-400" />
          <span>النسخ الاحتياطي للبيانات</span>
          {activeTab === "backup-management" && <span className="absolute bottom-0 right-0 left-0 h-0.5 bg-indigo-500"></span>}
        </button>
      </div>

      {/* ====================================================
          TAB 1: GENERAL SYSTEM SETTINGS
          ==================================================== */}
      {activeTab === "general" && (
        <form onSubmit={handleSaveGeneral} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Store profile */}
            <div className="bg-[#11131e] border border-[#2a2d42] p-6 rounded-2xl space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 pb-2 border-b border-[#2a2d42]/60">
                <Building className="w-5 h-5 text-indigo-400" />
                البيانات التعريفية للمركز والفرع الرئيسي
              </h3>

              <div>
                <label className="text-xs text-gray-400 block mb-1">اسم المحل التجاري / العلامة التجارية *</label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">رقم الهاتف الرسمي للمركز (للفواتير) *</label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 text-left font-mono"
                  style={{ direction: "ltr" }}
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">العنوان الجغرافي للمركز بالتفصيل *</label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">نسبة ضريبة القيمة المضافة المطبقة (%)</label>
                <input
                  type="number"
                  value={taxRate}
                  onChange={e => setTaxRate(Number(e.target.value))}
                  className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            {/* Thermal receipts styling */}
            <div className="bg-[#11131e] border border-[#2a2d42] p-6 rounded-2xl space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 pb-2 border-b border-[#2a2d42]/60">
                <Printer className="w-5 h-5 text-indigo-400" />
                تنسيق ترويسة وتذييل الفاتورة الحرارية (80mm)
              </h3>

              <div>
                <label className="text-xs text-gray-400 block mb-1">نص ترويسة الفاتورة العلوي (Header)</label>
                <textarea
                  value={receiptHeader}
                  onChange={e => setReceiptHeader(e.target.value)}
                  className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 h-24"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">نص تذييل الفاتورة وشروط الضمان المعتمدة (Footer)</label>
                <textarea
                  value={receiptFooter}
                  onChange={e => setReceiptFooter(e.target.value)}
                  className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 h-24"
                />
              </div>
            </div>

            {/* WhatsApp templates */}
            <div className="bg-[#11131e] border border-[#2a2d42] p-6 rounded-2xl lg:col-span-2 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 pb-2 border-b border-[#2a2d42]/60">
                <MessageSquare className="w-5 h-5 text-indigo-400" />
                تنسيق قوالب رسائل الواتس آب (WhatsApp Click-To-Chat)
              </h3>

              <div className="text-[11px] text-indigo-300 bg-indigo-950/20 border border-indigo-500/20 p-3.5 rounded-xl leading-relaxed">
                <p className="font-bold mb-1">💡 المتغيرات المدعومة في رسائل الواتساب والتي سيتم استبدالها تلقائياً:</p>
                <ul className="list-disc pr-4 space-y-1 mt-1">
                  <li><code className="font-mono bg-black/40 px-1 rounded text-white font-bold">{`{customer_name}`}</code> - اسم العميل</li>
                  <li><code className="font-mono bg-black/40 px-1 rounded text-white font-bold">{`{device_model}`}</code> - نوع وموديل الجهاز</li>
                  <li><code className="font-mono bg-black/40 px-1 rounded text-white font-bold">{`{order_id}`}</code> - كود أمر الصيانة</li>
                  <li><code className="font-mono bg-black/40 px-1 rounded text-white font-bold">{`{total_cost}`}</code> - التكلفة الإجمالية</li>
                  <li><code className="font-mono bg-black/40 px-1 rounded text-white font-bold">{`{tracking_link}`}</code> - رابط تتبع الصيانة للعميل</li>
                </ul>
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">قالب الرسالة: عند استلام الجهاز من العميل</label>
                <textarea
                  value={whatsAppTemplateReceived}
                  onChange={e => setWhatsAppTemplateReceived(e.target.value)}
                  className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 h-20"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">قالب الرسالة: عند انتهاء الصيانة وجاهزية الجهاز للاستلام</label>
                <textarea
                  value={whatsAppTemplateReady}
                  onChange={e => setWhatsAppTemplateReady(e.target.value)}
                  className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 h-20"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">قالب الرسالة: إرسال تفاصيل فاتورة بيع المنتجات</label>
                <textarea
                  value={whatsAppTemplateInvoice}
                  onChange={e => setWhatsAppTemplateInvoice(e.target.value)}
                  className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 h-20"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3.5 px-6 rounded-xl flex items-center gap-2 transition-all-custom cursor-pointer"
            >
              <Save className="w-4 h-4" />
              حفظ التغييرات بالكامل
            </button>
          </div>
        </form>
      )}

      {/* ====================================================
          TAB 2: CATEGORY MANAGEMENT
          ==================================================== */}
      {activeTab === "categories" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Category Form */}
          <div className="bg-[#11131e] border border-[#2a2d42] p-6 rounded-2xl h-fit space-y-4">
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5 border-b border-[#2a2d42] pb-3">
              <Plus className="w-4 h-4 text-indigo-400" />
              {editingCatId ? "تعديل بيانات التصنيف" : "إضافة تصنيف مخازن جديد"}
            </h3>

            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">اسم تصنيف المنتجات بالعربية *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: ذراعات تحكم DualSense"
                  value={catName}
                  onChange={e => setCatName(e.target.value)}
                  className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">الترتيب في القوائم (Sort Order)</label>
                <input
                  type="number"
                  min="1"
                  value={catSort}
                  onChange={e => setCatSort(Number(e.target.value))}
                  className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="catActive"
                  checked={catActive}
                  onChange={e => setCatActive(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 bg-gray-950 border-[#2a2d42] rounded focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="catActive" className="text-xs text-gray-300 select-none cursor-pointer">هذا التصنيف مفعل للمخزون</label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-3 rounded-xl transition-colors cursor-pointer"
                >
                  {editingCatId ? "تحديث التغييرات" : "تسجيل التصنيف"}
                </button>
                {editingCatId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCatId(null);
                      setCatName("");
                      setCatActive(true);
                    }}
                    className="flex-1 bg-gray-800 text-white text-xs py-3 rounded-xl hover:bg-gray-700 cursor-pointer"
                  >
                    إلغاء التعديل
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Categories Table List */}
          <div className="bg-[#11131e] border border-[#2a2d42] rounded-2xl lg:col-span-2 overflow-hidden shadow-xl space-y-0">
            <div className="p-4 bg-gray-950/40 border-b border-[#2a2d42] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-white">تصنيفات المخازن المسجلة تجارياً</h4>
                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Supabase Cloud DB
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRunCatTests}
                  disabled={isRunningCatTests}
                  className="bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isRunningCatTests ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                      <span>جاري تشغيل اختبارات التصنيفات...</span>
                    </>
                  ) : (
                    <>
                      <Database className="w-3.5 h-3.5 text-indigo-400" />
                      <span>اختبار التصنيفات (Cat Test)</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleRunProdTests}
                  disabled={isRunningProdTests}
                  className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isRunningProdTests ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                      <span>جاري تشغيل اختبار المنتجات...</span>
                    </>
                  ) : (
                    <>
                      <Database className="w-3.5 h-3.5 text-emerald-400" />
                      <span>اختبار المنتجات والمخزون (Products Test)</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleRunCustSupTests}
                  disabled={isRunningCustSupTests}
                  className="bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isRunningCustSupTests ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                      <span>جاري تشغيل اختبار العملاء والموردين...</span>
                    </>
                  ) : (
                    <>
                      <Users className="w-3.5 h-3.5 text-amber-400" />
                      <span>اختبار العملاء والموردين (Phase 4 Test)</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleRunInvTests}
                  disabled={isRunningInvTests}
                  className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isRunningInvTests ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
                      <span>جاري تشغيل اختبار الفواتير...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-3.5 h-3.5 text-blue-400" />
                      <span>اختبار الفواتير وبنود الفواتير (Phase 5 Test)</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleRunAccountingTests}
                  disabled={isRunningAccountingTests}
                  className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isRunningAccountingTests ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                      <span>جاري تشغيل محرك الأرباح...</span>
                    </>
                  ) : (
                    <>
                      <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                      <span>اختبار محرك الأرباح — Phase 6.1</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleRunPartnerLedgerTests}
                  disabled={isRunningPartnerLedgerTests}
                  className="bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isRunningPartnerLedgerTests ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                      <span>جاري تشغيل دفتر الشركاء...</span>
                    </>
                  ) : (
                    <>
                      <ClipboardList className="w-3.5 h-3.5 text-indigo-400" />
                      <span>اختبار دفتر الشركاء — Phase 6.2</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleRunMonthlySettlementTests}
                  disabled={isRunningMonthlySettlementTests}
                  className="bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isRunningMonthlySettlementTests ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-400" />
                      <span>جاري تشغيل التسويات الشهرية...</span>
                    </>
                  ) : (
                    <>
                      <Calendar className="w-3.5 h-3.5 text-purple-400" />
                      <span>اختبار التسويات الشهرية — Phase 6.3</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleRunFinalReportsTests}
                  disabled={isRunningFinalReportsTests}
                  className="bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isRunningFinalReportsTests ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                      <span>جاري تشغيل اختبارات التقارير...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-3.5 h-3.5 text-cyan-400" />
                      <span>اختبار التقارير النهائية — Phase 6.4</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {catTestLogs.length > 0 && (
              <div className="p-4 bg-black/60 border-b border-[#2a2d42] space-y-1 font-mono text-[11px] text-gray-300 max-h-48 overflow-y-auto">
                <div className="text-indigo-400 font-bold mb-2 flex justify-between items-center">
                  <span>📋 سجل نتائج اختبارات التصنيفات مع Supabase:</span>
                  <button onClick={() => setCatTestLogs([])} className="text-gray-500 hover:text-gray-300 text-[10px]">إغلاق السجل</button>
                </div>
                {catTestLogs.map((log, idx) => (
                  <div key={idx} className="leading-relaxed">{log}</div>
                ))}
              </div>
            )}

            {prodTestLogs.length > 0 && (
              <div className="p-4 bg-black/80 border-b border-[#2a2d42] space-y-1 font-mono text-[11px] text-emerald-300 max-h-56 overflow-y-auto">
                <div className="text-emerald-400 font-bold mb-2 flex justify-between items-center">
                  <span>📦 سجل نتائج اختبارات المنتجات والمخزون مع Supabase (Phase 3):</span>
                  <button onClick={() => setProdTestLogs([])} className="text-gray-500 hover:text-gray-300 text-[10px]">إغلاق السجل</button>
                </div>
                {prodTestLogs.map((log, idx) => (
                  <div key={idx} className="leading-relaxed">{log}</div>
                ))}
              </div>
            )}

            {custSupTestLogs.length > 0 && (
              <div className="p-4 bg-black/90 border-b border-[#2a2d42] space-y-1 font-mono text-[11px] text-amber-300 max-h-56 overflow-y-auto">
                <div className="text-amber-400 font-bold mb-2 flex justify-between items-center">
                  <span>📋 سجل نتائج اختبارات العملاء والموردين (Phase 4):</span>
                  <button onClick={() => setCustSupTestLogs([])} className="text-gray-500 hover:text-gray-300 text-[10px]">إغلاق السجل</button>
                </div>
                {custSupTestLogs.map((log, idx) => (
                  <div key={idx} className="leading-relaxed">{log}</div>
                ))}
              </div>
            )}

            {invTestLogs.length > 0 && (
              <div className="p-4 bg-black/90 border-b border-[#2a2d42] space-y-1 font-mono text-[11px] text-blue-300 max-h-56 overflow-y-auto">
                <div className="text-blue-400 font-bold mb-2 flex justify-between items-center">
                  <span>📄 سجل نتائج اختبارات الفواتير وبنود الفواتير (Phase 5):</span>
                  <button onClick={() => setInvTestLogs([])} className="text-gray-500 hover:text-gray-300 text-[10px]">إغلاق السجل</button>
                </div>
                {invTestLogs.map((log, idx) => (
                  <div key={idx} className="leading-relaxed">{log}</div>
                ))}
              </div>
            )}

            {accountingTestLogs.length > 0 && (
              <div className="p-4 bg-black/95 border-b border-[#2a2d42] space-y-1 font-mono text-[11px] text-emerald-300 max-h-64 overflow-y-auto">
                <div className="text-emerald-400 font-bold mb-2 flex justify-between items-center">
                  <span>💰 سجل نتائج اختبار محرك الأرباح المحاسبي — Phase 6.1:</span>
                  <button onClick={() => setAccountingTestLogs([])} className="text-gray-500 hover:text-gray-300 text-[10px]">إغلاق السجل</button>
                </div>
                {accountingTestLogs.map((log, idx) => (
                  <div key={idx} className="leading-relaxed">{log}</div>
                ))}
              </div>
            )}

            {partnerLedgerTestLogs.length > 0 && (
              <div className="p-4 bg-black/95 border-b border-[#2a2d42] space-y-1 font-mono text-[11px] text-indigo-300 max-h-64 overflow-y-auto">
                <div className="text-indigo-400 font-bold mb-2 flex justify-between items-center">
                  <span>📊 سجل نتائج اختبار دفتر الشركاء والمعاملات — Phase 6.2:</span>
                  <button onClick={() => setPartnerLedgerTestLogs([])} className="text-gray-500 hover:text-gray-300 text-[10px]">إغلاق السجل</button>
                </div>
                {partnerLedgerTestLogs.map((log, idx) => (
                  <div key={idx} className="leading-relaxed whitespace-pre-line">{log}</div>
                ))}
              </div>
            )}

            {monthlySettlementTestLogs.length > 0 && (
              <div className="p-4 bg-black/95 border-b border-[#2a2d42] space-y-1 font-mono text-[11px] text-purple-300 max-h-64 overflow-y-auto">
                <div className="text-purple-400 font-bold mb-2 flex justify-between items-center">
                  <span>📅 سجل نتائج اختبار التسويات الشهرية والصندوق والمصروفات — Phase 6.3:</span>
                  <button onClick={() => setMonthlySettlementTestLogs([])} className="text-gray-500 hover:text-gray-300 text-[10px]">إغلاق السجل</button>
                </div>
                {monthlySettlementTestLogs.map((log, idx) => (
                  <div key={idx} className="leading-relaxed whitespace-pre-line">{log}</div>
                ))}
              </div>
            )}

            {finalReportsTestResults.length > 0 && (
              <div className="p-4 bg-black/95 border-b border-[#2a2d42] space-y-3 font-sans text-xs max-h-96 overflow-y-auto">
                <div className="text-cyan-400 font-bold flex justify-between items-center text-sm">
                  <span>📊 جدول اختبارات التقارير واللوحات المالية لـ Phase 6.4 (12 اختبار):</span>
                  <button onClick={() => setFinalReportsTestResults([])} className="text-gray-400 hover:text-white text-xs font-bold">إغلاق الجدول</button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-gray-300 text-[11px]">
                    <thead className="bg-[#181b2a] text-gray-400 font-bold">
                      <tr>
                        <th className="p-2 border border-[#2a2d42]">اسم الاختبار</th>
                        <th className="p-2 border border-[#2a2d42]">المتوقع</th>
                        <th className="p-2 border border-[#2a2d42]">الفعلي</th>
                        <th className="p-2 border border-[#2a2d42]">النتيجة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2a2d42]">
                      {finalReportsTestResults.map((t) => (
                        <tr key={t.id} className="hover:bg-[#161927]">
                          <td className="p-2 font-bold text-white border border-[#2a2d42]">{t.title}</td>
                          <td className="p-2 text-cyan-300 border border-[#2a2d42]">{t.expected}</td>
                          <td className="p-2 text-gray-300 border border-[#2a2d42]">{t.actual}</td>
                          <td className="p-2 border border-[#2a2d42]">
                            {t.passed ? (
                              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">
                                ناجح ✅
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 font-bold text-[10px]">
                                راسب ❌
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-gray-950/60 text-gray-400 text-[11px] font-bold border-b border-[#2a2d42]">
                  <th className="p-4">كود التصنيف</th>
                  <th className="p-4">اسم التصنيف</th>
                  <th className="p-4">ترتيب العرض</th>
                  <th className="p-4">الحالة</th>
                  <th className="p-4 text-center">خيارات التحكم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2d42]/40 text-xs text-gray-300">
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-400 text-xs font-bold">
                      لا توجد تصنيفات، قم بإضافة أول تصنيف.
                    </td>
                  </tr>
                ) : (
                  categories.map(c => (
                    <tr key={c.id} className="hover:bg-gray-950/20 transition-colors">
                      <td className="p-4 font-mono font-bold text-indigo-400">{c.id}</td>
                      <td className="p-4 font-bold text-white">{c.name}</td>
                      <td className="p-4 font-mono">{c.sortOrder}</td>
                      <td className="p-4">
                        {c.isActive !== false ? (
                          <span className="bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded text-[10px] font-bold">نشط</span>
                        ) : (
                          <span className="bg-gray-500/10 text-gray-400 border border-gray-500/20 px-2 py-0.5 rounded text-[10px] font-bold">معطل</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEditCategory(c)}
                            className="p-1.5 bg-[#2a2d42]/40 hover:bg-indigo-600/20 hover:text-indigo-400 text-gray-400 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteCategoryAction(c.id)}
                            className="p-1.5 bg-[#2a2d42]/40 hover:bg-red-600/20 hover:text-red-400 text-gray-400 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ====================================================
          TAB 3: DEVICE TYPES & MODELS
          ==================================================== */}
      {activeTab === "devices" && (
        <div className="space-y-8">
          {/* Section A: Device Types */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-[#11131e] border border-[#2a2d42] p-6 rounded-2xl h-fit space-y-4">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5 border-b border-[#2a2d42] pb-3">
                <Plus className="w-4 h-4 text-indigo-400" />
                تسجيل فئة / نوع كونسول جديد
              </h3>

              <form onSubmit={handleSaveDeviceType} className="space-y-4">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">الاسم بالعربية *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: بلاستيشن 5 سليم"
                    value={dtNameAr}
                    onChange={e => setDtNameAr(e.target.value)}
                    className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">الاسم بالإنجليزي *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PS5 Slim"
                    value={dtNameEn}
                    onChange={e => setDtNameEn(e.target.value)}
                    className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">الماركة / الشركة المصنعة</label>
                  <select
                    value={dtBrand}
                    onChange={e => setDtBrand(e.target.value)}
                    className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Sony">Sony</option>
                    <option value="Microsoft">Microsoft</option>
                    <option value="Nintendo">Nintendo</option>
                    <option value="Valve">Valve (Steam)</option>
                    <option value="Other">أخرى / مخصص</option>
                  </select>
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-3 rounded-xl transition-colors cursor-pointer"
                  >
                    {editingDtId ? "تحديث النوع" : "تسجيل الفئة المعتمدة"}
                  </button>
                </div>
              </form>
            </div>

            <div className="bg-[#11131e] border border-[#2a2d42] rounded-2xl lg:col-span-2 overflow-hidden shadow-xl">
              <div className="p-4 bg-gray-950/40 border-b border-[#2a2d42]">
                <h4 className="text-xs font-bold text-white">فئات الأجهزة والكونسول المدعومة بالورشة</h4>
              </div>

              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-gray-950/60 text-gray-400 text-[11px] font-bold border-b border-[#2a2d42]">
                    <th className="p-4">كود الفئة</th>
                    <th className="p-4">الاسم العربي</th>
                    <th className="p-4">الاسم الإنجليزي</th>
                    <th className="p-4">الماركة</th>
                    <th className="p-4 text-center">التحكم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2d42]/40 text-xs text-gray-300">
                  {deviceTypes.filter(dt => !dt.isArchived).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-400 text-xs font-bold">
                        لا توجد فئات أجهزة، قم بإضافة أول فئة.
                      </td>
                    </tr>
                  ) : (
                    deviceTypes.filter(dt => !dt.isArchived).map(dt => (
                      <tr key={dt.id} className="hover:bg-gray-950/20 transition-colors">
                        <td className="p-4 font-mono font-bold text-indigo-400">{dt.id}</td>
                        <td className="p-4 font-bold text-white">{dt.nameAr}</td>
                        <td className="p-4 font-mono">{dt.nameEn}</td>
                        <td className="p-4 font-bold">{dt.brand}</td>
                        <td className="p-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                setEditingDtId(dt.id);
                                setDtNameAr(dt.nameAr);
                                setDtNameEn(dt.nameEn);
                                setDtBrand(dt.brand);
                                setDtSort(dt.sortOrder || 1);
                                setDtActive(dt.isActive !== false);
                              }}
                              className="p-1.5 bg-[#2a2d42]/40 hover:bg-indigo-600/20 hover:text-indigo-400 text-gray-400 rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteDeviceTypeAction(dt.id)}
                              className="p-1.5 bg-[#2a2d42]/40 hover:bg-red-600/20 hover:text-red-400 text-gray-400 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section B: Device Models */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-6 border-t border-[#2a2d42]">
            {/* Add Model Form */}
            <div className="bg-[#11131e] border border-[#2a2d42] p-6 rounded-2xl h-fit space-y-4">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5 border-b border-[#2a2d42] pb-3">
                <Plus className="w-4 h-4 text-teal-400" />
                تسجيل موديل جهاز دقيق جديد
              </h3>

              <form onSubmit={handleSaveDeviceModel} className="space-y-4">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">التابع لنوع الجهاز الرئيسي *</label>
                  <select
                    value={dmDeviceTypeId}
                    onChange={e => setDmDeviceTypeId(e.target.value)}
                    className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">اختر نوع كونسول...</option>
                    {deviceTypes.filter(t => !t.isArchived).map(t => (
                      <option key={t.id} value={t.id}>{t.nameAr} ({t.brand})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">اسم الموديل الدقيق بالعربية *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: إصدار الأقراص القياسي CFI-1200"
                    value={dmNameAr}
                    onChange={e => setDmNameAr(e.target.value)}
                    className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">اسم الموديل الدقيق بالإنجليزي</label>
                  <input
                    type="text"
                    placeholder="e.g. PS5 Fat CFI-1200 Disc"
                    value={dmNameEn}
                    onChange={e => setDmNameEn(e.target.value)}
                    className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">رمز الموديل المكتوب</label>
                    <input
                      type="text"
                      placeholder="e.g. CFI-1216A"
                      value={dmCode}
                      onChange={e => setDmCode(e.target.value)}
                      className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">خيارات السعة المتوفرة</label>
                    <input
                      type="text"
                      placeholder="e.g. 825GB, 1TB"
                      value={dmStorage}
                      onChange={e => setDmStorage(e.target.value)}
                      className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">الضمان الافتراضي (يوم)</label>
                    <input
                      type="number"
                      value={dmWarranty}
                      onChange={e => setDmWarranty(Number(e.target.value))}
                      className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-2 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">كشف افتراضي (ج.م)</label>
                    <input
                      type="number"
                      value={dmInspPrice}
                      onChange={e => setDmInspPrice(Number(e.target.value))}
                      className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-2 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">إصلاح افتراضي (ج.م)</label>
                    <input
                      type="number"
                      value={dmRepPrice}
                      onChange={e => setDmRepPrice(Number(e.target.value))}
                      className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-2 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono font-bold text-teal-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">ملاحظات دقيقة ومكان الباركود</label>
                  <textarea
                    placeholder="مكان تدوين باركود المصنع في خلفية الشاسيه..."
                    value={dmNotes}
                    onChange={e => setDmNotes(e.target.value)}
                    className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 h-16 text-right"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold py-3 rounded-xl transition-colors cursor-pointer"
                >
                  {editingDmId ? "حفظ تعديل الموديل" : "تسجيل الموديل"}
                </button>
              </form>
            </div>

            {/* Models Table List */}
            <div className="bg-[#11131e] border border-[#2a2d42] rounded-2xl lg:col-span-2 overflow-hidden shadow-xl">
              <div className="p-4 bg-gray-950/40 border-b border-[#2a2d42]">
                <h4 className="text-xs font-bold text-white">الموديلات الدقيقة والباركودات المعتمدة بالفحص التلقائي</h4>
              </div>

              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-gray-950/60 text-gray-400 text-[11px] font-bold border-b border-[#2a2d42]">
                    <th className="p-4">الموديل الدقيق</th>
                    <th className="p-4">الفئة التابع لها</th>
                    <th className="p-4">الضمان</th>
                    <th className="p-4">الكشف / الإصلاح</th>
                    <th className="p-4 text-center">التحكم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2d42]/40 text-xs text-gray-300">
                  {deviceModels.filter(m => !m.isArchived).map(m => {
                    const parentType = deviceTypes.find(t => t.id === m.deviceTypeId);
                    return (
                      <tr key={m.id} className="hover:bg-gray-950/20 transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-white">{m.nameAr}</div>
                          <div className="text-[10px] text-gray-500 font-mono mt-0.5">{m.modelCode} | {m.storageOptions}</div>
                        </td>
                        <td className="p-4">
                          <span className="bg-[#2a2d42]/60 text-gray-300 px-2.5 py-0.5 rounded text-[10px] font-bold">
                            {parentType ? parentType.nameAr : "غير محدد"}
                          </span>
                        </td>
                        <td className="p-4 font-mono font-bold text-indigo-400">{m.defaultWarrantyDays} يوم</td>
                        <td className="p-4">
                          <div className="font-mono text-gray-400">فحص: {m.defaultInspectionPrice} ج.م</div>
                          <div className="font-mono text-teal-400 font-bold mt-0.5">إصلاح: {m.defaultRepairPrice} ج.م</div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                setEditingDmId(m.id);
                                setDmDeviceTypeId(m.deviceTypeId);
                                setDmNameAr(m.nameAr);
                                setDmNameEn(m.nameEn || "");
                                setDmCode(m.modelCode || "");
                                setDmStorage(m.storageOptions || "");
                                setDmWarranty(m.defaultWarrantyDays || 90);
                                setDmInspPrice(m.defaultInspectionPrice || 200);
                                setDmRepPrice(m.defaultRepairPrice || 1200);
                                setDmNotes(m.notes || "");
                                setDmActive(m.isActive !== false);
                              }}
                              className="p-1.5 bg-[#2a2d42]/40 hover:bg-indigo-600/20 hover:text-indigo-400 text-gray-400 rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteDeviceModelAction(m.id)}
                              className="p-1.5 bg-[#2a2d42]/40 hover:bg-red-600/20 hover:text-red-400 text-gray-400 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================
          TAB 4: COMMON FAULTS & PRICE CONFIGURATION
          ==================================================== */}
      {activeTab === "pricing" && (
        <div className="space-y-8">
          {/* Diagnostic templates / Common Faults form */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-[#11131e] border border-[#2a2d42] p-6 rounded-2xl h-fit space-y-4">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5 border-b border-[#2a2d42] pb-3">
                <Plus className="w-4 h-4 text-indigo-400" />
                {editingFaultId ? "تعديل قالب العطل الشائع" : "تسجيل عطل شائع جديد وقالب تشخيصي"}
              </h3>

              <form onSubmit={handleSaveCommonFault} className="space-y-4 text-xs">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">عائلة الجهاز / الكونسول المتوافق *</label>
                  <select
                    value={fDeviceType}
                    onChange={e => setFDeviceType(e.target.value)}
                    className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">اختر كونسول...</option>
                    {deviceTypes.filter(t => !t.isArchived).map(t => (
                      <option key={t.id} value={t.id}>{t.nameAr}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">اسم العطل بالعربية (يظهر للعميل) *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: منفذ HDMI مكسور ولا يعرض صورة"
                    value={fNameAr}
                    onChange={e => setFNameAr(e.target.value)}
                    className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">الاسم بالإنجليزي (إختياري)</label>
                  <input
                    type="text"
                    placeholder="e.g. HDMI port broken"
                    value={fNameEn}
                    onChange={e => setFNameEn(e.target.value)}
                    className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">تصنيف دائرة العطل</label>
                    <select
                      value={fCategory}
                      onChange={e => setFCategory(e.target.value)}
                      className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="أعطال الباور الكهربائي">أعطال الباور الكهربائي</option>
                      <option value="أعطال العرض والشبكة">أعطال العرض والشبكة</option>
                      <option value="أعطال التبريد والصيانة العامة">أعطال التبريد والصيانة العامة</option>
                      <option value="أعطال أجهزة التحكم">أعطال أجهزة التحكم</option>
                      <option value="أعطال قارئ الأقراص والعدسة">أعطال قارئ الأقراص والعدسة</option>
                      <option value="تعديل برمجيات وصيانة سيفتوير">تعديل برمجيات وصيانة سيفتوير</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">أولوية العطل التلقائية</label>
                    <select
                      value={fPriority}
                      onChange={e => setFPriority(e.target.value as any)}
                      className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    >
                      <option value="low">منخفضة (Low)</option>
                      <option value="medium">متوسطة (Medium)</option>
                      <option value="high">عاجل وفوري (High)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">كشف افتراضي</label>
                    <input
                      type="number"
                      value={fInspPrice}
                      onChange={e => setFInspPrice(Number(e.target.value))}
                      className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-2 py-1.5 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">إصلاح تقريبي</label>
                    <input
                      type="number"
                      value={fRepPrice}
                      onChange={e => setFRepPrice(Number(e.target.value))}
                      className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-2 py-1.5 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">أيام الضمان</label>
                    <input
                      type="number"
                      value={fWarranty}
                      onChange={e => setFWarranty(Number(e.target.value))}
                      className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-2 py-1.5 text-xs text-white font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">شكوى العميل المتوقعة (لشاشة الاستقبال)</label>
                  <textarea
                    placeholder="مثال: الجهاز شغال لمبة زرقاء لكن شاشة التلفاز سوداء تماماً..."
                    value={fCustDesc}
                    onChange={e => setFCustDesc(e.target.value)}
                    className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-3 py-2 text-xs text-white h-12"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">خطوات الفحص والتشخيص الهندسي (لشاشة الفني)</label>
                  <textarea
                    placeholder="مثال: فحص مسارات آيسيه فلترة التردد وقياس الممانعة على سوكيت الشاشة..."
                    value={fTechDiag}
                    onChange={e => setFTechDiag(e.target.value)}
                    className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-3 py-2 text-xs text-white h-12"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">توصيات وملاحظات الإصلاح التلقائية بالفاتورة</label>
                  <textarea
                    placeholder="مثال: تم لحام منفذ HDMI أصلي وتثبيت أرجل النحاس..."
                    value={fNotes}
                    onChange={e => setFNotes(e.target.value)}
                    className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-3 py-2 text-xs text-white h-12"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3 rounded-xl transition-colors cursor-pointer"
                >
                  {editingFaultId ? "تحديث قالب العطل" : "حفظ القالب التشخيصي والعطل"}
                </button>
              </form>
            </div>

            <div className="bg-[#11131e] border border-[#2a2d42] rounded-2xl lg:col-span-2 overflow-hidden shadow-xl">
              <div className="p-4 bg-gray-950/40 border-b border-[#2a2d42]">
                <h4 className="text-xs font-bold text-white">قوالب الأعطال الشائعة والحلول الهندسية المقترحة بالفحص</h4>
              </div>

              <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
                {commonFaults.map(cf => {
                  const dev = deviceTypes.find(t => t.id === cf.deviceTypeId);
                  return (
                    <div key={cf.id} className="bg-gray-950/40 p-4 rounded-xl border border-[#2a2d42] space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded text-[9px] font-bold">
                            {dev ? dev.nameAr : "جهاز عام"}
                          </span>
                          <h4 className="text-xs font-bold text-white mt-1.5">{cf.nameAr}</h4>
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => {
                              setEditingFaultId(cf.id);
                              setFNameAr(cf.nameAr);
                              setFNameEn(cf.nameEn || "");
                              setFDeviceType(cf.deviceTypeId);
                              setFCategory(cf.faultCategory);
                              setFCustDesc(cf.customerDescriptionAr || "");
                              setFTechDiag(cf.techDiagnosisTemplateAr || "");
                              setFNotes(cf.defaultRepairNotesAr || "");
                              setFInspPrice(cf.defaultInspectionPrice);
                              setFRepPrice(cf.defaultRepairPrice);
                              setFWarranty(cf.warrantyDays || 90);
                              setFPriority(cf.priority || "medium");
                            }}
                            className="p-1.5 bg-[#2a2d42]/60 hover:bg-indigo-600/20 hover:text-indigo-400 text-gray-400 rounded-lg cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteFaultAction(cf.id)}
                            className="p-1.5 bg-[#2a2d42]/60 hover:bg-red-600/20 hover:text-red-400 text-gray-400 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-[10px] text-gray-400 bg-black/30 p-2.5 rounded-lg font-mono">
                        <div>كشف: <span className="text-white font-bold">{cf.defaultInspectionPrice} ج.م</span></div>
                        <div>إصلاح: <span className="text-teal-400 font-bold">{cf.defaultRepairPrice} ج.م</span></div>
                        <div>ضمان: <span className="text-indigo-400 font-bold">{cf.warrantyDays} يوم</span></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Pricing Configurator Matrix */}
          <div className="bg-[#11131e] border border-[#2a2d42] p-6 rounded-2xl space-y-4 pt-6 border-t border-[#2a2d42]">
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5 border-b border-[#2a2d42] pb-3">
              <Sliders className="w-4 h-4 text-emerald-400" />
              مصفوفة تسعير الصيانة الموحدة حسب نوع العميل ومستوى الخدمة
            </h3>

            <form onSubmit={handleSaveDefaultPrice} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="text-xs text-gray-400 block mb-1">نوع الكونسول *</label>
                <select
                  required
                  value={prDeviceType}
                  onChange={e => setPrDeviceType(e.target.value)}
                  className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-3 py-2.5 text-xs text-white"
                >
                  <option value="">اختر كونسول...</option>
                  {deviceTypes.filter(t => !t.isArchived).map(t => (
                    <option key={t.id} value={t.id}>{t.nameAr}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">عطل شائع محدد لتخصيصه (اختياري)</label>
                <select
                  value={prFaultId}
                  onChange={e => setPrFaultId(e.target.value)}
                  className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-3 py-2.5 text-xs text-white"
                >
                  <option value="">عام لكامل فئة الجهاز</option>
                  {commonFaults.filter(f => f.deviceTypeId === prDeviceType).map(f => (
                    <option key={f.id} value={f.id}>{f.nameAr}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">تصنيف العميل المستهدف *</label>
                <select
                  value={prCustType}
                  onChange={e => setPrCustType(e.target.value as CustomerType)}
                  className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-3 py-2.5 text-xs text-white"
                >
                  <option value={CustomerType.Individual}>أفراد وعملاء نقدي</option>
                  <option value={CustomerType.Shop}>محلات تجارية وشركاء صيانة</option>
                  <option value={CustomerType.VIP}>عملاء VIP مميزين</option>
                  <option value={CustomerType.Wholesale}>حسابات جملة ومراكز متعاقدة</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">أيام الضمان المعتمدة</label>
                <input
                  type="number"
                  value={prWarranty}
                  onChange={e => setPrWarranty(Number(e.target.value))}
                  className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-3 py-2.5 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">قيمة الكشف الافتراضية</label>
                <input
                  type="number"
                  value={prInspPrice}
                  onChange={e => setPrInspPrice(Number(e.target.value))}
                  className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-3 py-2.5 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">سعر الإصلاح الموصى به</label>
                <input
                  type="number"
                  value={prRepPrice}
                  onChange={e => setPrRepPrice(Number(e.target.value))}
                  className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-3 py-2.5 text-xs text-white font-mono text-emerald-400 font-bold"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">الحد الأدنى لرسوم العمل الصافي</label>
                <input
                  type="number"
                  value={prMinPrice}
                  onChange={e => setPrMinPrice(Number(e.target.value))}
                  className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-3 py-2.5 text-xs text-white font-mono text-red-400"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-3.5 rounded-xl transition-all cursor-pointer"
                >
                  حفظ وضبط التسعيرة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================
          TAB 5: SERVICES, ACCESSORIES & CONDITIONS
          ==================================================== */}
      {activeTab === "configurators" && (
        <div className="space-y-8">
          {/* Section 1: Repair Services Labor Catalog */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-[#11131e] border border-[#2a2d42] p-6 rounded-2xl h-fit space-y-4">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5 border-b border-[#2a2d42] pb-3">
                <Plus className="w-4 h-4 text-indigo-400" />
                تسجيل خدمة صيانة (كتالوج المصنعية)
              </h3>

              <form onSubmit={handleSaveRepairService} className="space-y-4 text-xs">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">اسم خدمة الصيانة الدقيقة بالعربية *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: تغيير أرجل سوكيت شاشة HDMI"
                    value={srvNameAr}
                    onChange={e => setSrvNameAr(e.target.value)}
                    className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-2.5 text-white font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">الجهاز الرئيسي المتوافق *</label>
                  <select
                    value={srvDeviceType}
                    onChange={e => setSrvDeviceType(e.target.value)}
                    className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-2.5 text-white"
                  >
                    <option value="">اختر كونسول...</option>
                    {deviceTypes.filter(t => !t.isArchived).map(t => (
                      <option key={t.id} value={t.id}>{t.nameAr}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">مصنعية العمل (ج.م)</label>
                    <input
                      type="number"
                      value={srvLabor}
                      onChange={e => setSrvLabor(Number(e.target.value))}
                      className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-2 py-2 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">الحد الأدنى للمصنعية</label>
                    <input
                      type="number"
                      value={srvMin}
                      onChange={e => setSrvMin(Number(e.target.value))}
                      className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-2 py-2 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">أيام الضمان</label>
                    <input
                      type="number"
                      value={srvWarranty}
                      onChange={e => setSrvWarranty(Number(e.target.value))}
                      className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-2 py-2 text-white font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">تعليمات وتوصيات للمهندس / الفني</label>
                  <textarea
                    placeholder="احرص على رفع حماية الشبلونة البلاستيكية لحماية المعالج من الحرارة..."
                    value={srvInstructions}
                    onChange={e => setSrvInstructions(e.target.value)}
                    className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-3 py-2 text-xs text-white h-16"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3 rounded-xl transition-colors cursor-pointer"
                >
                  تسجيل الخدمة بالكتالوج
                </button>
              </form>
            </div>

            <div className="bg-[#11131e] border border-[#2a2d42] rounded-2xl lg:col-span-2 overflow-hidden shadow-xl">
              <div className="p-4 bg-gray-950/40 border-b border-[#2a2d42]">
                <h4 className="text-xs font-bold text-white">كتالوج وأسعار خدمات الصيانة المعتمدة بالورشة</h4>
              </div>

              <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                {repairServices.map(srv => {
                  const dev = deviceTypes.find(t => t.id === srv.deviceTypeId);
                  return (
                    <div key={srv.id} className="bg-gray-950/40 p-4 rounded-xl border border-[#2a2d42] flex justify-between items-center text-xs">
                      <div>
                        <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded text-[9px] font-bold">
                          {dev ? dev.nameAr : "جهاز عام"}
                        </span>
                        <h4 className="text-xs font-bold text-white mt-1.5">{srv.nameAr}</h4>
                      </div>
                      <div className="text-left font-mono">
                        <div className="text-gray-400">مصنعية فنية: <span className="text-white font-bold">{srv.defaultLaborPrice} ج.م</span></div>
                        <div className="text-[10px] text-gray-500 mt-1">الحد الأدنى المسموح: {srv.minPrice} ج.م | الضمان: {srv.warrantyDays} يوم</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 2: Accessories & Device Conditions Configuration lists */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-[#2a2d42]">
            {/* Accessories list */}
            <div className="bg-[#11131e] border border-[#2a2d42] p-6 rounded-2xl space-y-4">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5 border-b border-[#2a2d42] pb-3">
                <ClipboardList className="w-4 h-4 text-indigo-400" />
                ملحقات استلام الأجهزة المعتمدة (شاشة استقبال)
              </h3>

              <form onSubmit={handleAddAccessoryAction} className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="مثال: يد تحكم تيربو تجارية..."
                  value={accName}
                  onChange={e => setAccName(e.target.value)}
                  className="flex-1 bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
                />
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 rounded-xl cursor-pointer"
                >
                  إضافة
                </button>
              </form>

              <div className="space-y-2 max-h-[40vh] overflow-y-auto pt-2">
                {receivedAccessories.map(acc => (
                  <div key={acc.id} className="bg-gray-950/40 p-2.5 rounded-xl border border-[#2a2d42]/60 flex justify-between items-center text-xs">
                    <span className="text-white font-bold">{acc.nameAr}</span>
                    <button
                      onClick={() => deleteReceivedAccessory(acc.id)}
                      className="text-gray-500 hover:text-red-400 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Device Conditions list */}
            <div className="bg-[#11131e] border border-[#2a2d42] p-6 rounded-2xl space-y-4">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5 border-b border-[#2a2d42] pb-3">
                <ClipboardList className="w-4 h-4 text-teal-400" />
                خيارات تشخيص وفحص المظهر الخارجي للجهاز
              </h3>

              <form onSubmit={handleAddConditionAction} className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="مثال: كسر كامل بقشرة البدن البلاستيكية..."
                  value={condName}
                  onChange={e => setCondName(e.target.value)}
                  className="flex-1 bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
                />
                <button
                  type="submit"
                  className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-4 rounded-xl cursor-pointer"
                >
                  إضافة
                </button>
              </form>

              <div className="space-y-2 max-h-[40vh] overflow-y-auto pt-2">
                {deviceConditions.map(cond => (
                  <div key={cond.id} className="bg-gray-950/40 p-2.5 rounded-xl border border-[#2a2d42]/60 flex justify-between items-center text-xs">
                    <span className="text-white font-bold">{cond.nameAr}</span>
                    <button
                      onClick={() => deleteDeviceCondition(cond.id)}
                      className="text-gray-500 hover:text-red-400 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================
          TAB 5.5: REPAIR TEMPLATES MANAGEMENT
          ==================================================== */}
      {activeTab === "repair-templates" && <RepairTemplatesTab />}

      {/* ====================================================
          TAB 6: OPERATIONAL DATA RESET / DATA MANAGEMENT
          ==================================================== */}
      {(activeTab === "data-management" || activeTab === "system-reset") && <OperationalResetPanel />}

      {/* ====================================================
          TAB 7: BACKUP MANAGEMENT
          ==================================================== */}
      {activeTab === "backup-management" && <BackupManagementPanel />}
    </div>
  );
}
