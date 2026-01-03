import 'server-only';

import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { mfFetchAdmin, mfFetchUserBasicAuth } from '@/lib/miniflux';

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
 * Generate a stable, sanitized username from Clerk user data
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
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  for (let i = 0; i < 24; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

/**
 * POST /api/bootstrap
 * 
 * Provisions a Miniflux user for the currently authenticated Clerk user.
 * If already provisioned, returns success immediately.
 * 
 * Steps:
 * 1. Check if user already has minifluxToken in Clerk privateMetadata
 * 2. If not, create Miniflux user (admin endpoint)
 * 3. Create API key for that user (authenticated as the new user)
 * 4. Store token in Clerk privateMetadata
 */
export async function POST() {
  try {
    // 1. Require Clerk authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Get Clerk user data
    const client = await clerkClient();
    const user = await client.users.getUser(userId);

    // 3. Check if already provisioned
    const metadata = user.privateMetadata as { minifluxToken?: string; minifluxUsername?: string } | undefined;
    if (metadata?.minifluxToken) {
      return NextResponse.json({
        ok: true,
        provisioned: true,
      });
    }

    // 4. Provision new Miniflux user
    const email = user.emailAddresses[0]?.emailAddress;
    let username = generateUsername(email, userId);
    const password = generateRandomPassword();

    // 5. Create Miniflux user (admin endpoint)
    let minifluxUser: MinifluxUser;
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
      if (err instanceof Error && err.message.includes('already exists')) {
        const randomSuffix = Math.random().toString(36).slice(2, 6);
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
          console.error('Failed to create Miniflux user after retry:', retryErr);
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
            description: `Auto-generated for Clerk user ${userId}`,
          }),
        }
      );
    } catch (err) {
      console.error('Failed to create API key:', err);
      // TODO: Consider cleaning up the created user here
      return NextResponse.json(
        { error: 'Failed to create API key' },
        { status: 500 }
      );
    }

    // 7. Store token in Clerk privateMetadata
    try {
      await client.users.updateUser(userId, {
        privateMetadata: {
          minifluxToken: apiKey.token,
          minifluxUsername: username,
        },
      });
    } catch (err) {
      console.error('Failed to update Clerk metadata:', err);
      return NextResponse.json(
        { error: 'Failed to save user token' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      provisioned: true,
    });
  } catch (err) {
    console.error('Bootstrap error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

