import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { apiErrorResponse } from '@/lib/apiErrors';
import { getMinifluxToken } from '@/lib/minifluxAuth';
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
    const identity = await getMinifluxToken();
    if (!identity) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const feedId = parseInt(id, 10);

    if (isNaN(feedId)) {
      return NextResponse.json({ error: 'Invalid feed ID' }, { status: 400 });
    }

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
    const existingFeed = await mfFetchUser<MinifluxFeed>(
      identity.token,
      `/v1/feeds/${feedId}`,
    );
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
        identity.token,
        '/v1/categories',
      );
      const existing = categories.find(
        (cat) => normalizeCategoryTitle(cat.title) === forcedKind,
      );
      const protectedCategoryId = existing
        ? existing.id
        : (
            await mfFetchUser<MinifluxCategory>(
              identity.token,
              '/v1/categories',
              {
                method: 'POST',
                body: JSON.stringify({
                  title: protectedCategoryTitleForKind(forcedKind),
                }),
              },
            )
          ).id;

      updatePayload.hide_globally = true;
      updatePayload.category_id = protectedCategoryId;
    } else if (category_id === null) {
      updatePayload.category_id = null;
    } else if (category_id !== undefined) {
      if (!Number.isInteger(category_id) || category_id <= 0) {
        return NextResponse.json(
          { error: 'Invalid category ID' },
          { status: 400 },
        );
      }
      // Disallow moving feeds into protected categories.
      const categories = await mfFetchUser<MinifluxCategory[]>(
        identity.token,
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

    await mfFetchUser(identity.token, `/v1/feeds/${feedId}`, {
      method: 'PUT',
      body: JSON.stringify(updatePayload),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err, 'Failed to update feed');
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const identity = await getMinifluxToken();
    if (!identity) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const feedId = parseInt(id, 10);

    if (isNaN(feedId)) {
      return NextResponse.json({ error: 'Invalid feed ID' }, { status: 400 });
    }

    await mfFetchUser(identity.token, `/v1/feeds/${feedId}`, {
      method: 'DELETE',
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err, 'Failed to delete feed');
  }
}
