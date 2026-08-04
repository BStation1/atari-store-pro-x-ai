/**
 * Sync Queue API
 * Manages enqueueing, state transitions, retry counters, and queue inspections.
 * @license Apache-2.0
 */

import { SyncQueueItem, SyncStats, SyncEntityType, SyncOperation } from './syncTypes';
import { loadQueueFromStorage, saveQueueToStorage } from './syncStorage';
import { computeSyncStats } from './syncStatus';
import { computePayloadHash } from './validators/baseValidator';

class SyncQueueManager {
  private queue: SyncQueueItem[] = [];

  constructor() {
    this.queue = loadQueueFromStorage();
  }

  private persist(): void {
    saveQueueToStorage(this.queue);
  }

  public enqueue(item: {
    entityType: SyncEntityType;
    entityId: string;
    operation: SyncOperation;
    payloadHash?: string;
    payload?: any;
    origin?: string;
    version?: number;
    idempotencyKey?: string;
  }): SyncQueueItem {
    const key = item.idempotencyKey || `${item.entityType}:${item.entityId}:${item.operation}`;

    // Check if an item with matching idempotencyKey already exists in Queue
    const existing = this.queue.find(i => i.idempotencyKey === key);
    if (existing) {
      console.log(`[SyncQueue] Idempotency match found for key '${key}'. Skipping duplicate insertion.`);
      return existing;
    }

    const hash = item.payloadHash || computePayloadHash(item.payload);
    const maxSeq = this.queue.reduce((max, q) => Math.max(max, q.sequenceNumber || 0), 0);

    const now = new Date().toISOString();
    const newItem: SyncQueueItem = {
      id: `SYNC-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      entityType: item.entityType,
      entityId: item.entityId,
      operation: item.operation,
      createdAt: now,
      updatedAt: now,
      retryCount: 0,
      status: 'Pending',
      lastError: undefined,
      payloadHash: hash,
      payload: item.payload,
      origin: item.origin || 'System',
      version: item.version || 1,
      idempotencyKey: key,
      sequenceNumber: maxSeq + 1
    };

    this.queue.push(newItem);
    this.persist();
    return newItem;
  }

  public dequeue(): SyncQueueItem | undefined {
    const item = this.queue.shift();
    if (item) {
      this.persist();
    }
    return item;
  }

  public peek(): SyncQueueItem | undefined {
    return this.queue.find(i => i.status === 'Pending');
  }

  public getItem(id: string): SyncQueueItem | undefined {
    return this.queue.find(i => i.id === id);
  }

  public atomicMarkSyncing(id: string): boolean {
    const item = this.queue.find(i => i.id === id);
    if (item && item.status === 'Pending') {
      item.status = 'Syncing';
      item.updatedAt = new Date().toISOString();
      this.persist();
      return true;
    }
    return false;
  }

  public detectStaleSyncingItems(maxAgeMinutes: number = 5): SyncQueueItem[] {
    const cutoffMs = Date.now() - maxAgeMinutes * 60 * 1000;
    return this.queue.filter(item => {
      if (item.status !== 'Syncing') return false;
      const updatedTime = new Date(item.updatedAt).getTime();
      return updatedTime < cutoffMs;
    });
  }

  public markPending(id: string): void {
    const item = this.queue.find(i => i.id === id);
    if (item) {
      item.status = 'Pending';
      item.updatedAt = new Date().toISOString();
      this.persist();
    }
  }

  public markSyncing(id: string): void {
    const item = this.queue.find(i => i.id === id);
    if (item) {
      item.status = 'Syncing';
      item.updatedAt = new Date().toISOString();
      this.persist();
    }
  }

  public markSynced(id: string): void {
    const item = this.queue.find(i => i.id === id);
    if (item) {
      item.status = 'Synced';
      item.updatedAt = new Date().toISOString();
      this.persist();
    }
  }

  public updateStatus(id: string, newStatus: any): void {
    const item = this.queue.find(i => i.id === id);
    if (item) {
      item.status = newStatus;
      item.updatedAt = new Date().toISOString();
      this.persist();
    }
  }

  public markFailed(id: string, error?: string): void {
    const item = this.queue.find(i => i.id === id);
    if (item) {
      item.status = 'Failed';
      item.lastError = error || 'Unknown sync error';
      item.updatedAt = new Date().toISOString();
      this.persist();
    }
  }

  public markConflict(id: string, reason?: string): void {
    const item = this.queue.find(i => i.id === id);
    if (item) {
      item.status = 'Conflict';
      if (reason) item.lastError = reason;
      item.updatedAt = new Date().toISOString();
      this.persist();
    }
  }

  public updatePayload(id: string, newPayload: any): void {
    const item = this.queue.find(i => i.id === id);
    if (item) {
      item.payload = newPayload;
      item.payloadHash = computePayloadHash(newPayload);
      item.updatedAt = new Date().toISOString();
      this.persist();
    }
  }

  public incrementRetry(id: string): void {
    const item = this.queue.find(i => i.id === id);
    if (item) {
      item.retryCount = (item.retryCount || 0) + 1;
      item.updatedAt = new Date().toISOString();
      this.persist();
    }
  }

  public clearSynced(): void {
    this.queue = this.queue.filter(i => i.status !== 'Synced');
    this.persist();
  }

  public clearAll(): void {
    this.queue = [];
    this.persist();
  }

  public list(): SyncQueueItem[] {
    return [...this.queue];
  }

  public getStats(): SyncStats {
    return computeSyncStats(this.queue);
  }

  public refresh(): void {
    this.queue = loadQueueFromStorage();
  }
}

export const syncQueue = new SyncQueueManager();
