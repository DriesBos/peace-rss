import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { mfFetchUser } from '@/lib/miniflux';

export const runtime = 'nodejs';

type CreateFeedRequest = {
  feed_url: string;
};

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

    const { feed_url } = body as CreateFeedRequest;
    if (!feed_url || typeof feed_url !== 'string' || !feed_url.trim()) {
      return NextResponse.json(
        { error: 'feed_url is required' },
        { status: 400 }
      );
    }

    const trimmedUrl = feed_url.trim();
    console.log('Creating feed with URL:', trimmedUrl);

    // 4. Create feed using per-user token (NOT admin credentials)
    const createdFeed = await mfFetchUser<CreateFeedResponse>(
      token,
      '/v1/feeds',
      {
        method: 'POST',
        body: JSON.stringify({ feed_url: trimmedUrl }),
      }
    );

    return NextResponse.json(createdFeed);
  } catch (err) {
    console.error('Failed to create feed:', err);

    // Provide more helpful error messages
    let errorMessage = err instanceof Error ? err.message : 'Unknown error';

    if (errorMessage.includes('unable to detect feed format')) {
      errorMessage =
        'Unable to parse feed. Please check that:\n' +
        '• The URL points to a valid RSS/Atom feed\n' +
        '• The URL includes http:// or https://\n' +
        '• The feed is publicly accessible';
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
