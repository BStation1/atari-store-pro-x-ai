import { db } from './data';
import { User } from '../types';

export interface RestoreTestDetail {
  id: number;
  title: string;
  expected: string;
  actual: string;
  passed: boolean;
  diffDetails?: string;
}

export interface RestoreTestSuiteResult {
  success: boolean;
  totalPassed: number;
  totalFailed: number;
  logs: string[];
  tests: RestoreTestDetail[];
}

export function validateBackupFileStructure(jsonString: string): {
  valid: boolean;
  error?: string;
  backupData?: any;
  versionWarning?: string;
  summary?: {
    productsCount: number;
    categoriesCount: number;
    customersCount: number;
    suppliersCount: number;
    invoicesCount: number;
    repairOrdersCount: number;
    expensesCount: number;
    usersCount: number;
    exportDate: string;
    version: string;
  };
} {
  try {
    const data = JSON.parse(jsonString);
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'محتوى الملف ليس كائناً تنظيماً (JSON Object) صالحاً.' };
    }

    const appName = data.metadata?.app || '';
    const hasCoreArrays = Array.isArray(data.invoices) || Array.isArray(data.customers) || Array.isArray(data.products) || Array.isArray(data.repairOrders);

    if (!appName.toLowerCase().includes('atari') && !hasCoreArrays) {
      return { valid: false, error: 'الملف المحدد ليس نسخة احتياطية صادرة من نظام Atari Store Pro X.' };
    }

    const version = data.metadata?.version || data.version || '1.0.0';
    let versionWarning: string | undefined;
    if (version !== '2.0.0') {
      versionWarning = `إصدار النسخة الاحتياطية (${version}) يختلف عن إصدار النظام الحالي (2.0.0). سيتم استعادة البيانات مع مواءمة الحقول التلقائية.`;
    }

    const productsCount = Array.isArray(data.products) ? data.products.length : 0;
    const categoriesCount = Array.isArray(data.categories) ? data.categories.length : 0;
    const customersCount = Array.isArray(data.customers) ? data.customers.length : 0;
    const suppliersCount = Array.isArray(data.suppliers) ? data.suppliers.length : 0;
    const invoicesCount = Array.isArray(data.invoices) ? data.invoices.length : 0;
    const repairOrdersCount = Array.isArray(data.repairOrders) ? data.repairOrders.length : 0;
    const expensesCount = Array.isArray(data.expenses) ? data.expenses.length : 0;
    const usersCount = Array.isArray(data.users) ? data.users.length : 0;

    const exportDate = data.metadata?.exportedAtFormatted || data.metadata?.exportedAt || data.exportedAt || new Date().toLocaleString('ar-EG');

    return {
      valid: true,
      backupData: data,
      versionWarning,
      summary: {
        productsCount,
        categoriesCount,
        customersCount,
        suppliersCount,
        invoicesCount,
        repairOrdersCount,
        expensesCount,
        usersCount,
        exportDate,
        version
      }
    };
  } catch (e: any) {
    return { valid: false, error: 'فشل تحليل ملف JSON: الملف تالف أو يحتوي على أخطاء صياغة.' };
  }
}

export async function runBackupRestoreTestSuite(): Promise<RestoreTestSuiteResult> {
  const logs: string[] = [];
  const tests: RestoreTestDetail[] = [];
  let totalPassed = 0;
  let totalFailed = 0;

  const addLog = (msg: string) => {
    console.log(msg);
    logs.push(`[${new Date().toLocaleTimeString('ar-EG')}] ${msg}`);
  };

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

  addLog('🚀 بدء تشغيل مجموعة اختبارات Backup & Restore...');

  const mockOwner: User = {
    id: 'U-OWNER-001',
    username: 'owner',
    name: 'أحمد البنا',
    fullName: 'أحمد البنا',
    email: 'elbannafc@gmail.com',
    roleId: 'OWNER',
    role: 'OWNER',
    permissions: [],
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Test 1: Reject corrupt JSON file
  const corruptJson = '{ "metadata": { "app": "Atari" }, bad_json }';
  const checkCorrupt = validateBackupFileStructure(corruptJson);
  assertTest(
    1,
    'ارفض ملف JSON التالف',
    'valid: false مع رسالة خطأ صياغة',
    `valid: ${checkCorrupt.valid}, error: ${checkCorrupt.error}`,
    !checkCorrupt.valid && (checkCorrupt.error?.includes('فشل تحليل') || false)
  );

  // Test 2: Reject non-Atari JSON backup
  const nonAtariJson = JSON.stringify({ someKey: 'hello', numbers: [1, 2, 3] });
  const checkNonAtari = validateBackupFileStructure(nonAtariJson);
  assertTest(
    2,
    'ارفض ملف JSON غير تابع لـ Atari',
    'valid: false مع رسالة عدم انتمائه لنظام Atari',
    `valid: ${checkNonAtari.valid}, error: ${checkNonAtari.error}`,
    !checkNonAtari.valid && (checkNonAtari.error?.includes('ليس نسخة احتياطية') || false)
  );

  // Test 3: Validate valid Atari backup JSON & detect version warning
  const validOldBackup = JSON.stringify({
    metadata: {
      app: 'Atari Store Pro X',
      version: '1.5.0',
      exportedAt: '2026-05-01T10:00:00Z',
      exportedAtFormatted: '01/05/2026 10:00 AM'
    },
    products: [{ id: 'P-TEST-1', name: 'ذراع PS5', sellingPrice: 3500 }],
    categories: [{ id: 'CAT-1', name: 'أجهزة' }],
    customers: [{ id: 'C-TEST-1', name: 'عميل اختبار', phone: '01000000000' }],
    invoices: [{ id: 'INV-TEST-1', totalAmount: 3500, paidAmount: 3500 }],
    repairOrders: [{ id: 'RO-TEST-1', orderNumber: 'R-100', cost: 500 }],
    expenses: [{ id: 'EXP-1', amount: 200 }]
  });

  const checkOldBackup = validateBackupFileStructure(validOldBackup);
  assertTest(
    3,
    'قراءة وتدقيق ملف نسسخة احتياطية صحيح مع كشف اختلاف الإصدار',
    'valid: true, summary مستخرج بنجاح وتحذير اختلاف الإصدار موجود',
    `valid: ${checkOldBackup.valid}, versionWarning: ${checkOldBackup.versionWarning}, productsCount: ${checkOldBackup.summary?.productsCount}`,
    checkOldBackup.valid === true &&
    Boolean(checkOldBackup.versionWarning) &&
    checkOldBackup.summary?.customersCount === 1 &&
    checkOldBackup.summary?.invoicesCount === 1
  );

  // Test 4: Restore Operational Data Async
  addLog('تنفيذ عملية استعادة بيانات التشغيل (OPERATIONAL Restore)...');
  const opRestoreRes = await db.executeBackupRestoreAsync(
    checkOldBackup.backupData,
    'OPERATIONAL',
    'test_backup.json',
    mockOwner
  );

  assertTest(
    4,
    'تنفيذ استعادة بيانات التشغيل فقط',
    'success: true مع تسجيل استعادة العملاء والفواتير وأوامر الصيانة',
    `success: ${opRestoreRes.success}, error: ${opRestoreRes.error || 'none'}, restoredCounts: ${JSON.stringify(opRestoreRes.restoredCounts)}`,
    opRestoreRes.success === true &&
    opRestoreRes.restoredCounts?.customers === 1 &&
    opRestoreRes.restoredCounts?.invoices === 1
  );

  // Test 5: Verify system restore logs
  const restoreLogs = db.getSystemRestoreLogs ? db.getSystemRestoreLogs() : [];
  const latestLog = restoreLogs[0];
  assertTest(
    5,
    'تسجيل عملية الاستعادة في سجلات الأمان (system_restore_logs)',
    'وجود سجل يحتوي على اسم الملف test_backup.json والحالة SUCCESS',
    `latestLog: ${JSON.stringify(latestLog)}`,
    Boolean(latestLog) && latestLog.fileName === 'test_backup.json' && latestLog.status === 'SUCCESS'
  );

  // Test 6: Reject oversized backup file (> 15 MB)
  addLog('اختبار رفض الملفات الضخمة التي تتجاوز 15 ميجابايت...');
  const hugePayload = {
    metadata: { app: 'Atari Store Pro X', version: '2.0.0' },
    dummyBuffer: 'X'.repeat(16 * 1024 * 1024) // 16 MB dummy payload
  };
  const oversizedRes = await db.executeBackupRestoreAsync(
    hugePayload,
    'OPERATIONAL',
    'huge_backup.json',
    mockOwner
  );
  assertTest(
    6,
    'رفض الملفات الضخمة التي تتجاوز 15 ميجابايت',
    'success: false مع رسالة تجاوز الحد الأقصى 15 ميجابايت',
    `success: ${oversizedRes.success}, error: ${oversizedRes.error}`,
    oversizedRes.success === false && (oversizedRes.error?.includes('15 ميجابايت') || false)
  );

  // Test 7: FULL Restore Mode
  addLog('تنفيذ عملية استعادة كاملة (FULL Restore Mode)...');
  const fullRestoreRes = await db.executeBackupRestoreAsync(
    checkOldBackup.backupData,
    'FULL',
    'full_backup.json',
    mockOwner
  );
  assertTest(
    7,
    'تنفيذ استعادة البيانات الشاملة (FULL Restore)',
    'success: true مع استعادة المنتجات والأقسام أيضاً',
    `success: ${fullRestoreRes.success}, restoredCounts: ${JSON.stringify(fullRestoreRes.restoredCounts)}`,
    fullRestoreRes.success === true &&
    fullRestoreRes.restoredCounts?.products === 1 &&
    fullRestoreRes.restoredCounts?.categories === 1
  );

  // Test 8: Reject Invalid Restore Mode
  addLog('اختبار رفض وضع الاستعادة غير الصالح (Invalid Restore Mode)...');
  const invalidModeRes = await db.executeBackupRestoreAsync(
    checkOldBackup.backupData,
    'INVALID_MODE' as any,
    'invalid_mode_backup.json',
    mockOwner
  );
  assertTest(
    8,
    'رفض وضع الاستعادة غير الصالح (Invalid Mode)',
    'success: false مع رسالة نمط استعادة غير صالح',
    `success: ${invalidModeRes.success}, error: ${invalidModeRes.error}`,
    invalidModeRes.success === false
  );

  // Test 9: Intentional Rollback Test for non-OWNER
  addLog('اختبار التراجع الذري للسياسة عند حدوث خطأ (Rollback Simulation)...');
  const invalidUser: any = { id: 'U-STAFF-999', roleId: 'CASHIER', role: 'CASHIER' }; // Non-owner user
  const rollbackRes = await db.executeBackupRestoreAsync(
    checkOldBackup.backupData,
    'OPERATIONAL',
    'unauthorized_backup.json',
    invalidUser
  );
  assertTest(
    9,
    'اختبار Rollback وإلغاء المعاملة بسلامة في حالة عدم الصلاحية',
    'success: false ورفض استعادة البيانات مع حماية الجداول',
    `success: ${rollbackRes.success}, error: ${rollbackRes.error}`,
    rollbackRes.success === false && (rollbackRes.error?.includes('صاحب النظام') || false)
  );

  return {
    success: totalFailed === 0,
    totalPassed,
    totalFailed,
    logs,
    tests
  };
}
