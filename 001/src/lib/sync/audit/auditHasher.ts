/**
 * Canonical Serialization and SHA-256 Hashing Engine for Audit Logs (Phase 2G.1)
 * @license Apache-2.0
 */

import { AuditEvent } from './auditTypes';

/**
 * Deterministically sorts object keys recursively to produce a canonical JSON string.
 */
export function canonicalizeValue(val: any): any {
  if (val === null) return null;
  if (typeof val === 'undefined') return undefined;

  if (typeof val === 'number') {
    if (Number.isNaN(val)) return 'NaN';
    if (val === Infinity) return 'Infinity';
    if (val === -Infinity) return '-Infinity';
    return val;
  }

  if (typeof val !== 'object') {
    if (typeof val === 'function' || typeof val === 'symbol') {
      return undefined;
    }
    return val;
  }

  if (val instanceof Date) {
    return val.toISOString();
  }

  if (Array.isArray(val)) {
    return val.map(item => canonicalizeValue(item)).filter(item => typeof item !== 'undefined');
  }

  const sortedObj: Record<string, any> = {};
  const keys = Object.keys(val).sort();

  for (const key of keys) {
    const canonicalVal = canonicalizeValue(val[key]);
    if (typeof canonicalVal !== 'undefined') {
      sortedObj[key] = canonicalVal;
    }
  }

  return sortedObj;
}

export function canonicalizeAuditEvent(event: Partial<AuditEvent>): string {
  // Extract strictly the hashable canonical payload fields (eventHash excluded)
  const canonicalPayload = {
    sequenceNumber: event.sequenceNumber ?? 0,
    previousEventHash: event.previousEventHash ?? 'GENESIS',
    schemaVersion: event.schemaVersion ?? '2G.1',
    eventId: event.eventId ?? '',
    correlationId: event.correlationId ?? '',
    timestamp: event.timestamp ?? '',
    queueItemId: event.queueItemId ?? '',
    entityType: event.entityType ?? '',
    entityId: event.entityId ?? '',
    operation: event.operation ?? '',
    eventType: event.eventType ?? '',
    previousState: event.previousState ?? null,
    newState: event.newState ?? null,
    actor: event.actor ?? '',
    result: event.result ?? '',
    durationMs: event.durationMs ?? null,
    metadata: event.metadata ? canonicalizeValue(event.metadata) : null
  };

  return JSON.stringify(canonicalizeValue(canonicalPayload));
}

/**
 * Pure TypeScript synchronous SHA-256 digest implementation.
 * Ensures consistent 64-character hexadecimal hash across browser and Node.js.
 */
export function sha256Hex(str: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let lengthProperty = 'length';
  let i: number, j: number;
  let result = '';

  const words: number[] = [];
  const asciiBitLength = str[lengthProperty] * 8;

  let hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  for (i = 0; i < str[lengthProperty]; i++) {
    j = str.charCodeAt(i);
    words[i >> 2] |= j << ((3 - (i % 4)) * 8);
  }

  words[str[lengthProperty] >> 2] |= 0x80 << ((3 - (str[lengthProperty] % 4)) * 8);
  words[(((str[lengthProperty] + 8) >> 6) << 4) + 15] = asciiBitLength;

  for (j = 0; j < words[lengthProperty]; j += 16) {
    const w = words.slice(j, j + 16);
    const oldHash = hash.slice(0);

    for (i = 0; i < 64; i++) {
      if (i >= 16) {
        const s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }

      const S1 = rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25);
      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const temp1 = (hash[7] + S1 + ch + k[i] + w[i]) | 0;
      const S0 = rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const temp2 = (S0 + maj) | 0;

      hash[7] = hash[6];
      hash[6] = hash[5];
      hash[5] = hash[4];
      hash[4] = (hash[3] + temp1) | 0;
      hash[3] = hash[2];
      hash[2] = hash[1];
      hash[1] = hash[0];
      hash[0] = (temp1 + temp2) | 0;
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }

  return result;
}

export function computeEventHash(event: Partial<AuditEvent>): string {
  const canonicalString = canonicalizeAuditEvent(event);
  return sha256Hex(canonicalString);
}
