/**
 * Manual Resolution Decision Recording & Resolution Plan Validation (Phase 2F-A)
 * Does NOT execute decisions or mutate queue items/remote database.
 * @license Apache-2.0
 */

import {
  ConflictRecord,
  ProposedDecisionType,
  FieldDecision,
  ResolutionPlan,
  ConflictHistoryEntry
} from './conflictTypes';
import {
  getConflictRecordForItem,
  saveConflictRecord,
  saveResolutionPlan,
  recordConflictHistory,
  getAllConflictRecords
} from './conflictHistory';
import { isFieldSensitive } from './conflictDiff';

export interface DecisionRecordParams {
  queueItemId: string;
  proposedDecision: ProposedDecisionType;
  decisionReason?: string;
  fieldDecisions?: Record<string, FieldDecision>;
  actor?: string;
}

export interface DecisionRecordResult {
  success: boolean;
  conflictRecord?: ConflictRecord;
  resolutionPlan?: ResolutionPlan;
  validated: boolean;
  validationErrors: string[];
  message: string;
}

/**
 * Validates a proposed decision before recording it.
 */
export function validateDecision(
  record: ConflictRecord,
  proposedDecision: ProposedDecisionType,
  fieldDecisions?: Record<string, FieldDecision>
): { validated: boolean; errors: string[] } {
  const errors: string[] = [];

  switch (proposedDecision) {
    case 'KEEP_LOCAL_PROPOSED':
      if (!record.localSnapshot) {
        errors.push('KEEP_LOCAL_PROPOSED requires a valid local snapshot in the conflict record');
      }
      if (!record.remoteSnapshot) {
        errors.push('KEEP_LOCAL_PROPOSED requires a valid remote snapshot');
      }
      break;

    case 'KEEP_REMOTE_PROPOSED':
      if (!record.remoteSnapshot) {
        errors.push('KEEP_REMOTE_PROPOSED requires a valid remote snapshot');
      }
      break;

    case 'MERGE_FIELDS_PROPOSED': {
      if (!fieldDecisions || Object.keys(fieldDecisions).length === 0) {
        errors.push('MERGE_FIELDS_PROPOSED requires per-field decisions for all differences');
      } else {
        // Check that every non-metadata difference has a decision
        for (const diff of record.differences) {
          const decision = fieldDecisions[diff.path];
          if (!decision) {
            errors.push(`Missing field decision for difference at path: "${diff.path}"`);
          } else {
            // Check manual value sensitivity rules
            if (decision.decision === 'MANUAL_VALUE') {
              if (decision.manualValue === undefined || decision.manualValue === '') {
                errors.push(`Manual value cannot be empty for field path: "${diff.path}"`);
              }
              if (isFieldSensitive(diff.path) && typeof decision.manualValue === 'string' && decision.manualValue.length < 3) {
                errors.push(`Manual value for sensitive field "${diff.path}" is too short or insecure`);
              }
            }
          }
        }

        // Prevent changing Entity ID or Operation in per-field decisions
        if (fieldDecisions['id'] || fieldDecisions['entityId']) {
          errors.push('Cannot modify entity ID in field decisions');
        }
        if (fieldDecisions['operation']) {
          errors.push('Cannot modify sync operation in field decisions');
        }
      }
      break;
    }

    case 'DEFER':
    case 'DISMISS_TEST_CONFLICT':
      // Always valid, no extra constraints
      break;

    default:
      errors.push(`Unknown proposed decision type: ${proposedDecision}`);
  }

  return {
    validated: errors.length === 0,
    errors
  };
}

/**
 * Records a manual decision for a conflict item without executing it.
 * Strictly read/plan operation: resolutionExecuted remains false.
 */
export function recordProposedDecision(params: DecisionRecordParams): DecisionRecordResult {
  const { queueItemId, proposedDecision, decisionReason, fieldDecisions, actor = 'System Admin' } = params;

  const record = getConflictRecordForItem(queueItemId);
  if (!record) {
    return {
      success: false,
      validated: false,
      validationErrors: ['Conflict record not found for queueItemId'],
      message: `No conflict record found for queueItemId ${queueItemId}. Inspect conflict first.`
    };
  }

  const valRes = validateDecision(record, proposedDecision, fieldDecisions);

  const prevDecision = record.proposedDecision;
  const now = new Date().toISOString();

  // Update conflict record
  record.proposedDecision = proposedDecision;
  record.decisionReason = decisionReason || `Decision recorded: ${proposedDecision}`;
  record.decidedAt = now;
  record.decidedBy = actor;
  record.status = proposedDecision === 'DISMISS_TEST_CONFLICT' ? 'DISMISSED' : 'DECISION_RECORDED';
  record.resolutionExecuted = false; // Strictly false

  saveConflictRecord(record);

  // Create Resolution Plan if MERGE_FIELDS_PROPOSED
  let plan: ResolutionPlan | undefined;
  if (proposedDecision === 'MERGE_FIELDS_PROPOSED') {
    plan = {
      queueItemId,
      conflictId: record.id,
      fieldDecisions: fieldDecisions || {},
      createdAt: now,
      createdBy: actor,
      validated: valRes.validated,
      validationErrors: valRes.errors,
      executed: false // Strictly false
    };
    saveResolutionPlan(plan);
  }

  // Create Conflict History Entry
  const historyEntry: ConflictHistoryEntry = {
    id: `CONF-HIST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    conflictId: record.id,
    queueItemId,
    action: `RECORD_DECISION_${proposedDecision}`,
    previousDecision: prevDecision,
    newDecision: proposedDecision,
    reason: decisionReason,
    timestamp: now,
    actor,
    executed: false // Strictly false
  };

  recordConflictHistory(historyEntry);

  return {
    success: true,
    conflictRecord: record,
    resolutionPlan: plan,
    validated: valRes.validated,
    validationErrors: valRes.errors,
    message: `Proposed decision '${proposedDecision}' recorded successfully. Resolution executed = false.`
  };
}

/**
 * Computes summary stats for System Health dashboard.
 */
export function getConflictStats() {
  const records = getAllConflictRecords();

  let openConflictsCount = 0;
  let conflictsWithRecordedDecisionsCount = 0;
  let deferredConflictsCount = 0;
  let proposedKeepLocalCount = 0;
  let proposedKeepRemoteCount = 0;
  let proposedMergeCount = 0;
  let uninspectedConflictsCount = 0;

  for (const r of records) {
    if (r.status === 'OPEN') {
      openConflictsCount++;
    } else if (r.status === 'DECISION_RECORDED') {
      conflictsWithRecordedDecisionsCount++;
    }

    if (r.proposedDecision === 'DEFER') {
      deferredConflictsCount++;
    } else if (r.proposedDecision === 'KEEP_LOCAL_PROPOSED') {
      proposedKeepLocalCount++;
    } else if (r.proposedDecision === 'KEEP_REMOTE_PROPOSED') {
      proposedKeepRemoteCount++;
    } else if (r.proposedDecision === 'MERGE_FIELDS_PROPOSED') {
      proposedMergeCount++;
    }
  }

  return {
    openConflictsCount,
    conflictsWithRecordedDecisionsCount,
    deferredConflictsCount,
    proposedKeepLocalCount,
    proposedKeepRemoteCount,
    proposedMergeCount,
    uninspectedConflictsCount,
    executedResolutionsCount: 0 // Always 0
  };
}
