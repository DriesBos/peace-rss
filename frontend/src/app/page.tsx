'use client';

import { useEffect, useMemo, useState } from 'react';
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/nextjs';
import styles from './page.module.sass';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';

type Feed = {
  id: number;
  title: string;
  unread_count?: number;
};

type Entry = {
  id: number;
  title: string;
  url: string;
  content?: string;
  summary?: string;
  feed_id: number;
  feed?: { id: number; title: string };
  feed_title?: string;
  published_at?: string;
  status?: 'read' | 'unread';
  starred?: boolean;
  bookmarked?: boolean;
};

type EntriesResponse = {
  total: number;
  entries: Entry[];
};

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    cache: 'no-store',
    ...init,
    headers: {
      'cache-control': 'no-store',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

function formatDate(value?: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

export default function Home() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null);
  const [selectedFeedId, setSelectedFeedId] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProvisioned, setIsProvisioned] = useState(false);
  const [provisionError, setProvisionError] = useState<string | null>(null);

  const feedsById = useMemo(() => {
    const map = new Map<number, Feed>();
    for (const feed of feeds) map.set(feed.id, feed);
    return map;
  }, [feeds]);

  const selectedEntry = useMemo(() => {
    return entries.find((e) => e.id === selectedEntryId) ?? null;
  }, [entries, selectedEntryId]);

  async function loadFeeds() {
    const data = await fetchJson<Feed[]>('/api/feeds');
    setFeeds(data);
  }

  function entriesUrl(nextOffset: number) {
    const qs = new URLSearchParams({
      status: 'unread',
      limit: '50',
      offset: String(nextOffset),
      order: 'published_at',
      direction: 'desc',
    });
    if (selectedFeedId) qs.set('feed_id', String(selectedFeedId));
    return `/api/entries?${qs.toString()}`;
  }

  async function loadEntries(opts?: { append?: boolean; nextOffset?: number }) {
    const append = Boolean(opts?.append);
    const nextOffset = opts?.nextOffset ?? 0;

    const data = await fetchJson<EntriesResponse>(entriesUrl(nextOffset));
    setTotal(data.total ?? 0);
    setOffset(nextOffset);
    if (append) {
      setEntries((prev) => [...prev, ...data.entries]);
      return;
    }

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
      await Promise.all([
        loadFeeds(),
        loadEntries({ append: false, nextOffset: 0 }),
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setIsLoading(false);
    }
  }

  async function markEntryStatus(
    entryIds: number[],
    status: 'read' | 'unread'
  ) {
    await fetchJson<{ ok: true }>('/api/entries/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entry_ids: entryIds, status }),
    });
  }

  async function markPageRead() {
    if (entries.length === 0) return;
    setIsLoading(true);
    setError(null);
    try {
      await markEntryStatus(
        entries.map((e) => e.id),
        'read'
      );
      await Promise.all([
        loadFeeds(),
        loadEntries({ append: false, nextOffset: 0 }),
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to mark page read');
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
      // Refresh list + selection state
      await Promise.all([
        loadFeeds(),
        loadEntries({ append: false, nextOffset: offset }),
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to toggle star');
    } finally {
      setIsLoading(false);
    }
  }

  async function setSelectedStatus(status: 'read' | 'unread') {
    if (!selectedEntry) return;
    setIsLoading(true);
    setError(null);
    try {
      await markEntryStatus([selectedEntry.id], status);
      await Promise.all([
        loadFeeds(),
        loadEntries({ append: false, nextOffset: 0 }),
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update status');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadMore() {
    setIsLoading(true);
    setError(null);
    try {
      await loadEntries({ append: true, nextOffset: offset + 50 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load more');
    } finally {
      setIsLoading(false);
    }
  }

  async function bootstrap() {
    try {
      const res = await fetchJson<{ ok: boolean; provisioned: boolean }>(
        '/api/bootstrap',
        { method: 'POST' }
      );
      if (res.ok && res.provisioned) {
        setIsProvisioned(true);
        setProvisionError(null);
      }
    } catch (e) {
      setProvisionError(e instanceof Error ? e.message : 'Provisioning failed');
      setIsProvisioned(false);
    }
  }

  // Bootstrap on mount
  useEffect(() => {
    void bootstrap();
  }, []);

  // Load feeds/entries after provisioning
  useEffect(() => {
    if (!isProvisioned) return;

    setIsLoading(true);
    setError(null);
    Promise.all([loadFeeds(), loadEntries({ append: false, nextOffset: 0 })])
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFeedId, isProvisioned]);

  const selectedIsStarred = Boolean(
    selectedEntry?.starred ?? selectedEntry?.bookmarked
  );

  const canLoadMore = entries.length > 0 && total > entries.length;
  const selectedFeedTitle =
    selectedFeedId === null
      ? 'All feeds'
      : feedsById.get(selectedFeedId)?.title;

  return (
    <>
      <SignedIn>
        {/* Show provisioning error with retry button */}
        {provisionError && !isProvisioned ? (
          <div className={styles.app}>
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <div className={styles.error}>{provisionError}</div>
              <button
                className={styles.button}
                onClick={() => void bootstrap()}
                style={{ marginTop: '1rem' }}
              >
                Retry
              </button>
            </div>
          </div>
        ) : !isProvisioned ? (
          <div className={styles.app}>
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              Setting up your account...
            </div>
          </div>
        ) : (
          <div className={styles.app}>
            <aside className={styles.sidebar}>
              <div className={styles.brand}>Pathanam Reader</div>
              <ThemeSwitcher />
              {/* <a
                className={styles.link}
                href="/miniflux"
                target="_blank"
                rel="noreferrer"
              >
                Open Miniflux
              </a> */}

              <div className={styles.sectionTitle}>Feeds</div>
              <div className={styles.feedList}>
                <button
                  type="button"
                  className={`${styles.feedItem} ${
                    selectedFeedId === null ? styles.feedItemActive : ''
                  }`}
                  onClick={() => setSelectedFeedId(null)}
                  disabled={isLoading}
                >
                  <span className={styles.feedTitle}>All feeds</span>
                </button>

                {feeds.length === 0 ? (
                  <div className={styles.muted}>No feeds yet.</div>
                ) : (
                  feeds.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={`${styles.feedItem} ${
                        selectedFeedId === f.id ? styles.feedItemActive : ''
                      }`}
                      onClick={() => setSelectedFeedId(f.id)}
                      disabled={isLoading}
                      title={f.title}
                    >
                      <span className={styles.feedTitle}>{f.title}</span>
                      {typeof f.unread_count === 'number' ? (
                        <span className={styles.badge}>{f.unread_count}</span>
                      ) : null}
                    </button>
                  ))
                )}
              </div>
              <ThemeSwitcher />
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
                  onClick={() => void markPageRead()}
                  disabled={isLoading || entries.length === 0}
                >
                  Mark page read
                </button>
                <div className={styles.spacer} />
                <div className={styles.meta}>
                  {isLoading
                    ? 'Loading…'
                    : `${entries.length}${total ? ` / ${total}` : ''} unread${
                        selectedFeedTitle ? ` — ${selectedFeedTitle}` : ''
                      }`}
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
                      e.feed?.title ??
                      feedsById.get(e.feed_id)?.title;
                    const published = formatDate(e.published_at);
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
                        <div className={styles.entryMeta}>
                          {feedTitle ? <span>{feedTitle}</span> : null}
                          {published ? <span>{published}</span> : null}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              <div className={styles.listFooter}>
                <button
                  className={styles.button}
                  onClick={() => void loadMore()}
                  disabled={isLoading || !canLoadMore}
                  type="button"
                >
                  Load more
                </button>
              </div>
            </section>

            <section className={styles.detailPane}>
              {!selectedEntry ? (
                <div className={styles.muted}>Select an entry to read.</div>
              ) : (
                <>
                  <div className={styles.detailHeader}>
                    <div>
                      <h1 className={styles.detailTitle}>
                        {selectedEntry.title || '(untitled)'}
                      </h1>
                      <div className={styles.meta}>
                        {(selectedEntry.feed_title ??
                          selectedEntry.feed?.title ??
                          feedsById.get(selectedEntry.feed_id)?.title) ||
                        selectedEntry.published_at ? (
                          <>
                            <span>
                              {selectedEntry.feed_title ??
                                selectedEntry.feed?.title ??
                                feedsById.get(selectedEntry.feed_id)?.title ??
                                ''}
                            </span>
                            <span>
                              {formatDate(selectedEntry.published_at) || ''}
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <div className={styles.detailActions}>
                      <a
                        className={styles.link}
                        href={selectedEntry.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open source
                      </a>
                      <button
                        className={styles.button}
                        onClick={() => void toggleSelectedStar()}
                        disabled={isLoading}
                        type="button"
                      >
                        {selectedIsStarred ? 'Unstar' : 'Star'}
                      </button>
                      <button
                        className={styles.button}
                        onClick={() => void setSelectedStatus('read')}
                        disabled={isLoading}
                        type="button"
                      >
                        Mark read
                      </button>
                      <button
                        className={styles.button}
                        onClick={() => void setSelectedStatus('unread')}
                        disabled={isLoading}
                        type="button"
                      >
                        Mark unread
                      </button>
                    </div>
                  </div>

                  {selectedEntry.content ? (
                    <div
                      className={styles.content}
                      dangerouslySetInnerHTML={{
                        __html: selectedEntry.content,
                      }}
                    />
                  ) : (
                    <div className={styles.content}>
                      {selectedEntry.summary ? (
                        <div
                          dangerouslySetInnerHTML={{
                            __html: selectedEntry.summary,
                          }}
                        />
                      ) : (
                        <div className={styles.muted}>No content.</div>
                      )}
                      <div style={{ marginTop: 12 }}>
                        <a
                          className={styles.link}
                          href={selectedEntry.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open source
                        </a>
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        )}
      </SignedIn>

      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}
