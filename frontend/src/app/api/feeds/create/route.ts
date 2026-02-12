import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { mfFetchUser } from '@/lib/miniflux';
import { normalizeSocialInput } from '@/lib/social/normalize';
import {
  buildSocialProxyFeedUrl,
  discoverBridgeFeedUrl,
  discoverMediumBridgeFeedUrl,
} from '@/lib/social/rssBridge';
import { checkRateLimit } from '@/lib/social/rateLimit';
import { encodeSocialFeedToken } from '@/lib/social/token';
import { buildSocialSourceKeyFromInput } from '@/lib/social/source';
import {
  incrementSocialMetric,
  recordSocialEvent,
} from '@/lib/social/metrics';
import { isYouTubeFeedUrl } from '@/lib/youtube';
import {
  isProtectedCategoryTitle,
  normalizeCategoryTitle,
  protectedCategoryTitleForKind,
  type ProtectedCategoryKind,
} from '@/lib/protectedCategories';
import type {
  NormalizedSocialFeedInput,
  SocialFeedRequestInput,
} from '@/lib/social/types';

export const runtime = 'nodejs';

const socialCreateLimitPerMinute = (() => {
  const value = Number(process.env.SOCIAL_CREATE_RATE_LIMIT_PER_MINUTE || '20');
  if (!Number.isFinite(value) || value <= 0) return 20;
  return Math.floor(value);
})();
const youtubeResolveTimeoutMs = (() => {
  const value = Number(process.env.YOUTUBE_RESOLVE_TIMEOUT_MS || '6000');
  if (!Number.isFinite(value) || value <= 0) return 6000;
  return Math.floor(value);
})();

type CreateFeedRequest = {
  feed_url?: string;
  category_id?: number;
  selected_feed_url?: string;
  social?: SocialFeedRequestInput;
};

type MinifluxCategory = {
  id: number;
  user_id: number;
  title: string;
};

type DiscoveredFeed = {
  url: string;
  title: string;
  type: string;
};

type DiscoverResponse = DiscoveredFeed[];

type CreateFeedResponse = {
  id: number;
  user_id: number;
  feed_url: string;
  site_url: string;
  title: string;
  checked_at: string;
  next_check_at: string;
  etag_header: string;
  last_modified_header: string;
  parsing_error_message: string;
  parsing_error_count: number;
  scraper_rules: string;
  rewrite_rules: string;
  crawler: boolean;
  blocklist_rules: string;
  keeplist_rules: string;
  user_agent: string;
  cookie: string;
  username: string;
  password: string;
  disabled: boolean;
  ignore_http_cache: boolean;
  fetch_via_proxy: boolean;
  category: {
    id: number;
    title: string;
  };
  hide_globally: boolean;
};
const YOUTUBE_CHANNEL_ID_RE = /^UC[a-zA-Z0-9_-]{22}$/;
const YOUTUBE_HANDLE_RE = /^@?[a-zA-Z0-9._-]{3,30}$/;
const YOUTUBE_BARE_WORD_RE = /^[a-zA-Z0-9._-]{1,30}$/;

function isYouTubeHostName(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === 'youtube.com' ||
    host === 'www.youtube.com' ||
    host === 'm.youtube.com'
  );
}

function buildYouTubeLongFormPlaylistId(channelId: string): string {
  return `UULF${channelId.slice(2)}`;
}

function buildYouTubeFeedUrl(channelId: string): string {
  const playlistId = buildYouTubeLongFormPlaylistId(channelId);
  return `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(playlistId)}`;
}

function extractYouTubeChannelIdFromPath(url: URL): string | null {
  const segments = url.pathname.split('/').filter(Boolean);
  if (
    segments.length >= 2 &&
    segments[0]?.toLowerCase() === 'channel' &&
    YOUTUBE_CHANNEL_ID_RE.test(segments[1] || '')
  ) {
    return segments[1] || null;
  }
  return null;
}

function normalizeYouTubeLookupUrl(input: string): URL | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Treat bare one-word input as a YouTube handle.
  if (
    YOUTUBE_BARE_WORD_RE.test(trimmed) &&
    !trimmed.startsWith('@') &&
    !trimmed.includes('/') &&
    !trimmed.includes('://')
  ) {
    return new URL(`https://www.youtube.com/@${trimmed}/videos`);
  }

  if (
    YOUTUBE_HANDLE_RE.test(trimmed) &&
    !trimmed.includes('/') &&
    !trimmed.includes('://')
  ) {
    const handle = trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
    return new URL(`https://www.youtube.com/${handle}/videos`);
  }

  const parsed = parseHttpUrl(trimmed);
  if (!parsed || !isYouTubeHostName(parsed.hostname)) return null;

  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length === 0) return null;
  const first = (segments[0] || '').toLowerCase();
  const second = segments[1] || '';

  if (first.startsWith('@')) {
    return new URL(`https://www.youtube.com/${segments[0]}/videos`);
  }
  if (first === 'channel' && second) {
    return new URL(`https://www.youtube.com/channel/${second}`);
  }
  if ((first === 'c' || first === 'user') && second) {
    return new URL(`https://www.youtube.com/${first}/${second}`);
  }

  return null;
}

function extractYouTubeChannelIdFromHtml(html: string): string | null {
  const patterns = [
    /"channelId":"(UC[a-zA-Z0-9_-]{22})"/,
    /"externalId":"(UC[a-zA-Z0-9_-]{22})"/,
    /"browseId":"(UC[a-zA-Z0-9_-]{22})"/,
    /itemprop="identifier"\s+content="(UC[a-zA-Z0-9_-]{22})"/i,
    /\/channel\/(UC[a-zA-Z0-9_-]{22})/,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    const candidate = match?.[1];
    if (candidate && YOUTUBE_CHANNEL_ID_RE.test(candidate)) {
      return candidate;
    }
  }

  return null;
}

function buildYouTubeLookupCandidates(lookupUrl: URL): URL[] {
  const candidates: URL[] = [new URL(lookupUrl.toString())];
  const segments = lookupUrl.pathname.split('/').filter(Boolean);
  const first = segments[0] || '';
  const second = (segments[1] || '').toLowerCase();

  if (first.startsWith('@') && second !== 'videos') {
    candidates.push(new URL(`https://www.youtube.com/${first}/videos`));
  }

  const deduped = new Map<string, URL>();
  for (const candidate of candidates) {
    deduped.set(candidate.toString(), candidate);
  }
  return Array.from(deduped.values());
}

async function fetchYouTubeChannelIdFromUrl(
  lookupUrl: URL
): Promise<string | null> {
  const direct = extractYouTubeChannelIdFromPath(lookupUrl);
  if (direct) return direct;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, youtubeResolveTimeoutMs);

  try {
    const res = await fetch(lookupUrl.toString(), {
      method: 'GET',
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      cache: 'no-store',
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!res.ok) return null;

    const finalUrl = parseHttpUrl(res.url);
    const finalChannelId = finalUrl
      ? extractYouTubeChannelIdFromPath(finalUrl)
      : null;
    if (finalChannelId) return finalChannelId;

    const html = await res.text();
    return extractYouTubeChannelIdFromHtml(html);
  } catch (err) {
    console.log('YouTube channel resolution failed:', err);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchYouTubeChannelIdFromLookupUrl(
  lookupUrl: URL
): Promise<string | null> {
  const candidates = buildYouTubeLookupCandidates(lookupUrl);
  for (const candidate of candidates) {
    const channelId = await fetchYouTubeChannelIdFromUrl(candidate);
    if (channelId) return channelId;
  }
  return null;
}

async function resolveYouTubeFeedUrlFromInput(
  input: string
): Promise<string | null> {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (isYouTubeFeedUrl(trimmed)) {
    const parsed = parseHttpUrl(trimmed);
    if (!parsed) return trimmed;
    const channelId = parsed.searchParams.get('channel_id');
    if (channelId && YOUTUBE_CHANNEL_ID_RE.test(channelId)) {
      return buildYouTubeFeedUrl(channelId);
    }
    return trimmed;
  }

  const lookupUrl = normalizeYouTubeLookupUrl(trimmed);
  if (!lookupUrl) return null;

  const channelId = await fetchYouTubeChannelIdFromLookupUrl(lookupUrl);
  if (!channelId) return null;

  return buildYouTubeFeedUrl(channelId);
}

function normalizePathname(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, '');
  return normalized || '/';
}

function parseHttpUrl(value: string): URL | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed;
  } catch {
    return null;
  }
}

function isMediumHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'medium.com' || host === 'www.medium.com' || host.endsWith('.medium.com');
}

function resolveMediumFeedUrlFromInput(input: string): string | null {
  const parsed = parseHttpUrl(input);
  if (!parsed || !isMediumHostname(parsed.hostname)) return null;

  const host = parsed.hostname.toLowerCase();
  const pathname = normalizePathname(parsed.pathname);

  if (host !== 'medium.com' && host !== 'www.medium.com') {
    if (pathname === '/feed' || pathname.startsWith('/feed/')) {
      return parsed.toString();
    }
    return `${parsed.origin}/feed`;
  }

  if (pathname === '/' || pathname === '/feed') {
    return pathname === '/feed' ? parsed.toString() : null;
  }

  if (pathname.startsWith('/feed/')) {
    return parsed.toString();
  }

  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return null;
  const target = segments[0];
  if (!target) return null;
  return `https://medium.com/feed/${encodeURIComponent(target)}`;
}

function hasSlugPath(url: URL): boolean {
  return normalizePathname(url.pathname) !== '/';
}

function buildLowercaseHaystack(url: URL): string {
  return `${normalizePathname(url.pathname)}${url.search}`.toLowerCase();
}

function extractPathTerms(pathname: string): string[] {
  return pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment).trim().toLowerCase();
      } catch {
        return segment.trim().toLowerCase();
      }
    })
    .filter(Boolean);
}

function isLikelyInputPathMatch(inputUrl: URL, candidateFeedUrl: string): boolean {
  if (!hasSlugPath(inputUrl)) return true;

  const candidate = parseHttpUrl(candidateFeedUrl);
  if (!candidate) return false;

  if (candidate.toString() === inputUrl.toString()) return true;
  if (candidate.origin !== inputUrl.origin) return false;

  const candidatePath = normalizePathname(candidate.pathname);
  if (
    candidatePath === '/' ||
    candidatePath.startsWith('/feed') ||
    candidatePath.startsWith('/rss')
  ) {
    return false;
  }

  const stopTerms = new Set([
    'author',
    'authors',
    'contributor',
    'contributors',
    'tag',
    'tags',
    'category',
    'categories',
    'section',
    'sections',
  ]);

  const inputTerms = extractPathTerms(normalizePathname(inputUrl.pathname));
  const meaningfulTerms = inputTerms.filter(
    (term) => term.length >= 3 && !stopTerms.has(term),
  );
  const termsToMatch = meaningfulTerms.length > 0 ? meaningfulTerms : inputTerms;
  if (termsToMatch.length === 0) return false;

  const haystack = buildLowercaseHaystack(candidate);
  return termsToMatch.every((term) => haystack.includes(term));
}

async function discoverFeedsForUrl(
  token: string,
  url: string
): Promise<DiscoverResponse> {
  return mfFetchUser<DiscoverResponse>(token, '/v1/discover', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

async function tryDiscoverFeedsForUrl(
  token: string,
  url: string,
  label: string
): Promise<DiscoverResponse | null> {
  try {
    console.log(`Attempting feed discovery for ${label}...`);
    return await discoverFeedsForUrl(token, url);
  } catch (discoverErr) {
    console.log(`Feed discovery failed for ${label}:`, discoverErr);
    return null;
  }
}

async function tryDiscoverMediumFeedViaBridge(
  inputUrl: string
): Promise<string | null> {
  try {
    console.log('Attempting RSS-Bridge fallback for Medium URL...');
    return await discoverMediumBridgeFeedUrl(inputUrl);
  } catch (bridgeErr) {
    console.log('RSS-Bridge Medium fallback failed:', bridgeErr);
    return null;
  }
}

function isMinifluxForbiddenFetcherError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const message = err.message.toLowerCase();
  return (
    message.includes('(/v1/feeds)') &&
    (message.includes('access forbidden (403') ||
      message.includes('403 status code') ||
      message.includes('status code 403'))
  );
}

export async function POST(request: NextRequest) {
  let socialSourceContext: { platform: string; sourceKey: string } | null =
    null;
  let nonSocialSelectionDebug:
    | {
        strategy:
          | 'medium_url_rewrite'
          | 'input_slug_or_path_match'
          | 'input_discovery_first_result'
          | 'base_discovery_fallback'
          | 'medium_rss_bridge_fallback'
          | 'base_url_direct_fallback'
          | 'youtube_input_resolved'
          | 'input_direct_fallback';
        inputUrl: string;
        resolvedUrl: string;
        inputHasSlugPath: boolean;
        baseUrl: string | null;
        inputDiscoveryCount: number | null;
        baseDiscoveryCount: number | null;
      }
    | null = null;

  try {
    // 1. Require Clerk authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get user's Miniflux token from Clerk metadata
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const metadata = user.privateMetadata as
      | { minifluxToken?: string }
      | undefined;
    const token = metadata?.minifluxToken;

    if (!token) {
      return NextResponse.json(
        { error: 'User not provisioned' },
        { status: 400 }
      );
    }

    // 3. Parse request body
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { feed_url, category_id, selected_feed_url, social } =
      body as CreateFeedRequest;
    const trimmedUrl = typeof feed_url === 'string' ? feed_url.trim() : '';
    const trimmedSelectedFeedUrl =
      typeof selected_feed_url === 'string' ? selected_feed_url.trim() : '';
    const hasSocialPayload = Boolean(
      social &&
        typeof social === 'object' &&
        (typeof social.platform === 'string' || typeof social.handle === 'string')
    );

    if (!trimmedUrl && !trimmedSelectedFeedUrl && !hasSocialPayload) {
      return NextResponse.json(
        { error: 'feed_url, selected_feed_url, or social payload is required' },
        { status: 400 }
      );
    }

    let feedUrlToCreate = trimmedSelectedFeedUrl || trimmedUrl;
    console.log('Creating feed with input:', {
      hasUrl: Boolean(trimmedUrl),
      hasSocialPayload: Boolean(hasSocialPayload),
      category_id,
    });

    // 4. Social source path (Instagram / Twitter via RSS-Bridge)
    if (hasSocialPayload) {
      const createRate = checkRateLimit(`social-create:user:${userId}`, {
        max: socialCreateLimitPerMinute,
        windowMs: 60_000,
      });
      if (!createRate.allowed) {
        incrementSocialMetric('social_create_rate_limited_total');
        recordSocialEvent('social_create_rate_limited', {
          retry_after_seconds: createRate.retryAfterSeconds,
        });
        return NextResponse.json(
          {
            error: `Too many social feed requests. Retry in ${createRate.retryAfterSeconds}s.`,
          },
          {
            status: 429,
            headers: {
              'Retry-After': String(createRate.retryAfterSeconds),
            },
          }
        );
      }

      let normalizedSocialInput: NormalizedSocialFeedInput;
      try {
        normalizedSocialInput = normalizeSocialInput(
          social as SocialFeedRequestInput
        );
      } catch (socialErr) {
        incrementSocialMetric('social_create_invalid_input_total');
        return NextResponse.json(
          {
            error:
              socialErr instanceof Error
                ? socialErr.message
                : 'Invalid social payload',
          },
          { status: 400 }
        );
      }

      const sourceKey = buildSocialSourceKeyFromInput(normalizedSocialInput);
      socialSourceContext = {
        platform: normalizedSocialInput.platform,
        sourceKey,
      };
      incrementSocialMetric('social_create_attempts_total', {
        platform: normalizedSocialInput.platform,
      });
      recordSocialEvent('social_create_attempt', {
        platform: normalizedSocialInput.platform,
        source_key: sourceKey,
      });

      const bridgeFeedUrl = await discoverBridgeFeedUrl(normalizedSocialInput);
      const tokenPayload = {
        version: 1 as const,
        platform: normalizedSocialInput.platform,
        handle: normalizedSocialInput.handle,
        bridgeFeedUrl,
        bridgeLoginUsername: normalizedSocialInput.loginUsername,
        bridgeLoginPassword: normalizedSocialInput.loginPassword,
      };

      const socialToken = encodeSocialFeedToken(tokenPayload);
      feedUrlToCreate = buildSocialProxyFeedUrl(socialToken);
    } else if (!trimmedSelectedFeedUrl) {
      const resolvedYouTubeFeedUrl = await resolveYouTubeFeedUrlFromInput(trimmedUrl);
      if (resolvedYouTubeFeedUrl) {
        feedUrlToCreate = resolvedYouTubeFeedUrl;
        nonSocialSelectionDebug = {
          strategy: 'youtube_input_resolved',
          inputUrl: trimmedUrl,
          resolvedUrl: feedUrlToCreate,
          inputHasSlugPath: false,
          baseUrl: null,
          inputDiscoveryCount: null,
          baseDiscoveryCount: null,
        };
        console.log(
          'Resolved YouTube input to feed URL:',
          nonSocialSelectionDebug,
        );
      } else {
        // 5. Standard URL path: prefer slug-aware discovery, then fallback to base URL
        const parsedInputUrl = parseHttpUrl(trimmedUrl);
        const resolvedMediumFeedUrl = resolveMediumFeedUrlFromInput(trimmedUrl);
        if (resolvedMediumFeedUrl) {
          feedUrlToCreate = resolvedMediumFeedUrl;
          nonSocialSelectionDebug = {
            strategy: 'medium_url_rewrite',
            inputUrl: trimmedUrl,
            resolvedUrl: feedUrlToCreate,
            inputHasSlugPath: Boolean(parsedInputUrl && hasSlugPath(parsedInputUrl)),
            baseUrl: parsedInputUrl ? `${parsedInputUrl.origin}/` : null,
            inputDiscoveryCount: null,
            baseDiscoveryCount: null,
          };
          console.log(
            'Resolved Medium input to canonical feed URL:',
            nonSocialSelectionDebug,
          );
        } else {
          const inputHasSlugPath = parsedInputUrl ? hasSlugPath(parsedInputUrl) : false;
          const baseUrl = parsedInputUrl ? `${parsedInputUrl.origin}/` : '';
          let strategy:
            | 'input_slug_or_path_match'
            | 'input_discovery_first_result'
            | 'base_discovery_fallback'
            | 'medium_rss_bridge_fallback'
            | 'base_url_direct_fallback'
            | 'input_direct_fallback' = 'input_direct_fallback';
          let inputDiscoveryCount: number | null = null;
          let baseDiscoveryCount: number | null = null;

          const discoveredFromInput = await tryDiscoverFeedsForUrl(
            token,
            trimmedUrl,
            'input URL'
          );
          inputDiscoveryCount = discoveredFromInput ? discoveredFromInput.length : null;

          let shouldFallbackToBase = false;
          if (discoveredFromInput && discoveredFromInput.length > 0) {
            if (discoveredFromInput.length > 1) {
              return NextResponse.json({
                requires_selection: true,
                subscriptions: discoveredFromInput,
                source: 'input_url',
                notice:
                  'Multiple feeds were discovered for this URL. Choose one to continue.',
              });
            }

            const singleDiscovered = discoveredFromInput[0];
            if (
              parsedInputUrl &&
              inputHasSlugPath &&
              singleDiscovered &&
              !isLikelyInputPathMatch(parsedInputUrl, singleDiscovered.url)
            ) {
              return NextResponse.json({
                requires_selection: true,
                subscriptions: discoveredFromInput,
                source: 'input_url',
                notice:
                  'No feed matched this exact URL path. Review the suggested feed and submit again to confirm.',
              });
            }

            feedUrlToCreate = singleDiscovered?.url ?? discoveredFromInput[0].url;
            strategy = inputHasSlugPath
              ? 'input_slug_or_path_match'
              : 'input_discovery_first_result';
            console.log(
              `Discovered ${discoveredFromInput.length} feed(s) for input URL, using:`,
              feedUrlToCreate
            );
          } else {
            shouldFallbackToBase = Boolean(baseUrl && inputHasSlugPath);
            if (!shouldFallbackToBase) {
              console.log('No feeds discovered for input URL, will try direct URL');
            }
          }

          if (shouldFallbackToBase && baseUrl) {
            const discoveredFromBase = await tryDiscoverFeedsForUrl(
              token,
              baseUrl,
              'base URL'
            );
            baseDiscoveryCount = discoveredFromBase ? discoveredFromBase.length : null;
            if (discoveredFromBase && discoveredFromBase.length > 0) {
              // Don't silently downgrade a path-specific URL to a site-wide feed.
              // Require an explicit user choice, even when only one fallback feed exists.
              return NextResponse.json({
                requires_selection: true,
                subscriptions: discoveredFromBase,
                source: 'base_url',
                notice:
                  'No feed matched this exact URL path. Review the suggested site-level feed and submit again to confirm.',
              });
            } else {
              feedUrlToCreate = baseUrl;
              strategy = 'base_url_direct_fallback';
              console.log('No base URL feeds discovered, falling back to base URL');
            }
          }

          const canTryMediumBridgeFallback = Boolean(
            parsedInputUrl &&
              isMediumHostname(parsedInputUrl.hostname) &&
              (strategy === 'input_direct_fallback' ||
                strategy === 'base_url_direct_fallback')
          );

          if (canTryMediumBridgeFallback) {
            const mediumBridgeFeedUrl = await tryDiscoverMediumFeedViaBridge(trimmedUrl);
            if (mediumBridgeFeedUrl) {
              feedUrlToCreate = mediumBridgeFeedUrl;
              strategy = 'medium_rss_bridge_fallback';
              console.log('Using RSS-Bridge Medium feed URL:', mediumBridgeFeedUrl);
            }
          }

          nonSocialSelectionDebug = {
            strategy,
            inputUrl: trimmedUrl,
            resolvedUrl: feedUrlToCreate,
            inputHasSlugPath,
            baseUrl: baseUrl || null,
            inputDiscoveryCount,
            baseDiscoveryCount,
          };
          console.log('Non-social feed selection debug:', nonSocialSelectionDebug);
        }
      }
    }

    // 6. Create feed using the discovered or resolved URL
    const requestBody: {
      feed_url: string;
      category_id?: number;
      hide_globally?: boolean;
      blocklist_rules?: string;
    } = {
      feed_url: feedUrlToCreate,
    };

    const forcedKind: ProtectedCategoryKind | null =
      socialSourceContext?.platform === 'instagram'
        ? 'instagram'
        : socialSourceContext?.platform === 'twitter'
          ? 'twitter'
          : null;

    let forcedCategoryId: number | null = null;
    let forcedCategoryTitle: string | null = null;

    if (forcedKind) {
      forcedCategoryTitle = protectedCategoryTitleForKind(forcedKind);
      requestBody.hide_globally = true;
      try {
        const categories = await mfFetchUser<MinifluxCategory[]>(
          token,
          '/v1/categories',
        );
        const existing = categories.find(
          (cat) => normalizeCategoryTitle(cat.title) === forcedKind,
        );
        if (existing) {
          forcedCategoryId = existing.id;
        } else {
          const created = await mfFetchUser<MinifluxCategory>(
            token,
            '/v1/categories',
            {
              method: 'POST',
              body: JSON.stringify({ title: forcedCategoryTitle }),
            },
          );
          forcedCategoryId = created.id;
        }
        requestBody.category_id = forcedCategoryId;
      } catch (categoryErr) {
        console.warn('Failed to ensure protected category:', categoryErr);
        return NextResponse.json(
          { error: `Failed to ensure ${forcedCategoryTitle} category.` },
          { status: 500 },
        );
      }
    } else if (category_id && typeof category_id === 'number') {
      // Disallow assigning feeds into protected categories directly.
      const categories = await mfFetchUser<MinifluxCategory[]>(
        token,
        '/v1/categories',
      );
      const target = categories.find((cat) => cat.id === category_id);
      if (target && isProtectedCategoryTitle(target.title)) {
        return NextResponse.json(
          { error: `${target.title.trim()} category is managed automatically.` },
          { status: 400 },
        );
      }
      requestBody.category_id = category_id;
    }

    let createdFeed: CreateFeedResponse;
    try {
      createdFeed = await mfFetchUser<CreateFeedResponse>(
        token,
        '/v1/feeds',
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
        }
      );
    } catch (createErr) {
      const parsedInputForRetry = parseHttpUrl(trimmedUrl);
      const isMediumInput = Boolean(
        parsedInputForRetry && isMediumHostname(parsedInputForRetry.hostname)
      );
      const alreadyUsingMediumBridge =
        nonSocialSelectionDebug?.strategy === 'medium_rss_bridge_fallback';
      const canRetryWithMediumBridge =
        !hasSocialPayload &&
        isMediumInput &&
        !alreadyUsingMediumBridge &&
        isMinifluxForbiddenFetcherError(createErr);

      if (!canRetryWithMediumBridge) {
        throw createErr;
      }

      console.log(
        'Miniflux rejected Medium feed URL; retrying via RSS-Bridge fallback...'
      );
      const mediumBridgeFeedUrl = await tryDiscoverMediumFeedViaBridge(trimmedUrl);
      if (!mediumBridgeFeedUrl) {
        throw createErr;
      }

      requestBody.feed_url = mediumBridgeFeedUrl;
      if (nonSocialSelectionDebug) {
        nonSocialSelectionDebug.strategy = 'medium_rss_bridge_fallback';
        nonSocialSelectionDebug.resolvedUrl = mediumBridgeFeedUrl;
      }

      createdFeed = await mfFetchUser<CreateFeedResponse>(token, '/v1/feeds', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
    }

    if (socialSourceContext) {
      incrementSocialMetric('social_create_success_total', {
        platform: socialSourceContext.platform,
      });
      recordSocialEvent('social_create_success', {
        platform: socialSourceContext.platform,
        source_key: socialSourceContext.sourceKey,
      });
    }

    if (forcedKind && forcedCategoryId) {
      try {
        await mfFetchUser(token, `/v1/feeds/${createdFeed.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            hide_globally: true,
            category_id: forcedCategoryId,
          }),
        });
        createdFeed.hide_globally = true;
        createdFeed.category =
          createdFeed.category ??
          (forcedCategoryTitle
            ? { id: forcedCategoryId, title: forcedCategoryTitle }
            : createdFeed.category);
      } catch (updateErr) {
        console.warn('Failed to mark protected feed as hidden globally:', updateErr);
      }
    }

    return NextResponse.json(createdFeed);
  } catch (err) {
    if (socialSourceContext) {
      incrementSocialMetric('social_create_failures_total', {
        platform: socialSourceContext.platform,
      });
      recordSocialEvent('social_create_failure', {
        platform: socialSourceContext.platform,
        source_key: socialSourceContext.sourceKey,
        message: err instanceof Error ? err.message : 'Unknown social create error',
      });
    }

    console.error('Failed to create feed:', err);

    // Provide more helpful error messages
    let errorMessage = err instanceof Error ? err.message : 'Unknown error';
    let status = 500;

    if (errorMessage.includes('unable to detect feed format')) {
      errorMessage =
        'Unable to find or parse a feed at this URL. Please check that:\n' +
        '• The URL is accessible\n' +
        '• The URL includes http:// or https://\n' +
        '• The page contains an RSS/Atom feed or links to one';
    }

    const isSocialProxyTimeout =
      errorMessage.includes('/api/social/rss/') &&
      (errorMessage.includes('context deadline exceeded') ||
        errorMessage.includes('gateway timeout (504 status code)') ||
        errorMessage.includes('Upstream RSS-Bridge timed out') ||
        errorMessage.includes('Failed to reach RSS-Bridge upstream'));

    if (isSocialProxyTimeout) {
      status = 504;
      errorMessage =
        'The social feed source is taking too long to respond. ' +
        'Please try again in a moment. If this keeps happening, check RSS-Bridge availability.';
    }

    return NextResponse.json({ error: errorMessage }, { status });
  }
}
