#!/usr/bin/env node
/**
 * One-time migration of Clerk users into Better Auth.
 *
 * Copies every Clerk user with their Clerk ID, email, verification status,
 * bcrypt password hash (from the dashboard CSV export) and Miniflux token
 * (from Clerk privateMetadata). Safe to re-run: existing rows are skipped.
 *
 * Env:
 *   CLERK_SECRET_KEY     Clerk production secret key (sk_live_...)
 *   AUTH_DATABASE_URL    Better Auth database (tables must exist: start the app once)
 *   MINIFLUX_TOKEN_KEY   Same value the app uses to encrypt Miniflux tokens
 *   CLERK_EXPORT_CSV     Optional path to the Clerk dashboard user export (for passwords)
 *
 * Usage:
 *   node scripts/migrate-clerk-users.mjs --dry-run
 *   node scripts/migrate-clerk-users.mjs
 */
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { symmetricEncrypt } from 'better-auth/crypto';

const dryRun = process.argv.includes('--dry-run');
const CLERK_API = (process.env.CLERK_API_URL || 'https://api.clerk.com').replace(/\/+$/, '');

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}`);
    process.exit(1);
  }
  return value;
}

/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, newlines in quotes). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...data] = rows.filter((r) => r.some((v) => v !== ''));
  return data.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), r[i] ?? ''])));
}

function loadPasswordDigests() {
  const path = process.env.CLERK_EXPORT_CSV;
  const digests = new Map();
  if (!path) {
    console.warn('CLERK_EXPORT_CSV not set: users will need "Forgot password" to sign in.');
    return digests;
  }
  for (const row of parseCsv(readFileSync(path, 'utf8'))) {
    const hasher = (row.password_hasher || 'bcrypt').toLowerCase();
    if (row.id && row.password_digest) {
      if (hasher !== 'bcrypt') {
        console.warn(`Skipping password for ${row.id}: unsupported hasher ${hasher}`);
        continue;
      }
      digests.set(row.id, row.password_digest);
    }
  }
  console.log(`Loaded ${digests.size} password hashes from CSV`);
  return digests;
}

async function fetchClerkUsers(secretKey) {
  const users = [];
  for (let offset = 0; ; offset += 500) {
    const res = await fetch(`${CLERK_API}/v1/users?limit=500&offset=${offset}&order_by=created_at`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    if (!res.ok) throw new Error(`Clerk API ${res.status}: ${await res.text()}`);
    const page = await res.json();
    users.push(...page);
    if (page.length < 500) break;
  }
  return users;
}

function toDate(ms) {
  const d = new Date(typeof ms === 'number' ? ms : Date.now());
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

async function main() {
  const secretKey = requireEnv('CLERK_SECRET_KEY');
  const dbUrl = requireEnv('AUTH_DATABASE_URL');
  const tokenKey = requireEnv('MINIFLUX_TOKEN_KEY');

  const digests = loadPasswordDigests();
  const clerkUsers = await fetchClerkUsers(secretKey);
  console.log(`Fetched ${clerkUsers.length} users from Clerk${dryRun ? ' (dry run)' : ''}`);

  const db = new pg.Client({ connectionString: dbUrl });
  await db.connect();

  const stats = { users: 0, passwords: 0, miniflux: 0, skipped: 0, noEmail: 0, socialOnly: 0 };

  try {
    for (const u of clerkUsers) {
      const primary =
        u.email_addresses?.find((e) => e.id === u.primary_email_address_id) ??
        u.email_addresses?.[0];
      if (!primary) {
        stats.noEmail++;
        console.warn(`Skipping ${u.id}: no email address`);
        continue;
      }

      const email = primary.email_address.toLowerCase();
      const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || email.split('@')[0];
      const verified = primary.verification?.status === 'verified';
      const digest = digests.get(u.id);
      const meta = u.private_metadata ?? {};
      if (!digest && (u.external_accounts?.length ?? 0) > 0) stats.socialOnly++;

      if (dryRun) {
        console.log(
          `${u.id} ${email} verified=${verified} password=${digest ? 'yes' : 'no'} miniflux=${meta.minifluxToken ? meta.minifluxUsername : 'none'}`,
        );
        continue;
      }

      await db.query('BEGIN');
      try {
        const inserted = await db.query(
          `INSERT INTO "user" (id, name, email, "emailVerified", image, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT DO NOTHING`,
          [u.id, name, email, verified, u.image_url || null, toDate(u.created_at), toDate(u.updated_at)],
        );
        if (inserted.rowCount === 0) {
          stats.skipped++;
          await db.query('ROLLBACK');
          continue;
        }
        stats.users++;

        if (digest) {
          await db.query(
            `INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
             VALUES ($1, $2, 'credential', $2, $3, now(), now())`,
            [randomUUID(), u.id, digest],
          );
          stats.passwords++;
        }

        if (meta.minifluxToken && meta.minifluxUsername) {
          await db.query(
            `INSERT INTO miniflux_account (user_id, miniflux_user_id, username, token_encrypted)
             VALUES ($1, NULL, $2, $3)
             ON CONFLICT (user_id) DO NOTHING`,
            [u.id, meta.minifluxUsername, await symmetricEncrypt({ key: tokenKey, data: meta.minifluxToken })],
          );
          stats.miniflux++;
        }
        await db.query('COMMIT');
      } catch (err) {
        await db.query('ROLLBACK');
        throw new Error(`Failed on ${u.id} (${email}): ${err.message}`);
      }
    }
  } finally {
    await db.end();
  }

  console.log('Done:', stats);
  if (stats.socialOnly) {
    console.log(`${stats.socialOnly} users only had social sign-in; they can use "Forgot password" to set one.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
