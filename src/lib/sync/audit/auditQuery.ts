/**
 * Audit Query & Hardened Health Score Engine for Phase 2G.1
 * @license Apache-2.0
 */

import { getAllAuditEvents } from './auditStorage';
import { AuditEvent, SyncHealthMetrics, SyncDiagnosticsReport } from './auditTypes';
import { syncQueue } from '../syncQueue';
import { getAllConflictRecords } from '../conflicts/conflictHistory';
import { getAllResolutionBackups } from '../conflicts/execution/resolutionBackup';
import { getRetryStats } from '../retry';

export function getAuditEventsByQueueItem(queueItemId: string): AuditEvent[] {
  const all = getAllAuditEvents();
  return all.filter(e => e.queueItemId === queueItemId);
}

export function getAuditTimelineByCorrelationId(correlationId: string): AuditEvent[] {
  const all = getAllAuditEvents();
  return all.filter(e => e.correlationId === correlationId).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export function getAllCorrelationIds(): string[] {
  const all = getAllAuditEvents();
  const set = new Set<string>();
  all.forEach(e => set.add(e.correlationId));
  return Array.from(set);
}

/**
 * Hardened Health Score Calculator with strict penalties and data quality detection (Phase 2G.1)
 */
export function calculateSyncHealthMetrics(): SyncHealthMetrics {
  const items = syncQueue.list();
  const allLogs = getAllAuditEvents();

  const pendingCount = items.filter(i => i.status === 'Pending').length;
  const failedCount = items.filter(i => i.status === 'Failed').length;
  const conflictCount = items.filter(i => i.status === 'Conflict').length;
  const syncedCount = items.filter(i => i.status === 'Synced').length;

  const now = Date.now();
  const staleSyncingCount = items.filter(
    i => i.status === 'Syncing' && (now - new Date(i.updatedAt).getTime()) > 2 * 60 * 1000
  ).length;

  const oldPendingCount = items.filter(
    i => i.status === 'Pending' && (now - new Date(i.createdAt).getTime()) > 10 * 60 * 1000
  ).length;

  const syncLogs = allLogs.filter(e => e.eventType === 'SYNC_SUCCEEDED' || e.eventType === 'SYNC_FAILED');
  const retryLogs = allLogs.filter(e => e.eventType === 'RETRY_COMPLETED');
  const resLogs = allLogs.filter(e => e.eventType === 'RESOLUTION_COMPLETED');

  const calcAvgMs = (logs: AuditEvent[]) => {
    const valid = logs.filter(l => typeof l.durationMs === 'number' && l.durationMs > 0);
    if (valid.length === 0) return 0;
    const sum = valid.reduce((acc, l) => acc + (l.durationMs || 0), 0);
    return Math.round(sum / valid.length);
  };

  const avgSyncDurationMs = calcAvgMs(syncLogs);
  const avgRetryDurationMs = calcAvgMs(retryLogs);
  const avgResolutionDurationMs = calcAvgMs(resLogs);

  const totalProcessed = syncedCount + failedCount + conflictCount;

  // Check for insufficient data
  if (items.length === 0 && allLogs.length === 0) {
    return {
      scorePercentage: 'INSUFFICIENT_DATA',
      dataQuality: 'INSUFFICIENT_DATA',
      healthGrade: 'INSUFFICIENT_DATA',
      pendingCount: 0,
      failedCount: 0,
      conflictCount: 0,
      staleSyncingCount: 0,
      avgSyncDurationMs: 0,
      avgRetryDurationMs: 0,
      avgResolutionDurationMs: 0,
      successRatePercentage: 0
    };
  }

  const successRatePercentage = totalProcessed > 0 ? Math.round((syncedCount / totalProcessed) * 100) : 100;

  // Calculate Deductions
  const failedPenalty = Math.min(30, failedCount * 6);
  const conflictPenalty = Math.min(25, conflictCount * 5);
  const staleSyncingPenalty = Math.min(30, staleSyncingCount * 10);
  const oldPendingPenalty = Math.min(15, oldPendingCount * 3);

  let successRatePenalty = 0;
  if (totalProcessed > 0 && successRatePercentage < 95) {
    successRatePenalty = Math.min(20, Math.round((95 - successRatePercentage) * 0.5));
  }

  // Performance Penalties
  let syncDurationPenalty = 0;
  if (avgSyncDurationMs > 10000) syncDurationPenalty = 10;
  else if (avgSyncDurationMs > 5000) syncDurationPenalty = 5;
  else if (avgSyncDurationMs > 2000) syncDurationPenalty = 2;

  let retryDurationPenalty = 0;
  if (avgRetryDurationMs > 8000) retryDurationPenalty = 5;
  else if (avgRetryDurationMs > 3000) retryDurationPenalty = 2;

  let resolutionDurationPenalty = 0;
  if (avgResolutionDurationMs > 15000) resolutionDurationPenalty = 5;
  else if (avgResolutionDurationMs > 5000) resolutionDurationPenalty = 2;

  const totalDeduction =
    failedPenalty +
    conflictPenalty +
    staleSyncingPenalty +
    oldPendingPenalty +
    successRatePenalty +
    syncDurationPenalty +
    retryDurationPenalty +
    resolutionDurationPenalty;

  const rawScore = 100 - totalDeduction;
  const scorePercentage = Math.max(0, Math.min(100, rawScore));

  let healthGrade: 'EXCELLENT' | 'GOOD' | 'NEEDS_ATTENTION' | 'CRITICAL' = 'EXCELLENT';
  if (scorePercentage < 50) healthGrade = 'CRITICAL';
  else if (scorePercentage < 75) healthGrade = 'NEEDS_ATTENTION';
  else if (scorePercentage < 90) healthGrade = 'GOOD';

  return {
    scorePercentage,
    dataQuality: 'SUFFICIENT_DATA',
    healthGrade,
    pendingCount,
    failedCount,
    conflictCount,
    staleSyncingCount,
    avgSyncDurationMs,
    avgRetryDurationMs,
    avgResolutionDurationMs,
    successRatePercentage,
    deductionsBreakdown: {
      failedPenalty,
      conflictPenalty,
      staleSyncingPenalty,
      oldPendingPenalty,
      successRatePenalty,
      syncDurationPenalty,
      retryDurationPenalty,
      resolutionDurationPenalty
    }
  };
}

export function runSyncDiagnostics(): SyncDiagnosticsReport {
  const items = syncQueue.list();
  const now = Date.now();

  const oldPendingItems = items
    .filter(i => i.status === 'Pending')
    .map(i => ({ id: i.id, ageMinutes: Math.floor((now - new Date(i.createdAt).getTime()) / 60000) }))
    .filter(x => x.ageMinutes >= 15);

  const oldFailedItems = items
    .filter(i => i.status === 'Failed')
    .map(i => ({ id: i.id, ageMinutes: Math.floor((now - new Date(i.updatedAt).getTime()) / 60000) }))
    .filter(x => x.ageMinutes >= 30);

  const conflicts = getAllConflictRecords();
  const oldConflicts = conflicts
    .filter(c => c.status !== 'RESOLVED')
    .map(c => ({ id: c.queueItemId, ageMinutes: Math.floor((now - new Date(c.detectedAt).getTime()) / 60000) }))
    .filter(x => x.ageMinutes >= 30);

  const backups = getAllResolutionBackups();
  const unusedBackups = backups
    .map(b => ({ backupId: b.backupId, queueItemId: b.queueItemId, ageMinutes: Math.floor((now - new Date(b.createdAt).getTime()) / 60000) }))
    .filter(x => x.ageMinutes >= 60);

  const largeRetryHistories = items
    .filter(i => i.retryCount >= 3)
    .map(i => ({ queueItemId: i.id, attemptCount: i.retryCount }));

  return {
    oldPendingItems,
    oldFailedItems,
    oldConflicts,
    unusedBackups,
    largeRetryHistories
  };
}
