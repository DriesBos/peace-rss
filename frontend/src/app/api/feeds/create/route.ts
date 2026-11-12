import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { apiErrorStatus } from '@/lib/apiErrors';
import { MinifluxApiError, mfFetchUser } from '@/lib/miniflux';
import { isYouTubeFeedUrl } from '@/lib/youtube';

export const runtime = 'nodejs';

const youtubeResolveTimeoutMs = (() => {
  const value = Number(process.env.YOUTUBE_RESOLVE_TIMEOUT_MS || '6000');
  if (!Number.isFinite(value) || value <= 0) return 6000;
  return Math.floor(value);
})();

type CreateFeedRequest = {
  feed_url?: string;
  category_id?: number;
  selected_feed_url?: string;
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

export async function POST(request: NextRequest) {
  let selectionDebug:
    | {
        strategy:
          | 'medium_url_rewrite'
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

    const { feed_url, category_id, selected_feed_url } =
      body as CreateFeedRequest;
    const trimmedUrl = typeof feed_url === 'string' ? feed_url.trim() : '';
    const trimmedSelectedFeedUrl =
      typeof selected_feed_url === 'string' ? selected_feed_url.trim() : '';

    if (!trimmedUrl && !trimmedSelectedFeedUrl) {
      return NextResponse.json(
        { error: 'feed_url or selected_feed_url is required' },
        { status: 400 }
      );
    }

    let feedUrlToCreate = trimmedSelectedFeedUrl || trimmedUrl;
    console.log('Creating feed with input:', {
      hasUrl: Boolean(trimmedUrl),
      category_id,
    });

    // 4. Resolve the input URL to a feed URL
    if (!trimmedSelectedFeedUrl) {
      const resolvedYouTubeFeedUrl = await resolveYouTubeFeedUrlFromInput(trimmedUrl);
      if (resolvedYouTubeFeedUrl) {
        feedUrlToCreate = resolvedYouTubeFeedUrl;
        selectionDebug = {
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
          selectionDebug,
        );
      } else {
        // Standard URL path: prefer slug-aware discovery, then fallback to base URL
        const parsedInputUrl = parseHttpUrl(trimmedUrl);
        const resolvedMediumFeedUrl = resolveMediumFeedUrlFromInput(trimmedUrl);
        if (resolvedMediumFeedUrl) {
          feedUrlToCreate = resolvedMediumFeedUrl;
          selectionDebug = {
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
            selectionDebug,
          );
        } else {
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

          selectionDebug = {
            strategy,
            inputUrl: trimmedUrl,
            resolvedUrl: feedUrlToCreate,
            inputHasSlugPath,
            baseUrl: baseUrl || null,
            inputDiscoveryCount,
            baseDiscoveryCount,
          };
          console.log('Feed selection debug:', selectionDebug);
        }
      }
    }

    // 5. Create feed using the discovered or resolved URL
    const requestBody: {
      feed_url: string;
      category_id?: number;
      blocklist_rules?: string;
    } = {
      feed_url: feedUrlToCreate,
    };

    if (category_id && typeof category_id === 'number') {
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

    return NextResponse.json(createdFeed);
  } catch (err) {
    console.error('Failed to create feed:', err);

    const privateMessage =
      err instanceof MinifluxApiError
        ? err.body
        : err instanceof Error
          ? err.message
          : 'Unknown error';

    // Provide more helpful error messages
    let errorMessage = 'Failed to create feed';
    const status = apiErrorStatus(err);

    if (privateMessage.includes('unable to detect feed format')) {
      errorMessage =
        'Unable to find or parse a feed at this URL. Please check that:\n' +
        '• The URL is accessible\n' +
        '• The URL includes http:// or https://\n' +
        '• The page contains an RSS/Atom feed or links to one';
    }

    return NextResponse.json({ error: errorMessage }, { status });
  }
}
