/**
 * Conflict Inspection & Manual Resolution Planning Types (Phase 2F-A)
 * @license Apache-2.0
 */

import { SyncEntityType, SyncOperation } from '../syncTypes';

export type ConflictStatus = 'OPEN' | 'DECISION_RECORDED' | 'RESOLVED' | 'DISMISSED';

export type ProposedDecisionType =
  | 'KEEP_LOCAL_PROPOSED'
  | 'KEEP_REMOTE_PROPOSED'
  | 'MERGE_FIELDS_PROPOSED'
  | 'DEFER'
  | 'DISMISS_TEST_CONFLICT';

export type FieldDifferenceType =
  | 'LOCAL_ONLY'
  | 'REMOTE_ONLY'
  | 'VALUE_MISMATCH'
  | 'TYPE_MISMATCH'
  | 'ARRAY_MISMATCH'
  | 'MISSING_LOCAL'
  | 'MISSING_REMOTE';

export type FieldDecisionType = 'USE_LOCAL' | 'USE_REMOTE' | 'MANUAL_VALUE' | 'IGNORE_METADATA';

export interface FieldDifference {
  path: string;
  differenceType: FieldDifferenceType;
  localValue: any;
  remoteValue: any;
  localType: string;
  remoteType: string;
  isSensitive: boolean;
  recommendedAction?: string;
}

export interface ConflictRecord {
  id: string;
  queueItemId: string;
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  detectedAt: string;
  localPayloadHash: string;
  remotePayloadHash: string;
  localSnapshot: Record<string, any> | null;
  remoteSnapshot: Record<string, any> | null;
  differences: FieldDifference[];
  status: ConflictStatus;
  proposedDecision: ProposedDecisionType | null;
  decisionReason?: string;
  decidedAt?: string;
  decidedBy?: string;
  resolutionExecuted: boolean; // MUST be false in real execution
  resolutionExecutedAt?: string;
}

export interface FieldDecision {
  fieldPath: string;
  decision: FieldDecisionType;
  manualValue?: any;
  reason?: string;
}

export interface ResolutionPlan {
  queueItemId: string;
  conflictId: string;
  fieldDecisions: Record<string, FieldDecision>;
  createdAt: string;
  createdBy: string;
  validated: boolean;
  validationErrors: string[];
  executed: boolean; // MUST be false
}

export interface ConflictHistoryEntry {
  id: string;
  conflictId: string;
  queueItemId: string;
  action: string;
  previousDecision: ProposedDecisionType | null;
  newDecision: ProposedDecisionType | null;
  reason?: string;
  timestamp: string;
  actor: string;
  executed: boolean; // MUST be false
}

export interface ConflictInspectionResult {
  success: boolean;
  queueItemId: string;
  entityType: string;
  entityId: string;
  conflictRecord?: ConflictRecord;
  error?: string;
  inspectedAt: string;
}

export interface ConflictStats {
  openConflictsCount: number;
  conflictsWithRecordedDecisionsCount: number;
  deferredConflictsCount: number;
  proposedKeepLocalCount: number;
  proposedKeepRemoteCount: number;
  proposedMergeCount: number;
  uninspectedConflictsCount: number;
  executedResolutionsCount: number; // Always 0
}
