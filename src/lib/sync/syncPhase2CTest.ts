/**
 * Phase 2C Mandatory Sync Validation & Conflict Safety Test Suite
 * @license Apache-2.0
 */

import { SyncQueueItem } from './syncTypes';
import { validateQueueItem, simulateSync, SyncSimulationResult } from './validators/validatorFactory';
import { checkQueueIntegrity, QueueIntegrityReport } from './validators/queueIntegrity';
import { computePayloadHash } from './validators/baseValidator';
import { syncQueue } from './syncQueue';
import { loadQueueFromStorage } from './syncStorage';

export interface Phase2CTestResult {
  allPassed: boolean;
  testCaseResults: {
    testName: string;
    expectedStatus: string;
    actualStatus: string;
    passed: boolean;
    reasons: string[];
  }[];
  integrityReport: QueueIntegrityReport;
  persistenceTestPassed: boolean;
  persistenceLogs: string[];
}

export async function runPhase2CValidationTestSuite(): Promise<Phase2CTestResult> {
  const results: Phase2CTestResult['testCaseResults'] = [];
  const pLogs: string[] = [];

  const now = new Date().toISOString();
  const samplePayload = { id: 'TEST-1', name: 'عميل الفحص', phone: '01012345678' };
  const validHash = computePayloadHash(samplePayload);

  // 1. Test Case 1: Valid Item -> READY
  const itemValid: SyncQueueItem = {
    id: 'SYNC-C1',
    entityType: 'Customer',
    entityId: 'CUST-101',
    operation: 'CREATE',
    createdAt: now,
    updatedAt: now,
    retryCount: 0,
    status: 'Pending',
    payload: samplePayload,
    payloadHash: validHash,
    origin: 'Reception',
    version: 1,
    idempotencyKey: 'Customer:CUST-101:CREATE'
  };
  const sim1 = simulateSync(itemValid);
  results.push({
    testName: 'عنصر صحيح بالكامل (Valid Item)',
    expectedStatus: 'READY',
    actualStatus: sim1.status,
    passed: sim1.status === 'READY',
    reasons: sim1.reasons
  });

  // 2. Test Case 2: Item missing entityId -> INVALID
  const itemNoEntityId: SyncQueueItem = {
    ...itemValid,
    id: 'SYNC-C2',
    entityId: ''
  };
  const sim2 = simulateSync(itemNoEntityId);
  results.push({
    testName: 'عنصر بدون entityId (Missing entityId)',
    expectedStatus: 'INVALID',
    actualStatus: sim2.status,
    passed: sim2.status === 'INVALID',
    reasons: sim2.reasons
  });

  // 3. Test Case 3: Item missing payloadHash -> INVALID
  const itemNoHash: SyncQueueItem = {
    ...itemValid,
    id: 'SYNC-C3',
    payloadHash: ''
  };
  const sim3 = simulateSync(itemNoHash);
  results.push({
    testName: 'عنصر بدون payloadHash (Missing payloadHash)',
    expectedStatus: 'INVALID',
    actualStatus: sim3.status,
    passed: sim3.status === 'INVALID',
    reasons: sim3.reasons
  });

  // 4. Test Case 4: Item version = 999 -> INVALID
  const itemVer999: SyncQueueItem = {
    ...itemValid,
    id: 'SYNC-C4',
    version: 999
  };
  const sim4 = simulateSync(itemVer999);
  results.push({
    testName: 'عنصر بإصدار غير مدعوم version=999',
    expectedStatus: 'INVALID',
    actualStatus: sim4.status,
    passed: sim4.status === 'INVALID',
    reasons: sim4.reasons
  });

  // 5. Test Case 5 & 6: Queue Integrity - Duplicate idempotencyKey & Duplicate entityId
  const dupIdempotencyItem1: SyncQueueItem = { ...itemValid, id: 'SYNC-DUP-1' };
  const dupIdempotencyItem2: SyncQueueItem = { ...itemValid, id: 'SYNC-DUP-2' };
  const dupReport = checkQueueIntegrity([dupIdempotencyItem1, dupIdempotencyItem2]);

  results.push({
    testName: 'عنصر مكرر idempotencyKey',
    expectedStatus: 'INVALID',
    actualStatus: dupReport.duplicateIdempotencyKeys > 0 ? 'INVALID' : 'READY',
    passed: dupReport.duplicateIdempotencyKeys > 0,
    reasons: ['تم اكتشاف تكرار مفتاح Idempotency Key بنجاح']
  });

  results.push({
    testName: 'عنصر مكرر entityId',
    expectedStatus: 'INVALID',
    actualStatus: dupReport.duplicateEntityIds > 0 ? 'INVALID' : 'READY',
    passed: dupReport.duplicateEntityIds > 0,
    reasons: ['تم اكتشاف تكرار المعرف entityId بنجاح']
  });

  // 6. Test Case 7: Payload Hash Mismatch -> INVALID
  const itemHashMismatch: SyncQueueItem = {
    ...itemValid,
    id: 'SYNC-C7',
    payload: { ...samplePayload, name: 'اسم معدل بعد الهاش (Tampered)' }
  };
  const sim7 = simulateSync(itemHashMismatch);
  results.push({
    testName: 'اختلاف Hash Verification (Payload Tampered / Hash Mismatch)',
    expectedStatus: 'INVALID',
    actualStatus: sim7.status,
    passed: sim7.status === 'INVALID',
    reasons: sim7.reasons
  });

  // 7. Test Case 9: Persistence Test (5 Items)
  pLogs.push('=== اختبار ثبات وحفظ البيانات (Persistence & Order Test) ===');
  const timestampBefore = Date.now();
  
  // Enqueue 5 unique items
  const e1 = syncQueue.enqueue({
    entityType: 'Customer',
    entityId: `P-CUST-${timestampBefore}-1`,
    operation: 'CREATE',
    payload: { name: 'عميل ثبات 1' },
    origin: 'TestRunner',
    version: 1
  });
  const e2 = syncQueue.enqueue({
    entityType: 'RepairOrder',
    entityId: `P-REP-${timestampBefore}-2`,
    operation: 'CREATE',
    payload: { customerId: `P-CUST-${timestampBefore}-1` },
    origin: 'TestRunner',
    version: 1
  });
  const e3 = syncQueue.enqueue({
    entityType: 'Invoice',
    entityId: `P-INV-${timestampBefore}-3`,
    operation: 'CREATE',
    payload: { totalAmount: 1000 },
    origin: 'TestRunner',
    version: 1
  });
  const e4 = syncQueue.enqueue({
    entityType: 'Product',
    entityId: `P-PROD-${timestampBefore}-4`,
    operation: 'CREATE',
    payload: { name: 'منتج ثبات 4' },
    origin: 'TestRunner',
    version: 1
  });
  const e5 = syncQueue.enqueue({
    entityType: 'Expense',
    entityId: `P-EXP-${timestampBefore}-5`,
    operation: 'CREATE',
    payload: { amount: 50 },
    origin: 'TestRunner',
    version: 1
  });

  pLogs.push(`تمت إضافة 5 عناصر إلى الطابور بالمعرفات: ${e1.id}, ${e2.id}, ${e3.id}, ${e4.id}, ${e5.id}`);

  // Re-read directly from storage (simulating app restart)
  const storedItems = loadQueueFromStorage();
  pLogs.push(`تمت محاكاة إعادة فتح التطبيق. عدد العناصر في التخزين: ${storedItems.length}`);

  // Find the 5 items in storedItems and check properties
  const found1 = storedItems.find(i => i.id === e1.id);
  const found2 = storedItems.find(i => i.id === e2.id);
  const found3 = storedItems.find(i => i.id === e3.id);
  const found4 = storedItems.find(i => i.id === e4.id);
  const found5 = storedItems.find(i => i.id === e5.id);

  let pPassed = true;
  if (!found1 || !found2 || !found3 || !found4 || !found5) {
    pPassed = false;
    pLogs.push('❌ فشل: لم يتم العثور على كافة العناصر الـ 5 المخزنة.');
  } else {
    // Check property immutability
    const isStable1 = found1.createdAt === e1.createdAt && found1.idempotencyKey === e1.idempotencyKey && found1.origin === e1.origin && found1.version === e1.version;
    const isStable5 = found5.createdAt === e5.createdAt && found5.idempotencyKey === e5.idempotencyKey && found5.origin === e5.origin && found5.version === e5.version;
    
    // Check relative order in queue
    const idx1 = storedItems.findIndex(i => i.id === e1.id);
    const idx2 = storedItems.findIndex(i => i.id === e2.id);
    const idx3 = storedItems.findIndex(i => i.id === e3.id);
    const idx4 = storedItems.findIndex(i => i.id === e4.id);
    const idx5 = storedItems.findIndex(i => i.id === e5.id);

    const orderPreserved = (idx1 < idx2 && idx2 < idx3 && idx3 < idx4 && idx4 < idx5);

    if (isStable1 && isStable5 && orderPreserved) {
      pLogs.push('✅ نجاح: القيم ثابتة تماماً (createdAt, idempotencyKey, origin, version) وترتيب العناصر ثابت بحسب التسلسل.');
    } else {
      pPassed = false;
      pLogs.push('❌ فشل: تغيرت قيم الخصائص أو ترتيب العناصر في التخزين.');
    }
  }

  // Calculate overall integrity report on current live queue
  const currentQueue = syncQueue.list();
  const integrityReport = checkQueueIntegrity(currentQueue);

  const allPassed = results.every(r => r.passed) && pPassed;

  return {
    allPassed,
    testCaseResults: results,
    integrityReport,
    persistenceTestPassed: pPassed,
    persistenceLogs: pLogs
  };
}
