/**
 * Retry History Storage & Metrics (Phase 2E)
 * @license Apache-2.0
 */

import { RetryHistoryEntry } from './retryTypes';

const RETRY_HISTORY_STORAGE_KEY = 'atari_sync_retry_history_v1';

let memoryHistory: RetryHistoryEntry[] = loadHistoryFromStorage();

function loadHistoryFromStorage(): RetryHistoryEntry[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = localStorage.getItem(RETRY_HISTORY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistoryToStorage(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    localStorage.setItem(RETRY_HISTORY_STORAGE_KEY, JSON.stringify(memoryHistory));
  } catch (err) {
    console.error('Failed to save retry history to storage:', err);
  }
}

export function recordRetryHistory(entry: RetryHistoryEntry): void {
  memoryHistory.unshift(entry);
  saveHistoryToStorage();
}

export function getRetryHistoryForItem(queueItemId: string): RetryHistoryEntry[] {
  return memoryHistory.filter(h => h.queueItemId === queueItemId);
}

export function getAllRetryHistory(): RetryHistoryEntry[] {
  return [...memoryHistory];
}

export function getVerifiedAfterRetryCount(): number {
  return memoryHistory.filter(h => h.result === 'RESOLVED_EXISTING' || (h.result === 'SUCCESS' && h.verificationResult === 'VERIFIED')).length;
}

export function getAverageRetryDurationMs(): number {
  if (memoryHistory.length === 0) return 0;
  const total = memoryHistory.reduce((sum, h) => sum + h.durationMs, 0);
  return Math.round(total / memoryHistory.length);
}

export function clearRetryHistory(): void {
  memoryHistory = [];
  saveHistoryToStorage();
}
