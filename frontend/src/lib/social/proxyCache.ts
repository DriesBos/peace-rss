import 'server-only';

export type SocialProxyCachedResponse = {
  body: string;
  contentType: string;
  cachedAt: number;
  expiresAt: number;
};

const cacheBySource = new Map<string, SocialProxyCachedResponse>();
const inFlightBySource = new Map<string, Promise<SocialProxyCachedResponse>>();
let readsSinceCleanup = 0;
// ponytail: process-local cache for one self-hosted instance; Redis only if this runs on multiple app replicas.
const MAX_CACHE_ITEMS = 500;

function cleanupExpired(now: number) {
  for (const [key, value] of cacheBySource.entries()) {
    if (value.expiresAt <= now) {
      cacheBySource.delete(key);
    }
  }
}

function setCachedSource(sourceKey: string, value: SocialProxyCachedResponse) {
  cacheBySource.delete(sourceKey);
  cacheBySource.set(sourceKey, value);
  while (cacheBySource.size > MAX_CACHE_ITEMS) {
    const oldestKey = cacheBySource.keys().next().value;
    if (oldestKey === undefined) break;
    cacheBySource.delete(oldestKey);
  }
}

export function getCachedSocialProxyResponse(
  sourceKey: string
): SocialProxyCachedResponse | null {
  const now = Date.now();
  readsSinceCleanup += 1;
  if (readsSinceCleanup >= 200) {
    cleanupExpired(now);
    readsSinceCleanup = 0;
  }

  const cached = cacheBySource.get(sourceKey);
  if (!cached) return null;
  if (cached.expiresAt <= now) {
    cacheBySource.delete(sourceKey);
    return null;
  }
  setCachedSource(sourceKey, cached);
  return cached;
}

export function setCachedSocialProxyResponse(
  sourceKey: string,
  value: { body: string; contentType: string },
  ttlMs: number
) {
  const now = Date.now();
  setCachedSource(sourceKey, {
    body: value.body,
    contentType: value.contentType,
    cachedAt: now,
    expiresAt: now + ttlMs,
  });
}

export async function coalesceSocialProxyRequest(
  sourceKey: string,
  producer: () => Promise<SocialProxyCachedResponse>
): Promise<SocialProxyCachedResponse> {
  const existing = inFlightBySource.get(sourceKey);
  if (existing) return existing;

  const promise = (async () => {
    try {
      return await producer();
    } finally {
      inFlightBySource.delete(sourceKey);
    }
  })();

  inFlightBySource.set(sourceKey, promise);
  return promise;
}
