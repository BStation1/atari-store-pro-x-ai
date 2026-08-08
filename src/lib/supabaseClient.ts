import { createClient } from '@supabase/supabase-js';

// Access Supabase credentials from Vite environment variables or process.env safely.
// Never fall back to a real project URL/key here: if Vercel env vars are missing,
// silently connecting to an old Supabase project can create confusing 402 errors,
// wrong-data reads, and unnecessary egress against the wrong backend.
const metaEnv = ((typeof import.meta !== 'undefined' && (import.meta as any).env) || {}) as Record<string, string | undefined>;
const procEnv = (typeof process !== 'undefined' && process.env) ? process.env : {};

const supabaseUrl =
  metaEnv.VITE_SUPABASE_URL ||
  metaEnv.VITE_SUPABASE_PROJECT_URL ||
  procEnv.VITE_SUPABASE_URL ||
  procEnv.VITE_SUPABASE_PROJECT_URL ||
  '';

const supabaseKey =
  metaEnv.VITE_SUPABASE_PUBLISHABLE_KEY ||
  metaEnv.VITE_SUPABASE_ANON_KEY ||
  procEnv.VITE_SUPABASE_PUBLISHABLE_KEY ||
  procEnv.VITE_SUPABASE_ANON_KEY ||
  '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseKey &&
  /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl) &&
  !supabaseUrl.includes('placeholder')
);

if (typeof window !== 'undefined') {
  console.log("Supabase configured:", isSupabaseConfigured);
  console.log("App Origin:", window.location.origin);
}

if (!isSupabaseConfigured) {
  console.warn(
    '⚠️ Supabase credentials missing or invalid. Configure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in Vercel Environment Variables.'
  );
}

/**
 * Browser-side read deduplication for Supabase REST.
 *
 * Several UI hooks can ask for the same snapshots repeatedly after one mutation.
 * We collapse identical reads and keep a short cache for frequently-read core data.
 * Opening-balance existence checks are especially expensive because the product
 * migration flow performs one inventory_movements lookup per product (N+1).
 * Those lookups are safe to cache longer and are explicitly invalidated on writes.
 */
const DEFAULT_READ_CACHE_TTL_MS = 12_000;
const OPENING_BALANCE_CACHE_TTL_MS = 10 * 60_000;
const readResponseCache = new Map<string, { expiresAt: number; response: Response }>();
const inFlightReads = new Map<string, Promise<Response>>();

function isOpeningBalanceLookup(url: string): boolean {
  return url.includes('/rest/v1/inventory_movements') &&
    (url.includes('OPENING_BALANCE') || url.includes('reference_id=eq.OPENING_BALANCE'));
}

function shouldDedupeRead(url: string, method: string): boolean {
  if (method !== 'GET') return false;
  return url.includes('/rest/v1/products') ||
    url.includes('/rest/v1/repair_orders') ||
    url.includes('/rest/v1/repair_part_usages') ||
    isOpeningBalanceLookup(url);
}

function readCacheTtlForUrl(url: string): number {
  return isOpeningBalanceLookup(url)
    ? OPENING_BALANCE_CACHE_TTL_MS
    : DEFAULT_READ_CACHE_TTL_MS;
}

function invalidateReadCacheForMutation(url: string): void {
  const tableMatch = url.match(/\/rest\/v1\/([^?]+)/);
  const table = tableMatch?.[1];
  if (!table) return;

  for (const key of readResponseCache.keys()) {
    if (key.includes(`/rest/v1/${table}`)) {
      readResponseCache.delete(key);
    }
  }

  // Product writes can affect subsequent migration/opening-balance verification.
  // Inventory movement writes must invalidate the long-lived opening-balance cache.
  if (table === 'products' || table === 'inventory_movements') {
    for (const key of readResponseCache.keys()) {
      if (key.includes('/rest/v1/inventory_movements')) {
        readResponseCache.delete(key);
      }
    }
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

  if (!shouldDedupeRead(url, method)) {
    return fetch(input as any, init);
  }

  const authHeader = String(
    (init?.headers instanceof Headers ? init.headers.get('authorization') : undefined) ||
    request?.headers.get('authorization') ||
    ''
  );
  const cacheKey = `${method}:${url}:${authHeader}`;
  const now = Date.now();
  const cached = readResponseCache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    return cached.response.clone();
  }
  if (cached) readResponseCache.delete(cacheKey);

  const existing = inFlightReads.get(cacheKey);
  if (existing) {
    const shared = await existing;
    return shared.clone();
  }

  const networkPromise = fetch(input as any, init).then(response => {
    if (response.ok) {
      readResponseCache.set(cacheKey, {
        expiresAt: Date.now() + readCacheTtlForUrl(url),
        response: response.clone(),
      });
    }
    return response;
  }).finally(() => {
    inFlightReads.delete(cacheKey);
  });

  inFlightReads.set(cacheKey, networkPromise);
  const response = await networkPromise;
  return response.clone();
};

// Create a singleton Supabase client. Placeholder values are intentionally non-production;
// all data services already check isSupabaseConfigured and can use local fallback where supported.
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseKey : 'placeholder_key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      fetch: dedupingFetch,
    },
  }
);

/**
 * Production safety circuit breaker for the app-wide wildcard Realtime channel.
 *
 * useData.ts currently subscribes to every change in the public schema and then
 * dispatches local refetch events. A single repair transaction touches several
 * tables, so the wildcard subscription can echo those writes back into many
 * hooks at once and create a browser request storm. Chrome then starts failing
 * otherwise-valid Supabase requests with net::ERR_INSUFFICIENT_RESOURCES.
 *
 * Keep global wildcard realtime OFF by default. Local mutation events still
 * update the current browser immediately. Realtime can be explicitly re-enabled
 * later after the subscription is replaced with table-scoped/debounced channels.
 */
const enableGlobalRealtime = String(
  metaEnv.VITE_ENABLE_GLOBAL_REALTIME || procEnv.VITE_ENABLE_GLOBAL_REALTIME || 'false'
).toLowerCase() === 'true';

if (!enableGlobalRealtime) {
  const originalChannel = supabase.channel.bind(supabase);

  (supabase as any).channel = (topic: string, params?: any) => {
    if (topic !== 'public-realtime-db') {
      return originalChannel(topic, params);
    }

    let subscribeCallback: ((status: string) => void) | undefined;
    const disabledChannel: any = {
      on: () => disabledChannel,
      subscribe: (callback?: (status: string) => void) => {
        subscribeCallback = callback;
        queueMicrotask(() => subscribeCallback?.('SUBSCRIBED'));
        console.info('🛡️ Global Supabase Realtime wildcard disabled to prevent request storms');
        return disabledChannel;
      },
      unsubscribe: async () => 'ok',
    };

    return disabledChannel;
  };
}

/**
 * Utility function to test Supabase database connectivity.
 */
export async function testSupabaseConnection(): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    if (!isSupabaseConfigured) {
      return {
        success: false,
        message: 'Supabase credentials not configured in environment variables.',
      };
    }

    // Ping the store_settings table or categories table
    const { data, error } = await supabase.from('store_settings').select('company_name').limit(1);

    if (error) {
      console.warn('⚠️ Supabase connection issue:', error.message);
      return {
        success: false,
        message: `Connection failed: ${error.message}`,
      };
    }

    console.log('✅ Supabase Connected Successfully');
    return {
      success: true,
      message: 'Supabase Connected Successfully',
      data,
    };
  } catch (err: any) {
    console.warn('⚠️ Unexpected Supabase connection issue:', err);
    return {
      success: false,
      message: err?.message || 'Unknown connection error',
    };
  }
}

/**
 * Utility function to test RLS Auth RPC functions in Supabase.
 */
export async function testAuthRpcFunctions(): Promise<{
  role: any;
  roleError: any;
  isOwner: any;
  isOwnerError: any;
}> {
  try {
    const { data: role, error: roleError } = await supabase.rpc('get_auth_user_role');
    const { data: isOwner, error: isOwnerError } = await supabase.rpc('is_owner');

    console.log('------------------------------------------');
    console.log('🔐 [RPC Check] get_auth_user_role():', role, roleError ? roleError.message : '');
    console.log('🔐 [RPC Check] is_owner():', isOwner, isOwnerError ? isOwnerError.message : '');
    console.log('------------------------------------------');

    return { role, roleError, isOwner, isOwnerError };
  } catch (err) {
    console.warn('⚠️ Error calling RPC functions:', err);
    return { role: null, roleError: err, isOwner: null, isOwnerError: err };
  }
}
