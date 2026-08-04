/**
 * Repair Order Entity Validator (Phase 2C)
 * @license Apache-2.0
 */

import { SyncQueueItem } from '../syncTypes';
import { validateBaseItem, ValidationResult } from './baseValidator';

export function validateRepairOrderItem(item: SyncQueueItem): ValidationResult {
  const baseRes = validateBaseItem(item);
  if (!baseRes.valid) return baseRes;

  const reasons: string[] = [];

  if (item.payload) {
    if (!item.payload.customerId) {
      reasons.push('RepairOrder payload missing required field: customerId');
    }
  }

  return {
    valid: reasons.length === 0,
    reasons
  };
}
