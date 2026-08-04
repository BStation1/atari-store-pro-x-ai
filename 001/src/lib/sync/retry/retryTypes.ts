/**
 * Retry Policy & Failure Recovery Types (Phase 2E)
 * @license Apache-2.0
 */

import { SyncStatus } from '../syncTypes';
import { PreflightStatus } from '../preflight/preflightTypes';
import { VerificationResult } from '../manual/manualSyncTypes';

export type RetryDecision = 'ALLOW_RETRY' | 'BLOCK_RETRY' | 'REQUIRE_USER_CONFIRMATION';

export type RetryBlockReason =
  | 'NOT_FAILED'
  | 'REMOTE_CONFLICT'
  | 'REMOTE_NOT_CHECKED'
  | 'HIGH_RETRY_COUNT'
  | 'UNSUPPORTED_OPERATION'
  | 'UNKNOWN';

export interface RetryHistoryEntry {
  id: string;
  queueItemId: string;
  attemptNumber: number;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  preflightStatus: PreflightStatus;
  result: 'SUCCESS' | 'FAILED' | 'BLOCKED' | 'RESOLVED_EXISTING';
  error?: string;
  verificationResult?: VerificationResult;
}

export interface RetryPolicyCheckResult {
  allowed: boolean;
  decision: RetryDecision;
  preflightStatus?: PreflightStatus;
  blockReason?: RetryBlockReason;
  message: string;
  requiresUserConfirmation?: boolean;
  resolvedStatus?: SyncStatus;
}

export interface RetryExecutionReport {
  queueItemId: string;
  entityType: string;
  entityId: string;
  attemptNumber: number;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  preflightStatus: PreflightStatus;
  retryDecision: RetryDecision;
  finalQueueStatus: SyncStatus;
  verificationResult?: VerificationResult;
  error?: string;
  historyEntry?: RetryHistoryEntry;
}

export interface RetryStats {
  retryCountDistribution: Record<number, number>;
  failedQueueItemsCount: number;
  conflictQueueItemsCount: number;
  verifiedAfterRetryCount: number;
  averageRetryDurationMs: number;
}
