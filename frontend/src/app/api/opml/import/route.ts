import 'server-only';

import { NextResponse } from 'next/server';
import { requireMinifluxToken } from '@/lib/minifluxAuth';
import { apiErrorResponse } from '@/lib/apiErrors';
import { mfFetchUser } from '@/lib/miniflux';
import { ensureAccount } from '@/lib/reader/account';
import { syncUser } from '@/lib/reader/sync';

export const runtime = 'nodejs';

const MAX_OPML_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const authResult = await requireMinifluxToken();
    if (!authResult.ok) return authResult.response;
    const { token, userId } = authResult;

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

    // Copy the imported feeds over; their OPML folders become tags.
    try {
      await ensureAccount(userId, token);
      await syncUser({ userId, token });
    } catch (syncErr) {
      console.error('Failed to sync after OPML import:', syncErr);
    }

    return NextResponse.json({
      ok: true,
      message: response?.message ?? 'Feeds imported successfully.',
    });
  } catch (err) {
    return apiErrorResponse(err, 'Failed to import OPML', 'Failed to import OPML');
  }
}
