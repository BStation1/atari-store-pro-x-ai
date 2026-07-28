/**
 * Remote Data Comparator (Phase 2D0)
 * Evaluates match vs conflict between local queue payload and remote record.
 * Ignores system metadata fields (updatedAt, created_at, user_id, etc.).
 * @license Apache-2.0
 */

import { computePayloadHash } from '../validators/baseValidator';

export interface ComparisonResult {
  isMatch: boolean;
  remoteComputedHash?: string;
  diffFields: string[];
}

/**
 * Fields to exclude from payload comparison
 */
const METADATA_FIELDS_TO_IGNORE = new Set([
  'id',
  'created_at',
  'createdAt',
  'updated_at',
  'updatedAt',
  'user_id',
  'userId',
  'tenant_id',
  'org_id',
  'sync_status',
  'syncStatus',
  'last_synced_at',
  'lastSyncedAt',
  'payload_hash',
  'payloadHash'
]);

/**
 * Strips internal metadata fields from an object recursively
 */
export function normalizeForComparison(obj: any): any {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(normalizeForComparison);
  }

  const normalized: Record<string, any> = {};
  const keys = Object.keys(obj).sort();

  for (const key of keys) {
    if (METADATA_FIELDS_TO_IGNORE.has(key)) {
      continue;
    }
    const val = obj[key];
    if (val !== undefined && val !== null) {
      normalized[key] = normalizeForComparison(val);
    }
  }

  return normalized;
}

/**
 * Compares queue payload against remote record
 */
export function comparePayloadWithRemote(queuePayload: any, remoteData: any): ComparisonResult {
  if (!remoteData) {
    return { isMatch: false, diffFields: ['remoteData_is_null'] };
  }

  // 1. Direct payloadHash check if present in remoteData
  if (remoteData.payload_hash || remoteData.payloadHash) {
    const remoteHash = remoteData.payload_hash || remoteData.payloadHash;
    const localHash = computePayloadHash(queuePayload);
    if (remoteHash === localHash) {
      return {
        isMatch: true,
        remoteComputedHash: remoteHash,
        diffFields: []
      };
    }
  }

  // 2. Field-by-field comparison on normalized objects
  const normLocal = normalizeForComparison(queuePayload);
  const normRemote = normalizeForComparison(remoteData);

  const localHash = computePayloadHash(normLocal);
  const remoteHash = computePayloadHash(normRemote);

  if (localHash === remoteHash) {
    return {
      isMatch: true,
      remoteComputedHash: remoteHash,
      diffFields: []
    };
  }

  // Find exact diff fields
  const diffFields: string[] = [];
  const allKeys = new Set([...Object.keys(normLocal), ...Object.keys(normRemote)]);

  for (const key of allKeys) {
    const valL = JSON.stringify(normLocal[key]);
    const valR = JSON.stringify(normRemote[key]);
    if (valL !== valR) {
      diffFields.push(`${key}: local(${valL}) vs remote(${valR})`);
    }
  }

  return {
    isMatch: diffFields.length === 0,
    remoteComputedHash: remoteHash,
    diffFields
  };
}
