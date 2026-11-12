import 'server-only';

import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { MIGRATIONS } from '@/lib/reader/migrations';

/**
 * Reader database: our own tables (mirror of Miniflux entries + tags).
 * Everything lives in the `reader` schema of the database that
 * READER_DATABASE_URL points at. By default that is the Postgres
 * database Miniflux already uses; Miniflux never touches other schemas.
 */

type GlobalWithReader = typeof globalThis & {
  __readerPool?: Pool;
  __readerMigrated?: Promise<void>;
};

const globalRef = globalThis as GlobalWithReader;

export function isReaderConfigured(): boolean {
  return Boolean(process.env.READER_DATABASE_URL);
}

function getPool(): Pool {
  if (globalRef.__readerPool) return globalRef.__readerPool;

  const connectionString = process.env.READER_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'READER_DATABASE_URL is not set (e.g. postgres://user:pass@postgres:5432/miniflux?sslmode=disable)',
    );
  }

  const pool = new Pool({ connectionString, max: 10 });
  pool.on('error', (err) => {
    console.error('Reader database pool error', err);
  });
  globalRef.__readerPool = pool;
  return pool;
}

async function runMigrations(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    // One migrator at a time, also across several app instances.
    await client.query('SELECT pg_advisory_lock(871265001)');
    await client.query('CREATE SCHEMA IF NOT EXISTS reader');
    await client.query(
      `CREATE TABLE IF NOT EXISTS reader.migrations (
         version integer PRIMARY KEY,
         applied_at timestamptz NOT NULL DEFAULT now()
       )`,
    );
    const applied = await client.query<{ version: number }>(
      'SELECT version FROM reader.migrations',
    );
    const done = new Set(applied.rows.map((row) => row.version));

    for (const migration of MIGRATIONS) {
      if (done.has(migration.version)) continue;
      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query(
          'INSERT INTO reader.migrations (version) VALUES ($1)',
          [migration.version],
        );
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
  } finally {
    await client
      .query('SELECT pg_advisory_unlock(871265001)')
      .catch(() => undefined);
    client.release();
  }
}

export async function ensureReaderDb(): Promise<Pool> {
  const pool = getPool();
  if (!globalRef.__readerMigrated) {
    globalRef.__readerMigrated = runMigrations(pool).catch((err) => {
      globalRef.__readerMigrated = undefined;
      throw err;
    });
  }
  await globalRef.__readerMigrated;
  return pool;
}

export async function dbQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const pool = await ensureReaderDb();
  const result = await pool.query<T>(text, params);
  return result.rows;
}

export async function dbTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const pool = await ensureReaderDb();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
