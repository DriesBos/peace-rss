import 'server-only';

import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/lib/apiErrors';
import { getReaderContext } from '@/lib/reader/account';
import { listFeeds } from '@/lib/reader/queries';

export const runtime = 'nodejs';

/** GET /api/feeds: feeds with their tags, from our copy. */
export async function GET() {
  try {
    const { userId } = await getReaderContext();
    return NextResponse.json(await listFeeds(userId));
  } catch (err) {
    return apiErrorResponse(err, 'Failed to fetch feeds');
  }
}
