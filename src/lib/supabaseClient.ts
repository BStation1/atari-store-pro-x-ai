import { createClient } from '@supabase/supabase-js';

const metaEnv = ((typeof import.meta !== 'undefined' && (import.meta as any).env) || {}) as Record<string, string | undefined>;
const procEnv = (typeof process !== 'undefined' && process.env) ? process.env : {};

// Atari Store Pro X has one authoritative Supabase project.
// Older Vercel environments still contain credentials for retired projects, so never allow
// a stale deployment variable to silently redirect authentication or database traffic.
const ACTIVE_SUPABASE_URL = 'https://nywfsxkqvwgvmriwhtow.supabase.co';
const ACTIVE_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_7D4_kTCJ7zN91IGwd3Holg_ZO5Vl8m4';

const configuredUrl = metaEnv.VITE_SUPABASE_URL || procEnv.VITE_SUPABASE_URL || '';
const configuredKey = metaEnv.VITE_SUPABASE_PUBLISHABLE_KEY || procEnv.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const deploymentMatchesActiveProject = configuredUrl === ACTIVE_SUPABASE_URL;

// Only accept deployment credentials when they explicitly target the active project.
// Otherwise use the known public client credentials for the authoritative project.
const supabaseUrl = deploymentMatchesActiveProject ? configuredUrl : ACTIVE_SUPABASE_URL;
const supabaseKey = deploymentMatchesActiveProject && configuredKey ? configuredKey : ACTIVE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseKey && /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl) && !supabaseUrl.includes('placeholder')
);

if (typeof window !== 'undefined') {
  if (configuredUrl && !deploymentMatchesActiveProject) {
    console.warn('Ignoring stale Supabase deployment configuration and using the active Atari Store Pro X project.');
  }
  console.log('Supabase configured:', isSupabaseConfigured);
  console.log('Supabase project:', 'nywfsxkqvwgvmriwhtow');
  console.log('App Origin:', window.location.origin);
}

const DEFAULT_READ_CACHE_TTL_MS = 60_000;
const HEAVY_HISTORY_CACHE_TTL_MS = 5 * 60_000;
const OPENING_BALANCE_CACHE_TTL_MS = 10 * 60_000;
const readResponseCache = new Map<string, { expiresAt: number; response: Response }>();
const inFlightReads = new Map<string, Promise<Response>>();

function isOpeningBalanceLookup(url: string): boolean {
  return url.includes('/rest/v1/inventory_movements') && (url.includes('OPENING_BALANCE') || url.includes('reference_id=eq.OPENING_BALANCE'));
}
function isRepairOrdersRead(url: string): boolean { return url.includes('/rest/v1/repair_orders'); }
function isInvoiceHistoryRead(url: string): boolean { return url.includes('/rest/v1/invoices') || url.includes('/rest/v1/invoice_items'); }
function isBusinessHistoryRead(url: string): boolean {
  return url.includes('/rest/v1/customers') || url.includes('/rest/v1/suppliers') || url.includes('/rest/v1/expenses') || url.includes('/rest/v1/partner_transactions') || url.includes('/rest/v1/partner_ledger') || url.includes('/rest/v1/partner_settlements');
}
function shouldDedupeRead(url: string, method: string): boolean {
  if (method !== 'GET') return false;
  return url.includes('/rest/v1/products') || isRepairOrdersRead(url) || isInvoiceHistoryRead(url) || isBusinessHistoryRead(url) || url.includes('/rest/v1/repair_part_usages') || url.includes('/rest/v1/store_settings') || isOpeningBalanceLookup(url);
}
function readCacheTtlForUrl(url: string): number {
  if (isOpeningBalanceLookup(url)) return OPENING_BALANCE_CACHE_TTL_MS;
  if (isRepairOrdersRead(url) || isInvoiceHistoryRead(url) || isBusinessHistoryRead(url)) return HEAVY_HISTORY_CACHE_TTL_MS;
  return DEFAULT_READ_CACHE_TTL_MS;
}
function invalidateReadCacheForMutation(url: string): void {
  const table = url.match(/\/rest\/v1\/([^?]+)/)?.[1];
  if (!table) return;
  for (const key of Array.from(readResponseCache.keys())) if (key.includes(`/rest/v1/${table}`)) readResponseCache.delete(key);
  if (table === 'invoices' || table === 'invoice_items') {
    for (const key of Array.from(readResponseCache.keys())) if (key.includes('/rest/v1/invoices') || key.includes('/rest/v1/invoice_items')) readResponseCache.delete(key);
  }
  if (table === 'products' || table === 'inventory_movements') {
    for (const key of Array.from(readResponseCache.keys())) if (key.includes('/rest/v1/products') || key.includes('/rest/v1/inventory_movements')) readResponseCache.delete(key);
  }
  if (table === 'repair_orders' || table === 'repair_part_usages') {
    for (const key of Array.from(readResponseCache.keys())) if (key.includes('/rest/v1/repair_orders') || key.includes('/rest/v1/repair_part_usages')) readResponseCache.delete(key);
  }
}

const dedupingFetch: typeof fetch = async (input, init) => {
  const request = input instanceof Request ? input : null;
  const url = request?.url || String(input);
  const method = String(init?.method || request?.method || 'GET').toUpperCase();
  if (method !== 'GET') {
    invalidateReadCacheForMutation(url);
    return fetch(input as any, init);
  }
  if (!shouldDedupeRead(url, method)) return fetch(input as any, init);

  const headers = init?.headers instanceof Headers ? init.headers : request?.headers;
  const authHeader = String(headers?.get?.('authorization') || '');
  const cacheKey = `${method}:${url}:${authHeader}`;
  const now = Date.now();
  const cached = readResponseCache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.response.clone();
  if (cached) readResponseCache.delete(cacheKey);

  const existing = inFlightReads.get(cacheKey);
  if (existing) return (await existing).clone();

  const networkPromise = fetch(input as any, init)
    .then(response => {
      if (response.ok) readResponseCache.set(cacheKey, { expiresAt: Date.now() + readCacheTtlForUrl(url), response: response.clone() });
      return response;
    })
    .finally(() => inFlightReads.delete(cacheKey));

  inFlightReads.set(cacheKey, networkPromise);
  return (await networkPromise).clone();
};

export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseKey : 'placeholder_key',
  {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'atari_shared_auth_session_v1' },
    global: { fetch: dedupingFetch }
  }
);

const enableGlobalRealtime = String(metaEnv.VITE_ENABLE_GLOBAL_REALTIME || procEnv.VITE_ENABLE_GLOBAL_REALTIME || 'false').toLowerCase() === 'true';
if (!enableGlobalRealtime) {
  const originalChannel = supabase.channel.bind(supabase);
  let wildcardGuardLogged = false;
  (supabase as any).channel = (topic: string, params?: any) => {
    if (topic !== 'public-realtime-db') return originalChannel(topic, params);
    const disabledChannel: any = {
      on: () => disabledChannel,
      subscribe: (callback?: (status: string) => void) => {
        if (!wildcardGuardLogged) {
          wildcardGuardLogged = true;
          console.info('🛡️ Global Supabase Realtime wildcard disabled to prevent request storms');
        }
        queueMicrotask(() => callback?.('SUBSCRIBED'));
        return disabledChannel;
      },
      unsubscribe: async () => 'ok',
    };
    return disabledChannel;
  };
}

export async function testSupabaseConnection(): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    if (!isSupabaseConfigured) return { success: false, message: 'Supabase credentials not configured.' };
    const { data, error } = await supabase.from('store_settings').select('company_name').limit(1);
    if (error) return { success: false, message: `Connection failed: ${error.message}` };
    return { success: true, message: 'Supabase Connected Successfully', data };
  } catch (err: any) { return { success: false, message: err?.message || 'Unknown connection error' }; }
}

export async function testAuthRpcFunctions(): Promise<{ role: any; roleError: any; isOwner: any; isOwnerError: any }> {
  try {
    const { data: role, error: roleError } = await supabase.rpc('get_auth_user_role');
    const { data: isOwner, error: isOwnerError } = await supabase.rpc('is_owner');
    return { role, roleError, isOwner, isOwnerError };
  } catch (err) { return { role: null, roleError: err, isOwner: null, isOwnerError: err };
  }
}
