/**
 * Audit Logger & Hardened State Machine Validator for Phase 2G.1
 * @license Apache-2.0
 */

import { SyncStatus } from '../syncTypes';
import {
  AuditEvent,
  AuditEventType,
  AuditResult,
  StateTransitionContext,
  StateTransitionValidation
} from './auditTypes';
import { appendAuditEvent } from './auditStorage';

const correlationMap = new Map<string, string>();

export function getOrCreateCorrelationId(queueItemId: string): string {
  if (!correlationMap.has(queueItemId)) {
    const newId = `CORR-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    correlationMap.set(queueItemId, newId);
  }
  return correlationMap.get(queueItemId)!;
}

export function setCorrelationId(queueItemId: string, correlationId: string): void {
  correlationMap.set(queueItemId, correlationId);
}

/**
 * Hardened State Machine Transition Rules Engine (Phase 2G.1)
 */
export function validateTransition(
  previousState: SyncStatus | string | undefined,
  newState: SyncStatus | string,
  context?: StateTransitionContext
): StateTransitionValidation {
  // Initial state assignment (creation)
  if (!previousState) {
    if (newState === 'Pending') {
      const source = context?.source;
      if (
        source === 'QUEUE_CREATION' ||
        source === 'QUEUE_CREATED' ||
        source === 'User UI' ||
        source === 'System' ||
        !source
      ) {
        return { valid: true };
      }
      return {
        valid: false,
        reason: `REJECTED: Initial assignment to 'Pending' requires queue creation context.`
      };
    }
    return { valid: true };
  }

  // Same state no-op
  if (previousState === newState) {
    return { valid: true };
  }

  // Rule 10: Synced -> any state (FORBIDDEN ALWAYS)
  if (previousState === 'Synced') {
    return {
      valid: false,
      reason: `REJECTED: Terminal state violation. Items in 'Synced' state cannot transition to '${newState}'.`
    };
  }

  // Rule 9: Conflict -> Pending (FORBIDDEN ALWAYS)
  if (previousState === 'Conflict' && newState === 'Pending') {
    return {
      valid: false,
      reason: `REJECTED: Transition from 'Conflict' to 'Pending' is forbidden.`
    };
  }

  // Rule 8: Conflict -> Synced (Allowed ONLY if source == RESOLUTION_EXECUTION AND resolutionVerified == true)
  if (previousState === 'Conflict' && newState === 'Synced') {
    if (context?.source === 'RESOLUTION_EXECUTION' && context?.resolutionVerified === true) {
      return { valid: true };
    }
    return {
      valid: false,
      reason: `REJECTED: Transition 'Conflict' -> 'Synced' requires source='RESOLUTION_EXECUTION' and resolutionVerified=true.`
    };
  }

  // Rule 2: Pending -> Syncing (Allowed ONLY when source == MANUAL_SYNC or MANUAL_RETRY)
  if (previousState === 'Pending' && newState === 'Syncing') {
    const src = context?.source;
    if (src === 'MANUAL_SYNC' || src === 'MANUAL_RETRY') {
      return { valid: true };
    }
    return {
      valid: false,
      reason: `REJECTED: Transition 'Pending' -> 'Syncing' requires source='MANUAL_SYNC' or 'MANUAL_RETRY'.`
    };
  }

  // Rule 3: Syncing -> Synced (Allowed ONLY if resolutionVerified == true)
  if (previousState === 'Syncing' && newState === 'Synced') {
    if (context?.resolutionVerified === true) {
      return { valid: true };
    }
    return {
      valid: false,
      reason: `REJECTED: Transition 'Syncing' -> 'Synced' requires verification passed (resolutionVerified=true).`
    };
  }

  // Rule 4: Syncing -> Failed (Allowed on write or validation error)
  if (previousState === 'Syncing' && newState === 'Failed') {
    return { valid: true };
  }

  // Rule 5: Syncing -> Conflict (Allowed after proven remote conflict)
  if (previousState === 'Syncing' && newState === 'Conflict') {
    return { valid: true };
  }

  // Rule 6: Syncing -> Pending (Allowed ONLY if source == MANUAL_RECOVERY and recoveryApproved == true)
  if (previousState === 'Syncing' && newState === 'Pending') {
    if (context?.source === 'MANUAL_RECOVERY' && context?.recoveryApproved === true) {
      return { valid: true };
    }
    return {
      valid: false,
      reason: `REJECTED: Transition 'Syncing' -> 'Pending' requires source='MANUAL_RECOVERY' and recoveryApproved=true.`
    };
  }

  // Rule 7: Failed -> Pending (Allowed ONLY when source == MANUAL_RETRY)
  if (previousState === 'Failed' && newState === 'Pending') {
    if (context?.source === 'MANUAL_RETRY') {
      return { valid: true };
    }
    return {
      valid: false,
      reason: `REJECTED: Transition 'Failed' -> 'Pending' requires source='MANUAL_RETRY'.`
    };
  }

  return {
    valid: false,
    reason: `REJECTED: Illegal transition from '${previousState}' to '${newState}'.`
  };
}

export interface LogEventParams {
  correlationId?: string;
  queueItemId: string;
  entityType: string;
  entityId: string;
  operation: string;
  eventType: AuditEventType;
  previousState?: SyncStatus | string;
  newState?: SyncStatus | string;
  actor?: string;
  result?: AuditResult;
  durationMs?: number;
  metadata?: Record<string, any>;
  transitionContext?: StateTransitionContext;
}

export function logAuditEvent(params: LogEventParams): AuditEvent {
  const correlationId = params.correlationId || getOrCreateCorrelationId(params.queueItemId);

  // Validate state transition if transition states are present
  if (params.previousState && params.newState) {
    const context: StateTransitionContext = params.transitionContext || {
      actor: params.actor,
      correlationId,
      source: params.metadata?.source || (params.eventType as string)
    };

    const transitionCheck = validateTransition(params.previousState, params.newState, context);

    if (!transitionCheck.valid) {
      console.warn(`[Audit State Machine Violation] ${transitionCheck.reason}`);

      // Log STATE_TRANSITION_REJECTED event with safe minimal metadata
      return appendAuditEvent({
        eventId: `AUDIT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        correlationId,
        timestamp: new Date().toISOString(),
        queueItemId: params.queueItemId,
        entityType: params.entityType,
        entityId: params.entityId,
        operation: params.operation,
        eventType: 'STATE_TRANSITION_REJECTED',
        previousState: params.previousState,
        newState: params.newState,
        actor: params.actor || 'System Engine',
        result: 'REJECTED',
        durationMs: params.durationMs,
        metadata: {
          requestedPreviousState: params.previousState,
          requestedNewState: params.newState,
          reason: transitionCheck.reason,
          source: context.source
        }
      });
    }
  }

  return appendAuditEvent({
    eventId: `AUDIT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    correlationId,
    timestamp: new Date().toISOString(),
    queueItemId: params.queueItemId,
    entityType: params.entityType,
    entityId: params.entityId,
    operation: params.operation,
    eventType: params.eventType,
    previousState: params.previousState,
    newState: params.newState,
    actor: params.actor || 'System Engine',
    result: params.result || 'SUCCESS',
    durationMs: params.durationMs,
    metadata: params.metadata
  });
}
