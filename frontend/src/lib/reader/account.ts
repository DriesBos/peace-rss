import 'server-only';

import { auth, clerkClient } from '@clerk/nextjs/server';
import { PublicApiError } from '@/lib/apiErrors';
import { decryptToken, encryptToken } from '@/lib/reader/crypto';
import { dbQuery } from '@/lib/reader/db';
import { AUTO_TAGS } from '@/lib/reader/detect';

export type ReaderContext = {
  userId: string;
  token: string;
};

type GlobalWithAccounts = typeof globalThis & {
  __readerKnownAccounts?: Map<string, string>;
};

const knownAccounts = ((
  globalThis as GlobalWithAccounts
).__readerKnownAccounts ??= new Map<string, string>());

/**
 * Makes sure the account row (with the encrypted Miniflux token) and the
 * built-in automatic tags exist. Cheap after the first call per process.
 */
export async function ensureAccount(
  userId: string,
  token: string,
): Promise<void> {
  if (knownAccounts.get(userId) === token) return;

  await dbQuery(
    `INSERT INTO reader.accounts (user_id, token_enc)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET token_enc = EXCLUDED.token_enc`,
    [userId, encryptToken(token)],
  );

  for (const [index, tag] of AUTO_TAGS.entries()) {
    await dbQuery(
      `INSERT INTO reader.tags (user_id, title, slug, kind, position)
       VALUES ($1, $2, $3, 'auto', $4)
       ON CONFLICT (user_id, slug) DO NOTHING`,
      [userId, tag.title, tag.slug, 1000 + index],
    );
  }

  knownAccounts.set(userId, token);
}

/**
 * Signed-in user + their Miniflux token, for API routes.
 * Throws a PublicApiError (401) that apiErrorResponse turns into JSON.
 */
export async function getReaderContext(): Promise<ReaderContext> {
  const { userId } = await auth();
  if (!userId) throw new PublicApiError('Unauthorized', 401);

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const metadata = user.privateMetadata as
    | { minifluxToken?: string }
    | undefined;
  const token = metadata?.minifluxToken;
  if (!token) {
    throw new PublicApiError(
      'Not provisioned. Call /api/bootstrap first.',
      401,
    );
  }

  await ensureAccount(userId, token);
  return { userId, token };
}

/** Every account with a readable token, for the background sync. */
export async function listSyncAccounts(): Promise<ReaderContext[]> {
  const rows = await dbQuery<{ user_id: string; token_enc: string }>(
    'SELECT user_id, token_enc FROM reader.accounts',
  );
  const accounts: ReaderContext[] = [];
  for (const row of rows) {
    const token = decryptToken(row.token_enc);
    if (token) accounts.push({ userId: row.user_id, token });
  }
  return accounts;
}
