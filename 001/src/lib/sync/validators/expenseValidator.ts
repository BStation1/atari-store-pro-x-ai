/**
 * Expense Entity Validator (Phase 2C)
 * @license Apache-2.0
 */

import { SyncQueueItem } from '../syncTypes';
import { validateBaseItem, ValidationResult } from './baseValidator';

export function validateExpenseItem(item: SyncQueueItem): ValidationResult {
  const baseRes = validateBaseItem(item);
  if (!baseRes.valid) return baseRes;

  const reasons: string[] = [];

  if (item.payload) {
    if (item.payload.amount === undefined) {
      reasons.push('Expense payload missing required field: amount');
    }
  }

  return {
    valid: reasons.length === 0,
    reasons
  };
}
