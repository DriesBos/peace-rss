import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { mfFetchUser } from '@/lib/miniflux';
import { normalizeSocialInput } from '@/lib/social/normalize';
import { buildSocialProxyFeedUrl, discoverBridgeFeedUrl } from '@/lib/social/rssBridge';
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

function isYouTubeHostName(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === 'youtube.com' ||
    host === 'www.youtube.com' ||
    host === 'm.youtube.com'
  );
}

function buildYouTubeFeedUrl(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
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

  if (
    YOUTUBE_HANDLE_RE.test(trimmed) &&
    !trimmed.includes('/') &&
    !trimmed.includes('://')
  ) {
    const handle = trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
    return new URL(`https://www.youtube.com/${handle}`);
  }

  const parsed = parseHttpUrl(trimmed);
  if (!parsed || !isYouTubeHostName(parsed.hostname)) return null;

  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length === 0) return null;
  const first = (segments[0] || '').toLowerCase();
  const second = segments[1] || '';

  if (first.startsWith('@')) {
    return new URL(`https://www.youtube.com/${segments[0]}`);
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

async function fetchYouTubeChannelIdFromLookupUrl(
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

async function resolveYouTubeFeedUrlFromInput(
  input: string
): Promise<string | null> {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (isYouTubeFeedUrl(trimmed)) return trimmed;

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

function pickDiscoveredFeedForSlugPath(
  inputUrl: URL,
  discovered: DiscoverResponse
): string | null {
  if (discovered.length === 0) return null;
  if (!hasSlugPath(inputUrl)) return discovered[0].url;

  const inputTerms = extractPathTerms(normalizePathname(inputUrl.pathname));
  if (inputTerms.length === 0) return null;

  const inputHref = inputUrl.toString();
  const inputOrigin = inputUrl.origin;

  for (const item of discovered) {
    if (item.url === inputHref) return item.url;
  }

  for (const item of discovered) {
    const candidate = parseHttpUrl(item.url);
    if (!candidate || candidate.origin !== inputOrigin) continue;
    const candidatePath = normalizePathname(candidate.pathname);
    if (candidatePath === '/') continue;
    const haystack = buildLowercaseHaystack(candidate);
    if (inputTerms.every((term) => haystack.includes(term))) {
      return item.url;
    }
  }

  for (const item of discovered) {
    const candidate = parseHttpUrl(item.url);
    if (!candidate || candidate.origin !== inputOrigin) continue;
    const candidatePath = normalizePathname(candidate.pathname);
    if (candidatePath === '/') continue;
    const haystack = buildLowercaseHaystack(candidate);
    if (inputTerms.some((term) => haystack.includes(term))) {
      return item.url;
    }
  }

  return null;
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

export async function POST(request: NextRequest) {
  let socialSourceContext: { platform: string; sourceKey: string } | null =
    null;
  let nonSocialSelectionDebug:
    | {
        strategy:
          | 'input_slug_or_path_match'
          | 'input_discovery_first_result'
          | 'base_discovery_fallback'
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

    const { feed_url, category_id, social } = body as CreateFeedRequest;
    const trimmedUrl = typeof feed_url === 'string' ? feed_url.trim() : '';
    const hasSocialPayload = Boolean(
      social &&
        typeof social === 'object' &&
        (typeof social.platform === 'string' || typeof social.handle === 'string')
    );

    if (!trimmedUrl && !hasSocialPayload) {
      return NextResponse.json(
        { error: 'feed_url or social payload is required' },
        { status: 400 }
      );
    }

    let feedUrlToCreate = trimmedUrl;
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
    } else {
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
        const inputHasSlugPath = parsedInputUrl ? hasSlugPath(parsedInputUrl) : false;
        const baseUrl = parsedInputUrl ? `${parsedInputUrl.origin}/` : '';
        let strategy:
          | 'input_slug_or_path_match'
          | 'input_discovery_first_result'
          | 'base_discovery_fallback'
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
          const preferredFeedUrl =
            parsedInputUrl && inputHasSlugPath
              ? pickDiscoveredFeedForSlugPath(parsedInputUrl, discoveredFromInput)
              : discoveredFromInput[0].url;

          if (preferredFeedUrl) {
            feedUrlToCreate = preferredFeedUrl;
            strategy = inputHasSlugPath
              ? 'input_slug_or_path_match'
              : 'input_discovery_first_result';
            console.log(
              `Discovered ${discoveredFromInput.length} feed(s) for input URL, using:`,
              feedUrlToCreate
            );
          } else {
            shouldFallbackToBase = Boolean(baseUrl && inputHasSlugPath);
            if (shouldFallbackToBase) {
              console.log(
                'Input discovery returned feeds but none matched slug path; trying base URL fallback...'
              );
            }
          }
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
            feedUrlToCreate = discoveredFromBase[0].url;
            strategy = 'base_discovery_fallback';
            console.log(
              `Discovered ${discoveredFromBase.length} feed(s) for base URL, using:`,
              feedUrlToCreate
            );
          } else {
            feedUrlToCreate = baseUrl;
            strategy = 'base_url_direct_fallback';
            console.log('No base URL feeds discovered, falling back to base URL');
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

    // 6. Create feed using the discovered or resolved URL
    const requestBody: {
      feed_url: string;
      category_id?: number;
      hide_globally?: boolean;
    } = {
      feed_url: feedUrlToCreate,
    };

    const isYoutubeFeed =
      isYouTubeFeedUrl(feedUrlToCreate) ||
      (trimmedUrl ? isYouTubeFeedUrl(trimmedUrl) : false);

    const forcedKind: ProtectedCategoryKind | null = isYoutubeFeed
      ? 'youtube'
      : socialSourceContext?.platform === 'instagram'
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

    const createdFeed = await mfFetchUser<CreateFeedResponse>(
      token,
      '/v1/feeds',
      {
        method: 'POST',
        body: JSON.stringify(requestBody),
      }
    );

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
            category: { id: forcedCategoryId },
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
