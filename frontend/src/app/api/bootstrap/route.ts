import 'server-only';

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getMinifluxAccount, saveMinifluxAccount } from '@/lib/minifluxAccount';
import { randomBytes, randomInt } from 'node:crypto';
import { apiErrorResponse } from '@/lib/apiErrors';
import {
  MinifluxApiError,
  mfFetchAdmin,
  mfFetchUserBasicAuth,
} from '@/lib/miniflux';
import { ensureAccount } from '@/lib/reader/account';
import { ensureInitialSync } from '@/lib/reader/sync';

export const runtime = 'nodejs';

type MinifluxUser = {
  id: number;
  username: string;
};

type MinifluxApiKey = {
  id: number;
  user_id: number;
  token: string;
  description: string;
  created_at: string;
};

/**
 * Generate a stable, sanitized username from the user's email and id
 * Format: emailPrefix-userIdSuffix (e.g., driesbos-7h3k)
 */
function generateUsername(email: string | undefined, userId: string): string {
  let prefix = 'user';
  if (email) {
    const emailPrefix = email.split('@')[0];
    // Sanitize: only alphanumeric and dash
    prefix = emailPrefix.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    // Remove leading/trailing dashes
    prefix = prefix.replace(/^-+|-+$/g, '');
    // Collapse multiple dashes
    prefix = prefix.replace(/-+/g, '-');
    // Limit length
    if (prefix.length > 20) prefix = prefix.slice(0, 20);
    if (prefix.length === 0) prefix = 'user';
  }

  // Add suffix from userId (last 4 chars)
  const suffix = userId.slice(-4);
  return `${prefix}-${suffix}`;
}

/**
 * Generate a random password for the Miniflux user
 * Only used once during provisioning to create the user and generate API key
 */
function generateRandomPassword(): string {
  // 24 random alphanumeric characters
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  for (let i = 0; i < 24; i++) {
    password += chars.charAt(randomInt(chars.length));
  }
  return password;
}

/**
 * Registers the user in our own database and, on the first visit,
 * waits for their feeds and entries to be copied over from Miniflux.
 */
async function prepareReader(userId: string, token: string): Promise<void> {
  await ensureAccount(userId, token);
  await ensureInitialSync({ userId, token });
}

/**
 * POST /api/bootstrap
 *
 * Provisions a Miniflux user for the currently signed-in user.
 * If already provisioned, returns success immediately.
 *
 * Steps:
 * 1. Check if user already has a miniflux_account row
 * 2. If not, create Miniflux user (admin endpoint)
 * 3. Create API key for that user (authenticated as the new user)
 * 4. Store the (encrypted) token in miniflux_account
 */
export async function POST() {
  try {
    // 1. Require a session
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    // 2-3. Check if already provisioned
    const existingAccount = await getMinifluxAccount(userId);
    if (existingAccount) {
      await prepareReader(userId, existingAccount.token);
      return NextResponse.json({
        ok: true,
        provisioned: true,
        minifluxUsername: existingAccount.username,
      });
    }

    // 4. Provision new Miniflux user
    const email = session.user.email;
    let username = generateUsername(email, userId);
    const password = generateRandomPassword();

    // 5. Create Miniflux user (admin endpoint)
    let minifluxUser: MinifluxUser | null = null;
    try {
      minifluxUser = await mfFetchAdmin<MinifluxUser>('/v1/users', {
        method: 'POST',
        body: JSON.stringify({
          username,
          password,
          is_admin: false,
        }),
      });
    } catch (err) {
      // If username already exists, try with random suffix
      if (err instanceof MinifluxApiError && err.body.includes('already exists')) {
        const randomSuffix = randomBytes(2).toString('hex');
        username = `${username}-${randomSuffix}`;

        try {
          minifluxUser = await mfFetchAdmin<MinifluxUser>('/v1/users', {
            method: 'POST',
            body: JSON.stringify({
              username,
              password,
              is_admin: false,
            }),
          });
        } catch (retryErr) {
          console.error(
            'Failed to create Miniflux user after retry:',
            retryErr
          );
          return NextResponse.json(
            { error: 'Failed to create Miniflux user' },
            { status: 500 }
          );
        }
      } else {
        console.error('Failed to create Miniflux user:', err);
        return NextResponse.json(
          { error: 'Failed to create Miniflux user' },
          { status: 500 }
        );
      }
    }

    // 6. Create API key for the new user (authenticate as the new user)
    let apiKey: MinifluxApiKey;
    try {
      apiKey = await mfFetchUserBasicAuth<MinifluxApiKey>(
        username,
        password,
        '/v1/api-keys',
        {
          method: 'POST',
          body: JSON.stringify({
            description: `Auto-generated for Komorebi user ${userId}`,
          }),
        }
      );
    } catch (err) {
      console.error('Failed to create API key:', err);
      if (minifluxUser) {
        try {
          await mfFetchAdmin(`/v1/users/${minifluxUser.id}`, {
            method: 'DELETE',
          });
        } catch (cleanupErr) {
          console.error('Failed to clean up Miniflux user:', cleanupErr);
        }
      }
      return NextResponse.json(
        { error: 'Failed to create API key' },
        { status: 500 }
      );
    }

    // 7. Store token in miniflux_account
    try {
      await saveMinifluxAccount({
        userId,
        minifluxUserId: minifluxUser?.id ?? null,
        username,
        token: apiKey.token,
      });
    } catch (err) {
      console.error('Failed to save Miniflux account link:', err);
      return NextResponse.json(
        { error: 'Failed to save user token' },
        { status: 500 }
      );
    }

    await prepareReader(userId, apiKey.token);

    return NextResponse.json({
      ok: true,
      provisioned: true,
    });
  } catch (err) {
    return apiErrorResponse(err, 'Bootstrap error');
  }
}
