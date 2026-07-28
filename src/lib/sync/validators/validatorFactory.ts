/**
 * Validator Factory & Dry-Run Simulator (Phase 2C)
 * @license Apache-2.0
 */

import { SyncQueueItem } from '../syncTypes';
import { ValidationResult } from './baseValidator';
import { validateCustomerItem } from './customerValidator';
import { validateRepairOrderItem } from './repairOrderValidator';
import { validateInvoiceItem } from './invoiceValidator';
import { validateProductItem } from './productValidator';
import { validateExpenseItem } from './expenseValidator';

export interface SyncSimulationResult {
  status: 'READY' | 'INVALID';
  reasons: string[];
  item: SyncQueueItem;
}

export function validateQueueItem(item: SyncQueueItem): ValidationResult {
  if (!item) {
    return { valid: false, reasons: ['Queue item is null or undefined'] };
  }

  switch (item.entityType) {
    case 'Customer':
      return validateCustomerItem(item);
    case 'RepairOrder':
      return validateRepairOrderItem(item);
    case 'Invoice':
      return validateInvoiceItem(item);
    case 'Product':
      return validateProductItem(item);
    case 'Expense':
      return validateExpenseItem(item);
    default:
      return { valid: false, reasons: [`Unknown or unsupported entityType: '${item.entityType}'`] };
  }
}

/**
 * Dry-run simulation helper for Phase 2C.
 * Does NOT contact external services or mutate queue state.
 */
export function simulateSync(queueItem: SyncQueueItem): SyncSimulationResult {
  const validation = validateQueueItem(queueItem);
  return {
    status: validation.valid ? 'READY' : 'INVALID',
    reasons: validation.reasons,
    item: queueItem
  };
}
