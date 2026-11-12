import 'server-only';

import { NextResponse } from 'next/server';
import { requireMinifluxToken } from '@/lib/minifluxAuth';
import { apiErrorResponse } from '@/lib/apiErrors';
import { mfFetchUser } from '@/lib/miniflux';
import type { ReaderPreferences } from '@/app/_lib/types';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const authResult = await requireMinifluxToken();
    if (!authResult.ok) return authResult.response;
    const { token } = authResult;

    const data = await mfFetchUser<ReaderPreferences>(token, '/v1/me');
    return NextResponse.json(data);
  } catch (err) {
    return apiErrorResponse(err, 'Failed to fetch current user');
  }
}
