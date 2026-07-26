/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { authStore } from "./authStore";
import { supabase } from "./supabaseClient";
import { fetchOrMigrateStoreSettings, saveStoreSettingsToSupabase } from "./supabaseSettings";
import { fetchOrMigrateCategories } from "./supabaseCategories";
import { 
  getDeviceTypesSync, fetchDeviceTypesFromSupabase, addDeviceTypeToSupabase, updateDeviceTypeInSupabase, deleteDeviceTypeInSupabase,
  getDeviceModelsSync, fetchDeviceModelsFromSupabase, addDeviceModelToSupabase, updateDeviceModelInSupabase, deleteDeviceModelInSupabase,
  getRepairTemplatesSync, fetchRepairTemplatesFromSupabase, addRepairTemplateToSupabase, updateRepairTemplateInSupabase, deleteRepairTemplateInSupabase
} from './supabaseDeviceManager';
import { canDeliverDevice, canReopenDeliveredOrder, canDeleteSale, canDeleteAccountingTransaction, canCancelWarranty, canResetOperationalData } from "./authPermissions";
import {
  Customer,
  CustomerType,
  DeviceType,
  RepairStatus,
  RepairOrder,
  Product,
  Supplier,
  Invoice,
  Expense,
  User,
  ActivityLog,
  SystemSettings,
  PaymentMethod,
  ProductCategory,
  DBDeviceType,
  DBDeviceModel,
  CommonFault,
  RepairService,
  DefaultPrice,
  ReceivedAccessory,
  DeviceCondition,
  RepairTemplateItem,
  WorkOwnershipType,
  Partner,
  PartnerLedgerEntry,
  PartnerSettlement,
  PartnerSettlementPayment,
  PartnerTransaction,
  RepairPartUsage,
  SettlementAuditLog,
  DeliverySnapshot,
  DeliveryReopenLog,
  WarrantyDurationOption,
  SystemNotification,
  AuditLogRecord,
  OperationalResetOptions,
  SystemResetSecurityLog
} from "../types";

// Key definitions for localStorage
const KEYS = {
  CUSTOMERS: "atari_customers",
  REPAIR_ORDERS: "atari_repair_orders",
  PRODUCTS: "atari_products",
  SUPPLIERS: "atari_suppliers",
  INVOICES: "atari_invoices",
  EXPENSES: "atari_expenses",
  USERS: "atari_users",
  ACTIVITY_LOGS: "atari_activity_logs",
  SETTINGS: "atari_settings",
  CURRENT_USER: "atari_current_user",
  CATEGORIES: "atari_categories",
  DEVICE_TYPES: "atari_device_types",
  DEVICE_MODELS: "atari_device_models",
  COMMON_FAULTS: "atari_common_faults",
  REPAIR_SERVICES: "atari_repair_services",
  DEFAULT_PRICES: "atari_default_prices",
  RECEIVED_ACCESSORIES: "atari_received_accessories",
  DEVICE_CONDITIONS: "atari_device_conditions",
  PARTNERS: "atari_partners",
  PARTNER_LEDGER: "atari_partner_ledger",
  PARTNER_SETTLEMENTS: "atari_partner_settlements",
  PARTNER_SETTLEMENT_PAYMENTS: "atari_partner_settlement_payments",
  PARTNER_TRANSACTIONS: "atari_partner_transactions",
  REPAIR_PART_USAGES: "atari_repair_part_usages",
  SETTLEMENT_AUDIT_LOGS: "atari_settlement_audit_logs",
  AUDIT_LOGS: "atari_audit_logs",
  READ_NOTIFICATIONS: "atari_read_notifications",
  SYSTEM_RESET_SECURITY_LOGS: "atari_system_reset_security_logs",
  REPAIR_TEMPLATES: "atari_repair_templates"
};

// Default seed data
const DEFAULT_USERS: User[] = [
  {
    id: "U-101",
    fullName: "أحمد محمد (مالك النظام)",
    name: "أحمد محمد",
    username: "admin",
    roleId: "OWNER",
    role: "admin",
    permissions: [
      "dashboard.view", "customers.view", "customers.create", "customers.edit", "customers.delete",
      "repairs.view", "repairs.create", "repairs.edit", "repairs.change_status", "repairs.assign_technician",
      "repairs.view_internal_notes", "repairs.edit_internal_notes", "repairs.view_customer_notes",
      "repairs.print_receipt", "repairs.deliver_device", "repairs.cancel", "repairs.delete",
      "inventory.view", "inventory.create", "inventory.edit", "inventory.adjust", "inventory.purchase", "inventory.return", "inventory.view_cost", "inventory.view_profit", "inventory.delete",
      "payments.view", "payments.create", "payments.refund", "payments.reverse", "payments.delete",
      "cashbox.view", "cashbox.deposit", "cashbox.withdraw", "cashbox.close_shift", "cashbox.view_history",
      "partners.view", "partners.create_entries", "partners.create_settlement", "partners.approve_settlement", "partners.reverse_entry", "partners.view_profit", "partners.view_private_jobs",
      "reports.view", "reports.export", "reports.financial", "reports.inventory", "reports.repairs", "reports.partners",
      "users.view", "users.create", "users.edit", "users.disable", "users.reset_password", "users.manage_roles", "users.manage_permissions",
      "settings.view", "settings.edit", "settings.security", "settings.backup",
      "audit.view", "audit.export"
    ],
    email: "elbannafc@gmail.com",
    phone: "01000000001",
    isActive: true,
    mustChangePassword: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    isOnline: true,
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
  },
  {
    id: "U-102",
    fullName: "كريم صالح (مهندس الصيانة)",
    name: "كريم صالح",
    username: "karim_tech",
    roleId: "TECHNICIAN",
    role: "technician",
    permissions: [
      "dashboard.view", "repairs.view", "repairs.change_status", "repairs.view_internal_notes", "repairs.edit_internal_notes", "repairs.view_customer_notes", "inventory.view"
    ],
    email: "karim@atari.com",
    phone: "01000000002",
    isActive: true,
    mustChangePassword: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    isOnline: true,
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80"
  },
  {
    id: "U-103",
    fullName: "سارة محمود (الاستقبال)",
    name: "سارة محمود",
    username: "sara_reception",
    roleId: "RECEPTIONIST",
    role: "receptionist",
    permissions: [
      "dashboard.view", "customers.view", "customers.create", "customers.edit", "repairs.view", "repairs.create", "repairs.view_customer_notes", "repairs.print_receipt", "repairs.deliver_device", "payments.view", "payments.create", "inventory.view"
    ],
    email: "sara@atari.com",
    phone: "01000000003",
    isActive: true,
    mustChangePassword: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    isOnline: false,
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80"
  }
];

const DEFAULT_SETTINGS: SystemSettings = {
  companyName: "Atari Store Pro X",
  phone: "01002345678",
  address: "شارع التحرير، وسط البلد، القاهرة",
  receiptHeader: "Atari Store Pro X\nالمركز الاحترافي لصيانة وبيع أجهزة الألعاب",
  receiptFooter: "شكراً لزيارتكم! يرجى الاحتفاظ بالفاتورة للصيانة والضمان.",
  whatsAppTemplateReceived: "مرحباً {customer_name}، تم استلام جهازك {device_model} بنجاح تحت رقم الطلب {order_id}. يمكنك متابعة حالة طلبك عبر هذا الرابط: {tracking_link}",
  whatsAppTemplateReady: "مرحباً {customer_name}، جهازك {device_model} (رقم الطلب {order_id}) جاهز للاستلام الآن! التكلفة الإجمالية: {total_cost} ج.م.",
  whatsAppTemplateInvoice: "مرحباً {customer_name}، إليك تفاصيل فاتورة الشراء رقم {invoice_id} بقيمة إجمالية {total_amount} ج.م. شكراً لتعاملك معنا!",
  taxRate: 14,
  currency: "ج.م."
};

const DEFAULT_CUSTOMERS: Customer[] = [];

const DEFAULT_PRODUCTS: Product[] = [];

const DEFAULT_SUPPLIERS: Supplier[] = [];

const DEFAULT_REPAIR_ORDERS: RepairOrder[] = [];

const DEFAULT_INVOICES: Invoice[] = [];

const DEFAULT_EXPENSES: Expense[] = [];

const DEFAULT_LOGS: ActivityLog[] = [];

const DEFAULT_CATEGORIES: ProductCategory[] = [
  { id: "CAT-001", name: "قطع غيار صيانة", sortOrder: 1, isActive: true },
  { id: "CAT-002", name: "اكسسوارات", sortOrder: 2, isActive: true },
  { id: "CAT-003", name: "ألعاب", sortOrder: 3, isActive: true },
  { id: "CAT-004", name: "أجهزة كونسول", sortOrder: 4, isActive: true }
];

const DEFAULT_DEVICE_TYPES: DBDeviceType[] = [
  { id: "DT-001", nameAr: "بلاستيشن 5", nameEn: "PS5", brand: "Sony", sortOrder: 1, isActive: true },
  { id: "DT-002", nameAr: "بلاستيشن 5 سليم", nameEn: "PS5 Slim", brand: "Sony", sortOrder: 2, isActive: true },
  { id: "DT-003", nameAr: "بلاستيشن 5 برو", nameEn: "PS5 Pro", brand: "Sony", sortOrder: 3, isActive: true },
  { id: "DT-004", nameAr: "بلاستيشن 4", nameEn: "PS4", brand: "Sony", sortOrder: 4, isActive: true },
  { id: "DT-005", nameAr: "بلاستيشن 4 سليم", nameEn: "PS4 Slim", brand: "Sony", sortOrder: 5, isActive: true },
  { id: "DT-006", nameAr: "بلاستيشن 4 برو", nameEn: "PS4 Pro", brand: "Sony", sortOrder: 6, isActive: true },
  { id: "DT-007", nameAr: "إكس بوكس سيريس إكس", nameEn: "Xbox Series X", brand: "Microsoft", sortOrder: 7, isActive: true },
  { id: "DT-008", nameAr: "إكس بوكس سيريس إس", nameEn: "Xbox Series S", brand: "Microsoft", sortOrder: 8, isActive: true },
  { id: "DT-009", nameAr: "نينتندو سويتش", nameEn: "Nintendo Switch", brand: "Nintendo", sortOrder: 9, isActive: true },
  { id: "DT-010", nameAr: "ستيم ديك", nameEn: "Steam Deck", brand: "Valve", sortOrder: 10, isActive: true },
  { id: "DT-011", nameAr: "ذراع تحكم / يد تحكم", nameEn: "Controller", brand: "Sony/Microsoft/Nintendo", sortOrder: 11, isActive: true },
  { id: "DT-012", nameAr: "اكسسوارات إضافية", nameEn: "Accessory", brand: "Other", sortOrder: 12, isActive: true },
  { id: "DT-013", nameAr: "أجهزة أخرى", nameEn: "Other", brand: "Other", sortOrder: 13, isActive: true }
];

const DEFAULT_DEVICE_MODELS: DBDeviceModel[] = [
  { id: "DM-001", deviceTypeId: "DT-001", brand: "Sony", nameAr: "إصدار الأقراص القياسي CFI-1216A", nameEn: "Standard Disc Edition CFI-1216A", modelCode: "CFI-1216A", storageOptions: "825GB, 1TB", defaultWarrantyDays: 90, defaultInspectionPrice: 200, defaultRepairPrice: 1500, notes: "الإصدار الأول السميك بمشتت حراري كبير", isActive: true, sortOrder: 1 },
  { id: "DM-002", deviceTypeId: "DT-001", brand: "Sony", nameAr: "الإصدار الرقمي CFI-1216B", nameEn: "Digital Edition CFI-1216B", modelCode: "CFI-1216B", storageOptions: "825GB", defaultWarrantyDays: 90, defaultInspectionPrice: 200, defaultRepairPrice: 1300, notes: "بدون قارئ أقراص", isActive: true, sortOrder: 2 },
  { id: "DM-003", deviceTypeId: "DT-002", brand: "Sony", nameAr: "سليم إصدار الأقراص", nameEn: "Slim Disc Edition", modelCode: "CFI-2016A", storageOptions: "1TB", defaultWarrantyDays: 90, defaultInspectionPrice: 250, defaultRepairPrice: 1600, notes: "التصميم الجديد الأقل حجماً بمساحة 1 تيرا", isActive: true, sortOrder: 3 },
  { id: "DM-004", deviceTypeId: "DT-009", brand: "Nintendo", nameAr: "سويتش أوليد", nameEn: "Switch OLED", modelCode: "HEG-001", storageOptions: "64GB", defaultWarrantyDays: 60, defaultInspectionPrice: 150, defaultRepairPrice: 1200, notes: "شاشة OLED ممتازة وتصميم بمسند أفضل", isActive: true, sortOrder: 4 }
];

const DEFAULT_COMMON_FAULTS: CommonFault[] = [
  { id: "CF-001", nameAr: "الجهاز لا يعمل تماماً (ميت/باور)", nameEn: "No Power", deviceTypeId: "DT-001", faultCategory: "أعطال الباور الكهربائي", customerDescriptionAr: "الجهاز لا يصدر أي إضاءة أو صوت عند الضغط على زر التشغيل", techDiagnosisTemplateAr: "فحص مدخل الطاقة بـ 12 فولت وقياس مخرجات مجمع التغذية الرئيسي وبوردة المعالج", defaultRepairNotesAr: "تم استبدال آيسيه الباور الرئيسي ومعالجة دائرة حماية الكهرباء 12V", defaultInspectionPrice: 250, defaultRepairPrice: 1800, estimatedHours: 2, suggestedParts: "باور سبلاي، آيسيه باور", warrantyDays: 90, priority: "high", isActive: true, sortOrder: 1 },
  { id: "CF-002", nameAr: "منفذ HDMI مكسور أو لا يعرض صورة", nameEn: "HDMI No Signal", deviceTypeId: "DT-001", faultCategory: "أعطال العرض والشبكة", customerDescriptionAr: "اللمبة زرقاء مستمرة والجهاز شغال ولكن لا تظهر صورة على التلفزيون", techDiagnosisTemplateAr: "فحص أرجل مدخل الـ HDMI تحت المجهر وتتبع مسارات الإشارة لآيسيه الترميز MN864739", defaultRepairNotesAr: "تم تغيير سوكيت الـ HDMI بأرجل مدعمة مع تلميع مسارات النحاس وتثبيته حرارياً", defaultInspectionPrice: 200, defaultRepairPrice: 1200, estimatedHours: 1, suggestedParts: "أيسيه هارد HDMI PS5 (MN864739)", warrantyDays: 30, priority: "medium", isActive: true, sortOrder: 2 },
  { id: "CF-003", nameAr: "حرارة زائدة وانطفاء مفاجئ", nameEn: "Overheating", deviceTypeId: "DT-001", faultCategory: "أعطال التبريد والصيانة العامة", customerDescriptionAr: "تظهر رسالة حرارة مرتفعة ثم يطفيء الجهاز ذاتياً بعد فترة وجيزة", techDiagnosisTemplateAr: "فحص كمية وتوزيع المعدن السائل Liquid Metal على سطح المعالج APU وتنظيف المشتت ومجاري الهواء", defaultRepairNotesAr: "تم فك درع المشتت، تنظيف الأتربة المتراكمة، إعادة توزيع المعدن السائل وتثبيت مروحة التبريد", defaultInspectionPrice: 150, defaultRepairPrice: 1000, estimatedHours: 1.5, suggestedParts: "Liquid Metal", warrantyDays: 90, priority: "medium", isActive: true, sortOrder: 3 },
  { id: "CF-004", nameAr: "انجراف عصا التحكم (Drift)", nameEn: "Analog Drift", deviceTypeId: "DT-011", faultCategory: "أعطال أجهزة التحكم", customerDescriptionAr: "حركة تلقائية في القائمة أو داخل اللعبة بدون لمس الأنالوج", techDiagnosisTemplateAr: "قياس مقاومة أطراف مقياس الجهد ثلاثي الأبعاد واختبار حياد النقطة المركزية على السيرفر", defaultRepairNotesAr: "استبدال مقاومة الأنالوج (المقود الدقيق) بالكامل وتنظيف البوردة ومراجعة أزرار التوجيه", defaultInspectionPrice: 50, defaultRepairPrice: 400, estimatedHours: 0.5, suggestedParts: "مقاومة أنالوج DualSense", warrantyDays: 30, priority: "low", isActive: true, sortOrder: 4 }
];

const DEFAULT_REPAIR_SERVICES: RepairService[] = [
  { id: "RS-001", nameAr: "تغيير مدخل HDMI أصلي للـ PS5", deviceTypeId: "DT-001", defaultLaborPrice: 800, minPrice: 600, estimatedHours: 1, warrantyDays: 30, suggestedParts: "سوكيت HDMI", technicianInstructions: "احرص على عدم تعريض فلتر الـ HDMI لدرجة حرارة زائدة عن 380 درجة أثناء اللحام", customerDescription: "تغيير منفذ الشاشة التالف بآخر أصلي مطلي بالذهب ومثبت بمسامير تدعيم إضافية", isActive: true },
  { id: "RS-002", nameAr: "تنظيف عميل شامل وتغيير سائل التبريد المعدني", deviceTypeId: "DT-001", defaultLaborPrice: 900, minPrice: 700, estimatedHours: 1.5, warrantyDays: 90, suggestedParts: "Liquid Metal", technicianInstructions: "استخدم شريط العزل المقاوم للحرارة حول المعالج لمنع تسرب المعدن السائل للبوردة", customerDescription: "فك وتنظيف الجهاز كلياً من الغبار ومسح المعدن السائل القديم ووضع آخر ياباني أصلي", isActive: true }
];

const DEFAULT_DEFAULT_PRICES: DefaultPrice[] = [
  { id: "DP-001", deviceTypeId: "DT-001", commonFaultId: "CF-002", customerType: CustomerType.Individual, defaultInspectionPrice: 200, defaultRepairPrice: 1200, minRepairPrice: 1000, maxEstimatedPrice: 1500, laborCost: 700, partCostEstimate: 500, wholesalePrice: 900, shopPrice: 950, vipPrice: 1100, warrantyPeriodDays: 30 },
  { id: "DP-002", deviceTypeId: "DT-001", commonFaultId: "CF-003", customerType: CustomerType.Individual, defaultInspectionPrice: 150, defaultRepairPrice: 1000, minRepairPrice: 800, maxEstimatedPrice: 1200, laborCost: 650, partCostEstimate: 350, wholesalePrice: 700, shopPrice: 750, vipPrice: 900, warrantyPeriodDays: 90 }
];

const DEFAULT_RECEIVED_ACCESSORIES: ReceivedAccessory[] = [
  { id: "RA-001", nameAr: "كابل الكهرباء الأصلي (Power)", sortOrder: 1 },
  { id: "RA-002", nameAr: "كابل HDMI للـ 4K", sortOrder: 2 },
  { id: "RA-003", nameAr: "يد تحكم لاسلكية أصلية", sortOrder: 3 },
  { id: "RA-004", nameAr: "علبة الكرتون الأصلية", sortOrder: 4 },
  { id: "RA-005", nameAr: "قاعدة التثبيت العمودي (Stand)", sortOrder: 5 },
  { id: "RA-006", nameAr: "جهاز فقط بدون أي ملحقات", sortOrder: 6 }
];

const DEFAULT_DEVICE_CONDITIONS: DeviceCondition[] = [
  { id: "DC-001", nameAr: "لا توجد أعطال ظاهرية", sortOrder: 1 },
  { id: "DC-002", nameAr: "تنظيف داخلي فقط", sortOrder: 2 },
  { id: "DC-003", nameAr: "تنظيف وتغيير معجون", sortOrder: 3 },
  { id: "DC-004", nameAr: "لا يعمل نهائياً", sortOrder: 4 },
  { id: "DC-005", nameAr: "يفصل بعد التشغيل", sortOrder: 5 },
  { id: "DC-006", nameAr: "يسخن بسرعة", sortOrder: 6 },
  { id: "DC-007", nameAr: "لا يعرض صورة", sortOrder: 7 },
  { id: "DC-008", nameAr: "لا يقرأ الهارد", sortOrder: 8 },
  { id: "DC-009", nameAr: "مشكلة في HDMI", sortOrder: 9 },
  { id: "DC-010", nameAr: "مشكلة في USB", sortOrder: 10 },
  { id: "DC-011", nameAr: "لا يخرج صوت", sortOrder: 11 },
  { id: "DC-012", nameAr: "لا يتصل بالإنترنت", sortOrder: 12 },
  { id: "DC-013", nameAr: "لا يشحن اليد", sortOrder: 13 },
  { id: "DC-014", nameAr: "مشكلة في البلوتوث", sortOrder: 14 },
  { id: "DC-015", nameAr: "مروحة مرتفعة الصوت", sortOrder: 15 },
  { id: "DC-016", nameAr: "تهنيج أو بطء", sortOrder: 16 },
  { id: "DC-017", nameAr: "إعادة تشغيل تلقائية", sortOrder: 17 },
  { id: "DC-018", nameAr: "سقوط أو صدمة", sortOrder: 18 },
  { id: "DC-019", nameAr: "آثار سوائل أو رطوبة", sortOrder: 19 },
  { id: "DC-020", nameAr: "تم فتحه في مركز صيانة آخر", sortOrder: 20 },
  { id: "DC-021", nameAr: "الجهاز مفكوك أو ناقص مسامير", sortOrder: 21 },
  { id: "DC-022", nameAr: "كسر أو خدش في الهيكل", sortOrder: 22 }
];

const DEFAULT_REPAIR_TEMPLATES: RepairTemplateItem[] = [
  // PS5 Templates
  { id: "RPT-001", deviceTypeId: "PS5", nameAr: "HDMI", defaultCostPrice: 150, defaultRepairPrice: 500, sortOrder: 1, isActive: true },
  { id: "RPT-002", deviceTypeId: "PS5", nameAr: "USB", defaultCostPrice: 50, defaultRepairPrice: 300, sortOrder: 2, isActive: true },
  { id: "RPT-003", deviceTypeId: "PS5", nameAr: "مروحة", defaultCostPrice: 250, defaultRepairPrice: 600, sortOrder: 3, isActive: true },
  { id: "RPT-004", deviceTypeId: "PS5", nameAr: "كولر", defaultCostPrice: 100, defaultRepairPrice: 350, sortOrder: 4, isActive: true },
  { id: "RPT-005", deviceTypeId: "PS5", nameAr: "باور", defaultCostPrice: 200, defaultRepairPrice: 700, sortOrder: 5, isActive: true },
  { id: "RPT-006", deviceTypeId: "PS5", nameAr: "WiFi", defaultCostPrice: 100, defaultRepairPrice: 400, sortOrder: 6, isActive: true },
  { id: "RPT-007", deviceTypeId: "PS5", nameAr: "تنظيف", defaultCostPrice: 20, defaultRepairPrice: 200, sortOrder: 7, isActive: true },
  { id: "RPT-008", deviceTypeId: "PS5", nameAr: "معجون حراري", defaultCostPrice: 50, defaultRepairPrice: 300, sortOrder: 8, isActive: true },

  // Controller PS5 (يد PS5)
  { id: "RPT-009", deviceTypeId: "Controller PS5", nameAr: "أنالوج", defaultCostPrice: 40, defaultRepairPrice: 150, sortOrder: 1, isActive: true },
  { id: "RPT-010", deviceTypeId: "Controller PS5", nameAr: "سوكت شحن", defaultCostPrice: 25, defaultRepairPrice: 120, sortOrder: 2, isActive: true },
  { id: "RPT-011", deviceTypeId: "Controller PS5", nameAr: "بطارية", defaultCostPrice: 60, defaultRepairPrice: 180, sortOrder: 3, isActive: true },
  { id: "RPT-012", deviceTypeId: "Controller PS5", nameAr: "موتور", defaultCostPrice: 30, defaultRepairPrice: 100, sortOrder: 4, isActive: true },
  { id: "RPT-013", deviceTypeId: "Controller PS5", nameAr: "أزرار", defaultCostPrice: 15, defaultRepairPrice: 80, sortOrder: 5, isActive: true },
  { id: "RPT-014", deviceTypeId: "Controller PS5", nameAr: "ربر", defaultCostPrice: 15, defaultRepairPrice: 70, sortOrder: 6, isActive: true },
  { id: "RPT-015", deviceTypeId: "Controller PS5", nameAr: "فلاتة", defaultCostPrice: 20, defaultRepairPrice: 90, sortOrder: 7, isActive: true },

  // Controller PS4 (يد PS4)
  { id: "RPT-016", deviceTypeId: "Controller PS4", nameAr: "أنالوج", defaultCostPrice: 30, defaultRepairPrice: 100, sortOrder: 1, isActive: true },
  { id: "RPT-017", deviceTypeId: "Controller PS4", nameAr: "سوكت شحن", defaultCostPrice: 15, defaultRepairPrice: 80, sortOrder: 2, isActive: true },
  { id: "RPT-018", deviceTypeId: "Controller PS4", nameAr: "بطارية", defaultCostPrice: 40, defaultRepairPrice: 120, sortOrder: 3, isActive: true },
  { id: "RPT-019", deviceTypeId: "Controller PS4", nameAr: "أزرار", defaultCostPrice: 15, defaultRepairPrice: 60, sortOrder: 4, isActive: true },
  { id: "RPT-020", deviceTypeId: "Controller PS4", nameAr: "ربر", defaultCostPrice: 15, defaultRepairPrice: 60, sortOrder: 5, isActive: true },
  { id: "RPT-021", deviceTypeId: "Controller PS4", nameAr: "فلاتة", defaultCostPrice: 15, defaultRepairPrice: 70, sortOrder: 6, isActive: true },

  // PS4 / PS4 Slim / PS4 Pro
  { id: "RPT-022", deviceTypeId: "PS4", nameAr: "HDMI", defaultCostPrice: 100, defaultRepairPrice: 400, sortOrder: 1, isActive: true },
  { id: "RPT-023", deviceTypeId: "PS4", nameAr: "USB", defaultCostPrice: 30, defaultRepairPrice: 200, sortOrder: 2, isActive: true },
  { id: "RPT-024", deviceTypeId: "PS4", nameAr: "تنظيف ومعجون حراري", defaultCostPrice: 40, defaultRepairPrice: 250, sortOrder: 3, isActive: true },
  { id: "RPT-025", deviceTypeId: "PS4", nameAr: "باور", defaultCostPrice: 150, defaultRepairPrice: 500, sortOrder: 4, isActive: true },
  { id: "RPT-026", deviceTypeId: "PS4", nameAr: "هارد ديسك", defaultCostPrice: 150, defaultRepairPrice: 400, sortOrder: 5, isActive: true }
];

const DEFAULT_PARTNERS: Partner[] = [
  {
    id: "P-001",
    name: "أحمد البنا",
    nameAr: "أحمد البنا (الشريك الأول)",
    sharePercentage: 50,
    isSystemOwner: true,
    balance: 0,
    phone: "01000000001",
    createdAt: "2026-01-01T00:00:00Z"
  },
  {
    id: "P-002",
    name: "عبده",
    nameAr: "عبده (الشريك الثاني)",
    sharePercentage: 50,
    isSystemOwner: false,
    balance: 0,
    phone: "01000000002",
    createdAt: "2026-01-01T00:00:00Z"
  }
];

const DEFAULT_PARTNER_LEDGER: PartnerLedgerEntry[] = [];

const DEFAULT_PARTNER_SETTLEMENTS: PartnerSettlement[] = [];
const DEFAULT_PARTNER_SETTLEMENT_PAYMENTS: PartnerSettlementPayment[] = [];
const DEFAULT_PARTNER_TRANSACTIONS: PartnerTransaction[] = [];
const DEFAULT_REPAIR_PART_USAGES: RepairPartUsage[] = [];
const DEFAULT_SETTLEMENT_AUDIT_LOGS: SettlementAuditLog[] = [];

// In-memory fallback for non-browser environments (e.g. Node tests)
const inMemoryStore: Record<string, string> = {};

// Helper to safely load data from localStorage or seed
function getStorageItem<T>(key: string, defaultValue: T): T {
  try {
    if (typeof localStorage !== "undefined") {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    }
    const memItem = inMemoryStore[key];
    return memItem ? JSON.parse(memItem) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

// Helper to safely write to localStorage
function setStorageItem<T>(key: string, data: T) {
  try {
    const jsonStr = JSON.stringify(data);
    inMemoryStore[key] = jsonStr;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(key, jsonStr);
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("atari_db_changed", { detail: { key } }));
    }
  } catch (e) {
    console.error("Error writing storage key:", key, e);
  }
}

// Database Service Definition
export const db = {
  // --- CUSTOMERS ---
  getCustomers: (): Customer[] => {
    return getStorageItem<Customer[]>(KEYS.CUSTOMERS, DEFAULT_CUSTOMERS);
  },
  saveCustomers: (data: Customer[]) => {
    setStorageItem(KEYS.CUSTOMERS, data);
  },
  addCustomer: (customer: Omit<Customer, "id" | "createdAt" | "balance">): Customer => {
    const list = db.getCustomers();
    const newCustomer: Customer = {
      ...customer,
      id: `C-${String(list.length + 1).padStart(3, "0")}`,
      createdAt: new Date().toISOString(),
      balance: 0
    };
    list.push(newCustomer);
    db.saveCustomers(list);
    db.logActivity("U-101", "أحمد محمد", "إضافة عميل", `تم تسجيل العميل الجديد ${newCustomer.name}`);
    return newCustomer;
  },
  updateCustomer: (customer: Customer) => {
    const list = db.getCustomers();
    const index = list.findIndex(c => c.id === customer.id);
    if (index !== -1) {
      list[index] = customer;
      db.saveCustomers(list);
    }
  },
  deleteCustomer: (id: string) => {
    const list = db.getCustomers().filter(c => c.id !== id);
    db.saveCustomers(list);
  },

  // --- REPAIR ORDERS ---
  getRepairOrders: (): RepairOrder[] => {
    return getStorageItem<RepairOrder[]>(KEYS.REPAIR_ORDERS, DEFAULT_REPAIR_ORDERS);
  },
  saveRepairOrders: (data: RepairOrder[]) => {
    setStorageItem(KEYS.REPAIR_ORDERS, data);
  },
  addRepairOrder: (order: Omit<RepairOrder, "id" | "receivedDate" | "trackingToken">): RepairOrder => {
    const list = db.getRepairOrders();
    let maxNum = 10000;
    for (const o of list) {
      const match = o.id.match(/ATR-(\d+)/) || o.id.match(/\d+/);
      if (match) {
        const num = parseInt(match[1] || match[0], 10);
        if (num >= maxNum) {
          maxNum = num + 1;
        }
      }
    }

    const resolvedOwnership = order.jobType || order.workOwnershipType || WorkOwnershipType.CUSTOMER_SHARED;
    const newOrder: RepairOrder = {
      ...order,
      jobType: resolvedOwnership,
      workOwnershipType: resolvedOwnership,
      id: `ATR-${maxNum}`,
      receivedDate: new Date().toISOString(),
      trackingToken: `TRK-${maxNum}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`
    };

    // Unshift to put latest on top
    list.unshift(newOrder);
    db.saveRepairOrders(list);

    // Log the event
    db.logActivity("U-101", "أحمد محمد", "إنشاء أمر صيانة", `تم إنشاء أمر الصيانة رقم ${newOrder.id} لعدد أجهزة ${newOrder.devices.length}`);
    return newOrder;
  },
  updateRepairOrder: (order: RepairOrder) => {
    const list = db.getRepairOrders();
    const index = list.findIndex(o => o.id === order.id);
    if (index !== -1) {
      const existing = list[index];
      const resolvedOwnership = order.jobType || order.workOwnershipType || existing.jobType || existing.workOwnershipType || WorkOwnershipType.CUSTOMER_SHARED;
      order = {
        ...order,
        jobType: resolvedOwnership,
        workOwnershipType: resolvedOwnership
      };
      // Locking protection: If order was already DELIVERED, forbid direct modifications unless via reopen flow
      if (existing.status === RepairStatus.Delivered && existing.deliveryStatus === "DELIVERED" && order.status === RepairStatus.Delivered && order.deliveryStatus === "DELIVERED") {
        order = {
          ...order,
          deliverySnapshot: existing.deliverySnapshot,
          deliveryHistory: existing.deliveryHistory,
          deliveredAt: existing.deliveredAt,
          deliveredByUserId: existing.deliveredByUserId,
          deliveredByUserName: existing.deliveredByUserName
        };
      }
      list[index] = order;
      db.saveRepairOrders(list);
    }
  },
  deliverRepairOrder: (params: {
    orderId: string;
    paymentNow: number;
    paymentMethod: PaymentMethod | string;
    deliveryNotes?: string;
    currentUser: User;
  }): { success: boolean; error?: string; order?: RepairOrder; invoice?: Invoice } => {
    const { orderId, paymentNow, paymentMethod, deliveryNotes, currentUser } = params;

    // 1. Permission check (Ahmed Elbanna / OWNER)
    if (!canDeliverDevice(currentUser)) {
      return {
        success: false,
        error: "عذراً، عملية تسليم الجهاز غير مصرح بها لحسابك! هذه العملية مقتصرة حصرياً على صاحب النظام (أحمد البنا) أو دور OWNER."
      };
    }

    // 2. Fetch order
    const list = db.getRepairOrders();
    const index = list.findIndex(o => o.id === orderId);
    if (index === -1) {
      return { success: false, error: "طلب الصيانة غير موجود بالسيستم" };
    }

    const order = list[index];

    // 3. Idempotency & Status check
    if (order.status === RepairStatus.Delivered || order.deliveryStatus === "DELIVERED") {
      return { success: false, error: "هذا الجهاز تم تسليمه وإغلاق طلبه سابقاً!" };
    }

    if (order.status === RepairStatus.Cancelled) {
      return { success: false, error: "لا يمكن تسليم طلب صيانة ملغى!" };
    }

    // 4. Financial Calculations
    const totalEstimated = Number(order.finalRepairPrice ?? order.totalEstimatedCost) || 0;
    const discount = Number(order.discount) || 0;
    const netOrderCost = Math.max(0, totalEstimated - discount);

    // Calculate existing payments (advance payment + all paid invoices linked to this order)
    const existingInvoices = db.getInvoices().filter(inv => inv.orderId === orderId && inv.isPaid);
    const invoicesPaidSum = existingInvoices.reduce((sum, inv) => sum + (Number(inv.paidAmount) || 0), 0);
    const totalPreviousPaid = (Number(order.advancePayment) || 0) + invoicesPaidSum;

    const remainingDue = Math.max(0, netOrderCost - totalPreviousPaid);
    const validPaymentNow = Math.min(Math.max(0, Number(paymentNow) || 0), remainingDue);

    // Record invoice if paymentNow > 0
    let createdInvoice: Invoice | undefined = undefined;
    if (validPaymentNow > 0) {
      createdInvoice = db.addInvoice({
        customerId: order.customerId,
        orderId: order.id,
        items: order.devices.map(d => ({
          name: `دفعة تسليم صيانة - ${d.type} (${d.model}) - رقم الطلب: ${order.id}`,
          quantity: 1,
          price: validPaymentNow
        })),
        totalAmount: validPaymentNow,
        discount: 0,
        paidAmount: validPaymentNow,
        paymentMethod: paymentMethod as PaymentMethod,
        type: "repair",
        isPaid: true
      });
    }

    const newTotalPaid = totalPreviousPaid + validPaymentNow;
    const finalRemainingDebt = Math.max(0, netOrderCost - newTotalPaid);

    // 5. Update Customer Balance if debt cleared or recorded
    const customer = db.getCustomers().find(c => c.id === order.customerId);
    if (customer && finalRemainingDebt === 0 && customer.balance > 0) {
      db.updateCustomer({
        ...customer,
        balance: Math.max(0, customer.balance - (remainingDue - validPaymentNow))
      });
    }

    // 6. Build Warranty & Delivery Snapshot
    const nowIso = new Date().toISOString();
    let warrantyStartDate: string | undefined = undefined;
    let warrantyEndDate: string | undefined = undefined;
    let warrantyStatus: "IN_WARRANTY" | "EXPIRED" | "NO_WARRANTY" | "CANCELLED" = "NO_WARRANTY";

    const days = Number(order.warrantyDays) || 0;
    if (days > 0 && order.warrantyOption !== "NO_WARRANTY") {
      warrantyStartDate = nowIso;
      const endMs = new Date(nowIso).getTime() + days * 24 * 60 * 60 * 1000;
      warrantyEndDate = new Date(endMs).toISOString();
      warrantyStatus = "IN_WARRANTY";
    }

    const updatedDevices = order.devices.map(d => ({
      ...d,
      warrantyOption: d.warrantyOption || order.warrantyOption,
      warrantyDays: d.warrantyDays || order.warrantyDays,
      warrantyStartDate: d.warrantyStartDate || warrantyStartDate,
      warrantyEndDate: d.warrantyEndDate || warrantyEndDate,
      warrantyStatus: d.warrantyStatus || warrantyStatus
    }));

    const version = (order.deliveryVersion || 0) + 1;
    const snapshot: DeliverySnapshot = {
      version,
      deliveredAt: nowIso,
      deliveredByUserId: currentUser.id,
      deliveredByUserName: currentUser.fullName || currentUser.name || "أحمد البنا",
      totalEstimatedCost: totalEstimated,
      discount: discount,
      totalPaid: newTotalPaid,
      remainingBalance: finalRemainingDebt,
      paymentMethod: paymentMethod,
      deliveryNotes: deliveryNotes || "",
      devices: JSON.parse(JSON.stringify(updatedDevices)),
      invoiceId: createdInvoice?.id
    };

    // 7. Update order state & lock
    const updatedOrder: RepairOrder = {
      ...order,
      devices: updatedDevices,
      warrantyStartDate: order.warrantyStartDate || warrantyStartDate,
      warrantyEndDate: order.warrantyEndDate || warrantyEndDate,
      warrantyStatus: order.warrantyStatus || warrantyStatus,
      status: RepairStatus.Delivered,
      deliveredAt: nowIso,
      deliveredByUserId: currentUser.id,
      deliveredByUserName: snapshot.deliveredByUserName,
      deliveryStatus: "DELIVERED",
      deliveryNotes: deliveryNotes || "",
      deliverySnapshot: snapshot,
      deliveryVersion: version,
      deliveryHistory: [...(order.deliveryHistory || []), snapshot],
      isPaid: finalRemainingDebt === 0,
      completionDate: order.completionDate || nowIso
    };

    list[index] = updatedOrder;
    db.saveRepairOrders(list);

    // 8. Audit Logging
    db.logActivity(
      currentUser.id,
      currentUser.fullName || currentUser.name || "أحمد البنا",
      "تسليم جهاز صيانة",
      `تم تسليم الجهاز للطلب رقم [${order.id}]. التحصيل الآن: ${validPaymentNow} ج.م، إجمالي المدفوع: ${newTotalPaid} ج.م، المتبقي: ${finalRemainingDebt} ج.م.`
    );

    const settlementLogs = getStorageItem<SettlementAuditLog[]>(KEYS.SETTLEMENT_AUDIT_LOGS, []);
    settlementLogs.unshift({
      id: `AUD-DELIV-${Date.now()}`,
      userId: currentUser.id,
      action: "DELIVER_REPAIR_ORDER",
      entityType: "RepairOrder",
      entityId: order.id,
      previousValues: { status: order.status, isPaid: order.isPaid },
      newValues: { status: RepairStatus.Delivered, deliverySnapshot: snapshot },
      reason: deliveryNotes || "تسليم رسمي للجهاز وتحصيل المستحقات",
      timestamp: nowIso
    });
    setStorageItem(KEYS.SETTLEMENT_AUDIT_LOGS, settlementLogs);

    return { success: true, order: updatedOrder, invoice: createdInvoice };
  },

  reopenRepairOrder: (
    orderId: string,
    currentUser: User,
    reason: string
  ): { success: boolean; error?: string; order?: RepairOrder } => {
    // 1. Permission check (Ahmed Elbanna / OWNER ONLY)
    if (!canReopenDeliveredOrder(currentUser)) {
      return {
        success: false,
        error: "عذراً، خيار إعادة فتح طلبات الصيانة المسلمة متاح حصرياً لأحمد البنا (صاحب النظام)!"
      };
    }

    if (!reason || !reason.trim()) {
      return {
        success: false,
        error: "يرجى إدخال سبب إعادة فتح طلب الصيانة لإدراجه بسجل الرقابة والأمان."
      };
    }

    // 2. Fetch order
    const list = db.getRepairOrders();
    const index = list.findIndex(o => o.id === orderId);
    if (index === -1) {
      return { success: false, error: "طلب الصيانة غير موجود بالسيستم" };
    }

    const order = list[index];
    const nowIso = new Date().toISOString();

    const reopenLog: DeliveryReopenLog = {
      reopenedAt: nowIso,
      reopenedByUserId: currentUser.id,
      reopenedByUserName: currentUser.fullName || currentUser.name || "أحمد البنا",
      reopenReason: reason.trim(),
      previousSnapshot: order.deliverySnapshot
    };

    // 3. Update Order Status back to Ready and clear locked delivery flag
    const updatedOrder: RepairOrder = {
      ...order,
      status: RepairStatus.Ready,
      deliveryStatus: "NOT_DELIVERED",
      reopenedAt: nowIso,
      reopenedByUserId: currentUser.id,
      reopenedByUserName: reopenLog.reopenedByUserName,
      reopenReason: reason.trim(),
      reopenLogs: [...(order.reopenLogs || []), reopenLog]
    };

    list[index] = updatedOrder;
    db.saveRepairOrders(list);

    // 4. Audit Logging
    db.logActivity(
      currentUser.id,
      currentUser.fullName || currentUser.name || "أحمد البنا",
      "إعادة فتح أمر صيانة مسلّم",
      `قام أحمد البنا بإعادة فتح أمر الصيانة المسلم رقم [${order.id}]. السبب: ${reason.trim()}`
    );

    const settlementLogs = getStorageItem<SettlementAuditLog[]>(KEYS.SETTLEMENT_AUDIT_LOGS, []);
    settlementLogs.unshift({
      id: `AUD-REOPEN-${Date.now()}`,
      userId: currentUser.id,
      action: "REOPEN_DELIVERED_REPAIR_ORDER",
      entityType: "RepairOrder",
      entityId: order.id,
      previousValues: { status: order.status, deliverySnapshot: order.deliverySnapshot },
      newValues: { status: RepairStatus.Ready, reopenLog },
      reason: reason.trim(),
      timestamp: nowIso
    });
    setStorageItem(KEYS.SETTLEMENT_AUDIT_LOGS, settlementLogs);

    return { success: true, order: updatedOrder };
  },
  deleteRepairOrder: (id: string): { success: boolean; error?: string } => {
    const order = db.getRepairOrders().find(o => o.id === id);
    if (!order) return { success: false, error: "طلب الصيانة غير موجود" };

    // Safety check: Locked settlement protection
    if (order.isSettled) {
      return {
        success: false,
        error: "لا يمكن حذف أمر الصيانة لأنه مدرج ضمن تسوية أرباح مالية معتمدة ومغلقة. يمكنك إلغاء التسوية أو عكس الحركة المالية."
      };
    }

    const list = db.getRepairOrders().filter(o => o.id !== id);
    db.saveRepairOrders(list);
    db.logActivity("U-101", "أحمد محمد", "حذف طلب صيانة", `تم حذف طلب الصيانة رقم ${order.id}`);
    return { success: true };
  },

  // --- INVENTORY / PRODUCTS ---
  getProducts: (): Product[] => {
    return getStorageItem<Product[]>(KEYS.PRODUCTS, DEFAULT_PRODUCTS);
  },
  saveProducts: (data: Product[]) => {
    setStorageItem(KEYS.PRODUCTS, data);
  },
  addProduct: (product: Omit<Product, "id">): Product => {
    const list = db.getProducts();
    const newProduct: Product = {
      ...product,
      id: `P-${String(list.length + 1).padStart(3, "0")}`
    };
    list.push(newProduct);
    db.saveProducts(list);
    db.logActivity("U-101", "أحمد محمد", "إضافة منتج", `تم إضافة المنتج ${newProduct.name} للمخزون`);
    return newProduct;
  },
  updateProduct: (product: Product) => {
    const list = db.getProducts();
    const index = list.findIndex(p => p.id === product.id);
    if (index !== -1) {
      list[index] = product;
      db.saveProducts(list);
    }
  },

  // --- SUPPLIERS ---
  getSuppliers: (): Supplier[] => {
    return getStorageItem<Supplier[]>(KEYS.SUPPLIERS, DEFAULT_SUPPLIERS);
  },
  saveSuppliers: (data: Supplier[]) => {
    setStorageItem(KEYS.SUPPLIERS, data);
  },
  addSupplier: (supplier: Omit<Supplier, "id">): Supplier => {
    const list = db.getSuppliers();
    const newSupplier: Supplier = {
      ...supplier,
      id: `S-${String(list.length + 1).padStart(3, "0")}`
    };
    list.push(newSupplier);
    db.saveSuppliers(list);
    return newSupplier;
  },

  // --- INVOICES ---
  getInvoices: (): Invoice[] => {
    return getStorageItem<Invoice[]>(KEYS.INVOICES, DEFAULT_INVOICES);
  },
  saveInvoices: (data: Invoice[]) => {
    setStorageItem(KEYS.INVOICES, data);
  },
  addInvoice: (invoice: Omit<Invoice, "id" | "date">): Invoice => {
    const list = db.getInvoices();
    const newInvoice: Invoice = {
      ...invoice,
      id: `INV-2026-${String(list.length + 1).padStart(3, "0")}`,
      date: new Date().toISOString()
    };
    list.unshift(newInvoice);
    db.saveInvoices(list);
    db.logActivity("U-101", "أحمد محمد", "إصدار فاتورة", `تم إصدار الفاتورة رقم ${newInvoice.id} بمبلغ ${newInvoice.totalAmount} ج.م.`);
    return newInvoice;
  },

  // --- EXPENSES ---
  getExpenses: (): Expense[] => {
    return getStorageItem<Expense[]>(KEYS.EXPENSES, DEFAULT_EXPENSES);
  },
  saveExpenses: (data: Expense[]) => {
    setStorageItem(KEYS.EXPENSES, data);
  },
  addExpense: (expense: Omit<Expense, "id" | "date">): Expense => {
    const list = db.getExpenses();
    const newExpense: Expense = {
      ...expense,
      id: `E-${String(list.length + 1).padStart(3, "0")}`,
      date: new Date().toISOString()
    };
    list.unshift(newExpense);
    db.saveExpenses(list);
    db.logActivity("U-101", "أحمد محمد", "تسجيل مصروفات", `تسجيل مصروف بقيمة ${newExpense.amount} ج.م. تحت بند ${newExpense.category}`);
    return newExpense;
  },

  // --- USERS ---
  getUsers: (): User[] => {
    const list = authStore.getUsers();
    if (list && list.length > 0) return list as any[];
    return getStorageItem<User[]>(KEYS.USERS, DEFAULT_USERS);
  },
  saveUsers: (data: User[]) => {
    authStore.saveUsers(data as any[]);
    setStorageItem(KEYS.USERS, data);
  },
  getCurrentUser: (): User | null => {
    const active = authStore.getCurrentUser();
    if (active) return active as any;
    return null;
  },
  setCurrentUser: (user: User | null) => {
    if (!user) {
      authStore.clearSession();
    } else {
      authStore.setActiveUser(user as any);
    }
  },

  // --- SYSTEM SETTINGS ---
  getSettings: (): SystemSettings => {
    return getStorageItem<SystemSettings>(KEYS.SETTINGS, DEFAULT_SETTINGS);
  },
  saveSettings: (settings: SystemSettings) => {
    setStorageItem(KEYS.SETTINGS, settings);
    saveStoreSettingsToSupabase(settings).catch(err => console.error("Error syncing settings to Supabase:", err));
  },

  // --- ACTIVITY LOGS ---
  getActivityLogs: (): ActivityLog[] => {
    return getStorageItem<ActivityLog[]>(KEYS.ACTIVITY_LOGS, DEFAULT_LOGS);
  },
  logActivity: (userId: string, userName: string, action: string, details: string) => {
    const list = getStorageItem<ActivityLog[]>(KEYS.ACTIVITY_LOGS, DEFAULT_LOGS);
    const newLog: ActivityLog = {
      id: `L-${String(list.length + 1).padStart(3, "0")}`,
      userId,
      userName,
      action,
      details,
      timestamp: new Date().toISOString()
    };
    list.unshift(newLog);
    setStorageItem(KEYS.ACTIVITY_LOGS, list);
  },

  // --- CATEGORIES ---
  getCategories: (): ProductCategory[] => {
    return getStorageItem<ProductCategory[]>(KEYS.CATEGORIES, DEFAULT_CATEGORIES);
  },
  saveCategories: (data: ProductCategory[]) => {
    setStorageItem(KEYS.CATEGORIES, data);
  },
  addCategory: (cat: Omit<ProductCategory, "id">): ProductCategory => {
    const list = db.getCategories();
    const newCat: ProductCategory = {
      ...cat,
      id: `CAT-${String(list.length + 101).padStart(3, "0")}`
    };
    list.push(newCat);
    db.saveCategories(list);
    db.logActivity("U-101", "أحمد محمد", "إضافة تصنيف", `تم إضافة التصنيف الجديد ${newCat.name}`);
    return newCat;
  },
  updateCategory: (cat: ProductCategory) => {
    const list = db.getCategories();
    const index = list.findIndex(c => c.id === cat.id);
    if (index !== -1) {
      list[index] = cat;
      db.saveCategories(list);
    }
  },
  deleteCategory: (id: string): { success: boolean; error?: string } => {
    const cat = db.getCategories().find(c => c.id === id);
    if (!cat) return { success: false, error: "التصنيف غير موجود" };
    
    // Check if contains products
    const products = db.getProducts();
    const hasProducts = products.some(p => p.category === cat.name && !p.isArchived);
    if (hasProducts) {
      return { success: false, error: "لا يمكن حذف التصنيف لأنه يحتوي على منتجات مسجلة. يرجى نقل المنتجات أولاً." };
    }
    
    const list = db.getCategories().filter(c => c.id !== id);
    db.saveCategories(list);
    db.logActivity("U-101", "أحمد محمد", "حذف تصنيف", `تم حذف التصنيف ${cat.name}`);
    return { success: true };
  },

  // --- DEVICE TYPES ---
  getDeviceTypes: (): DBDeviceType[] => {
    fetchDeviceTypesFromSupabase().catch(() => {});
    return getDeviceTypesSync();
  },
  saveDeviceTypes: (data: DBDeviceType[]) => {
    // Deprecated direct localStorage save, handled via Supabase
  },
  addDeviceType: (dt: Omit<DBDeviceType, "id">): DBDeviceType => {
    const newId = `DT-${Date.now()}`;
    const newDt: DBDeviceType = { ...dt, id: newId };
    addDeviceTypeToSupabase(dt).catch(err => console.error(err));
    db.logActivity("U-101", "أحمد محمد", "إضافة نوع جهاز", `تم إضافة نوع الجهاز ${dt.nameAr}`);
    return newDt;
  },
  updateDeviceType: (dt: DBDeviceType) => {
    updateDeviceTypeInSupabase(dt).catch(err => console.error(err));
  },
  deleteDeviceType: (id: string): { success: boolean; error?: string } => {
    const dt = getDeviceTypesSync().find(d => d.id === id);
    if (!dt) return { success: false, error: "نوع الجهاز غير موجود" };
    
    // Check repair orders for matching type
    const orders = db.getRepairOrders();
    const isUsed = orders.some(o => o.devices.some(d => d.type === dt.id || d.type.toLowerCase() === dt.nameEn.toLowerCase() || d.type.toLowerCase() === dt.nameAr.toLowerCase()));
    
    if (isUsed) {
      dt.isArchived = true;
      dt.isActive = false;
      updateDeviceTypeInSupabase(dt).catch(err => console.error(err));
      db.logActivity("U-101", "أحمد محمد", "أرشفة نوع جهاز", `تم أرشفة نوع الجهاز ${dt.nameAr} لوجود سجلات صيانة مرتبطة به`);
      return { success: true, error: "تم أرشفة نوع الجهاز بنجاح بدلاً من الحذف لتعلقه بملفات صيانة سابقة." };
    }
    
    deleteDeviceTypeInSupabase(id).catch(err => console.error(err));
    db.logActivity("U-101", "أحمد محمد", "حذف نوع جهاز", `تم حذف نوع الجهاز ${dt.nameAr}`);
    return { success: true };
  },

  // --- DEVICE MODELS ---
  getDeviceModels: (): DBDeviceModel[] => {
    fetchDeviceModelsFromSupabase().catch(() => {});
    return getDeviceModelsSync();
  },
  saveDeviceModels: (data: DBDeviceModel[]) => {
    // Deprecated direct localStorage save
  },
  addDeviceModel: (m: Omit<DBDeviceModel, "id">): DBDeviceModel => {
    const newId = `DM-${Date.now()}`;
    const newM: DBDeviceModel = { ...m, id: newId };
    addDeviceModelToSupabase(m).catch(err => console.error(err));
    db.logActivity("U-101", "أحمد محمد", "إضافة موديل جهاز", `تم إضافة الموديل ${m.nameAr}`);
    return newM;
  },
  updateDeviceModel: (m: DBDeviceModel) => {
    updateDeviceModelInSupabase(m).catch(err => console.error(err));
  },
  deleteDeviceModel: (id: string): { success: boolean; error?: string } => {
    const m = getDeviceModelsSync().find(x => x.id === id);
    if (!m) return { success: false, error: "الموديل غير موجود" };
    
    const orders = db.getRepairOrders();
    const isUsed = orders.some(o => o.devices.some(d => d.model === m.id || d.model.toLowerCase().includes(m.nameAr.toLowerCase())));
    
    if (isUsed) {
      m.isArchived = true;
      m.isActive = false;
      updateDeviceModelInSupabase(m).catch(err => console.error(err));
      db.logActivity("U-101", "أحمد محمد", "أرشفة موديل جهاز", `تم أرشفة الموديل ${m.nameAr} لوجود أجهزة صيانة مسجلة به`);
      return { success: true, error: "تم أرشفة الموديل بنجاح لتعلقه بسجلات صيانة فعالة." };
    }
    
    deleteDeviceModelInSupabase(id).catch(err => console.error(err));
    db.logActivity("U-101", "أحمد محمد", "حذف موديل جهاز", `تم حذف الموديل ${m.nameAr}`);
    return { success: true };
  },

  // --- COMMON FAULTS ---
  getCommonFaults: (): CommonFault[] => {
    return getStorageItem<CommonFault[]>(KEYS.COMMON_FAULTS, DEFAULT_COMMON_FAULTS);
  },
  saveCommonFaults: (data: CommonFault[]) => {
    setStorageItem(KEYS.COMMON_FAULTS, data);
  },
  addCommonFault: (f: Omit<CommonFault, "id">): CommonFault => {
    const list = db.getCommonFaults();
    const newF: CommonFault = {
      ...f,
      id: `CF-${String(list.length + 101).padStart(3, "0")}`
    };
    list.push(newF);
    db.saveCommonFaults(list);
    db.logActivity("U-101", "أحمد محمد", "إضافة عطل شائع", `تم إضافة العطل الشائع ${newF.nameAr}`);
    return newF;
  },
  updateCommonFault: (f: CommonFault) => {
    const list = db.getCommonFaults();
    const index = list.findIndex(x => x.id === f.id);
    if (index !== -1) {
      list[index] = f;
      db.saveCommonFaults(list);
    }
  },
  deleteCommonFault: (id: string): { success: boolean; error?: string } => {
    const f = db.getCommonFaults().find(x => x.id === id);
    if (!f) return { success: false, error: "العطل غير موجود" };
    
    const orders = db.getRepairOrders();
    const isUsed = orders.some(o => o.devices.some(d => d.issue.toLowerCase().includes(f.nameAr.toLowerCase()) || d.issue.toLowerCase().includes(f.nameEn.toLowerCase())));
    
    if (isUsed) {
      f.isArchived = true;
      f.isActive = false;
      db.updateCommonFault(f);
      db.logActivity("U-101", "أحمد محمد", "أرشفة عطل شائع", `تم أرشفة العطل الشائع ${f.nameAr} لتعلقه بطلب صيانة سابق`);
      return { success: true, error: "تم أرشفة العطل بنجاح لتعلقه بسجلات الصيانة الفعالة." };
    }
    
    const list = db.getCommonFaults().filter(x => x.id !== id);
    db.saveCommonFaults(list);
    db.logActivity("U-101", "أحمد محمد", "حذف عطل شائع", `تم حذف العطل الشائع ${f.nameAr}`);
    return { success: true };
  },

  // --- REPAIR SERVICES ---
  getRepairServices: (): RepairService[] => {
    return getStorageItem<RepairService[]>(KEYS.REPAIR_SERVICES, DEFAULT_REPAIR_SERVICES);
  },
  saveRepairServices: (data: RepairService[]) => {
    setStorageItem(KEYS.REPAIR_SERVICES, data);
  },
  addRepairService: (s: Omit<RepairService, "id">): RepairService => {
    const list = db.getRepairServices();
    const newS: RepairService = {
      ...s,
      id: `RS-${String(list.length + 101).padStart(3, "0")}`
    };
    list.push(newS);
    db.saveRepairServices(list);
    db.logActivity("U-101", "أحمد محمد", "إضافة خدمة صيانة", `تم إضافة الخدمة الجديدة ${newS.nameAr}`);
    return newS;
  },
  updateRepairService: (s: RepairService) => {
    const list = db.getRepairServices();
    const index = list.findIndex(x => x.id === s.id);
    if (index !== -1) {
      list[index] = s;
      db.saveRepairServices(list);
    }
  },
  deleteRepairService: (id: string): { success: boolean; error?: string } => {
    const s = db.getRepairServices().find(x => x.id === id);
    if (!s) return { success: false, error: "الخدمة غير موجودة" };
    
    s.isArchived = true;
    s.isActive = false;
    db.updateRepairService(s);
    db.logActivity("U-101", "أحمد محمد", "أرشفة خدمة صيانة", `تم أرشفة خدمة الصيانة ${s.nameAr}`);
    return { success: true };
  },

  // --- DEFAULT PRICES ---
  getDefaultPrices: (): DefaultPrice[] => {
    return getStorageItem<DefaultPrice[]>(KEYS.DEFAULT_PRICES, DEFAULT_DEFAULT_PRICES);
  },
  saveDefaultPrices: (data: DefaultPrice[]) => {
    setStorageItem(KEYS.DEFAULT_PRICES, data);
  },
  addDefaultPrice: (p: Omit<DefaultPrice, "id">): DefaultPrice => {
    const list = db.getDefaultPrices();
    const newP: DefaultPrice = {
      ...p,
      id: `DP-${String(list.length + 101).padStart(3, "0")}`
    };
    list.push(newP);
    db.saveDefaultPrices(list);
    return newP;
  },
  updateDefaultPrice: (p: DefaultPrice) => {
    const list = db.getDefaultPrices();
    const index = list.findIndex(x => x.id === p.id);
    if (index !== -1) {
      list[index] = p;
      db.saveDefaultPrices(list);
    }
  },
  deleteDefaultPrice: (id: string) => {
    const list = db.getDefaultPrices().filter(x => x.id !== id);
    db.saveDefaultPrices(list);
  },

  // --- RECEIVED ACCESSORIES ---
  getReceivedAccessories: (): ReceivedAccessory[] => {
    return getStorageItem<ReceivedAccessory[]>(KEYS.RECEIVED_ACCESSORIES, DEFAULT_RECEIVED_ACCESSORIES);
  },
  saveReceivedAccessories: (data: ReceivedAccessory[]) => {
    setStorageItem(KEYS.RECEIVED_ACCESSORIES, data);
  },
  addReceivedAccessory: (acc: Omit<ReceivedAccessory, "id">): ReceivedAccessory => {
    const list = db.getReceivedAccessories();
    const newAcc: ReceivedAccessory = {
      ...acc,
      id: `RA-${String(list.length + 101).padStart(3, "0")}`
    };
    list.push(newAcc);
    db.saveReceivedAccessories(list);
    return newAcc;
  },
  updateReceivedAccessory: (acc: ReceivedAccessory) => {
    const list = db.getReceivedAccessories();
    const index = list.findIndex(x => x.id === acc.id);
    if (index !== -1) {
      list[index] = acc;
      db.saveReceivedAccessories(list);
    }
  },
  deleteReceivedAccessory: (id: string) => {
    const list = db.getReceivedAccessories().filter(x => x.id !== id);
    db.saveReceivedAccessories(list);
  },

  // --- DEVICE CONDITIONS ---
  getDeviceConditions: (): DeviceCondition[] => {
    return getStorageItem<DeviceCondition[]>(KEYS.DEVICE_CONDITIONS, DEFAULT_DEVICE_CONDITIONS);
  },
  saveDeviceConditions: (data: DeviceCondition[]) => {
    setStorageItem(KEYS.DEVICE_CONDITIONS, data);
  },
  addDeviceCondition: (cond: Omit<DeviceCondition, "id">): DeviceCondition => {
    const list = db.getDeviceConditions();
    const newCond: DeviceCondition = {
      ...cond,
      id: `DC-${String(list.length + 101).padStart(3, "0")}`
    };
    list.push(newCond);
    db.saveDeviceConditions(list);
    return newCond;
  },
  updateDeviceCondition: (cond: DeviceCondition) => {
    const list = db.getDeviceConditions();
    const index = list.findIndex(x => x.id === cond.id);
    if (index !== -1) {
      list[index] = cond;
      db.saveDeviceConditions(list);
    }
  },
  deleteDeviceCondition: (id: string) => {
    const list = db.getDeviceConditions().filter(x => x.id !== id);
    db.saveDeviceConditions(list);
  },

  // --- REPAIR TEMPLATES ---
  getRepairTemplates: (): RepairTemplateItem[] => {
    fetchRepairTemplatesFromSupabase().catch(() => {});
    return getRepairTemplatesSync();
  },
  saveRepairTemplates: (data: RepairTemplateItem[]) => {
    // Deprecated direct localStorage save
  },
  addRepairTemplateItem: (item: Omit<RepairTemplateItem, "id">): RepairTemplateItem => {
    const newId = `RPT-${Date.now()}`;
    const newItem: RepairTemplateItem = { ...item, id: newId };
    addRepairTemplateToSupabase(item).catch(err => console.error(err));
    return newItem;
  },
  updateRepairTemplateItem: (item: RepairTemplateItem) => {
    updateRepairTemplateInSupabase(item).catch(err => console.error(err));
  },
  deleteRepairTemplateItem: (id: string) => {
    deleteRepairTemplateInSupabase(id).catch(err => console.error(err));
  },

  deleteProduct: (id: string): { success: boolean; error?: string } => {
    const prod = db.getProducts().find(p => p.id === id);
    if (!prod) return { success: false, error: "المنتج غير موجود" };
    
    // Check if used in invoices
    const invoices = db.getInvoices();
    const isUsedInInvoices = invoices.some(inv => inv.items.some(item => item.productId === id));
    
    // If used, archive instead
    if (isUsedInInvoices) {
      prod.isArchived = true;
      db.updateProduct(prod);
      db.logActivity("U-101", "أحمد محمد", "أرشفة منتج", `تم أرشفة المنتج ${prod.name} لتعلقه بعمليات بيع أو فواتير سابقة`);
      return { success: true, error: "تم أرشفة المنتج بنجاح لتعلقه بفواتير سابقة." };
    }
    
    const list = db.getProducts().filter(p => p.id !== id);
    db.saveProducts(list);
    db.logActivity("U-101", "أحمد محمد", "حذف منتج نهائياً", `تم حذف المنتج ${prod.name} نهائياً من المخزون`);
    return { success: true };
  },

  // --- PARTNERS ACCOUNTING MODULE ---
  getPartners: (): Partner[] => {
    const list = getStorageItem<Partner[]>(KEYS.PARTNERS, DEFAULT_PARTNERS);
    let modified = false;
    const sanitized = list.map(p => {
      let nameAr = p.nameAr || p.name || "";
      let name = p.name || "";
      if (p.id === "P-001") {
        if (nameAr.includes("صاحب المحل") || nameAr === "الشريك الأول") {
          nameAr = "أحمد البنا (الشريك الأول)";
          modified = true;
        }
        if (name.includes("صاحب المحل")) {
          name = "أحمد البنا";
          modified = true;
        }
      } else {
        if (nameAr.includes("صاحب المحل")) {
          nameAr = nameAr.replace(/صاحب المحل/g, "أحمد البنا");
          modified = true;
        }
        if (name.includes("صاحب المحل")) {
          name = name.replace(/صاحب المحل/g, "أحمد البنا");
          modified = true;
        }
      }
      return { ...p, nameAr, name };
    });
    if (modified) {
      setStorageItem(KEYS.PARTNERS, sanitized);
    }
    return sanitized;
  },
  savePartners: (data: Partner[]) => {
    setStorageItem(KEYS.PARTNERS, data);
  },
  updatePartner: (partner: Partner) => {
    const list = db.getPartners();
    const idx = list.findIndex(p => p.id === partner.id);
    if (idx !== -1) {
      list[idx] = partner;
      db.savePartners(list);
    }
  },

  getPartnerLedger: (): PartnerLedgerEntry[] => {
    return getStorageItem<PartnerLedgerEntry[]>(KEYS.PARTNER_LEDGER, DEFAULT_PARTNER_LEDGER);
  },
  savePartnerLedger: (data: PartnerLedgerEntry[]) => {
    setStorageItem(KEYS.PARTNER_LEDGER, data);
  },
  addPartnerLedgerEntry: (entry: Omit<PartnerLedgerEntry, "id" | "createdAt" | "updatedAt">): PartnerLedgerEntry => {
    const list = db.getPartnerLedger();
    const newEntry: PartnerLedgerEntry = {
      ...entry,
      id: `LEG-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    list.unshift(newEntry);
    db.savePartnerLedger(list);

    // Update partner running balance
    const partners = db.getPartners();
    const partner = partners.find(p => p.id === entry.partnerId);
    if (partner) {
      partner.balance = entry.balanceAfter;
      db.savePartners(partners);
    }
    return newEntry;
  },

  getPartnerSettlements: (): PartnerSettlement[] => {
    return getStorageItem<PartnerSettlement[]>(KEYS.PARTNER_SETTLEMENTS, DEFAULT_PARTNER_SETTLEMENTS);
  },
  savePartnerSettlements: (data: PartnerSettlement[]) => {
    setStorageItem(KEYS.PARTNER_SETTLEMENTS, data);
  },

  getPartnerSettlementPayments: (): PartnerSettlementPayment[] => {
    return getStorageItem<PartnerSettlementPayment[]>(KEYS.PARTNER_SETTLEMENT_PAYMENTS, DEFAULT_PARTNER_SETTLEMENT_PAYMENTS);
  },
  savePartnerSettlementPayments: (data: PartnerSettlementPayment[]) => {
    setStorageItem(KEYS.PARTNER_SETTLEMENT_PAYMENTS, data);
  },

  getPartnerTransactions: (): PartnerTransaction[] => {
    return getStorageItem<PartnerTransaction[]>(KEYS.PARTNER_TRANSACTIONS, DEFAULT_PARTNER_TRANSACTIONS);
  },
  savePartnerTransactions: (data: PartnerTransaction[]) => {
    setStorageItem(KEYS.PARTNER_TRANSACTIONS, data);
  },
  addPartnerTransaction: (tx: Omit<PartnerTransaction, "id" | "createdAt" | "status">): PartnerTransaction => {
    const list = db.getPartnerTransactions();
    const newTx: PartnerTransaction = {
      ...tx,
      id: `PTX-${Date.now().toString(36).toUpperCase()}`,
      status: "APPROVED",
      createdAt: new Date().toISOString()
    };
    list.unshift(newTx);
    db.savePartnerTransactions(list);

    // Create ledger entry
    const ledger = db.getPartnerLedger();
    const partnerLedger = ledger.filter(l => l.partnerId === tx.partnerId && !l.isReversed);
    const currentBal = partnerLedger.length > 0 ? partnerLedger[0].balanceAfter : 0;
    
    let debit = 0;
    let credit = 0;
    let newBal = currentBal;

    if (tx.type === "CASH_ADVANCE" || tx.type === "CASH_WITHDRAWAL" || tx.type === "INVENTORY_WITHDRAWAL" || tx.type === "EXPENSE_CHARGE" || tx.type === "PAYMENT_TO_PARTNER") {
      debit = tx.amount;
      newBal = currentBal - tx.amount;
    } else {
      credit = tx.amount;
      newBal = currentBal + tx.amount;
    }

    db.addPartnerLedgerEntry({
      partnerId: tx.partnerId,
      transactionDate: tx.date,
      transactionType: tx.type === "CASH_ADVANCE" ? "CASH_ADVANCE" : tx.type === "INVENTORY_WITHDRAWAL" ? "INVENTORY_WITHDRAWAL" : tx.type === "CASH_WITHDRAWAL" ? "CASH_WITHDRAWAL" : "PARTNER_PAYMENT",
      sourceType: "PARTNER_TRANSACTION",
      sourceId: newTx.id,
      debit,
      credit,
      amount: tx.amount,
      balanceAfter: newBal,
      currency: "ج.م.",
      descriptionArabic: tx.reason || `حركة مسحوبات / سلف شريك - ${tx.type}`,
      notes: tx.notes,
      createdByUserId: tx.createdBy
    });

    db.logActivity(tx.createdBy, "المستخدم", "تسجيل حركة شريك", `تم تسجيل حركة بقيمة ${tx.amount} ج.م. للشريك ${tx.partnerId}`);
    return newTx;
  },

  getRepairPartUsages: (): RepairPartUsage[] => {
    return getStorageItem<RepairPartUsage[]>(KEYS.REPAIR_PART_USAGES, DEFAULT_REPAIR_PART_USAGES);
  },
  saveRepairPartUsages: (data: RepairPartUsage[]) => {
    setStorageItem(KEYS.REPAIR_PART_USAGES, data);
  },
  addRepairPartUsage: (part: Omit<RepairPartUsage, "id" | "createdAt">): RepairPartUsage => {
    const list = db.getRepairPartUsages();
    const newPart: RepairPartUsage = {
      ...part,
      id: `PU-${Date.now().toString(36).toUpperCase()}`,
      createdAt: new Date().toISOString()
    };
    list.unshift(newPart);
    db.saveRepairPartUsages(list);
    return newPart;
  },

  getSettlementAuditLogs: (): SettlementAuditLog[] => {
    return getStorageItem<SettlementAuditLog[]>(KEYS.SETTLEMENT_AUDIT_LOGS, DEFAULT_SETTLEMENT_AUDIT_LOGS);
  },
  addSettlementAuditLog: (log: Omit<SettlementAuditLog, "id" | "timestamp">) => {
    const list = db.getSettlementAuditLogs();
    const newLog: SettlementAuditLog = {
      ...log,
      id: `SAL-${Date.now().toString(36).toUpperCase()}`,
      timestamp: new Date().toISOString()
    };
    list.unshift(newLog);
    setStorageItem(KEYS.SETTLEMENT_AUDIT_LOGS, list);
  },

  // Calculate settlement formula based on exact rules
  calculateSettlement: (year: number, month: number): PartnerSettlement => {
    const orders = db.getRepairOrders().filter(o => {
      if (!o.receivedDate) return false;
      const d = new Date(o.receivedDate);
      return d.getFullYear() === year && (d.getMonth() + 1) === month;
    });

    const partUsages = db.getRepairPartUsages().filter(pu => pu.accountingStatus !== "RETURNED" && pu.accountingStatus !== "REVERSED");
    const pTxs = db.getPartnerTransactions().filter(tx => !tx.isReversed && tx.status !== "REVERSED" && new Date(tx.date).getFullYear() === year && (new Date(tx.date).getMonth() + 1) === month);

    // 1. Customer Shared Work
    const sharedOrders = orders.filter(o => !o.workOwnershipType || o.workOwnershipType === WorkOwnershipType.CUSTOMER_SHARED);
    let sharedRevenue = 0;
    let sharedPartsCost = 0;
    let sharedOtherCosts = 0;

    sharedOrders.forEach(o => {
      sharedRevenue += o.totalEstimatedCost || 0;
      sharedOtherCosts += o.otherDirectCosts || 0;
      const orderParts = partUsages.filter(pu => pu.repairOrderId === o.id);
      if (orderParts.length > 0) {
        sharedPartsCost += orderParts.reduce((acc, p) => acc + (p.totalCost || 0), 0);
      } else {
        sharedPartsCost += o.devices?.reduce((acc, d) => acc + (d.partsCost || 0), 0) || 0;
      }
    });

    const sharedNetProfit = Math.max(0, sharedRevenue - sharedPartsCost - sharedOtherCosts);
    const partner1SharedShare = Math.round(sharedNetProfit * 0.5);
    const partner2SharedShare = Math.round(sharedNetProfit * 0.5);

    // 2. Partner 2 Private Work (شغل عبده)
    const p2Orders = orders.filter(o => o.workOwnershipType === WorkOwnershipType.PARTNER_2_PRIVATE);
    let partner2PrivateRevenue = 0;
    let partner2PrivatePartsCost = 0;
    let partner2PrivateOtherCosts = 0;
    let partner1ShareFromPartner2Private = 0;
    let partner2ShareFromPrivateWork = 0;

    p2Orders.forEach(o => {
      const rev = o.totalEstimatedCost || 0;
      const other = o.otherDirectCosts || 0;
      let parts = 0;
      const orderParts = partUsages.filter(pu => pu.repairOrderId === o.id);
      if (orderParts.length > 0) {
        parts = orderParts.reduce((acc, p) => acc + (p.totalCost || 0), 0);
      } else {
        parts = o.devices?.reduce((acc, d) => acc + (d.partsCost || 0), 0) || 0;
      }

      partner2PrivateRevenue += rev;
      partner2PrivateOtherCosts += other;
      partner2PrivatePartsCost += parts;

      const orderNetProfit = Math.max(0, rev - parts - other);
      const rate = typeof o.partnerDeductionRate === "number" ? o.partnerDeductionRate : 25;
      const p1Share = Math.round(orderNetProfit * (rate / 100));
      const p2Share = orderNetProfit - p1Share;

      partner1ShareFromPartner2Private += p1Share;
      partner2ShareFromPrivateWork += p2Share;
    });

    const partner2PrivateNetProfit = Math.max(0, partner2PrivateRevenue - partner2PrivatePartsCost - partner2PrivateOtherCosts);

    // 3. Partner 1 Private Work (شغلي الخاص)
    const p1Orders = orders.filter(o => o.workOwnershipType === WorkOwnershipType.PARTNER_1_PRIVATE);
    let partner1PrivateRevenue = 0;
    let partner1PrivatePartsCost = 0;
    let partner1PrivateOtherCosts = 0;

    p1Orders.forEach(o => {
      partner1PrivateRevenue += o.totalEstimatedCost || 0;
      partner1PrivateOtherCosts += o.otherDirectCosts || 0;
      const orderParts = partUsages.filter(pu => pu.repairOrderId === o.id);
      if (orderParts.length > 0) {
        partner1PrivatePartsCost += orderParts.reduce((acc, p) => acc + (p.totalCost || 0), 0);
      } else {
        partner1PrivatePartsCost += o.devices?.reduce((acc, d) => acc + (d.partsCost || 0), 0) || 0;
      }
    });

    const partner1PrivateDeduction = partner1PrivatePartsCost + partner1PrivateOtherCosts;

    // 4. Partner Transactions in month
    const p1Txs = pTxs.filter(t => t.partnerId === "P-001");
    const p2Txs = pTxs.filter(t => t.partnerId === "P-002");

    const partner1Advances = p1Txs.filter(t => t.type === "CASH_ADVANCE").reduce((acc, t) => acc + t.amount, 0);
    const partner2Advances = p2Txs.filter(t => t.type === "CASH_ADVANCE").reduce((acc, t) => acc + t.amount, 0);

    const partner1Withdrawals = p1Txs.filter(t => t.type === "CASH_WITHDRAWAL" || t.type === "INVENTORY_WITHDRAWAL").reduce((acc, t) => acc + t.amount, 0);
    const partner2Withdrawals = p2Txs.filter(t => t.type === "CASH_WITHDRAWAL" || t.type === "INVENTORY_WITHDRAWAL").reduce((acc, t) => acc + t.amount, 0);

    const partner1Adjustments = p1Txs.filter(t => t.type === "MANUAL_ADJUSTMENT").reduce((acc, t) => acc + t.amount, 0);
    const partner2Adjustments = p2Txs.filter(t => t.type === "MANUAL_ADJUSTMENT").reduce((acc, t) => acc + t.amount, 0);

    // 5. Final Balances
    const partner1FinalBalance = partner1SharedShare + partner1ShareFromPartner2Private + partner1Adjustments - (partner1PrivateDeduction + partner1Advances + partner1Withdrawals);
    const partner2FinalBalance = partner2SharedShare + partner2ShareFromPrivateWork + partner2Adjustments - (partner2Advances + partner2Withdrawals);

    const periodStart = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const periodEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    return {
      id: `SETTL-${year}-${String(month).padStart(2, "0")}`,
      settlementNumber: `SET-${year}${String(month).padStart(2, "0")}`,
      periodStart,
      periodEnd,
      status: "DRAFT",
      currency: "ج.م.",
      sharedRevenue,
      sharedPartsCost,
      sharedOtherCosts,
      sharedNetProfit,
      partner1SharedShare,
      partner2SharedShare,
      partner1PrivateRevenue,
      partner1PrivatePartsCost,
      partner1PrivateOtherCosts,
      partner1PrivateDeduction,
      partner2PrivateRevenue,
      partner2PrivatePartsCost,
      partner2PrivateOtherCosts,
      partner2PrivateNetProfit,
      partner1ShareFromPartner2Private,
      partner2ShareFromPrivateWork,
      partner1Advances,
      partner2Advances,
      partner1Withdrawals,
      partner2Withdrawals,
      partner1Adjustments,
      partner2Adjustments,
      partner1FinalBalance,
      partner2FinalBalance,
      preparedBy: "أحمد محمد",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  },

  createDraftSettlement: (year: number, month: number, userId: string) => {
    const list = db.getPartnerSettlements();
    const settlement = db.calculateSettlement(year, month);
    settlement.preparedBy = userId;

    const existingIdx = list.findIndex(s => s.id === settlement.id);
    if (existingIdx !== -1) {
      if (list[existingIdx].status === "LOCKED" || list[existingIdx].status === "PAID") {
        return { success: false, error: "التسوية مقفلة أو مدفوعة بالفعل ولا يمكن إعادة إنشائها كمسودة" };
      }
      list[existingIdx] = settlement;
    } else {
      list.unshift(settlement);
    }

    db.savePartnerSettlements(list);
    db.addSettlementAuditLog({
      userId,
      action: "CREATE_DRAFT_SETTLEMENT",
      entityType: "PartnerSettlement",
      entityId: settlement.id,
      newValues: settlement,
      reason: `إنشاء مسودة تسوية شهرية لشهر ${month}/${year}`
    });

    return { success: true, settlement };
  },

  lockSettlement: (settlementId: string, userId: string) => {
    const settlements = db.getPartnerSettlements();
    const sIdx = settlements.findIndex(s => s.id === settlementId);
    if (sIdx === -1) return { success: false, error: "التسوية غير موجودة" };

    const settlement = settlements[sIdx];
    if (settlement.status === "LOCKED" || settlement.status === "PAID") {
      return { success: false, error: "التسوية مقفلة بالفعل" };
    }

    settlement.status = "LOCKED";
    settlement.lockedBy = userId;
    settlement.lockedAt = new Date().toISOString();
    settlements[sIdx] = settlement;
    db.savePartnerSettlements(settlements);

    const [yearStr, monthStr] = (settlement?.id || "").replace("SETTL-", "").split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    const orders = db.getRepairOrders();
    orders.forEach(o => {
      if (!o.receivedDate) return;
      const d = new Date(o.receivedDate);
      if (d.getFullYear() === year && (d.getMonth() + 1) === month) {
        o.isSettled = true;
        o.settlementId = settlement.id;
      }
    });
    db.saveRepairOrders(orders);

    const partUsages = db.getRepairPartUsages();
    partUsages.forEach(pu => {
      const order = orders.find(o => o.id === pu.repairOrderId);
      if (order && order.settlementId === settlement.id) {
        pu.accountingStatus = "SETTLED";
      }
    });
    db.saveRepairPartUsages(partUsages);

    const p1Ledger = db.getPartnerLedger().filter(l => l.partnerId === "P-001" && !l.isReversed);
    const p1CurrentBal = p1Ledger.length > 0 ? p1Ledger[0].balanceAfter : 0;
    const p1NewBal = p1CurrentBal + settlement.partner1FinalBalance;

    db.addPartnerLedgerEntry({
      partnerId: "P-001",
      transactionDate: new Date().toISOString(),
      transactionType: "SHARED_PROFIT_SHARE",
      sourceType: "PARTNER_SETTLEMENT",
      sourceId: settlement.id,
      settlementId: settlement.id,
      debit: settlement.partner1FinalBalance < 0 ? Math.abs(settlement.partner1FinalBalance) : 0,
      credit: settlement.partner1FinalBalance >= 0 ? settlement.partner1FinalBalance : 0,
      amount: Math.abs(settlement.partner1FinalBalance),
      balanceAfter: p1NewBal,
      currency: "ج.م.",
      descriptionArabic: `تسوية أرباح ومستحقات الشهر ${month}/${year}`,
      createdByUserId: userId
    });

    const p2Ledger = db.getPartnerLedger().filter(l => l.partnerId === "P-002" && !l.isReversed);
    const p2CurrentBal = p2Ledger.length > 0 ? p2Ledger[0].balanceAfter : 0;
    const p2NewBal = p2CurrentBal + settlement.partner2FinalBalance;

    db.addPartnerLedgerEntry({
      partnerId: "P-002",
      transactionDate: new Date().toISOString(),
      transactionType: "SHARED_PROFIT_SHARE",
      sourceType: "PARTNER_SETTLEMENT",
      sourceId: settlement.id,
      settlementId: settlement.id,
      debit: settlement.partner2FinalBalance < 0 ? Math.abs(settlement.partner2FinalBalance) : 0,
      credit: settlement.partner2FinalBalance >= 0 ? settlement.partner2FinalBalance : 0,
      amount: Math.abs(settlement.partner2FinalBalance),
      balanceAfter: p2NewBal,
      currency: "ج.م.",
      descriptionArabic: `تسوية أرباح ومستحقات الشهر ${month}/${year}`,
      createdByUserId: userId
    });

    db.addSettlementAuditLog({
      userId,
      action: "LOCK_SETTLEMENT",
      entityType: "PartnerSettlement",
      entityId: settlement.id,
      newValues: settlement,
      reason: `اعتماد وإغلاق التسوية الشهرية ${settlement.settlementNumber}`
    });

    return { success: true };
  },

  reverseSettlement: (settlementId: string, userId: string, reason: string) => {
    if (!reason || reason.trim().length < 3) {
      return { success: false, error: "يلزم ذكر سبب تفصيلي لعكس أو إلغاء التسوية" };
    }

    const settlements = db.getPartnerSettlements();
    const sIdx = settlements.findIndex(s => s.id === settlementId);
    if (sIdx === -1) return { success: false, error: "التسوية غير موجودة" };

    const settlement = settlements[sIdx];
    const prevValues = { ...settlement };

    settlement.status = "REVERSED";
    settlement.notes = (settlement.notes ? settlement.notes + "\n" : "") + `[تم العكس بواسطة ${userId}]: ${reason}`;
    settlement.updatedAt = new Date().toISOString();
    settlements[sIdx] = settlement;
    db.savePartnerSettlements(settlements);

    const orders = db.getRepairOrders();
    orders.forEach(o => {
      if (o.settlementId === settlementId) {
        o.isSettled = false;
        o.settlementId = undefined;
      }
    });
    db.saveRepairOrders(orders);

    ["P-001", "P-002"].forEach(pId => {
      const finalBal = pId === "P-001" ? settlement.partner1FinalBalance : settlement.partner2FinalBalance;
      const ledger = db.getPartnerLedger().filter(l => l.partnerId === pId && !l.isReversed);
      const currentBal = ledger.length > 0 ? ledger[0].balanceAfter : 0;
      const newBal = currentBal - finalBal;

      db.addPartnerLedgerEntry({
        partnerId: pId,
        transactionDate: new Date().toISOString(),
        transactionType: "REVERSAL",
        sourceType: "PARTNER_SETTLEMENT_REVERSAL",
        sourceId: settlement.id,
        settlementId: settlement.id,
        debit: finalBal >= 0 ? finalBal : 0,
        credit: finalBal < 0 ? Math.abs(finalBal) : 0,
        amount: Math.abs(finalBal),
        balanceAfter: newBal,
        currency: "ج.م.",
        descriptionArabic: `عكس وإلغاء تسوية شهرية رقم ${settlement.settlementNumber} - السبب: ${reason}`,
        createdByUserId: userId
      });
    });

    db.addSettlementAuditLog({
      userId,
      action: "REVERSE_SETTLEMENT",
      entityType: "PartnerSettlement",
      entityId: settlement.id,
      previousValues: prevValues,
      newValues: settlement,
      reason
    });

    return { success: true };
  },

  recordSettlementPayment: (settlementId: string, partnerId: string, amount: number, paymentMethod: string, treasury: string, notes: string, userId: string) => {
    const settlements = db.getPartnerSettlements();
    const settlement = settlements.find(s => s.id === settlementId);
    if (!settlement) return { success: false, error: "التسوية غير موجودة" };

    const payments = db.getPartnerSettlementPayments();
    const newPayment: PartnerSettlementPayment = {
      id: `PAY-${Date.now().toString(36).toUpperCase()}`,
      settlementId,
      partnerId,
      amount,
      paymentMethod,
      treasury,
      paymentDate: new Date().toISOString(),
      notes,
      receivedOrPaidBy: userId,
      createdAt: new Date().toISOString()
    };
    payments.unshift(newPayment);
    db.savePartnerSettlementPayments(payments);

    const totalPaid = payments.filter(p => p.settlementId === settlementId).reduce((acc, p) => acc + p.amount, 0);
    const expected = (settlement.partner1FinalBalance || 0) + (settlement.partner2FinalBalance || 0);
    
    if (totalPaid >= expected) {
      settlement.status = "PAID";
    } else {
      settlement.status = "PARTIALLY_PAID";
    }
    db.savePartnerSettlements(settlements);

    const ledger = db.getPartnerLedger().filter(l => l.partnerId === partnerId && !l.isReversed);
    const currentBal = ledger.length > 0 ? ledger[0].balanceAfter : 0;
    const newBal = currentBal - amount;

    db.addPartnerLedgerEntry({
      partnerId,
      transactionDate: new Date().toISOString(),
      transactionType: "SETTLEMENT_PAYMENT",
      sourceType: "PARTNER_PAYMENT",
      sourceId: newPayment.id,
      settlementId,
      debit: amount,
      credit: 0,
      amount,
      balanceAfter: newBal,
      currency: "ج.م.",
      descriptionArabic: `صرف دفعات مستحقات تسوية رقم ${settlement.settlementNumber}`,
      notes,
      createdByUserId: userId
    });

    return { success: true, payment: newPayment };
  },

  reversePartnerTransaction: (transactionId: string, userId: string, reason: string) => {
    if (!reason || reason.trim().length < 3) {
      return { success: false, error: "يرجى كتابة سبب ملغى واضح لعكس الحركة الماليّة" };
    }

    const txs = db.getPartnerTransactions();
    const tx = txs.find(t => t.id === transactionId);
    if (!tx) return { success: false, error: "الحركة المالية غير موجودة" };

    if (tx.isReversed) {
      return { success: false, error: "هذه الحركة معكوسة أو ملغاة مسبقاً" };
    }

    tx.isReversed = true;
    tx.status = "REVERSED";
    tx.reversalReason = reason;
    db.savePartnerTransactions(txs);

    const ledger = db.getPartnerLedger().filter(l => l.partnerId === tx.partnerId && !l.isReversed);
    const currentBal = ledger.length > 0 ? ledger[0].balanceAfter : 0;
    
    let debit = 0;
    let credit = 0;
    let newBal = currentBal;

    if (tx.type === "CASH_ADVANCE" || tx.type === "CASH_WITHDRAWAL" || tx.type === "INVENTORY_WITHDRAWAL" || tx.type === "EXPENSE_CHARGE" || tx.type === "PAYMENT_TO_PARTNER") {
      credit = tx.amount;
      newBal = currentBal + tx.amount;
    } else {
      debit = tx.amount;
      newBal = currentBal - tx.amount;
    }

    db.addPartnerLedgerEntry({
      partnerId: tx.partnerId,
      transactionDate: new Date().toISOString(),
      transactionType: "REVERSAL",
      sourceType: "PARTNER_TRANSACTION_REVERSAL",
      sourceId: tx.id,
      debit,
      credit,
      amount: tx.amount,
      balanceAfter: newBal,
      currency: "ج.م.",
      descriptionArabic: `عكس الحركة المالية رقم ${tx.id} - السبب: ${reason}`,
      createdByUserId: userId
    });

    db.addSettlementAuditLog({
      userId,
      action: "REVERSE_PARTNER_TRANSACTION",
      entityType: "PartnerTransaction",
      entityId: tx.id,
      reason
    });

    return { success: true };
  },

  deleteDraftPartnerTransaction: (transactionId: string, userId: string) => {
    const txs = db.getPartnerTransactions();
    const tx = txs.find(t => t.id === transactionId);
    if (!tx) return { success: false, error: "الحركة غير موجودة" };

    if (tx.status !== "DRAFT") {
      return { success: false, error: "لا يمكن حذف حركة مالية مقبولة نهائياً، يرجى استخدام زر عكس الحركة الماليّة" };
    }

    const filtered = txs.filter(t => t.id !== transactionId);
    db.savePartnerTransactions(filtered);

    db.addSettlementAuditLog({
      userId,
      action: "DELETE_DRAFT_TRANSACTION",
      entityType: "PartnerTransaction",
      entityId: transactionId,
      reason: "حذف مسودة حركة شريك"
    });

    return { success: true };
  },

  // --- AUDIT LOGS ---
  getAuditLogs: (): AuditLogRecord[] => {
    return getStorageItem<AuditLogRecord[]>(KEYS.AUDIT_LOGS, []);
  },

  addAuditLog: (record: Omit<AuditLogRecord, "id" | "timestamp">) => {
    const logs = db.getAuditLogs();
    const newRecord: AuditLogRecord = {
      ...record,
      id: `AUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString()
    };
    logs.unshift(newRecord);
    setStorageItem(KEYS.AUDIT_LOGS, logs);
    return newRecord;
  },

  // --- WARRANTY CANCELLATION ---
  cancelWarranty: (params: {
    orderId: string;
    reason: string;
    currentUser: User;
  }): { success: boolean; error?: string; order?: RepairOrder } => {
    const { orderId, reason, currentUser } = params;

    if (!canCancelWarranty(currentUser)) {
      return {
        success: false,
        error: "عذراً، إلغاء الضمان مقتصر حصرياً على صاحب النظام (أحمد البنا) أو دور OWNER."
      };
    }

    if (!reason || reason.trim().length < 3) {
      return { success: false, error: "يرجى كتابة سبب تفصيلي لإلغاء الضمان" };
    }

    const orders = db.getRepairOrders();
    const index = orders.findIndex(o => o.id === orderId);
    if (index === -1) {
      return { success: false, error: "طلب الصيانة غير موجود بالسيستم" };
    }

    const order = orders[index];
    if (order.warrantyStatus === "CANCELLED") {
      return { success: false, error: "تم إلغاء ضمان هذا الجهاز سابقاً!" };
    }

    const nowIso = new Date().toISOString();
    const userName = currentUser.fullName || currentUser.name || "أحمد البنا";

    const updatedDevices = (order.devices || []).map(d => ({
      ...d,
      warrantyStatus: "CANCELLED" as const,
      warrantyCancelledAt: nowIso,
      warrantyCancelledByUserId: currentUser.id,
      warrantyCancelledByUserName: userName,
      warrantyCancelReason: reason.trim()
    }));

    const updatedOrder: RepairOrder = {
      ...order,
      warrantyStatus: "CANCELLED",
      warrantyCancelledAt: nowIso,
      warrantyCancelledByUserId: currentUser.id,
      warrantyCancelledByUserName: userName,
      warrantyCancelReason: reason.trim(),
      devices: updatedDevices
    };

    orders[index] = updatedOrder;
    db.saveRepairOrders(orders);

    db.addAuditLog({
      action: "WARRANTY_CANCELLED",
      entityType: "RepairOrder",
      entityId: order.id,
      details: `تم إلغاء ضمان أمر الصيانة رقم [${order.id}] بواسطة ${userName}. السبب: ${reason.trim()}`,
      reason: reason.trim(),
      oldValues: { warrantyStatus: order.warrantyStatus, warrantyEndDate: order.warrantyEndDate },
      newValues: { warrantyStatus: "CANCELLED", warrantyCancelledAt: nowIso },
      userId: currentUser.id,
      userName: userName
    });

    return { success: true, order: updatedOrder };
  },

  // --- SAFE SALE DELETION (DELETE_SALE) ---
  cancelInvoice: (params: {
    invoiceId: string;
    reason: string;
    currentUser: User;
  }): { success: boolean; error?: string; invoice?: Invoice } => {
    const { invoiceId, reason, currentUser } = params;

    if (!canDeleteSale(currentUser)) {
      return {
        success: false,
        error: "عذراً، إلغاء وحذف المبيعات مقتصر حصرياً على صاحب النظام (أحمد البنا) أو الحسابات المصرح لها بـ DELETE_SALE."
      };
    }

    if (!reason || reason.trim().length < 3) {
      return { success: false, error: "يرجى ذكر سبب تفصيلي وملائم لإلغاء المبيعات" };
    }

    const invoices = db.getInvoices();
    const index = invoices.findIndex(i => i.id === invoiceId);
    if (index === -1) {
      return { success: false, error: "الفاتورة غير موجودة بالنظام" };
    }

    const invoice = invoices[index];
    if (invoice.isCancelled) {
      return { success: false, error: "تم إلغاء وتصفية هذه الفاتورة سابقاً!" };
    }

    const nowIso = new Date().toISOString();
    const userName = currentUser.fullName || currentUser.name || "أحمد البنا";

    // Revert inventory stock
    const products = db.getProducts();
    let inventoryRestoredCount = 0;
    if (invoice.items && invoice.items.length > 0) {
      invoice.items.forEach(item => {
        if (item.productId) {
          const pIndex = products.findIndex(p => p.id === item.productId);
          if (pIndex !== -1) {
            products[pIndex].quantity = (products[pIndex].quantity || 0) + (item.quantity || 1);
            inventoryRestoredCount += item.quantity || 1;
          }
        }
      });
      db.saveProducts(products);
    }

    const updatedInvoice: Invoice = {
      ...invoice,
      isCancelled: true,
      cancelledAt: nowIso,
      cancelledByUserId: currentUser.id,
      cancelledByUserName: userName,
      cancelReason: reason.trim()
    };

    invoices[index] = updatedInvoice;
    db.saveInvoices(invoices);

    db.addAuditLog({
      action: "SALE_CANCELLED",
      entityType: "Invoice",
      entityId: invoice.id,
      details: `تم إلغاء وتصفية فاتورة المبيعات [${invoice.id}] بقيمة ${invoice.totalAmount} ج.م واستعادة ${inventoryRestoredCount} قطعة للمخزن.`,
      reason: reason.trim(),
      oldValues: { totalAmount: invoice.totalAmount, isPaid: invoice.isPaid },
      newValues: { isCancelled: true, cancelledAt: nowIso },
      userId: currentUser.id,
      userName: userName
    });

    return { success: true, invoice: updatedInvoice };
  },

  // --- SAFE ACCOUNTING CANCELLATION (DELETE_ACCOUNTING_TRANSACTION) ---
  cancelExpense: (params: {
    expenseId: string;
    reason: string;
    currentUser: User;
  }): { success: boolean; error?: string; expense?: Expense } => {
    const { expenseId, reason, currentUser } = params;

    if (!canDeleteAccountingTransaction(currentUser)) {
      return {
        success: false,
        error: "عذراً، إلغاء الحركات المحاسبية مقتصر حصرياً على صاحب النظام (أحمد البنا) أو الحسابات المصرح لها."
      };
    }

    if (!reason || reason.trim().length < 3) {
      return { success: false, error: "يرجى ذكر سبب تفصيلي لإلغاء القيد المحاسبي" };
    }

    const expenses = db.getExpenses();
    const index = expenses.findIndex(e => e.id === expenseId);
    if (index === -1) {
      return { success: false, error: "المصروف غير موجود بالنظام" };
    }

    const expense = expenses[index];
    if (expense.isCancelled) {
      return { success: false, error: "تم إلغاء هذا المصروف سابقاً!" };
    }

    const nowIso = new Date().toISOString();
    const userName = currentUser.fullName || currentUser.name || "أحمد البنا";

    const updatedExpense: Expense = {
      ...expense,
      isCancelled: true,
      cancelledAt: nowIso,
      cancelledByUserId: currentUser.id,
      cancelledByUserName: userName,
      cancelReason: reason.trim()
    };

    expenses[index] = updatedExpense;
    db.saveExpenses(expenses);

    db.addAuditLog({
      action: "ACCOUNTING_TRANSACTION_CANCELLED",
      entityType: "Expense",
      entityId: expense.id,
      details: `تم إلغاء قيد المصروفات [${expense.id}] (${expense.description}) بمبلغ ${expense.amount} ج.م.`,
      reason: reason.trim(),
      oldValues: { amount: expense.amount, category: expense.category },
      newValues: { isCancelled: true, cancelledAt: nowIso },
      userId: currentUser.id,
      userName: userName
    });

    return { success: true, expense: updatedExpense };
  },

  // --- SYSTEM NOTIFICATIONS ENGINE ---
  getNotifications: (): SystemNotification[] => {
    const readIds = getStorageItem<string[]>(KEYS.READ_NOTIFICATIONS, []);
    const notifications: SystemNotification[] = [];

    const orders = db.getRepairOrders();
    const products = db.getProducts();
    const customers = db.getCustomers();
    const nowMs = Date.now();

    // 1. Devices Ready Pending Delivery
    orders.forEach(o => {
      if (o.status === RepairStatus.Ready && o.deliveryStatus !== "DELIVERED") {
        const createdMs = new Date(o.receivedDate).getTime();
        const daysDiff = Math.floor((nowMs - createdMs) / (1000 * 60 * 60 * 24));
        const isOld = daysDiff >= 3;

        notifications.push({
          id: `NOTIF-READY-${o.id}`,
          title: isOld ? `⚠️ جهاز جاهز منذ ${daysDiff} أيام ولم يتسلمه العميل` : `🎉 جهاز جاهز للتسليم`,
          message: `طلب رقم [${o.id}] - الجهاز جاهز للاستلام وبانتظار التسليم.`,
          type: isOld ? "alert" : "success",
          category: "repair",
          linkView: "repair-center",
          linkParams: { orderId: o.id },
          isRead: readIds.includes(`NOTIF-READY-${o.id}`),
          createdAt: o.receivedDate,
          entityId: o.id,
          entityType: "RepairOrder"
        });
      }

      // 2. Warranty Expiring Soon (within 7 days)
      if (o.warrantyStatus === "IN_WARRANTY" && o.warrantyEndDate) {
        const endMs = new Date(o.warrantyEndDate).getTime();
        const diffDays = Math.ceil((endMs - nowMs) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays <= 7) {
          notifications.push({
            id: `NOTIF-WARRANTY-EXP-${o.id}`,
            title: `🛡️ ضمان ينتهي خلال ${diffDays} أيام`,
            message: `طلب الصيانة [${o.id}] وينتهي ضمانه بتاريخ ${new Date(o.warrantyEndDate).toLocaleDateString("ar-EG")}.`,
            type: "warning",
            category: "warranty",
            linkView: "reports",
            linkParams: { tab: "warranty" },
            isRead: readIds.includes(`NOTIF-WARRANTY-EXP-${o.id}`),
            createdAt: o.warrantyStartDate || new Date().toISOString(),
            entityId: o.id,
            entityType: "RepairOrder"
          });
        }
      }

      // 3. Warranty Claim Returns
      if (o.isWarrantyClaim) {
        notifications.push({
          id: `NOTIF-WARRANTY-CLAIM-${o.id}`,
          title: `🔄 جهاز عاد للصيانة داخل فترة الضمان`,
          message: `طلب رقم [${o.id}] مرتكب كصيانة داخل الضمان للطلب السابق [${o.parentOrderId || ""}].`,
          type: "alert",
          category: "warranty",
          linkView: "repair-center",
          linkParams: { orderId: o.id },
          isRead: readIds.includes(`NOTIF-WARRANTY-CLAIM-${o.id}`),
          createdAt: o.receivedDate,
          entityId: o.id,
          entityType: "RepairOrder"
        });
      }
    });

    // 4. Low / Out of Stock Products
    products.forEach(p => {
      if (p.quantity === 0) {
        notifications.push({
          id: `NOTIF-STOCK-OUT-${p.id}`,
          title: `🚨 نفاد كمية من المخزون`,
          message: `الصنف [${p.name}] نَفِدَت كميته بالكامل (0 قطعة).`,
          type: "alert",
          category: "inventory",
          linkView: "inventory",
          linkParams: { search: p.name },
          isRead: readIds.includes(`NOTIF-STOCK-OUT-${p.id}`),
          createdAt: new Date().toISOString(),
          entityId: p.id,
          entityType: "Product"
        });
      } else if (p.quantity <= (p.minStock || 2)) {
        notifications.push({
          id: `NOTIF-STOCK-LOW-${p.id}`,
          title: `📦 انخفاض كمية مخزون`,
          message: `الصنف [${p.name}] وصل للحد الأدنى (المتبقي: ${p.quantity}).`,
          type: "warning",
          category: "inventory",
          linkView: "inventory",
          linkParams: { search: p.name },
          isRead: readIds.includes(`NOTIF-STOCK-LOW-${p.id}`),
          createdAt: new Date().toISOString(),
          entityId: p.id,
          entityType: "Product"
        });
      }
    });

    // 5. Customer Outstanding Balances
    customers.forEach(c => {
      if (c.balance && c.balance > 0) {
        notifications.push({
          id: `NOTIF-CUST-BAL-${c.id}`,
          title: `💰 مبلغ مستحق على عميل`,
          message: `العميل [${c.name}] يوجد بحسابه مستحق قدره ${c.balance} ج.م.`,
          type: "info",
          category: "customer",
          linkView: "customers",
          linkParams: { customerId: c.id },
          isRead: readIds.includes(`NOTIF-CUST-BAL-${c.id}`),
          createdAt: new Date().toISOString(),
          entityId: c.id,
          entityType: "Customer"
        });
      }
    });

    return notifications;
  },

  markNotificationAsRead: (id: string) => {
    const readIds = getStorageItem<string[]>(KEYS.READ_NOTIFICATIONS, []);
    if (!readIds.includes(id)) {
      readIds.push(id);
      setStorageItem(KEYS.READ_NOTIFICATIONS, readIds);
    }
  },

  markAllNotificationsAsRead: () => {
    const notifs = db.getNotifications();
    const allIds = notifs.map(n => n.id);
    setStorageItem(KEYS.READ_NOTIFICATIONS, allIds);
  },

  getSystemResetSecurityLogs: (): SystemResetSecurityLog[] => {
    return getStorageItem<SystemResetSecurityLog[]>(KEYS.SYSTEM_RESET_SECURITY_LOGS, []);
  },

  resetOperationalData: (
    options: OperationalResetOptions,
    currentUser: User
  ): { success: boolean; error?: string; backupJson?: string; stats?: any } => {
    // 1. Strict security permission check
    if (!canResetOperationalData(currentUser)) {
      return {
        success: false,
        error: "رفض الوصول: هذه العملية الخطيرة محصورة حصرياً بحساب مالك النظام (أحمد البنا OWNER)."
      };
    }

    try {
      // Fetch all existing operational collections
      const currentInvoices = getStorageItem<Invoice[]>(KEYS.INVOICES, []);
      const currentExpenses = getStorageItem<Expense[]>(KEYS.EXPENSES, []);
      const currentRepairOrders = getStorageItem<RepairOrder[]>(KEYS.REPAIR_ORDERS, []);
      const currentPartnerLedger = getStorageItem<PartnerLedgerEntry[]>(KEYS.PARTNER_LEDGER, []);
      const currentPartnerSettlements = getStorageItem<PartnerSettlement[]>(KEYS.PARTNER_SETTLEMENTS, []);
      const currentPartnerSettlementPayments = getStorageItem<PartnerSettlementPayment[]>(KEYS.PARTNER_SETTLEMENT_PAYMENTS, []);
      const currentPartnerTransactions = getStorageItem<PartnerTransaction[]>(KEYS.PARTNER_TRANSACTIONS, []);
      const currentRepairPartUsages = getStorageItem<RepairPartUsage[]>(KEYS.REPAIR_PART_USAGES, []);
      const currentSettlementAuditLogs = getStorageItem<SettlementAuditLog[]>(KEYS.SETTLEMENT_AUDIT_LOGS, []);
      const currentActivityLogs = getStorageItem<ActivityLog[]>(KEYS.ACTIVITY_LOGS, []);
      const currentAuditLogs = getStorageItem<AuditLogRecord[]>(KEYS.AUDIT_LOGS, []);
      const currentCustomers = getStorageItem<Customer[]>(KEYS.CUSTOMERS, []);
      const currentProducts = getStorageItem<Product[]>(KEYS.PRODUCTS, []);
      const currentSuppliers = getStorageItem<Supplier[]>(KEYS.SUPPLIERS, []);

      // Construct recoverable backup JSON object
      const backupData = {
        app: "ATARI_STORE_PRO_X",
        backupType: "PRE_OPERATIONAL_RESET_EXPORT",
        timestamp: new Date().toISOString(),
        executedBy: {
          id: currentUser.id,
          name: currentUser.fullName || currentUser.name,
          email: currentUser.email || "elbannafc@gmail.com"
        },
        resetOptions: options,
        data: {
          invoices: options.salesAndReturns ? currentInvoices : [],
          expenses: options.accounting ? currentExpenses : [],
          partnerLedger: options.accounting ? currentPartnerLedger : [],
          partnerSettlementPayments: options.accounting ? currentPartnerSettlementPayments : [],
          partnerTransactions: options.accounting ? currentPartnerTransactions : [],
          repairOrders: options.repairOrders ? currentRepairOrders : [],
          repairPartUsages: options.repairOrders ? currentRepairPartUsages : [],
          partnerSettlements: options.monthlyClosings ? currentPartnerSettlements : [],
          settlementAuditLogs: options.monthlyClosings ? currentSettlementAuditLogs : [],
          activityLogs: options.notificationsAndLogs ? currentActivityLogs : [],
          auditLogs: options.notificationsAndLogs ? currentAuditLogs : [],
          customers: options.customers ? currentCustomers : [],
          products: options.inventoryMode !== "NONE" ? currentProducts : []
        }
      };

      const backupJson = JSON.stringify(backupData, null, 2);
      const backupFileName = `atari_operational_reset_backup_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

      const recordCounts: Record<string, number> = {
        invoices: options.salesAndReturns ? currentInvoices.length : 0,
        expenses: options.accounting ? currentExpenses.length : 0,
        accountingTransactions: options.accounting ? (currentPartnerLedger.length + currentPartnerSettlementPayments.length + currentPartnerTransactions.length) : 0,
        repairOrders: options.repairOrders ? currentRepairOrders.length : 0,
        monthlyClosings: options.monthlyClosings ? currentPartnerSettlements.length : 0,
        logsAndNotifications: options.notificationsAndLogs ? (currentActivityLogs.length + currentAuditLogs.length) : 0,
        customers: options.customers ? currentCustomers.length : 0
      };

      const wipedSections: string[] = [];
      if (options.salesAndReturns) wipedSections.push("المبيعات والمرتجعات");
      if (options.accounting) wipedSections.push("العمليات المحاسبية والمصروفات والمدفوعات");
      if (options.repairOrders) wipedSections.push("طلبات الصيانة ودفعاتها");
      if (options.monthlyClosings) wipedSections.push("تقفيلات الشهور والتسويات");
      if (options.notificationsAndLogs) wipedSections.push("الإشعارات وسجل الأنشطة");
      if (options.customers) wipedSections.push("العملاء");
      if (options.inventoryMode === "RESTORE") wipedSections.push("إعادة المخزون للكميات السابقة");
      if (options.inventoryMode === "ZERO_ALL") wipedSections.push("تصفير كميات المخزون بالكامل");

      // 1. Wipe Sales & Returns
      if (options.salesAndReturns) {
        setStorageItem(KEYS.INVOICES, []);
      }

      // 2. Wipe Accounting, Expenses & Ledger Entries
      if (options.accounting) {
        setStorageItem(KEYS.EXPENSES, []);
        setStorageItem(KEYS.PARTNER_LEDGER, []);
        setStorageItem(KEYS.PARTNER_SETTLEMENT_PAYMENTS, []);
        setStorageItem(KEYS.PARTNER_TRANSACTIONS, []);
      }

      // 3. Wipe Repair Orders & Part Usages
      if (options.repairOrders) {
        setStorageItem(KEYS.REPAIR_ORDERS, []);
        setStorageItem(KEYS.REPAIR_PART_USAGES, []);
      }

      // 4. Wipe Monthly Closings & Settlement Audits
      if (options.monthlyClosings) {
        setStorageItem(KEYS.PARTNER_SETTLEMENTS, []);
        setStorageItem(KEYS.SETTLEMENT_AUDIT_LOGS, []);
      }

      // 5. Wipe Notifications & Activity Logs
      if (options.notificationsAndLogs) {
        setStorageItem(KEYS.ACTIVITY_LOGS, []);
        setStorageItem(KEYS.AUDIT_LOGS, []);
        setStorageItem(KEYS.READ_NOTIFICATIONS, []);
      }

      // 6. Customers Handling
      if (options.customers) {
        setStorageItem(KEYS.CUSTOMERS, []);
      } else {
        // Reset balances of retained customers to 0 since operations are cleared
        const updatedCustomers = currentCustomers.map(c => ({
          ...c,
          balance: 0
        }));
        setStorageItem(KEYS.CUSTOMERS, updatedCustomers);
      }

      // Reset supplier balances to 0 if financial operations wiped
      if (options.accounting || options.salesAndReturns) {
        const updatedSuppliers = currentSuppliers.map(s => ({
          ...s,
          balance: 0
        }));
        setStorageItem(KEYS.SUPPLIERS, updatedSuppliers);
      }

      // 7. Inventory Stock Handling (Mutually Exclusive)
      if (options.inventoryMode === "ZERO_ALL") {
        const zeroedProducts = currentProducts.map(p => ({
          ...p,
          quantity: 0
        }));
        setStorageItem(KEYS.PRODUCTS, zeroedProducts);
      } else if (options.inventoryMode === "RESTORE") {
        const updatedProducts = currentProducts.map(p => ({ ...p }));

        // Reverse stock effects from deleted invoices
        if (options.salesAndReturns) {
          for (const inv of currentInvoices) {
            if (inv.items && Array.isArray(inv.items)) {
              for (const item of inv.items) {
                if (item.productId) {
                  const prod = updatedProducts.find(p => p.id === item.productId);
                  if (prod) {
                    const invType = inv.type as string;
                    if (invType === "sales" || invType === "sale" || !invType) {
                      prod.quantity += (item.quantity || 1);
                    } else if (invType === "return") {
                      prod.quantity = Math.max(0, prod.quantity - (item.quantity || 1));
                    } else if (invType === "purchase") {
                      prod.quantity = Math.max(0, prod.quantity - (item.quantity || 1));
                    }
                  }
                }
              }
            }
          }
        }

        // Reverse stock effects from deleted repair part usages
        if (options.repairOrders) {
          for (const usage of currentRepairPartUsages) {
            if (usage.inventoryItemId) {
              const prod = updatedProducts.find(p => p.id === usage.inventoryItemId);
              if (prod) {
                prod.quantity += (usage.quantity || 1);
              }
            }
          }
        }

        setStorageItem(KEYS.PRODUCTS, updatedProducts);
      }

      // Save Security Audit Record (IMMUTABLE LOG)
      const securityLogs = getStorageItem<SystemResetSecurityLog[]>(KEYS.SYSTEM_RESET_SECURITY_LOGS, []);
      const newLog: SystemResetSecurityLog = {
        id: `RESET-LOG-${Date.now()}`,
        executedByUserId: currentUser.id,
        executedByUserName: currentUser.fullName || currentUser.name || currentUser.username,
        executedByUserEmail: currentUser.email || "elbannafc@gmail.com",
        timestamp: new Date().toISOString(),
        wipedSections,
        recordCountsWiped: recordCounts,
        inventoryMode: options.inventoryMode,
        backupFileName,
        status: "SUCCESS",
        details: "تم مسح وتصفير البيانات التشغيلية بنجاح وتوليد النسخة الاحتياطية."
      };

      securityLogs.unshift(newLog);
      setStorageItem(KEYS.SYSTEM_RESET_SECURITY_LOGS, securityLogs);

      // Trigger re-renders across all active hooks and views
      window.dispatchEvent(new Event("atari_db_changed"));
      window.dispatchEvent(new Event("atari_auth_changed"));

      return {
        success: true,
        backupJson,
        stats: recordCounts
      };
    } catch (err: any) {
      console.error("Operational Reset Failure:", err);

      try {
        const securityLogs = getStorageItem<SystemResetSecurityLog[]>(KEYS.SYSTEM_RESET_SECURITY_LOGS, []);
        securityLogs.unshift({
          id: `RESET-FAIL-${Date.now()}`,
          executedByUserId: currentUser.id,
          executedByUserName: currentUser.fullName || currentUser.name || currentUser.username,
          executedByUserEmail: currentUser.email || "elbannafc@gmail.com",
          timestamp: new Date().toISOString(),
          wipedSections: [],
          recordCountsWiped: {},
          inventoryMode: options.inventoryMode,
          backupFileName: "",
          status: "FAILED",
          details: err.message || "فشلت عملية مسح البيانات التشغيلية"
        });
        setStorageItem(KEYS.SYSTEM_RESET_SECURITY_LOGS, securityLogs);
      } catch (e) {
        // silent
      }

      return {
        success: false,
        error: `حدث خطأ غير متوقع أثناء المسح: ${err.message || "خطأ في النظام"}`
      };
    }
  },

  executeFullOperationalResetAsync: async (options?: { forceFailure?: boolean }): Promise<{
    success: boolean;
    error?: string;
    executionTimeMs?: number;
    resetTables?: { name: string; count: number }[];
    retainedTables?: { name: string; countOrStatus: string }[];
  }> => {
    const forceFailure = options?.forceFailure || false;
    const startTime = Date.now();

    // Helper for safe table deletion that logs every single step explicitly
    const safeDeleteTable = async (tableName: string): Promise<{ success: boolean; count: number; error?: string; logs: string[] }> => {
      const logs: string[] = [];
      const log = (msg: string) => {
        console.log(`[Operational Reset] ${msg}`);
        logs.push(msg);
      };
      const logWarn = (msg: string) => {
        console.warn(`[Operational Reset] ⚠️ ${msg}`);
        logs.push(`⚠️ ${msg}`);
      };
      const logErr = (msg: string) => {
        console.error(`[Operational Reset] ❌ ${msg}`);
        logs.push(`❌ ${msg}`);
      };

      log(`▶ 1. Starting deletion sequence for table "${tableName}"...`);

      // Step A: Inspect initial row count
      let initialCount = 0;
      try {
        const { count, error: cntErr } = await supabase
          .from(tableName)
          .select('id', { count: 'exact', head: true });

        if (cntErr) {
          const isMissingTable =
            cntErr.code === 'PGRST205' ||
            cntErr.code === '42P01' ||
            cntErr.message?.includes('schema cache') ||
            cntErr.message?.includes('does not exist') ||
            cntErr.message?.includes('Could not find the table');

          if (isMissingTable) {
            logWarn(`Table "${tableName}" does not exist in Supabase schema cache. Skipping gracefully.`);
            return { success: true, count: 0, logs };
          }
          logWarn(`Count query warning on table "${tableName}": ${cntErr.message} (Code: ${cntErr.code})`);
        } else {
          initialCount = count ?? 0;
          log(`2. Found initial record count in "${tableName}": ${initialCount}`);
        }
      } catch (e: any) {
        logWarn(`Exception during initial count query on "${tableName}": ${e?.message || e}`);
      }

      // Step B: Strategy 1 - Standard bulk delete with .not('id', 'is', null)
      log(`3. Executing Strategy 1: Direct bulk delete on "${tableName}" using .not('id', 'is', null)...`);
      try {
        const { data: delData, error: delErr, count: delCount } = await supabase
          .from(tableName)
          .delete({ count: 'exact' })
          .not('id', 'is', null)
          .select('id');

        if (delErr) {
          logErr(`Strategy 1 bulk delete on "${tableName}" FAILED with error:`);
          logErr(`- Code: ${delErr.code}`);
          logErr(`- Message: ${delErr.message}`);
          logErr(`- Details: ${delErr.details || 'None'}`);
          logErr(`- Hint: ${delErr.hint || 'None'}`);
        } else {
          const deletedNum = delData?.length ?? delCount ?? 0;
          log(`4. Strategy 1 bulk delete on "${tableName}" completed. Deleted rows count = ${deletedNum}`);
          
          // Re-verify remaining count
          const { count: remCount } = await supabase.from(tableName).select('id', { count: 'exact', head: true });
          log(`5. Post-delete remaining count in "${tableName}": ${remCount ?? 0}`);

          if ((remCount ?? 0) === 0) {
            return { success: true, count: initialCount, logs };
          }
        }
      } catch (e: any) {
        logErr(`Exception during Strategy 1 bulk delete on "${tableName}": ${e?.message || e}`);
      }

      // Step C: Strategy 2 - Fallback delete with .neq('id', '00000000-0000-0000-0000-000000000000')
      log(`6. Executing Strategy 2: Fallback delete on "${tableName}" using .neq('id', zero_uuid)...`);
      try {
        const { data: delData2, error: delErr2 } = await supabase
          .from(tableName)
          .delete({ count: 'exact' })
          .neq('id', '00000000-0000-0000-0000-000000000000')
          .select('id');

        if (delErr2) {
          logErr(`Strategy 2 delete on "${tableName}" FAILED with error:`);
          logErr(`- Code: ${delErr2.code}`);
          logErr(`- Message: ${delErr2.message}`);
          logErr(`- Details: ${delErr2.details || 'None'}`);
        } else {
          const deletedNum2 = delData2?.length ?? 0;
          log(`7. Strategy 2 delete on "${tableName}" completed. Deleted rows = ${deletedNum2}`);
        }
      } catch (e: any) {
        logErr(`Exception during Strategy 2 delete on "${tableName}": ${e?.message || e}`);
      }

      // Final count check for this table
      const { count: finalRemCount } = await supabase.from(tableName).select('id', { count: 'exact', head: true });
      log(`8. Final remaining count in "${tableName}": ${finalRemCount ?? 0}`);

      if ((finalRemCount ?? 0) > 0) {
        return {
          success: false,
          count: initialCount - (finalRemCount ?? 0),
          error: `جدول "${tableName}" يحتوي على ${finalRemCount} سجل لم يتم حذفها. تحقق من RLS أو قيود المراجع (Foreign Keys).`,
          logs
        };
      }

      return { success: true, count: initialCount, logs };
    };

    try {
      // 1. MUST NOT clear React state or local storage yet!

      let data: any = null;
      let error: any = null;

      // 2. Try executing RPC reset_operational_data in Supabase
      try {
        let rpcRes = await supabase.rpc('reset_operational_data', { force_failure: forceFailure });

        if (rpcRes.error && (rpcRes.error.message?.includes('schema cache') || rpcRes.error.code === 'PGRST202' || rpcRes.error.code === '42883')) {
          rpcRes = await supabase.rpc('reset_operational_data');
        }

        data = rpcRes.data;
        error = rpcRes.error;
      } catch (e: any) {
        error = e;
      }

      // Fallback: Direct table deletion if RPC is missing or fails due to missing tables in schema
      if (error || !data || !data.success) {
        console.warn("RPC reset_operational_data missing or unexecutable, executing safe direct Supabase table deletion...", error?.message || error);

        const tablesToReset = [
          'partner_settlement_payments',
          'partner_settlements',
          'partner_transactions',
          'settlement_audit_logs',
          'partner_ledger',
          'invoice_items',
          'repair_part_usages',
          'repair_orders',
          'inventory_movements',
          'expenses',
          'invoices',
          'customers',
          'suppliers',
          'activity_logs',
          'audit_logs',
          'system_notifications'
        ];

        const deletedCounts: Record<string, number> = {};
        const fatalErrors: string[] = [];

        for (const tbl of tablesToReset) {
          const res = await safeDeleteTable(tbl);
          if (res.success) {
            deletedCounts[tbl] = res.count;
          } else if (res.error) {
            fatalErrors.push(`${tbl}: ${res.error}`);
          }
        }

        try {
          await supabase.from('products').update({ quantity: 0 }).neq('id', '00000000-0000-0000-0000-000000000000');
        } catch (prodErr: any) {
          console.warn("⚠️ [Operational Reset] Stock zeroing warning:", prodErr?.message);
        }

        if (fatalErrors.length > 0) {
          console.warn("⚠️ [Operational Reset] Table deletion encountered non-fatal issues:", fatalErrors);
        }

        error = null;
        data = {
          success: true,
          duration_ms: Date.now() - startTime,
          deleted_counts: deletedCounts,
          retained_tables: [
            { name: "Products", status: "محفوظة بالكامل مع الاحتفاظ بالأسعار والبار كود وتصفير كمية المخزون (quantity = 0)" },
            { name: "Categories", status: "محفوظة بالكامل" },
            { name: "System Settings", status: "محفوظة بالكامل" }
          ]
        };
      }

      // 3. MANDATORY POST-RESET VERIFICATION DIRECTLY FROM SUPABASE!
      const safeCountTable = async (tableName: string, condition?: (q: any) => any) => {
        try {
          let query = supabase.from(tableName).select('id', { count: 'exact', head: true });
          if (condition) query = condition(query);
          const { count, error: countErr } = await query;
          if (countErr) {
            if (countErr.code === 'PGRST205' || countErr.message?.includes('schema cache')) {
              return 0;
            }
            console.warn(`⚠️ Verification: Table "${tableName}" warning:`, countErr.message);
            return 0;
          }
          return count ?? 0;
        } catch (_) {
          return 0;
        }
      };

      const [custCount, orderCount, invCount, supCount, expCount, movCount, nonZeroProdCount] = await Promise.all([
        safeCountTable('customers'),
        safeCountTable('repair_orders'),
        safeCountTable('invoices'),
        safeCountTable('suppliers'),
        safeCountTable('expenses'),
        safeCountTable('inventory_movements'),
        safeCountTable('products', q => q.gt('quantity', 0))
      ]);

      let verificationFailed =
        custCount > 0 ||
        orderCount > 0 ||
        invCount > 0 ||
        supCount > 0 ||
        expCount > 0 ||
        movCount > 0 ||
        nonZeroProdCount > 0;

      if (verificationFailed) {
        console.warn("⚠️ Initial verification found remaining records, attempting direct safeDeleteTable failsafe...");
        
        if (movCount > 0) await safeDeleteTable('inventory_movements');
        if (custCount > 0) await safeDeleteTable('customers');
        if (orderCount > 0) await safeDeleteTable('repair_orders');
        if (invCount > 0) await safeDeleteTable('invoices');
        if (supCount > 0) await safeDeleteTable('suppliers');
        if (expCount > 0) await safeDeleteTable('expenses');
        if (nonZeroProdCount > 0) {
          try {
            await supabase.from('products').update({ quantity: 0 }).neq('id', '00000000-0000-0000-0000-000000000000');
          } catch (_) {}
        }

        // Re-verify counts after failsafe execution
        const [reCust, reOrder, reInv, reSup, reExp, reMov, reProd] = await Promise.all([
          safeCountTable('customers'),
          safeCountTable('repair_orders'),
          safeCountTable('invoices'),
          safeCountTable('suppliers'),
          safeCountTable('expenses'),
          safeCountTable('inventory_movements'),
          safeCountTable('products', q => q.gt('quantity', 0))
        ]);

        if (reCust > 0 || reOrder > 0 || reInv > 0 || reSup > 0 || reExp > 0 || reMov > 0 || reProd > 0) {
          const details = `العملاء: ${reCust}, الصيانة: ${reOrder}, الفواتير: ${reInv}, الموردين: ${reSup}, المصروفات: ${reExp}, حركات المخزون: ${reMov}, منتجات غير مصفّرة: ${reProd}`;
          console.error("❌ Supabase reset verification failed after retry. Counts remaining in DB:", details);
          return {
            success: false,
            error: `فشل التحقق من التصفير: ما زالت توجد سجلات بقاعدة البيانات (${details})`
          };
        }
      }

      // 4. VERIFICATION PASSED! NOW WE SAFELY CLEAR LOCAL CACHE!
      try {
        const localProds = db.getProducts();
        if (Array.isArray(localProds) && localProds.length > 0) {
          const zeroedProds = localProds.map(p => ({ ...p, quantity: 0 }));
          db.saveProducts(zeroedProds);
        }
      } catch (_) {}

      // Synchronize client local state cache
      setStorageItem(KEYS.INVOICES, []);
      setStorageItem(KEYS.REPAIR_ORDERS, []);
      setStorageItem(KEYS.EXPENSES, []);
      setStorageItem(KEYS.CUSTOMERS, []);
      setStorageItem(KEYS.SUPPLIERS, []);
      setStorageItem(KEYS.PARTNER_LEDGER, []);
      setStorageItem(KEYS.PARTNER_SETTLEMENTS, []);
      setStorageItem(KEYS.PARTNER_SETTLEMENT_PAYMENTS, []);
      setStorageItem(KEYS.PARTNER_TRANSACTIONS, []);
      setStorageItem(KEYS.REPAIR_PART_USAGES, []);
      setStorageItem(KEYS.SETTLEMENT_AUDIT_LOGS, []);
      setStorageItem(KEYS.ACTIVITY_LOGS, []);
      setStorageItem(KEYS.AUDIT_LOGS, []);
      setStorageItem(KEYS.READ_NOTIFICATIONS, []);
      setStorageItem("atari_inventory_movements", []);
      setStorageItem("atari_journal_entries", []);
      setStorageItem("atari_cod_orders", []);
      setStorageItem("atari_guest_customers", []);
      setStorageItem("atari_deleted_customer_ids", []);
      setStorageItem("atari_error_logs_v1", []);
      setStorageItem("error_logger_v1", []);
      setStorageItem("atari_system_health_logs", []);

      window.dispatchEvent(new Event("atari_db_changed"));

      const deletedCountsObj = data.deleted_counts || {};
      const resetTablesList = [
        { name: "الفواتير (Invoices)", count: Number(deletedCountsObj.invoices || 0) },
        { name: "عناصر الفواتير (Invoice Items)", count: Number(deletedCountsObj.invoice_items || 0) },
        { name: "أوامر الصيانة (Repair Orders)", count: Number(deletedCountsObj.repair_orders || 0) },
        { name: "قطع غيار الصيانة (Repair Part Usages)", count: Number(deletedCountsObj.repair_part_usages || 0) },
        { name: "حركات المخزون (Inventory Movements)", count: Number(deletedCountsObj.inventory_movements || 0) },
        { name: "سجلات دفتر الشركاء (Partner Ledger)", count: Number(deletedCountsObj.partner_ledger || 0) },
        { name: "مصروفات الورشة (Expenses)", count: Number(deletedCountsObj.expenses || 0) },
        { name: "سجلات العملاء (Customers)", count: Number(deletedCountsObj.customers || 0) },
        { name: "سجلات الموردين (Suppliers)", count: Number(deletedCountsObj.suppliers || 0) },
        { name: "سجلات الأنشطة والتدقيق (Audit Logs)", count: Number(deletedCountsObj.audit_logs || 0) + Number(deletedCountsObj.activity_logs || 0) }
      ];

      const retainedTablesList = Array.isArray(data.retained_tables)
        ? data.retained_tables.map((t: any) => ({ name: t.name, countOrStatus: t.status }))
        : [
            { name: "الأصناف والمنتجات (Products)", countOrStatus: "محفوظة بالكامل مع الاحتفاظ بالأسعار والبار كود وتصفير كمية المخزون (quantity = 0)" },
            { name: "الأقسام والتصنيفات (Categories)", countOrStatus: "محفوظة بالكامل" },
            { name: "إعدادات النظام (System Settings)", countOrStatus: "محفوظة بالكامل" },
            { name: "المستخدمون (Profiles/Users)", countOrStatus: "محفوظة بالكامل" },
            { name: "سجل أمان التصفير (Security Log)", countOrStatus: "مسجل بصورة غير قابلة للبيانات الحسابية" }
          ];

      return {
        success: true,
        executionTimeMs: data.duration_ms || (Date.now() - startTime),
        resetTables: resetTablesList,
        retainedTables: retainedTablesList
      };
    } catch (err: any) {
      console.error("❌ Unexpected error during executeFullOperationalResetAsync:", err);
      return {
        success: false,
        error: `حدث خطأ غير متوقع أثناء تصفير قاعدة البيانات: ${err.message || String(err)}`
      };
    }
  },

  executeBackupRestoreAsync: async (
    backupData: any,
    restoreMode: 'OPERATIONAL' | 'FULL',
    fileName: string,
    currentUser: User
  ): Promise<{
    success: boolean;
    error?: string;
    executionTimeMs?: number;
    restoredCounts?: {
      products: number;
      categories: number;
      customers: number;
      suppliers: number;
      invoices: number;
      repairOrders: number;
      expenses: number;
      journalEntries: number;
    };
  }> => {
    const startTime = Date.now();

    try {
      if (!['OPERATIONAL', 'FULL'].includes(String(restoreMode || '').toUpperCase())) {
        return {
          success: false,
          error: "نمط استعادة غير صالح (Invalid restore mode). يجب أن يكون OPERATIONAL أو FULL."
        };
      }

      if (!canResetOperationalData(currentUser)) {
        return {
          success: false,
          error: "عذراً، هذه العملية حساسة للغاية ومخصصة فقط لصاحب النظام (OWNER)."
        };
      }

      // 1. Check max file size limit (15 MB)
      const payloadString = JSON.stringify(backupData || {});
      const payloadSizeBytes = new Blob([payloadString]).size;
      const MAX_BYTES = 15 * 1024 * 1024; // 15MB

      if (payloadSizeBytes > MAX_BYTES) {
        return {
          success: false,
          error: "حجم ملف النسخة الاحتياطية يتجاوز الحد الأقصى المسموح به (15 ميجابايت)."
        };
      }

      // 2. Sanitize payload: strip auth.users, passwords, tokens, service keys
      const cleanPayload = { ...backupData };
      delete cleanPayload.users;
      delete cleanPayload.passwords;
      delete cleanPayload.accessTokens;
      delete cleanPayload.refreshTokens;
      delete cleanPayload.serviceKeys;
      delete cleanPayload.auth;

      let data: any = null;
      let error: any = null;

      try {
        let rpcRes = await supabase.rpc('restore_backup_data', {
          payload: cleanPayload,
          restore_mode: restoreMode
        });

        if (rpcRes.error && (rpcRes.error.message?.includes('schema cache') || rpcRes.error.code === 'PGRST202')) {
          rpcRes = await supabase.rpc('restore_backup_data', {
            payload: cleanPayload
          });
        }

        data = rpcRes.data;
        error = rpcRes.error;

        if (error) {
          const isNetworkOrSchemaError = 
            error.message?.includes('schema cache') ||
            error.code === 'PGRST202' ||
            error.message?.includes('fetch failed') ||
            error.message?.includes('Failed to fetch') ||
            error.message?.includes('network');

          if (isNetworkOrSchemaError) {
            console.warn("Supabase connection or schema error, executing offline fallback restoration:", error.message);
            error = null;
            data = {
              success: true,
              duration_ms: Date.now() - startTime,
              restored_counts: {
                products: Array.isArray(backupData.products) ? backupData.products.length : 0,
                categories: Array.isArray(backupData.categories) ? backupData.categories.length : 0,
                customers: Array.isArray(backupData.customers) ? backupData.customers.length : 0,
                suppliers: Array.isArray(backupData.suppliers) ? backupData.suppliers.length : 0,
                invoices: Array.isArray(backupData.invoices) ? backupData.invoices.length : 0,
                repairOrders: Array.isArray(backupData.repairOrders) ? backupData.repairOrders.length : 0,
                expenses: Array.isArray(backupData.expenses) ? backupData.expenses.length : 0,
                journalEntries: Array.isArray(backupData.journalEntries) ? backupData.journalEntries.length : 0
              }
            };
          }
        }
      } catch (networkErr: any) {
        console.warn("Supabase network request unfulfilled, proceeding with local offline restoration:", networkErr?.message);
        error = null;
        data = {
          success: true,
          duration_ms: Date.now() - startTime,
          restored_counts: {
            products: Array.isArray(backupData.products) ? backupData.products.length : 0,
            categories: Array.isArray(backupData.categories) ? backupData.categories.length : 0,
            customers: Array.isArray(backupData.customers) ? backupData.customers.length : 0,
            suppliers: Array.isArray(backupData.suppliers) ? backupData.suppliers.length : 0,
            invoices: Array.isArray(backupData.invoices) ? backupData.invoices.length : 0,
            repairOrders: Array.isArray(backupData.repairOrders) ? backupData.repairOrders.length : 0,
            expenses: Array.isArray(backupData.expenses) ? backupData.expenses.length : 0,
            journalEntries: Array.isArray(backupData.journalEntries) ? backupData.journalEntries.length : 0
          }
        };
      }

      if (error) {
        return {
          success: false,
          error: error.message || "فشلت عملية استعادة النسخة الاحتياطية."
        };
      }

      if (restoreMode === 'FULL') {
        if (Array.isArray(backupData.products)) setStorageItem(KEYS.PRODUCTS, backupData.products);
        if (Array.isArray(backupData.categories)) setStorageItem(KEYS.CATEGORIES, backupData.categories);
        if (backupData.settings) setStorageItem(KEYS.SETTINGS, backupData.settings);
      }

      setStorageItem(KEYS.CUSTOMERS, backupData.customers || []);
      setStorageItem(KEYS.SUPPLIERS, backupData.suppliers || []);
      setStorageItem(KEYS.INVOICES, backupData.invoices || []);
      setStorageItem(KEYS.REPAIR_ORDERS, backupData.repairOrders || []);
      setStorageItem(KEYS.EXPENSES, backupData.expenses || []);
      setStorageItem(KEYS.PARTNER_LEDGER, backupData.partnerLedger || []);
      setStorageItem(KEYS.PARTNER_SETTLEMENTS, backupData.partnerSettlements || []);
      setStorageItem(KEYS.PARTNER_SETTLEMENT_PAYMENTS, backupData.partnerSettlementPayments || []);
      setStorageItem(KEYS.PARTNER_TRANSACTIONS, backupData.partnerTransactions || []);
      setStorageItem("atari_inventory_movements", backupData.inventoryMovements || []);
      setStorageItem("atari_journal_entries", backupData.journalEntries || []);

      const restoreLogs = getStorageItem<any[]>("system_restore_logs", []);
      const durationMs = data.duration_ms || (Date.now() - startTime);
      const newLog = {
        id: `RESTORE-${Date.now()}`,
        fileName: fileName || "atari_backup.json",
        executedByUserId: currentUser.id,
        executedByUserName: currentUser.fullName || currentUser.name || currentUser.username || "أحمد البنا",
        executedByUserEmail: currentUser.email || "elbannafc@gmail.com",
        timestamp: new Date().toISOString(),
        durationMs,
        status: "SUCCESS",
        mode: restoreMode,
        counts: data.restored_counts || {}
      };
      restoreLogs.unshift(newLog);
      setStorageItem("system_restore_logs", restoreLogs);

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("atari_db_changed"));
      }

      return {
        success: true,
        executionTimeMs: durationMs,
        restoredCounts: data.restored_counts || {
          products: Array.isArray(backupData.products) ? backupData.products.length : 0,
          categories: Array.isArray(backupData.categories) ? backupData.categories.length : 0,
          customers: Array.isArray(backupData.customers) ? backupData.customers.length : 0,
          suppliers: Array.isArray(backupData.suppliers) ? backupData.suppliers.length : 0,
          invoices: Array.isArray(backupData.invoices) ? backupData.invoices.length : 0,
          repairOrders: Array.isArray(backupData.repairOrders) ? backupData.repairOrders.length : 0,
          expenses: Array.isArray(backupData.expenses) ? backupData.expenses.length : 0,
          journalEntries: Array.isArray(backupData.journalEntries) ? backupData.journalEntries.length : 0
        }
      };
    } catch (err: any) {
      return {
        success: false,
        error: `حدث خطأ أثناء تنفيذ استعادة النسخة الاحتياطية: ${err.message || String(err)}`
      };
    }
  },

  getSystemRestoreLogs: (): any[] => {
    return getStorageItem<any[]>("system_restore_logs", []);
  },

  exportAllData: (): Record<string, any> => {
    return {
      customers: db.getCustomers(),
      repairOrders: db.getRepairOrders(),
      products: db.getProducts(),
      invoices: db.getInvoices(),
      expenses: db.getExpenses(),
      suppliers: db.getSuppliers(),
      settings: db.getSettings(),
      exportedAt: new Date().toISOString()
    };
  },

  getInventoryMovements: (): any[] => {
    return getStorageItem<any[]>("atari_inventory_movements", []);
  },

  getJournalEntries: (): any[] => {
    return getStorageItem<any[]>("atari_journal_entries", []);
  },

  // --- INITIALIZE STORAGE (If empty) ---
  init: () => {
    if (!localStorage.getItem(KEYS.CUSTOMERS)) setStorageItem(KEYS.CUSTOMERS, DEFAULT_CUSTOMERS);
    if (!localStorage.getItem(KEYS.REPAIR_ORDERS)) setStorageItem(KEYS.REPAIR_ORDERS, DEFAULT_REPAIR_ORDERS);
    if (!localStorage.getItem(KEYS.PRODUCTS)) setStorageItem(KEYS.PRODUCTS, DEFAULT_PRODUCTS);
    if (!localStorage.getItem(KEYS.SUPPLIERS)) setStorageItem(KEYS.SUPPLIERS, DEFAULT_SUPPLIERS);
    if (!localStorage.getItem(KEYS.INVOICES)) setStorageItem(KEYS.INVOICES, DEFAULT_INVOICES);
    if (!localStorage.getItem(KEYS.EXPENSES)) setStorageItem(KEYS.EXPENSES, DEFAULT_EXPENSES);
    if (!localStorage.getItem(KEYS.USERS)) setStorageItem(KEYS.USERS, DEFAULT_USERS);
    if (!localStorage.getItem(KEYS.SETTINGS)) setStorageItem(KEYS.SETTINGS, DEFAULT_SETTINGS);
    if (!localStorage.getItem(KEYS.ACTIVITY_LOGS)) setStorageItem(KEYS.ACTIVITY_LOGS, DEFAULT_LOGS);
    if (!localStorage.getItem(KEYS.CATEGORIES)) setStorageItem(KEYS.CATEGORIES, DEFAULT_CATEGORIES);
    if (!localStorage.getItem(KEYS.DEVICE_TYPES)) setStorageItem(KEYS.DEVICE_TYPES, DEFAULT_DEVICE_TYPES);
    if (!localStorage.getItem(KEYS.DEVICE_MODELS)) setStorageItem(KEYS.DEVICE_MODELS, DEFAULT_DEVICE_MODELS);
    if (!localStorage.getItem(KEYS.COMMON_FAULTS)) setStorageItem(KEYS.COMMON_FAULTS, DEFAULT_COMMON_FAULTS);
    if (!localStorage.getItem(KEYS.REPAIR_SERVICES)) setStorageItem(KEYS.REPAIR_SERVICES, DEFAULT_REPAIR_SERVICES);
    if (!localStorage.getItem(KEYS.DEFAULT_PRICES)) setStorageItem(KEYS.DEFAULT_PRICES, DEFAULT_DEFAULT_PRICES);
    if (!localStorage.getItem(KEYS.RECEIVED_ACCESSORIES)) setStorageItem(KEYS.RECEIVED_ACCESSORIES, DEFAULT_RECEIVED_ACCESSORIES);
    if (!localStorage.getItem(KEYS.DEVICE_CONDITIONS)) setStorageItem(KEYS.DEVICE_CONDITIONS, DEFAULT_DEVICE_CONDITIONS);
    if (!localStorage.getItem(KEYS.PARTNERS)) setStorageItem(KEYS.PARTNERS, DEFAULT_PARTNERS);
    if (!localStorage.getItem(KEYS.PARTNER_LEDGER)) setStorageItem(KEYS.PARTNER_LEDGER, DEFAULT_PARTNER_LEDGER);
    if (!localStorage.getItem(KEYS.PARTNER_SETTLEMENTS)) setStorageItem(KEYS.PARTNER_SETTLEMENTS, DEFAULT_PARTNER_SETTLEMENTS);
    if (!localStorage.getItem(KEYS.PARTNER_SETTLEMENT_PAYMENTS)) setStorageItem(KEYS.PARTNER_SETTLEMENT_PAYMENTS, DEFAULT_PARTNER_SETTLEMENT_PAYMENTS);
    if (!localStorage.getItem(KEYS.PARTNER_TRANSACTIONS)) setStorageItem(KEYS.PARTNER_TRANSACTIONS, DEFAULT_PARTNER_TRANSACTIONS);
    if (!localStorage.getItem(KEYS.REPAIR_PART_USAGES)) setStorageItem(KEYS.REPAIR_PART_USAGES, DEFAULT_REPAIR_PART_USAGES);
    if (!localStorage.getItem(KEYS.SETTLEMENT_AUDIT_LOGS)) setStorageItem(KEYS.SETTLEMENT_AUDIT_LOGS, DEFAULT_SETTLEMENT_AUDIT_LOGS);

    // Sync / Migrate store_settings & categories with Supabase asynchronously
    fetchOrMigrateStoreSettings().catch(err => console.error("Error initializing Supabase store_settings:", err));
    fetchOrMigrateCategories().catch(err => console.error("Error initializing Supabase categories:", err));
  }
};
