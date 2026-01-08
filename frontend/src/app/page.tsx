'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/nextjs';
import styles from './page.module.sass';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { EntryItem } from '@/components/EntryItem/EntryItem';
import { Button } from '@/components/Button/Button';
import { FormattedDate } from '@/components/FormattedDate';

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
  author?: string;
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
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState(false);
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
  const [fetchedEntryIds, setFetchedEntryIds] = useState<Set<number>>(
    new Set()
  );
  const [categoryCounts, setCategoryCounts] = useState<Map<number, number>>(
    new Map()
  );

  const feedsById = useMemo(() => {
    const map = new Map<number, Feed>();
    for (const feed of feeds) map.set(feed.id, feed);
    return map;
  }, [feeds]);

  const selectedEntry = useMemo(() => {
    return entries.find((e) => e.id === selectedEntryId) ?? null;
  }, [entries, selectedEntryId]);

  const { selectedIndex, hasPrev, hasNext } = useMemo(() => {
    const index = entries.findIndex((e) => e.id === selectedEntryId);
    return {
      selectedIndex: index,
      hasPrev: index > 0,
      hasNext: index >= 0 && index < entries.length - 1,
    };
  }, [entries, selectedEntryId]);

  // Calculate unread count per category
  // First try from stored categoryCounts (from entries API), fallback to summing feed unread_count
  const categoryUnreadCounts = useMemo(() => {
    const counts = new Map<number, number>(categoryCounts);

    // Fill in any missing counts by summing feed unread_count
    for (const feed of feeds) {
      const categoryId = feed.category?.id;
      const unreadCount = feed.unread_count;

      if (categoryId && typeof unreadCount === 'number') {
        // Only use feed count if we don't already have a stored count for this category
        if (!counts.has(categoryId)) {
          const current = counts.get(categoryId) ?? 0;
          counts.set(categoryId, current + unreadCount);
        }
      }
    }
    return counts;
  }, [feeds, categoryCounts]);

  async function loadFeeds() {
    const data = await fetchJson<Feed[]>('/api/feeds');
    setFeeds(data);
  }

  async function loadCategories() {
    const data = await fetchJson<Category[]>('/api/categories');
    setCategories(data);

    // Fetch unread counts for all categories
    const counts = new Map<number, number>();
    await Promise.all(
      data.map(async (cat) => {
        try {
          const entriesData = await fetchJson<EntriesResponse>(
            `/api/entries?status=unread&category_id=${cat.id}&limit=1&offset=0`
          );
          counts.set(cat.id, entriesData.total ?? 0);
        } catch (e) {
          // Ignore errors, count will remain 0
          console.error(`Failed to load count for category ${cat.id}:`, e);
        }
      })
    );
    setCategoryCounts(counts);
  }

  function entriesUrl(nextOffset: number) {
    const qs = new URLSearchParams({
      limit: '50',
      offset: String(nextOffset),
      order: 'published_at',
      direction: 'desc',
    });

    if (searchMode && searchQuery.trim()) {
      // For search mode, search all entries
      qs.set('search', searchQuery.trim());
    } else if (isStarredView) {
      // For starred view, fetch starred entries (any status)
      qs.set('starred', 'true');
    } else {
      // For normal view, fetch unread entries
      qs.set('status', 'unread');
    }

    if (selectedFeedId && !searchMode)
      qs.set('feed_id', String(selectedFeedId));

    if (selectedCategoryId !== null && !searchMode)
      qs.set('category_id', String(selectedCategoryId));

    return `/api/entries?${qs.toString()}`;
  }

  async function loadEntries(opts?: { append?: boolean; nextOffset?: number }) {
    const append = Boolean(opts?.append);
    const nextOffset = opts?.nextOffset ?? 0;

    const data = await fetchJson<EntriesResponse>(entriesUrl(nextOffset));
    setTotal(data.total ?? 0);
    setOffset(nextOffset);

    // Store category count when loading entries for a specific category
    if (
      selectedCategoryId !== null &&
      !searchMode &&
      !isStarredView &&
      nextOffset === 0
    ) {
      setCategoryCounts((prev) => {
        const updated = new Map(prev);
        updated.set(selectedCategoryId, data.total ?? 0);
        return updated;
      });
    }

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

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();

    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) return;

    setSearchMode(true);
    setIsStarredView(false);
    setSelectedFeedId(null);

    setIsLoading(true);
    setError(null);
    try {
      await loadEntries({ append: false, nextOffset: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to search');
    } finally {
      setIsLoading(false);
    }
  }

  function clearSearch() {
    setSearchQuery('');
    setSearchMode(false);
  }

  const fetchOriginalArticle = useCallback(async () => {
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
        // Mark this entry as fetched
        setFetchedEntryIds((prev) => new Set(prev).add(selectedEntry.id));
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Failed to fetch original article'
      );
      // Mark as fetched even on error to avoid retry loops
      setFetchedEntryIds((prev) => new Set(prev).add(selectedEntry.id));
    } finally {
      setFetchingOriginal(false);
    }
  }, [selectedEntry]);

  const navigateToPrev = useCallback(() => {
    if (hasPrev && selectedIndex > 0) {
      setSelectedEntryId(entries[selectedIndex - 1].id);
    }
  }, [hasPrev, selectedIndex, entries]);

  const navigateToNext = useCallback(() => {
    if (hasNext && selectedIndex < entries.length - 1) {
      setSelectedEntryId(entries[selectedIndex + 1].id);
    }
  }, [hasNext, selectedIndex, entries]);

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
  }, [
    selectedFeedId,
    selectedCategoryId,
    isStarredView,
    searchMode,
    isProvisioned,
  ]);

  // Keyboard shortcuts for navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger shortcuts if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // j or ArrowDown = next entry
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (hasNext) navigateToNext();
      }
      // k or ArrowUp = previous entry
      else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (hasPrev) navigateToPrev();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasPrev, hasNext, navigateToNext, navigateToPrev]);

  // Console log entries data
  useEffect(() => {
    console.log('Entries data:', entries);
    console.log(`Total entries loaded: ${entries.length}`);
  }, [entries]);

  // Auto-fetch original article when entry is selected
  useEffect(() => {
    if (!selectedEntry || fetchingOriginal || !isProvisioned) return;

    // Skip if we've already attempted to fetch this entry
    if (fetchedEntryIds.has(selectedEntry.id)) return;

    // Check if content is missing or minimal (likely just a summary)
    const hasMinimalContent =
      !selectedEntry.content ||
      selectedEntry.content.length < 200 ||
      (selectedEntry.summary &&
        selectedEntry.content === selectedEntry.summary);

    if (hasMinimalContent) {
      // Automatically fetch the original article
      void fetchOriginalArticle();
    }
  }, [
    selectedEntry,
    fetchingOriginal,
    fetchedEntryIds,
    isProvisioned,
    fetchOriginalArticle,
  ]);

  const selectedIsStarred = Boolean(
    selectedEntry?.starred ?? selectedEntry?.bookmarked
  );

  const canLoadMore = entries.length > 0 && total > entries.length;
  const selectedFeedTitle = searchMode
    ? `Search: ${searchQuery}`
    : isStarredView
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

              {/* FEEDLIST */}
              {/* <div className={styles.feedList}>
                <button
                  type="button"
                  className={`${styles.feedItem} ${
                    selectedFeedId === null && !isStarredView && !searchMode
                      ? styles.feedItemActive
                      : ''
                  }`}
                  onClick={() => {
                    setSelectedFeedId(null);
                    setIsStarredView(false);
                    setSearchMode(false);
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
                    setSearchMode(false);
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
                        selectedFeedId === f.id && !searchMode
                          ? styles.feedItemActive
                          : ''
                      }`}
                      onClick={() => {
                        setSelectedFeedId(f.id);
                        setSearchMode(false);
                      }}
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
              </div> */}

              {/* Search Section */}
              {/* <div
                className={styles.sectionTitle}
                style={{ marginTop: '2rem' }}
              >
                Search
              </div>
              <form onSubmit={handleSearch} className={styles.addFeedForm}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search entries..."
                  disabled={isLoading}
                  className={styles.input}
                />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="submit"
                    disabled={isLoading || !searchQuery.trim()}
                    className={styles.button}
                  >
                    Search
                  </button>
                  {searchMode && (
                    <button
                      type="button"
                      onClick={clearSearch}
                      disabled={isLoading}
                      className={styles.button}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </form> */}
            </aside>

            {/* LISTPANE */}
            <section className={styles.listPane}>
              <div className={styles.topBar}>
                {/* Category List */}
                <ul className={styles.categoryList}>
                  {/* <li>
                    <Button
                      type="button"
                      variant="category"
                      active={selectedCategoryId === null}
                      className={`${styles.categoryItem} ${
                        selectedCategoryId === null
                          ? styles.categoryItemActive
                          : ''
                      }`}
                      onClick={() => {
                        setSelectedCategoryId(null);
                        setSelectedFeedId(null);
                      }}
                      disabled={isLoading}
                    >
                      All
                    </Button>
                  </li> */}
                  {categories.map((cat) => (
                    <li key={cat.id}>
                      <Button
                        type="button"
                        variant="category"
                        active={selectedCategoryId === cat.id}
                        className={`${styles.categoryList_Item} ${
                          selectedCategoryId === cat.id
                            ? styles.categoryItemActive
                            : ''
                        }`}
                        onClick={() => {
                          setSelectedCategoryId(cat.id);
                          setSelectedFeedId(null);
                        }}
                        disabled={isLoading}
                      >
                        {cat.title}
                      </Button>
                      <div className={styles.categoryList_Item_Count}>
                        {categoryUnreadCounts.get(cat.id) ?? 0}
                      </div>
                    </li>
                  ))}
                </ul>
                {/* <button
                  className={styles.button}
                  onClick={() => void refreshAll()}
                  disabled={isLoading}
                >
                  Refresh
                </button> */}
                {/* {!isStarredView && !searchMode && (
                  <button
                    className={styles.button}
                    onClick={() => void markPageRead()}
                    disabled={isLoading || entries.length === 0}
                  >
                    Mark page read
                  </button>
                )} */}
                {/* <div className={styles.meta}>
                  {isLoading
                    ? 'Loading…'
                    : `${entries.length}${total ? ` / ${total}` : ''} ${
                        searchMode
                          ? 'results'
                          : isStarredView
                          ? 'starred'
                          : 'unread'
                      }${selectedFeedTitle ? ` — ${selectedFeedTitle}` : ''}`}
                </div> */}
              </div>

              {error ? <div className={styles.error}>{error}</div> : null}

              <div className={styles.entryList}>
                <>
                  {entries.length === 0 ? (
                    <div className={styles.muted}>
                      {searchMode
                        ? 'No results found.'
                        : isStarredView
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
                        <EntryItem
                          key={e.id}
                          title={e.title}
                          author={e.author}
                          feedTitle={feedTitle}
                          publishedAt={published}
                          active={isActive}
                          content={e.content}
                          url={e.url}
                          onClick={() => setSelectedEntryId(e.id)}
                        />
                      );
                    })
                  )}
                  <div className={styles.listFooter}>
                    {canLoadMore && (
                      <Button
                        variant="primary"
                        onClick={() => void loadMore()}
                        disabled={isLoading}
                      >
                        Load more
                      </Button>
                    )}
                  </div>
                </>
              </div>
            </section>

            {/* DETAILPANE */}
            <section className={styles.detailPane}>
              {!selectedEntry ? (
                <div className={styles.muted}>Select an entry to read.</div>
              ) : (
                <>
                  <div className={styles.detailPane_Header}>
                    <h1>{selectedEntry.title || '(untitled)'}</h1>
                    <div className={styles.detailPane_Meta}>
                      {(selectedEntry.feed_title ??
                        selectedEntry.feed?.title ??
                        feedsById.get(selectedEntry.feed_id)?.title) ||
                      selectedEntry.published_at ||
                      selectedEntry.author ? (
                        <>
                          <p>
                            From:{' '}
                            <i>
                              {selectedEntry.author &&
                                `By: ${selectedEntry.author}, `}
                              {selectedEntry.feed_title ??
                                selectedEntry.feed?.title ??
                                feedsById.get(selectedEntry.feed_id)?.title ??
                                ''}
                            </i>
                          </p>
                          {selectedEntry.published_at && (
                            <p>
                              <FormattedDate
                                date={selectedEntry.published_at}
                              />
                            </p>
                          )}
                        </>
                      ) : null}
                    </div>
                  </div>

                  {selectedEntry.content ? (
                    <div
                      className={styles.detailPane_content}
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
                      <div>
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
                  <div className={styles.detailFooter}>
                    <div className={styles.actionsRow}>
                      <Button
                        variant="primary"
                        onClick={() => void toggleSelectedStar()}
                        disabled={isLoading}
                        title={selectedIsStarred ? 'Unbookmark' : 'Bookmark'}
                      >
                        {selectedIsStarred ? 'Unbookmark' : 'Bookmark'}
                      </Button>
                      {', '}
                      <Button
                        onClick={() => void fetchOriginalArticle()}
                        disabled={isLoading || fetchingOriginal}
                        title="Link to original article"
                      >
                        Link to original article
                      </Button>
                      {', '}
                      <Button
                        className={styles.button}
                        onClick={() => void fetchOriginalArticle()}
                        disabled={isLoading || fetchingOriginal}
                        title={
                          fetchingOriginal
                            ? 'Fetching...'
                            : 'Fetch original article'
                        }
                      >
                        {fetchingOriginal
                          ? 'Fetching...'
                          : 'Fetch original article'}
                      </Button>
                      {', '}
                      {selectedEntry.status === 'unread' ? (
                        <Button
                          className={styles.button}
                          onClick={() => void setSelectedStatus('read')}
                          disabled={isLoading}
                          type="button"
                        >
                          Mark read
                        </Button>
                      ) : (
                        <Button
                          className={styles.button}
                          onClick={() => void setSelectedStatus('unread')}
                          disabled={isLoading}
                          type="button"
                        >
                          Mark unread
                        </Button>
                      )}
                      {', '}
                      <Button
                        className={styles.button}
                        onClick={() => void setSelectedStatus('unread')}
                        disabled={isLoading}
                        type="button"
                      >
                        Mark unread
                      </Button>
                    </div>
                    <div className={styles.prevNextButtons}>
                      <Button
                        className={styles.button}
                        onClick={navigateToPrev}
                        disabled={!hasPrev || isLoading}
                        type="button"
                        title="Previous entry"
                      >
                        ← Prev
                      </Button>
                      <Button
                        className={styles.button}
                        onClick={navigateToNext}
                        disabled={!hasNext || isLoading}
                        type="button"
                        title="Next entry"
                      >
                        Next →
                      </Button>
                    </div>
                  </div>
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
