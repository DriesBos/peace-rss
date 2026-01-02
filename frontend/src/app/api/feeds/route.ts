import 'server-only';

import { NextResponse } from 'next/server';
import { mfFetch } from '@/lib/miniflux';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const data = await mfFetch<unknown>('/v1/feeds');
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


