import 'server-only';

export type Migration = { version: number; sql: string };

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE reader.accounts (
        user_id text PRIMARY KEY,
        token_enc text NOT NULL,
        backfilled_at timestamptz,
        last_sync_at timestamptz,
        last_changed_cursor bigint NOT NULL DEFAULT 0,
        last_cleanup_at timestamptz,
        last_error text,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE reader.feeds (
        id bigint PRIMARY KEY,
        user_id text NOT NULL REFERENCES reader.accounts(user_id) ON DELETE CASCADE,
        title text NOT NULL DEFAULT '',
        site_url text NOT NULL DEFAULT '',
        feed_url text NOT NULL DEFAULT '',
        category_id bigint,
        category_title text,
        hide_globally boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX feeds_user_idx ON reader.feeds (user_id);

      CREATE TABLE reader.entries (
        id bigint PRIMARY KEY,
        user_id text NOT NULL REFERENCES reader.accounts(user_id) ON DELETE CASCADE,
        feed_id bigint NOT NULL REFERENCES reader.feeds(id) ON DELETE CASCADE,
        title text NOT NULL DEFAULT '',
        url text NOT NULL DEFAULT '',
        author text NOT NULL DEFAULT '',
        content text NOT NULL DEFAULT '',
        content_text text NOT NULL DEFAULT '',
        published_at timestamptz NOT NULL DEFAULT now(),
        status text NOT NULL DEFAULT 'unread',
        starred boolean NOT NULL DEFAULT false,
        reading_time integer NOT NULL DEFAULT 0,
        enclosures jsonb NOT NULL DEFAULT '[]'::jsonb,
        thumbnail_url text,
        preview text,
        created_at timestamptz NOT NULL DEFAULT now(),
        search tsvector GENERATED ALWAYS AS (
          to_tsvector('simple', title || ' ' || content_text)
        ) STORED
      );
      CREATE INDEX entries_user_published_idx
        ON reader.entries (user_id, published_at DESC, id DESC);
      CREATE INDEX entries_user_unread_idx
        ON reader.entries (user_id, feed_id) WHERE status = 'unread';
      CREATE INDEX entries_user_starred_idx
        ON reader.entries (user_id) WHERE starred;
      CREATE INDEX entries_feed_idx ON reader.entries (feed_id);
      CREATE INDEX entries_search_idx ON reader.entries USING gin (search);

      CREATE TABLE reader.tags (
        id bigserial PRIMARY KEY,
        user_id text NOT NULL REFERENCES reader.accounts(user_id) ON DELETE CASCADE,
        title text NOT NULL,
        slug text NOT NULL,
        kind text NOT NULL DEFAULT 'manual',
        position integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (user_id, slug)
      );

      CREATE TABLE reader.feed_tags (
        feed_id bigint NOT NULL REFERENCES reader.feeds(id) ON DELETE CASCADE,
        tag_id bigint NOT NULL REFERENCES reader.tags(id) ON DELETE CASCADE,
        PRIMARY KEY (feed_id, tag_id)
      );
      CREATE INDEX feed_tags_tag_idx ON reader.feed_tags (tag_id);

      CREATE TABLE reader.entry_tags (
        entry_id bigint NOT NULL REFERENCES reader.entries(id) ON DELETE CASCADE,
        tag_id bigint NOT NULL REFERENCES reader.tags(id) ON DELETE CASCADE,
        source text NOT NULL DEFAULT 'manual',
        removed boolean NOT NULL DEFAULT false,
        PRIMARY KEY (entry_id, tag_id)
      );
      CREATE INDEX entry_tags_tag_idx ON reader.entry_tags (tag_id);
    `,
  },
];
