/**
 * Sync Queue Storage Manager
 * Uses dedicated local storage key 'atari_sync_queue'
 * @license Apache-2.0
 */

import { SyncQueueItem } from './syncTypes';

export const SYNC_QUEUE_STORAGE_KEY = 'atari_sync_queue';

export function loadQueueFromStorage(): SyncQueueItem[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(SYNC_QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('[SyncStorage] Failed loading sync queue:', err);
    return [];
  }
}

export function saveQueueToStorage(queue: SyncQueueItem[]): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(SYNC_QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error('[SyncStorage] Failed saving sync queue:', err);
  }
}

export function clearQueueStorage(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(SYNC_QUEUE_STORAGE_KEY);
  } catch (err) {
    console.error('[SyncStorage] Failed clearing sync queue:', err);
  }
}
