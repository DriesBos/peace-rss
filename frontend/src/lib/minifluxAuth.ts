import 'server-only';

import { auth, clerkClient } from '@clerk/nextjs/server';
import { cache } from 'react';

export type MinifluxIdentity = {
  userId: string;
  token: string;
  minifluxUsername: string | null;
};

// Single source of truth for request identity + Miniflux token.
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
