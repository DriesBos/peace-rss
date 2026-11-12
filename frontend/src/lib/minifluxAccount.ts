import 'server-only';

import { symmetricDecrypt, symmetricEncrypt } from 'better-auth/crypto';
import { authPool } from '@/lib/authDb';

/**
 * Links an auth user to their Miniflux user and API token.
 * The token is encrypted at rest with MINIFLUX_TOKEN_KEY.
 */
export type MinifluxAccount = {
  userId: string;
  minifluxUserId: number | null;
  username: string;
  token: string;
};

export const MINIFLUX_ACCOUNT_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS miniflux_account (
  user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  miniflux_user_id INTEGER,
  username TEXT NOT NULL UNIQUE,
  token_encrypted TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`;

function tokenKey(): string {
  const key = process.env.MINIFLUX_TOKEN_KEY;
  if (!key) throw new Error('MINIFLUX_TOKEN_KEY is not set');
  return key;
}

export async function encryptMinifluxToken(token: string): Promise<string> {
  return symmetricEncrypt({ key: tokenKey(), data: token });
}

export async function getMinifluxAccount(
  userId: string,
): Promise<MinifluxAccount | null> {
  const { rows } = await authPool.query<{
    user_id: string;
    miniflux_user_id: number | null;
    username: string;
    token_encrypted: string;
  }>(
    'SELECT user_id, miniflux_user_id, username, token_encrypted FROM miniflux_account WHERE user_id = $1',
    [userId],
  );
  const row = rows[0];
  if (!row) return null;

  return {
    userId: row.user_id,
    minifluxUserId: row.miniflux_user_id,
    username: row.username,
    token: await symmetricDecrypt({ key: tokenKey(), data: row.token_encrypted }),
  };
}

export async function saveMinifluxAccount(account: MinifluxAccount): Promise<void> {
  await authPool.query(
    `INSERT INTO miniflux_account (user_id, miniflux_user_id, username, token_encrypted)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id) DO UPDATE
       SET miniflux_user_id = EXCLUDED.miniflux_user_id,
           username = EXCLUDED.username,
           token_encrypted = EXCLUDED.token_encrypted,
           updated_at = now()`,
    [
      account.userId,
      account.minifluxUserId,
      account.username,
      await encryptMinifluxToken(account.token),
    ],
  );
}
