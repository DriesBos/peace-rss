import 'server-only';

import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/lib/apiErrors';
import { getReaderContext } from '@/lib/reader/account';
import { parseIdList, readJsonBody } from '@/lib/reader/http';
import {
  createTag,
  getCounts,
  listTags,
  reorderTags,
} from '@/lib/reader/queries';

export const runtime = 'nodejs';

/** GET /api/tags: all tags with unread counts, plus the global counts. */
export async function GET() {
  try {
    const { userId } = await getReaderContext();
    const [tags, counts] = await Promise.all([
      listTags(userId),
      getCounts(userId),
    ]);
    return NextResponse.json({ tags, counts });
  } catch (err) {
    return apiErrorResponse(err, 'Failed to fetch tags');
  }
}

/** POST /api/tags { title }: create a tag. */
export async function POST(request: Request) {
  try {
    const { userId } = await getReaderContext();
    const body = await readJsonBody(request);
    const title = typeof body.title === 'string' ? body.title : '';
    const tag = await createTag(userId, title);
    return NextResponse.json(tag);
  } catch (err) {
    return apiErrorResponse(err, 'Failed to create tag');
  }
}

/** PUT /api/tags { order: number[] }: reorder manual tags. */
export async function PUT(request: Request) {
  try {
    const { userId } = await getReaderContext();
    const body = await readJsonBody(request);
    await reorderTags(userId, parseIdList(body.order, 'order'));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err, 'Failed to reorder tags');
  }
}
