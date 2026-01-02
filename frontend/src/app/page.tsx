'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from './page.module.scss';

type Feed = {
  id: number;
  title: string;
};

type Entry = {
  id: number;
  title: string;
  url: string;
  content?: string;
  feed_id?: number;
  feed_title?: string;
  starred?: boolean;
  bookmarked?: boolean;
};

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export default function Home() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const feedsById = useMemo(() => {
    const map = new Map<number, Feed>();
    for (const feed of feeds) map.set(feed.id, feed);
    return map;
  }, [feeds]);

  const selectedEntry = useMemo(() => {
    return entries.find((e) => e.id === selectedEntryId) ?? null;
  }, [entries, selectedEntryId]);

  async function loadFeeds() {
    const data = await fetchJson<Feed[]>('/api/feeds', { cache: 'no-store' });
    setFeeds(data);
  }

  async function loadEntries() {
    const data = await fetchJson<{ total: number; entries: Entry[] }>(
      '/api/entries?status=unread&limit=50&offset=0&order=published_at&direction=desc',
      { cache: 'no-store' }
    );
    setEntries(data.entries);
    setSelectedEntryId((prev) => {
      if (prev && data.entries.some((e) => e.id === prev)) return prev;
      return data.entries[0]?.id ?? null;
    });
  }

  async function refreshAll() {
    setIsLoading(true);
    setError(null);
    try {
      await Promise.all([loadFeeds(), loadEntries()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setIsLoading(false);
    }
  }

  async function markSelectedRead() {
    if (!selectedEntry) return;
    setIsLoading(true);
    setError(null);
    try {
      await fetchJson<{ ok: true }>('/api/entries/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_ids: [selectedEntry.id], status: 'read' }),
      });
      await loadEntries();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to mark read');
    } finally {
      setIsLoading(false);
    }
  }

  async function toggleSelectedStar() {
    if (!selectedEntry) return;
    setIsLoading(true);
    setError(null);
    try {
      await fetchJson<{ ok: true }>(
        `/api/entries/${selectedEntry.id}/bookmark`,
        {
          method: 'POST',
        }
      );
      await loadEntries();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to toggle star');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedIsStarred = Boolean(
    selectedEntry?.starred ?? selectedEntry?.bookmarked
  );

  return (
    <div className={styles.app}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>Peace RSS</div>
        <a
          className={styles.link}
          href="/miniflux"
          target="_blank"
          rel="noreferrer"
        >
          Open Miniflux
        </a>

        <div className={styles.sectionTitle}>Feeds</div>
        <div className={styles.feedList}>
          {feeds.length === 0 ? (
            <div className={styles.muted}>No feeds yet.</div>
          ) : (
            feeds.map((f) => (
              <div key={f.id} className={styles.feedItem} title={f.title}>
                {f.title}
              </div>
            ))
          )}
        </div>
      </aside>

      <section className={styles.listPane}>
        <div className={styles.toolbar}>
          <button
            className={styles.button}
            onClick={() => void refreshAll()}
            disabled={isLoading}
          >
            Refresh
          </button>
          <button
            className={styles.button}
            onClick={() => void markSelectedRead()}
            disabled={isLoading || !selectedEntry}
          >
            Mark Read
          </button>
          <button
            className={styles.button}
            onClick={() => void toggleSelectedStar()}
            disabled={isLoading || !selectedEntry}
          >
            {selectedIsStarred ? 'Unstar' : 'Star'}
          </button>
          <div className={styles.spacer} />
          <div className={styles.meta}>
            {isLoading ? 'Loading…' : `${entries.length} unread`}
          </div>
        </div>

        {error ? <div className={styles.error}>{error}</div> : null}

        <div className={styles.entryList}>
          {entries.length === 0 ? (
            <div className={styles.muted}>No unread entries.</div>
          ) : (
            entries.map((e) => {
              const isActive = e.id === selectedEntryId;
              const feedTitle =
                e.feed_title ??
                (e.feed_id ? feedsById.get(e.feed_id)?.title : '');
              return (
                <button
                  key={e.id}
                  className={`${styles.entryItem} ${
                    isActive ? styles.entryItemActive : ''
                  }`}
                  onClick={() => setSelectedEntryId(e.id)}
                  type="button"
                >
                  <div className={styles.entryTitle}>
                    {e.title || '(untitled)'}
                  </div>
                  {feedTitle ? (
                    <div className={styles.entryMeta}>{feedTitle}</div>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </section>

      <section className={styles.detailPane}>
        {!selectedEntry ? (
          <div className={styles.muted}>Select an entry to read.</div>
        ) : (
          <>
            <div className={styles.detailHeader}>
              <h1 className={styles.detailTitle}>
                {selectedEntry.title || '(untitled)'}
              </h1>
              <a
                className={styles.link}
                href={selectedEntry.url}
                target="_blank"
                rel="noreferrer"
              >
                Open source
              </a>
            </div>

            <div
              className={styles.content}
              dangerouslySetInnerHTML={{
                __html: selectedEntry.content ?? '',
              }}
            />
          </>
        )}
      </section>
    </div>
  );
}
