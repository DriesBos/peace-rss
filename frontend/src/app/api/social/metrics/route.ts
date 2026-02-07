import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getSocialMetricsSnapshot } from '@/lib/social/metrics';

export const runtime = 'nodejs';

function getProvidedToken(request: NextRequest): string | null {
  const headerToken = request.headers.get('x-social-metrics-token');
  if (headerToken?.trim()) return headerToken.trim();

  const url = new URL(request.url);
  const queryToken = url.searchParams.get('token');
  if (queryToken?.trim()) return queryToken.trim();

  return null;
}

export async function GET(request: NextRequest): Promise<Response> {
  const expectedToken = process.env.SOCIAL_METRICS_TOKEN?.trim();
  if (!expectedToken) {
    return NextResponse.json(
      { error: 'Social metrics endpoint is disabled' },
      { status: 404 }
    );
  }

  const providedToken = getProvidedToken(request);
  if (!providedToken || providedToken !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json(getSocialMetricsSnapshot());
}
