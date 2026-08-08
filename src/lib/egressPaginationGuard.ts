const PAGE_SIZE = 250;
const HEAVY_READ_CACHE_TTL_MS = 5 * 60_000;
const TARGET_TABLES = new Set(['products', 'customers']);

type CachedResponse = {
  expiresAt: number;
  response: Response;
};

const heavyReadCache = new Map<string, CachedResponse>();
const inFlightHeavyReads = new Map<string, Promise<Response>>();

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
  if (!table || !TARGET_TABLES.has(table)) return false;
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
  return `${url}|${headers.get('authorization') || ''}|${headers.get('apikey') || ''}`;
}

function invalidateTableCache(table: string | null): void {
  if (!table) return;
  for (const key of heavyReadCache.keys()) {
    if (key.includes(`/rest/v1/${table}`)) heavyReadCache.delete(key);
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
      if (table && TARGET_TABLES.has(table)) invalidateTableCache(table);
      return nativeFetch(input, init);
    }

    if (!shouldPaginate(url, method, request, init)) {
      return nativeFetch(input, init);
    }

    const key = cacheKeyFor(url, request, init);
    const now = Date.now();
    const cached = heavyReadCache.get(key);
    if (cached && cached.expiresAt > now) return cached.response.clone();
    if (cached) heavyReadCache.delete(key);

    const existingFlight = inFlightHeavyReads.get(key);
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

        if (!response.ok) {
          return response;
        }

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

      heavyReadCache.set(key, {
        expiresAt: Date.now() + HEAVY_READ_CACHE_TTL_MS,
        response: combined.clone(),
      });

      return combined;
    })().finally(() => {
      inFlightHeavyReads.delete(key);
    });

    inFlightHeavyReads.set(key, pagedPromise);
    return (await pagedPromise).clone();
  }) as typeof fetch;

  console.info(`🛡️ Egress pagination guard active for products/customers (${PAGE_SIZE} rows per request, 5 min cache)`);
}

installEgressPaginationGuard();
