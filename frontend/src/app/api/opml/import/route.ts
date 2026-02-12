import 'server-only';

import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { mfFetchUser } from '@/lib/miniflux';

export const runtime = 'nodejs';

const MAX_OPML_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const metadata = user.privateMetadata as
      | { minifluxToken?: string }
      | undefined;
    const token = metadata?.minifluxToken;

    if (!token) {
      return NextResponse.json(
        { error: 'Not provisioned. Call /api/bootstrap first.' },
        { status: 401 },
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof Blob)) {
      return NextResponse.json(
        { error: 'Missing OPML file in form field "file".' },
        { status: 400 },
      );
    }

    if (file.size <= 0) {
      return NextResponse.json({ error: 'OPML file is empty.' }, { status: 400 });
    }
    if (file.size > MAX_OPML_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'OPML file is too large.' },
        { status: 400 },
      );
    }

    const opmlXml = await file.text();
    if (!opmlXml.trim()) {
      return NextResponse.json({ error: 'OPML file is empty.' }, { status: 400 });
    }

    const response = await mfFetchUser<{ message?: string }>(token, '/v1/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        Accept: 'application/json',
      },
      body: opmlXml,
    });

    return NextResponse.json({
      ok: true,
      message: response?.message ?? 'Feeds imported successfully.',
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to import OPML' },
      { status: 500 },
    );
  }
}
