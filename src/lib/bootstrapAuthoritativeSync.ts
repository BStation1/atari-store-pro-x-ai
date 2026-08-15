import { isSupabaseConfigured, supabase } from './supabaseClient';
import { mapRowToRepairOrder, saveLocalRepairOrdersBackup } from './supabaseRepairOrders';

const BOOTSTRAP_SYNC_KEY = 'atari_repair_orders_authoritative_sync_at';

/**
 * Refresh the browser cache from Supabase before React mounts.
 * Supabase is the source of truth; localStorage is only an offline cache.
 * This deliberately REPLACES the local repair-order snapshot instead of merging it,
 * so deleted/ghost orders cannot survive on one browser only.
 */
export async function bootstrapAuthoritativeSync(): Promise<void> {
  if (typeof window === 'undefined' || !isSupabaseConfigured) return;

  try {
    const { data, error } = await supabase
      .from('repair_orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[AuthoritativeSync] Supabase unavailable; keeping offline repair-order cache:', error.message);
      return;
    }

    const remoteOrders = (data || []).map(mapRowToRepairOrder);
    saveLocalRepairOrdersBackup(remoteOrders, false);
    sessionStorage.setItem(BOOTSTRAP_SYNC_KEY, String(Date.now()));
    console.log(`[AuthoritativeSync] Repair orders synchronized from Supabase: ${remoteOrders.length}`);
  } catch (error) {
    console.warn('[AuthoritativeSync] Failed; keeping offline repair-order cache:', error);
  }
}

export function wasRepairOrdersBootstrappedRecently(maxAgeMs = 60_000): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  const value = Number(sessionStorage.getItem(BOOTSTRAP_SYNC_KEY) || 0);
  return value > 0 && Date.now() - value < maxAgeMs;
}
