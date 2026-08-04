/**
 * Customer Entity Validator (Phase 2C)
 * @license Apache-2.0
 */

import { SyncQueueItem } from '../syncTypes';
import { validateBaseItem, ValidationResult } from './baseValidator';

export function validateCustomerItem(item: SyncQueueItem): ValidationResult {
  const baseRes = validateBaseItem(item);
  if (!baseRes.valid) return baseRes;

  const reasons: string[] = [];

  if (item.payload) {
    if (!item.payload.name || typeof item.payload.name !== 'string') {
      reasons.push('Customer payload missing required field: name');
    }
  }

  return {
    valid: reasons.length === 0,
    reasons
  };
}
