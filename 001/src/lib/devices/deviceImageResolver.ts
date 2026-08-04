/**
 * Device Model Normalizer & Image Resolver (Phase 3UI.1)
 * Safe string normalization and canonical resolution for device models.
 * @license Apache-2.0
 */

import { DeviceModelDefinition } from './deviceTypes';
import { DEVICE_MODEL_REGISTRY, UNKNOWN_DEVICE_MODEL } from './deviceModels';

/**
 * Normalizes an arbitrary input string (e.g. "PS 5", "Playstation5", "ps5 slim")
 * into a clean lowercase tokenized form for safe matching.
 */
export function normalizeModelString(rawInput?: string): string {
  if (!rawInput) return '';
  return rawInput
    .trim()
    .toLowerCase()
    .replace(/[\-_]/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Resolves a raw device string (e.g. model name, device type) to its Canonical Device Definition.
 * Strictly non-mutating and safe.
 */
export function resolveCanonicalDeviceModel(rawInput?: string): DeviceModelDefinition {
  const normalized = normalizeModelString(rawInput);
  if (!normalized) return UNKNOWN_DEVICE_MODEL;

  // 1. Direct match on canonicalId
  const directMatch = DEVICE_MODEL_REGISTRY.find(
    (item) => item.canonicalId.toLowerCase() === normalized
  );
  if (directMatch) return directMatch;

  // 2. Direct match on English display name or Arabic display name
  const nameMatch = DEVICE_MODEL_REGISTRY.find(
    (item) =>
      item.displayNameEn.toLowerCase() === normalized ||
      item.displayNameAr.toLowerCase() === normalized
  );
  if (nameMatch) return nameMatch;

  // 3. Exact match in aliases
  const aliasMatch = DEVICE_MODEL_REGISTRY.find((item) =>
    item.aliases.some((alias) => normalizeModelString(alias) === normalized)
  );
  if (aliasMatch) return aliasMatch;

  // 4. Substring containment match for specific high-priority tokens (e.g., "ps5 pro" in "sony ps5 pro 1tb")
  // Only matched if exact token boundaries are respected to avoid misidentifying PS4 as PS5 or Xbox Series S as X.
  for (const item of DEVICE_MODEL_REGISTRY) {
    for (const alias of item.aliases) {
      const normAlias = normalizeModelString(alias);
      if (normAlias.length >= 3) {
        const regex = new RegExp(`\\b${normAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (regex.test(normalized)) {
          return item;
        }
      }
    }
  }

  return UNKNOWN_DEVICE_MODEL;
}

/**
 * Returns the local asset image path if available for a given model string, or undefined.
 */
export function getDeviceLocalAssetPath(rawInput?: string): string | undefined {
  const resolved = resolveCanonicalDeviceModel(rawInput);
  return resolved.localAssetPath;
}
