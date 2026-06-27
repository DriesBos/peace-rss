'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Show, RedirectToSignIn } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import styles from './page.module.sass';
import { AddModal, type AddFeedPayload } from '@/components/AddModal/AddModal';
import {
  EditModal,
  type EditTarget,
  type UpdateCategoryPayload,
  type UpdateFeedPayload,
} from '@/components/EditModal/EditModal';
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
} from '@/app/_lib/types';
import { useReaderData } from '@/hooks/useReaderData';
import { useReaderGestures } from '@/hooks/useReaderGestures';
import {
  fetchAllCount,
  fetchReaderPreferences,
  fetchStarredEntries,
  fetchStarredCount,
} from '@/lib/readerApi';
import { NOTIFICATION_COPY } from '@/lib/notificationCopy';
import {
  isProtectedCategoryTitle,
} from '@/lib/protectedCategories';
import { normalizeReaderPreferences } from '@/lib/readerPrefs';
import { readerQueryKeys } from '@/lib/readerQueryKeys';

type ActiveModal = 'none' | 'menu' | 'add' | 'edit';

const getBrowserWindow = (): Window | null => {
  if (typeof window === 'undefined') return null;
  return window;
};

const getBrowserNavigator = (): Navigator | null => {
  if (typeof navigator === 'undefined') return null;
  return navigator;
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

export function ReaderApp({
  initialProvisioned,
}: {
  initialProvisioned: boolean;
}) {
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    null,
  );
  const [statusFilter, setStatusFilter] = useState<'unread' | 'all'>('unread');
  const [isStarredView, setIsStarredView] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  const [isTogglingStar, setIsTogglingStar] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isProvisioned, setIsProvisioned] = useState(initialProvisioned);
  const [provisionError, setProvisionError] = useState<string | null>(null);
  const fetchingOriginalEntryIdsRef = useRef<Set<number>>(new Set());
  const [fetchingOriginalEntryIds, setFetchingOriginalEntryIds] = useState<
    Set<number>
  >(new Set());
  const [originalFetchStatusById, setOriginalFetchStatusById] = useState<
    Record<number, 'success' | 'error'>
  >({});
  const [activeModal, setActiveModal] = useState<ActiveModal>('none');
  const [isOffline, setIsOffline] = useState(false);

  // Edit modal target (the modal owns its own form state)
  const [editTarget, setEditTarget] = useState<EditTarget>(null);

  const readerPreferencesQuery = useQuery({
    queryKey: readerQueryKeys.preferences,
    enabled: isProvisioned,
    queryFn: ({ signal }) => fetchReaderPreferences({ signal }),
  });
  const readerPreferences = useMemo(
    () => normalizeReaderPreferences(readerPreferencesQuery.data),
    [readerPreferencesQuery.data],
  );
  const readerDataEnabled = isProvisioned && !readerPreferencesQuery.isPending;

  useEffect(() => {
    if (readerPreferencesQuery.error) {
      console.error('Failed to load reader preferences', readerPreferencesQuery.error);
    }
  }, [readerPreferencesQuery.error]);

  const allCountQuery = useQuery({
    queryKey: readerQueryKeys.allCount,
    enabled: readerDataEnabled,
    queryFn: ({ signal }) => fetchAllCount({ signal }),
  });
  const starredCountQuery = useQuery({
    queryKey: readerQueryKeys.starredCount,
    enabled: readerDataEnabled,
    queryFn: ({ signal }) => fetchStarredCount({ signal }),
  });
  const starredEntriesQuery = useQuery({
    queryKey: readerQueryKeys.starredEntries(readerPreferences.entries_per_page),
    enabled: readerDataEnabled && activeModal === 'menu',
    queryFn: ({ signal }) =>
      fetchStarredEntries(readerPreferences.entries_per_page, { signal }),
  });
  const totalAllCount = allCountQuery.data?.total ?? 0;
  const totalStarredCount = starredCountQuery.data?.total ?? 0;
  const starredEntries = starredEntriesQuery.data?.entries ?? [];

  const view = useMemo(
    () => ({
      searchMode,
      searchQuery: activeSearchQuery,
      isStarredView,
      selectedCategoryId,
      statusFilter,
    }),
    [
      searchMode,
      activeSearchQuery,
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
    setIsLoading,
    setError,
    loadMore,
    refreshAll,
    invalidateReaderData,
  } = useReaderData({
    isProvisioned: readerDataEnabled,
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

  const openAddModal = useCallback(() => {
    setActiveModal('add');
  }, []);

  const closeAddModal = useCallback(() => {
    setActiveModal('menu');
  }, []);

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

  const openEditModal = useCallback(
    (type: 'feed' | 'category', item: Feed | Category) => {
      if (type === 'category' && isProtectedCategoryTitle(item.title)) {
        toast.error('This category is managed automatically.');
        return;
      }

      setEditTarget(
        type === 'feed'
          ? { type, item: item as Feed }
          : { type, item: item as Category },
      );
      setActiveModal('edit');
    },
    [],
  );

  const closeEditModal = useCallback(() => {
    setEditTarget(null);
    setActiveModal('menu');
  }, []);

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

  const syncSelection = useCallback((nextEntries: Entry[]) => {
    setSelectedEntryId((prev) =>
      prev && nextEntries.some((entry) => entry.id === prev) ? prev : null,
    );
  }, []);

  const refreshAllData = useCallback(async (): Promise<boolean> => {
    const data = await refreshAll();
    if (data?.entries) {
      syncSelection(data.entries);
    }
    return data !== null;
  }, [refreshAll, syncSelection]);

  const refreshAllDataWithToast = useCallback(async () => {
    const didSucceed = await refreshAllData();
    if (didSucceed) {
      toast(NOTIFICATION_COPY.app.feedRefreshed);
    } else {
      toast.error(NOTIFICATION_COPY.app.feedRefreshFailed);
    }
    return didSucceed;
  }, [refreshAllData]);

  const handleLoadMore = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await loadMore();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load more');
    } finally {
      setIsLoading(false);
    }
  }, [loadMore, setError, setIsLoading]);

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

  const markEntryReadOnOpen = useCallback(
    (entryId: number) => {
      const current = entriesRef.current.find((entry) => entry.id === entryId);
      if (!current || (current.status ?? 'unread') !== 'unread') return;

      void markEntryStatus([entryId], 'read')
        .then(() => invalidateReaderData())
        .catch((e) => {
          console.error('Failed to mark entry as read on open', e);
        });
    },
    [invalidateReaderData, markEntryStatus],
  );

  const markSelectedEntryReadForExternalLink = useCallback(() => {
    const current = selectedEntryRef.current;
    if (!current || (current.status ?? 'unread') !== 'unread') return;

    void markEntryStatusKeepalive([current.id], 'read')
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        return invalidateReaderData();
      })
      .catch((e) => {
        console.error('Failed to mark entry as read for external link', e);
      });
  }, [invalidateReaderData, markEntryStatusKeepalive]);

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
        await invalidateReaderData();
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update status');
        return false;
      } finally {
        isUpdatingStatusRef.current = false;
        setIsUpdatingStatus(false);
      }
    },
    [invalidateReaderData, markEntryStatus, setError],
  );

  const markCurrentPageAsRead = useCallback(async (): Promise<boolean> => {
    if (isUpdatingStatusRef.current) return false;

    isUpdatingStatusRef.current = true;
    setIsUpdatingStatus(true);
    setError(null);

    try {
      await markCurrentScopeAsRead();
      await invalidateReaderData();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to mark page as read');
      return false;
    } finally {
      isUpdatingStatusRef.current = false;
      setIsUpdatingStatus(false);
    }
  }, [invalidateReaderData, markCurrentScopeAsRead, setError]);

  async function toggleSelectedStar() {
    const current = selectedEntryRef.current;
    if (!current) return;
    if (isTogglingStar) return;

    setIsTogglingStar(true);
    setError(null);

    try {
      await fetchJson<{ ok: true }>(`/api/entries/${current.id}/star`, {
        method: 'POST',
      });
      await invalidateReaderData();
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
        await invalidateReaderData();
      } catch (e) {
        console.error('Failed to toggle entry star', e);
      }
    },
    [invalidateReaderData],
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

  useEffect(() => {
    if (isProvisioned) return;
    void bootstrap();
    // Bootstrap should run only until the server/client provisioned flag is true.
  }, [isProvisioned]);

  async function addFeed(
    payload: AddFeedPayload,
  ): Promise<
    | { ok: true }
    | {
        ok: false;
        error: string;
        discoveredFeeds?: DiscoveredFeed[];
        selectedDiscoveredFeedUrl?: string;
      }
  > {
    const trimmedUrl = payload.feedUrl.trim();
    const trimmedSelectedFeedUrl = payload.selectedFeedUrl.trim();
    if (!trimmedUrl && !trimmedSelectedFeedUrl) {
      return { ok: false, error: 'Enter a feed URL.' };
    }
    if (!payload.categoryId) {
      return { ok: false, error: 'Choose a category.' };
    }

    try {
      const requestBody: {
        feed_url?: string;
        selected_feed_url?: string;
        category_id: number;
      } = { category_id: payload.categoryId };
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
          return {
            ok: false,
            error:
              'No discoverable feeds found for this URL. Please try another URL.',
          };
        }

        return {
          ok: false,
          error:
            response.notice ??
            (subscriptions.length > 1
              ? 'Multiple feeds found. Choose one, then submit again.'
              : 'No exact URL match was found. Review the suggested feed and submit again to confirm.'),
          discoveredFeeds: subscriptions,
          selectedDiscoveredFeedUrl: subscriptions[0]?.url ?? '',
        };
      }

      await invalidateReaderData();
      return { ok: true };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : 'Failed to add feed',
      };
    }
  }

  async function addCategory(title: string): Promise<boolean> {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return false;

    try {
      await fetchJson<unknown>('/api/categories/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmedTitle }),
      });

      await invalidateReaderData();
      return true;
    } catch (e) {
      console.error('Failed to add category', e);
      return false;
    }
  }

  async function deleteCategory(categoryId: number): Promise<boolean> {
    const category = categories.find((cat) => cat.id === categoryId);
    if (category && isProtectedCategoryTitle(category.title)) {
      toast.error('This category is managed automatically.');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      await fetchJson<{ ok: boolean }>(`/api/categories/${categoryId}`, {
        method: 'DELETE',
      });

      if (selectedCategoryId === categoryId) {
        setSelectedCategoryId(null);
      }
      await invalidateReaderData();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete category');
      return false;
    } finally {
      setIsLoading(false);
    }
  }

  async function deleteFeed(feedId: number): Promise<boolean> {
    setIsLoading(true);
    setError(null);

    try {
      await fetchJson<{ ok: boolean }>(`/api/feeds/${feedId}`, {
        method: 'DELETE',
      });

      await invalidateReaderData();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete feed');
      return false;
    } finally {
      setIsLoading(false);
    }
  }

  async function updateCategory(
    payload: UpdateCategoryPayload,
  ): Promise<boolean> {
    if (!payload.id) return false;

    const trimmedTitle = payload.title.trim();
    if (!trimmedTitle) return false;

    try {
      await fetchJson<{ ok: boolean }>(`/api/categories/${payload.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmedTitle }),
      });

      await invalidateReaderData();
      return true;
    } catch (e) {
      console.error('Failed to update category', e);
      return false;
    }
  }

  async function updateFeed(payload: UpdateFeedPayload): Promise<boolean> {
    if (!payload.id) return false;

    const trimmedTitle = payload.title.trim();
    const trimmedUrl = payload.feedUrl.trim();

    if (!trimmedTitle || !trimmedUrl) return false;

    try {
      const requestBody: {
        title: string;
        feed_url: string;
        category_id?: number;
      } = {
        title: trimmedTitle,
        feed_url: trimmedUrl,
      };
      if (payload.categoryId !== null) {
        requestBody.category_id = payload.categoryId;
      }

      await fetchJson<{ ok: boolean }>(`/api/feeds/${payload.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      await invalidateReaderData();
      return true;
    } catch (e) {
      console.error('Failed to update feed', e);
      return false;
    }
  }

  const toggleSearch = useCallback(() => {
    setIsSearchOpen((prev) => {
      const next = !prev;
      if (!next) {
        setSearchQuery('');
        setActiveSearchQuery('');
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
    setActiveSearchQuery('');
    setSearchMode(false);
    setSelectedCategoryId(null);
    setIsStarredView(false);
    setStatusFilter('unread');
  }, []);

  const handleSelectAll = useCallback(() => {
    setIsSearchOpen(false);
    setSearchQuery('');
    setActiveSearchQuery('');
    setSearchMode(false);
    setSelectedCategoryId(null);
    setIsStarredView(false);
    setStatusFilter('all');
  }, []);

  const handleSelectStarred = useCallback(() => {
    // Starred view is exclusive from search/category filters.
    setIsSearchOpen(false);
    setSearchQuery('');
    setActiveSearchQuery('');
    setSearchMode(false);
    setSelectedCategoryId(null);
    setIsStarredView(true);
  }, []);

  const handleSelectCategory = useCallback((categoryId: number) => {
    setIsSearchOpen(false);
    setSearchQuery('');
    setActiveSearchQuery('');
    setSearchMode(false);
    setIsStarredView(false);
    setSelectedCategoryId(categoryId);
  }, []);

  useEffect(() => {
    if (!readerDataEnabled || !isSearchOpen) return;

    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) {
      setActiveSearchQuery('');
      setSearchMode(false);
      return;
    }

    const win = getBrowserWindow();
    if (!win) return;
    const timeoutId = win.setTimeout(() => {
      setSearchMode(true);
      setIsStarredView(false);
      setSelectedCategoryId(null);
      setSelectedEntryId(null);
      setActiveSearchQuery(trimmedQuery);
    }, 250);

    return () => {
      win.clearTimeout(timeoutId);
    };
  }, [isSearchOpen, readerDataEnabled, searchQuery]);

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
          preview?: string;
          thumbnail_url?: string;
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
                    preview: result.preview,
                    thumbnail_url: result.thumbnail_url,
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
      setError,
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

  // Query keys reload entries; selection only needs clearing.
  useEffect(() => {
    if (!readerDataEnabled) return;
    setSelectedEntryId(null);
  }, [
    activeSearchQuery,
    selectedCategoryId,
    statusFilter,
    isStarredView,
    searchMode,
    readerDataEnabled,
    readerPreferences.entries_per_page,
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
      <Show when="signed-in">
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
              defaultFeedCategoryId={defaultAddFeedCategoryId}
              onAddCategory={addCategory}
              onAddFeed={addFeed}
              isLoading={isLoading}
            />

            <EditModal
              isOpen={activeModal === 'edit'}
              target={editTarget}
              categories={categories}
              onClose={closeEditModal}
              onDeleteCategory={deleteCategory}
              onDeleteFeed={deleteFeed}
              onUpdateCategory={updateCategory}
              onUpdateFeed={updateFeed}
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
            />
          </div>
        )}
      </Show>

      <Show when="signed-out">
        <RedirectToSignIn />
      </Show>
    </>
  );
}
