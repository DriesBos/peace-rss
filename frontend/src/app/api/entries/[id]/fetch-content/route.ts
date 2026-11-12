import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { requireMinifluxToken } from '@/lib/minifluxAuth';
import { apiErrorResponse } from '@/lib/apiErrors';
import { mfFetchUser } from '@/lib/miniflux';
import { getEntryListMeta } from '@/lib/entryListMeta';

export const runtime = 'nodejs';

// Next.js (v16) Route Handler typing: params may be Promise-wrapped.
type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/entries/[id]/fetch-content
 * Fetch original article content for an entry
 */
export async function POST(_request: NextRequest, context: Ctx) {
  try {
    const authResult = await requireMinifluxToken();
    if (!authResult.ok) return authResult.response;
    const { token } = authResult;

    // 3. Parse entry ID from route params
    const { id } = await context.params;
    const entryId = Number(id);
    if (!Number.isFinite(entryId) || entryId <= 0) {
      return NextResponse.json({ error: 'Invalid entry id' }, { status: 400 });
    }

    // 4. Fetch original content from Miniflux
    // This endpoint returns the entry with updated content
    const entry = await mfFetchUser<{
      id: number;
      title: string;
      content: string;
      url: string;
      reading_time?: number;
    }>(token, `/v1/entries/${entryId}/fetch-content?update_content=true`, {
      method: 'GET',
    });

    return NextResponse.json({
      ok: true,
      content: entry.content,
      ...getEntryListMeta(entry),
      reading_time: entry.reading_time,
    });
  } catch (err) {
    return apiErrorResponse(err, 'Failed to fetch entry content');
  }
}
