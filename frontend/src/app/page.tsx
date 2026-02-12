'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/nextjs';
import { toast } from 'sonner';
import styles from './page.module.sass';
import { AddModal } from '@/components/AddModal/AddModal';
import { EditModal } from '@/components/EditModal/EditModal';
import { EntryList } from '@/components/EntryList/EntryList';
import { EntryPanel } from '@/components/EntryPanel/EntryPanel';
import { TheHeader } from '@/components/TheHeader/TheHeader';
import { MenuModal } from '@/components/MenuModal/MenuModal';
import { useKeydown } from '@/hooks/useKeydown';
import { fetchJson } from '@/app/_lib/fetchJson';
import type { Category, DiscoveredFeed, Entry, Feed } from '@/app/_lib/types';
import { useReaderData } from '@/hooks/useReaderData';
import { useReaderGestures } from '@/hooks/useReaderGestures';
import { useUnreadCounters } from '@/hooks/useUnreadCounters';
import { fetchStarredEntries } from '@/lib/readerApi';
import { ENTRIES_PAGE_SIZE, INITIAL_ENTRIES_LIMIT } from '@/lib/entriesQuery';
import { NOTIFICATION_COPY } from '@/lib/notificationCopy';
import {
  isProtectedCategoryTitle,
  normalizeCategoryTitle,
} from '@/lib/protectedCategories';

type ActiveModal = 'none' | 'menu' | 'add' | 'edit';

const getBrowserWindow = (): any => {
  if (typeof globalThis === 'undefined') return null;
  return (globalThis as any).window ?? null;
};

const getBrowserNavigator = (): any => {
  if (typeof globalThis === 'undefined') return null;
  return (globalThis as any).navigator ?? null;
};

type AddFeedSelectionResponse = {
  requires_selection: true;
  subscriptions: DiscoveredFeed[];
  source?: 'input_url' | 'base_url';
  notice?: string;
};

function isAddFeedSelectionResponse(
  value: unknown,
): value is AddFeedSelectionResponse {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as {
    requires_selection?: unknown;
    subscriptions?: unknown;
  };
  return (
    candidate.requires_selection === true &&
    Array.isArray(candidate.subscriptions)
  );
}

export default function Home() {
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null);
  const [selectedFeedId, setSelectedFeedId] = useState<number | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    null,
  );
  const [isStarredView, setIsStarredView] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  const [isTogglingStar, setIsTogglingStar] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isProvisioned, setIsProvisioned] = useState(false);
  const [provisionError, setProvisionError] = useState<string | null>(null);
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [newFeedCategoryId, setNewFeedCategoryId] = useState<number | null>(
    null,
  );
  const [addFeedLoading, setAddFeedLoading] = useState(false);
  const [addFeedError, setAddFeedError] = useState<string | null>(null);
  const [discoveredFeeds, setDiscoveredFeeds] = useState<DiscoveredFeed[]>([]);
  const [selectedDiscoveredFeedUrl, setSelectedDiscoveredFeedUrl] =
    useState('');
  const [newCategoryTitle, setNewCategoryTitle] = useState('');
  const [addCategoryLoading, setAddCategoryLoading] = useState(false);
  const [addCategoryError, setAddCategoryError] = useState<string | null>(null);
  const fetchingOriginalEntryIdsRef = useRef<Set<number>>(new Set());
  const [fetchingOriginalEntryIds, setFetchingOriginalEntryIds] = useState<
    Set<number>
  >(new Set());
  const [starredEntries, setStarredEntries] = useState<Entry[]>([]);
  const [originalFetchStatusById, setOriginalFetchStatusById] = useState<
    Record<number, 'success' | 'error'>
  >({});
  const [activeModal, setActiveModal] = useState<ActiveModal>('none');
  const [isOffline, setIsOffline] = useState(false);
  const hasInitialLoadRef = useRef(false);
  const lastSyncRef = useRef<number | null>(null);
  const autoMarkTimeoutRef = useRef<number | null>(null);
  const autoMarkInitializedEntryIdRef = useRef<number | null>(null);

  const setLastSync = useCallback((timestamp: number | null) => {
    lastSyncRef.current = timestamp;
    const win = getBrowserWindow();
    if (!win) return;
    try {
      if (timestamp === null) {
        win.localStorage.removeItem('peace-rss-last-sync');
      } else {
        win.localStorage.setItem('peace-rss-last-sync', String(timestamp));
      }
    } catch {
      // Ignore storage errors.
    }
  }, []);

  // Edit modal form state
  const [editType, setEditType] = useState<'feed' | 'category' | null>(null);
  const [editItemId, setEditItemId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editFeedUrl, setEditFeedUrl] = useState('');
  const [editCategoryId, setEditCategoryId] = useState<number | null>(null);
  const [isEditingProtectedCategory, setIsEditingProtectedCategory] =
    useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const view = useMemo(
    () => ({
      searchMode,
      searchQuery,
      isStarredView,
      selectedFeedId,
      selectedCategoryId,
    }),
    [searchMode, searchQuery, isStarredView, selectedFeedId, selectedCategoryId],
  );

  const {
    feeds,
    categories,
    entries,
    total,
    isLoading,
    isRefreshingFeeds,
    error,
    setEntries,
    setIsLoading,
    setError,
    setTotal,
    loadFeeds,
    loadCategories,
    fetchEntriesData,
    loadEntries,
    resetEntries,
    refreshAll,
  } = useReaderData({ isProvisioned, view });

  const entriesRef = useRef<Entry[]>([]);
  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  const fetchedOriginalSuccessIds = useMemo(() => {
    const ids = new Set<number>();
    for (const [id, status] of Object.entries(originalFetchStatusById)) {
      if (status === 'success') ids.add(Number(id));
    }
    return ids;
  }, [originalFetchStatusById]);

  const isEntryUnread = useCallback((entry: Entry) => {
    return (entry.status ?? 'unread') === 'unread';
  }, []);

  const countLoadedUnreadEntries = useCallback(
    (list: Entry[]) => {
      return list.reduce(
        (sum, entry) => sum + (isEntryUnread(entry) ? 1 : 0),
        0,
      );
    },
    [isEntryUnread],
  );

  const mergePreservingSessionReadEntries = useCallback(
    (nextUnreadEntries: Entry[], sessionReadEntries: Entry[]) => {
      if (sessionReadEntries.length === 0) return nextUnreadEntries;

      const mergedById = new Map<number, Entry>();
      for (const entry of nextUnreadEntries) mergedById.set(entry.id, entry);

      for (const entry of sessionReadEntries) {
        if ((entry.status ?? 'unread') !== 'read') continue;
        if (!mergedById.has(entry.id)) mergedById.set(entry.id, entry);
      }

      const merged = Array.from(mergedById.values());
      merged.sort((a, b) => {
        const aTime = a.published_at ? new Date(a.published_at).getTime() : 0;
        const bTime = b.published_at ? new Date(b.published_at).getTime() : 0;
        return bTime - aTime;
      });
      return merged;
    },
    [],
  );

  const preserveOriginalContent = useCallback(
    (
      nextEntries: Entry[],
      previousEntries: Entry[],
      originalIds: Set<number>,
    ) => {
      if (originalIds.size === 0) return nextEntries;

      const previousById = new Map<number, Entry>();
      for (const entry of previousEntries) previousById.set(entry.id, entry);

      return nextEntries.map((entry) => {
        if (!originalIds.has(entry.id)) return entry;
        const previous = previousById.get(entry.id);
        if (!previous?.content) return entry;
        return { ...entry, content: previous.content };
      });
    },
    [],
  );

  const {
    totalUnreadCount,
    totalStarredCount,
    categoryUnreadCounts,
    refreshUnreadCounters,
    refreshStarredCount,
    getTotalForView,
  } = useUnreadCounters({ isProvisioned, feeds });

  const openMenuModal = useCallback(() => {
    setActiveModal('menu');
  }, []);

  const closeMenuModal = useCallback(() => {
    setActiveModal('none');
  }, []);

  const defaultAddFeedCategoryId = useMemo(() => {
    const firstRegularCategory = categories.find(
      (category) => !isProtectedCategoryTitle(category.title),
    );
    return firstRegularCategory?.id ?? null;
  }, [categories]);

  const resetAddModalForm = useCallback(() => {
    setNewCategoryTitle('');
    setAddCategoryError(null);
    setNewFeedUrl('');
    setNewFeedCategoryId(defaultAddFeedCategoryId);
    setAddFeedError(null);
    setDiscoveredFeeds([]);
    setSelectedDiscoveredFeedUrl('');
  }, [defaultAddFeedCategoryId]);

  const openAddModal = useCallback(() => {
    resetAddModalForm();
    setActiveModal('add');
  }, [resetAddModalForm]);

  const closeAddModal = useCallback(() => {
    resetAddModalForm();
    setActiveModal('menu');
  }, [resetAddModalForm]);

  const handleSetNewFeedUrl = useCallback((value: string) => {
    setNewFeedUrl(value);
    setDiscoveredFeeds([]);
    setSelectedDiscoveredFeedUrl('');
    setAddFeedError(null);
  }, []);

  useEffect(() => {
    if (activeModal !== 'add') return;

    const allowedCategoryIds = new Set(
      categories
        .filter((category) => !isProtectedCategoryTitle(category.title))
        .map((category) => category.id),
    );

    setNewFeedCategoryId((previous) => {
      if (previous !== null && allowedCategoryIds.has(previous)) {
        return previous;
      }
      return defaultAddFeedCategoryId;
    });
  }, [activeModal, categories, defaultAddFeedCategoryId]);

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

  const resetEditModalForm = useCallback(() => {
    setEditType(null);
    setEditItemId(null);
    setEditTitle('');
    setEditFeedUrl('');
    setEditCategoryId(null);
    setIsEditingProtectedCategory(false);
    setEditError(null);
  }, []);

  const openEditModal = useCallback(
    (type: 'feed' | 'category', item: Feed | Category) => {
      if (type === 'category') {
        const cat = item as Category;
        if (isProtectedCategoryTitle(cat.title)) {
          toast.error('This category is managed automatically.');
          return;
        }
      }
      resetEditModalForm();
      setEditType(type);
      setEditItemId(item.id);
      setEditTitle(item.title);
      setIsEditingProtectedCategory(
        type === 'category' && isProtectedCategoryTitle(item.title),
      );
      if (type === 'feed') {
        const feed = item as Feed;
        setEditFeedUrl(feed.feed_url || '');
        setEditCategoryId(feed.category?.id || null);
      }
      setActiveModal('edit');
      setEditError(null);
    },
    [resetEditModalForm],
  );

  const closeEditModal = useCallback(() => {
    resetEditModalForm();
    setActiveModal('menu');
  }, [resetEditModalForm]);

  const feedsById = useMemo(() => {
    const map = new Map<number, Feed>();
    for (const feed of feeds) map.set(feed.id, feed);
    return map;
  }, [feeds]);

  const visibleHeaderCategories = useMemo(() => {
    return categories.filter((category) => {
      const kind = normalizeCategoryTitle(category.title);
      return kind !== 'instagram' && kind !== 'twitter';
    });
  }, [categories]);

  const selectedEntry = useMemo(() => {
    return entries.find((e) => e.id === selectedEntryId) ?? null;
  }, [entries, selectedEntryId]);

  const selectedEntryRef = useRef<Entry | null>(null);
  useEffect(() => {
    selectedEntryRef.current = selectedEntry;
  }, [selectedEntry]);

  const isUpdatingStatusRef = useRef(false);
  useEffect(() => {
    isUpdatingStatusRef.current = isUpdatingStatus;
  }, [isUpdatingStatus]);

  const selectedOriginalFetchStatus = useMemo(() => {
    if (!selectedEntry) return undefined;
    return originalFetchStatusById[selectedEntry.id];
  }, [selectedEntry, originalFetchStatusById]);

  const { selectedIndex, hasPrev, hasNext } = useMemo(() => {
    const index = entries.findIndex((e) => e.id === selectedEntryId);
    return {
      selectedIndex: index,
      hasPrev: index > 0,
      hasNext: index >= 0 && index < entries.length - 1,
    };
  }, [entries, selectedEntryId]);

  const mergeEntryDeltas = useCallback(
    (current: Entry[], delta: Entry[], fetchedIds: Set<number>) => {
      const map = new Map<number, Entry>();
      for (const entry of current) {
        map.set(entry.id, entry);
      }
      for (const entry of delta) {
        const existing = map.get(entry.id);
        if (!existing) {
          // Don't introduce read entries into the list; we only keep reads that
          // originated in this session (i.e. already present in `current`).
          if ((entry.status ?? 'unread') === 'unread') {
            map.set(entry.id, entry);
          }
          continue;
        }
        const merged = { ...existing, ...entry };
        if (fetchedIds.has(entry.id) && existing.content) {
          merged.content = existing.content;
        }
        map.set(entry.id, merged);
      }
      const merged = Array.from(map.values());
      merged.sort((a, b) => {
        const aTime = a.published_at ? new Date(a.published_at).getTime() : 0;
        const bTime = b.published_at ? new Date(b.published_at).getTime() : 0;
        return bTime - aTime;
      });
      return merged;
    },
    [],
  );

  // Load starred entries for the menu
  const loadStarredEntries = useCallback(async () => {
    if (!isProvisioned) return;
    try {
      const data = await fetchStarredEntries();
      setStarredEntries(data.entries);
    } catch (err) {
      console.error('Failed to load starred entries', err);
    }
  }, [isProvisioned]);

  const syncSelection = useCallback((nextEntries: Entry[]) => {
    setSelectedEntryId((prev) =>
      prev && nextEntries.some((entry) => entry.id === prev) ? prev : null,
    );
  }, []);

  const refreshAllData = useCallback(async (): Promise<boolean> => {
    const now = Math.floor(Date.now() / 1000);
    const previousEntriesSnapshot = entriesRef.current;
    const sessionReadSnapshot = previousEntriesSnapshot.filter(
      (entry) => (entry.status ?? 'unread') === 'read',
    );
    const canIncrementallyRefresh =
      !searchMode &&
      !isStarredView &&
      selectedFeedId === null &&
      selectedCategoryId === null;

    if (canIncrementallyRefresh && lastSyncRef.current) {
      try {
        await Promise.all([loadFeeds(), loadCategories()]);
        const delta = await fetchEntriesData({
          offset: 0,
          limit: INITIAL_ENTRIES_LIMIT,
          status: 'all',
          changedAfter: lastSyncRef.current,
        });

        if (delta.entries.length > 0) {
          setEntries((prev) =>
            mergeEntryDeltas(prev, delta.entries, fetchedOriginalSuccessIds),
          );
        }

        await Promise.all([
          refreshUnreadCounters(),
          refreshStarredCount(),
          loadStarredEntries(),
        ]);

        const viewTotal = getTotalForView(view);
        if (viewTotal !== null) {
          setTotal(viewTotal);
        }

        setLastSync(now);
        return true;
      } catch (e) {
        console.error('Incremental refresh failed, falling back', e);
      }
    }

    const data = await refreshAll(() => [
      refreshUnreadCounters(),
      refreshStarredCount(),
      loadStarredEntries(),
    ]);
    if (data?.entries) {
      const withContent = preserveOriginalContent(
        data.entries,
        previousEntriesSnapshot,
        fetchedOriginalSuccessIds,
      );
      const merged = mergePreservingSessionReadEntries(
        withContent,
        sessionReadSnapshot,
      );
      setEntries(merged);
      syncSelection(merged);
    }
    if (!data) return false;
    setLastSync(now);
    return true;
  }, [
    fetchEntriesData,
    getTotalForView,
    isStarredView,
    loadCategories,
    loadFeeds,
    loadStarredEntries,
    mergeEntryDeltas,
    mergePreservingSessionReadEntries,
    preserveOriginalContent,
    refreshAll,
    refreshStarredCount,
    refreshUnreadCounters,
    searchMode,
    selectedCategoryId,
    selectedFeedId,
    setEntries,
    setLastSync,
    setTotal,
    syncSelection,
    view,
    fetchedOriginalSuccessIds,
  ]);

  const refreshAllDataWithToast = useCallback(async () => {
    const didSucceed = await refreshAllData();
    if (didSucceed) {
      toast(NOTIFICATION_COPY.app.feedRefreshed);
    } else {
      toast.error(NOTIFICATION_COPY.app.feedRefreshFailed);
    }
    return didSucceed;
  }, [refreshAllData]);

  const reloadCurrentEntries = useCallback(async () => {
    const current = entriesRef.current;
    const sessionReadSnapshot = current.filter(
      (entry) => (entry.status ?? 'unread') === 'read',
    );
    const limit = Math.max(
      searchMode || isStarredView
        ? current.length
        : countLoadedUnreadEntries(current),
      INITIAL_ENTRIES_LIMIT,
    );
    const data = await loadEntries({ append: false, offset: 0, limit });
    const withContent = preserveOriginalContent(
      data.entries,
      current,
      fetchedOriginalSuccessIds,
    );
    const merged = mergePreservingSessionReadEntries(
      withContent,
      sessionReadSnapshot,
    );
    setEntries(merged);
    syncSelection(merged);
    return { ...data, entries: merged };
  }, [
    countLoadedUnreadEntries,
    fetchedOriginalSuccessIds,
    isStarredView,
    loadEntries,
    mergePreservingSessionReadEntries,
    preserveOriginalContent,
    searchMode,
    setEntries,
    syncSelection,
  ]);

  const handleLoadMore = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const pagingOffset =
        searchMode || isStarredView
          ? entries.length
          : countLoadedUnreadEntries(entries);
      await loadEntries({
        append: true,
        offset: pagingOffset,
        limit: ENTRIES_PAGE_SIZE,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load more');
    } finally {
      setIsLoading(false);
    }
  }, [
    countLoadedUnreadEntries,
    entries,
    isStarredView,
    loadEntries,
    searchMode,
    setError,
    setIsLoading,
  ]);

  const markEntryStatus = useCallback(
    async (entryIds: number[], status: 'read' | 'unread') => {
      await fetchJson<{ ok: true }>('/api/entries/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_ids: entryIds, status }),
      });
    },
    [],
  );

  const setEntryStatusById = useCallback(
    async (entryId: number, status: 'read' | 'unread'): Promise<boolean> => {
      if (isUpdatingStatusRef.current) return false;
      isUpdatingStatusRef.current = true;
      setIsUpdatingStatus(true);
      setError(null);
      try {
        await markEntryStatus([entryId], status);
        setEntries((prev) =>
          prev.map((entry) =>
            entry.id === entryId ? { ...entry, status } : entry,
          ),
        );
        await Promise.all([loadFeeds(), refreshUnreadCounters()]);
        try {
          const data = await fetchEntriesData({ offset: 0, limit: 1 });
          setTotal(data.total ?? 0);
        } catch {
          // Ignore count refresh errors; counters will be updated on next refresh.
        }
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update status');
        return false;
      } finally {
        isUpdatingStatusRef.current = false;
        setIsUpdatingStatus(false);
      }
    },
    [
      fetchEntriesData,
      loadFeeds,
      markEntryStatus,
      refreshUnreadCounters,
      setTotal,
    ],
  );

  async function markPageRead() {
    if (entries.length === 0) return;
    setIsLoading(true);
    setError(null);
    try {
      await markEntryStatus(
        entries.map((e) => e.id),
        'read',
      );
      setEntries((prev) => prev.map((entry) => ({ ...entry, status: 'read' })));
      await Promise.all([loadFeeds(), refreshUnreadCounters()]);
      try {
        const data = await fetchEntriesData({ offset: 0, limit: 1 });
        setTotal(data.total ?? 0);
      } catch {
        // Ignore count refresh errors; counters will be updated on next refresh.
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to mark page read');
    } finally {
      setIsLoading(false);
    }
  }

  async function toggleSelectedStar() {
    const current = selectedEntryRef.current;
    if (!current) return;
    if (isTogglingStar) return;

    const entryId = current.id;
    const previousStarred = Boolean(current.starred);
    const optimisticStarred = !previousStarred;

    setIsTogglingStar(true);
    setError(null);

    // Optimistic UI update so EntryPanel button text flips immediately.
    setEntries((prev) =>
      prev.map((entry) =>
        entry.id === entryId ? { ...entry, starred: optimisticStarred } : entry,
      ),
    );

    let didToggleOnServer = false;
    try {
      await fetchJson<{ ok: true }>(`/api/entries/${entryId}/star`, {
        method: 'POST',
      });
      didToggleOnServer = true;
      // Refresh list + star metadata
      await Promise.all([
        reloadCurrentEntries(),
        refreshStarredCount(),
        loadStarredEntries(),
      ]);
    } catch (e) {
      if (!didToggleOnServer) {
        // Revert only when the toggle request itself failed.
        setEntries((prev) =>
          prev.map((entry) =>
            entry.id === entryId
              ? { ...entry, starred: previousStarred }
              : entry,
          ),
        );
      }
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
        await refreshStarredCount();
        if (isStarredView) {
          await reloadCurrentEntries();
        }
      } catch (e) {
        console.error('Failed to toggle entry star', e);
      }
    },
    [
      loadStarredEntries,
      refreshStarredCount,
      isStarredView,
      reloadCurrentEntries,
    ],
  );

  async function setSelectedStatus(status: 'read' | 'unread') {
    const current = selectedEntryRef.current;
    if (!current) return;
    await setEntryStatusById(current.id, status);
  }

  async function bootstrap() {
    try {
      const res = await fetchJson<{ ok: boolean; provisioned: boolean }>(
        '/api/bootstrap',
        { method: 'POST' },
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
    const trimmedSelectedFeedUrl = selectedDiscoveredFeedUrl.trim();
    if (!trimmedUrl && !trimmedSelectedFeedUrl) {
      setAddFeedError('Enter a feed URL.');
      return false;
    }
    if (newFeedCategoryId === null) {
      setAddFeedError('Choose a category.');
      return false;
    }

    setAddFeedLoading(true);
    setAddFeedError(null);

    try {
      const requestBody: {
        feed_url?: string;
        selected_feed_url?: string;
        category_id: number;
      } = { category_id: newFeedCategoryId };
      if (trimmedUrl) {
        requestBody.feed_url = trimmedUrl;
      }
      if (trimmedSelectedFeedUrl) {
        requestBody.selected_feed_url = trimmedSelectedFeedUrl;
      }

      const response = await fetchJson<unknown>('/api/feeds/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (isAddFeedSelectionResponse(response)) {
        const subscriptions = response.subscriptions;
        if (subscriptions.length === 0) {
          setAddFeedError(
            'No discoverable feeds found for this URL. Please try another URL.',
          );
          setDiscoveredFeeds([]);
          setSelectedDiscoveredFeedUrl('');
          return false;
        }

        setDiscoveredFeeds(subscriptions);
        setSelectedDiscoveredFeedUrl(subscriptions[0]?.url ?? '');
        setAddFeedError(
          response.notice ??
            (subscriptions.length > 1
              ? 'Multiple feeds found. Choose one, then submit again.'
              : 'No exact URL match was found. Review the suggested feed and submit again to confirm.'),
        );
        return false;
      }

      // Success: clear input and refresh feeds
      setNewFeedUrl('');
      setNewFeedCategoryId(defaultAddFeedCategoryId);
      setDiscoveredFeeds([]);
      setSelectedDiscoveredFeedUrl('');
      await Promise.all([
        loadFeeds(),
        loadCategories(),
        refreshUnreadCounters(),
      ]);
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
        e instanceof Error ? e.message : 'Failed to add category',
      );
      return false;
    } finally {
      setAddCategoryLoading(false);
    }
  }

  async function deleteCategory(categoryId: number) {
    const category = categories.find((cat) => cat.id === categoryId);
    if (category && isProtectedCategoryTitle(category.title)) {
      toast.error('This category is managed automatically.');
      return;
    }
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
      await Promise.all([
        loadCategories(),
        loadFeeds(),
        refreshUnreadCounters(),
      ]);
      if (selectedCategoryId === categoryId) {
        setSelectedCategoryId(null);
        setSelectedFeedId(null);
        await reloadCurrentEntries();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete category');
    } finally {
      setIsLoading(false);
    }
  }

  async function deleteFeed(feedId: number) {
    setIsLoading(true);
    setError(null);

    try {
      await fetchJson<{ ok: boolean }>(`/api/feeds/${feedId}`, {
        method: 'DELETE',
      });

      // Success: refresh feeds
      await Promise.all([loadFeeds(), refreshUnreadCounters()]);
      if (selectedFeedId === feedId) {
        setSelectedFeedId(null);
        await reloadCurrentEntries();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete feed');
    } finally {
      setIsLoading(false);
    }
  }

  async function updateCategory(e: React.FormEvent): Promise<boolean> {
    e.preventDefault();

    if (!editItemId) return false;
    if (isEditingProtectedCategory) {
      setEditError('This category is managed automatically.');
      return false;
    }

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
        e instanceof Error ? e.message : 'Failed to update category',
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
      const requestBody: {
        title: string;
        feed_url: string;
        category_id?: number;
      } = {
        title: trimmedTitle,
        feed_url: trimmedUrl,
      };
      if (editCategoryId !== null) {
        requestBody.category_id = editCategoryId;
      }

      await fetchJson<{ ok: boolean }>(`/api/feeds/${editItemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      // Success: refresh feeds/categories (category may be created/forced server-side)
      await Promise.all([
        loadFeeds(),
        loadCategories(),
        refreshUnreadCounters(),
      ]);
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

  const handleSelectStarred = useCallback(() => {
    // Starred view is exclusive from search/category/feed filters.
    setIsSearchOpen(false);
    setSearchQuery('');
    setSearchMode(false);
    setSelectedCategoryId(null);
    setSelectedFeedId(null);
    setIsStarredView(true);
  }, []);

  const handleSelectCategory = useCallback((categoryId: number) => {
    setIsSearchOpen(false);
    setSearchQuery('');
    setSearchMode(false);
    setIsStarredView(false);
    setSelectedCategoryId(categoryId);
    setSelectedFeedId(null);
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
      setSelectedEntryId(null);
      loadEntries({ append: false, offset: 0, limit: INITIAL_ENTRIES_LIMIT })
        .catch((e) =>
          setError(e instanceof Error ? e.message : 'Failed to search'),
        )
        .finally(() => setIsLoading(false));
    }, 250);

    return () => {
      win.clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, isSearchOpen, isProvisioned, searchMode]);

  const fetchOriginalArticle = useCallback(
    async (entryId?: number, options?: { force?: boolean }) => {
      const force = Boolean(options?.force);
      const targetEntry = entryId
        ? entries.find((e) => e.id === entryId)
        : selectedEntry;

      if (!targetEntry || !isProvisioned) return;

      const fetchStatus = originalFetchStatusById[targetEntry.id];
      if (!force && fetchStatus === 'success') return;
      if (fetchingOriginalEntryIdsRef.current.has(targetEntry.id)) return;

      fetchingOriginalEntryIdsRef.current.add(targetEntry.id);
      setFetchingOriginalEntryIds(new Set(fetchingOriginalEntryIdsRef.current));
      setError(null);

      try {
        const result = await fetchJson<{
          ok: boolean;
          content: string;
          reading_time?: number;
        }>(`/api/entries/${targetEntry.id}/fetch-content`, { method: 'POST' });

        if (result.ok && result.content) {
          // Update the entry in the entries array with the new content
          setEntries((prev) =>
            prev.map((e) =>
              e.id === targetEntry.id
                ? {
                    ...e,
                    content: result.content,
                    reading_time: result.reading_time ?? e.reading_time,
                  }
                : e,
            ),
          );
          setOriginalFetchStatusById((prev) => ({
            ...prev,
            [targetEntry.id]: 'success',
          }));
        } else {
          setOriginalFetchStatusById((prev) => ({
            ...prev,
            [targetEntry.id]: 'error',
          }));
        }
      } catch (e) {
        setError(
          e instanceof Error ? e.message : 'Failed to fetch original article',
        );
        setOriginalFetchStatusById((prev) => ({
          ...prev,
          [targetEntry.id]: 'error',
        }));
      } finally {
        fetchingOriginalEntryIdsRef.current.delete(targetEntry.id);
        setFetchingOriginalEntryIds(
          new Set(fetchingOriginalEntryIdsRef.current),
        );
      }
    },
    [
      entries,
      isProvisioned,
      originalFetchStatusById,
      selectedEntry,
      setEntries,
    ],
  );

  const handleEntrySelect = useCallback(
    (entryId: number) => {
      setSelectedEntryId(entryId);
      if (!isProvisioned) return;
      void fetchOriginalArticle(entryId);
    },
    [fetchOriginalArticle, isProvisioned],
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

  const canSwipe = selectedEntryId !== null && activeModal === 'none';
  const { appRef, pullState, pullOffset, indicatorHeight, indicatorLabel } =
    useReaderGestures({
      isProvisioned,
      isLoading,
      canSwipe,
      hasNext,
      hasPrev,
      onNavigateNext: navigateToNext,
      onNavigatePrev: navigateToPrev,
      onRefresh: async () => {
        await refreshAllDataWithToast();
      },
    });

  // Bootstrap on mount
  useEffect(() => {
    void bootstrap();
  }, []);

  // Initial load after provisioning
  useEffect(() => {
    if (!isProvisioned || hasInitialLoadRef.current) return;
    const win = getBrowserWindow();
    if (win) {
      const stored = win.localStorage.getItem('peace-rss-last-sync');
      const parsed = stored ? Number(stored) : null;
      if (parsed && Number.isFinite(parsed)) {
        lastSyncRef.current = parsed;
      }
    }
    void refreshAllData().finally(() => {
      hasInitialLoadRef.current = true;
    });
  }, [isProvisioned, refreshAllData]);

  // Reset entries when switching views (category/feed/starred)
  useEffect(() => {
    if (!isProvisioned || !hasInitialLoadRef.current) return;
    if (searchMode) return;
    setIsLoading(true);
    setError(null);
    setSelectedEntryId(null);
    setLastSync(null);
    resetEntries()
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setIsLoading(false));
  }, [
    selectedFeedId,
    selectedCategoryId,
    isStarredView,
    searchMode,
    isProvisioned,
    resetEntries,
    setIsLoading,
    setError,
    setLastSync,
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

  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const win = getBrowserWindow();
    if (!win) return;

    const onOpenAdd = () => openAddModal();
    win.addEventListener('peace-rss:open-add-modal', onOpenAdd);
    return () => {
      win.removeEventListener('peace-rss:open-add-modal', onOpenAdd);
    };
  }, [openAddModal]);

  useEffect(() => {
    if (searchParams.get('openAdd') !== '1') return;
    openAddModal();

    const remaining = new URLSearchParams(searchParams.toString());
    remaining.delete('openAdd');
    const qs = remaining.toString();
    router.replace(qs ? `/?${qs}` : '/', { scroll: false });
  }, [openAddModal, router, searchParams]);

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
        // Preserve browser hard/soft reload shortcuts (Cmd/Ctrl + R).
        if (e.metaKey || e.ctrlKey) return;
        e.preventDefault();
        void refreshAllDataWithToast();
        return;
      }

      // m or M = mark/unmark entry (when entry is open)
      if (e.key === 'm' || e.key === 'M') {
        const current = selectedEntryRef.current;
        if (!current) return;
        e.preventDefault();
        const currentStatus = current.status ?? 'unread';
        const nextStatus = currentStatus === 'unread' ? 'read' : 'unread';
        void (async () => {
          const ok = await setEntryStatusById(current.id, nextStatus);
          if (!ok) return;
          toast(
            nextStatus === 'read'
              ? NOTIFICATION_COPY.app.articleMarked
              : NOTIFICATION_COPY.app.articleUnmarked,
          );
        })();
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
    { target: getBrowserWindow() },
  );

  // Auto-mark entry as read after 5s on the entry page
  useEffect(() => {
    if (selectedEntryId !== null) return;
    autoMarkInitializedEntryIdRef.current = null;
  }, [selectedEntryId]);

  useEffect(() => {
    const win = getBrowserWindow();
    if (!win) return;
    if (!isProvisioned) return;
    if (activeModal !== 'none') return;

    const entry = selectedEntryRef.current;
    if (!entry) return;
    if (autoMarkInitializedEntryIdRef.current === entry.id) return;
    autoMarkInitializedEntryIdRef.current = entry.id;
    if ((entry.status ?? 'unread') !== 'unread') return;

    const entryId = entry.id;

    if (autoMarkTimeoutRef.current) {
      win.clearTimeout(autoMarkTimeoutRef.current);
      autoMarkTimeoutRef.current = null;
    }

    autoMarkTimeoutRef.current = win.setTimeout(() => {
      const current = selectedEntryRef.current;
      if (!current || current.id !== entryId) return;
      if ((current.status ?? 'unread') !== 'unread') return;
      void setEntryStatusById(entryId, 'read');
    }, 5000);

    return () => {
      if (autoMarkTimeoutRef.current) {
        win.clearTimeout(autoMarkTimeoutRef.current);
        autoMarkTimeoutRef.current = null;
      }
    };
  }, [
    selectedEntry?.id,
    selectedEntryId,
    isProvisioned,
    activeModal,
    setEntryStatusById,
  ]);

  // Auto-fetch original article when entry is selected (safety net)
  // Primary fetch happens in handleEntrySelect for immediate response
  // This useEffect acts as a fallback in case handleEntrySelect didn't trigger
  useEffect(() => {
    if (!selectedEntry || !isProvisioned) return;
    if (fetchingOriginalEntryIds.has(selectedEntry.id)) return;
    if (originalFetchStatusById[selectedEntry.id] === 'success') return;

    // Trigger the fetch as a safety net (small delay to avoid duplicate calls)
    const timeoutId = setTimeout(() => {
      if (originalFetchStatusById[selectedEntry.id] !== 'success') {
        void fetchOriginalArticle(selectedEntry.id);
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [
    selectedEntry,
    fetchingOriginalEntryIds,
    isProvisioned,
    originalFetchStatusById,
    fetchOriginalArticle,
  ]);

  const loadedForPaging =
    searchMode || isStarredView
      ? entries.length
      : countLoadedUnreadEntries(entries);
  const canLoadMore = total > loadedForPaging;
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
              isOpen={activeModal === 'menu'}
              onClose={closeMenuModal}
              categories={categories}
              feeds={feeds}
              openEditModal={openEditModal}
              openAddModal={openAddModal}
              isLoading={isLoading}
              starredEntries={starredEntries}
              onToggleEntryStar={toggleEntryStar}
            />

            <AddModal
              isOpen={activeModal === 'add'}
              onClose={closeAddModal}
              categories={categories}
              newCategoryTitle={newCategoryTitle}
              setNewCategoryTitle={setNewCategoryTitle}
              addCategoryLoading={addCategoryLoading}
              addCategoryError={addCategoryError}
              addCategory={addCategory}
              newFeedUrl={newFeedUrl}
              setNewFeedUrl={handleSetNewFeedUrl}
              newFeedCategoryId={newFeedCategoryId}
              setNewFeedCategoryId={setNewFeedCategoryId}
              discoveredFeeds={discoveredFeeds}
              selectedDiscoveredFeedUrl={selectedDiscoveredFeedUrl}
              setSelectedDiscoveredFeedUrl={setSelectedDiscoveredFeedUrl}
              addFeedLoading={addFeedLoading}
              addFeedError={addFeedError}
              addFeed={addFeed}
              isLoading={isLoading}
            />

            <EditModal
              isOpen={activeModal === 'edit'}
              editType={editType}
              editItemId={editItemId}
              categories={categories}
              editTitle={editTitle}
              editFeedUrl={editFeedUrl}
              editCategoryId={editCategoryId}
              isEditingProtectedCategory={isEditingProtectedCategory}
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

            <TheHeader
              isMenuOpen={activeModal === 'menu'}
              onOpenMenu={openMenuModal}
              isCategoriesOpen={isCategoriesOpen}
              onToggleCategories={toggleCategories}
              isOffline={isOffline}
              categories={visibleHeaderCategories}
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
              onSelectStarred={handleSelectStarred}
              onSelectCategory={handleSelectCategory}
            />

            {error ? <div className={styles.error}>{error}</div> : null}

            <EntryList
              entries={entries}
              selectedEntryId={selectedEntryId}
              feedsById={feedsById}
              onEntrySelect={handleEntrySelect}
              canLoadMore={canLoadMore}
              isLoading={isLoading}
              onLoadMore={handleLoadMore}
              searchMode={searchMode}
              isStarredView={isStarredView}
            />

            <EntryPanel
              entry={selectedEntry}
              feedsById={feedsById}
              onClose={() => setSelectedEntryId(null)}
              onToggleStar={() => void toggleSelectedStar()}
              onFetchOriginal={() =>
                void fetchOriginalArticle(undefined, { force: true })
              }
              fetchingOriginal={
                selectedEntry
                  ? fetchingOriginalEntryIds.has(selectedEntry.id)
                  : false
              }
              originalFetchStatus={selectedOriginalFetchStatus}
              onSetStatus={(status) => void setSelectedStatus(status)}
              onNavigatePrev={navigateToPrev}
              onNavigateNext={navigateToNext}
              hasPrev={hasPrev}
              hasNext={hasNext}
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
