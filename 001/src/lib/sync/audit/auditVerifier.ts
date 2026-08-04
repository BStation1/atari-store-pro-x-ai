/**
 * Audit Chain Integrity Verifier for Phase 2G.1
 * Diagnostic-only verifier for tamper detection. Purely diagnostic (no auto-repair).
 * @license Apache-2.0
 */

import { AuditEvent, AuditVerificationResult, AuditFailureType } from './auditTypes';
import { getAllAuditEvents } from './auditStorage';
import { computeEventHash } from './auditHasher';

export function verifyAuditChain(eventsInput?: AuditEvent[]): AuditVerificationResult {
  const events = eventsInput ?? getAllAuditEvents();
  const nonLegacyEvents = events.filter(e => !e.isLegacyUnverified);

  if (nonLegacyEvents.length === 0) {
    return {
      valid: true,
      totalEvents: events.length,
      verifiedEvents: 0,
      firstBrokenSequence: null,
      failureType: 'NONE',
      expectedHash: null,
      actualHash: null
    };
  }

  const seenSequences = new Set<number>();
  let previousEvent: AuditEvent | null = null;
  let verifiedCount = 0;

  for (let i = 0; i < nonLegacyEvents.length; i++) {
    const event = nonLegacyEvents[i];

    // Schema Validation
    if (
      typeof event.sequenceNumber !== 'number' ||
      !event.eventId ||
      !event.eventType ||
      !event.timestamp ||
      !event.schemaVersion
    ) {
      return {
        valid: false,
        totalEvents: events.length,
        verifiedEvents: verifiedCount,
        firstBrokenSequence: event.sequenceNumber ?? null,
        failureType: 'INVALID_EVENT_SCHEMA',
        expectedHash: null,
        actualHash: event.eventHash ?? null
      };
    }

    // Duplicate Sequence Check
    if (seenSequences.has(event.sequenceNumber)) {
      return {
        valid: false,
        totalEvents: events.length,
        verifiedEvents: verifiedCount,
        firstBrokenSequence: event.sequenceNumber,
        failureType: 'DUPLICATE_SEQUENCE',
        expectedHash: null,
        actualHash: event.eventHash
      };
    }
    seenSequences.add(event.sequenceNumber);

    // First event Genesis Check
    if (i === 0) {
      if (event.previousEventHash !== 'GENESIS') {
        return {
          valid: false,
          totalEvents: events.length,
          verifiedEvents: verifiedCount,
          firstBrokenSequence: event.sequenceNumber,
          failureType: 'INVALID_GENESIS',
          expectedHash: 'GENESIS',
          actualHash: event.previousEventHash
        };
      }
    } else if (previousEvent) {
      // Sequence Gap Check
      if (event.sequenceNumber !== previousEvent.sequenceNumber + 1) {
        return {
          valid: false,
          totalEvents: events.length,
          verifiedEvents: verifiedCount,
          firstBrokenSequence: event.sequenceNumber,
          failureType: 'SEQUENCE_GAP',
          expectedHash: null,
          actualHash: event.eventHash
        };
      }

      // Previous Hash Link Check
      if (event.previousEventHash !== previousEvent.eventHash) {
        return {
          valid: false,
          totalEvents: events.length,
          verifiedEvents: verifiedCount,
          firstBrokenSequence: event.sequenceNumber,
          failureType: 'PREVIOUS_HASH_MISMATCH',
          expectedHash: previousEvent.eventHash,
          actualHash: event.previousEventHash
        };
      }
    }

    // Event Hash Recalculation Check
    const expectedEventHash = computeEventHash(event);
    if (event.eventHash !== expectedEventHash) {
      return {
        valid: false,
        totalEvents: events.length,
        verifiedEvents: verifiedCount,
        firstBrokenSequence: event.sequenceNumber,
        failureType: 'HASH_MISMATCH',
        expectedHash: expectedEventHash,
        actualHash: event.eventHash
      };
    }

    verifiedCount++;
    previousEvent = event;
  }

  return {
    valid: true,
    totalEvents: events.length,
    verifiedEvents: verifiedCount,
    firstBrokenSequence: null,
    failureType: 'NONE',
    expectedHash: null,
    actualHash: null
  };
}
