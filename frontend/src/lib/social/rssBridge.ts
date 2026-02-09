import 'server-only';

import type { NormalizedSocialFeedInput } from './types';
import { buildSocialSourceKeyFromInput } from './source';

type FindFeedItem = {
  url?: string;
};

const rssBridgeBaseUrl = (process.env.RSS_BRIDGE_BASE_URL || '').replace(/\/+$/, '');
const socialFeedsBaseUrl = (process.env.SOCIAL_FEEDS_BASE_URL || '').replace(/\/+$/, '');
const discoverCacheTtlMs = (() => {
  const value = Number(process.env.SOCIAL_DISCOVERY_CACHE_TTL_MS || '600000');
  if (!Number.isFinite(value) || value <= 0) return 600000;
  return Math.floor(value);
})();
const discoveryProbeTimeoutMs = (() => {
  const value = Number(process.env.SOCIAL_DISCOVERY_PROBE_TIMEOUT_MS || '5000');
  if (!Number.isFinite(value) || value <= 0) return 5000;
  return Math.floor(value);
})();
const discoverCacheBySource = new Map<
  string,
  { feedUrl: string; expiresAt: number }
>();
const discoverInFlightBySource = new Map<string, Promise<string>>();
let discoveryReadsSinceCleanup = 0;

function assertRssBridgeBaseUrl() {
  if (!rssBridgeBaseUrl) {
    throw new Error('RSS_BRIDGE_BASE_URL is not set');
  }
}

function assertSocialFeedsBaseUrl() {
  if (!socialFeedsBaseUrl) {
    throw new Error('SOCIAL_FEEDS_BASE_URL is not set');
  }
}

function cleanupDiscoveryCache(now: number) {
  for (const [key, value] of discoverCacheBySource.entries()) {
    if (value.expiresAt <= now) {
      discoverCacheBySource.delete(key);
    }
  }
}

function getCachedDiscoveryFeed(sourceKey: string): string | null {
  const now = Date.now();
  discoveryReadsSinceCleanup += 1;
  if (discoveryReadsSinceCleanup >= 100) {
    cleanupDiscoveryCache(now);
    discoveryReadsSinceCleanup = 0;
  }

  const cached = discoverCacheBySource.get(sourceKey);
  if (!cached) return null;
  if (cached.expiresAt <= now) {
    discoverCacheBySource.delete(sourceKey);
    return null;
  }
  return cached.feedUrl;
}

function buildProfileUrl(input: NormalizedSocialFeedInput): string {
  if (input.platform === 'instagram') {
    return `https://www.instagram.com/${input.handle}/`;
  }
  return `https://twitter.com/${input.handle}`;
}

function buildDiscoveryProfileUrls(input: NormalizedSocialFeedInput): string[] {
  if (input.platform === 'instagram') {
    return [buildProfileUrl(input)];
  }
  return [
    buildProfileUrl(input),
    `https://x.com/${input.handle}`,
  ];
}

function buildAuthorizationHeader(
  loginUsername?: string,
  loginPassword?: string
): string | undefined {
  if (!loginUsername || !loginPassword) return undefined;
  const token = Buffer.from(`${loginUsername}:${loginPassword}`).toString('base64');
  return `Basic ${token}`;
}

function toAbsoluteBridgeUrl(value: string): string {
  assertRssBridgeBaseUrl();
  const resolved = new URL(value, `${rssBridgeBaseUrl}/`);
  const bridgeOrigin = new URL(rssBridgeBaseUrl).origin;
  if (resolved.origin !== bridgeOrigin) {
    throw new Error('RSS-Bridge returned an unexpected feed origin');
  }
  return resolved.toString();
}

function bridgePriorityForCandidate(
  platform: NormalizedSocialFeedInput['platform'],
  bridgeUrl: string
): number {
  let bridgeName = '';
  try {
    bridgeName = (new URL(bridgeUrl)).searchParams.get('bridge') || '';
  } catch {
    bridgeName = '';
  }

  if (platform === 'twitter') {
    if (bridgeName === 'TwitterV2Bridge') return 0;
    if (bridgeName === 'TwitterBridge') return 1;
    if (bridgeName === 'NitterBridge') return 2;
    if (bridgeName === 'FarsideNitterBridge') return 9;
    return 5;
  }

  if (platform === 'instagram') {
    if (bridgeName === 'ImgsedBridge') return 0;
    if (bridgeName === 'InstagramBridge') return 1;
    return 5;
  }

  return 5;
}

async function probeBridgeFeedCandidate(
  bridgeUrl: string,
  authHeader?: string
): Promise<string | null> {
  const headers = new Headers({
    Accept: 'application/atom+xml, application/rss+xml, application/xml;q=0.9, */*;q=0.8',
  });
  if (authHeader) headers.set('Authorization', authHeader);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, discoveryProbeTimeoutMs);

  try {
    const res = await fetch(bridgeUrl, {
      method: 'GET',
      headers,
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return `probe(${bridgeUrl}) -> ${res.status} ${res.statusText} ${text}`.trim();
    }

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (
      !contentType.includes('xml') &&
      !contentType.includes('atom') &&
      !contentType.includes('rss')
    ) {
      return `probe(${bridgeUrl}) returned non-feed content-type: ${contentType || 'unknown'}`;
    }

    return null;
  } catch (err) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'name' in err &&
      (err as { name?: string }).name === 'AbortError'
    ) {
      return `probe(${bridgeUrl}) timed out after ${discoveryProbeTimeoutMs}ms`;
    }
    const message = err instanceof Error ? err.message : 'Unknown probe error';
    return `probe(${bridgeUrl}) failed: ${message}`;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function isBridgeFeedUrl(value: string): boolean {
  if (!rssBridgeBaseUrl) return false;
  try {
    const parsed = new URL(value);
    const base = new URL(rssBridgeBaseUrl);
    return parsed.origin === base.origin;
  } catch {
    return false;
  }
}

export async function discoverBridgeFeedUrl(
  input: NormalizedSocialFeedInput
): Promise<string> {
  assertRssBridgeBaseUrl();
  const sourceKey = buildSocialSourceKeyFromInput(input);

  const cached = getCachedDiscoveryFeed(sourceKey);
  if (cached) return cached;

  const existing = discoverInFlightBySource.get(sourceKey);
  if (existing) return existing;

  const discoveryPromise = (async () => {
    const profileUrls = buildDiscoveryProfileUrls(input);
    const authHeader = buildAuthorizationHeader(
      input.loginUsername,
      input.loginPassword
    );

    const errors: string[] = [];

    for (const profileUrl of profileUrls) {
      const discoveryUrl = new URL(
        '/?action=findfeed&format=Atom',
        `${rssBridgeBaseUrl}/`
      );
      discoveryUrl.searchParams.set('url', profileUrl);

      const headers = new Headers({
        Accept: 'application/json, text/plain;q=0.9, */*;q=0.8',
      });
      if (authHeader) headers.set('Authorization', authHeader);

      const res = await fetch(discoveryUrl.toString(), {
        method: 'GET',
        headers,
        cache: 'no-store',
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        errors.push(
          `findfeed(${profileUrl}) -> ${res.status} ${res.statusText} ${text}`.trim()
        );
        continue;
      }

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await res.text().catch(() => '');
        errors.push(
          `findfeed(${profileUrl}) returned non-JSON response: ${text}`.trim()
        );
        continue;
      }

      const items = (await res.json()) as FindFeedItem[];
      if (!Array.isArray(items) || items.length === 0) {
        errors.push(`findfeed(${profileUrl}) returned no feed candidates`);
        continue;
      }

      const absoluteCandidates = items
        .map((item) => item?.url)
        .filter((value): value is string => Boolean(value))
        .map((value) => {
          try {
            return toAbsoluteBridgeUrl(value);
          } catch {
            return null;
          }
        })
        .filter((value): value is string => Boolean(value));

      if (absoluteCandidates.length === 0) {
        errors.push(`findfeed(${profileUrl}) returned no valid bridge URLs`);
        continue;
      }

      const sortedCandidates = [...absoluteCandidates].sort((left, right) => {
        return (
          bridgePriorityForCandidate(input.platform, left) -
          bridgePriorityForCandidate(input.platform, right)
        );
      });

      const candidateErrors: string[] = [];
      for (const bridgeFeedUrl of sortedCandidates) {
        const probeError = await probeBridgeFeedCandidate(
          bridgeFeedUrl,
          authHeader
        );
        if (!probeError) {
          discoverCacheBySource.set(sourceKey, {
            feedUrl: bridgeFeedUrl,
            expiresAt: Date.now() + discoverCacheTtlMs,
          });
          return bridgeFeedUrl;
        }
        candidateErrors.push(probeError);
      }

      errors.push(...candidateErrors);
    }

    const joinedErrors = errors.join(' | ');
    if (joinedErrors.includes('No bridge found for given url')) {
      throw new Error(
        `No RSS-Bridge bridge found for ${input.platform}:${input.handle}. ` +
          'Ensure the required bridge is enabled/available in your RSS-Bridge instance.'
      );
    }

    throw new Error(
      `RSS-Bridge discovery failed for ${input.platform}:${input.handle}. ${joinedErrors}`.trim()
    );
  })().finally(() => {
    discoverInFlightBySource.delete(sourceKey);
  });

  discoverInFlightBySource.set(sourceKey, discoveryPromise);
  return discoveryPromise;
}

function bridgeNameFromUrl(bridgeUrl: string): string {
  try {
    return new URL(bridgeUrl).searchParams.get('bridge') || '';
  } catch {
    return '';
  }
}

async function discoverBridgeFeedCandidatesForUrl(
  sourceUrl: string
): Promise<string[]> {
  assertRssBridgeBaseUrl();

  const discoveryUrl = new URL('/?action=findfeed&format=Atom', `${rssBridgeBaseUrl}/`);
  discoveryUrl.searchParams.set('url', sourceUrl);

  const res = await fetch(discoveryUrl.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json, text/plain;q=0.9, */*;q=0.8',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `findfeed(${sourceUrl}) -> ${res.status} ${res.statusText} ${text}`.trim()
    );
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `findfeed(${sourceUrl}) returned non-JSON response: ${text}`.trim()
    );
  }

  const items = (await res.json()) as FindFeedItem[];
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error(`findfeed(${sourceUrl}) returned no feed candidates`);
  }

  const candidates = items
    .map((item) => item?.url)
    .filter((value): value is string => Boolean(value))
    .map((value) => {
      try {
        return toAbsoluteBridgeUrl(value);
      } catch {
        return null;
      }
    })
    .filter((value): value is string => Boolean(value));

  if (candidates.length === 0) {
    throw new Error(`findfeed(${sourceUrl}) returned no valid bridge URLs`);
  }

  return Array.from(new Set(candidates));
}

export async function discoverMediumBridgeFeedUrl(sourceUrl: string): Promise<string> {
  const candidates = await discoverBridgeFeedCandidatesForUrl(sourceUrl);

  const prioritized = [...candidates].sort((left, right) => {
    const leftBridge = bridgeNameFromUrl(left);
    const rightBridge = bridgeNameFromUrl(right);

    const leftScore = leftBridge === 'MediumBridge' ? 0 : 1;
    const rightScore = rightBridge === 'MediumBridge' ? 0 : 1;
    if (leftScore !== rightScore) return leftScore - rightScore;
    return left.localeCompare(right);
  });

  const errors: string[] = [];
  for (const candidate of prioritized) {
    const probeError = await probeBridgeFeedCandidate(candidate);
    if (!probeError) return candidate;
    errors.push(probeError);
  }

  throw new Error(
    `RSS-Bridge Medium fallback failed for ${sourceUrl}. ${errors.join(' | ')}`.trim()
  );
}

export function buildSocialProxyFeedUrl(token: string): string {
  assertSocialFeedsBaseUrl();
  return `${socialFeedsBaseUrl}/api/social/rss/${encodeURIComponent(token)}`;
}
