/**
 * Single Manual Sync Execution Engine (Phase 2D Canary Mode)
 * Executes writing for exactly ONE queue item if and only if preflight returns READY_TO_SYNC.
 * Performs post-write SELECT verification.
 * Does NOT run auto sync, background worker, loops, or batch processing.
 * @license Apache-2.0
 */

import { SyncQueueItem } from '../syncTypes';
import { syncQueue } from '../syncQueue';
import { runPreflight } from '../preflight/preflight';
import { lookupRemoteRecord, getTableNameForEntity } from '../preflight/remoteLookup';
import { comparePayloadWithRemote } from '../preflight/remoteComparator';
import { supabase, isSupabaseConfigured } from '../../supabaseClient';
import { ManualSyncReport, VerificationResult } from './manualSyncTypes';
import { recordManualSyncReport } from './manualSyncResult';

/**
 * Normalizes local payload to match Supabase database schema column names
 */
function normalizePayloadForDb(entityType: string, entityId: string, payload: any): Record<string, any> {
  const data = { ...payload, id: entityId };

  // Common camelCase to snake_case mappings
  if (data.customerName && !data.name) data.name = data.customerName;
  if (data.customerPhone && !data.phone) data.phone = data.customerPhone;
  if (data.customerId && !data.customer_id) data.customer_id = data.customerId;
  if (data.deviceType && !data.device_type) data.device_type = data.deviceType;
  if (data.repairOrderId && !data.repair_order_id) data.repair_order_id = data.repairOrderId;
  if (data.stockQuantity !== undefined && data.stock_quantity === undefined) data.stock_quantity = data.stockQuantity;

  return data;
}

/**
 * Executes a strictly guarded single manual sync for one queue item.
 */
export async function manualSync(item: SyncQueueItem): Promise<ManualSyncReport> {
  const executedAt = new Date().toISOString();

  // 1. Restriction: Enforce CREATE operation only in Phase 2D.1
  if (item.operation !== 'CREATE') {
    const unsupportedReport: ManualSyncReport = {
      queueItemId: item.id,
      entityType: item.entityType,
      entityId: item.entityId,
      preflightStatus: 'REMOTE_NOT_CHECKED',
      writeDurationMs: 0,
      verificationDurationMs: 0,
      remoteRecordFound: false,
      verificationResult: 'NOT_PERFORMED',
      finalQueueStatus: item.status,
      error: 'BLOCKED_UNSUPPORTED_OPERATION: Phase 2D manualSync is currently restricted to CREATE operations only',
      executedAt
    };
    recordManualSyncReport(unsupportedReport);
    return unsupportedReport;
  }

  // A. Check Queue Status
  if (item.status !== 'Pending') {
    const blockedReport: ManualSyncReport = {
      queueItemId: item.id,
      entityType: item.entityType,
      entityId: item.entityId,
      preflightStatus: 'REMOTE_NOT_CHECKED',
      writeDurationMs: 0,
      verificationDurationMs: 0,
      remoteRecordFound: false,
      verificationResult: 'NOT_PERFORMED',
      finalQueueStatus: item.status,
      error: `Execution blocked: Item status is '${item.status}', must be 'Pending'`,
      executedAt
    };
    recordManualSyncReport(blockedReport);
    return blockedReport;
  }

  // B. Preflight Check
  const preflight = await runPreflight(item);

  if (preflight.status !== 'READY_TO_SYNC') {
    const blockedReport: ManualSyncReport = {
      queueItemId: item.id,
      entityType: item.entityType,
      entityId: item.entityId,
      preflightStatus: preflight.status,
      writeDurationMs: 0,
      verificationDurationMs: 0,
      remoteRecordFound: preflight.remoteExists,
      verificationResult: 'NOT_PERFORMED',
      finalQueueStatus: item.status,
      error: `Execution blocked by Preflight: Status is '${preflight.status}' (${preflight.reason})`,
      executedAt
    };
    recordManualSyncReport(blockedReport);
    return blockedReport;
  }

  // Check Supabase Configuration
  if (!isSupabaseConfigured) {
    const errorMsg = 'Supabase client is not configured or offline';
    syncQueue.incrementRetry(item.id);
    syncQueue.markFailed(item.id, errorMsg);

    const failReport: ManualSyncReport = {
      queueItemId: item.id,
      entityType: item.entityType,
      entityId: item.entityId,
      preflightStatus: 'REMOTE_NOT_CHECKED',
      writeDurationMs: 0,
      verificationDurationMs: 0,
      remoteRecordFound: false,
      verificationResult: 'FAILED',
      finalQueueStatus: 'Failed',
      error: errorMsg,
      executedAt
    };
    recordManualSyncReport(failReport);
    return failReport;
  }

  // C. Atomic Lock & Re-read from Queue
  const latestItemInQueue = syncQueue.getItem(item.id);
  if (!latestItemInQueue || latestItemInQueue.status !== 'Pending') {
    const lockFailReport: ManualSyncReport = {
      queueItemId: item.id,
      entityType: item.entityType,
      entityId: item.entityId,
      preflightStatus: preflight.status,
      writeDurationMs: 0,
      verificationDurationMs: 0,
      remoteRecordFound: preflight.remoteExists,
      verificationResult: 'NOT_PERFORMED',
      finalQueueStatus: latestItemInQueue?.status || item.status,
      error: `Atomic transition blocked: Queue item status changed or concurrent execution detected`,
      executedAt
    };
    recordManualSyncReport(lockFailReport);
    return lockFailReport;
  }

  const locked = syncQueue.atomicMarkSyncing(item.id);
  if (!locked) {
    const lockFailReport: ManualSyncReport = {
      queueItemId: item.id,
      entityType: item.entityType,
      entityId: item.entityId,
      preflightStatus: preflight.status,
      writeDurationMs: 0,
      verificationDurationMs: 0,
      remoteRecordFound: preflight.remoteExists,
      verificationResult: 'NOT_PERFORMED',
      finalQueueStatus: item.status,
      error: `Atomic lock failed: Item status transition from Pending to Syncing was rejected`,
      executedAt
    };
    recordManualSyncReport(lockFailReport);
    return lockFailReport;
  }

  const tableName = getTableNameForEntity(item.entityType);
  const writeStart = performance.now();
  let writeDurationMs = 0;
  let verificationDurationMs = 0;

  try {
    // D. Perform Write Operation (CREATE ONLY)
    const dbPayload = normalizePayloadForDb(item.entityType, item.entityId, item.payload);

    let writeError: string | null = null;
    const { error } = await supabase
      .from(tableName)
      .upsert(dbPayload, { onConflict: 'id' });
    if (error) writeError = error.message;

    writeDurationMs = Math.round(performance.now() - writeStart);

    if (writeError) {
      syncQueue.incrementRetry(item.id);
      syncQueue.markFailed(item.id, `Write failed: ${writeError}`);

      const failReport: ManualSyncReport = {
        queueItemId: item.id,
        entityType: item.entityType,
        entityId: item.entityId,
        preflightStatus: preflight.status,
        writeDurationMs,
        verificationDurationMs: 0,
        remoteRecordFound: false,
        verificationResult: 'FAILED',
        finalQueueStatus: 'Failed',
        error: `Database write error: ${writeError}`,
        executedAt
      };
      recordManualSyncReport(failReport);
      return failReport;
    }

    // E. Verification Step (Post-write SELECT & Compare)
    const verifyStart = performance.now();
    const lookup = await lookupRemoteRecord(item.entityType, item.entityId);
    verificationDurationMs = Math.round(performance.now() - verifyStart);

    if (!lookup.success || !lookup.exists || !lookup.data) {
      syncQueue.incrementRetry(item.id);
      const postWriteWarning = `REMOTE_WRITE_MAY_HAVE_SUCCEEDED: Post-write verification query failed or record not found (${lookup.error || 'Record missing'})`;
      syncQueue.markFailed(item.id, postWriteWarning);

      const failReport: ManualSyncReport = {
        queueItemId: item.id,
        entityType: item.entityType,
        entityId: item.entityId,
        preflightStatus: preflight.status,
        writeDurationMs,
        verificationDurationMs,
        remoteRecordFound: lookup.exists,
        verificationResult: 'FAILED',
        finalQueueStatus: 'Failed',
        error: postWriteWarning,
        executedAt
      };
      recordManualSyncReport(failReport);
      return failReport;
    }

    // Compare data
    const comp = comparePayloadWithRemote(item.payload, lookup.data);

    if (comp.isMatch) {
      // F. Success & Mark Synced
      syncQueue.markSynced(item.id);

      const successReport: ManualSyncReport = {
        queueItemId: item.id,
        entityType: item.entityType,
        entityId: item.entityId,
        preflightStatus: preflight.status,
        writeDurationMs,
        verificationDurationMs,
        remoteRecordFound: true,
        verificationResult: 'VERIFIED',
        finalQueueStatus: 'Synced',
        executedAt
      };
      recordManualSyncReport(successReport);
      return successReport;
    } else {
      // Verification Conflict / Mismatch post-write
      syncQueue.incrementRetry(item.id);
      const postWriteMismatchWarning = `REMOTE_WRITE_MAY_HAVE_SUCCEEDED: Post-write payload mismatch [${comp.diffFields.join('; ')}]`;
      syncQueue.markFailed(item.id, postWriteMismatchWarning);

      const conflictReport: ManualSyncReport = {
        queueItemId: item.id,
        entityType: item.entityType,
        entityId: item.entityId,
        preflightStatus: preflight.status,
        writeDurationMs,
        verificationDurationMs,
        remoteRecordFound: true,
        verificationResult: 'MISMATCH',
        finalQueueStatus: 'Failed',
        error: postWriteMismatchWarning,
        executedAt
      };
      recordManualSyncReport(conflictReport);
      return conflictReport;
    }
  } catch (err: any) {
    const errorMsg = err?.message || 'Unexpected error during manual sync';
    syncQueue.incrementRetry(item.id);
    syncQueue.markFailed(item.id, errorMsg);

    const errorReport: ManualSyncReport = {
      queueItemId: item.id,
      entityType: item.entityType,
      entityId: item.entityId,
      preflightStatus: preflight.status,
      writeDurationMs,
      verificationDurationMs,
      remoteRecordFound: false,
      verificationResult: 'FAILED',
      finalQueueStatus: 'Failed',
      error: errorMsg,
      executedAt
    };
    recordManualSyncReport(errorReport);
    return errorReport;
  }
}
