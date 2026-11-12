import 'server-only';

import { PublicApiError } from '@/lib/apiErrors';

export async function readJsonBody(
  request: Request,
): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new PublicApiError('Invalid JSON body', 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new PublicApiError('Invalid request body', 400);
  }
  return body as Record<string, unknown>;
}

export function parseId(value: string, label = 'id'): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new PublicApiError(`Invalid ${label}`, 400);
  }
  return id;
}

export function parseIdList(value: unknown, label = 'ids'): number[] {
  if (value === undefined || value === null) return [];
  if (
    !Array.isArray(value) ||
    !value.every((item) => Number.isInteger(item) && item > 0)
  ) {
    throw new PublicApiError(`Invalid ${label}`, 400);
  }
  return [...new Set(value as number[])];
}

/** "1,2,3" from a query string. */
export function parseIdCsv(value: string | null): number[] {
  if (!value) return [];
  const ids = value
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isInteger(id) && id > 0);
  return [...new Set(ids)];
}

/** Miniflux accepts long id lists, but keep requests a sane size. */
export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}
