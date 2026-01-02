import 'server-only';

import { NextResponse } from 'next/server';
import { mfFetch } from '@/lib/miniflux';

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
    const url = new URL(request.url);

    const status = getStringParam(url, 'status', 'unread');
    const limit = getNumberParam(url, 'limit', 50);
    const offset = getNumberParam(url, 'offset', 0);
    const direction = getStringParam(url, 'direction', 'desc');
    const order = getStringParam(url, 'order', 'published_at');

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

    const qs = new URLSearchParams({
      status,
      limit: String(limit),
      offset: String(offset),
      order,
      direction,
    });
    if (feedId) qs.set('feed_id', String(feedId));

    const data = await mfFetch<unknown>(`/v1/entries?${qs.toString()}`);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


