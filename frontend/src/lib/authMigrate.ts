import 'server-only';

import { Client } from 'pg';
import { getMigrations } from 'better-auth/db/migration';
import { auth } from '@/lib/auth';
import { authPool, getAuthDatabaseUrl } from '@/lib/authDb';
import { MINIFLUX_ACCOUNT_TABLE_SQL } from '@/lib/minifluxAccount';

/**
 * Creates the auth database if it does not exist yet. Existing Postgres
 * volumes skip init scripts, so this runs from the app on startup instead.
 */
async function ensureDatabase() {
  const target = new URL(getAuthDatabaseUrl());
  const dbName = decodeURIComponent(target.pathname.replace(/^\//, ''));
  if (!/^[a-zA-Z0-9_]+$/.test(dbName)) {
    throw new Error(`Unsupported auth database name: ${dbName}`);
  }

  const maintenance = new URL(target);
  maintenance.pathname = '/postgres';
  const client = new Client({ connectionString: maintenance.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName],
    );
    if (!rowCount) {
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`[auth] Created database ${dbName}`);
    }
  } finally {
    await client.end();
  }
}

/** Idempotent: creates the database, Better Auth tables and miniflux_account. */
export async function migrateAuthDatabase() {
  await ensureDatabase();
  const { runMigrations, toBeCreated, toBeAdded, toBeAddedIndexes } =
    await getMigrations(auth.options);
  if (toBeCreated.length || toBeAdded.length || toBeAddedIndexes.length) {
    await runMigrations();
    console.log('[auth] Applied Better Auth migrations');
  }
  await authPool.query(MINIFLUX_ACCOUNT_TABLE_SQL);
}
