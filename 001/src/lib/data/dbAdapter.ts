/**
 * Engine Adapter Facade
 * Provides unified adapter access to db operational logic.
 * @license Apache-2.0
 */

import { db } from '../db';
import { syncQueue } from '../sync/syncQueue';

export function getPendingSyncEstimate(): number {
  try {
    return syncQueue.getStats().pending;
  } catch (e) {
    console.error('Error getting sync queue stats:', e);
    return 0;
  }
}

export { db as dataDb, db };
