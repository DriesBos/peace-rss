import 'server-only';

/**
 * Minimal server-only Miniflux API client.
 * - mfFetchUser: Uses per-user X-Auth-Token header
 * - mfFetchAdmin: Uses Basic Auth with admin credentials
 * - Reads MINIFLUX_BASE_URL from env (e.g. http://miniflux:8080)
 * - Disables caching to keep feed state current
 */

const baseUrl = (process.env.MINIFLUX_BASE_URL || '').replace(/\/+$/, '');
const adminUsername = process.env.MINIFLUX_ADMIN_USERNAME || '';
const adminPassword = process.env.MINIFLUX_ADMIN_PASSWORD || '';

function assertBaseUrl() {
  if (!baseUrl) {
    throw new Error('MINIFLUX_BASE_URL is not set (e.g. http://miniflux:8080)');
  }
}

function assertAdminEnv() {
  assertBaseUrl();
  if (!adminUsername) {
    throw new Error('MINIFLUX_ADMIN_USERNAME is not set');
  }
  if (!adminPassword) {
    throw new Error('MINIFLUX_ADMIN_PASSWORD is not set');
  }
}

/**
 * Fetch Miniflux API with per-user token
 */
export async function mfFetchUser<T>(
  token: string,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  assertBaseUrl();

  if (!token) {
    throw new Error('User token is required');
  }

  const urlPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${baseUrl}${urlPath}`;

  const headers = new Headers(init.headers);
  headers.set('X-Auth-Token', token);
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

/**
 * Fetch Miniflux API with admin Basic Auth
 */
export async function mfFetchAdmin<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  assertAdminEnv();

  const urlPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${baseUrl}${urlPath}`;

  const headers = new Headers(init.headers);
  const basicAuth = Buffer.from(`${adminUsername}:${adminPassword}`).toString(
    'base64'
  );
  headers.set('Authorization', `Basic ${basicAuth}`);
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

/**
 * Fetch Miniflux API with per-user Basic Auth (username + password)
 * Used during provisioning to create API keys for newly created users
 */
export async function mfFetchUserBasicAuth<T>(
  username: string,
  password: string,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  assertBaseUrl();

  const urlPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${baseUrl}${urlPath}`;

  const headers = new Headers(init.headers);
  const basicAuth = Buffer.from(`${username}:${password}`).toString('base64');
  headers.set('Authorization', `Basic ${basicAuth}`);
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
