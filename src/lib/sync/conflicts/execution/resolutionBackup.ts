/**
 * Resolution Local Backup Management (Phase 2F-B)
 * Creates and persists local pre-execution backups. Backups are NEVER deleted.
 * @license Apache-2.0
 */

import { ResolutionBackupRecord } from './resolutionTypes';

const STORAGE_KEY_BACKUPS = 'atari_sync_resolution_backups_v1';

let memoryBackups: Map<string, ResolutionBackupRecord> = new Map();

function isLocalStorageAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function loadBackupsFromStorage(): void {
  if (!isLocalStorageAvailable()) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BACKUPS);
    if (raw) {
      const parsed: ResolutionBackupRecord[] = JSON.parse(raw);
      memoryBackups = new Map(parsed.map(b => [b.backupId, b]));
    }
  } catch (err) {
    console.error('Failed to load resolution backups from storage:', err);
  }
}

function saveBackupsToStorage(): void {
  if (!isLocalStorageAvailable()) return;
  try {
    localStorage.setItem(STORAGE_KEY_BACKUPS, JSON.stringify(Array.from(memoryBackups.values())));
  } catch (err) {
    console.error('Failed to save resolution backups to storage:', err);
  }
}

// Initial load
loadBackupsFromStorage();

export function createResolutionBackup(
  queueItemId: string,
  entityId: string,
  localSnapshot: Record<string, any> | null,
  remoteSnapshot: Record<string, any> | null
): ResolutionBackupRecord {
  loadBackupsFromStorage();

  const backupId = `BACKUP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const record: ResolutionBackupRecord = {
    backupId,
    queueItemId,
    entityId,
    localSnapshot: localSnapshot ? JSON.parse(JSON.stringify(localSnapshot)) : null,
    remoteSnapshot: remoteSnapshot ? JSON.parse(JSON.stringify(remoteSnapshot)) : null,
    createdAt: new Date().toISOString()
  };

  memoryBackups.set(backupId, record);
  saveBackupsToStorage();
  return record;
}

export function getResolutionBackup(backupId: string): ResolutionBackupRecord | null {
  loadBackupsFromStorage();
  return memoryBackups.get(backupId) || null;
}

export function getResolutionBackupForQueueItem(queueItemId: string): ResolutionBackupRecord | null {
  loadBackupsFromStorage();
  const all = Array.from(memoryBackups.values());
  return all.find(b => b.queueItemId === queueItemId) || null;
}

export function getAllResolutionBackups(): ResolutionBackupRecord[] {
  loadBackupsFromStorage();
  return Array.from(memoryBackups.values());
}

export function clearResolutionBackupsMemoryOnly(): void {
  memoryBackups.clear();
  if (isLocalStorageAvailable()) {
    try {
      localStorage.removeItem(STORAGE_KEY_BACKUPS);
    } catch {
      // ignore
    }
  }
}
