import 'server-only';

import { NextResponse } from 'next/server';
import { requireMinifluxToken } from '@/lib/minifluxAuth';
import { apiErrorResponse } from '@/lib/apiErrors';
import { mfFetchUser } from '@/lib/miniflux';

export const runtime = 'nodejs';

type Category = {
  id: number;
  user_id: number;
  title: string;
  hide_globally?: boolean;
  feed_count?: number;
  total_unread?: number;
};

export async function GET(request: Request) {
  try {
    const authResult = await requireMinifluxToken();
    if (!authResult.ok) return authResult.response;
    const { token } = authResult;

    // 3. Fetch categories using per-user token
    const url = new URL(request.url);
    const includeCounts = url.searchParams.get('counts') !== 'false';
    const path = includeCounts ? '/v1/categories?counts=true' : '/v1/categories';
    const data = await mfFetchUser<Category[]>(token, path);
    return NextResponse.json(data);
  } catch (err) {
    return apiErrorResponse(err, 'Failed to fetch categories');
  }
}
