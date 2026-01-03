import 'server-only';

import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { mfFetchUser } from '@/lib/miniflux';

export const runtime = 'nodejs';

function isValidStatus(status: unknown): status is 'read' | 'unread' {
  return status === 'read' || status === 'unread';
}

function isNumberArray(value: unknown): value is number[] {
  if (!Array.isArray(value)) return false;
  return value.every((v) => Number.isInteger(v));
}

export async function POST(request: Request) {
  try {
    // 1. Require Clerk authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
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

    // 3. Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const entryIds =
      typeof body === 'object' && body !== null ? (body as any).entry_ids : null;
    const status =
      typeof body === 'object' && body !== null ? (body as any).status : null;

    if (!isNumberArray(entryIds) || entryIds.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid entry_ids' },
        { status: 400 }
      );
    }

    if (!isValidStatus(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    // 4. Update entries using per-user token
    await mfFetchUser<void>(token, '/v1/entries', {
      method: 'PUT',
      body: JSON.stringify({ entry_ids: entryIds, status }),
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


