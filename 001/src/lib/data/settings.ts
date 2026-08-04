/**
 * Unified System Settings Data Access Layer
 * @license Apache-2.0
 */

import { SystemSettings } from '../../types';
import {
  fetchOrMigrateStoreSettings,
  saveStoreSettingsToSupabase
} from '../supabaseSettings';
import { db } from '../db';

export async function getSystemSettings(): Promise<SystemSettings> {
  try {
    const res = await fetchOrMigrateStoreSettings();
    if (res && res.companyName) {
      return res;
    }
  } catch (err) {
    console.warn('[DataLayer] Failed fetching remote settings, returning local cache:', err);
  }
  return db.getSettings();
}

export async function updateSystemSettings(settings: SystemSettings): Promise<SystemSettings> {
  db.saveSettings(settings);
  try {
    await saveStoreSettingsToSupabase(settings);
  } catch (e) {
    console.warn('[DataLayer] Supabase settings save deferred:', e);
  }
  return settings;
}

export {
  fetchOrMigrateStoreSettings,
  saveStoreSettingsToSupabase
};
