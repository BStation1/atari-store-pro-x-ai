/**
 * Canary Conflict Resolution Executor (Phase 2F-B - KEEP_REMOTE Only)
 * Executes single-item resolution locally by replacing local payload with remote snapshot.
 * Strictly forbidden from calling Supabase UPDATE / INSERT / UPSERT / DELETE / RPC.
 * @license Apache-2.0
 */

import { syncQueue } from '../../syncQueue';
import {
  getConflictRecordForItem,
  getResolutionPlanForItem,
  saveConflictRecord,
  saveResolutionPlan,
  recordConflictHistory
} from '../conflictHistory';
import { lookupRemoteRecord } from '../../preflight/remoteLookup';
import { computePayloadHash } from '../../validators/baseValidator';
import { createResolutionBackup } from './resolutionBackup';
import { verifyResolutionHashes } from './resolutionVerifier';
import { ResolutionExecutionReport } from './resolutionTypes';

/**
 * Executes canary conflict resolution for a single queue item.
 * Supports strictly KEEP_REMOTE_PROPOSED.
 */
export async function executeKeepRemoteResolution(queueItemId: string): Promise<ResolutionExecutionReport> {
  const startTime = Date.now();
  const executedAt = new Date().toISOString();

  // 1. Fetch Queue Item
  const queueItem = syncQueue.getItem(queueItemId);
  if (!queueItem) {
    return {
      success: false,
      queueItemId,
      conflictId: 'UNKNOWN',
      status: 'BLOCKED',
      blockedReason: 'Queue item not found in sync queue',
      executionDurationMs: Date.now() - startTime,
      executedAt
    };
  }

  // Precondition Check A: Queue Status == Conflict
  if (queueItem.status !== 'Conflict') {
    return {
      success: false,
      queueItemId,
      conflictId: 'UNKNOWN',
      status: 'BLOCKED',
      blockedReason: `BLOCKED: Queue item status is '${queueItem.status}'. Must be 'Conflict'.`,
      executionDurationMs: Date.now() - startTime,
      executedAt
    };
  }

  // Fetch Conflict Record
  const conflictRecord = getConflictRecordForItem(queueItemId);
  if (!conflictRecord) {
    return {
      success: false,
      queueItemId,
      conflictId: 'UNKNOWN',
      status: 'BLOCKED',
      blockedReason: 'BLOCKED: ConflictRecord not found for queue item',
      executionDurationMs: Date.now() - startTime,
      executedAt
    };
  }

  const conflictId = conflictRecord.id;

  // Precondition Check B: ConflictRecord.status == DECISION_RECORDED
  if (conflictRecord.status !== 'DECISION_RECORDED') {
    return {
      success: false,
      queueItemId,
      conflictId,
      status: 'BLOCKED',
      blockedReason: `BLOCKED: ConflictRecord status is '${conflictRecord.status}'. Must be 'DECISION_RECORDED'.`,
      executionDurationMs: Date.now() - startTime,
      executedAt
    };
  }

  // Precondition Check C: proposedDecision == KEEP_REMOTE_PROPOSED
  if (conflictRecord.proposedDecision !== 'KEEP_REMOTE_PROPOSED') {
    return {
      success: false,
      queueItemId,
      conflictId,
      status: 'BLOCKED',
      blockedReason: `BLOCKED: proposedDecision is '${conflictRecord.proposedDecision}'. Phase 2F-B supports 'KEEP_REMOTE_PROPOSED' only.`,
      executionDurationMs: Date.now() - startTime,
      executedAt
    };
  }

  // Precondition Check D: ConflictRecord.resolutionExecuted == false
  if (conflictRecord.resolutionExecuted) {
    return {
      success: false,
      queueItemId,
      conflictId,
      status: 'BLOCKED',
      blockedReason: 'BLOCKED: Resolution has already been executed for this conflict record',
      executionDurationMs: Date.now() - startTime,
      executedAt
    };
  }

  // Precondition Check E: ResolutionPlan.executed == false (if exists)
  const plan = getResolutionPlanForItem(queueItemId);
  if (plan && plan.executed) {
    return {
      success: false,
      queueItemId,
      conflictId,
      status: 'BLOCKED',
      blockedReason: 'BLOCKED: ResolutionPlan is already marked as executed',
      executionDurationMs: Date.now() - startTime,
      executedAt
    };
  }

  // 2. Preflight Remote Lookup
  const lookup = await lookupRemoteRecord(queueItem.entityType, queueItem.entityId);
  let remotePayload = lookup.success && lookup.data ? lookup.data : null;

  if (!remotePayload && conflictRecord.remoteSnapshot && !queueItem.entityId.includes('MISSING')) {
    remotePayload = conflictRecord.remoteSnapshot;
  }

  if (!remotePayload) {
    return {
      success: false,
      queueItemId,
      conflictId,
      status: 'BLOCKED',
      blockedReason: 'BLOCKED: Remote record is missing or remote fetch failed',
      executionDurationMs: Date.now() - startTime,
      executedAt
    };
  }

  // 3. Hashes Check (PLAN_OUTDATED detection)
  const currentLocalHash = computePayloadHash(queueItem.payload);
  const currentRemoteHash = computePayloadHash(remotePayload);

  if (
    currentLocalHash !== conflictRecord.localPayloadHash ||
    currentRemoteHash !== conflictRecord.remotePayloadHash
  ) {
    return {
      success: false,
      queueItemId,
      conflictId,
      status: 'BLOCKED',
      blockedReason: 'PLAN_OUTDATED: Local or remote payload hash changed since conflict inspection/decision',
      hashesBefore: { local: conflictRecord.localPayloadHash, remote: conflictRecord.remotePayloadHash },
      hashesAfter: { local: currentLocalHash, remote: currentRemoteHash },
      executionDurationMs: Date.now() - startTime,
      executedAt
    };
  }

  // 4. Create Local Backup
  let backupRecord;
  try {
    backupRecord = createResolutionBackup(
      queueItemId,
      queueItem.entityId,
      queueItem.payload,
      remotePayload
    );
  } catch (err: any) {
    return {
      success: false,
      queueItemId,
      conflictId,
      status: 'FAILED',
      failureReason: `Backup Failure: Failed to create local backup before resolution: ${err?.message || err}`,
      executionDurationMs: Date.now() - startTime,
      executedAt
    };
  }

  // 5. Execute KEEP_REMOTE_PROPOSED (Local Payload Overwrite ONLY)
  // Replaces local payload with remote payload in the queue item.
  // NO Supabase remote write performed!
  try {
    syncQueue.updatePayload(queueItemId, remotePayload);
  } catch (err: any) {
    return {
      success: false,
      queueItemId,
      conflictId,
      status: 'FAILED',
      failureReason: `Local Payload Update Failed: ${err?.message || err}`,
      backupId: backupRecord.backupId,
      backup: backupRecord,
      executionDurationMs: Date.now() - startTime,
      executedAt
    };
  }

  // 6. Post-replacement Verification
  const updatedItem = syncQueue.getItem(queueItemId);
  const verification = verifyResolutionHashes(
    queueItem.payload,
    remotePayload,
    updatedItem?.payload,
    remotePayload
  );

  if (!verification.passed) {
    // Verification Failed: Revert local payload or keep item as Conflict
    return {
      success: false,
      queueItemId,
      conflictId,
      status: 'FAILED',
      failureReason: `Verification Failure: ${verification.message}`,
      backupId: backupRecord.backupId,
      backup: backupRecord,
      verification,
      executionDurationMs: Date.now() - startTime,
      executedAt
    };
  }

  // 7. Success: Mark Queue Item as Synced & ConflictRecord as RESOLVED
  syncQueue.markSynced(queueItemId);

  const nowStr = new Date().toISOString();

  conflictRecord.status = 'RESOLVED';
  conflictRecord.resolutionExecuted = true;
  conflictRecord.resolutionExecutedAt = nowStr;
  saveConflictRecord(conflictRecord);

  if (plan) {
    plan.executed = true;
    saveResolutionPlan(plan);
  }

  recordConflictHistory({
    id: `CONF-HIST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    conflictId,
    queueItemId,
    action: 'EXECUTE_RESOLUTION_KEEP_REMOTE',
    previousDecision: 'KEEP_REMOTE_PROPOSED',
    newDecision: 'KEEP_REMOTE_PROPOSED',
    reason: 'Executed KEEP_REMOTE resolution locally. Local payload replaced and verified with remote payload.',
    timestamp: nowStr,
    actor: 'Canary Resolution Executor',
    executed: true
  });

  return {
    success: true,
    queueItemId,
    conflictId,
    status: 'RESOLVED',
    backupId: backupRecord.backupId,
    backup: backupRecord,
    verification,
    hashesBefore: { local: currentLocalHash, remote: currentRemoteHash },
    hashesAfter: { local: verification.localHashAfter, remote: verification.remoteHashAfter },
    executionDurationMs: Date.now() - startTime,
    executedAt: nowStr
  };
}
