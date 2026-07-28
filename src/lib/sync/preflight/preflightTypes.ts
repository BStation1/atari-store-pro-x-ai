/**
 * Remote Preflight Types (Phase 2D0)
 * @license Apache-2.0
 */

import { SyncQueueItem } from '../syncTypes';

export type PreflightStatus = 'READY_TO_SYNC' | 'REMOTE_MATCH' | 'REMOTE_CONFLICT' | 'REMOTE_NOT_CHECKED';

export interface PreflightResult {
  entityType: string;
  entityId: string;
  queueSequence?: number;
  queueVersion: number;
  queuePayloadHash: string;
  remoteExists: boolean;
  remotePayloadHash?: string;
  status: PreflightStatus;
  reason: string;
  checkedAt: string;
  remoteData?: any;
}

export interface PreflightSummaryReport {
  totalChecked: number;
  readyToSyncCount: number;
  remoteMatchCount: number;
  remoteConflictCount: number;
  remoteNotCheckedCount: number;
  results: PreflightResult[];
  generatedAt: string;
}
