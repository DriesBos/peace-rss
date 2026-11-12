import 'server-only';

import { NextResponse } from 'next/server';
import { requireMinifluxToken } from '@/lib/minifluxAuth';
import { apiErrorResponse } from '@/lib/apiErrors';
import { mfFetchUser } from '@/lib/miniflux';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const authResult = await requireMinifluxToken();
    if (!authResult.ok) return authResult.response;
    const { token } = authResult;

    const opmlXml = await mfFetchUser<string>(token, '/v1/export', {
      headers: {
        Accept: 'application/xml,text/xml,*/*',
      },
    });

    return new NextResponse(opmlXml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Disposition': 'attachment; filename="feeds.opml"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return apiErrorResponse(err, 'Failed to export OPML', 'Failed to export OPML');
  }
}
