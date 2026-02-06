'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/nextjs';
import styles from './page.module.sass';
import { AddModal } from '@/components/AddModal/AddModal';
import { EditModal } from '@/components/EditModal/EditModal';
import { EntryList } from '@/components/EntryList/EntryList';
import { EntryPanel } from '@/components/EntryPanel/EntryPanel';
import { HeaderCategories } from '@/components/HeaderCategories/HeaderCategories';
import { MenuModal } from '@/components/MenuModal/MenuModal';
import { useKeydown } from '@/hooks/useKeydown';
import { fetchJson } from '@/app/_lib/fetchJson';
import type {
  Category,
  Entry,
  EntriesResponse,
  Feed,
  FeedCountersResponse,
} from '@/app/_lib/types';

type PullState = 'idle' | 'pulling' | 'fetching' | 'done';

const PULL_TRIGGER_PX = 70;
const PULL_MAX_PX = 90;
const DONE_HOLD_MS = 700;
const FETCH_INDICATOR_HEIGHT = 32;
const SWIPE_THRESHOLD_PX = 60;
const SWIPE_MAX_VERTICAL_PX = 50;

const getBrowserWindow = (): any => {
  if (typeof globalThis === 'undefined') return null;
  return (globalThis as any).window ?? null;
};

const getBrowserDocument = (): any => {
  if (typeof globalThis === 'undefined') return null;
  return (globalThis as any).document ?? null;
};

const getBrowserNavigator = (): any => {
  if (typeof globalThis === 'undefined') return null;
  return (globalThis as any).navigator ?? null;
};

function getScrollTop(): number {
  const win = getBrowserWindow();
  const doc = getBrowserDocument();
  if (!win || !doc) return 0;

  // Some TS build setups end up missing DOM lib typings (Document/Window become empty interfaces).
  // We access these fields defensively to keep runtime behavior and keep typecheck happy.
  const winScrollY = (win as any).scrollY as unknown;
  const docElScrollTop = (doc as any).documentElement?.scrollTop as unknown;
  const docBodyScrollTop = (doc as any).body?.scrollTop as unknown;
  return (
    (typeof winScrollY === 'number' ? winScrollY : 0) ||
    (typeof docElScrollTop === 'number' ? docElScrollTop : 0) ||
    (typeof docBodyScrollTop === 'number' ? docBodyScrollTop : 0) ||
    0
  );
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
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isTogglingStar, setIsTogglingStar] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
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
  const [starredEntries, setStarredEntries] = useState<Entry[]>([]);
  const [fetchedEntryIds, setFetchedEntryIds] = useState<Set<number>>(
    new Set()
  );
  const [categoryCounts, setCategoryCounts] = useState<Map<number, number>>(
    new Map()
  );
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [returnToMenuAfterSubModal, setReturnToMenuAfterSubModal] =
    useState(false);
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const [totalStarredCount, setTotalStarredCount] = useState(0);
  const [isOffline, setIsOffline] = useState(false);
  const [isRefreshingFeeds, setIsRefreshingFeeds] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);
  const [pullState, setPullState] = useState<PullState>('idle');
  const [pullDistance, setPullDistance] = useState(0);
  const appRef = useRef<HTMLDivElement | null>(null);
  const pullDistanceRef = useRef(0);
  const startYRef = useRef<number | null>(null);
  const startXRef = useRef<number | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const isRefreshingRef = useRef(false);
  const doneTimeoutRef = useRef<number | null>(null);

  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editType, setEditType] = useState<'feed' | 'category' | null>(null);
  const [editItemId, setEditItemId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editFeedUrl, setEditFeedUrl] = useState('');
  const [editCategoryId, setEditCategoryId] = useState<number | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const openMenuModal = useCallback(() => {
    setIsMenuModalOpen(true);
    setIsAddModalOpen(false);
    setIsEditModalOpen(false);
    setReturnToMenuAfterSubModal(false);
  }, []);

  const closeMenuModal = useCallback(() => {
    setIsMenuModalOpen(false);
    setReturnToMenuAfterSubModal(false);
  }, []);

  const openAddModal = useCallback(() => {
    setIsAddModalOpen(true);
    setIsMenuModalOpen(false);
    setReturnToMenuAfterSubModal(true);
  }, []);

  const closeAddModal = useCallback(() => {
    setIsAddModalOpen(false);
    if (returnToMenuAfterSubModal) {
      setIsMenuModalOpen(true);
    }
  }, [returnToMenuAfterSubModal]);

  useEffect(() => {
    const win = getBrowserWindow();
    const nav = getBrowserNavigator();
    if (!win || !nav) return;
    const updateOnlineStatus = () => setIsOffline(!nav.onLine);
    updateOnlineStatus();
    win.addEventListener('online', updateOnlineStatus);
    win.addEventListener('offline', updateOnlineStatus);
    return () => {
      win.removeEventListener('online', updateOnlineStatus);
      win.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  useEffect(() => {
    const win = getBrowserWindow();
    return () => {
      if (doneTimeoutRef.current && win) {
        win.clearTimeout(doneTimeoutRef.current);
      }
    };
  }, []);

  const openEditModal = useCallback(
    (type: 'feed' | 'category', item: Feed | Category) => {
      setEditType(type);
      setEditItemId(item.id);
      setEditTitle(item.title);
      if (type === 'feed') {
        const feed = item as Feed;
        setEditFeedUrl(feed.feed_url || '');
        setEditCategoryId(feed.category?.id || null);
      }
      setIsEditModalOpen(true);
      setIsMenuModalOpen(false);
      setReturnToMenuAfterSubModal(true);
      setEditError(null);
    },
    []
  );

  const closeEditModal = useCallback(() => {
    setIsEditModalOpen(false);
    if (returnToMenuAfterSubModal) {
      setIsMenuModalOpen(true);
    }
    setEditType(null);
    setEditItemId(null);
    setEditTitle('');
    setEditFeedUrl('');
    setEditCategoryId(null);
    setEditError(null);
  }, [returnToMenuAfterSubModal]);

  const feedsById = useMemo(() => {
    const map = new Map<number, Feed>();
    for (const feed of feeds) map.set(feed.id, feed);
    return map;
  }, [feeds]);

  const selectedEntry = useMemo(() => {
    return entries.find((e) => e.id === selectedEntryId) ?? null;
  }, [entries, selectedEntryId]);

  const hasFetchedOriginal = useMemo(() => {
    if (!selectedEntry) return false;
    return fetchedEntryIds.has(selectedEntry.id);
  }, [selectedEntry, fetchedEntryIds]);

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

  const loadUnreadCounters = useCallback(async () => {
    try {
      const counters = await fetchJson<FeedCountersResponse>(
        '/api/feeds/counters'
      );
      const totalUnread = Object.values(counters.unreads ?? {}).reduce(
        (sum, value) => sum + value,
        0
      );
      setTotalUnreadCount(totalUnread);
    } catch (err) {
      console.error('Failed to load unread counters', err);
    }
  }, []);

  const loadStarredCount = useCallback(async () => {
    try {
      const data = await fetchJson<EntriesResponse>(
        '/api/entries?starred=true&limit=1&offset=0'
      );
      setTotalStarredCount(data.total ?? 0);
    } catch (err) {
      console.error('Failed to load starred count', err);
    }
  }, []);

  useEffect(() => {
    if (!isProvisioned) return;
    void loadUnreadCounters();
    void loadStarredCount();
  }, [isProvisioned, entries, loadUnreadCounters, loadStarredCount]);

  // Load starred entries for the menu
  const loadStarredEntries = useCallback(async () => {
    if (!isProvisioned) return;
    try {
      const data = await fetchJson<EntriesResponse>(
        '/api/entries?starred=true&limit=50&offset=0'
      );
      setStarredEntries(data.entries);
    } catch (err) {
      console.error('Failed to load starred entries', err);
    }
  }, [isProvisioned]);

  useEffect(() => {
    void loadStarredEntries();
  }, [loadStarredEntries]);

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
    // Only keep selection if the previously selected entry still exists
    // Don't auto-select the first entry on initial load
    setSelectedEntryId((prev) => {
      if (prev && data.entries.some((e) => e.id === prev)) return prev;
      return null;
    });
  }

  async function refreshAll() {
    if (!isProvisioned || isLoading) return;
    setIsLoading(true);
    setIsRefreshingFeeds(true);
    setError(null);
    try {
      await Promise.all([
        loadFeeds(),
        loadCategories(),
        loadEntries({ append: false, nextOffset: 0 }),
      ]);
      setLastRefreshedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setIsRefreshingFeeds(false);
      setIsLoading(false);
    }
  }

  const indicatorHeight =
    pullState === 'pulling'
      ? Math.min(pullDistance, PULL_MAX_PX)
      : pullState === 'fetching' || pullState === 'done'
      ? FETCH_INDICATOR_HEIGHT
      : 0;

  const pullOffset =
    pullState === 'pulling'
      ? Math.min(pullDistance, PULL_MAX_PX)
      : pullState === 'fetching' || pullState === 'done'
      ? FETCH_INDICATOR_HEIGHT
      : 0;

  const indicatorLabel =
    pullState === 'pulling'
      ? 'pulling'
      : pullState === 'fetching'
      ? 'fetching'
      : pullState === 'done'
      ? 'done'
      : '';

  const lastRefreshedLabel = useMemo(() => {
    if (!lastRefreshedAt) return null;
    return new Date(lastRefreshedAt).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  }, [lastRefreshedAt]);

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
    if (isTogglingStar) return;
    setIsTogglingStar(true);
    setError(null);
    try {
      await fetchJson<{ ok: true }>(`/api/entries/${selectedEntry.id}/star`, {
        method: 'POST',
      });
      // Refresh list + selection state
      await Promise.all([
        loadFeeds(),
        loadEntries({ append: false, nextOffset: offset }),
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to toggle star');
    } finally {
      setIsTogglingStar(false);
    }
  }

  const toggleEntryStar = useCallback(
    async (entryId: number) => {
      try {
        await fetchJson<{ ok: true }>(`/api/entries/${entryId}/star`, {
          method: 'POST',
        });
        // Reload starred entries after toggling
        await loadStarredEntries();
        await loadStarredCount();
      } catch (e) {
        console.error('Failed to toggle entry star', e);
      }
    },
    [loadStarredEntries, loadStarredCount]
  );

  async function setSelectedStatus(status: 'read' | 'unread') {
    if (!selectedEntry) return;
    if (isUpdatingStatus) return;
    setIsUpdatingStatus(true);
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
      setIsUpdatingStatus(false);
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

  async function addFeed(e: React.FormEvent): Promise<boolean> {
    e.preventDefault();

    const trimmedUrl = newFeedUrl.trim();
    if (!trimmedUrl) return false;

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
      return true;
    } catch (e) {
      setAddFeedError(e instanceof Error ? e.message : 'Failed to add feed');
      return false;
    } finally {
      setAddFeedLoading(false);
    }
  }

  async function addCategory(e: React.FormEvent): Promise<boolean> {
    e.preventDefault();

    const trimmedTitle = newCategoryTitle.trim();
    if (!trimmedTitle) return false;

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
      return true;
    } catch (e) {
      setAddCategoryError(
        e instanceof Error ? e.message : 'Failed to add category'
      );
      return false;
    } finally {
      setAddCategoryLoading(false);
    }
  }

  async function deleteCategory(categoryId: number) {
    if (!confirm('Are you sure you want to delete this category?')) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await fetchJson<{ ok: boolean }>(`/api/categories/${categoryId}`, {
        method: 'DELETE',
      });

      // Success: refresh categories and feeds
      await Promise.all([loadCategories(), loadFeeds()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete category');
    } finally {
      setIsLoading(false);
    }
  }

  async function deleteFeed(feedId: number) {
    if (!confirm('Are you sure you want to delete this feed?')) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await fetchJson<{ ok: boolean }>(`/api/feeds/${feedId}`, {
        method: 'DELETE',
      });

      // Success: refresh feeds
      await loadFeeds();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete feed');
    } finally {
      setIsLoading(false);
    }
  }

  async function updateCategory(e: React.FormEvent): Promise<boolean> {
    e.preventDefault();

    if (!editItemId) return false;

    const trimmedTitle = editTitle.trim();
    if (!trimmedTitle) return false;

    setEditLoading(true);
    setEditError(null);

    try {
      await fetchJson<{ ok: boolean }>(`/api/categories/${editItemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmedTitle }),
      });

      // Success: refresh categories
      await loadCategories();
      return true;
    } catch (e) {
      setEditError(
        e instanceof Error ? e.message : 'Failed to update category'
      );
      return false;
    } finally {
      setEditLoading(false);
    }
  }

  async function updateFeed(e: React.FormEvent): Promise<boolean> {
    e.preventDefault();

    if (!editItemId) return false;

    const trimmedTitle = editTitle.trim();
    const trimmedUrl = editFeedUrl.trim();

    if (!trimmedTitle || !trimmedUrl) return false;

    setEditLoading(true);
    setEditError(null);

    try {
      await fetchJson<{ ok: boolean }>(`/api/feeds/${editItemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: trimmedTitle,
          feed_url: trimmedUrl,
          category_id: editCategoryId,
        }),
      });

      // Success: refresh feeds
      await loadFeeds();
      return true;
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Failed to update feed');
      return false;
    } finally {
      setEditLoading(false);
    }
  }

  const toggleSearch = useCallback(() => {
    setIsSearchOpen((prev) => {
      const next = !prev;
      if (!next) {
        setSearchQuery('');
        setSearchMode(false);
      }
      return next;
    });
  }, []);

  const toggleCategories = useCallback(() => {
    setIsCategoriesOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!isProvisioned || !isSearchOpen) return;

    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) {
      if (searchMode) {
        setSearchMode(false);
      }
      return;
    }

    if (!searchMode) {
      setSearchMode(true);
      setIsStarredView(false);
      setSelectedFeedId(null);
      setSelectedCategoryId(null);
      return;
    }

    const win = getBrowserWindow();
    if (!win) return;
    const timeoutId = win.setTimeout(() => {
      setIsLoading(true);
      setError(null);
      loadEntries({ append: false, nextOffset: 0 })
        .catch((e) =>
          setError(e instanceof Error ? e.message : 'Failed to search')
        )
        .finally(() => setIsLoading(false));
    }, 250);

    return () => {
      win.clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, isSearchOpen, isProvisioned, searchMode]);

  const fetchOriginalArticle = useCallback(
    async (entryId?: number) => {
      const targetEntry = entryId
        ? entries.find((e) => e.id === entryId)
        : selectedEntry;

      if (!targetEntry || !isProvisioned) return;

      // Skip if we've already attempted to fetch this entry
      if (fetchedEntryIds.has(targetEntry.id)) return;

      setFetchingOriginal(true);
      setError(null);

      try {
        const result = await fetchJson<{ ok: boolean; content: string }>(
          `/api/entries/${targetEntry.id}/fetch-content`,
          { method: 'POST' }
        );

        if (result.ok && result.content) {
          // Update the entry in the entries array with the new content
          setEntries((prev) =>
            prev.map((e) =>
              e.id === targetEntry.id ? { ...e, content: result.content } : e
            )
          );
          // Mark this entry as fetched
          setFetchedEntryIds((prev) => new Set(prev).add(targetEntry.id));
        }
      } catch (e) {
        setError(
          e instanceof Error ? e.message : 'Failed to fetch source link'
        );
        // Mark as fetched even on error to avoid retry loops
        setFetchedEntryIds((prev) => new Set(prev).add(targetEntry.id));
      } finally {
        setFetchingOriginal(false);
      }
    },
    [selectedEntry, entries, isProvisioned, fetchedEntryIds]
  );

  const handleEntrySelect = useCallback(
    (entryId: number) => {
      setSelectedEntryId(entryId);

      // Immediately check if we should fetch original content
      const entry = entries.find((e) => e.id === entryId);
      if (!entry) return;

      // Always attempt to fetch if not already fetched, regardless of content length
      // This ensures we get the full article content when available
      if (!fetchedEntryIds.has(entryId) && isProvisioned) {
        // Trigger fetch with the entry ID immediately
        void fetchOriginalArticle(entryId);
      }
    },
    [entries, fetchedEntryIds, isProvisioned, fetchOriginalArticle]
  );

  const navigateToPrev = useCallback(() => {
    if (hasPrev && selectedIndex > 0) {
      handleEntrySelect(entries[selectedIndex - 1].id);
    }
  }, [hasPrev, selectedIndex, entries, handleEntrySelect]);

  const navigateToNext = useCallback(() => {
    if (hasNext && selectedIndex < entries.length - 1) {
      handleEntrySelect(entries[selectedIndex + 1].id);
    }
  }, [hasNext, selectedIndex, entries, handleEntrySelect]);

  const resetPullState = () => {
    setPullState('idle');
    setPullDistance(0);
    pullDistanceRef.current = 0;
    startYRef.current = null;
    startXRef.current = null;
  };

  const canSwipe =
    selectedEntryId !== null &&
    !isMenuModalOpen &&
    !isAddModalOpen &&
    !isEditModalOpen;

  const handleTouchStart = useCallback(
    (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      swipeStartRef.current = canSwipe
        ? { x: touch.clientX, y: touch.clientY }
        : null;

      if (!isProvisioned || isLoading) return;
      if (isRefreshingRef.current) return;
      if (getScrollTop() > 0) return;
      if (doneTimeoutRef.current) {
        const win = getBrowserWindow();
        if (win) {
          win.clearTimeout(doneTimeoutRef.current);
        }
        doneTimeoutRef.current = null;
      }
      startXRef.current = touch.clientX;
      startYRef.current = touch.clientY;
    },
    [canSwipe, isProvisioned, isLoading]
  );

  const handleTouchMove = useCallback(
    (event: TouchEvent) => {
      if (!isProvisioned || isLoading) return;
      if (isRefreshingRef.current) return;
      const startY = startYRef.current;
      const startX = startXRef.current;
      if (startY === null || startX === null) return;
      if (getScrollTop() > 0) {
        resetPullState();
        return;
      }
      const touch = event.touches[0];
      const currentY = touch.clientY;
      const currentX = touch.clientX;
      const deltaY = currentY - startY;
      const deltaX = currentX - startX;
      if (deltaY <= 0) {
        resetPullState();
        return;
      }
      if (Math.abs(deltaY) < Math.abs(deltaX)) {
        resetPullState();
        return;
      }

      event.preventDefault();
      swipeStartRef.current = null;
      pullDistanceRef.current = deltaY;
      setPullDistance(deltaY);
      if (pullState !== 'pulling') setPullState('pulling');
    },
    [isProvisioned, isLoading, pullState]
  );

  const handleTouchEnd = useCallback(
    async (event?: TouchEvent) => {
      const pullStart = startYRef.current;
      const pullDistanceValue = pullDistanceRef.current;
      const swipeStart = swipeStartRef.current;
      startYRef.current = null;
      startXRef.current = null;
      swipeStartRef.current = null;

      if (pullStart !== null) {
        if (pullDistanceValue >= PULL_TRIGGER_PX && !isRefreshingRef.current) {
          isRefreshingRef.current = true;
          setPullState('fetching');
          setPullDistance(0);
          pullDistanceRef.current = 0;
          try {
            await refreshAll();
          } finally {
            setPullState('done');
            const win = getBrowserWindow();
            if (win) {
              doneTimeoutRef.current = win.setTimeout(() => {
                setPullState('idle');
                doneTimeoutRef.current = null;
              }, DONE_HOLD_MS);
            } else {
              doneTimeoutRef.current = null;
            }
            isRefreshingRef.current = false;
          }
          return;
        }

        resetPullState();
      }

      if (!canSwipe) return;
      if (!swipeStart) return;
      const touch = event?.changedTouches?.[0];
      if (!touch) return;

      const deltaX = touch.clientX - swipeStart.x;
      const deltaY = touch.clientY - swipeStart.y;
      if (
        Math.abs(deltaX) < SWIPE_THRESHOLD_PX ||
        Math.abs(deltaY) > SWIPE_MAX_VERTICAL_PX
      ) {
        return;
      }

      if (deltaX < 0 && hasNext) {
        navigateToNext();
      } else if (deltaX > 0 && hasPrev) {
        navigateToPrev();
      }
    },
    [canSwipe, hasNext, hasPrev, navigateToNext, navigateToPrev, refreshAll]
  );

  useEffect(() => {
    const node = appRef.current;
    if (!node) return;

    const onTouchStart = (event: TouchEvent) => handleTouchStart(event);
    const onTouchMove = (event: TouchEvent) => handleTouchMove(event);
    const onTouchEnd = (event: TouchEvent) => {
      void handleTouchEnd(event);
    };

    node.addEventListener('touchstart', onTouchStart, { passive: true });
    node.addEventListener('touchmove', onTouchMove, { passive: false });
    node.addEventListener('touchend', onTouchEnd);
    node.addEventListener('touchcancel', onTouchEnd);

    return () => {
      node.removeEventListener('touchstart', onTouchStart);
      node.removeEventListener('touchmove', onTouchMove);
      node.removeEventListener('touchend', onTouchEnd);
      node.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

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

  const isEditableTarget = useCallback((target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    const tagName = target.tagName;
    if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
      return true;
    }
    if (target.getAttribute('role') === 'textbox') return true;
    return false;
  }, []);

  // Keyboard shortcuts for navigation
  useKeydown(
    (e) => {
      // Don't trigger shortcuts if user is typing in an input
      if (
        isEditableTarget(e.target) ||
        isEditableTarget(document.activeElement)
      ) {
        return;
      }

      // r or R = refresh all feeds
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        void refreshAll();
        return;
      }

      // ArrowDown = next entry
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (hasNext) navigateToNext();
      }
      // ArrowUp = previous entry
      else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (hasPrev) navigateToPrev();
      }
      // ArrowRight = next entry (when entry is open)
      else if (e.key === 'ArrowRight') {
        if (!selectedEntry) return;
        e.preventDefault();
        if (hasNext) navigateToNext();
      }
      // ArrowLeft = previous entry (when entry is open)
      else if (e.key === 'ArrowLeft') {
        if (!selectedEntry) return;
        e.preventDefault();
        if (hasPrev) navigateToPrev();
      }
    },
    { target: getBrowserWindow() }
  );

  // Console log entries data
  useEffect(() => {
    console.log('Entries data:', entries);
    console.log(`Total entries loaded: ${entries.length}`);
  }, [entries]);

  // Auto-fetch original article when entry is selected (safety net)
  // Primary fetch happens in handleEntrySelect for immediate response
  // This useEffect acts as a fallback in case handleEntrySelect didn't trigger
  useEffect(() => {
    if (!selectedEntry || fetchingOriginal || !isProvisioned) return;

    // Skip if we've already attempted to fetch this entry
    if (fetchedEntryIds.has(selectedEntry.id)) return;

    // Trigger the fetch as a safety net (small delay to avoid duplicate calls)
    const timeoutId = setTimeout(() => {
      if (!fetchedEntryIds.has(selectedEntry.id)) {
        void fetchOriginalArticle();
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [
    selectedEntry,
    fetchingOriginal,
    fetchedEntryIds,
    isProvisioned,
    fetchOriginalArticle,
  ]);

  const canLoadMore = entries.length > 0 && total > entries.length;
  // const selectedFeedTitle = searchMode
  //   ? `Search: ${searchQuery}`
  //   : isStarredView
  //   ? 'Starred'
  //   : selectedFeedId === null
  //   ? 'All feeds'
  //   : feedsById.get(selectedFeedId)?.title;

  // Filter feeds by selected category
  // const filteredFeeds = useMemo(() => {
  //   if (selectedCategoryId === null) {
  //     return feeds;
  //   }
  //   return feeds.filter((feed) => feed.category?.id === selectedCategoryId);
  // }, [feeds, selectedCategoryId]);

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
          <div
            className={styles.app}
            ref={appRef}
            style={{
              transform: `translateY(${pullOffset}px)`,
              transition:
                pullState === 'pulling' ? 'none' : 'transform 0.2s ease',
            }}
          >
            <div
              className={styles.pullIndicator}
              data-state={pullState}
              style={{ height: indicatorHeight }}
              aria-live="polite"
            >
              {indicatorLabel ? (
                <span className={styles.pullIndicatorText}>
                  {indicatorLabel}
                </span>
              ) : null}
            </div>
            {isRefreshingFeeds && (
              <div className={styles.refreshBanner} aria-live="polite">
                Refreshing feeds...
              </div>
            )}
            <MenuModal
              isOpen={isMenuModalOpen}
              onClose={closeMenuModal}
              categories={categories}
              feeds={feeds}
              openEditModal={openEditModal}
              openAddModal={openAddModal}
              onRefreshFeeds={() => refreshAll()}
              isRefreshingFeeds={isRefreshingFeeds}
              lastRefreshedAt={lastRefreshedAt}
              isLoading={isLoading}
              starredEntries={starredEntries}
              onToggleEntryStar={toggleEntryStar}
            />

            <AddModal
              isOpen={isAddModalOpen}
              onClose={closeAddModal}
              categories={categories}
              newCategoryTitle={newCategoryTitle}
              setNewCategoryTitle={setNewCategoryTitle}
              addCategoryLoading={addCategoryLoading}
              addCategoryError={addCategoryError}
              addCategory={addCategory}
              newFeedUrl={newFeedUrl}
              setNewFeedUrl={setNewFeedUrl}
              newFeedCategoryId={newFeedCategoryId}
              setNewFeedCategoryId={setNewFeedCategoryId}
              addFeedLoading={addFeedLoading}
              addFeedError={addFeedError}
              addFeed={addFeed}
              isLoading={isLoading}
            />

            <EditModal
              isOpen={isEditModalOpen}
              editType={editType}
              editItemId={editItemId}
              categories={categories}
              editTitle={editTitle}
              editFeedUrl={editFeedUrl}
              editCategoryId={editCategoryId}
              editLoading={editLoading}
              editError={editError}
              onClose={closeEditModal}
              onDeleteCategory={deleteCategory}
              onDeleteFeed={deleteFeed}
              onUpdateCategory={updateCategory}
              onUpdateFeed={updateFeed}
              onChangeTitle={setEditTitle}
              onChangeFeedUrl={setEditFeedUrl}
              onChangeCategoryId={setEditCategoryId}
            />

            <HeaderCategories
              isMenuOpen={isMenuModalOpen}
              onOpenMenu={openMenuModal}
              isCategoriesOpen={isCategoriesOpen}
              onToggleCategories={toggleCategories}
              isOffline={isOffline}
              categories={categories}
              selectedCategoryId={selectedCategoryId}
              isStarredView={isStarredView}
              categoryUnreadCounts={categoryUnreadCounts}
              totalUnreadCount={totalUnreadCount}
              totalStarredCount={totalStarredCount}
              isLoading={isLoading}
              isSearchOpen={isSearchOpen}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              onToggleSearch={toggleSearch}
              onSelectAll={() => {
                setSelectedCategoryId(null);
                setSelectedFeedId(null);
                setIsStarredView(false);
              }}
              onSelectStarred={() => {
                setSelectedCategoryId(null);
                setSelectedFeedId(null);
                setIsStarredView(true);
                setSearchMode(false);
              }}
              onSelectCategory={(categoryId) => {
                setSelectedCategoryId(categoryId);
                setSelectedFeedId(null);
              }}
            />

            {!isRefreshingFeeds && lastRefreshedLabel ? (
              <div className={styles.refreshStatus}>
                Last refreshed {lastRefreshedLabel}
              </div>
            ) : null}

            {error ? <div className={styles.error}>{error}</div> : null}

            <EntryList
              entries={entries}
              selectedEntryId={selectedEntryId}
              feedsById={feedsById}
              onEntrySelect={handleEntrySelect}
              canLoadMore={canLoadMore}
              isLoading={isLoading}
              onLoadMore={() => void loadMore()}
              searchMode={searchMode}
              isStarredView={isStarredView}
            />

            <EntryPanel
              entry={selectedEntry}
              feedsById={feedsById}
              onClose={() => setSelectedEntryId(null)}
              onToggleStar={() => void toggleSelectedStar()}
              onFetchOriginal={() => void fetchOriginalArticle()}
              fetchingOriginal={fetchingOriginal}
              onSetStatus={(status) => void setSelectedStatus(status)}
              onNavigatePrev={navigateToPrev}
              onNavigateNext={navigateToNext}
              hasPrev={hasPrev}
              hasNext={hasNext}
              hasFetchedOriginal={hasFetchedOriginal}
              isTogglingStar={isTogglingStar}
              isUpdatingStatus={isUpdatingStatus}
            />
          </div>
        )}
      </SignedIn>

      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}
