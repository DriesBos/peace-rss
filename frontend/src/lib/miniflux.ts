import 'server-only';

/**
 * Minimal server-only Miniflux API client.
 * - Uses X-Auth-Token header (Miniflux API token)
 * - Reads MINIFLUX_BASE_URL from env (e.g. http://miniflux:8080)
 * - Disables caching to keep feed state current
 */

const baseUrl = (process.env.MINIFLUX_BASE_URL || '').replace(/\/+$/, '');
const apiToken = process.env.MINIFLUX_API_TOKEN || '';

function assertEnv() {
  if (!baseUrl) {
    throw new Error('MINIFLUX_BASE_URL is not set (e.g. http://miniflux:8080)');
  }
  if (!apiToken) {
    throw new Error('MINIFLUX_API_TOKEN is not set');
  }
}

export async function mfFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  assertEnv();

  const urlPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${baseUrl}${urlPath}`;

  const headers = new Headers(init.headers);
  headers.set('X-Auth-Token', apiToken);
  headers.set('Accept', 'application/json');

  // Only set Content-Type when we are sending a body
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    ...init,
    headers,
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Miniflux API error ${res.status} ${res.statusText} (${urlPath}) ${text}`
    );
  }

  // For endpoints that return no JSON body
  if (res.status === 204) return undefined as unknown as T;

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    // Some endpoints may return empty body or non-json; handle gracefully
    const text = await res.text().catch(() => '');
    return text as unknown as T;
  }

  return (await res.json()) as T;
}
