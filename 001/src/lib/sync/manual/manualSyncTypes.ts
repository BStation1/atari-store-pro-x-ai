/**
 * Manual Sync Types (Phase 2D Canary Mode)
 * @license Apache-2.0
 */

import { SyncQueueItem, SyncStatus } from '../syncTypes';
import { PreflightStatus } from '../preflight/preflightTypes';

export type VerificationResult = 'VERIFIED' | 'MISMATCH' | 'NOT_PERFORMED' | 'FAILED';

export interface ManualSyncReport {
  queueItemId: string;
  entityType: string;
  entityId: string;
  preflightStatus: PreflightStatus;
  writeDurationMs: number;
  verificationDurationMs: number;
  remoteRecordFound: boolean;
  verificationResult: VerificationResult;
  finalQueueStatus: SyncStatus;
  error?: string;
  executedAt: string;
}

export interface ManualSyncStats {
  lastManualSyncAt?: string;
  verifiedSyncCount: number;
  failedSyncCount: number;
  blockedSyncCount: number;
}
