const PAGE_SIZE = 250;
const DEFAULT_HEAVY_READ_CACHE_TTL_MS = 5 * 60_000;

// Full-table pagination remains limited to the two potentially very large directory tables.
const PAGINATED_TABLES = new Set(['products', 'customers']);

// Exact GET requests for these tables are also deduplicated/cached. This is especially
// important for partner accounting where multiple hooks/components can ask for the same
// inventory/accounting datasets during one render/navigation burst.
const CACHED_TABLE_TTLS = new Map<string, number>([
  ['products', 5 * 60_000],
  ['customers', 5 * 60_000],
  ['categories', 5 * 60_000],
  ['profiles', 5 * 60_000],
  ['store_settings', 5 * 60_000],
  ['device_types', 5 * 60_000],
  ['device_models', 5 * 60_000],
  ['repair_templates', 5 * 60_000],
  ['repair_orders', 60_000],
  ['invoices', 60_000],
  ['repair_part_usages', 60_000],
  ['inventory_movements', 60_000],
  ['partner_transactions', 60_000],
  ['partner_ledger', 60_000],
  ['partner_settlements', 60_000],
]);

type CachedResponse = {
  expiresAt: number;
  response: Response;
};

const readCache = new Map<string, CachedResponse>();
const inFlightReads = new Map<string, Promise<Response>>();

function getTableName(url: string): string | null {
  const match = url.match(/\/rest\/v1\/([^?]+)/);
  return match?.[1] || null;
}

function getHeader(headers: HeadersInit | undefined, name: string): string {
  if (!headers) return '';
  if (headers instanceof Headers) return headers.get(name) || '';
  if (Array.isArray(headers)) {
    const found = headers.find(([key]) => key.toLowerCase() === name.toLowerCase());
    return found?.[1] || '';
  }
  const record = headers as Record<string, string>;
  const key = Object.keys(record).find(k => k.toLowerCase() === name.toLowerCase());
  return key ? String(record[key] || '') : '';
}

function hasExplicitRange(request: Request | null, init?: RequestInit): boolean {
  return Boolean(
    getHeader(init?.headers, 'range') ||
    request?.headers.get('range') ||
    getHeader(init?.headers, 'range-unit') ||
    request?.headers.get('range-unit')
  );
}

function shouldPaginate(url: string, method: string, request: Request | null, init?: RequestInit): boolean {
  if (method !== 'GET') return false;
  const table = getTableName(url);
  if (!table || !PAGINATED_TABLES.has(table)) return false;
  if (hasExplicitRange(request, init)) return false;

  try {
    const parsed = new URL(url);
    const select = parsed.searchParams.get('select');
    if (select && select !== '*') return false;
    if (parsed.searchParams.has('limit') || parsed.searchParams.has('offset')) return false;
    return true;
  } catch {
    return false;
  }
}

function cloneHeaders(request: Request | null, init?: RequestInit): Headers {
  const headers = new Headers(request?.headers || undefined);
  if (init?.headers) {
    const extra = new Headers(init.headers);
    extra.forEach((value, key) => headers.set(key, value));
  }
  return headers;
}

function cacheKeyFor(url: string, request: Request | null, init?: RequestInit): string {
  const headers = cloneHeaders(request, init);
  return [
    url,
    headers.get('authorization') || '',
    headers.get('apikey') || '',
    headers.get('accept-profile') || '',
    headers.get('content-profile') || '',
  ].join('|');
}

function invalidateTableCache(table: string | null): void {
  if (!table) return;
  for (const key of Array.from(readCache.keys())) {
    if (key.includes(`/rest/v1/${table}`)) readCache.delete(key);
  }
}

function buildPagedRequest(
  originalInput: RequestInfo | URL,
  originalRequest: Request | null,
  init: RequestInit | undefined,
  from: number,
  to: number
): [RequestInfo | URL, RequestInit] {
  const headers = cloneHeaders(originalRequest, init);
  headers.set('Range-Unit', 'items');
  headers.set('Range', `${from}-${to}`);
  headers.set('Prefer', headers.get('Prefer') || 'count=exact');

  const nextInit: RequestInit = {
    ...init,
    method: 'GET',
    headers,
  };

  if (originalRequest) {
    return [originalRequest.url, nextInit];
  }
  return [originalInput, nextInit];
}

function parseTotal(contentRange: string | null): number | null {
  if (!contentRange) return null;
  const match = contentRange.match(/\/(\d+)$/);
  if (!match) return null;
  const total = Number(match[1]);
  return Number.isFinite(total) ? total : null;
}

function mergeRows(existing: any[], incoming: any[]): any[] {
  const result = [...existing];
  const knownIds = new Set(existing.map(row => String(row?.id || '')));

  for (const row of incoming) {
    const id = String(row?.id || '');
    if (id && knownIds.has(id)) continue;
    if (id) knownIds.add(id);
    result.push(row);
  }
  return result;
}

function getCached(key: string): Response | null {
  const cached = readCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    readCache.delete(key);
    return null;
  }
  return cached.response.clone();
}

function storeCached(key: string, response: Response, ttlMs: number): void {
  if (!response.ok) return;
  readCache.set(key, {
    expiresAt: Date.now() + ttlMs,
    response: response.clone(),
  });
}

export function installEgressPaginationGuard(): void {
  if (typeof globalThis === 'undefined' || typeof globalThis.fetch !== 'function') return;
  const marker = '__atariEgressPaginationGuardInstalled';
  if ((globalThis as any)[marker]) return;
  (globalThis as any)[marker] = true;

  const nativeFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = input instanceof Request ? input : null;
    const url = request?.url || String(input);
    const method = String(init?.method || request?.method || 'GET').toUpperCase();
    const table = getTableName(url);

    if (method !== 'GET') {
      invalidateTableCache(table);
      return nativeFetch(input, init);
    }

    const tableTtl = table ? CACHED_TABLE_TTLS.get(table) : undefined;
    const key = cacheKeyFor(url, request, init);

    // Large products/customers reads keep their pagination protection.
    if (shouldPaginate(url, method, request, init)) {
      const cached = getCached(key);
      if (cached) return cached;

      const existingFlight = inFlightReads.get(key);
      if (existingFlight) return (await existingFlight).clone();

      const pagedPromise = (async () => {
        let from = 0;
        let allRows: any[] = [];
        let firstHeaders: Headers | null = null;
        let total: number | null = null;
        let firstStatus = 200;
        let firstStatusText = 'OK';

        while (true) {
          const to = from + PAGE_SIZE - 1;
          const [pagedInput, pagedInit] = buildPagedRequest(input, request, init, from, to);
          const response = await nativeFetch(pagedInput, pagedInit);

          if (!firstHeaders) {
            firstHeaders = new Headers(response.headers);
            firstStatus = response.status;
            firstStatusText = response.statusText;
          }

          if (!response.ok) return response;

          let rows: any[];
          try {
            const body = await response.json();
            rows = Array.isArray(body) ? body : [];
          } catch {
            return response;
          }

          allRows = mergeRows(allRows, rows);
          total = total ?? parseTotal(response.headers.get('content-range'));

          if (rows.length < PAGE_SIZE) break;
          if (total !== null && allRows.length >= total) break;
          from += PAGE_SIZE;
        }

        const headers = firstHeaders || new Headers();
        headers.set('content-type', 'application/json; charset=utf-8');
        headers.set('content-range', `0-${Math.max(0, allRows.length - 1)}/${total ?? allRows.length}`);
        headers.set('x-atari-paginated', 'true');
        headers.set('x-atari-page-size', String(PAGE_SIZE));

        const combined = new Response(JSON.stringify(allRows), {
          status: firstStatus === 206 ? 200 : firstStatus,
          statusText: firstStatusText,
          headers,
        });

        storeCached(key, combined, tableTtl ?? DEFAULT_HEAVY_READ_CACHE_TTL_MS);
        return combined;
      })().finally(() => inFlightReads.delete(key));

      inFlightReads.set(key, pagedPromise);
      return (await pagedPromise).clone();
    }

    // Exact-query cache/dedupe for accounting/reference tables. This does not alter query
    // semantics: the cache key contains the full URL (filters/select/order included).
    if (tableTtl) {
      const cached = getCached(key);
      if (cached) return cached;

      const existingFlight = inFlightReads.get(key);
      if (existingFlight) return (await existingFlight).clone();

      const readPromise = nativeFetch(input, init)
        .then(response => {
          storeCached(key, response, tableTtl);
          return response;
        })
        .finally(() => inFlightReads.delete(key));

      inFlightReads.set(key, readPromise);
      return (await readPromise).clone();
    }

    return nativeFetch(input, init);
  }) as typeof fetch;

  console.info('🛡️ Egress guard active: pagination for products/customers + dedupe cache for accounting/reference reads');
}

installEgressPaginationGuard();
