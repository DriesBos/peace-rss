import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { requireMinifluxToken } from '@/lib/minifluxAuth';
import { apiErrorResponse } from '@/lib/apiErrors';
import { mfFetchUser } from '@/lib/miniflux';
import { isProtectedCategoryTitle } from '@/lib/protectedCategories';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ id: string }>;
};

type UpdateCategoryRequest = {
  title?: string;
};

type MinifluxCategory = {
  id: number;
  user_id: number;
  title: string;
};

export async function PUT(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const authResult = await requireMinifluxToken();
    if (!authResult.ok) return authResult.response;
    const { token } = authResult;

    // 3. Get category ID from params
    const { id } = await context.params;
    const categoryId = parseInt(id, 10);

    if (isNaN(categoryId)) {
      return NextResponse.json(
        { error: 'Invalid category ID' },
        { status: 400 }
      );
    }

    // Disallow edits to protected categories (social-managed categories)
    const categories = await mfFetchUser<MinifluxCategory[]>(
      token,
      '/v1/categories'
    );
    const existing = categories.find((cat) => cat.id === categoryId);
    if (existing && isProtectedCategoryTitle(existing.title)) {
      return NextResponse.json(
        { error: 'This category is managed automatically and cannot be edited.' },
        { status: 403 }
      );
    }

    // 4. Parse request body
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { title } = body as UpdateCategoryRequest;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    if (isProtectedCategoryTitle(title)) {
      return NextResponse.json(
        { error: 'This category title is reserved.' },
        { status: 400 }
      );
    }

    // 5. Update category using Miniflux API
    await mfFetchUser(token, `/v1/categories/${categoryId}`, {
      method: 'PUT',
      body: JSON.stringify({ title: title.trim() }),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err, 'Failed to update category');
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const authResult = await requireMinifluxToken();
    if (!authResult.ok) return authResult.response;
    const { token } = authResult;

    // 3. Get category ID from params
    const { id } = await context.params;
    const categoryId = parseInt(id, 10);

    if (isNaN(categoryId)) {
      return NextResponse.json(
        { error: 'Invalid category ID' },
        { status: 400 }
      );
    }

    // Disallow deletes to protected categories (social-managed categories)
    const categories = await mfFetchUser<MinifluxCategory[]>(
      token,
      '/v1/categories'
    );
    const existing = categories.find((cat) => cat.id === categoryId);
    if (existing && isProtectedCategoryTitle(existing.title)) {
      return NextResponse.json(
        { error: 'This category is managed automatically and cannot be deleted.' },
        { status: 403 }
      );
    }

    // 4. Delete category using Miniflux API
    await mfFetchUser(token, `/v1/categories/${categoryId}`, {
      method: 'DELETE',
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err, 'Failed to delete category');
  }
}
