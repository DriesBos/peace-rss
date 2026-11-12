import 'server-only';

import { mfFetchUser } from '@/lib/miniflux';
import { listSyncAccounts, type ReaderContext } from '@/lib/reader/account';
import { dbQuery, dbTransaction, isReaderConfigured } from '@/lib/reader/db';
import { deriveEntryFields, type Enclosure } from '@/lib/reader/detect';
import { slugifyTag } from '@/lib/reader/slug';

/**
 * Copies feeds and entries from Miniflux into the reader schema.
 * Miniflux stays the fetcher; lists, tags and counts come from our copy.
 */

const PAGE_SIZE = 250;
const CURSOR_OVERLAP_SECONDS = 120;
const RETENTION_DAYS = Number(process.env.READER_RETENTION_DAYS || 180);
/** Miniflux's default category; it means "no category", so it gets no tag. */
const DEFAULT_CATEGORY_TITLE = 'all';

type MinifluxFeed = {
  id: number;
  title?: string;
  site_url?: string;
  feed_url?: string;
  hide_globally?: boolean;
  category?: { id: number; title: string; hide_globally?: boolean };
};

export type MinifluxEntry = {
  id: number;
  feed_id: number;
  status?: string;
  title?: string;
  url?: string;
  author?: string;
  content?: string;
  published_at?: string;
  starred?: boolean;
  reading_time?: number;
  enclosures?: Enclosure[] | null;
};

type EntriesPage = { total: number; entries: MinifluxEntry[] };

export type SyncResult = {
  feeds: number;
  entries: number;
  backfilled: boolean;
};

function clean(value: string | undefined | null): string {
  // Postgres text cannot hold NUL bytes.
  return (value ?? '').replace(/\u0000/g, '');
}

async function findOrCreateTag(
  userId: string,
  title: string,
): Promise<number | null> {
  const slug = slugifyTag(title);
  if (!slug) return null;
  const rows = await dbQuery<{ id: string }>(
    `INSERT INTO reader.tags (user_id, title, slug, kind, position)
     VALUES ($1, $2, $3, 'manual',
       COALESCE((SELECT max(position) + 1 FROM reader.tags
                 WHERE user_id = $1 AND kind = 'manual'), 0))
     ON CONFLICT (user_id, slug) DO UPDATE SET slug = EXCLUDED.slug
     RETURNING id`,
    [userId, title.trim(), slug],
  );
  return rows[0] ? Number(rows[0].id) : null;
}

export async function syncFeeds(ctx: ReaderContext): Promise<number> {
  const feeds = await mfFetchUser<MinifluxFeed[]>(ctx.token, '/v1/feeds');
  const existingRows = await dbQuery<{ id: string }>(
    'SELECT id FROM reader.feeds WHERE user_id = $1',
    [ctx.userId],
  );
  const existing = new Set(existingRows.map((row) => Number(row.id)));
  const seen = new Set<number>();

  for (const feed of feeds) {
    seen.add(feed.id);
    await dbQuery(
      `INSERT INTO reader.feeds
         (id, user_id, title, site_url, feed_url, category_id, category_title, hide_globally)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         site_url = EXCLUDED.site_url,
         feed_url = EXCLUDED.feed_url,
         category_id = EXCLUDED.category_id,
         category_title = EXCLUDED.category_title,
         hide_globally = EXCLUDED.hide_globally
       WHERE reader.feeds.user_id = EXCLUDED.user_id`,
      [
        feed.id,
        ctx.userId,
        clean(feed.title),
        clean(feed.site_url),
        clean(feed.feed_url),
        feed.category?.id ?? null,
        feed.category?.title ? clean(feed.category.title) : null,
        Boolean(feed.hide_globally || feed.category?.hide_globally),
      ],
    );

    // A feed we see for the first time starts with its Miniflux category
    // as a tag. This converts existing categories and keeps OPML imports
    // and the managed Instagram/Twitter categories working.
    if (!existing.has(feed.id)) {
      const categoryTitle = feed.category?.title?.trim() ?? '';
      if (
        categoryTitle &&
        categoryTitle.toLowerCase() !== DEFAULT_CATEGORY_TITLE
      ) {
        const tagId = await findOrCreateTag(ctx.userId, categoryTitle);
        if (tagId) {
          await dbQuery(
            `INSERT INTO reader.feed_tags (feed_id, tag_id)
             VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [feed.id, tagId],
          );
        }
      }
    }
  }

  const gone = [...existing].filter((id) => !seen.has(id));
  if (gone.length > 0) {
    await dbQuery(
      'DELETE FROM reader.feeds WHERE user_id = $1 AND id = ANY($2::bigint[])',
      [ctx.userId, gone],
    );
  }

  return feeds.length;
}

export async function upsertEntries(
  userId: string,
  entries: MinifluxEntry[],
): Promise<number> {
  if (entries.length === 0) return 0;

  const rows: Record<string, unknown>[] = [];
  const autoTags: { entry_id: number; slug: string }[] = [];

  for (const entry of entries) {
    const content = clean(entry.content);
    const url = clean(entry.url);
    const derived = deriveEntryFields({
      url,
      content,
      reading_time: entry.reading_time,
      enclosures: entry.enclosures,
    });
    rows.push({
      id: entry.id,
      feed_id: entry.feed_id,
      title: clean(entry.title),
      url,
      author: clean(entry.author),
      content,
      content_text: clean(derived.contentText),
      published_at: entry.published_at ?? new Date().toISOString(),
      status: entry.status === 'unread' ? 'unread' : 'read',
      starred: Boolean(entry.starred),
      reading_time: entry.reading_time ?? 0,
      enclosures: (entry.enclosures ?? []).map((enclosure) => ({
        url: clean(enclosure.url),
        mime_type: clean(enclosure.mime_type),
      })),
      thumbnail_url: derived.thumbnailUrl ? clean(derived.thumbnailUrl) : null,
      preview: derived.preview ? clean(derived.preview) : null,
    });
    for (const slug of derived.autoTags) {
      autoTags.push({ entry_id: entry.id, slug });
    }
  }

  const ids = entries.map((entry) => entry.id);

  await dbTransaction(async (client) => {
    await client.query(
      `INSERT INTO reader.entries
         (id, user_id, feed_id, title, url, author, content, content_text,
          published_at, status, starred, reading_time, enclosures,
          thumbnail_url, preview)
       SELECT x.id, $1, x.feed_id, x.title, x.url, x.author, x.content,
              x.content_text, x.published_at, x.status, x.starred,
              x.reading_time, x.enclosures, x.thumbnail_url, x.preview
       FROM jsonb_to_recordset($2::jsonb) AS x(
         id bigint, feed_id bigint, title text, url text, author text,
         content text, content_text text, published_at timestamptz,
         status text, starred boolean, reading_time integer,
         enclosures jsonb, thumbnail_url text, preview text)
       WHERE EXISTS (
         SELECT 1 FROM reader.feeds f
         WHERE f.id = x.feed_id AND f.user_id = $1)
       ON CONFLICT (id) DO UPDATE SET
         feed_id = EXCLUDED.feed_id,
         title = EXCLUDED.title,
         url = EXCLUDED.url,
         author = EXCLUDED.author,
         content = EXCLUDED.content,
         content_text = EXCLUDED.content_text,
         published_at = EXCLUDED.published_at,
         status = EXCLUDED.status,
         starred = EXCLUDED.starred,
         reading_time = EXCLUDED.reading_time,
         enclosures = EXCLUDED.enclosures,
         thumbnail_url = EXCLUDED.thumbnail_url,
         preview = EXCLUDED.preview
       WHERE reader.entries.user_id = EXCLUDED.user_id`,
      [userId, JSON.stringify(rows)],
    );

    const autoJson = JSON.stringify(autoTags);

    // Automatic tags that no longer apply (content changed) go away,
    // unless the user touched them by hand.
    await client.query(
      `DELETE FROM reader.entry_tags et
       USING reader.tags t, reader.entries e
       WHERE et.tag_id = t.id
         AND e.id = et.entry_id
         AND e.user_id = $1
         AND t.kind = 'auto'
         AND et.source = 'auto'
         AND NOT et.removed
         AND et.entry_id = ANY($2::bigint[])
         AND NOT EXISTS (
           SELECT 1
           FROM jsonb_to_recordset($3::jsonb) AS x(entry_id bigint, slug text)
           WHERE x.entry_id = et.entry_id AND x.slug = t.slug)`,
      [userId, ids, autoJson],
    );

    if (autoTags.length > 0) {
      await client.query(
        `INSERT INTO reader.entry_tags (entry_id, tag_id, source)
         SELECT x.entry_id, t.id, 'auto'
         FROM jsonb_to_recordset($2::jsonb) AS x(entry_id bigint, slug text)
         JOIN reader.tags t ON t.user_id = $1 AND t.slug = x.slug AND t.kind = 'auto'
         JOIN reader.entries e ON e.id = x.entry_id AND e.user_id = $1
         ON CONFLICT (entry_id, tag_id) DO NOTHING`,
        [userId, autoJson],
      );
    }
  });

  return entries.length;
}

async function fetchEntriesPage(
  token: string,
  params: Record<string, string>,
): Promise<EntriesPage> {
  const qs = new URLSearchParams({
    order: 'id',
    direction: 'asc',
    limit: String(PAGE_SIZE),
    ...params,
  });
  // Leave out Miniflux's "removed" entries.
  qs.append('status', 'unread');
  qs.append('status', 'read');
  return mfFetchUser<EntriesPage>(token, `/v1/entries?${qs.toString()}`);
}

async function backfillEntries(ctx: ReaderContext): Promise<number> {
  let count = 0;
  let afterEntryId = 0;
  for (;;) {
    const page = await fetchEntriesPage(
      ctx.token,
      afterEntryId > 0 ? { after_entry_id: String(afterEntryId) } : {},
    );
    const entries = page.entries ?? [];
    if (entries.length === 0) break;
    count += await upsertEntries(ctx.userId, entries);
    afterEntryId = entries[entries.length - 1].id;
    if (entries.length < PAGE_SIZE) break;
  }
  return count;
}

async function syncChangedEntries(
  ctx: ReaderContext,
  cursor: number,
): Promise<number> {
  let count = 0;
  let offset = 0;
  for (;;) {
    const page = await fetchEntriesPage(ctx.token, {
      changed_after: String(cursor),
      offset: String(offset),
    });
    const entries = page.entries ?? [];
    if (entries.length === 0) break;
    count += await upsertEntries(ctx.userId, entries);
    offset += entries.length;
    if (entries.length < PAGE_SIZE) break;
  }
  return count;
}

async function cleanupOldEntries(userId: string): Promise<void> {
  if (!Number.isFinite(RETENTION_DAYS) || RETENTION_DAYS <= 0) return;
  await dbQuery(
    `DELETE FROM reader.entries e
     WHERE e.user_id = $1
       AND e.created_at < now() - make_interval(days => $2::int)
       AND NOT e.starred
       AND NOT EXISTS (
         SELECT 1 FROM reader.entry_tags et
         WHERE et.entry_id = e.id AND et.source = 'manual')`,
    [userId, Math.floor(RETENTION_DAYS)],
  );
  await dbQuery(
    'UPDATE reader.accounts SET last_cleanup_at = now() WHERE user_id = $1',
    [userId],
  );
}

async function runSync(ctx: ReaderContext): Promise<SyncResult> {
  const startedAt = Math.floor(Date.now() / 1000);
  const [account] = await dbQuery<{
    backfilled_at: Date | null;
    last_changed_cursor: string;
    last_cleanup_at: Date | null;
  }>(
    `SELECT backfilled_at, last_changed_cursor, last_cleanup_at
     FROM reader.accounts WHERE user_id = $1`,
    [ctx.userId],
  );
  if (!account) throw new Error('Reader account is missing');

  try {
    const feeds = await syncFeeds(ctx);
    const needsBackfill = !account.backfilled_at;
    const entries = needsBackfill
      ? await backfillEntries(ctx)
      : await syncChangedEntries(ctx, Number(account.last_changed_cursor));

    await dbQuery(
      `UPDATE reader.accounts SET
         backfilled_at = COALESCE(backfilled_at, now()),
         last_sync_at = now(),
         last_changed_cursor = $2,
         last_error = NULL
       WHERE user_id = $1`,
      [ctx.userId, startedAt - CURSOR_OVERLAP_SECONDS],
    );

    const lastCleanup = account.last_cleanup_at?.getTime() ?? 0;
    if (Date.now() - lastCleanup > 24 * 60 * 60 * 1000) {
      await cleanupOldEntries(ctx.userId);
    }

    return { feeds, entries, backfilled: needsBackfill };
  } catch (err) {
    await dbQuery(
      'UPDATE reader.accounts SET last_error = $2 WHERE user_id = $1',
      [ctx.userId, err instanceof Error ? err.message : String(err)],
    ).catch(() => undefined);
    throw err;
  }
}

type GlobalWithSync = typeof globalThis & {
  __readerSyncRunning?: Map<string, Promise<SyncResult>>;
  __readerSyncTimer?: ReturnType<typeof setInterval>;
  __readerSyncAllBusy?: boolean;
};

const globalRef = globalThis as GlobalWithSync;
const running = (globalRef.__readerSyncRunning ??= new Map());

/** One sync per user at a time; concurrent callers share the same run. */
export function syncUser(ctx: ReaderContext): Promise<SyncResult> {
  const current = running.get(ctx.userId);
  if (current) return current;

  const promise = runSync(ctx).finally(() => {
    running.delete(ctx.userId);
  });
  running.set(ctx.userId, promise);
  return promise;
}

/** First visit: wait for the backfill so lists are complete. */
export async function ensureInitialSync(ctx: ReaderContext): Promise<void> {
  const [account] = await dbQuery<{ backfilled_at: Date | null }>(
    'SELECT backfilled_at FROM reader.accounts WHERE user_id = $1',
    [ctx.userId],
  );
  if (account?.backfilled_at) return;
  await syncUser(ctx);
}

async function syncAllAccounts(): Promise<void> {
  if (globalRef.__readerSyncAllBusy) return;
  globalRef.__readerSyncAllBusy = true;
  try {
    const accounts = await listSyncAccounts();
    for (const account of accounts) {
      try {
        await syncUser(account);
      } catch (err) {
        console.error(`Reader sync failed for ${account.userId}`, err);
      }
    }
  } catch (err) {
    console.error('Reader sync failed', err);
  } finally {
    globalRef.__readerSyncAllBusy = false;
  }
}

/** Started once per server process from instrumentation.ts. */
export function startReaderSync(): void {
  if (!isReaderConfigured() || globalRef.__readerSyncTimer) return;
  const seconds = Number(process.env.READER_SYNC_INTERVAL_SECONDS || 60);
  const intervalMs = Math.max(15, Number.isFinite(seconds) ? seconds : 60) * 1000;
  globalRef.__readerSyncTimer = setInterval(() => {
    void syncAllAccounts();
  }, intervalMs);
  globalRef.__readerSyncTimer.unref?.();
  void syncAllAccounts();
}
