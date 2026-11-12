import 'server-only';

import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';

export type MinifluxAuthResult =
  | { ok: true; userId: string; token: string }
  | { ok: false; response: NextResponse };

/**
 * Resolves the signed-in user and their Miniflux API token.
 * Every API route goes through this, so the auth provider lives in one place.
 */
export async function requireMinifluxToken(): Promise<MinifluxAuthResult> {
  const { userId } = await auth();
  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const metadata = user.privateMetadata as { minifluxToken?: string } | undefined;
  const token = metadata?.minifluxToken;

  if (!token) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Not provisioned. Call /api/bootstrap first.' },
        { status: 401 },
      ),
    };
  }

  return { ok: true, userId, token };
}
