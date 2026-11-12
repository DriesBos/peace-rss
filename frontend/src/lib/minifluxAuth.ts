import 'server-only';

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getMinifluxAccount } from '@/lib/minifluxAccount';

export type MinifluxAuthResult =
  | { ok: true; userId: string; token: string }
  | { ok: false; response: NextResponse };

/**
 * Resolves the signed-in user and their Miniflux API token.
 * Every API route goes through this, so the auth provider lives in one place.
 */
export async function requireMinifluxToken(): Promise<MinifluxAuthResult> {
  const session = await getSession();
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const userId = session.user.id;
  const account = await getMinifluxAccount(userId);

  if (!account) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Not provisioned. Call /api/bootstrap first.' },
        { status: 401 },
      ),
    };
  }

  return { ok: true, userId, token: account.token };
}
