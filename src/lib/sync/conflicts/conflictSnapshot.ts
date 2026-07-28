/**
 * Snapshot Capture and Sanitization (Phase 2F-A)
 * @license Apache-2.0
 */

import { SyncQueueItem } from '../syncTypes';
import { maskSensitiveValue } from './conflictDiff';

/**
 * Creates a clean local snapshot from queue item payload.
 */
export function createLocalSnapshot(item: SyncQueueItem): Record<string, any> | null {
  if (!item || !item.payload) return null;
  return JSON.parse(JSON.stringify(item.payload));
}

/**
 * Creates a clean remote snapshot from database record.
 */
export function createRemoteSnapshot(remoteData: any): Record<string, any> | null {
  if (!remoteData || typeof remoteData !== 'object') return null;
  return JSON.parse(JSON.stringify(remoteData));
}

/**
 * Recursively masks sensitive fields inside a snapshot object before persisting.
 */
export function sanitizeSnapshotForHistory(snapshot: Record<string, any> | null): Record<string, any> | null {
  if (!snapshot) return null;

  function traverseAndMask(obj: any, pathPrefix: string = ''): any {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) {
      return obj.map((item, idx) => traverseAndMask(item, `${pathPrefix}[${idx}]`));
    }
    if (typeof obj === 'object') {
      const sanitized: Record<string, any> = {};
      for (const [key, val] of Object.entries(obj)) {
        const currentPath = pathPrefix ? `${pathPrefix}.${key}` : key;
        if (typeof val === 'object' && val !== null) {
          sanitized[key] = traverseAndMask(val, currentPath);
        } else {
          sanitized[key] = maskSensitiveValue(currentPath, val);
        }
      }
      return sanitized;
    }
    return maskSensitiveValue(pathPrefix, obj);
  }

  return traverseAndMask(snapshot);
}
