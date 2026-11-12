import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { requireMinifluxToken } from '@/lib/minifluxAuth';
import { apiErrorResponse } from '@/lib/apiErrors';
import { mfFetchUser } from '@/lib/miniflux';

export const runtime = 'nodejs';

// Next.js (v16) Route Handler typing: params may be Promise-wrapped.
type Ctx = { params: Promise<{ id: string }> };

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

    // 4. Toggle star using per-user token
    await mfFetchUser<void>(token, `/v1/entries/${entryId}/bookmark`, {
      method: 'PUT',
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err, 'Failed to update entry bookmark');
  }
}
