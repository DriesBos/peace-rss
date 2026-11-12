import 'server-only';

import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/lib/apiErrors';
import { mfFetchUser } from '@/lib/miniflux';
import { getReaderContext } from '@/lib/reader/account';
import { getSyncStatus } from '@/lib/reader/queries';
import { syncUser } from '@/lib/reader/sync';

export const runtime = 'nodejs';

type Total = { total: number };

/**
 * GET /api/sync: our copy next to Miniflux, to spot drift.
 * Our copy keeps posts longer than Miniflux does, so `entries` may be
 * higher on our side; `unread` and `starred` should match.
 */
export async function GET() {
  try {
    const ctx = await getReaderContext();
    const [status, feeds, entries, unread, starred] = await Promise.all([
      getSyncStatus(ctx.userId),
      mfFetchUser<unknown[]>(ctx.token, '/v1/feeds'),
      mfFetchUser<Total>(
        ctx.token,
        '/v1/entries?limit=1&status=unread&status=read',
      ),
      mfFetchUser<Total>(ctx.token, '/v1/entries?limit=1&status=unread'),
      mfFetchUser<Total>(ctx.token, '/v1/entries?limit=1&starred=true'),
    ]);
    return NextResponse.json({
      ...status,
      miniflux: {
        feeds: Array.isArray(feeds) ? feeds.length : 0,
        entries: entries.total ?? 0,
        unread: unread.total ?? 0,
        starred: starred.total ?? 0,
      },
    });
  } catch (err) {
    return apiErrorResponse(err, 'Failed to read sync status');
  }
}

/** POST /api/sync: pull changes from Miniflux now. */
export async function POST() {
  try {
    const ctx = await getReaderContext();
    const result = await syncUser(ctx);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return apiErrorResponse(err, 'Failed to sync');
  }
}
