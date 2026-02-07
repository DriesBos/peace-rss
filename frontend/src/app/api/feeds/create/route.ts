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

type CreateFeedRequest = {
  feed_url?: string;
  category_id?: number;
  social?: SocialFeedRequestInput;
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

export async function POST(request: NextRequest) {
  let socialSourceContext: { platform: string; sourceKey: string } | null =
    null;

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
      // 5. Standard URL path: discover feed first, then fallback to direct URL
      try {
        console.log('Attempting feed discovery...');
        const discovered = await mfFetchUser<DiscoverResponse>(
          token,
          '/v1/discover',
          {
            method: 'POST',
            body: JSON.stringify({ url: trimmedUrl }),
          }
        );

        if (discovered && discovered.length > 0) {
          feedUrlToCreate = discovered[0].url;
          console.log(
            `Discovered ${discovered.length} feed(s), using:`,
            feedUrlToCreate
          );
        } else {
          console.log('No feeds discovered, will try direct URL');
        }
      } catch (discoverErr) {
        console.log(
          'Feed discovery failed or not available, trying direct URL:',
          discoverErr
        );
      }
    }

    // 6. Create feed using the discovered or resolved URL
    const requestBody: { feed_url: string; category_id?: number } = {
      feed_url: feedUrlToCreate,
    };

    // Add category_id if provided
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

    if (socialSourceContext) {
      incrementSocialMetric('social_create_success_total', {
        platform: socialSourceContext.platform,
      });
      recordSocialEvent('social_create_success', {
        platform: socialSourceContext.platform,
        source_key: socialSourceContext.sourceKey,
      });
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

    if (errorMessage.includes('unable to detect feed format')) {
      errorMessage =
        'Unable to find or parse a feed at this URL. Please check that:\n' +
        '• The URL is accessible\n' +
        '• The URL includes http:// or https://\n' +
        '• The page contains an RSS/Atom feed or links to one';
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
