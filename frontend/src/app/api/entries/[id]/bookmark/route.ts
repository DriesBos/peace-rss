import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { mfFetch } from '@/lib/miniflux';

// Next.js (v16) Route Handler typing: params may be Promise-wrapped.
type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: Ctx) {
  try {
    const { id } = await context.params;

    const entryId = Number(id);
    if (!Number.isFinite(entryId) || entryId <= 0) {
      return NextResponse.json({ error: 'Invalid entry id' }, { status: 400 });
    }

    // Miniflux: toggle bookmark/star
    await mfFetch<void>(`/v1/entries/${entryId}/bookmark`, { method: 'PUT' });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
