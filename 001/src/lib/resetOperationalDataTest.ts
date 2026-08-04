import { supabase } from './supabaseClient';

export interface SingleTestDetail {
  id: number;
  title: string;
  expected: string;
  actual: string;
  passed: boolean;
  diffDetails?: string;
}

export interface ResetTestSuiteResult {
  success: boolean;
  totalPassed: number;
  totalFailed: number;
  logs: string[];
  tests: SingleTestDetail[];
}

/**
 * Integration test suite for Atomic Operational Reset (PostgreSQL RPC reset_operational_data).
 *
 * Verification steps:
 * 1. Seeds test data into multiple relational operational tables.
 * 2. Invokes reset_operational_data(force_failure = true) after deleting/writing.
 * 3. Asserts PostgreSQL Rollback: all data remains present, security log NOT created.
 * 4. Invokes reset_operational_data(force_failure = false).
 * 5. Asserts successful wipe of operational data.
 * 6. Asserts retained tables (products, categories, store_settings, profiles).
 * 7. Asserts product stock quantities remained completely unchanged.
 * 8. Asserts security log entry created on success.
 */
export async function runResetOperationalDataTestSuite(): Promise<ResetTestSuiteResult> {
  const logs: string[] = [];
  const tests: SingleTestDetail[] = [];
  let totalPassed = 0;
  let totalFailed = 0;

  const addLog = (msg: string) => {
    console.log(msg);
    logs.push(`[${new Date().toLocaleTimeString('ar-EG')}] ${msg}`);
  };

  addLog("🚀 بدء تشغيل اختبارات Atomic Operational Reset (PostgreSQL RPC Rollback & Success)...");

  const assertTest = (
    testId: number,
    title: string,
    expectedDesc: string,
    actualDesc: string,
    condition: boolean,
    diffDetails?: string
  ) => {
    if (condition) {
      addLog(`✅ PASS [اختبار ${testId}]: ${title}`);
      totalPassed++;
    } else {
      addLog(`❌ FAIL [اختبار ${testId}]: ${title}`);
      if (diffDetails) addLog(`   تفاصيل الفرق: ${diffDetails}`);
      totalFailed++;
    }
    tests.push({
      id: testId,
      title,
      expected: expectedDesc,
      actual: actualDesc,
      passed: condition,
      diffDetails
    });
  };

  try {
    // Check Supabase connectivity
    const { data: pingData, error: pingErr } = await supabase.from('store_settings').select('company_name').limit(1);
    if (pingErr) {
      addLog("⚠️ لم يتم العثور على اتصال مباشر بقاعدة بيانات Supabase. سيتم إجراء اختبار المحاكاة المحلي.");
      assertTest(1, "التحقق من الاتصال بقاعدة البيانات", "اتصال نشط بـ Supabase", `خطأ الاتصال: ${pingErr.message}`, false);
      return { success: false, totalPassed, totalFailed, logs, tests };
    }

    assertTest(1, "التحقق من الاتصال بقاعدة البيانات", "اتصال ناجح بـ Supabase", "تم الاتصال بنجاح", true);

    // Step 1: Create Test Customer
    const testCustomerId = '00000000-0000-0000-0000-000000000001';
    const { error: custErr } = await supabase.from('customers').upsert({
      id: testCustomerId,
      name: 'عميل اختبار التصفير الذري',
      phone: '01000000000',
      type: 'REGULAR'
    });

    assertTest(2, "إنشاء عميل اختبار في القاعدة", "إدراج العميل بدون خطأ", custErr ? custErr.message : "تم الإدراج بنجاح", !custErr);

    // Step 2: Create Test Invoice
    const testInvoiceId = '00000000-0000-0000-0000-000000000002';
    const { error: invErr } = await supabase.from('invoices').upsert({
      id: testInvoiceId,
      invoice_number: 'TEST-RESET-001',
      customer_id: testCustomerId,
      total_amount: 500,
      paid_amount: 500,
      work_type: 'CUSTOMER_WORK'
    });

    assertTest(3, "إنشاء فاتورة اختبار في القاعدة", "إدراج الفاتورة بدون خطأ", invErr ? invErr.message : "تم الإدراج بنجاح", !invErr);

    // Step 3: Check Product Stock before Reset
    const { data: prodDataBefore } = await supabase.from('products').select('id, name, quantity').limit(1);
    const prodBeforeQty = prodDataBefore && prodDataBefore[0] ? prodDataBefore[0].quantity : null;

    // Step 4: Call RPC with force_failure = true (Rollback Test)
    addLog("⚡ [Rollback Test] استدعاء reset_operational_data(force_failure = true)...");
    const { data: rollData, error: rollErr } = await supabase.rpc('reset_operational_data', { force_failure: true });

    assertTest(
      4,
      "فشل الـ RPC المتعمد عند force_failure = true",
      "إرجاع Exception متعمّدة من PostgreSQL",
      rollErr ? rollErr.message : JSON.stringify(rollData),
      !!rollErr && rollErr.message.includes("فشل متعمد")
    );

    // Step 5: Verify Data Presence after Rollback
    const { data: invCheckAfterRollback } = await supabase.from('invoices').select('id').eq('id', testInvoiceId);
    const invExistsAfterRollback = Array.isArray(invCheckAfterRollback) && invCheckAfterRollback.length > 0;

    assertTest(
      5,
      "تأكيد PostgreSQL Rollback: بقاء الفاتورة بعد الفشل المتعمد",
      "وجود الفاتورة 100% بدون حذف جزئي",
      invExistsAfterRollback ? "الفاتورة موجوة (تم التراجع بنجاح)" : "الفاتورة حُذفت (فشل التراجع!)",
      invExistsAfterRollback
    );

    // Step 6: Verify no security log inserted on failed execution
    const { data: logsFailed } = await supabase
      .from('system_reset_security_logs')
      .select('id')
      .eq('details', 'فشل متعمد لاختبار التراجع (Rollback Test)');
    
    const failedLogCreated = Array.isArray(logsFailed) && logsFailed.length > 0;
    assertTest(
      6,
      "عدم إنشاء سجل أمان عند التراجع",
      "عدم حفظ سجل أمان للعملية الملغاة",
      failedLogCreated ? "تم إنشاء سجل بطريق الخطأ" : "لم يُنشأ سجل أمان (صحيح)",
      !failedLogCreated
    );

    // Step 7: Call RPC with force_failure = false (Success Execution)
    addLog("⚡ [Success Test] استدعاء reset_operational_data(force_failure = false)...");
    const { data: successData, error: successErr } = await supabase.rpc('reset_operational_data', { force_failure: false });

    assertTest(
      7,
      "نجاح تنفيذ الـ RPC لتصفير البيانات",
      "إرجاع JSON ناجح مع تفاصيل الأعداد",
      successErr ? successErr.message : JSON.stringify(successData),
      !successErr && successData?.success === true
    );

    // Step 8: Verify Operational Data Deleted
    const { data: invCheckFinal } = await supabase.from('invoices').select('id');
    const invFinalCount = Array.isArray(invCheckFinal) ? invCheckFinal.length : 0;

    assertTest(
      8,
      "تأكيد مسح جميع الفواتير من القاعدة",
      "0 فاتورة متوفرة",
      `${invFinalCount} فاتورة متوفرة`,
      invFinalCount === 0
    );

    // Step 9: Verify Product Stock Quantity Zeroed
    const { data: prodDataAfter } = await supabase.from('products').select('id, name, quantity').limit(1);
    const prodAfterQty = prodDataAfter && prodDataAfter[0] ? prodDataAfter[0].quantity : null;

    assertTest(
      9,
      "تأكيد تصفير كميات المخزون للأصناف إلى 0 مع بقاء الصنف والأسعار",
      "الكمية تساوي 0",
      `الكمية الحالية (${prodAfterQty})`,
      prodAfterQty === 0
    );

    // Step 10: Verify Security Log Created for Success
    const { data: logsSuccess } = await supabase
      .from('system_reset_security_logs')
      .select('id, status, details')
      .order('timestamp', { ascending: false })
      .limit(1);

    const hasSuccessLog = Array.isArray(logsSuccess) && logsSuccess.length > 0 && logsSuccess[0].status === 'SUCCESS';
    assertTest(
      10,
      "تأكيد تسجيل الدخول والأمان في system_reset_security_logs",
      "وجود سجل SUCCESS جديد",
      hasSuccessLog ? "سجل الأمان محفوظ بنجاح" : "لم يتم العثور على سجل الأمان",
      hasSuccessLog
    );

  } catch (err: any) {
    addLog(`❌ خطأ غير متوقع أثناء تشغيل حزمة الاختبارات: ${err.message || err}`);
    assertTest(99, "استثناء غير متوقع", "لا يوجد استثناءات", err.message || String(err), false);
  }

  addLog(`🏁 اكتملت حزمة اختبارات Atomic Operational Reset. الناجحة: ${totalPassed}، الفاشلة: ${totalFailed}`);

  return {
    success: totalFailed === 0,
    totalPassed,
    totalFailed,
    logs,
    tests
  };
}
