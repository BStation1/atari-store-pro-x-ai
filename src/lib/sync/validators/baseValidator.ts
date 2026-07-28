/**
 * Base Validator & Payload Hash Utilities (Phase 2C)
 * @license Apache-2.0
 */

import { SyncQueueItem } from '../syncTypes';

export interface ValidationResult {
  valid: boolean;
  reasons: string[];
}

/**
 * Computes a deterministic string hash for payload verification.
 */
export function computePayloadHash(payload: any): string {
  if (payload === undefined || payload === null) return 'HASH_EMPTY_PAYLOAD';
  try {
    const str = typeof payload === 'string' ? payload : JSON.stringify(payload, Object.keys(payload).sort());
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32bit integer
    }
    return `PH-${Math.abs(hash).toString(16).toUpperCase()}`;
  } catch (err) {
    return 'HASH_COMPUTE_ERROR';
  }
}

export const SUPPORTED_SYNC_VERSION = 1;
export const VALID_ENTITY_TYPES = ['Customer', 'RepairOrder', 'Invoice', 'Product', 'Expense'];
export const VALID_OPERATIONS = ['CREATE', 'UPDATE', 'DELETE'];

export function validateBaseItem(item: SyncQueueItem): ValidationResult {
  const reasons: string[] = [];

  if (!item) {
    return { valid: false, reasons: ['Queue item is null or undefined'] };
  }

  // 1. entityId check
  if (!item.entityId || typeof item.entityId !== 'string' || item.entityId.trim() === '') {
    reasons.push('entityId is missing or invalid');
  }

  // 2. entityType check
  if (!item.entityType || !VALID_ENTITY_TYPES.includes(item.entityType)) {
    reasons.push(`entityType '${item.entityType}' is invalid or unsupported`);
  }

  // 3. operation check
  if (!item.operation || !VALID_OPERATIONS.includes(item.operation)) {
    reasons.push(`operation '${item.operation}' is invalid`);
  }

  // 4. createdAt check
  if (!item.createdAt || isNaN(Date.parse(item.createdAt))) {
    reasons.push('createdAt timestamp is missing or invalid');
  }

  // 5. updatedAt check
  if (!item.updatedAt || isNaN(Date.parse(item.updatedAt))) {
    reasons.push('updatedAt timestamp is missing or invalid');
  }

  // 6. payloadHash check
  if (!item.payloadHash || typeof item.payloadHash !== 'string' || item.payloadHash.trim() === '') {
    reasons.push('payloadHash is missing or empty');
  } else if (item.payload) {
    // Hash verification check
    const recomputedHash = computePayloadHash(item.payload);
    if (item.payloadHash !== recomputedHash) {
      reasons.push(`Payload Hash Mismatch (Expected: ${item.payloadHash}, Computed: ${recomputedHash})`);
    }
  }

  // 7. idempotencyKey check
  if (!item.idempotencyKey || typeof item.idempotencyKey !== 'string' || item.idempotencyKey.trim() === '') {
    reasons.push('idempotencyKey is missing or empty');
  }

  // 8. origin check
  if (!item.origin || typeof item.origin !== 'string' || item.origin.trim() === '') {
    reasons.push('origin is missing or empty');
  }

  // 9. version check
  if (item.version !== SUPPORTED_SYNC_VERSION) {
    reasons.push(`Unsupported version '${item.version}'. Supported version is ${SUPPORTED_SYNC_VERSION}`);
  }

  // 10. status check
  if (item.status !== 'Pending') {
    reasons.push(`Invalid status '${item.status}'. Only 'Pending' items can be validated for sync readiness`);
  }

  return {
    valid: reasons.length === 0,
    reasons
  };
}
