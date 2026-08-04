/**
 * Canary Conflict Resolution Execution Types (Phase 2F-B)
 * @license Apache-2.0
 */

export interface ResolutionBackupRecord {
  backupId: string;
  queueItemId: string;
  entityId: string;
  localSnapshot: Record<string, any> | null;
  remoteSnapshot: Record<string, any> | null;
  createdAt: string;
}

export interface ResolutionVerificationResult {
  passed: boolean;
  localHashBefore: string;
  remoteHashBefore: string;
  localHashAfter: string;
  remoteHashAfter: string;
  message: string;
}

export interface ResolutionExecutionReport {
  success: boolean;
  queueItemId: string;
  conflictId: string;
  status: 'RESOLVED' | 'BLOCKED' | 'FAILED';
  blockedReason?: string;
  failureReason?: string;
  backupId?: string;
  backup?: ResolutionBackupRecord;
  verification?: ResolutionVerificationResult;
  hashesBefore?: { local: string; remote: string };
  hashesAfter?: { local: string; remote: string };
  executionDurationMs: number;
  executedAt: string;
}
