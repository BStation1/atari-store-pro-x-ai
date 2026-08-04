/**
 * Manual Sync Result State Tracker (Phase 2D Canary Mode)
 * @license Apache-2.0
 */

import { ManualSyncReport, ManualSyncStats } from './manualSyncTypes';

let lastReport: ManualSyncReport | null = null;
let stats: ManualSyncStats = {
  verifiedSyncCount: 0,
  failedSyncCount: 0,
  blockedSyncCount: 0
};

export function recordManualSyncReport(report: ManualSyncReport): void {
  lastReport = report;
  stats.lastManualSyncAt = report.executedAt;

  if (report.finalQueueStatus === 'Synced' && report.verificationResult === 'VERIFIED') {
    stats.verifiedSyncCount++;
  } else if (report.finalQueueStatus === 'Failed') {
    stats.failedSyncCount++;
  } else {
    stats.blockedSyncCount++;
  }
}

export function getLastManualSyncReport(): ManualSyncReport | null {
  return lastReport;
}

export function getManualSyncStats(): ManualSyncStats {
  return { ...stats };
}

export function resetManualSyncStats(): void {
  lastReport = null;
  stats = {
    verifiedSyncCount: 0,
    failedSyncCount: 0,
    blockedSyncCount: 0
  };
}
