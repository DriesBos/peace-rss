import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { apiErrorResponse } from '@/lib/apiErrors';
import { MinifluxApiError, mfFetchUser } from '@/lib/miniflux';
import { getReaderContext } from '@/lib/reader/account';
import { parseId } from '@/lib/reader/http';
import { toggleEntryStar } from '@/lib/reader/queries';

export const runtime = 'nodejs';

// Next.js (v16) Route Handler typing: params may be Promise-wrapped.
type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: Ctx) {
  try {
    const { userId, token } = await getReaderContext();
    const entryId = parseId((await context.params).id, 'entry id');

    try {
      await mfFetchUser<void>(token, `/v1/entries/${entryId}/bookmark`, {
        method: 'PUT',
      });
    } catch (err) {
      // We keep posts longer than Miniflux does; a post it has already
      // cleaned up can still be starred in our copy.
      if (!(err instanceof MinifluxApiError && err.publicStatus === 404)) {
        throw err;
      }
    }
    await toggleEntryStar(userId, entryId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err, 'Failed to update entry bookmark');
  }
}
