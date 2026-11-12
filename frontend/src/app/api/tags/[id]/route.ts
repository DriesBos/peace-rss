import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { apiErrorResponse } from '@/lib/apiErrors';
import { getReaderContext } from '@/lib/reader/account';
import { parseId, readJsonBody } from '@/lib/reader/http';
import { deleteTag, renameTag } from '@/lib/reader/queries';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: Ctx) {
  try {
    const { userId } = await getReaderContext();
    const tagId = parseId((await context.params).id, 'tag id');
    const body = await readJsonBody(request);
    const title = typeof body.title === 'string' ? body.title : '';
    await renameTag(userId, tagId, title);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err, 'Failed to update tag');
  }
}

export async function DELETE(_request: NextRequest, context: Ctx) {
  try {
    const { userId } = await getReaderContext();
    const tagId = parseId((await context.params).id, 'tag id');
    await deleteTag(userId, tagId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err, 'Failed to delete tag');
  }
}
