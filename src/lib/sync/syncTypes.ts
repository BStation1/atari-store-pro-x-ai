/**
 * Background Sync Queue Types & Interfaces (Phase 2A)
 * @license Apache-2.0
 */

export type SyncEntityType = 'Customer' | 'RepairOrder' | 'Invoice' | 'Product' | 'Expense';

export type SyncStatus = 'Pending' | 'Syncing' | 'Synced' | 'Failed' | 'Conflict';

export type SyncOperation = 'CREATE' | 'UPDATE' | 'DELETE';

export interface SyncQueueItem {
  id: string;
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  createdAt: string;
  updatedAt: string;
  retryCount: number;
  lastError?: string;
  status: SyncStatus;
  payloadHash?: string;
  payload?: any;
  origin: string;
  version: number;
  idempotencyKey: string;
  sequenceNumber?: number;
  retryReason?: string;
  lastSyncResult?: string;
  syncedAt?: string;
  remoteId?: string;
  failedAt?: string;
}

export interface SyncStats {
  pending: number;
  syncing: number;
  synced: number;
  failed: number;
  total: number;
  byEntity: {
    Customer: number;
    RepairOrder: number;
    Invoice: number;
    Product: number;
    Expense: number;
  };
}
