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

    // 3. Fetch feeds using per-user token
    const data = await mfFetchUser<unknown>(token, '/v1/feeds');
    return NextResponse.json(data);
  } catch (err) {
    return apiErrorResponse(err, 'Failed to fetch feeds');
  }
}

