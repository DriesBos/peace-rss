import 'server-only';

import { NextResponse } from 'next/server';
import { PublicApiError, apiErrorResponse } from '@/lib/apiErrors';
import { mfFetchUser } from '@/lib/miniflux';
import { getReaderContext } from '@/lib/reader/account';
import { parseIdList, readJsonBody } from '@/lib/reader/http';
import { setEntriesStatus } from '@/lib/reader/queries';

export const runtime = 'nodejs';

/** POST /api/entries/status { entry_ids, status } */
export async function POST(request: Request) {
  try {
    const { userId, token } = await getReaderContext();
    const body = await readJsonBody(request);
    const entryIds = parseIdList(body.entry_ids, 'entry_ids');
    const status = body.status;

    if (entryIds.length === 0) {
      throw new PublicApiError('Missing or invalid entry_ids', 400);
    }
    if (status !== 'read' && status !== 'unread') {
      throw new PublicApiError('Invalid status', 400);
    }

    // Miniflux first, so the two copies cannot disagree after a failure.
    await mfFetchUser<void>(token, '/v1/entries', {
      method: 'PUT',
      body: JSON.stringify({ entry_ids: entryIds, status }),
    });
    await setEntriesStatus(userId, entryIds, status);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err, 'Failed to update entry status');
  }
}
