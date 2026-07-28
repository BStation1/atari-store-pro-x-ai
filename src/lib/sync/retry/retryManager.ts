/**
 * Manual Retry Execution Manager (Phase 2E)
 * Handles single-item manual retry attempts, policy enforcement, history logging, and stats.
 * @license Apache-2.0
 */

import { SyncQueueItem } from '../syncTypes';
import { syncQueue } from '../syncQueue';
import { manualSync } from '../manual/manualSync';
import { evaluateRetryPolicy } from './retryPolicy';
import { recordRetryHistory, getVerifiedAfterRetryCount, getAverageRetryDurationMs } from './retryHistory';
import { RetryExecutionReport, RetryHistoryEntry, RetryStats } from './retryTypes';

/**
 * Executes a single manual retry for a failed queue item.
 * Strictly processes ONE item at a time. No auto-sync, no timers, no bulk loops.
 */
export async function executeManualRetry(
  item: SyncQueueItem,
  userConfirmed: boolean = false,
  retryReason?: string
): Promise<RetryExecutionReport> {
  const startedAt = new Date().toISOString();
  const startTime = performance.now();

  if (retryReason) {
    item.retryReason = retryReason;
  }

  // 1. Evaluate Retry Policy
  const policy = await evaluateRetryPolicy(item, userConfirmed);

  // Handle REMOTE_CONFLICT
  if (policy.blockReason === 'REMOTE_CONFLICT' || policy.resolvedStatus === 'Conflict') {
    syncQueue.markConflict(item.id, policy.message);

    const durationMs = Math.round(performance.now() - startTime);
    const finishedAt = new Date().toISOString();

    const historyEntry: RetryHistoryEntry = {
      id: `RETRY-HIST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      queueItemId: item.id,
      attemptNumber: (item.retryCount || 0) + 1,
      startedAt,
      finishedAt,
      durationMs,
      preflightStatus: policy.preflightStatus || 'REMOTE_CONFLICT',
      result: 'BLOCKED',
      error: policy.message,
      verificationResult: 'NOT_PERFORMED'
    };
    recordRetryHistory(historyEntry);

    return {
      queueItemId: item.id,
      entityType: item.entityType,
      entityId: item.entityId,
      attemptNumber: historyEntry.attemptNumber,
      startedAt,
      finishedAt,
      durationMs,
      preflightStatus: policy.preflightStatus || 'REMOTE_CONFLICT',
      retryDecision: policy.decision,
      finalQueueStatus: 'Conflict',
      verificationResult: 'NOT_PERFORMED',
      error: policy.message,
      historyEntry
    };
  }

  // Handle Other Blocked Decisions
  if (!policy.allowed) {
    const durationMs = Math.round(performance.now() - startTime);
    const finishedAt = new Date().toISOString();

    const historyEntry: RetryHistoryEntry = {
      id: `RETRY-HIST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      queueItemId: item.id,
      attemptNumber: item.retryCount || 0,
      startedAt,
      finishedAt,
      durationMs,
      preflightStatus: policy.preflightStatus || 'REMOTE_NOT_CHECKED',
      result: 'BLOCKED',
      error: policy.message,
      verificationResult: 'NOT_PERFORMED'
    };
    recordRetryHistory(historyEntry);

    return {
      queueItemId: item.id,
      entityType: item.entityType,
      entityId: item.entityId,
      attemptNumber: historyEntry.attemptNumber,
      startedAt,
      finishedAt,
      durationMs,
      preflightStatus: policy.preflightStatus || 'REMOTE_NOT_CHECKED',
      retryDecision: policy.decision,
      finalQueueStatus: item.status,
      verificationResult: 'NOT_PERFORMED',
      error: policy.message,
      historyEntry
    };
  }

  // Handle REMOTE_MATCH (Already synced remotely)
  if (policy.resolvedStatus === 'Synced') {
    syncQueue.markSynced(item.id);
    const target = syncQueue.getItem(item.id);
    if (target) {
      target.lastSyncResult = 'VERIFIED_AFTER_RETRY';
      target.syncedAt = new Date().toISOString();
    }

    const durationMs = Math.round(performance.now() - startTime);
    const finishedAt = new Date().toISOString();

    const historyEntry: RetryHistoryEntry = {
      id: `RETRY-HIST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      queueItemId: item.id,
      attemptNumber: (item.retryCount || 0) + 1,
      startedAt,
      finishedAt,
      durationMs,
      preflightStatus: 'REMOTE_MATCH',
      result: 'RESOLVED_EXISTING',
      verificationResult: 'VERIFIED'
    };
    recordRetryHistory(historyEntry);

    return {
      queueItemId: item.id,
      entityType: item.entityType,
      entityId: item.entityId,
      attemptNumber: historyEntry.attemptNumber,
      startedAt,
      finishedAt,
      durationMs,
      preflightStatus: 'REMOTE_MATCH',
      retryDecision: 'ALLOW_RETRY',
      finalQueueStatus: 'Synced',
      verificationResult: 'VERIFIED',
      historyEntry
    };
  }

  // Standard Retry Execution: Temporarily set item status to Pending and invoke manualSync
  syncQueue.markPending(item.id);
  const updatedItem = syncQueue.getItem(item.id) || { ...item, status: 'Pending' as const };

  const manualReport = await manualSync(updatedItem);

  const durationMs = Math.round(performance.now() - startTime);
  const finishedAt = new Date().toISOString();

  const isSuccess = manualReport.finalQueueStatus === 'Synced';
  const historyEntry: RetryHistoryEntry = {
    id: `RETRY-HIST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    queueItemId: item.id,
    attemptNumber: updatedItem.retryCount || 1,
    startedAt,
    finishedAt,
    durationMs,
    preflightStatus: manualReport.preflightStatus,
    result: isSuccess ? 'SUCCESS' : 'FAILED',
    error: manualReport.error,
    verificationResult: manualReport.verificationResult
  };
  recordRetryHistory(historyEntry);

  return {
    queueItemId: item.id,
    entityType: item.entityType,
    entityId: item.entityId,
    attemptNumber: historyEntry.attemptNumber,
    startedAt,
    finishedAt,
    durationMs,
    preflightStatus: manualReport.preflightStatus,
    retryDecision: 'ALLOW_RETRY',
    finalQueueStatus: manualReport.finalQueueStatus,
    verificationResult: manualReport.verificationResult,
    error: manualReport.error,
    historyEntry
  };
}

/**
 * Returns comprehensive retry statistics for System Health display.
 */
export function getRetryStats(): RetryStats {
  const items = syncQueue.list();

  const retryCountDistribution: Record<number, number> = {};
  let failedQueueItemsCount = 0;
  let conflictQueueItemsCount = 0;

  items.forEach(i => {
    if (i.status === 'Failed') failedQueueItemsCount++;
    if (i.status === 'Conflict') conflictQueueItemsCount++;

    const cnt = i.retryCount || 0;
    retryCountDistribution[cnt] = (retryCountDistribution[cnt] || 0) + 1;
  });

  return {
    retryCountDistribution,
    failedQueueItemsCount,
    conflictQueueItemsCount,
    verifiedAfterRetryCount: getVerifiedAfterRetryCount(),
    averageRetryDurationMs: getAverageRetryDurationMs()
  };
}
