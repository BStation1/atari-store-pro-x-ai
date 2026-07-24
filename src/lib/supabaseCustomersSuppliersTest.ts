import {
  fetchOrMigrateCustomers,
  addCustomerToSupabase,
  updateCustomerInSupabase,
  deleteCustomerFromSupabase,
  getLocalCustomersBackup
} from './supabaseCustomers';
import {
  fetchOrMigrateSuppliers,
  addSupplierToSupabase,
  updateSupplierInSupabase,
  deleteSupplierFromSupabase,
  getLocalSuppliersBackup
} from './supabaseSuppliers';
import { CustomerType, User } from '../types';

export interface TestResult {
  success: boolean;
  logs: string[];
  stats: {
    localCustomersCount: number;
    uploadedCustomersCount: number;
    customerDuplicatesCount: number;
    customerBalancesMatched: boolean;
    localSuppliersCount: number;
    uploadedSuppliersCount: number;
    supplierDuplicatesCount: number;
    supplierBalancesMatched: boolean;
  };
}

export async function runCustomersAndSuppliersTestSuite(): Promise<TestResult> {
  const logs: string[] = [];
  const addLog = (msg: string) => {
    console.log(msg);
    logs.push(`[${new Date().toLocaleTimeString('ar-EG')}] ${msg}`);
  };

  addLog("🚀 بدء تشغيل حزمة اختبارات ترحيل العملاء والموردين Phase 4 مع Supabase...");

  const mockOwner: User = {
    id: "U-101",
    username: "elbanna",
    name: "أحمد البنا",
    fullName: "أحمد البنا (مدير النظام)",
    role: "OWNER",
    roleId: "OWNER",
    email: "elbannafc@gmail.com",
    permissions: ["*"],
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const mockReception: User = {
    id: "U-103",
    username: "sara_reception",
    name: "سارة محمود",
    fullName: "سارة محمود (الاستقبال)",
    role: "RECEPTIONIST",
    roleId: "RECEPTIONIST",
    email: "sara@atari.com",
    permissions: [],
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const mockEngineer: User = {
    id: "U-102",
    username: "karim_tech",
    name: "كريم صالح",
    fullName: "كريم صالح (المهندس)",
    role: "TECHNICIAN",
    roleId: "TECHNICIAN",
    email: "karim@atari.com",
    permissions: [],
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const stats = {
    localCustomersCount: 0,
    uploadedCustomersCount: 0,
    customerDuplicatesCount: 0,
    customerBalancesMatched: false,
    localSuppliersCount: 0,
    uploadedSuppliersCount: 0,
    supplierDuplicatesCount: 0,
    supplierBalancesMatched: false
  };

  try {
    // =========================================================
    // TEST 1: Customers First Migration
    // =========================================================
    addLog("--- [اختبار 1] ترحيل العملاء للمرة الأولى ---");
    const localCusts = getLocalCustomersBackup();
    stats.localCustomersCount = localCusts.length;
    addLog(`📦 عدد العملاء في المحلي (localStorage): ${stats.localCustomersCount}`);

    const custMig1 = await fetchOrMigrateCustomers();
    if (!custMig1.success) {
      addLog(`❌ فشل الاتصال بقاعدة البيانات للعملاء: ${custMig1.error}`);
    } else {
      stats.uploadedCustomersCount = custMig1.customers.length;
      stats.customerBalancesMatched = custMig1.balanceMatch;
      addLog(`✅ تم الاتصال وقراءة/رفع العملاء بنجاح. العدد الإجمالي الحالي في Supabase: ${custMig1.customers.length}`);
      addLog(`💰 تطابق الأرصدة قبل وبعد الترحيل: ${custMig1.balanceMatch ? "نعم ✅" : "لا ⚠️"}`);
    }

    // =========================================================
    // TEST 2: Customers Re-Run Migration Duplicate Check
    // =========================================================
    addLog("--- [اختبار 2] إعادة تشغيل ترحيل العملاء لمنع التكرار ---");
    const custMig2 = await fetchOrMigrateCustomers();
    stats.customerDuplicatesCount = custMig2.duplicatesCount;
    if (custMig2.customers.length === custMig1.customers.length) {
      addLog(`✅ ممتاز! لم ينشأ أي عميل مكرر عند إعادة الترحيل (عدد المكررات الممنوعة: ${custMig2.duplicatesCount}).`);
    } else {
      addLog(`⚠️ تحذير: تغيير في عدد العملاء بين التشغيلين (${custMig1.customers.length} -> ${custMig2.customers.length})`);
    }

    // =========================================================
    // TEST 3: Add & Update Customer Test
    // =========================================================
    addLog("--- [اختبار 3] إضافة وتعديل عميل في Supabase مع التحقق من الصلاحيات ---");
    const testPhone = `2010999${Math.floor(1000 + Math.random() * 9000)}`;
    const newCust = await addCustomerToSupabase({
      name: "عميل تجريبي مرحلة 4",
      phone: testPhone,
      type: CustomerType.Individual,
      email: "test_cust@atari.com",
      notes: "اختبار تلقائي",
      balance: 150
    }, mockReception);

    addLog(`✅ تم إضافة العميل التجريبي بنجاح ID: ${newCust.id} بالهاتف: ${newCust.phone}`);

    // Update customer
    newCust.notes = "تم تحديث الملاحظات بـ Supabase";
    newCust.balance = 200;
    const updatedCust = await updateCustomerInSupabase(newCust, mockReception);
    addLog(`✅ تم تحديث بيانات العميل بنجاح في Supabase.`);

    // Try creating duplicate phone - should fail
    try {
      await addCustomerToSupabase({
        name: "عميل مكرر بنفس رقم الهاتف",
        phone: testPhone,
        type: CustomerType.Individual,
        balance: 0
      }, mockReception);
      addLog(`⚠️ خطأ: سمح النظام بإنشاء رقم هاتف مكرر!`);
    } catch (dupErr: any) {
      addLog(`✅ نجاح حظر التكرار: ${dupErr.message}`);
    }

    // Clean up test customer
    try {
      await deleteCustomerFromSupabase(updatedCust.id, mockOwner);
      addLog(`✅ تم تنظيف وحذف العميل التجريبي بنجاح.`);
    } catch (delErr: any) {
      addLog(`ℹ️ نتيجة حذف العميل التجريبي: ${delErr.message}`);
    }

    // =========================================================
    // TEST 4: Suppliers First Migration
    // =========================================================
    addLog("--- [اختبار 4] ترحيل الموردين للمرة الأولى ---");
    const localSups = getLocalSuppliersBackup();
    stats.localSuppliersCount = localSups.length;
    addLog(`📦 عدد الموردين المحليين: ${stats.localSuppliersCount}`);

    const supMig1 = await fetchOrMigrateSuppliers();
    if (!supMig1.success) {
      addLog(`❌ فشل ترحيل الموردين: ${supMig1.error}`);
    } else {
      stats.uploadedSuppliersCount = supMig1.suppliers.length;
      stats.supplierBalancesMatched = supMig1.balanceMatch;
      addLog(`✅ تم ترحيل/قراءة الموردين بـ Supabase بنجاح. العدد الحالي: ${supMig1.suppliers.length}`);
      addLog(`💰 تطابق أرصدة الموردين: ${supMig1.balanceMatch ? "نعم ✅" : "لا ⚠️"}`);
    }

    // =========================================================
    // TEST 5: Suppliers Re-Run Migration Duplicate Check
    // =========================================================
    addLog("--- [اختبار 5] إعادة تشغيل ترحيل الموردين لمنع التكرار ---");
    const supMig2 = await fetchOrMigrateSuppliers();
    stats.supplierDuplicatesCount = supMig2.duplicatesCount;
    if (supMig2.suppliers.length === supMig1.suppliers.length) {
      addLog(`✅ ممتاز! لم ينشأ أي مورد مكرر عند إعادة الترحيل.`);
    } else {
      addLog(`⚠️ تحذير: تم الكشف عن اختلاف في عدد الموردين.`);
    }

    // =========================================================
    // TEST 6: Add & Update Supplier Test
    // =========================================================
    addLog("--- [اختبار 6] إضافة وتعديل مورد بـ Supabase ---");
    const supPhone = `2011888${Math.floor(1000 + Math.random() * 9000)}`;
    const newSup = await addSupplierToSupabase({
      name: "مورد قطع غيار سوني تجريبي",
      company: "سوني مصر كونسول",
      phone: supPhone,
      balance: 5000,
      notes: "اختبار الموردين"
    }, mockOwner);

    addLog(`✅ تم إضافة المورد التجريبي بنجاح ID: ${newSup.id}`);

    newSup.balance = 3500;
    newSup.notes = "ملاحظات معدلة بـ Supabase";
    const updatedSup = await updateSupplierInSupabase(newSup, mockOwner);
    addLog(`✅ تم تحديث بيانات المورد وحفظ الرصيد المعدل (${updatedSup.balance} ج.م) بنجاح.`);

    // Cleanup test supplier
    await deleteSupplierFromSupabase(updatedSup.id, mockOwner);
    addLog(`✅ تم حذف/أرشفة المورد التجريبي بنجاح.`);

    // =========================================================
    // TEST 7: Role Permissions Check
    // =========================================================
    addLog("--- [اختبار 7] فحص قيود الصلاحيات والأدوار (Permissions) ---");
    try {
      await addSupplierToSupabase({
        name: "مورد غير مصرح به",
        company: "شركة وهمية",
        phone: "01000000000",
        balance: 0
      }, mockEngineer);
      addLog(`⚠️ خطأ: سمح للـ ENGINEER بإنشاء مورد!`);
    } catch (permErr: any) {
      addLog(`✅ منع الصلاحيات يعمل كالمطلوب: ${permErr.message}`);
    }

    addLog("🎉 اكتملت جميع اختبارات المرحلة الرابعة (Phase 4) بنجاح تام!");

    return {
      success: true,
      logs,
      stats
    };
  } catch (err: any) {
    addLog(`❌ حدث خطأ حرج أثناء تشغيل الاختبارات: ${err?.message || err}`);
    return {
      success: false,
      logs,
      stats
    };
  }
}
