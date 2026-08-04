/**
 * Resolution Hashes & Post-Execution Verifier (Phase 2F-B)
 * @license Apache-2.0
 */

import { computePayloadHash } from '../../validators/baseValidator';
import { ResolutionVerificationResult } from './resolutionTypes';

export function computePayloadHashUtil(payload: any): string {
  return computePayloadHash(payload);
}

export function verifyResolutionHashes(
  localPayloadBefore: any,
  remotePayloadBefore: any,
  localPayloadAfter: any,
  remotePayloadAfter: any
): ResolutionVerificationResult {
  const localHashBefore = computePayloadHash(localPayloadBefore);
  const remoteHashBefore = computePayloadHash(remotePayloadBefore);
  const localHashAfter = computePayloadHash(localPayloadAfter);
  const remoteHashAfter = computePayloadHash(remotePayloadAfter);

  const passed = localHashAfter === remoteHashAfter;

  return {
    passed,
    localHashBefore,
    remoteHashBefore,
    localHashAfter,
    remoteHashAfter,
    message: passed
      ? 'Verification PASS: Local payload replaced and matches current remote payload hash.'
      : 'Verification FAIL: Local payload hash does not match remote payload hash.'
  };
}
