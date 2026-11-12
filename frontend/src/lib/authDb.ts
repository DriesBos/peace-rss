import 'server-only';

import { Pool } from 'pg';

const globalForPool = globalThis as unknown as { authPool?: Pool };

export function getAuthDatabaseUrl(): string {
  const url = process.env.AUTH_DATABASE_URL;
  if (!url) {
    throw new Error('AUTH_DATABASE_URL is not set');
  }
  return url;
}

/**
 * Shared Postgres pool for the auth database (Better Auth tables and
 * the miniflux_account link table). Created lazily so `next build`
 * does not need database credentials.
 */
export const authPool: Pool =
  globalForPool.authPool ??
  new Pool({
    connectionString: process.env.AUTH_DATABASE_URL,
    max: 5,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPool.authPool = authPool;
}
