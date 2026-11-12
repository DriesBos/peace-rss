import 'server-only';

import { NextResponse } from 'next/server';
import { PublicApiError, apiErrorResponse } from '@/lib/apiErrors';
import { DEFAULT_ENTRIES_PAGE_SIZE } from '@/lib/entriesQuery';
import { getReaderContext } from '@/lib/reader/account';
import { parseIdCsv } from '@/lib/reader/http';
import { filterOwnTagIds, listEntries } from '@/lib/reader/queries';

export const runtime = 'nodejs';

const MAX_ENTRIES_LIMIT = 500;

function getNumberParam(url: URL, key: string, defaultValue: number): number {
  const value = url.searchParams.get(key);
  if (!value) return defaultValue;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : defaultValue;
}

/**
 * GET /api/entries
 * Reads from our own copy of the entries (see lib/reader).
 *
 * Query: status=unread|read|all, starred=true, search=…, tags=1,2,3
 * (posts that have all of them), globally_visible=true, limit, offset,
 * direction=asc|desc.
 */
export async function GET(request: Request) {
  try {
    const { userId } = await getReaderContext();
    const url = new URL(request.url);

    const limit = Math.min(
      getNumberParam(url, 'limit', DEFAULT_ENTRIES_PAGE_SIZE),
      MAX_ENTRIES_LIMIT,
    );
    const offset = getNumberParam(url, 'offset', 0);
    const direction =
      url.searchParams.get('direction') === 'asc' ? 'asc' : 'desc';

    const search = url.searchParams.get('search')?.trim() || null;
    const starred = url.searchParams.get('starred') === 'true';

    let status: 'unread' | 'read' | null = null;
    if (!search && !starred) {
      const raw = url.searchParams.get('status') || 'unread';
      if (raw === 'unread' || raw === 'read') status = raw;
      else if (raw !== 'all') throw new PublicApiError('Invalid status', 400);
    }

    const requestedTagIds = parseIdCsv(url.searchParams.get('tags'));
    const tagIds = await filterOwnTagIds(userId, requestedTagIds);
    if (tagIds.length !== requestedTagIds.length) {
      // An unknown tag can never match anything.
      return NextResponse.json({ total: 0, entries: [] });
    }

    const data = await listEntries(
      userId,
      {
        status,
        starred,
        search,
        tagIds,
        visibleOnly: url.searchParams.get('globally_visible') === 'true',
      },
      { limit, offset, direction },
    );
    return NextResponse.json(data);
  } catch (err) {
    return apiErrorResponse(err, 'Failed to fetch entries');
  }
}
