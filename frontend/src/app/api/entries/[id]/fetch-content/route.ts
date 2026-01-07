import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { mfFetchUser } from '@/lib/miniflux';

/**
 * POST /api/entries/[id]/fetch-content
 * Fetch original article content for an entry
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const entryId = parseInt(id, 10);
  if (!entryId || isNaN(entryId)) {
    return NextResponse.json({ error: 'Invalid entry ID' }, { status: 400 });
  }

  try {
    // Get the user's Miniflux token from metadata
    const token =
      (process.env[`MINIFLUX_TOKEN_${userId}`] as string | undefined) ?? '';
    if (!token) {
      return NextResponse.json(
        { error: 'User not provisioned' },
        { status: 403 }
      );
    }

    // Fetch original content from Miniflux
    // This endpoint returns the entry with updated content
    const entry = await mfFetchUser<{
      id: number;
      title: string;
      content: string;
      url: string;
    }>(token, `/v1/entries/${entryId}/fetch-content`, {
      method: 'GET',
    });

    return NextResponse.json({ ok: true, content: entry.content });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to fetch content';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

