/**
 * Conflict Inspection Detector (Phase 2F-A)
 * Performs read-only SELECT query and deep diffing for queue items in 'Conflict' status.
 * Strictly forbidden from performing remote writes or queue mutations.
 * @license Apache-2.0
 */

import { SyncQueueItem } from '../syncTypes';
import {
  ConflictRecord,
  ConflictInspectionResult,
  ConflictHistoryEntry
} from './conflictTypes';
import { lookupRemoteRecord } from '../preflight/remoteLookup';
import { computeDeepDiff } from './conflictDiff';
import { createLocalSnapshot, createRemoteSnapshot } from './conflictSnapshot';
import { computePayloadHash } from '../validators/baseValidator';
import {
  saveConflictRecord,
  getConflictRecordForItem,
  recordConflictHistory
} from './conflictHistory';

/**
 * Inspects a queue item for conflicts against the remote database.
 * Requirement 3:
 * - Allowed ONLY if queueItem.status === 'Conflict'.
 * - Executes SELECT only to fetch remote record.
 * - Reads local payload from queueItem.
 * - Does NOT change queueItem or queue status.
 * - Does NOT write to Supabase.
 * - Generates conflict inspection report locally only.
 */
export async function inspectConflict(queueItem: SyncQueueItem): Promise<ConflictInspectionResult> {
  const inspectedAt = new Date().toISOString();

  // Rule 1: Allowed ONLY if queueItem is in Conflict status
  if (!queueItem || queueItem.status !== 'Conflict') {
    return {
      success: false,
      queueItemId: queueItem?.id || 'UNKNOWN',
      entityType: queueItem?.entityType || 'UNKNOWN',
      entityId: queueItem?.entityId || 'UNKNOWN',
      error: `BLOCKED: inspectConflict is only allowed for items in 'Conflict' status. Current status: '${queueItem?.status}'`,
      inspectedAt
    };
  }

  // Rule 2: Execute SELECT query ONLY
  const lookup = await lookupRemoteRecord(queueItem.entityType, queueItem.entityId);

  if (!lookup.success) {
    return {
      success: false,
      queueItemId: queueItem.id,
      entityType: queueItem.entityType,
      entityId: queueItem.entityId,
      error: `REMOTE_LOOKUP_FAILED: Unable to fetch remote record. ${lookup.error || ''}`,
      inspectedAt
    };
  }

  const remoteData = lookup.data || null;
  const localSnapshot = createLocalSnapshot(queueItem);
  const remoteSnapshot = createRemoteSnapshot(remoteData);

  const localPayloadHash = queueItem.payloadHash || computePayloadHash(queueItem.payload);
  const remotePayloadHash = remoteData ? computePayloadHash(remoteData) : 'NO_REMOTE_DATA';

  // Compute deep recursive diffs (excluding metadata)
  const differences = computeDeepDiff(queueItem.payload, remoteData);

  const existingRecord = getConflictRecordForItem(queueItem.id);

  const conflictRecord: ConflictRecord = {
    id: existingRecord?.id || `CONF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    queueItemId: queueItem.id,
    entityType: queueItem.entityType,
    entityId: queueItem.entityId,
    operation: queueItem.operation,
    detectedAt: existingRecord?.detectedAt || inspectedAt,
    localPayloadHash,
    remotePayloadHash,
    localSnapshot,
    remoteSnapshot,
    differences,
    status: existingRecord?.status || 'OPEN',
    proposedDecision: existingRecord?.proposedDecision || null,
    decisionReason: existingRecord?.decisionReason,
    decidedAt: existingRecord?.decidedAt,
    decidedBy: existingRecord?.decidedBy,
    resolutionExecuted: false, // Strictly false
    resolutionExecutedAt: undefined
  };

  saveConflictRecord(conflictRecord);

  // History audit entry
  const historyEntry: ConflictHistoryEntry = {
    id: `CONF-HIST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    conflictId: conflictRecord.id,
    queueItemId: queueItem.id,
    action: 'INSPECT_CONFLICT',
    previousDecision: existingRecord?.proposedDecision || null,
    newDecision: conflictRecord.proposedDecision,
    reason: `Inspected conflict. Found ${differences.length} field differences.`,
    timestamp: inspectedAt,
    actor: 'System Inspector',
    executed: false
  };

  recordConflictHistory(historyEntry);

  return {
    success: true,
    queueItemId: queueItem.id,
    entityType: queueItem.entityType,
    entityId: queueItem.entityId,
    conflictRecord,
    inspectedAt
  };
}
