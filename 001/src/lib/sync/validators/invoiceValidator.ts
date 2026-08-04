/**
 * Invoice Entity Validator (Phase 2C)
 * @license Apache-2.0
 */

import { SyncQueueItem } from '../syncTypes';
import { validateBaseItem, ValidationResult } from './baseValidator';

export function validateInvoiceItem(item: SyncQueueItem): ValidationResult {
  const baseRes = validateBaseItem(item);
  if (!baseRes.valid) return baseRes;

  const reasons: string[] = [];

  if (item.payload) {
    if (item.payload.totalAmount === undefined && item.payload.total === undefined) {
      reasons.push('Invoice payload missing required field: totalAmount / total');
    }
  }

  return {
    valid: reasons.length === 0,
    reasons
  };
}
