/**
 * Sync Queue Status & Metrics Helper
 * @license Apache-2.0
 */

import { SyncQueueItem, SyncStats } from './syncTypes';

export function computeSyncStats(items: SyncQueueItem[]): SyncStats {
  const stats: SyncStats = {
    pending: 0,
    syncing: 0,
    synced: 0,
    failed: 0,
    total: items.length,
    byEntity: {
      Customer: 0,
      RepairOrder: 0,
      Invoice: 0,
      Product: 0,
      Expense: 0
    }
  };

  items.forEach(item => {
    switch (item.status) {
      case 'Pending':
        stats.pending++;
        if (stats.byEntity[item.entityType] !== undefined) {
          stats.byEntity[item.entityType]++;
        }
        break;
      case 'Syncing':
        stats.syncing++;
        break;
      case 'Synced':
        stats.synced++;
        break;
      case 'Failed':
        stats.failed++;
        break;
    }
  });

  return stats;
}
