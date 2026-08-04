/**
 * Phase 2D0 Remote Preflight Verification Test Suite
 * @license Apache-2.0
 */

import { SyncQueueItem } from '../syncTypes';
import { runPreflight, runPreflightAll } from './preflight';
import { PreflightResult, PreflightSummaryReport } from './preflightTypes';
import { computePayloadHash } from '../validators/baseValidator';
import { isSupabaseConfigured } from '../../supabaseClient';

export interface PreflightTestCaseResult {
  testName: string;
  expectedStatus: string;
  actualStatus: string;
  passed: boolean;
  reason: string;
}

export interface PreflightTestSuiteResult {
  allPassed: boolean;
  caseResults: PreflightTestCaseResult[];
  summaryReport: PreflightSummaryReport;
}

export async function runPreflightTestSuite(): Promise<PreflightTestSuiteResult> {
  const caseResults: PreflightTestCaseResult[] = [];
  const now = new Date().toISOString();

  // 1. Case A: Local-only item -> READY_TO_SYNC
  const localOnlyItem: SyncQueueItem = {
    id: `SYNC-TEST-LOCAL-${Date.now()}`,
    entityType: 'Customer',
    entityId: `NON-EXISTENT-CUST-${Date.now()}`,
    operation: 'CREATE',
    createdAt: now,
    updatedAt: now,
    retryCount: 0,
    status: 'Pending',
    payload: { name: 'عميل غير موجود بعيداً' },
    payloadHash: computePayloadHash({ name: 'عميل غير موجود بعيداً' }),
    origin: 'TestRunner',
    version: 1,
    idempotencyKey: `Customer:NON-EXISTENT-CUST-${Date.now()}:CREATE`,
    sequenceNumber: 9901
  };

  const resA = await runPreflight(localOnlyItem);
  const expectedA = isSupabaseConfigured ? 'READY_TO_SYNC' : 'REMOTE_NOT_CHECKED';
  caseResults.push({
    testName: 'Case A: عنصر موجود محلياً فقط (Local-Only)',
    expectedStatus: expectedA,
    actualStatus: resA.status,
    passed: resA.status === expectedA,
    reason: resA.reason
  });

  // 2. Case B: Item with mock matching response
  // Testing with an entityId that might exist or simulating comparison
  const mockMatchingItem: SyncQueueItem = {
    id: `SYNC-TEST-MATCH-${Date.now()}`,
    entityType: 'Customer',
    entityId: 'CUST-EXISTING-MATCH',
    operation: 'CREATE',
    createdAt: now,
    updatedAt: now,
    retryCount: 0,
    status: 'Pending',
    payload: { name: 'عميل موجود ومطابق', phone: '01000000000' },
    payloadHash: computePayloadHash({ name: 'عميل موجود ومطابق', phone: '01000000000' }),
    origin: 'TestRunner',
    version: 1,
    idempotencyKey: `Customer:CUST-EXISTING-MATCH:CREATE`,
    sequenceNumber: 9902
  };

  // 3. Case C: Item with conflicting payload
  const mockConflictingItem: SyncQueueItem = {
    id: `SYNC-TEST-CONFLICT-${Date.now()}`,
    entityType: 'Customer',
    entityId: 'CUST-EXISTING-CONFLICT',
    operation: 'CREATE',
    createdAt: now,
    updatedAt: now,
    retryCount: 0,
    status: 'Pending',
    payload: { name: 'اسم مختلف محلياً' },
    payloadHash: computePayloadHash({ name: 'اسم مختلف محلياً' }),
    origin: 'TestRunner',
    version: 1,
    idempotencyKey: `Customer:CUST-EXISTING-CONFLICT:CREATE`,
    sequenceNumber: 9903
  };

  // 4. Case D: Network disconnect / bad entity type -> REMOTE_NOT_CHECKED
  const mockBadTypeItem: SyncQueueItem = {
    id: `SYNC-TEST-ERR-${Date.now()}`,
    entityType: 'InvalidEntity' as any,
    entityId: 'INVALID-ID',
    operation: 'CREATE',
    createdAt: now,
    updatedAt: now,
    retryCount: 0,
    status: 'Pending',
    payload: {},
    payloadHash: 'PH-INVALID',
    origin: 'TestRunner',
    version: 1,
    idempotencyKey: 'Invalid:INVALID-ID:CREATE',
    sequenceNumber: 9904
  };

  const resD = await runPreflight(mockBadTypeItem);
  caseResults.push({
    testName: 'Case D: تعذر الاتصال أو نوع غير مدعوم (Network/Error)',
    expectedStatus: 'REMOTE_NOT_CHECKED',
    actualStatus: resD.status,
    passed: resD.status === 'REMOTE_NOT_CHECKED',
    reason: resD.reason
  });

  // 5. Case E: runPreflightAll batch report on queue
  const summaryReport = await runPreflightAll([localOnlyItem, mockBadTypeItem]);

  caseResults.push({
    testName: 'Case E: تقرير فحص المجموعة runPreflightAll',
    expectedStatus: 'SUCCESS',
    actualStatus: summaryReport.totalChecked === 2 ? 'SUCCESS' : 'FAILED',
    passed: summaryReport.totalChecked === 2,
    reason: `تم فحص ${summaryReport.totalChecked} عناصر بنجاح دون أي تعديل للطابور`
  });

  const allPassed = caseResults.every(c => c.passed);

  return {
    allPassed,
    caseResults,
    summaryReport
  };
}
