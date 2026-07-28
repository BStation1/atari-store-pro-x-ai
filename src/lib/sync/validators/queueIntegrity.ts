/**
 * Queue Integrity Checker (Phase 2C)
 * Evaluates queue items for structural conflicts, duplicate keys, corrupted hashes, and version compliance.
 * @license Apache-2.0
 */

import { SyncQueueItem } from '../syncTypes';
import { validateQueueItem, simulateSync, SyncSimulationResult } from './validatorFactory';
import { computePayloadHash, SUPPORTED_SYNC_VERSION } from './baseValidator';

export interface QueueIntegrityReport {
  totalItems: number;
  duplicateEntityIds: number;
  duplicateIdempotencyKeys: number;
  potentialDuplicateCreates: number;
  missingTimestamps: number;
  missingOrigin: number;
  missingPayloadHash: number;
  missingSequenceNumbers: number;
  hashMismatches: number;
  unsupportedVersions: number;
  invalidQueueItems: number;
  simulationReadyCount: number;
  simulationInvalidCount: number;
  simulations: SyncSimulationResult[];
}

export function checkQueueIntegrity(items: SyncQueueItem[]): QueueIntegrityReport {
  const report: QueueIntegrityReport = {
    totalItems: items.length,
    duplicateEntityIds: 0,
    duplicateIdempotencyKeys: 0,
    potentialDuplicateCreates: 0,
    missingTimestamps: 0,
    missingOrigin: 0,
    missingPayloadHash: 0,
    missingSequenceNumbers: 0,
    hashMismatches: 0,
    unsupportedVersions: 0,
    invalidQueueItems: 0,
    simulationReadyCount: 0,
    simulationInvalidCount: 0,
    simulations: []
  };

  const createOpMap = new Map<string, number>();
  const idempotencyMap = new Map<string, number>();

  items.forEach((item) => {
    // 1. Duplicate checks
    if (item.entityId && item.operation === 'CREATE') {
      const eKey = `${item.entityType}:${item.entityId}`;
      createOpMap.set(eKey, (createOpMap.get(eKey) || 0) + 1);
    }

    if (item.idempotencyKey) {
      idempotencyMap.set(item.idempotencyKey, (idempotencyMap.get(item.idempotencyKey) || 0) + 1);
    }

    if (item.sequenceNumber === undefined || item.sequenceNumber === null) {
      report.missingSequenceNumbers++;
    }

    // 2. Timestamps check
    if (!item.createdAt || !item.updatedAt || isNaN(Date.parse(item.createdAt)) || isNaN(Date.parse(item.updatedAt))) {
      report.missingTimestamps++;
    }

    // 3. Origin check
    if (!item.origin || item.origin.trim() === '') {
      report.missingOrigin++;
    }

    // 4. PayloadHash & Hash verification
    if (!item.payloadHash || item.payloadHash.trim() === '') {
      report.missingPayloadHash++;
    } else if (item.payload) {
      const recomputed = computePayloadHash(item.payload);
      if (item.payloadHash !== recomputed) {
        report.hashMismatches++;
      }
    }

    // 5. Version check
    if (item.version !== SUPPORTED_SYNC_VERSION) {
      report.unsupportedVersions++;
    }

    // 6. Simulation & Validation
    const sim = simulateSync(item);

    // If duplicate idempotency or duplicate CREATE operations present, mark invalid
    const extraReasons: string[] = [];
    if (item.idempotencyKey && (idempotencyMap.get(item.idempotencyKey) || 0) > 1) {
      extraReasons.push(`Duplicate idempotencyKey found in queue (${item.idempotencyKey})`);
    }
    if (item.entityId && item.operation === 'CREATE' && (createOpMap.get(`${item.entityType}:${item.entityId}`) || 0) > 1) {
      extraReasons.push(`Duplicate CREATE operation for same entityId found in queue (${item.entityId})`);
    }

    if (extraReasons.length > 0) {
      sim.status = 'INVALID';
      sim.reasons = [...sim.reasons, ...extraReasons];
    }

    report.simulations.push(sim);

    if (sim.status === 'READY') {
      report.simulationReadyCount++;
    } else {
      report.simulationInvalidCount++;
      report.invalidQueueItems++;
    }
  });

  // Calculate total duplicate counts
  createOpMap.forEach((count) => {
    if (count > 1) {
      report.potentialDuplicateCreates += count - 1;
      report.duplicateEntityIds += count - 1;
    }
  });
  idempotencyMap.forEach((count) => {
    if (count > 1) report.duplicateIdempotencyKeys += count - 1;
  });

  return report;
}
