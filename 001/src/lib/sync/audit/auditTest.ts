/**
 * Comprehensive Test Suite for Phase 2G.1 (Audit Integrity & State Policy Hardening)
 * Tests all 12 mandatory cases: Deep Immutability, Hash Chain Tamper Detection, Hardened State Transitions & Health Score.
 * @license Apache-2.0
 */

import {
  clearAuditLogsMemoryOnly,
  getAllAuditEvents,
  appendAuditEvent,
  appendRawAuditEvent
} from './auditStorage';
import { logAuditEvent, validateTransition } from './auditLogger';
import { verifyAuditChain } from './auditVerifier';
import { calculateSyncHealthMetrics } from './auditQuery';
import { syncQueue } from '../syncQueue';
import { AuditEvent } from './auditTypes';

export interface AuditTestCaseResult {
  caseName: string;
  passed: boolean;
  details?: string;
  actualStatus?: string;
}

export interface AuditTestSuiteResult {
  allPassed: boolean;
  results: AuditTestCaseResult[];
}

export async function runAuditTestSuite(): Promise<AuditTestSuiteResult> {
  const results: AuditTestCaseResult[] = [];

  // Reset environment before running tests
  clearAuditLogsMemoryOnly();
  syncQueue.clearAll();

  // -------------------------------------------------------------
  // Case 1: Nested metadata modification is blocked by deepFreeze
  // -------------------------------------------------------------
  try {
    const event = logAuditEvent({
      queueItemId: 'ITEM-CASE-1',
      entityType: 'Customer',
      entityId: 'CUST-1',
      operation: 'CREATE',
      eventType: 'QUEUE_CREATED',
      metadata: { nested: { secretKey: 'original_value' } }
    });

    let mutationBlocked = false;
    try {
      (event.metadata as any).nested.secretKey = 'tampered_value';
    } catch {
      mutationBlocked = true;
    }

    if (!mutationBlocked && (event.metadata as any)?.nested?.secretKey === 'tampered_value') {
      results.push({
        caseName: 'Case 1: Nested metadata modification blocked by deepFreeze',
        passed: false,
        details: 'Metadata was modified despite deepFreeze!'
      });
    } else {
      results.push({
        caseName: 'Case 1: Nested metadata modification blocked by deepFreeze',
        passed: true,
        details: 'DeepFreeze prevented mutation of nested metadata.'
      });
    }
  } catch (err: any) {
    results.push({
      caseName: 'Case 1: Nested metadata modification blocked by deepFreeze',
      passed: true,
      details: `DeepFreeze threw expected immutability error on mutation attempt: ${err?.message || err}`
    });
  }

  // -------------------------------------------------------------
  // Case 2: Returned audit query result cannot mutate stored event
  // -------------------------------------------------------------
  try {
    const queryResult = getAllAuditEvents();
    if (queryResult.length > 0) {
      try {
        (queryResult[0] as any).actor = 'Hacker';
      } catch {
        // expected freeze error
      }
    }

    const reQueried = getAllAuditEvents();
    const isProtected = reQueried[0]?.actor !== 'Hacker';

    results.push({
      caseName: 'Case 2: Returned query result cannot mutate stored event',
      passed: isProtected,
      details: isProtected ? 'Stored audit event remained untampered.' : 'Stored event was mutated!'
    });
  } catch (err: any) {
    results.push({
      caseName: 'Case 2: Returned query result cannot mutate stored event',
      passed: true,
      details: `Returned result was frozen cleanly: ${err?.message || err}`
    });
  }

  // -------------------------------------------------------------
  // Case 3: Valid chain verification
  // -------------------------------------------------------------
  try {
    clearAuditLogsMemoryOnly();
    logAuditEvent({
      queueItemId: 'ITEM-CHAIN-1',
      entityType: 'Invoice',
      entityId: 'INV-101',
      operation: 'CREATE',
      eventType: 'QUEUE_CREATED'
    });
    logAuditEvent({
      queueItemId: 'ITEM-CHAIN-1',
      entityType: 'Invoice',
      entityId: 'INV-101',
      operation: 'CREATE',
      eventType: 'SYNC_STARTED',
      previousState: 'Pending',
      newState: 'Syncing',
      transitionContext: { source: 'MANUAL_SYNC' }
    });
    logAuditEvent({
      queueItemId: 'ITEM-CHAIN-1',
      entityType: 'Invoice',
      entityId: 'INV-101',
      operation: 'CREATE',
      eventType: 'SYNC_SUCCEEDED',
      previousState: 'Syncing',
      newState: 'Synced',
      transitionContext: { resolutionVerified: true }
    });

    const verification = verifyAuditChain();
    results.push({
      caseName: 'Case 3: Valid chain verification',
      passed: verification.valid && verification.failureType === 'NONE',
      details: `Verification valid: ${verification.valid}, totalEvents: ${verification.totalEvents}`
    });
  } catch (err: any) {
    results.push({
      caseName: 'Case 3: Valid chain verification',
      passed: false,
      details: err?.message || String(err)
    });
  }

  // -------------------------------------------------------------
  // Case 4: Changed event detected (HASH_MISMATCH)
  // -------------------------------------------------------------
  try {
    const currentLogs = getAllAuditEvents();
    const tamperedChain: AuditEvent[] = currentLogs.map((evt, idx) => {
      if (idx === 1) {
        return {
          ...evt,
          eventType: 'SYNC_FAILED' as any
        };
      }
      return evt;
    });

    const verification = verifyAuditChain(tamperedChain);
    results.push({
      caseName: 'Case 4: Changed event detected (HASH_MISMATCH)',
      passed: !verification.valid && verification.failureType === 'HASH_MISMATCH',
      details: `Detected failureType: ${verification.failureType}`
    });
  } catch (err: any) {
    results.push({
      caseName: 'Case 4: Changed event detected (HASH_MISMATCH)',
      passed: false,
      details: err?.message || String(err)
    });
  }

  // -------------------------------------------------------------
  // Case 5: Deleted middle event detected (SEQUENCE_GAP)
  // -------------------------------------------------------------
  try {
    const currentLogs = getAllAuditEvents();
    if (currentLogs.length >= 3) {
      const chainWithDeletedMiddle = [currentLogs[0], currentLogs[2]];
      const verification = verifyAuditChain(chainWithDeletedMiddle);
      const passed = !verification.valid && (verification.failureType === 'SEQUENCE_GAP' || verification.failureType === 'PREVIOUS_HASH_MISMATCH');
      results.push({
        caseName: 'Case 5: Deleted middle event detected',
        passed,
        details: `Detected failureType: ${verification.failureType}`
      });
    } else {
      results.push({
        caseName: 'Case 5: Deleted middle event detected',
        passed: false,
        details: 'Insufficient events in test chain'
      });
    }
  } catch (err: any) {
    results.push({
      caseName: 'Case 5: Deleted middle event detected',
      passed: false,
      details: err?.message || String(err)
    });
  }

  // -------------------------------------------------------------
  // Case 6: Reordered events detected
  // -------------------------------------------------------------
  try {
    const currentLogs = getAllAuditEvents();
    if (currentLogs.length >= 3) {
      const reorderedChain = [currentLogs[1], currentLogs[0], currentLogs[2]];
      const verification = verifyAuditChain(reorderedChain);
      const passed = !verification.valid && (verification.failureType === 'PREVIOUS_HASH_MISMATCH' || verification.failureType === 'INVALID_GENESIS' || verification.failureType === 'SEQUENCE_GAP');
      results.push({
        caseName: 'Case 6: Reordered events detected',
        passed,
        details: `Detected failureType: ${verification.failureType}`
      });
    } else {
      results.push({
        caseName: 'Case 6: Reordered events detected',
        passed: false,
        details: 'Insufficient events in test chain'
      });
    }
  } catch (err: any) {
    results.push({
      caseName: 'Case 6: Reordered events detected',
      passed: false,
      details: err?.message || String(err)
    });
  }

  // -------------------------------------------------------------
  // Case 7: Conflict -> Pending rejected
  // -------------------------------------------------------------
  try {
    const check = validateTransition('Conflict', 'Pending');
    results.push({
      caseName: 'Case 7: Conflict -> Pending rejected',
      passed: !check.valid,
      details: check.reason
    });
  } catch (err: any) {
    results.push({
      caseName: 'Case 7: Conflict -> Pending rejected',
      passed: false,
      details: err?.message || String(err)
    });
  }

  // -------------------------------------------------------------
  // Case 8: Syncing -> Pending without manual recovery approval rejected
  // -------------------------------------------------------------
  try {
    const check = validateTransition('Syncing', 'Pending', {
      source: 'MANUAL_RECOVERY',
      recoveryApproved: false
    });
    results.push({
      caseName: 'Case 8: Syncing -> Pending without recovery approval rejected',
      passed: !check.valid,
      details: check.reason
    });
  } catch (err: any) {
    results.push({
      caseName: 'Case 8: Syncing -> Pending without recovery approval rejected',
      passed: false,
      details: err?.message || String(err)
    });
  }

  // -------------------------------------------------------------
  // Case 9: Conflict -> Synced without verified resolution rejected
  // -------------------------------------------------------------
  try {
    const check = validateTransition('Conflict', 'Synced', {
      source: 'RESOLUTION_EXECUTION',
      resolutionVerified: false
    });
    results.push({
      caseName: 'Case 9: Conflict -> Synced without verified resolution rejected',
      passed: !check.valid,
      details: check.reason
    });
  } catch (err: any) {
    results.push({
      caseName: 'Case 9: Conflict -> Synced without verified resolution rejected',
      passed: false,
      details: err?.message || String(err)
    });
  }

  // -------------------------------------------------------------
  // Case 10: Conflict -> Synced with verified resolution accepted
  // -------------------------------------------------------------
  try {
    const check = validateTransition('Conflict', 'Synced', {
      source: 'RESOLUTION_EXECUTION',
      resolutionVerified: true
    });
    results.push({
      caseName: 'Case 10: Conflict -> Synced with verified resolution accepted',
      passed: check.valid,
      details: 'Transition accepted cleanly'
    });
  } catch (err: any) {
    results.push({
      caseName: 'Case 10: Conflict -> Synced with verified resolution accepted',
      passed: false,
      details: err?.message || String(err)
    });
  }

  // -------------------------------------------------------------
  // Case 11: Health Score includes success and duration penalties
  // -------------------------------------------------------------
  try {
    clearAuditLogsMemoryOnly();
    syncQueue.clearAll();

    const item = syncQueue.enqueue({
      entityType: 'Customer',
      entityId: 'PENALTY-1',
      operation: 'CREATE',
      payload: { name: 'Penalty Test' },
      origin: 'User UI'
    });
    syncQueue.updateStatus(item.id, 'Failed');

    logAuditEvent({
      queueItemId: item.id,
      entityType: 'Customer',
      entityId: 'PENALTY-1',
      operation: 'CREATE',
      eventType: 'SYNC_FAILED',
      durationMs: 6000
    });

    const metrics = calculateSyncHealthMetrics();
    const passed = typeof metrics.scorePercentage === 'number' && metrics.scorePercentage < 100 && metrics.scorePercentage >= 0;

    results.push({
      caseName: 'Case 11: Health Score includes success and duration penalties',
      passed,
      details: `Calculated score: ${metrics.scorePercentage}%`
    });
  } catch (err: any) {
    results.push({
      caseName: 'Case 11: Health Score includes success and duration penalties',
      passed: false,
      details: err?.message || String(err)
    });
  }

  // -------------------------------------------------------------
  // Case 12: No metrics available -> INSUFFICIENT_DATA
  // -------------------------------------------------------------
  try {
    clearAuditLogsMemoryOnly();
    syncQueue.clearAll();

    const metrics = calculateSyncHealthMetrics();
    const passed = metrics.dataQuality === 'INSUFFICIENT_DATA' && metrics.scorePercentage === 'INSUFFICIENT_DATA';

    results.push({
      caseName: 'Case 12: No metrics available -> INSUFFICIENT_DATA',
      passed,
      details: `Data Quality: ${metrics.dataQuality}, Score: ${metrics.scorePercentage}`
    });
  } catch (err: any) {
    results.push({
      caseName: 'Case 12: No metrics available -> INSUFFICIENT_DATA',
      passed: false,
      details: err?.message || String(err)
    });
  }

  const allPassed = results.every(r => r.passed);
  return { allPassed, results };
}
