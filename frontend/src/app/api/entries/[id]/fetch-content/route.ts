import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { apiErrorResponse } from '@/lib/apiErrors';
import { mfFetchUser } from '@/lib/miniflux';
import { getReaderContext } from '@/lib/reader/account';
import { parseId } from '@/lib/reader/http';
import { getEntry } from '@/lib/reader/queries';
import { type MinifluxEntry, upsertEntries } from '@/lib/reader/sync';

export const runtime = 'nodejs';

// Next.js (v16) Route Handler typing: params may be Promise-wrapped.
type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/entries/[id]/fetch-content
 * Fetch original article content for an entry
 */
export async function POST(_request: NextRequest, context: Ctx) {
  try {
    const { userId, token } = await getReaderContext();
    const entryId = parseId((await context.params).id, 'entry id');

    // Miniflux downloads the original page and stores it on the entry.
    await mfFetchUser<unknown>(
      token,
      `/v1/entries/${entryId}/fetch-content?update_content=true`,
      { method: 'GET' },
    );

    // Re-read the whole entry so our copy (and its automatic tags,
    // thumbnail and preview) follow the new content.
    const fresh = await mfFetchUser<MinifluxEntry>(
      token,
      `/v1/entries/${entryId}`,
    );
    await upsertEntries(userId, [fresh]);
    const entry = await getEntry(userId, entryId);

    return NextResponse.json({
      ok: true,
      content: entry?.content ?? fresh.content ?? '',
      preview: entry?.preview,
      thumbnail_url: entry?.thumbnail_url,
      reading_time: entry?.reading_time ?? fresh.reading_time,
      tag_ids: entry?.tag_ids,
    });
  } catch (err) {
    return apiErrorResponse(err, 'Failed to fetch entry content');
  }
}
