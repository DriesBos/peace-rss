import 'server-only';

import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/lib/apiErrors';
import { mfFetchUser } from '@/lib/miniflux';
import { getReaderContext } from '@/lib/reader/account';
import { chunk, parseIdList, readJsonBody } from '@/lib/reader/http';
import {
  filterOwnTagIds,
  listEntryIds,
  setEntriesStatus,
} from '@/lib/reader/queries';

export const runtime = 'nodejs';

/**
 * POST /api/entries/mark-all-read { tag_ids?: number[] }
 * Marks every unread post in the current view as read: the posts that
 * have all given tags, or without tags everything in the main list.
 */
export async function POST(request: Request) {
  try {
    const { userId, token } = await getReaderContext();
    const body = await readJsonBody(request);
    const requested = parseIdList(body.tag_ids, 'tag_ids');
    const tagIds = await filterOwnTagIds(userId, requested);
    if (tagIds.length !== requested.length) {
      return NextResponse.json({ ok: true, count: 0 });
    }

    const entryIds = await listEntryIds(userId, {
      status: 'unread',
      tagIds,
      visibleOnly: tagIds.length === 0,
    });

    for (const ids of chunk(entryIds, 500)) {
      await mfFetchUser<void>(token, '/v1/entries', {
        method: 'PUT',
        body: JSON.stringify({ entry_ids: ids, status: 'read' }),
      });
      await setEntriesStatus(userId, ids, 'read');
    }

    return NextResponse.json({ ok: true, count: entryIds.length });
  } catch (err) {
    return apiErrorResponse(err, 'Failed to mark entries read');
  }
}
