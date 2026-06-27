import 'server-only';

import { auth, clerkClient } from '@clerk/nextjs/server';
import { cache } from 'react';

export type MinifluxIdentity = {
  userId: string;
  token: string;
  minifluxUsername: string | null;
};

// Single source of truth for "who is this request and what is their Miniflux token".
// Wrapped in cache() so multiple server callers in one request dedupe the Clerk reads.
export const getMinifluxToken = cache(
  async (): Promise<MinifluxIdentity | null> => {
    const { userId } = await auth();
    if (!userId) return null;

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const metadata = user.privateMetadata as
      | { minifluxToken?: string; minifluxUsername?: string }
      | undefined;

    if (!metadata?.minifluxToken) return null;

    return {
      userId,
      token: metadata.minifluxToken,
      minifluxUsername: metadata.minifluxUsername ?? null,
    };
  },
);
