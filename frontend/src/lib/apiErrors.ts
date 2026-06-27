import 'server-only';

import { NextResponse } from 'next/server';

export class PublicApiError extends Error {
  publicStatus: number;
  publicMessage: string;

  constructor(message: string, status = 500) {
    super(message);
    this.name = 'PublicApiError';
    this.publicMessage = message;
    this.publicStatus = status;
  }
}

export function apiErrorStatus(err: unknown, fallback = 500): number {
  const status =
    err instanceof PublicApiError ? err.publicStatus : fallback;
  return Number.isInteger(status) && status >= 400 && status <= 599
    ? status
    : 500;
}

export function apiErrorResponse(
  err: unknown,
  context: string,
  fallbackMessage = 'Internal server error',
  fallbackStatus = 500
) {
  console.error(context, err);
  return NextResponse.json(
    {
      error:
        err instanceof PublicApiError ? err.publicMessage : fallbackMessage,
    },
    { status: apiErrorStatus(err, fallbackStatus) }
  );
}
