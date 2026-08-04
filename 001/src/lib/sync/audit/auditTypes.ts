/**
 * Audit Types for Phase 2G.1 - Audit Integrity & State Policy Hardening
 * @license Apache-2.0
 */

import { SyncStatus } from '../syncTypes';

export type AuditEventType =
  | 'QUEUE_CREATED'
  | 'VALIDATION_PASSED'
  | 'VALIDATION_FAILED'
  | 'PREFLIGHT_STARTED'
  | 'PREFLIGHT_COMPLETED'
  | 'SYNC_STARTED'
  | 'SYNC_SUCCEEDED'
  | 'SYNC_FAILED'
  | 'RETRY_STARTED'
  | 'RETRY_COMPLETED'
  | 'CONFLICT_DETECTED'
  | 'CONFLICT_INSPECTED'
  | 'DECISION_RECORDED'
  | 'BACKUP_CREATED'
  | 'RESOLUTION_STARTED'
  | 'RESOLUTION_COMPLETED'
  | 'VERIFICATION_COMPLETED'
  | 'STATE_TRANSITION_REJECTED'
  | 'AUDIT_CHAIN_STARTED';

export type AuditResult = 'SUCCESS' | 'FAILED' | 'BLOCKED' | 'REJECTED';

export interface AuditEvent {
  readonly sequenceNumber: number;
  readonly previousEventHash: string;
  readonly eventHash: string;
  readonly schemaVersion: string;
  readonly eventId: string;
  readonly correlationId: string;
  readonly timestamp: string;
  readonly queueItemId: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly operation: string;
  readonly eventType: AuditEventType;
  readonly previousState?: SyncStatus | string;
  readonly newState?: SyncStatus | string;
  readonly actor: string;
  readonly result: AuditResult;
  readonly durationMs?: number;
  readonly metadata?: Readonly<Record<string, any>>;
  readonly isLegacyUnverified?: boolean;
}

export interface StateTransitionContext {
  reason?: string;
  actor?: string;
  correlationId?: string;
  source?: string;
  resolutionVerified?: boolean;
  recoveryApproved?: boolean;
}

export interface StateTransitionValidation {
  valid: boolean;
  reason?: string;
}

export type AuditFailureType =
  | 'HASH_MISMATCH'
  | 'PREVIOUS_HASH_MISMATCH'
  | 'SEQUENCE_GAP'
  | 'DUPLICATE_SEQUENCE'
  | 'INVALID_GENESIS'
  | 'INVALID_EVENT_SCHEMA'
  | 'NONE';

export interface AuditVerificationResult {
  valid: boolean;
  totalEvents: number;
  verifiedEvents: number;
  firstBrokenSequence: number | null;
  failureType: AuditFailureType;
  expectedHash: string | null;
  actualHash: string | null;
}

export interface SyncHealthMetrics {
  scorePercentage: number | 'INSUFFICIENT_DATA';
  dataQuality: 'SUFFICIENT_DATA' | 'INSUFFICIENT_DATA';
  healthGrade: 'EXCELLENT' | 'GOOD' | 'NEEDS_ATTENTION' | 'CRITICAL' | 'INSUFFICIENT_DATA';
  pendingCount: number;
  failedCount: number;
  conflictCount: number;
  staleSyncingCount: number;
  avgSyncDurationMs: number;
  avgRetryDurationMs: number;
  avgResolutionDurationMs: number;
  successRatePercentage: number;
  deductionsBreakdown?: {
    failedPenalty: number;
    conflictPenalty: number;
    staleSyncingPenalty: number;
    oldPendingPenalty: number;
    successRatePenalty: number;
    syncDurationPenalty: number;
    retryDurationPenalty: number;
    resolutionDurationPenalty: number;
  };
}

export interface SyncDiagnosticsReport {
  oldPendingItems: Array<{ id: string; ageMinutes: number }>;
  oldFailedItems: Array<{ id: string; ageMinutes: number }>;
  oldConflicts: Array<{ id: string; ageMinutes: number }>;
  unusedBackups: Array<{ backupId: string; queueItemId: string; ageMinutes: number }>;
  largeRetryHistories: Array<{ queueItemId: string; attemptCount: number }>;
}
