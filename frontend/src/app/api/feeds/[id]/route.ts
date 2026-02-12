import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { mfFetchUser } from '@/lib/miniflux';
import {
  isProtectedCategoryTitle,
  normalizeCategoryTitle,
  protectedCategoryTitleForKind,
  type ProtectedCategoryKind,
} from '@/lib/protectedCategories';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ id: string }>;
};

type MinifluxCategory = {
  id: number;
  user_id: number;
  title: string;
};

type MinifluxFeed = {
  id: number;
  feed_url: string;
  category?: { id: number; title: string };
  hide_globally?: boolean;
};

type UpdateFeedRequest = {
  title?: string;
  feed_url?: string;
  category_id?: number | null;
  blocklist_rules?: string;
  rewrite_rules?: string;
};

export async function PUT(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // 1. Require Clerk authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get user's Miniflux token from Clerk metadata
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

    // 3. Get feed ID from params
    const { id } = await context.params;
    const feedId = parseInt(id, 10);

    if (isNaN(feedId)) {
      return NextResponse.json({ error: 'Invalid feed ID' }, { status: 400 });
    }

    // 4. Parse request body
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { title, feed_url, category_id, blocklist_rules, rewrite_rules } =
      body as UpdateFeedRequest;

    let forcedKind: ProtectedCategoryKind | null = null;
    const existingFeed = await mfFetchUser<MinifluxFeed>(token, `/v1/feeds/${feedId}`);
    const existingCategoryKind = existingFeed.category?.title
      ? normalizeCategoryTitle(existingFeed.category.title)
      : null;
    if (existingCategoryKind && isProtectedCategoryTitle(existingCategoryKind)) {
      forcedKind = existingCategoryKind as ProtectedCategoryKind;
    }

    // Build update payload
    const updatePayload: Record<string, unknown> = {};
    if (title !== undefined) updatePayload.title = title;
    if (feed_url !== undefined) updatePayload.feed_url = feed_url;
    if (blocklist_rules !== undefined) {
      updatePayload.blocklist_rules = blocklist_rules;
    }
    if (rewrite_rules !== undefined) {
      updatePayload.rewrite_rules = rewrite_rules;
    }

    if (forcedKind) {
      const categories = await mfFetchUser<MinifluxCategory[]>(
        token,
        '/v1/categories',
      );
      const existing = categories.find(
        (cat) => normalizeCategoryTitle(cat.title) === forcedKind,
      );
      const protectedCategoryId = existing
        ? existing.id
        : (
            await mfFetchUser<MinifluxCategory>(token, '/v1/categories', {
              method: 'POST',
              body: JSON.stringify({ title: protectedCategoryTitleForKind(forcedKind) }),
            })
          ).id;

      updatePayload.hide_globally = true;
      updatePayload.category_id = protectedCategoryId;
    } else if (category_id !== undefined && category_id !== null) {
      if (!Number.isInteger(category_id) || category_id <= 0) {
        return NextResponse.json(
          { error: 'Invalid category ID' },
          { status: 400 },
        );
      }
      // Disallow moving feeds into protected categories.
      const categories = await mfFetchUser<MinifluxCategory[]>(
        token,
        '/v1/categories',
      );
      const target = categories.find((cat) => cat.id === category_id);
      if (target && isProtectedCategoryTitle(target.title)) {
        return NextResponse.json(
          { error: `${target.title.trim()} category is managed automatically.` },
          { status: 400 },
        );
      }
      updatePayload.category_id = category_id;
    }

    // 5. Update feed using Miniflux API
    await mfFetchUser(token, `/v1/feeds/${feedId}`, {
      method: 'PUT',
      body: JSON.stringify(updatePayload),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // 1. Require Clerk authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get user's Miniflux token from Clerk metadata
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

    // 3. Get feed ID from params
    const { id } = await context.params;
    const feedId = parseInt(id, 10);

    if (isNaN(feedId)) {
      return NextResponse.json({ error: 'Invalid feed ID' }, { status: 400 });
    }

    // 4. Delete feed using Miniflux API
    await mfFetchUser(token, `/v1/feeds/${feedId}`, {
      method: 'DELETE',
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
