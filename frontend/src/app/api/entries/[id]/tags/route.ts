import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { PublicApiError, apiErrorResponse } from '@/lib/apiErrors';
import { getReaderContext } from '@/lib/reader/account';
import { parseId, readJsonBody } from '@/lib/reader/http';
import { getEntry, setEntryTag } from '@/lib/reader/queries';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

/** PUT /api/entries/[id]/tags { tag_id, on }: tag or untag one post. */
export async function PUT(request: NextRequest, context: Ctx) {
  try {
    const { userId } = await getReaderContext();
    const entryId = parseId((await context.params).id, 'entry id');
    const body = await readJsonBody(request);
    if (!Number.isInteger(body.tag_id) || typeof body.on !== 'boolean') {
      throw new PublicApiError('Expected { tag_id, on }', 400);
    }
    await setEntryTag(userId, entryId, body.tag_id as number, body.on);
    const entry = await getEntry(userId, entryId);
    return NextResponse.json({ ok: true, tag_ids: entry?.tag_ids ?? [] });
  } catch (err) {
    return apiErrorResponse(err, 'Failed to update entry tags');
  }
}
