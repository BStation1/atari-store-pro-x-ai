/**
 * Manual Retry Policy Engine (Phase 2E)
 * Evaluates queue item eligibility for manual retry.
 * @license Apache-2.0
 */

import { SyncQueueItem } from '../syncTypes';
import { runPreflight } from '../preflight/preflight';
import { RetryPolicyCheckResult } from './retryTypes';

export async function evaluateRetryPolicy(
  item: SyncQueueItem,
  userConfirmed: boolean = false
): Promise<RetryPolicyCheckResult> {
  // Rule 2: Allowed ONLY if Queue Status == Failed
  if (item.status !== 'Failed') {
    return {
      allowed: false,
      decision: 'BLOCK_RETRY',
      blockReason: 'NOT_FAILED',
      message: `Retry blocked: Item status is '${item.status}', must be 'Failed'`
    };
  }

  // Rule 6: High retry count warning (retryCount >= 5)
  if (item.retryCount >= 5 && !userConfirmed) {
    return {
      allowed: false,
      decision: 'REQUIRE_USER_CONFIRMATION',
      blockReason: 'HIGH_RETRY_COUNT',
      requiresUserConfirmation: true,
      message: `HIGH_RETRY_COUNT: Item retryCount is ${item.retryCount}. Manual confirmation required before proceeding.`
    };
  }

  // Rule 3: Always execute runPreflight(queueItem)
  const preflight = await runPreflight(item);

  if (preflight.status === 'REMOTE_MATCH') {
    return {
      allowed: true,
      decision: 'ALLOW_RETRY',
      preflightStatus: preflight.status,
      message: 'REMOTE_MATCH detected: Remote record already exists and matches local payload. Item will be marked Synced (VERIFIED_AFTER_RETRY) without remote write.',
      resolvedStatus: 'Synced'
    };
  }

  if (preflight.status === 'REMOTE_CONFLICT') {
    return {
      allowed: false,
      decision: 'BLOCK_RETRY',
      preflightStatus: preflight.status,
      blockReason: 'REMOTE_CONFLICT',
      message: 'REMOTE_CONFLICT detected: Local payload conflicts with existing remote record. Retry blocked and item marked as Conflict.',
      resolvedStatus: 'Conflict'
    };
  }

  if (preflight.status === 'REMOTE_NOT_CHECKED') {
    return {
      allowed: false,
      decision: 'BLOCK_RETRY',
      preflightStatus: preflight.status,
      blockReason: 'REMOTE_NOT_CHECKED',
      message: `REMOTE_NOT_CHECKED: Unable to verify remote record before retry (${preflight.reason}). Retry blocked.`
    };
  }

  if (preflight.status !== 'READY_TO_SYNC') {
    return {
      allowed: false,
      decision: 'BLOCK_RETRY',
      preflightStatus: preflight.status,
      blockReason: 'UNKNOWN',
      message: `Preflight blocked retry: Status is '${preflight.status}' (${preflight.reason})`
    };
  }

  return {
    allowed: true,
    decision: 'ALLOW_RETRY',
    preflightStatus: preflight.status,
    message: 'Preflight READY_TO_SYNC. Manual retry authorized.'
  };
}
