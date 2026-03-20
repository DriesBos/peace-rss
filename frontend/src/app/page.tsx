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
import type {
  Category,
  DiscoveredFeed,
  Entry,
  Feed,
  ReaderPreferences,
} from '@/app/_lib/types';
import { useReaderData } from '@/hooks/useReaderData';
import { useReaderGestures } from '@/hooks/useReaderGestures';
import {
  fetchAllCount,
  fetchReaderPreferences,
  fetchStarredEntries,
  fetchStarredCount,
} from '@/lib/readerApi';
import { DEFAULT_ENTRIES_PAGE_SIZE } from '@/lib/entriesQuery';
import { NOTIFICATION_COPY } from '@/lib/notificationCopy';
import {
  isProtectedCategoryTitle,
} from '@/lib/protectedCategories';

type ActiveModal = 'none' | 'menu' | 'add' | 'edit';

const DEFAULT_READER_PREFERENCES: ReaderPreferences = {
  id: 0,
  entries_per_page: DEFAULT_ENTRIES_PAGE_SIZE,
  keyboard_shortcuts: true,
  show_reading_time: true,
  entry_swipe: true,
};

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
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    null,
  );
  const [statusFilter, setStatusFilter] = useState<'unread' | 'all'>('unread');
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
  const [totalAllCount, setTotalAllCount] = useState(0);
  const [totalStarredCount, setTotalStarredCount] = useState(0);
  const [originalFetchStatusById, setOriginalFetchStatusById] = useState<
    Record<number, 'success' | 'error'>
  >({});
  const [readerPreferences, setReaderPreferences] = useState<ReaderPreferences>(
    DEFAULT_READER_PREFERENCES,
  );
  const [activeModal, setActiveModal] = useState<ActiveModal>('none');
  const [isOffline, setIsOffline] = useState(false);
  const hasInitialLoadRef = useRef(false);

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
      selectedCategoryId,
      statusFilter,
    }),
    [
      searchMode,
      searchQuery,
      isStarredView,
      selectedCategoryId,
      statusFilter,
    ],
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
    setFeeds,
    setCategories,
    setIsLoading,
    setError,
    loadFeeds,
    loadCategories,
    loadEntries,
    resetEntries,
    refreshAll,
  } = useReaderData({
    isProvisioned,
    view,
    pageSize: readerPreferences.entries_per_page,
  });

  const entriesRef = useRef<Entry[]>([]);
  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

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

  const visibleHeaderCategories = categories;

  const categoryUnreadCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const category of categories) {
      counts.set(category.id, category.total_unread ?? 0);
    }
    return counts;
  }, [categories]);

  const totalUnreadCount = useMemo(() => {
    const visibleCategoryUnreadCount = categories.reduce((sum, category) => {
      if (category.hide_globally) return sum;
      return sum + (category.total_unread ?? 0);
    }, 0);

    const uncategorizedUnreadCount = feeds.reduce((sum, feed) => {
      if (feed.hide_globally || feed.category?.id) return sum;
      return sum + (feed.unread_count ?? 0);
    }, 0);

    return visibleCategoryUnreadCount + uncategorizedUnreadCount;
  }, [categories, feeds]);

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

  const loadReaderPreferences = useCallback(async () => {
    if (!isProvisioned) return DEFAULT_READER_PREFERENCES;
    try {
      const data = await fetchReaderPreferences();
      setReaderPreferences({
        ...DEFAULT_READER_PREFERENCES,
        ...data,
        entries_per_page:
          data.entries_per_page > 0
            ? data.entries_per_page
            : DEFAULT_ENTRIES_PAGE_SIZE,
      });
      return data;
    } catch (err) {
      console.error('Failed to load reader preferences', err);
      return DEFAULT_READER_PREFERENCES;
    }
  }, [isProvisioned]);

  const refreshStarredCount = useCallback(async () => {
    if (!isProvisioned) return null;
    try {
      const data = await fetchStarredCount();
      setTotalStarredCount(data.total ?? 0);
      return data.total ?? 0;
    } catch (err) {
      console.error('Failed to load starred count', err);
      return null;
    }
  }, [isProvisioned]);

  const refreshAllCount = useCallback(async () => {
    if (!isProvisioned) return null;
    try {
      const data = await fetchAllCount();
      setTotalAllCount(data.total ?? 0);
      return data.total ?? 0;
    } catch (err) {
      console.error('Failed to load all count', err);
      return null;
    }
  }, [isProvisioned]);

  // Load starred entries for the menu
  const loadStarredEntries = useCallback(async () => {
    if (!isProvisioned) return;
    try {
      const data = await fetchStarredEntries(readerPreferences.entries_per_page);
      setStarredEntries(data.entries);
    } catch (err) {
      console.error('Failed to load starred entries', err);
    }
  }, [isProvisioned, readerPreferences.entries_per_page]);

  const syncSelection = useCallback((nextEntries: Entry[]) => {
    setSelectedEntryId((prev) =>
      prev && nextEntries.some((entry) => entry.id === prev) ? prev : null,
    );
  }, []);

  const refreshAllData = useCallback(async (): Promise<boolean> => {
    const data = await refreshAll(() => [refreshStarredCount(), refreshAllCount()]);
    if (data?.entries) {
      syncSelection(data.entries);
    }
    return data !== null;
  }, [
    refreshAll,
    refreshAllCount,
    refreshStarredCount,
    syncSelection,
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
    const limit = Math.max(current.length, readerPreferences.entries_per_page);
    const data = await loadEntries({ append: false, offset: 0, limit });
    syncSelection(data.entries);
    return data;
  }, [
    loadEntries,
    readerPreferences.entries_per_page,
    syncSelection,
  ]);

  const handleLoadMore = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await loadEntries({
        append: true,
        offset: entries.length,
        limit: readerPreferences.entries_per_page,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load more');
    } finally {
      setIsLoading(false);
    }
  }, [
    entries,
    loadEntries,
    readerPreferences.entries_per_page,
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

  const markEntryStatusKeepalive = useCallback(
    (entryIds: number[], status: 'read' | 'unread') => {
      return fetch('/api/entries/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cache-control': 'no-store',
        },
        body: JSON.stringify({ entry_ids: entryIds, status }),
        cache: 'no-store',
        credentials: 'same-origin',
        keepalive: true,
      });
    },
    [],
  );

  const updateEntryStatusLocally = useCallback(
    (entryId: number, status: 'read' | 'unread') => {
      const current = entriesRef.current.find((entry) => entry.id === entryId);
      if (!current) return;

      const previousStatus = current.status ?? 'unread';
      if (previousStatus === status) return;

      const delta =
        previousStatus === 'unread' && status === 'read'
          ? -1
          : previousStatus === 'read' && status === 'unread'
            ? 1
            : 0;

      setEntries((prev) =>
        prev.map((entry) =>
          entry.id === entryId ? { ...entry, status } : entry,
        ),
      );

      if (delta === 0) return;

      setFeeds((prev) =>
        prev.map((feed) =>
          feed.id === current.feed_id
            ? {
                ...feed,
                unread_count: Math.max(0, (feed.unread_count ?? 0) + delta),
              }
            : feed,
        ),
      );

      const categoryId = feedsById.get(current.feed_id)?.category?.id;

      if (categoryId) {
        setCategories((prev) =>
          prev.map((category) =>
            category.id === categoryId
              ? {
                  ...category,
                  total_unread: Math.max(
                    0,
                    (category.total_unread ?? 0) + delta,
                  ),
                }
              : category,
          ),
        );
      }
    },
    [feedsById, setCategories, setEntries, setFeeds],
  );

  const markEntryReadOnOpen = useCallback(
    (entryId: number) => {
      const current = entriesRef.current.find((entry) => entry.id === entryId);
      if (!current || (current.status ?? 'unread') !== 'unread') return;

      updateEntryStatusLocally(entryId, 'read');

      void markEntryStatus([entryId], 'read').catch((e) => {
        updateEntryStatusLocally(entryId, 'unread');
        console.error('Failed to mark entry as read on open', e);
      });
    },
    [markEntryStatus, updateEntryStatusLocally],
  );

  const markSelectedEntryReadForExternalLink = useCallback(() => {
    const current = selectedEntryRef.current;
    if (!current || (current.status ?? 'unread') !== 'unread') return;

    updateEntryStatusLocally(current.id, 'read');

    void markEntryStatusKeepalive([current.id], 'read').catch((e) => {
      updateEntryStatusLocally(current.id, 'unread');
      console.error('Failed to mark entry as read for external link', e);
    });
  }, [markEntryStatusKeepalive, updateEntryStatusLocally]);

  const markCurrentScopeAsRead = useCallback(async () => {
    if (searchMode || isStarredView) {
      const unreadEntryIds = entriesRef.current
        .filter((entry) => (entry.status ?? 'unread') === 'unread')
        .map((entry) => entry.id);

      if (unreadEntryIds.length === 0) return;
      await markEntryStatus(unreadEntryIds, 'read');
      return;
    }

    if (selectedCategoryId !== null) {
      await fetchJson<{ ok: true }>('/api/entries/mark-all-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'category',
          category_id: selectedCategoryId,
        }),
      });
      return;
    }

    await fetchJson<{ ok: true }>('/api/entries/mark-all-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'user' }),
    });
  }, [isStarredView, markEntryStatus, searchMode, selectedCategoryId]);

  const setEntryStatusById = useCallback(
    async (entryId: number, status: 'read' | 'unread'): Promise<boolean> => {
      if (isUpdatingStatusRef.current) return false;
      isUpdatingStatusRef.current = true;
      setIsUpdatingStatus(true);
      setError(null);
      try {
        await markEntryStatus([entryId], status);
        await Promise.all([
          reloadCurrentEntries(),
          loadFeeds(),
          loadCategories(),
        ]);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update status');
        return false;
      } finally {
        isUpdatingStatusRef.current = false;
        setIsUpdatingStatus(false);
      }
    },
    [loadCategories, loadFeeds, markEntryStatus, reloadCurrentEntries],
  );

  const markCurrentPageAsRead = useCallback(async (): Promise<boolean> => {
    if (isUpdatingStatusRef.current) return false;

    isUpdatingStatusRef.current = true;
    setIsUpdatingStatus(true);
    setError(null);

    try {
      await markCurrentScopeAsRead();
      await Promise.all([
        reloadCurrentEntries(),
        loadFeeds(),
        loadCategories(),
      ]);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to mark page as read');
      return false;
    } finally {
        isUpdatingStatusRef.current = false;
        setIsUpdatingStatus(false);
      }
  }, [
    loadCategories,
    loadFeeds,
    markCurrentScopeAsRead,
    reloadCurrentEntries,
  ]);

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
      await Promise.all([reloadCurrentEntries(), refreshStarredCount()]);
      if (activeModal === 'menu' || isStarredView) {
        await loadStarredEntries();
      }
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
        await refreshStarredCount();
        if (activeModal === 'menu' || isStarredView) {
          await loadStarredEntries();
        }
        if (isStarredView) {
          await reloadCurrentEntries();
        }
      } catch (e) {
        console.error('Failed to toggle entry star', e);
      }
    },
    [
      activeModal,
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
      await Promise.all([loadFeeds(), loadCategories(), refreshAllCount()]);
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
      await Promise.all([loadCategories(), refreshAllCount()]);
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
      await Promise.all([loadCategories(), loadFeeds(), refreshAllCount()]);
      if (selectedCategoryId === categoryId) {
        setSelectedCategoryId(null);
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

      // Success: refresh feeds/categories so global visibility and unread totals stay in sync.
      await Promise.all([loadFeeds(), loadCategories(), refreshAllCount()]);
      await reloadCurrentEntries();
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
      await Promise.all([loadCategories(), refreshAllCount()]);
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
      await Promise.all([loadFeeds(), loadCategories(), refreshAllCount()]);
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

  const handleSelectUnread = useCallback(() => {
    setIsSearchOpen(false);
    setSearchQuery('');
    setSearchMode(false);
    setSelectedCategoryId(null);
    setIsStarredView(false);
    setStatusFilter('unread');
  }, []);

  const handleSelectAll = useCallback(() => {
    setIsSearchOpen(false);
    setSearchQuery('');
    setSearchMode(false);
    setSelectedCategoryId(null);
    setIsStarredView(false);
    setStatusFilter('all');
  }, []);

  const handleSelectStarred = useCallback(() => {
    // Starred view is exclusive from search/category filters.
    setIsSearchOpen(false);
    setSearchQuery('');
    setSearchMode(false);
    setSelectedCategoryId(null);
    setIsStarredView(true);
  }, []);

  const handleSelectCategory = useCallback((categoryId: number) => {
    setIsSearchOpen(false);
    setSearchQuery('');
    setSearchMode(false);
    setIsStarredView(false);
    setSelectedCategoryId(categoryId);
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
      setSelectedCategoryId(null);
      return;
    }

    const win = getBrowserWindow();
    if (!win) return;
    const timeoutId = win.setTimeout(() => {
      setIsLoading(true);
      setError(null);
      setSelectedEntryId(null);
      loadEntries({
        append: false,
        offset: 0,
        limit: readerPreferences.entries_per_page,
      })
        .catch((e) =>
          setError(e instanceof Error ? e.message : 'Failed to search'),
        )
        .finally(() => setIsLoading(false));
    }, 250);

    return () => {
      win.clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    loadEntries,
    readerPreferences.entries_per_page,
    searchQuery,
    isSearchOpen,
    isProvisioned,
    searchMode,
  ]);

  const fetchOriginalArticle = useCallback(
    async (entryId?: number, options?: { force?: boolean }) => {
      const force = Boolean(options?.force);
      const targetEntry = entryId
        ? entriesRef.current.find((entry) => entry.id === entryId) ?? null
        : selectedEntryRef.current;

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
      isProvisioned,
      originalFetchStatusById,
      setEntries,
    ],
  );

  useEffect(() => {
    if (!isProvisioned || selectedEntryId === null) return;

    void fetchOriginalArticle(selectedEntryId);
    // Only auto-fetch when the selected entry changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProvisioned, selectedEntryId]);

  const handleEntrySelect = useCallback(
    (entryId: number) => {
      setSelectedEntryId(entryId);
      if (!isProvisioned) return;
      markEntryReadOnOpen(entryId);
    },
    [isProvisioned, markEntryReadOnOpen],
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

  const canSwipe =
    readerPreferences.entry_swipe &&
    selectedEntryId !== null &&
    activeModal === 'none';
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
    void (async () => {
      await loadReaderPreferences();
      await refreshAllData();
      hasInitialLoadRef.current = true;
    })();
  }, [isProvisioned, loadReaderPreferences, refreshAllData]);

  useEffect(() => {
    if (activeModal !== 'menu' || !isProvisioned) return;
    void loadStarredEntries();
  }, [activeModal, isProvisioned, loadStarredEntries]);

  // Reset entries when switching views or page-size preferences change.
  useEffect(() => {
    if (!isProvisioned || !hasInitialLoadRef.current) return;
    if (searchMode) return;
    setIsLoading(true);
    setError(null);
    setSelectedEntryId(null);
    resetEntries()
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setIsLoading(false));
  }, [
    selectedCategoryId,
    statusFilter,
    isStarredView,
    searchMode,
    isProvisioned,
    readerPreferences.entries_per_page,
    resetEntries,
    setIsLoading,
    setError,
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

      if (e.key === 'f' || e.key === 'F') {
        if (!selectedEntryRef.current) return;
        e.preventDefault();
        void toggleSelectedStar();
        return;
      }

      if (e.key === 'd' || e.key === 'D') {
        if (!selectedEntryRef.current) return;
        e.preventDefault();
        void fetchOriginalArticle(undefined, { force: true });
        return;
      }

      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        void (async () => {
          const ok = await markCurrentPageAsRead();
          if (!ok) return;
          toast(NOTIFICATION_COPY.app.articleMarked);
        })();
        return;
      }

      // ArrowDown, n, or j = next entry
      if (e.key === 'ArrowDown' || e.key === 'n' || e.key === 'j') {
        e.preventDefault();
        if (hasNext) navigateToNext();
      }
      // ArrowUp, p, or k = previous entry
      else if (e.key === 'ArrowUp' || e.key === 'p' || e.key === 'k') {
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
    {
      enabled: readerPreferences.keyboard_shortcuts,
      target: getBrowserWindow(),
    },
  );

  const isUnreadMode = !searchMode && !isStarredView && statusFilter === 'unread';
  const isAllMode = !searchMode && !isStarredView && statusFilter === 'all';
  const canLoadMore = total > entries.length;

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
              isUnreadView={isUnreadMode}
              isAllEntriesView={isAllMode}
              isStarredView={isStarredView}
              categoryUnreadCounts={categoryUnreadCounts}
              totalUnreadCount={totalUnreadCount}
              totalAllCount={totalAllCount}
              totalStarredCount={totalStarredCount}
              isLoading={isLoading}
              isSearchOpen={isSearchOpen}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              onToggleSearch={toggleSearch}
              onSelectUnread={handleSelectUnread}
              onSelectAll={handleSelectAll}
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
              isAllEntriesView={isAllMode}
              isStarredView={isStarredView}
            />

            <EntryPanel
              entry={selectedEntry}
              feedsById={feedsById}
              onClose={() => setSelectedEntryId(null)}
              onToggleStar={() => void toggleSelectedStar()}
              onOpenExternalLink={markSelectedEntryReadForExternalLink}
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
              showReadingTime={readerPreferences.show_reading_time}
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
