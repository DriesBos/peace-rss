import 'server-only';

import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { mfFetchUser } from '@/lib/miniflux';

export const runtime = 'nodejs';

type MarkAllReadBody =
  | { scope: 'user' }
  | { scope: 'category'; category_id: number }
  | { scope: 'feed'; feed_id: number };

type MinifluxCurrentUser = {
  id: number;
};

function isValidBody(value: unknown): value is MarkAllReadBody {
  if (!value || typeof value !== 'object') return false;
  const body = value as Record<string, unknown>;

  if (body.scope === 'user') return true;
  if (body.scope === 'category') {
    return Number.isInteger(body.category_id);
  }
  if (body.scope === 'feed') {
    return Number.isInteger(body.feed_id);
  }
  return false;
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const metadata = user.privateMetadata as
      | { minifluxToken?: string }
      | undefined;
    const token = metadata?.minifluxToken;

    if (!token) {
      return NextResponse.json(
        { error: 'Not provisioned. Call /api/bootstrap first.' },
        { status: 401 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!isValidBody(body)) {
      return NextResponse.json(
        { error: 'Invalid mark-all-read body' },
        { status: 400 }
      );
    }

    if (body.scope === 'category') {
      await mfFetchUser<void>(token, `/v1/categories/${body.category_id}/mark-all-as-read`, {
        method: 'PUT',
      });
      return NextResponse.json({ ok: true });
    }

    if (body.scope === 'feed') {
      await mfFetchUser<void>(token, `/v1/feeds/${body.feed_id}/mark-all-as-read`, {
        method: 'PUT',
      });
      return NextResponse.json({ ok: true });
    }

    const currentUser = await mfFetchUser<MinifluxCurrentUser>(token, '/v1/me');
    await mfFetchUser<void>(token, `/v1/users/${currentUser.id}/mark-all-as-read`, {
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
