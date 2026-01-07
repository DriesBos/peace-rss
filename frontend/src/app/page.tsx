'use client';

import { useEffect, useMemo, useState } from 'react';
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/nextjs';
import styles from './page.module.sass';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';

type Category = {
  id: number;
  user_id: number;
  title: string;
};

type Feed = {
  id: number;
  title: string;
  unread_count?: number;
  category?: { id: number; title: string };
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null);
  const [selectedFeedId, setSelectedFeedId] = useState<number | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    null
  );
  const [isStarredView, setIsStarredView] = useState(false);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProvisioned, setIsProvisioned] = useState(false);
  const [provisionError, setProvisionError] = useState<string | null>(null);
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [newFeedCategoryId, setNewFeedCategoryId] = useState<number | null>(
    null
  );
  const [addFeedLoading, setAddFeedLoading] = useState(false);
  const [addFeedError, setAddFeedError] = useState<string | null>(null);
  const [newCategoryTitle, setNewCategoryTitle] = useState('');
  const [addCategoryLoading, setAddCategoryLoading] = useState(false);
  const [addCategoryError, setAddCategoryError] = useState<string | null>(null);
  const [fetchingOriginal, setFetchingOriginal] = useState(false);

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

  async function loadCategories() {
    const data = await fetchJson<Category[]>('/api/categories');
    setCategories(data);
  }

  function entriesUrl(nextOffset: number) {
    const qs = new URLSearchParams({
      limit: '50',
      offset: String(nextOffset),
      order: 'published_at',
      direction: 'desc',
    });

    if (isStarredView) {
      // For starred view, fetch starred entries (any status)
      qs.set('starred', 'true');
    } else {
      // For normal view, fetch unread entries
      qs.set('status', 'unread');
    }

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
        loadCategories(),
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

  async function addFeed(e: React.FormEvent) {
    e.preventDefault();

    const trimmedUrl = newFeedUrl.trim();
    if (!trimmedUrl) return;

    setAddFeedLoading(true);
    setAddFeedError(null);

    try {
      const requestBody: { feed_url: string; category_id?: number } = {
        feed_url: trimmedUrl,
      };

      if (newFeedCategoryId) {
        requestBody.category_id = newFeedCategoryId;
      }

      await fetchJson<unknown>('/api/feeds/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      // Success: clear input and refresh feeds
      setNewFeedUrl('');
      setNewFeedCategoryId(null);
      await loadFeeds();
    } catch (e) {
      setAddFeedError(e instanceof Error ? e.message : 'Failed to add feed');
    } finally {
      setAddFeedLoading(false);
    }
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();

    const trimmedTitle = newCategoryTitle.trim();
    if (!trimmedTitle) return;

    setAddCategoryLoading(true);
    setAddCategoryError(null);

    try {
      await fetchJson<unknown>('/api/categories/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmedTitle }),
      });

      // Success: clear input and refresh categories
      setNewCategoryTitle('');
      await loadCategories();
    } catch (e) {
      setAddCategoryError(
        e instanceof Error ? e.message : 'Failed to add category'
      );
    } finally {
      setAddCategoryLoading(false);
    }
  }

  async function fetchOriginalArticle() {
    if (!selectedEntry) return;

    setFetchingOriginal(true);
    setError(null);

    try {
      const result = await fetchJson<{ ok: boolean; content: string }>(
        `/api/entries/${selectedEntry.id}/fetch-content`,
        { method: 'POST' }
      );

      if (result.ok && result.content) {
        // Update the entry in the entries array with the new content
        setEntries((prev) =>
          prev.map((e) =>
            e.id === selectedEntry.id ? { ...e, content: result.content } : e
          )
        );
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Failed to fetch original article'
      );
    } finally {
      setFetchingOriginal(false);
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
    Promise.all([
      loadFeeds(),
      loadCategories(),
      loadEntries({ append: false, nextOffset: 0 }),
    ])
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFeedId, isStarredView, isProvisioned]);

  const selectedIsStarred = Boolean(
    selectedEntry?.starred ?? selectedEntry?.bookmarked
  );

  const canLoadMore = entries.length > 0 && total > entries.length;
  const selectedFeedTitle = isStarredView
    ? 'Starred'
    : selectedFeedId === null
    ? 'All feeds'
    : feedsById.get(selectedFeedId)?.title;

  // Filter feeds by selected category
  const filteredFeeds = useMemo(() => {
    if (selectedCategoryId === null) {
      return feeds;
    }
    return feeds.filter((feed) => feed.category?.id === selectedCategoryId);
  }, [feeds, selectedCategoryId]);

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

              <div className={styles.sectionTitle}>Categories</div>

              {/* Add Category Form */}
              <form onSubmit={addCategory} className={styles.addFeedForm}>
                <input
                  type="text"
                  value={newCategoryTitle}
                  onChange={(e) => setNewCategoryTitle(e.target.value)}
                  placeholder="Category name"
                  disabled={addCategoryLoading || isLoading}
                  className={styles.input}
                />
                <button
                  type="submit"
                  disabled={
                    addCategoryLoading || isLoading || !newCategoryTitle.trim()
                  }
                  className={styles.button}
                >
                  {addCategoryLoading ? 'Adding...' : 'Add category'}
                </button>
                {addCategoryError && (
                  <div className={styles.error}>{addCategoryError}</div>
                )}
              </form>

              <div className={styles.sectionTitle}>Feeds</div>

              {/* Add Feed Form */}
              <form onSubmit={addFeed} className={styles.addFeedForm}>
                <input
                  type="text"
                  value={newFeedUrl}
                  onChange={(e) => setNewFeedUrl(e.target.value)}
                  placeholder="RSS feed URL"
                  disabled={addFeedLoading || isLoading}
                  className={styles.input}
                />
                <select
                  value={newFeedCategoryId ?? ''}
                  onChange={(e) =>
                    setNewFeedCategoryId(
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                  disabled={addFeedLoading || isLoading}
                  className={styles.select}
                >
                  <option value="">Select category (optional)</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.title}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={addFeedLoading || isLoading || !newFeedUrl.trim()}
                  className={styles.button}
                >
                  {addFeedLoading ? 'Adding...' : 'Add feed'}
                </button>
                {addFeedError && (
                  <div className={styles.error}>{addFeedError}</div>
                )}
              </form>

              {/* Category Filter */}
              <div className={styles.categoryFilter}>
                <select
                  value={selectedCategoryId ?? ''}
                  onChange={(e) =>
                    setSelectedCategoryId(
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                  disabled={isLoading}
                  className={styles.select}
                >
                  <option value="">All categories</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.feedList}>
                <button
                  type="button"
                  className={`${styles.feedItem} ${
                    selectedFeedId === null && !isStarredView
                      ? styles.feedItemActive
                      : ''
                  }`}
                  onClick={() => {
                    setSelectedFeedId(null);
                    setIsStarredView(false);
                  }}
                  disabled={isLoading}
                >
                  <span className={styles.feedTitle}>All feeds</span>
                </button>

                <button
                  type="button"
                  className={`${styles.feedItem} ${
                    isStarredView ? styles.feedItemActive : ''
                  }`}
                  onClick={() => {
                    setSelectedFeedId(null);
                    setIsStarredView(true);
                  }}
                  disabled={isLoading}
                >
                  <span className={styles.feedTitle}>⭐ Starred</span>
                </button>

                {filteredFeeds.length === 0 ? (
                  <div className={styles.muted}>
                    {selectedCategoryId
                      ? 'No feeds in this category.'
                      : 'No feeds yet.'}
                  </div>
                ) : (
                  filteredFeeds.map((f) => (
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
                {!isStarredView && (
                  <button
                    className={styles.button}
                    onClick={() => void markPageRead()}
                    disabled={isLoading || entries.length === 0}
                  >
                    Mark page read
                  </button>
                )}
                <div className={styles.spacer} />
                <div className={styles.meta}>
                  {isLoading
                    ? 'Loading…'
                    : `${entries.length}${total ? ` / ${total}` : ''} ${
                        isStarredView ? 'starred' : 'unread'
                      }${selectedFeedTitle ? ` — ${selectedFeedTitle}` : ''}`}
                </div>
              </div>

              {error ? <div className={styles.error}>{error}</div> : null}

              <div className={styles.entryList}>
                {entries.length === 0 ? (
                  <div className={styles.muted}>
                    {isStarredView
                      ? 'No starred entries.'
                      : 'No unread entries.'}
                  </div>
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
                        onClick={() => void fetchOriginalArticle()}
                        disabled={isLoading || fetchingOriginal}
                        type="button"
                      >
                        {fetchingOriginal
                          ? 'Fetching...'
                          : 'Fetch original article'}
                      </button>
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
