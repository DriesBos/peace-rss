import 'server-only';

import { PublicApiError } from '@/lib/apiErrors';
import { dbQuery, dbTransaction } from '@/lib/reader/db';
import { slugifyTag } from '@/lib/reader/slug';

/**
 * "Entry e has tag $n": the feed has it or the entry has it,
 * unless it was removed from this entry by hand.
 */
function hasTagSql(entryAlias: string, tagExpr: string): string {
  return `(
    NOT EXISTS (
      SELECT 1 FROM reader.entry_tags x
      WHERE x.entry_id = ${entryAlias}.id AND x.tag_id = ${tagExpr} AND x.removed)
    AND (
      EXISTS (
        SELECT 1 FROM reader.feed_tags ft
        WHERE ft.feed_id = ${entryAlias}.feed_id AND ft.tag_id = ${tagExpr})
      OR EXISTS (
        SELECT 1 FROM reader.entry_tags x
        WHERE x.entry_id = ${entryAlias}.id AND x.tag_id = ${tagExpr}
          AND NOT x.removed)))`;
}

export type EntryFilter = {
  status?: 'unread' | 'read' | null;
  starred?: boolean;
  search?: string | null;
  tagIds?: number[];
  /** Leave out feeds hidden from the main lists (social feeds). */
  visibleOnly?: boolean;
};

type Where = { sql: string; params: unknown[] };

function buildWhere(userId: string, filter: EntryFilter): Where {
  const params: unknown[] = [userId];
  const parts = ['e.user_id = $1'];

  if (filter.status) {
    params.push(filter.status);
    parts.push(`e.status = $${params.length}`);
  }
  if (filter.starred) parts.push('e.starred');

  const search = filter.search?.trim();
  if (search) {
    params.push(search);
    const q = `$${params.length}`;
    params.push(`%${search.replace(/[\\%_]/g, '\\$&')}%`);
    const like = `$${params.length}`;
    parts.push(
      `(e.search @@ plainto_tsquery('simple', ${q}) OR e.title ILIKE ${like})`,
    );
  }

  for (const tagId of filter.tagIds ?? []) {
    params.push(tagId);
    parts.push(hasTagSql('e', `$${params.length}`));
  }

  if (filter.visibleOnly) {
    parts.push(
      `NOT EXISTS (SELECT 1 FROM reader.feeds hf
                   WHERE hf.id = e.feed_id AND hf.hide_globally)`,
    );
  }

  return { sql: parts.join(' AND '), params };
}

export type EntryRow = {
  id: number;
  feed_id: number;
  title: string;
  url: string;
  author: string;
  content: string;
  preview?: string;
  thumbnail_url?: string;
  reading_time: number;
  published_at: string;
  status: 'read' | 'unread';
  starred: boolean;
  feed_title: string;
  tag_ids: number[];
};

type RawEntryRow = Omit<
  EntryRow,
  'id' | 'feed_id' | 'published_at' | 'tag_ids' | 'preview' | 'thumbnail_url'
> & {
  id: string;
  feed_id: string;
  published_at: Date;
  tag_ids: string[];
  preview: string | null;
  thumbnail_url: string | null;
};

function toEntryRow(row: RawEntryRow): EntryRow {
  return {
    ...row,
    id: Number(row.id),
    feed_id: Number(row.feed_id),
    published_at: row.published_at.toISOString(),
    preview: row.preview ?? undefined,
    thumbnail_url: row.thumbnail_url ?? undefined,
    tag_ids: (row.tag_ids ?? []).map(Number),
  };
}

const ENTRY_COLUMNS = `
  e.id, e.feed_id, e.title, e.url, e.author, e.content, e.preview,
  e.thumbnail_url, e.reading_time, e.published_at, e.status, e.starred,
  f.title AS feed_title,
  ARRAY(
    SELECT t.id FROM reader.tags t
    WHERE t.user_id = e.user_id AND ${hasTagSql('e', 't.id')}
    ORDER BY t.kind DESC, t.position, t.id
  ) AS tag_ids`;

export async function listEntries(
  userId: string,
  filter: EntryFilter,
  page: { limit: number; offset: number; direction: 'asc' | 'desc' },
): Promise<{ total: number; entries: EntryRow[] }> {
  const where = buildWhere(userId, filter);
  const dir = page.direction === 'asc' ? 'ASC' : 'DESC';

  const [countRow] = await dbQuery<{ total: string }>(
    `SELECT count(*) AS total FROM reader.entries e WHERE ${where.sql}`,
    where.params,
  );

  const params = [...where.params, page.limit, page.offset];
  const rows = await dbQuery<RawEntryRow>(
    `SELECT ${ENTRY_COLUMNS}
     FROM reader.entries e
     JOIN reader.feeds f ON f.id = e.feed_id
     WHERE ${where.sql}
     ORDER BY e.published_at ${dir}, e.id ${dir}
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  return {
    total: Number(countRow?.total ?? 0),
    entries: rows.map(toEntryRow),
  };
}

export async function getEntry(
  userId: string,
  entryId: number,
): Promise<EntryRow | null> {
  const rows = await dbQuery<RawEntryRow>(
    `SELECT ${ENTRY_COLUMNS}
     FROM reader.entries e
     JOIN reader.feeds f ON f.id = e.feed_id
     WHERE e.user_id = $1 AND e.id = $2`,
    [userId, entryId],
  );
  return rows[0] ? toEntryRow(rows[0]) : null;
}

export async function listEntryIds(
  userId: string,
  filter: EntryFilter,
): Promise<number[]> {
  const where = buildWhere(userId, filter);
  const rows = await dbQuery<{ id: string }>(
    `SELECT e.id FROM reader.entries e WHERE ${where.sql}`,
    where.params,
  );
  return rows.map((row) => Number(row.id));
}

export async function setEntriesStatus(
  userId: string,
  entryIds: number[],
  status: 'read' | 'unread',
): Promise<void> {
  if (entryIds.length === 0) return;
  await dbQuery(
    `UPDATE reader.entries SET status = $3
     WHERE user_id = $1 AND id = ANY($2::bigint[])`,
    [userId, entryIds, status],
  );
}

export async function toggleEntryStar(
  userId: string,
  entryId: number,
): Promise<void> {
  await dbQuery(
    `UPDATE reader.entries SET starred = NOT starred
     WHERE user_id = $1 AND id = $2`,
    [userId, entryId],
  );
}

/* ------------------------------------------------------------------ */
/* Tags                                                                */
/* ------------------------------------------------------------------ */

export type TagRow = {
  id: number;
  title: string;
  slug: string;
  kind: 'manual' | 'auto';
  position: number;
  feed_count: number;
  total_unread: number;
  has_entries: boolean;
};

export async function listTags(userId: string): Promise<TagRow[]> {
  const rows = await dbQuery<{
    id: string;
    title: string;
    slug: string;
    kind: 'manual' | 'auto';
    position: number;
    feed_count: string;
    total_unread: string;
    has_entries: boolean;
  }>(
    `SELECT t.id, t.title, t.slug, t.kind, t.position,
       (SELECT count(*) FROM reader.feed_tags ft WHERE ft.tag_id = t.id)
         AS feed_count,
       (SELECT count(*) FROM reader.entries e
        WHERE e.user_id = t.user_id AND e.status = 'unread'
          AND ${hasTagSql('e', 't.id')}) AS total_unread,
       (EXISTS (SELECT 1 FROM reader.feed_tags ft WHERE ft.tag_id = t.id)
        OR EXISTS (SELECT 1 FROM reader.entry_tags et
                   WHERE et.tag_id = t.id AND NOT et.removed)) AS has_entries
     FROM reader.tags t
     WHERE t.user_id = $1
     ORDER BY t.kind DESC, t.position, t.id`,
    [userId],
  );
  return rows.map((row) => ({
    ...row,
    id: Number(row.id),
    feed_count: Number(row.feed_count),
    total_unread: Number(row.total_unread),
  }));
}

export async function getCounts(
  userId: string,
): Promise<{ unread: number; all: number; starred: number }> {
  const [row] = await dbQuery<{ unread: string; all: string; starred: string }>(
    `SELECT
       count(*) FILTER (WHERE e.status = 'unread' AND NOT f.hide_globally) AS unread,
       count(*) FILTER (WHERE NOT f.hide_globally) AS "all",
       count(*) FILTER (WHERE e.starred) AS starred
     FROM reader.entries e
     JOIN reader.feeds f ON f.id = e.feed_id
     WHERE e.user_id = $1`,
    [userId],
  );
  return {
    unread: Number(row?.unread ?? 0),
    all: Number(row?.all ?? 0),
    starred: Number(row?.starred ?? 0),
  };
}

/** Keeps only ids of tags that belong to this user. */
export async function filterOwnTagIds(
  userId: string,
  tagIds: number[],
): Promise<number[]> {
  if (tagIds.length === 0) return [];
  const rows = await dbQuery<{ id: string }>(
    'SELECT id FROM reader.tags WHERE user_id = $1 AND id = ANY($2::bigint[])',
    [userId, tagIds],
  );
  const own = new Set(rows.map((row) => Number(row.id)));
  return tagIds.filter((id) => own.has(id));
}

export async function createTag(
  userId: string,
  title: string,
): Promise<{ id: number; title: string }> {
  const trimmed = title.trim();
  const slug = slugifyTag(trimmed);
  if (!trimmed || !slug) throw new PublicApiError('Tag name is required', 400);

  const rows = await dbQuery<{ id: string }>(
    `INSERT INTO reader.tags (user_id, title, slug, kind, position)
     VALUES ($1, $2, $3, 'manual',
       COALESCE((SELECT max(position) + 1 FROM reader.tags
                 WHERE user_id = $1 AND kind = 'manual'), 0))
     ON CONFLICT (user_id, slug) DO NOTHING
     RETURNING id`,
    [userId, trimmed, slug],
  );
  if (!rows[0]) throw new PublicApiError('A tag with this name exists', 409);
  return { id: Number(rows[0].id), title: trimmed };
}

async function requireManualTag(userId: string, tagId: number): Promise<void> {
  const [tag] = await dbQuery<{ kind: string }>(
    'SELECT kind FROM reader.tags WHERE user_id = $1 AND id = $2',
    [userId, tagId],
  );
  if (!tag) throw new PublicApiError('Tag not found', 404);
  if (tag.kind !== 'manual') {
    throw new PublicApiError('Automatic tags cannot be changed', 400);
  }
}

export async function renameTag(
  userId: string,
  tagId: number,
  title: string,
): Promise<void> {
  await requireManualTag(userId, tagId);
  const trimmed = title.trim();
  const slug = slugifyTag(trimmed);
  if (!trimmed || !slug) throw new PublicApiError('Tag name is required', 400);

  const [clash] = await dbQuery(
    'SELECT 1 FROM reader.tags WHERE user_id = $1 AND slug = $2 AND id <> $3',
    [userId, slug, tagId],
  );
  if (clash) throw new PublicApiError('A tag with this name exists', 409);

  await dbQuery(
    'UPDATE reader.tags SET title = $3, slug = $4 WHERE user_id = $1 AND id = $2',
    [userId, tagId, trimmed, slug],
  );
}

export async function deleteTag(userId: string, tagId: number): Promise<void> {
  await requireManualTag(userId, tagId);
  await dbQuery('DELETE FROM reader.tags WHERE user_id = $1 AND id = $2', [
    userId,
    tagId,
  ]);
}

export async function reorderTags(
  userId: string,
  orderedIds: number[],
): Promise<void> {
  await dbTransaction(async (client) => {
    for (const [index, id] of orderedIds.entries()) {
      await client.query(
        `UPDATE reader.tags SET position = $3
         WHERE user_id = $1 AND id = $2 AND kind = 'manual'`,
        [userId, id, index],
      );
    }
  });
}

/* ------------------------------------------------------------------ */
/* Feeds                                                               */
/* ------------------------------------------------------------------ */

export type FeedRow = {
  id: number;
  title: string;
  feed_url: string;
  site_url: string;
  hide_globally: boolean;
  unread_count: number;
  tag_ids: number[];
};

export async function listFeeds(userId: string): Promise<FeedRow[]> {
  const rows = await dbQuery<{
    id: string;
    title: string;
    feed_url: string;
    site_url: string;
    hide_globally: boolean;
    unread_count: string;
    tag_ids: string[];
  }>(
    `SELECT f.id, f.title, f.feed_url, f.site_url, f.hide_globally,
       (SELECT count(*) FROM reader.entries e
        WHERE e.feed_id = f.id AND e.status = 'unread') AS unread_count,
       ARRAY(SELECT ft.tag_id FROM reader.feed_tags ft
             WHERE ft.feed_id = f.id ORDER BY ft.tag_id) AS tag_ids
     FROM reader.feeds f
     WHERE f.user_id = $1
     ORDER BY lower(f.title), f.id`,
    [userId],
  );
  return rows.map((row) => ({
    ...row,
    id: Number(row.id),
    unread_count: Number(row.unread_count),
    tag_ids: (row.tag_ids ?? []).map(Number),
  }));
}

/** Replaces the tags of a feed. */
export async function setFeedTags(
  userId: string,
  feedId: number,
  tagIds: number[],
): Promise<void> {
  const own = await filterOwnTagIds(userId, tagIds);
  await dbTransaction(async (client) => {
    const feed = await client.query(
      'SELECT 1 FROM reader.feeds WHERE user_id = $1 AND id = $2',
      [userId, feedId],
    );
    if (feed.rowCount === 0) throw new PublicApiError('Feed not found', 404);

    await client.query(
      `DELETE FROM reader.feed_tags
       WHERE feed_id = $1 AND NOT (tag_id = ANY($2::bigint[]))`,
      [feedId, own],
    );
    if (own.length > 0) {
      await client.query(
        `INSERT INTO reader.feed_tags (feed_id, tag_id)
         SELECT $1, unnest($2::bigint[])
         ON CONFLICT DO NOTHING`,
        [feedId, own],
      );
    }
  });
}

/** Adds tags to a feed without touching the ones it has. */
export async function addFeedTags(
  userId: string,
  feedId: number,
  tagIds: number[],
): Promise<void> {
  const own = await filterOwnTagIds(userId, tagIds);
  if (own.length === 0) return;
  await dbQuery(
    `INSERT INTO reader.feed_tags (feed_id, tag_id)
     SELECT f.id, unnest($3::bigint[])
     FROM reader.feeds f WHERE f.user_id = $1 AND f.id = $2
     ON CONFLICT DO NOTHING`,
    [userId, feedId, own],
  );
}

export async function deleteFeedRow(
  userId: string,
  feedId: number,
): Promise<void> {
  await dbQuery('DELETE FROM reader.feeds WHERE user_id = $1 AND id = $2', [
    userId,
    feedId,
  ]);
}

/* ------------------------------------------------------------------ */
/* Tags on a single post                                               */
/* ------------------------------------------------------------------ */

export async function setEntryTag(
  userId: string,
  entryId: number,
  tagId: number,
  on: boolean,
): Promise<void> {
  const [row] = await dbQuery<{ from_feed: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM reader.feed_tags ft
       WHERE ft.feed_id = e.feed_id AND ft.tag_id = t.id) AS from_feed
     FROM reader.entries e
     JOIN reader.tags t ON t.user_id = e.user_id AND t.id = $3
     WHERE e.user_id = $1 AND e.id = $2`,
    [userId, entryId, tagId],
  );
  if (!row) throw new PublicApiError('Entry or tag not found', 404);

  if (on) {
    if (row.from_feed) {
      // The feed already gives this tag; just undo a manual removal.
      await dbQuery(
        'DELETE FROM reader.entry_tags WHERE entry_id = $1 AND tag_id = $2',
        [entryId, tagId],
      );
    } else {
      await dbQuery(
        `INSERT INTO reader.entry_tags (entry_id, tag_id, source, removed)
         VALUES ($1, $2, 'manual', false)
         ON CONFLICT (entry_id, tag_id)
         DO UPDATE SET removed = false, source = 'manual'`,
        [entryId, tagId],
      );
    }
    return;
  }

  // Off: remember the removal so the feed's tag or the automatic
  // detection does not bring it back.
  await dbQuery(
    `INSERT INTO reader.entry_tags (entry_id, tag_id, source, removed)
     VALUES ($1, $2, 'manual', true)
     ON CONFLICT (entry_id, tag_id)
     DO UPDATE SET removed = true, source = 'manual'`,
    [entryId, tagId],
  );
}

/* ------------------------------------------------------------------ */
/* Sync status                                                         */
/* ------------------------------------------------------------------ */

export async function getSyncStatus(userId: string) {
  const [account] = await dbQuery<{
    backfilled_at: Date | null;
    last_sync_at: Date | null;
    last_error: string | null;
  }>(
    `SELECT backfilled_at, last_sync_at, last_error
     FROM reader.accounts WHERE user_id = $1`,
    [userId],
  );
  const [counts] = await dbQuery<{
    feeds: string;
    entries: string;
    unread: string;
    starred: string;
  }>(
    `SELECT
       (SELECT count(*) FROM reader.feeds WHERE user_id = $1) AS feeds,
       count(*) AS entries,
       count(*) FILTER (WHERE status = 'unread') AS unread,
       count(*) FILTER (WHERE starred) AS starred
     FROM reader.entries WHERE user_id = $1`,
    [userId],
  );
  return {
    backfilled_at: account?.backfilled_at ?? null,
    last_sync_at: account?.last_sync_at ?? null,
    last_error: account?.last_error ?? null,
    mirror: {
      feeds: Number(counts?.feeds ?? 0),
      entries: Number(counts?.entries ?? 0),
      unread: Number(counts?.unread ?? 0),
      starred: Number(counts?.starred ?? 0),
    },
  };
}
