import 'server-only';

import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { mfFetchUser } from '@/lib/miniflux';

export const runtime = 'nodejs';

export async function GET() {
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
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to export OPML' },
      { status: 500 },
    );
  }
}
