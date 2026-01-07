import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { mfFetchUser } from '@/lib/miniflux';

export const runtime = 'nodejs';

type CreateFeedRequest = {
  feed_url: string;
  category_id?: number;
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

    const { feed_url, category_id } = body as CreateFeedRequest;
    if (!feed_url || typeof feed_url !== 'string' || !feed_url.trim()) {
      return NextResponse.json(
        { error: 'feed_url is required' },
        { status: 400 }
      );
    }

    const trimmedUrl = feed_url.trim();
    console.log(
      'Creating feed with URL:',
      trimmedUrl,
      'category_id:',
      category_id
    );

    // 4. Try to discover feeds from the URL first
    let feedUrlToCreate = trimmedUrl;
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
        // Use the first discovered feed
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
      // Continue with original URL
    }

    // 5. Create feed using the discovered or original URL
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

    return NextResponse.json(createdFeed);
  } catch (err) {
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
