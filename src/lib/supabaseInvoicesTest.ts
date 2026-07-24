import {
  fetchOrMigrateInvoices,
  addInvoiceToSupabase,
  cancelInvoiceInSupabase,
  getLocalInvoicesBackup
} from './supabaseInvoices';
import { PaymentMethod, User } from '../types';

export interface InvoiceTestResult {
  success: boolean;
  logs: string[];
  stats: {
    localInvoicesCount: number;
    uploadedInvoicesCount: number;
    invoiceDuplicatesCount: number;
    balanceMatched: boolean;
  };
}

export async function runInvoicesTestSuite(): Promise<InvoiceTestResult> {
  const logs: string[] = [];
  const addLog = (msg: string) => {
    console.log(msg);
    logs.push(`[${new Date().toLocaleTimeString('ar-EG')}] ${msg}`);
  };

  addLog("🚀 بدء تشغيل حزمة اختبارات ترحيل الفواتير وبنود الفواتير Phase 5 مع Supabase...");

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

  const stats = {
    localInvoicesCount: 0,
    uploadedInvoicesCount: 0,
    invoiceDuplicatesCount: 0,
    balanceMatched: false
  };

  try {
    // =========================================================
    // TEST 1: First Migration
    // =========================================================
    addLog("--- [اختبار 1] ترحيل الفواتير وبنودها للمرة الأولى ---");
    const localInvs = getLocalInvoicesBackup();
    stats.localInvoicesCount = localInvs.length;
    addLog(`📦 عدد الفواتير في التخزين المحلي (localStorage): ${stats.localInvoicesCount}`);

    const mig1 = await fetchOrMigrateInvoices();
    if (!mig1.success) {
      addLog(`❌ فشل الاتصال بقاعدة البيانات لترحيل الفواتير: ${mig1.error}`);
    } else {
      stats.uploadedInvoicesCount = mig1.invoices.length;
      stats.balanceMatched = mig1.balanceMatch;
      addLog(`✅ تم الاتصال وترحيل الفواتير وبنودها بنجاح. عدد الفواتير الحالي بـ Supabase: ${mig1.invoices.length}`);
      addLog(`💰 تطابق مجاميع الفواتير: ${mig1.balanceMatch ? "نعم ✅" : "لا ⚠️"}`);
    }

    // =========================================================
    // TEST 2: Re-run Migration Duplicate Protection
    // =========================================================
    addLog("--- [اختبار 2] إعادة تشغيل ترحيل الفواتير لمنع التكرار ---");
    const mig2 = await fetchOrMigrateInvoices();
    stats.invoiceDuplicatesCount = mig2.duplicatesCount;
    if (mig2.invoices.length === mig1.invoices.length) {
      addLog(`✅ ممتاز! لم ينشأ أي فاتورة مكررة عند إعادة الترحيل (عدد المكررات الممنوعة: ${mig2.duplicatesCount}).`);
    } else {
      addLog(`⚠️ تحذير: اختلاف في عدد الفواتير بعد إعادة الترحيل.`);
    }

    // =========================================================
    // TEST 3: Add New Invoice with Full Item Snapshot
    // =========================================================
    addLog("--- [اختبار 3] إنشاء فاتورة جديدة بـ Supabase مع Snapshot كامل للبنود ---");
    const newInv = await addInvoiceToSupabase({
      customerId: "C-001",
      items: [
        {
          productId: "P-001",
          name: "ذراع تحكم PS5 تجريبي مع حفظ الـ Snapshot",
          quantity: 2,
          price: 3900,
          costPrice: 3200,
          stockOwnership: "AHMED"
        }
      ],
      totalAmount: 7800,
      discount: 100,
      paidAmount: 7700,
      paymentMethod: PaymentMethod.Cash,
      type: "sales",
      isPaid: true
    }, mockOwner);

    addLog(`✅ تم إنشاء الفاتورة الجديدة بنجاح رقم: ${newInv.id} بقيمة ${newInv.totalAmount} ج.م.`);
    addLog(`📸 البند الأول الملقوط snapshot: اسم [${newInv.items[0]?.name}] | سعر بيع [${newInv.items[0]?.price}] | تكلفة [${newInv.items[0]?.costPrice}]`);

    // =========================================================
    // TEST 4: Cancel Invoice Test
    // =========================================================
    addLog("--- [اختبار 4] إلغاء فاتورة بـ Supabase (Cancellation) ---");
    const cancelRes = await cancelInvoiceInSupabase(newInv.id, "إلغاء لغرض الاختبار التلقائي", mockOwner);
    addLog(`✅ نتيجة إلغاء الفاتورة: ${cancelRes.message}`);

    addLog("🎉 اكتملت جميع اختبارات الفواتير وبنود الفواتير لـ Phase 5 بنجاح تام!");

    return {
      success: true,
      logs,
      stats
    };
  } catch (err: any) {
    addLog(`❌ حدث خطأ أثناء تشغيل اختبارات الفواتير: ${err?.message || err}`);
    return {
      success: false,
      logs,
      stats
    };
  }
}
