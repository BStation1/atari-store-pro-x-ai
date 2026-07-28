/**
 * Conflict Storage and Audit History (Phase 2F-A)
 * Managed separately from Sync Queue.
 * @license Apache-2.0
 */

import {
  ConflictRecord,
  ConflictHistoryEntry,
  ResolutionPlan
} from './conflictTypes';

const STORAGE_KEYS = {
  RECORDS: 'atari_sync_conflict_records_v1',
  HISTORY: 'atari_sync_conflict_history_v1',
  PLANS: 'atari_sync_conflict_plans_v1'
};

// In-memory caches with storage synchronization
let memoryRecords: Map<string, ConflictRecord> = new Map();
let memoryHistory: ConflictHistoryEntry[] = [];
let memoryPlans: Map<string, ResolutionPlan> = new Map();

function isLocalStorageAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function loadFromStorage(): void {
  if (!isLocalStorageAvailable()) return;

  try {
    const rawRecs = localStorage.getItem(STORAGE_KEYS.RECORDS);
    if (rawRecs) {
      const parsed: ConflictRecord[] = JSON.parse(rawRecs);
      memoryRecords = new Map(parsed.map(r => [r.queueItemId, r]));
    }

    const rawHist = localStorage.getItem(STORAGE_KEYS.HISTORY);
    if (rawHist) {
      memoryHistory = JSON.parse(rawHist);
    }

    const rawPlans = localStorage.getItem(STORAGE_KEYS.PLANS);
    if (rawPlans) {
      const parsed: ResolutionPlan[] = JSON.parse(rawPlans);
      memoryPlans = new Map(parsed.map(p => [p.queueItemId, p]));
    }
  } catch (err) {
    console.error('Failed to load conflict storage from localStorage:', err);
  }
}

function saveToStorage(): void {
  if (!isLocalStorageAvailable()) return;

  try {
    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(Array.from(memoryRecords.values())));
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(memoryHistory));
    localStorage.setItem(STORAGE_KEYS.PLANS, JSON.stringify(Array.from(memoryPlans.values())));
  } catch (err) {
    console.error('Failed to save conflict storage to localStorage:', err);
  }
}

// Initial load
loadFromStorage();

// Conflict Records Management
export function saveConflictRecord(record: ConflictRecord): void {
  memoryRecords.set(record.queueItemId, record);
  saveToStorage();
}

export function getConflictRecordForItem(queueItemId: string): ConflictRecord | null {
  loadFromStorage();
  return memoryRecords.get(queueItemId) || null;
}

export function getAllConflictRecords(): ConflictRecord[] {
  loadFromStorage();
  return Array.from(memoryRecords.values());
}

// Resolution Plans Management
export function saveResolutionPlan(plan: ResolutionPlan): void {
  memoryPlans.set(plan.queueItemId, plan);
  saveToStorage();
}

export function getResolutionPlanForItem(queueItemId: string): ResolutionPlan | null {
  loadFromStorage();
  return memoryPlans.get(queueItemId) || null;
}

export function getAllResolutionPlans(): ResolutionPlan[] {
  loadFromStorage();
  return Array.from(memoryPlans.values());
}

// Conflict History Management
export function recordConflictHistory(entry: ConflictHistoryEntry): void {
  memoryHistory.unshift(entry);
  saveToStorage();
}

export function getConflictHistoryForItem(queueItemId: string): ConflictHistoryEntry[] {
  loadFromStorage();
  return memoryHistory.filter(h => h.queueItemId === queueItemId);
}

export function getAllConflictHistory(): ConflictHistoryEntry[] {
  loadFromStorage();
  return [...memoryHistory];
}

export function clearConflictStorageMemoryOnly(): void {
  memoryRecords.clear();
  memoryHistory = [];
  memoryPlans.clear();
  if (isLocalStorageAvailable()) {
    try {
      localStorage.removeItem(STORAGE_KEYS.RECORDS);
      localStorage.removeItem(STORAGE_KEYS.HISTORY);
      localStorage.removeItem(STORAGE_KEYS.PLANS);
    } catch {
      // ignore
    }
  }
}
