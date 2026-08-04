/**
 * Immutable Audit Storage & Hash Chain Linker for Phase 2G.1
 * Independent storage layer for Audit Events. Strictly append-only.
 * Prevents mutation or deletion of logged events.
 * @license Apache-2.0
 */

import { AuditEvent } from './auditTypes';
import { deepClone, deepFreeze } from './deepFreeze';
import { computeEventHash } from './auditHasher';

const STORAGE_KEY_AUDIT_LOGS = 'atari_sync_audit_events_v2';

let memoryAuditLogs: AuditEvent[] = [];

function isLocalStorageAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function loadLogsFromStorage(): void {
  if (!isLocalStorageAvailable()) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AUDIT_LOGS);
    if (raw) {
      const parsed: any[] = JSON.parse(raw);
      memoryAuditLogs = parsed.map(e => {
        // Handle legacy events without hash chain fields
        if (typeof e.sequenceNumber !== 'number' || !e.eventHash || !e.previousEventHash) {
          const legacyEvent: AuditEvent = deepFreeze({
            ...e,
            sequenceNumber: e.sequenceNumber || 0,
            previousEventHash: e.previousEventHash || 'LEGACY_UNVERIFIED',
            eventHash: e.eventHash || 'LEGACY_UNVERIFIED',
            schemaVersion: e.schemaVersion || '1.0',
            isLegacyUnverified: true
          });
          return legacyEvent;
        }
        return deepFreeze(deepClone(e));
      });
    }
  } catch (err) {
    console.error('Failed to load audit logs from storage:', err);
  }
}

function saveLogsToStorage(): void {
  if (!isLocalStorageAvailable()) return;
  try {
    localStorage.setItem(STORAGE_KEY_AUDIT_LOGS, JSON.stringify(memoryAuditLogs));
  } catch (err) {
    console.error('Failed to save audit logs to storage:', err);
  }
}

// Initial load
loadLogsFromStorage();

/**
 * Append a new audit event to the tamper-evident hash chain.
 * Assigns sequenceNumber, previousEventHash, schemaVersion, computes eventHash,
 * applies deepClone & deepFreeze, and appends to storage.
 */
export function appendAuditEvent(eventParams: Omit<AuditEvent, 'sequenceNumber' | 'previousEventHash' | 'eventHash' | 'schemaVersion'>): AuditEvent {
  loadLogsFromStorage();

  const lastVerifiedEvent = [...memoryAuditLogs].reverse().find(e => !e.isLegacyUnverified);

  const sequenceNumber = lastVerifiedEvent ? lastVerifiedEvent.sequenceNumber + 1 : 1;
  const previousEventHash = lastVerifiedEvent ? lastVerifiedEvent.eventHash : 'GENESIS';
  const schemaVersion = '2G.1';

  // Deep clone input metadata to prevent caller reference retention
  const clonedMetadata = eventParams.metadata ? deepClone(eventParams.metadata) : undefined;

  const eventDraft: Partial<AuditEvent> = {
    ...eventParams,
    metadata: clonedMetadata,
    sequenceNumber,
    previousEventHash,
    schemaVersion
  };

  const eventHash = computeEventHash(eventDraft);

  const fullEvent: AuditEvent = deepFreeze({
    ...eventDraft,
    eventHash
  } as AuditEvent);

  memoryAuditLogs.push(fullEvent);
  saveLogsToStorage();

  // Return deep-cloned frozen copy
  return deepFreeze(deepClone(fullEvent));
}

/**
 * Directly append a fully formed event (useful for test harnesses or marker events).
 */
export function appendRawAuditEvent(rawEvent: AuditEvent): AuditEvent {
  loadLogsFromStorage();
  const frozen = deepFreeze(deepClone(rawEvent));
  memoryAuditLogs.push(frozen);
  saveLogsToStorage();
  return deepFreeze(deepClone(frozen));
}

/**
 * Get deep-cloned, frozen copies of all audit events.
 * Prevents callers from mutating internal storage pointers or cached objects.
 */
export function getAllAuditEvents(): AuditEvent[] {
  loadLogsFromStorage();
  return memoryAuditLogs.map(e => deepFreeze(deepClone(e)));
}

/**
 * Attempting to update an audit event is strictly REJECTED.
 */
export function updateAuditEvent(_eventId: string, _updates: Partial<AuditEvent>): { success: false; error: string } {
  return {
    success: false,
    error: 'REJECTED: Audit logs are strictly immutable. Updating audit events is forbidden.'
  };
}

/**
 * Attempting to delete an audit event is strictly REJECTED.
 */
export function deleteAuditEvent(_eventId: string): { success: false; error: string } {
  return {
    success: false,
    error: 'REJECTED: Audit logs are strictly immutable. Deleting audit events is forbidden.'
  };
}

/**
 * Helper strictly for testing harness reset in memory and storage.
 */
export function clearAuditLogsMemoryOnly(): void {
  memoryAuditLogs = [];
  if (isLocalStorageAvailable()) {
    try {
      localStorage.removeItem(STORAGE_KEY_AUDIT_LOGS);
    } catch {
      // ignore
    }
  }
}
