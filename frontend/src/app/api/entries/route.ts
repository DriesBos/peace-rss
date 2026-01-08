import 'server-only';

import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { mfFetchUser } from '@/lib/miniflux';

export const runtime = 'nodejs';

function getStringParam(url: URL, key: string, defaultValue: string): string {
  const value = url.searchParams.get(key);
  return value && value.trim().length > 0 ? value : defaultValue;
}

function getNumberParam(url: URL, key: string, defaultValue: number): number {
  const value = url.searchParams.get(key);
  if (!value) return defaultValue;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : defaultValue;
}

export async function GET(request: Request) {
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
        { error: 'Not provisioned. Call /api/bootstrap first.' },
        { status: 401 }
      );
    }

    // 3. Parse query parameters
    const url = new URL(request.url);

    const limit = getNumberParam(url, 'limit', 50);
    const offset = getNumberParam(url, 'offset', 0);
    const direction = getStringParam(url, 'direction', 'desc');
    const order = getStringParam(url, 'order', 'published_at');

    // Check if we're searching
    const searchQuery = url.searchParams.get('search');
    const isSearchQuery = searchQuery && searchQuery.trim().length > 0;

    // Check if we're fetching starred entries
    const starred = url.searchParams.get('starred');
    const isStarredQuery = starred === 'true';

    // For non-starred/non-search queries, use status filter (default: unread)
    const status =
      !isStarredQuery && !isSearchQuery
        ? getStringParam(url, 'status', 'unread')
        : undefined;

    // Optional feed filter (used by the UI); ignore when missing.
    const feedIdRaw = url.searchParams.get('feed_id');
    let feedId: number | null = null;
    if (feedIdRaw !== null && feedIdRaw.trim() !== '') {
      const parsed = Number(feedIdRaw);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return NextResponse.json({ error: 'Invalid feed_id' }, { status: 400 });
      }
      feedId = parsed;
    }

    // Optional category filter (used by the UI); ignore when missing.
    const categoryIdRaw = url.searchParams.get('category_id');
    let categoryId: number | null = null;
    if (categoryIdRaw !== null && categoryIdRaw.trim() !== '') {
      const parsed = Number(categoryIdRaw);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return NextResponse.json(
          { error: 'Invalid category_id' },
          { status: 400 }
        );
      }
      categoryId = parsed;
    }

    const qs = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      order,
      direction,
    });

    // Add search parameter if searching
    if (isSearchQuery && searchQuery) {
      qs.set('search', searchQuery.trim());
    }

    // Add status only for non-starred/non-search queries
    if (status) {
      qs.set('status', status);
    }

    // Add starred parameter if requesting starred entries
    if (isStarredQuery) {
      qs.set('starred', 'true');
    }

    if (feedId) qs.set('feed_id', String(feedId));
    if (categoryId) qs.set('category_id', String(categoryId));

    // 4. Fetch entries using per-user token
    const data = await mfFetchUser<unknown>(
      token,
      `/v1/entries?${qs.toString()}`
    );
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
