/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase } from "./supabaseClient";

export type UserRole =
  | "OWNER"
  | "ADMIN"
  | "MANAGER"
  | "TECHNICIAN"
  | "RECEPTIONIST"
  | "CASHIER"
  | "INVENTORY"
  | "ACCOUNTANT"
  | "VIEWER";

export interface PermissionDefinition {
  id: string;
  labelAr: string;
  descriptionAr: string;
  category: string;
}

export interface PermissionCategory {
  id: string;
  nameAr: string;
  permissions: PermissionDefinition[];
}

export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    id: "dashboard",
    nameAr: "لوحة التحكم",
    permissions: [
      { id: "dashboard.view", labelAr: "عرض لوحة التحكم", descriptionAr: "رؤية الإحصائيات العامة والمؤشرات الرئيسية", category: "dashboard" }
    ]
  },
  {
    id: "customers",
    nameAr: "إدارة العملاء",
    permissions: [
      { id: "customers.view", labelAr: "عرض العملاء", descriptionAr: "عرض قائمة العملاء وبياناتهم", category: "customers" },
      { id: "customers.create", labelAr: "إضافة عميل", descriptionAr: "إنشاء حساب عميل جديد", category: "customers" },
      { id: "customers.edit", labelAr: "تعديل عميل", descriptionAr: "تعديل البيانات الأساسية للعميل", category: "customers" },
      { id: "customers.delete", labelAr: "حذف عميل", descriptionAr: "حذف سجل العميل نهائياً", category: "customers" }
    ]
  },
  {
    id: "repairs",
    nameAr: "أوامر الصيانة والورشة",
    permissions: [
      { id: "repairs.view", labelAr: "عرض أجهزة الصيانة", descriptionAr: "رؤية أوامر الصيانة والأجهزة المسجلة", category: "repairs" },
      { id: "repairs.create", labelAr: "إنشاء أمر صيانة", descriptionAr: "استقبال جهاز وتسجيل أمر صيانة جديد", category: "repairs" },
      { id: "repairs.edit", labelAr: "تعديل أمر صيانة", descriptionAr: "تعديل الأجهزة، التكلفة، أو البيانات", category: "repairs" },
      { id: "repairs.change_status", labelAr: "تحديث حالة الصيانة", descriptionAr: "تغيير حالة الصيانة (قيد الإصلاح، جاهز، إلخ)", category: "repairs" },
      { id: "repairs.assign_technician", labelAr: "إسناد لفني", descriptionAr: "تعيين الفني المسؤول عن جهاز الصيانة", category: "repairs" },
      { id: "repairs.view_internal_notes", labelAr: "رؤية الملاحظات الداخلية", descriptionAr: "قراءة الملاحظات السرية للورشة والفنيين", category: "repairs" },
      { id: "repairs.edit_internal_notes", labelAr: "تعديل الملاحظات الداخلية", descriptionAr: "كتابة أو تعديل الملاحظات الفنية السرية", category: "repairs" },
      { id: "repairs.view_customer_notes", labelAr: "رؤية ملاحظات العميل", descriptionAr: "قراءة تقرير الفحص الموجه للعميل", category: "repairs" },
      { id: "repairs.print_receipt", labelAr: "طباعة إيصال الاستلام", descriptionAr: "طباعة الفاتورة أو إيصال استلام الجهاز", category: "repairs" },
      { id: "repairs.deliver_device", labelAr: "تسليم الجهاز للعميل", descriptionAr: "إتمام عملية تسليم الجهاز وتحصيل المتبقي (خاص لأحمد البنا / OWNER)", category: "repairs" },
      { id: "repairs.reopen_delivered", labelAr: "إعادة فتح طلب صيانة مسلّم", descriptionAr: "إعادة فتح طلب صيانة مغلق للتعديل (خاص لأحمد البنا / OWNER)", category: "repairs" },
      { id: "warranty.cancel", labelAr: "إلغاء ضمان أجهزة الصيانة", descriptionAr: "إلغاء ضمان جهاز مع تسجيل أسباب استثنائية (خاص لأحمد البنا / OWNER)", category: "repairs" },
      { id: "repairs.cancel", labelAr: "إلغاء أمر الصيانة", descriptionAr: "إلغاء الطلب وتحويله لملغى", category: "repairs" },
      { id: "repairs.delete", labelAr: "حذف أمر صيانة", descriptionAr: "حذف أمر الصيانة نهائياً من النظام", category: "repairs" }
    ]
  },
  {
    id: "inventory",
    nameAr: "المخزون والقطع",
    permissions: [
      { id: "inventory.view", labelAr: "عرض المخزون", descriptionAr: "رؤية المنتجات وقطع الغيار المتاحة", category: "inventory" },
      { id: "inventory.create", labelAr: "إضافة منتج / قطعة", descriptionAr: "تعريف صنف أو قطعة غيار جديدة", category: "inventory" },
      { id: "inventory.edit", labelAr: "تعديل منتج", descriptionAr: "تعديل بيانات الصنف أو أسعار البيع", category: "inventory" },
      { id: "inventory.adjust", labelAr: "تسوية المخزون", descriptionAr: "تعديل كميات المجرودات بالمخزن", category: "inventory" },
      { id: "inventory.purchase", labelAr: "إضافة فاتورة شراء", descriptionAr: "تسجيل شراء كميات جديدة من الموردين", category: "inventory" },
      { id: "inventory.return", labelAr: "مرتجع شراء / بيع", descriptionAr: "تسجيل المرتجعات للمخزن", category: "inventory" },
      { id: "inventory.view_cost", labelAr: "رؤية سعر التكلفة", descriptionAr: "إظهار أسعار تكلفة قطع الغيار والمنتجات", category: "inventory" },
      { id: "inventory.view_profit", labelAr: "رؤية أرباح المنتجات", descriptionAr: "رؤية هامش الربح بالمنتجات والقطع", category: "inventory" },
      { id: "inventory.delete", labelAr: "حذف من المخزون", descriptionAr: "حذف أصناف أو قطع من النظام", category: "inventory" }
    ]
  },
  {
    id: "payments",
    nameAr: "المدفوعات والمبيعات",
    permissions: [
      { id: "payments.view", labelAr: "عرض الفواتير والمدفوعات", descriptionAr: "رؤية حركة الفواتير والتحصيلات", category: "payments" },
      { id: "payments.create", labelAr: "تحصيل دفعة / بيع", descriptionAr: "إنشاء فاتورة مبيعات أو تحصيل مقبوضات", category: "payments" },
      { id: "payments.refund", labelAr: "إرجاع مبلغ للعميل", descriptionAr: "رد المبالغ للعملاء (Refund)", category: "payments" },
      { id: "payments.reverse", labelAr: "عكس دفعة مالية", descriptionAr: "إلغاء عملية تحصيل سابقة معالجة بجهالة", category: "payments" },
      { id: "sales.delete", labelAr: "حذف وتصفية عملية بيع (DELETE_SALE)", descriptionAr: "إلغاء فاتورة مبيعات وإعادة المخزون بصورة آمنة (خاص بأحمد البنا / OWNER)", category: "payments" },
      { id: "payments.delete", labelAr: "حذف فاتورة / دفعة", descriptionAr: "حذف الفواتير نهائياً من السجل", category: "payments" }
    ]
  },
  {
    id: "cashbox",
    nameAr: "الخزنة والنقدية والمحاسبة",
    permissions: [
      { id: "cashbox.view", labelAr: "عرض حركة الخزنة", descriptionAr: "رؤية رصيد الخزينة والنقدية الحالية", category: "cashbox" },
      { id: "cashbox.deposit", labelAr: "إيداع نقدية", descriptionAr: "إضافة أموال للخزينة", category: "cashbox" },
      { id: "cashbox.withdraw", labelAr: "سحب / مصروفات", descriptionAr: "إخراج نقدية أو تسجيل مصروفات تشغيلية", category: "cashbox" },
      { id: "cashbox.close_shift", labelAr: "إغلاق الورديات", descriptionAr: "تقفيل وردية الخزنة وتصفيتها", category: "cashbox" },
      { id: "accounting.delete_transaction", labelAr: "حذف وإلغاء قيد محاسبي (DELETE_ACCOUNTING_TRANSACTION)", descriptionAr: "إلغاء القيود والعمليات المحاسبية (خاص بأحمد البنا / OWNER)", category: "cashbox" },
      { id: "cashbox.view_history", labelAr: "سجل الخزنة التاريخي", descriptionAr: "مراجعة العمليات السابقة بالخزينة", category: "cashbox" }
    ]
  },
  {
    id: "partners",
    nameAr: "محاسبة الشركاء",
    permissions: [
      { id: "partners.view", labelAr: "عرض محاسبة الشركاء", descriptionAr: "رؤية دفاتر الشركاء وحساباتهم", category: "partners" },
      { id: "partners.create_entries", labelAr: "إضافة قيود شركاء", descriptionAr: "تسجيل مصروفات أو إيرادات خاصة بمركزي الشركاء", category: "partners" },
      { id: "partners.create_settlement", labelAr: "إنشاء تسوية أرباح", descriptionAr: "إنشاء مسودة تسوية أرباح الفترة", category: "partners" },
      { id: "partners.approve_settlement", labelAr: "اعتماد التسويات", descriptionAr: "صرف وتأكيد تسويات الشركاء النهائياً", category: "partners" },
      { id: "partners.reverse_entry", labelAr: "عكس قيد شريك", descriptionAr: "إلغاء قيد محاسبي بسجل الشركاء", category: "partners" },
      { id: "partners.view_profit", labelAr: "رؤية الأرباح الحقيقية", descriptionAr: "عرض صافي الأرباح الموزعة بين الشركاء", category: "partners" },
      { id: "partners.view_private_jobs", labelAr: "رؤية شغل الشركاء الخاص", descriptionAr: "عرض عمليات شغل العبده وشغل شريف الخاص", category: "partners" }
    ]
  },
  {
    id: "reports",
    nameAr: "التقارير التحليلية",
    permissions: [
      { id: "reports.view", labelAr: "عرض التقارير العام", descriptionAr: "رؤية التقارير التشغيلية", category: "reports" },
      { id: "reports.export", labelAr: "تصدير التقارير", descriptionAr: "تحميل التقارير بصيغ Excel/PDF", category: "reports" },
      { id: "reports.financial", labelAr: "التقارير المالية والأرباح", descriptionAr: "عرض تقارير الدخل والمصروفات والأرباح", category: "reports" },
      { id: "reports.inventory", labelAr: "تقارير حركة المخزون", descriptionAr: "عرض نواقص وحركة الأصناف والقطع", category: "reports" },
      { id: "reports.repairs", labelAr: "تقارير الصيانة والورشة", descriptionAr: "أداء الفنيين والأجهزة المكتملة", category: "reports" },
      { id: "reports.partners", labelAr: "تقارير حسابات الشركاء", descriptionAr: "تقرير مفصل لأرباح وخسائر الشركاء", category: "reports" }
    ]
  },
  {
    id: "users",
    nameAr: "إدارة المستخدمين والأمن",
    permissions: [
      { id: "users.view", labelAr: "عرض طاقم العمل", descriptionAr: "رؤية قائمة المستخدمين بالبرنامج", category: "users" },
      { id: "users.create", labelAr: "إضافة موظف جديد", descriptionAr: "إنشاء حساب موظف وتحديد بياناته", category: "users" },
      { id: "users.edit", labelAr: "تعديل بيانات موظف", descriptionAr: "تعديل الاسم أو الوظيفة أو الهاتف", category: "users" },
      { id: "users.disable", labelAr: "تعطيل / تفعيل الحسابات", descriptionAr: "إيقاف الموظف عن دخول النظام نهائياً", category: "users" },
      { id: "users.reset_password", labelAr: "إعادة تعيين كلمة المرور", descriptionAr: "تغيير كلمة مرور أي موظف فوراً", category: "users" },
      { id: "users.manage_roles", labelAr: "تغيير الأدوار الوظيفية", descriptionAr: "تعديل المسمى الوظيفي والدور", category: "users" },
      { id: "users.manage_permissions", labelAr: "تخصيص الصلاحيات الدقيقة", descriptionAr: "منح أو سحب صلاحيات محددة لكل مستخدم", category: "users" }
    ]
  },
  {
    id: "settings",
    nameAr: "إعدادات النظام الفنية",
    permissions: [
      { id: "settings.view", labelAr: "عرض الإعدادات", descriptionAr: "رؤية بيانات المحل والطباعة", category: "settings" },
      { id: "settings.edit", labelAr: "تعديل بيانات المرفق والطباعة", descriptionAr: "تغيير اللوجو، الهيدر، النسبة والواتساب", category: "settings" },
      { id: "settings.security", labelAr: "إعدادات الأمان وقواعد البيانات", descriptionAr: "التحكم بالنسخ الاحتياطي والجلسات", category: "settings" },
      { id: "settings.backup", labelAr: "تصدير النسخ الاحتياطية", descriptionAr: "تنزيل قاعدة البيانات بالكامل", category: "settings" },
      { id: "RESET_OPERATIONAL_DATA", labelAr: "مسح بيانات التشغيل التجريبية (RESET_OPERATIONAL_DATA)", descriptionAr: "إعادة ضبط وتصفير البيانات التشغيلية والتجريبية للنظام (خاص بأحمد البنا / OWNER)", category: "settings" }
    ]
  },
  {
    id: "audit",
    nameAr: "سجل الأحداث والرقابة (Audit Log)",
    permissions: [
      { id: "audit.view", labelAr: "عرض سجل الأحداث والعمليات", descriptionAr: "مراجعة كافة الأنشطة والتغييرات بالنظام", category: "audit" },
      { id: "audit.export", labelAr: "تصدير سجل الرقابة", descriptionAr: "تصدير سجلات الأنشطة للأمان", category: "audit" }
    ]
  }
];

export const ALL_PERMISSIONS: string[] = PERMISSION_CATEGORIES.flatMap(cat =>
  cat.permissions.map(p => p.id)
);

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  OWNER: ALL_PERMISSIONS,
  ADMIN: [
    "dashboard.view",
    "customers.view", "customers.create", "customers.edit", "customers.delete",
    "repairs.view", "repairs.create", "repairs.edit", "repairs.change_status", "repairs.assign_technician", "repairs.view_internal_notes", "repairs.edit_internal_notes", "repairs.view_customer_notes", "repairs.print_receipt", "repairs.cancel", "repairs.delete",
    "inventory.view", "inventory.create", "inventory.edit", "inventory.adjust", "inventory.purchase", "inventory.return", "inventory.view_cost", "inventory.view_profit", "inventory.delete",
    "payments.view", "payments.create", "payments.refund", "payments.reverse", "payments.delete",
    "cashbox.view", "cashbox.deposit", "cashbox.withdraw", "cashbox.close_shift", "cashbox.view_history",
    "reports.view", "reports.export", "reports.financial", "reports.inventory", "reports.repairs", "reports.partners",
    "users.view", "users.create", "users.edit", "users.disable", "users.reset_password", "users.manage_roles", "users.manage_permissions",
    "settings.view", "settings.edit", "settings.security", "settings.backup",
    "audit.view", "audit.export"
  ],
  MANAGER: [
    "dashboard.view",
    "customers.view", "customers.create", "customers.edit",
    "repairs.view", "repairs.create", "repairs.edit", "repairs.change_status", "repairs.assign_technician", "repairs.view_internal_notes", "repairs.edit_internal_notes", "repairs.view_customer_notes", "repairs.print_receipt", "repairs.cancel",
    "inventory.view", "inventory.create", "inventory.edit", "inventory.adjust", "inventory.purchase", "inventory.return", "inventory.view_cost",
    "payments.view", "payments.create", "payments.refund",
    "cashbox.view", "cashbox.deposit", "cashbox.withdraw", "cashbox.view_history",
    "reports.view", "reports.repairs", "reports.inventory",
    "audit.view"
  ],
  TECHNICIAN: [
    "dashboard.view",
    "repairs.view", "repairs.change_status", "repairs.view_internal_notes", "repairs.edit_internal_notes", "repairs.view_customer_notes",
    "inventory.view"
  ],
  RECEPTIONIST: [
    "dashboard.view",
    "customers.view", "customers.create", "customers.edit",
    "repairs.view", "repairs.create", "repairs.view_customer_notes", "repairs.print_receipt",
    "payments.view", "payments.create",
    "inventory.view"
  ],
  CASHIER: [
    "dashboard.view",
    "customers.view",
    "repairs.view", "repairs.print_receipt",
    "payments.view", "payments.create", "payments.refund",
    "cashbox.view", "cashbox.deposit", "cashbox.withdraw", "cashbox.close_shift", "cashbox.view_history"
  ],
  INVENTORY: [
    "dashboard.view",
    "inventory.view", "inventory.create", "inventory.edit", "inventory.adjust", "inventory.purchase", "inventory.return", "inventory.view_cost"
  ],
  ACCOUNTANT: [
    "dashboard.view",
    "customers.view",
    "payments.view", "payments.create", "payments.refund", "payments.reverse",
    "cashbox.view", "cashbox.deposit", "cashbox.withdraw", "cashbox.close_shift", "cashbox.view_history",
    "partners.view", "partners.create_entries", "partners.create_settlement", "partners.approve_settlement", "partners.reverse_entry", "partners.view_profit", "partners.view_private_jobs",
    "reports.view", "reports.export", "reports.financial", "reports.inventory", "reports.repairs", "reports.partners",
    "audit.view"
  ],
  VIEWER: [
    "dashboard.view",
    "customers.view",
    "repairs.view",
    "inventory.view"
  ]
};

export const ROLE_LABELS_AR: Record<UserRole, string> = {
  OWNER: "مالك النظام (OWNER)",
  ADMIN: "مدير عام (ADMIN)",
  MANAGER: "مدير فرع / تشغيل (MANAGER)",
  TECHNICIAN: "مهندس صيانة (TECHNICIAN)",
  RECEPTIONIST: "موظف استقبال (RECEPTIONIST)",
  CASHIER: "أمين خزانة / صراف (CASHIER)",
  INVENTORY: "أمين مخزن (INVENTORY)",
  ACCOUNTANT: "محاسب متدقق (ACCOUNTANT)",
  VIEWER: "مستعرض (VIEWER)"
};

export interface UserAuthCheckResult {
  isOwner: boolean;
  role: UserRole;
  userId?: string;
  email?: string;
  source: string;
}

/**
 * Single source of truth for user role & owner permission verification.
 * Prioritizes real-time Supabase Auth session, get_auth_user_role() RPC, is_owner() RPC,
 * and profiles table.
 */
export async function getAuthenticatedUserRole(
  passedUser?: { id?: string; roleId?: string; role?: string; email?: string } | null
): Promise<UserAuthCheckResult> {
  // 1. Check live Supabase Auth session first
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const email = session.user.email || '';
      const userId = session.user.id;

      if (email.toLowerCase() === 'elbannafc@gmail.com') {
        return { isOwner: true, role: 'OWNER', userId, email, source: 'SUPABASE_EMAIL' };
      }

      // Check is_owner RPC
      const { data: isOwnerRpc, error: ownerErr } = await supabase.rpc('is_owner');
      if (!ownerErr && isOwnerRpc === true) {
        return { isOwner: true, role: 'OWNER', userId, email, source: 'RPC_IS_OWNER' };
      }

      // Check get_auth_user_role RPC
      const { data: roleRpc, error: roleErr } = await supabase.rpc('get_auth_user_role');
      if (!roleErr && roleRpc) {
        const rawRole = String(roleRpc).toUpperCase();
        const normRole: UserRole = rawRole === 'ADMIN' ? 'OWNER' : (rawRole as UserRole);
        const isOwner = rawRole === 'OWNER' || rawRole === 'ADMIN';
        return { isOwner, role: normRole, userId, email, source: 'RPC_GET_AUTH_ROLE' };
      }

      // Check profiles table in Supabase
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      if (profile?.role) {
        const pRole = String(profile.role).toUpperCase();
        const normRole: UserRole = pRole === 'ADMIN' ? 'OWNER' : (pRole as UserRole);
        const isOwner = pRole === 'OWNER' || pRole === 'ADMIN';
        return { isOwner, role: normRole, userId, email, source: 'SUPABASE_PROFILES' };
      }

      // Check metadata in session
      const metaRole = (session.user.user_metadata?.role || session.user.app_metadata?.role || '').toUpperCase();
      if (metaRole) {
        const normRole: UserRole = metaRole === 'ADMIN' ? 'OWNER' : (metaRole as UserRole);
        const isOwner = metaRole === 'OWNER' || metaRole === 'ADMIN';
        return { isOwner, role: normRole, userId, email, source: 'SUPABASE_METADATA' };
      }
    }
  } catch (err) {
    console.warn('⚠️ Error checking Supabase session for user role:', err);
  }

  // 2. Fallback to passedUser object if provided
  if (passedUser) {
    const rawRole = (passedUser.roleId || passedUser.role || '').toUpperCase();
    const isOwner = rawRole === 'OWNER' || rawRole === 'ADMIN' || passedUser.email?.toLowerCase() === 'elbannafc@gmail.com';
    const normRole: UserRole = isOwner ? 'OWNER' : (rawRole as UserRole || 'RECEPTIONIST');
    return { isOwner, role: normRole, userId: passedUser.id, email: passedUser.email, source: 'PASSED_USER' };
  }

  // 3. Fallback to local session if present
  try {
    const storedSession = localStorage.getItem('atari_current_session_v2');
    const storedUsers = localStorage.getItem('atari_erp_users_v2');
    if (storedSession && storedUsers) {
      const sess = JSON.parse(storedSession);
      const usersList = JSON.parse(storedUsers);
      const matched = usersList.find((u: any) => u.id === sess.userId);
      if (matched) {
        const rawRole = (matched.roleId || matched.role || '').toUpperCase();
        const isOwner = rawRole === 'OWNER' || rawRole === 'ADMIN' || matched.email?.toLowerCase() === 'elbannafc@gmail.com';
        return { isOwner, role: isOwner ? 'OWNER' : (rawRole as UserRole || 'RECEPTIONIST'), userId: matched.id, email: matched.email, source: 'LOCAL_FALLBACK' };
      }
    }
  } catch {
    // ignore
  }

  return { isOwner: false, role: 'RECEPTIONIST', source: 'DEFAULT_FALLBACK' };
}

export function isUserOwnerSync(user?: { roleId?: UserRole; role?: string; permissions?: string[]; id?: string; email?: string } | null | undefined): boolean {
  if (!user) return false;
  const roleId = (user.roleId || '').toUpperCase();
  const role = (user.role || '').toUpperCase();
  if (roleId === 'OWNER' || role === 'OWNER' || roleId === 'ADMIN' || user.email?.toLowerCase() === 'elbannafc@gmail.com' || user.id === 'U-101' || user.id === 'U-OWNER-001') {
    return true;
  }
  return false;
}

export function canDeliverDevice(user: { roleId?: UserRole; role?: string; permissions?: string[]; id?: string; email?: string } | null | undefined): boolean {
  if (!user) return false;
  if (user.roleId === "OWNER" || user.role === "OWNER" || user.id === "U-101" || user.id === "U-OWNER-001" || user.email === "elbannafc@gmail.com") return true;
  if (user.permissions?.includes("repairs.deliver_device") || user.permissions?.includes("all")) return true;
  return false;
}

export function canReopenDeliveredOrder(user: { roleId?: UserRole; role?: string; permissions?: string[]; id?: string; email?: string } | null | undefined): boolean {
  if (!user) return false;
  if (user.roleId === "OWNER" || user.role === "OWNER" || user.id === "U-101" || user.id === "U-OWNER-001" || user.email === "elbannafc@gmail.com") return true;
  if (user.permissions?.includes("repairs.reopen_delivered") || user.permissions?.includes("all")) return true;
  return false;
}

export function canDeleteSale(user: { roleId?: UserRole; role?: string; permissions?: string[]; id?: string; email?: string } | null | undefined): boolean {
  if (!user) return false;
  if (user.roleId === "OWNER" || user.role === "OWNER" || user.id === "U-101" || user.id === "U-OWNER-001" || user.email === "elbannafc@gmail.com") return true;
  if (user.permissions?.includes("sales.delete") || user.permissions?.includes("all")) return true;
  return false;
}

export function canDeleteAccountingTransaction(user: { roleId?: UserRole; role?: string; permissions?: string[]; id?: string; email?: string } | null | undefined): boolean {
  if (!user) return false;
  if (user.roleId === "OWNER" || user.role === "OWNER" || user.id === "U-101" || user.id === "U-OWNER-001" || user.email === "elbannafc@gmail.com") return true;
  if (user.permissions?.includes("accounting.delete_transaction") || user.permissions?.includes("all")) return true;
  return false;
}

export function canCancelWarranty(user: { roleId?: UserRole; role?: string; permissions?: string[]; id?: string; email?: string } | null | undefined): boolean {
  if (!user) return false;
  if (user.roleId === "OWNER" || user.role === "OWNER" || user.id === "U-101" || user.id === "U-OWNER-001" || user.email === "elbannafc@gmail.com") return true;
  if (user.permissions?.includes("warranty.cancel") || user.permissions?.includes("all")) return true;
  return false;
}

export function canResetOperationalData(user: { roleId?: UserRole; role?: string; permissions?: string[]; id?: string; email?: string; name?: string; fullName?: string } | null | undefined): boolean {
  if (!user) return false;
  // Strictly OWNER check
  if (user.roleId === "OWNER" || user.role === "OWNER" || user.id === "U-101" || user.id === "U-OWNER-001" || user.email === "elbannafc@gmail.com") {
    return true;
  }
  return false;
}

export function hasPermission(
  userRole: UserRole | undefined,
  userCustomPermissions: string[] | undefined,
  requiredPermission: string
): boolean {
  if (!userRole) return false;
  if (userRole === "OWNER") return true;

  // Check custom user permissions overrides first
  if (userCustomPermissions && userCustomPermissions.includes(requiredPermission)) {
    return true;
  }

  // Check role default permissions
  const defaultPerms = DEFAULT_ROLE_PERMISSIONS[userRole] || [];
  return defaultPerms.includes(requiredPermission);
}

export function getViewRequiredPermission(viewId: string): string | null {
  switch (viewId) {
    case "dashboard":
      return "dashboard.view";
    case "reception":
      return "repairs.create";
    case "customers":
      return "customers.view";
    case "repair-center":
      return "repairs.view";
    case "ai-diagnostics":
      return "repairs.view";
    case "inventory":
      return "inventory.view";
    case "accounting":
      return "payments.view";
    case "partner-accounting":
      return "partners.view";
    case "reports":
      return "reports.view";
    case "users":
      return "users.view";
    case "settings":
      return "settings.view";
    case "system-health":
      return "settings.view";
    case "audit":
      return "audit.view";
    case "tracking":
      return null; // Public tracking page
    default:
      return "dashboard.view";
  }
}
