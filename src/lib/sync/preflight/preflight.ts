/**
 * Remote Preflight Engine (Phase 2D0)
 * Evaluates remote state via read-only SELECT queries before any sync execution.
 * Does NOT mutate, update, delete, or process queue items.
 * @license Apache-2.0
 */

import { SyncQueueItem } from '../syncTypes';
import { syncQueue } from '../syncQueue';
import { PreflightResult, PreflightSummaryReport } from './preflightTypes';
import { lookupRemoteRecord } from './remoteLookup';
import { comparePayloadWithRemote } from './remoteComparator';
import { computePayloadHash } from '../validators/baseValidator';

/**
 * Runs preflight lookup and comparison for a single queue item.
 * Strictly read-only operation.
 */
export async function runPreflight(item: SyncQueueItem): Promise<PreflightResult> {
  const checkedAt = new Date().toISOString();
  const queuePayloadHash = item.payloadHash || computePayloadHash(item.payload);

  if (!item || !item.entityId) {
    return {
      entityType: item?.entityType || 'Unknown',
      entityId: item?.entityId || 'Missing',
      queueSequence: item?.sequenceNumber,
      queueVersion: item?.version || 1,
      queuePayloadHash,
      remoteExists: false,
      status: 'REMOTE_NOT_CHECKED',
      reason: 'Invalid queue item or missing entityId',
      checkedAt
    };
  }

  // 1. SELECT query to Supabase
  const lookup = await lookupRemoteRecord(item.entityType, item.entityId);

  if (!lookup.success) {
    return {
      entityType: item.entityType,
      entityId: item.entityId,
      queueSequence: item.sequenceNumber,
      queueVersion: item.version,
      queuePayloadHash,
      remoteExists: false,
      status: 'REMOTE_NOT_CHECKED',
      reason: lookup.error || 'Network or database query failed',
      checkedAt
    };
  }

  // 2. Record does not exist in Supabase -> READY_TO_SYNC
  if (!lookup.exists || !lookup.data) {
    return {
      entityType: item.entityType,
      entityId: item.entityId,
      queueSequence: item.sequenceNumber,
      queueVersion: item.version,
      queuePayloadHash,
      remoteExists: false,
      status: 'READY_TO_SYNC',
      reason: 'Record does not exist in remote database',
      checkedAt
    };
  }

  // 3. Record exists in Supabase -> Compare payload
  const comp = comparePayloadWithRemote(item.payload, lookup.data);

  if (comp.isMatch) {
    return {
      entityType: item.entityType,
      entityId: item.entityId,
      queueSequence: item.sequenceNumber,
      queueVersion: item.version,
      queuePayloadHash,
      remoteExists: true,
      remotePayloadHash: comp.remoteComputedHash,
      status: 'REMOTE_MATCH',
      reason: 'Remote record exists and payload content is identical',
      checkedAt,
      remoteData: lookup.data
    };
  } else {
    return {
      entityType: item.entityType,
      entityId: item.entityId,
      queueSequence: item.sequenceNumber,
      queueVersion: item.version,
      queuePayloadHash,
      remoteExists: true,
      remotePayloadHash: comp.remoteComputedHash,
      status: 'REMOTE_CONFLICT',
      reason: `Remote record exists with differing payload fields: [${comp.diffFields.slice(0, 3).join('; ')}]`,
      checkedAt,
      remoteData: lookup.data
    };
  }
}

/**
 * Runs preflight check across all queue items.
 * Strictly read-only operation.
 */
export async function runPreflightAll(itemsToProcess?: SyncQueueItem[]): Promise<PreflightSummaryReport> {
  const items = itemsToProcess || syncQueue.list();
  const results: PreflightResult[] = [];

  let readyToSyncCount = 0;
  let remoteMatchCount = 0;
  let remoteConflictCount = 0;
  let remoteNotCheckedCount = 0;

  for (const item of items) {
    const res = await runPreflight(item);
    results.push(res);

    switch (res.status) {
      case 'READY_TO_SYNC':
        readyToSyncCount++;
        break;
      case 'REMOTE_MATCH':
        remoteMatchCount++;
        break;
      case 'REMOTE_CONFLICT':
        remoteConflictCount++;
        break;
      case 'REMOTE_NOT_CHECKED':
        remoteNotCheckedCount++;
        break;
    }
  }

  return {
    totalChecked: items.length,
    readyToSyncCount,
    remoteMatchCount,
    remoteConflictCount,
    remoteNotCheckedCount,
    results,
    generatedAt: new Date().toISOString()
  };
}
