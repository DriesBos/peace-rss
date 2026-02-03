import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { mfFetchUser } from '@/lib/miniflux';

export const runtime = 'nodejs';

// Next.js (v16) Route Handler typing: params may be Promise-wrapped.
type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: Ctx) {
  try {
    // 1. Require Clerk authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get user's Miniflux token from Clerk metadata
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const metadata = user.privateMetadata as { minifluxToken?: string } | undefined;
    const token = metadata?.minifluxToken;

    if (!token) {
      return NextResponse.json(
        { error: 'Not provisioned. Call /api/bootstrap first.' },
        { status: 401 }
      );
    }

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
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
