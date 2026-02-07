import 'server-only';

import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/social/rateLimit';
import {
  coalesceSocialProxyRequest,
  getCachedSocialProxyResponse,
  setCachedSocialProxyResponse,
} from '@/lib/social/proxyCache';
import { decodeSocialFeedToken } from '@/lib/social/token';
import { isBridgeFeedUrl } from '@/lib/social/rssBridge';
import { buildSocialSourceKeyFromTokenPayload } from '@/lib/social/source';
import {
  incrementSocialMetric,
  recordSocialEvent,
} from '@/lib/social/metrics';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ token: string }>;
};

const proxyCacheTtlMs = (() => {
  const value = Number(process.env.SOCIAL_PROXY_CACHE_TTL_MS || '120000');
  if (!Number.isFinite(value) || value <= 0) return 120000;
  return Math.floor(value);
})();

const proxyGlobalLimitPerMinute = (() => {
  const value = Number(process.env.SOCIAL_PROXY_GLOBAL_RATE_LIMIT_PER_MINUTE || '300');
  if (!Number.isFinite(value) || value <= 0) return 300;
  return Math.floor(value);
})();

const proxySourceLimitPerMinute = (() => {
  const value = Number(process.env.SOCIAL_PROXY_SOURCE_RATE_LIMIT_PER_MINUTE || '120');
  if (!Number.isFinite(value) || value <= 0) return 120;
  return Math.floor(value);
})();

function buildAuthorizationHeader(
  username?: string,
  password?: string
): string | undefined {
  if (!username || !password) return undefined;
  const encoded = Buffer.from(`${username}:${password}`).toString('base64');
  return `Basic ${encoded}`;
}

class UpstreamBridgeError extends Error {
  status: number;
  retryAfterSeconds?: number;

  constructor(message: string, status: number, retryAfterSeconds?: number) {
    super(message);
    this.name = 'UpstreamBridgeError';
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export async function GET(
  _request: Request,
  context: RouteContext
): Promise<Response> {
  try {
    const { token } = await context.params;
    const payload = decodeSocialFeedToken(token);

    if (!isBridgeFeedUrl(payload.bridgeFeedUrl)) {
      return NextResponse.json(
        { error: 'Invalid bridge feed URL in token' },
        { status: 400 }
      );
    }

    const sourceKey = buildSocialSourceKeyFromTokenPayload(payload);
    incrementSocialMetric('social_proxy_requests_total', {
      platform: payload.platform,
    });

    const globalRate = checkRateLimit('social-proxy:global', {
      max: proxyGlobalLimitPerMinute,
      windowMs: 60_000,
    });
    if (!globalRate.allowed) {
      incrementSocialMetric('social_proxy_rate_limited_total', {
        scope: 'global',
      });
      recordSocialEvent('social_proxy_rate_limited', {
        scope: 'global',
        retry_after_seconds: globalRate.retryAfterSeconds,
      });
      return new Response('Global social proxy rate limit exceeded', {
        status: 429,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Retry-After': String(globalRate.retryAfterSeconds),
        },
      });
    }

    const sourceRate = checkRateLimit(`social-proxy:source:${sourceKey}`, {
      max: proxySourceLimitPerMinute,
      windowMs: 60_000,
    });
    if (!sourceRate.allowed) {
      incrementSocialMetric('social_proxy_rate_limited_total', {
        scope: 'source',
        platform: payload.platform,
      });
      recordSocialEvent('social_proxy_rate_limited', {
        scope: 'source',
        platform: payload.platform,
        source_key: sourceKey,
        retry_after_seconds: sourceRate.retryAfterSeconds,
      });
      return new Response('Social source rate limit exceeded', {
        status: 429,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Retry-After': String(sourceRate.retryAfterSeconds),
        },
      });
    }

    const cached = getCachedSocialProxyResponse(sourceKey);
    if (cached) {
      incrementSocialMetric('social_proxy_cache_hits_total', {
        platform: payload.platform,
      });
      return new Response(cached.body, {
        status: 200,
        headers: {
          'Content-Type': cached.contentType,
          'Cache-Control': 'private, max-age=120',
          'X-Social-Proxy-Cache': 'HIT',
        },
      });
    }

    incrementSocialMetric('social_proxy_cache_misses_total', {
      platform: payload.platform,
    });

    const headers = new Headers({
      Accept: 'application/atom+xml, application/rss+xml, application/xml;q=0.9, */*;q=0.8',
    });

    const authHeader = buildAuthorizationHeader(
      payload.bridgeLoginUsername,
      payload.bridgeLoginPassword
    );
    if (authHeader) headers.set('Authorization', authHeader);

    const fresh = await coalesceSocialProxyRequest(sourceKey, async () => {
      const res = await fetch(payload.bridgeFeedUrl, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        const retryAfterHeader = res.headers.get('retry-after');
        const retryAfterSeconds = retryAfterHeader
          ? Number.parseInt(retryAfterHeader, 10)
          : undefined;
        throw new UpstreamBridgeError(
          `Upstream RSS-Bridge error ${res.status} ${res.statusText}\n${text}`.trim(),
          res.status,
          Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined
        );
      }

      const body = await res.text();
      const contentType =
        res.headers.get('content-type') || 'application/xml; charset=utf-8';
      return {
        body,
        contentType,
        cachedAt: Date.now(),
        expiresAt: Date.now() + proxyCacheTtlMs,
      };
    });

    setCachedSocialProxyResponse(
      sourceKey,
      { body: fresh.body, contentType: fresh.contentType },
      proxyCacheTtlMs
    );
    incrementSocialMetric('social_proxy_upstream_success_total', {
      platform: payload.platform,
    });

    return new Response(fresh.body, {
      status: 200,
      headers: {
        'Content-Type': fresh.contentType,
        'Cache-Control': 'private, max-age=120',
        'X-Social-Proxy-Cache': 'MISS',
      },
    });
  } catch (err) {
    if (err instanceof UpstreamBridgeError) {
      incrementSocialMetric('social_proxy_upstream_errors_total', {
        status: err.status,
      });
      recordSocialEvent('social_proxy_upstream_error', {
        status: err.status,
        message: err.message,
      });

      const status = err.status === 429 ? 429 : 502;
      const headers = new Headers({
        'Content-Type': 'text/plain; charset=utf-8',
      });
      if (err.retryAfterSeconds) {
        headers.set('Retry-After', String(err.retryAfterSeconds));
      }

      return new Response(err.message, {
        status,
        headers,
      });
    }

    incrementSocialMetric('social_proxy_internal_errors_total');
    recordSocialEvent('social_proxy_internal_error', {
      message: err instanceof Error ? err.message : 'Unknown proxy error',
    });

    const message =
      err instanceof Error ? err.message : 'Unexpected social feed proxy error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
