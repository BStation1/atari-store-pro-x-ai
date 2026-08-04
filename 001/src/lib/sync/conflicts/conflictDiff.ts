/**
 * Deep Recursive Diff Engine, Metadata Exclusion & Data Masking (Phase 2F-A)
 * @license Apache-2.0
 */

import { FieldDifference, FieldDifferenceType } from './conflictTypes';

/**
 * Metadata field names that are strictly excluded from conflict diff evaluation.
 */
export const EXCLUDED_METADATA_FIELDS = new Set([
  'createdAt',
  'created_at',
  'updatedAt',
  'updated_at',
  'syncStatus',
  'sync_status',
  'lastSyncedAt',
  'last_synced_at',
  'payloadHash',
  'payload_hash',
  'userId',
  'user_id',
  'tenantId',
  'tenant_id'
]);

/**
 * Field keywords considered sensitive for masking in UI and history logs.
 */
export const SENSITIVE_FIELD_KEYWORDS = [
  'phone',
  'email',
  'address',
  'password',
  'token',
  'secret',
  'accesstoken',
  'refreshtoken',
  'apikey'
];

/**
 * Checks if a given field path or key contains a sensitive keyword.
 */
export function isFieldSensitive(fieldPathOrKey: string): boolean {
  if (!fieldPathOrKey) return false;
  const lower = fieldPathOrKey.toLowerCase();
  return SENSITIVE_FIELD_KEYWORDS.some(keyword => lower.includes(keyword));
}

/**
 * Masks sensitive field values for display and non-secure history logging.
 */
export function maskSensitiveValue(fieldPathOrKey: string, value: any): any {
  if (value === null || value === undefined) return value;
  if (!isFieldSensitive(fieldPathOrKey)) return value;

  const valStr = String(value);
  const lowerKey = fieldPathOrKey.toLowerCase();

  if (lowerKey.includes('password') || lowerKey.includes('token') || lowerKey.includes('secret') || lowerKey.includes('key')) {
    return '********';
  }

  if (lowerKey.includes('email') && valStr.includes('@')) {
    const parts = valStr.split('@');
    const local = parts[0];
    const domain = parts[1];
    const maskedLocal = local.length > 2 ? `${local[0]}***${local[local.length - 1]}` : '***';
    return `${maskedLocal}@${domain}`;
  }

  if (lowerKey.includes('phone')) {
    if (valStr.length >= 7) {
      return `${valStr.slice(0, 3)}****${valStr.slice(-4)}`;
    }
    return '****';
  }

  if (valStr.length > 6) {
    return `${valStr.slice(0, 2)}****${valStr.slice(-2)}`;
  }

  return '****';
}

function getValueType(val: any): string {
  if (val === null) return 'null';
  if (val === undefined) return 'undefined';
  if (Array.isArray(val)) return 'array';
  return typeof val;
}

function isPlainObject(val: any): boolean {
  return val !== null && typeof val === 'object' && !Array.isArray(val);
}

/**
 * Computes deep recursive differences between local and remote objects,
 * ignoring metadata fields and key ordering in objects.
 */
export function computeDeepDiff(
  localObj: Record<string, any> | null,
  remoteObj: Record<string, any> | null,
  currentPath: string = ''
): FieldDifference[] {
  const differences: FieldDifference[] = [];

  const local = localObj || {};
  const remote = remoteObj || {};

  const allKeys = new Set<string>([
    ...Object.keys(local),
    ...Object.keys(remote)
  ]);

  for (const key of allKeys) {
    // 1. Skip metadata fields
    if (EXCLUDED_METADATA_FIELDS.has(key)) {
      continue;
    }

    const fieldPath = currentPath ? `${currentPath}.${key}` : key;
    const hasLocal = Object.prototype.hasOwnProperty.call(local, key) && local[key] !== undefined;
    const hasRemote = Object.prototype.hasOwnProperty.call(remote, key) && remote[key] !== undefined;

    const localVal = local[key];
    const remoteVal = remote[key];

    const localType = getValueType(localVal);
    const remoteType = getValueType(remoteVal);
    const isSensitive = isFieldSensitive(fieldPath);

    // Local only
    if (hasLocal && !hasRemote) {
      differences.push({
        path: fieldPath,
        differenceType: 'LOCAL_ONLY',
        localValue: localVal,
        remoteValue: undefined,
        localType,
        remoteType: 'undefined',
        isSensitive,
        recommendedAction: 'Verify if local field should be pushed remotely'
      });
      continue;
    }

    // Remote only
    if (!hasLocal && hasRemote) {
      differences.push({
        path: fieldPath,
        differenceType: 'REMOTE_ONLY',
        localValue: undefined,
        remoteValue: remoteVal,
        localType: 'undefined',
        remoteType,
        isSensitive,
        recommendedAction: 'Verify if remote field should be merged locally'
      });
      continue;
    }

    // Both present -> Compare types
    if (localType !== remoteType) {
      differences.push({
        path: fieldPath,
        differenceType: 'TYPE_MISMATCH',
        localValue: localVal,
        remoteValue: remoteVal,
        localType,
        remoteType,
        isSensitive,
        recommendedAction: 'Resolve data type mismatch between local and remote'
      });
      continue;
    }

    // Both are Plain Objects -> Recurse
    if (isPlainObject(localVal) && isPlainObject(remoteVal)) {
      const nestedDiffs = computeDeepDiff(localVal, remoteVal, fieldPath);
      differences.push(...nestedDiffs);
      continue;
    }

    // Both are Arrays -> Compare array structure & elements
    if (Array.isArray(localVal) && Array.isArray(remoteVal)) {
      const isArrayEqual = JSON.stringify(localVal) === JSON.stringify(remoteVal);
      if (!isArrayEqual) {
        differences.push({
          path: fieldPath,
          differenceType: 'ARRAY_MISMATCH',
          localValue: localVal,
          remoteValue: remoteVal,
          localType: 'array',
          remoteType: 'array',
          isSensitive,
          recommendedAction: 'Review array elements and order differences'
        });
      }
      continue;
    }

    // Primitives -> Value comparison
    if (localVal !== remoteVal) {
      differences.push({
        path: fieldPath,
        differenceType: 'VALUE_MISMATCH',
        localValue: localVal,
        remoteValue: remoteVal,
        localType,
        remoteType,
        isSensitive,
        recommendedAction: 'Choose local value, remote value, or manual entry'
      });
    }
  }

  return differences;
}
