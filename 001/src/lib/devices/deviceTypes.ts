/**
 * Device Model Registry Types (Phase 3UI.1 - Device Asset Library)
 * Canonical identifiers, categories, asset metadata, and fallback icon mappings.
 * @license Apache-2.0
 */

export type DeviceCategory = 'console' | 'controller' | 'handheld' | 'accessory' | 'other';

export type DeviceFallbackIcon = 'gamepad' | 'tv' | 'box' | 'cpu' | 'help';

export interface DeviceModelDefinition {
  canonicalId: string;
  displayNameAr: string;
  displayNameEn: string;
  manufacturer: string;
  aliases: string[];
  category: DeviceCategory;
  localAssetPath?: string;
  fallbackIconType: DeviceFallbackIcon;
}

export type KnownCanonicalModelId =
  | 'ps5_fat'
  | 'ps5_slim'
  | 'ps5_digital'
  | 'ps5_pro'
  | 'ps4_fat'
  | 'ps4_slim'
  | 'ps4_pro'
  | 'xbox_series_x'
  | 'xbox_series_s'
  | 'xbox_one'
  | 'nintendo_switch'
  | 'nintendo_switch_oled'
  | 'steam_deck'
  | 'controller_ps5'
  | 'controller_ps4'
  | 'controller_xbox'
  | 'unknown';
