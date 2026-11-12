'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Show, RedirectToSignIn } from '@clerk/nextjs';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  DiscoveredFeed,
  Entry,
  Feed,
  ReaderPreferences,
  Tag,
} from '@/app/_lib/types';
import { useReaderData } from '@/hooks/useReaderData';
import { useReaderGestures } from '@/hooks/useReaderGestures';
import { fetchReaderPreferences, fetchStarredEntries } from '@/lib/readerApi';
import { DEFAULT_ENTRIES_PAGE_SIZE } from '@/lib/entriesQuery';
import { NOTIFICATION_COPY } from '@/lib/notificationCopy';
import {
  isProtectedCategoryTitle,
} from '@/lib/protectedCategories';
import { readerQueryKeys } from '@/lib/readerQueryKeys';

type ActiveModal = 'none' | 'menu' | 'add' | 'edit';

const DEFAULT_READER_PREFERENCES: ReaderPreferences = {
  id: 0,
  entries_per_page: DEFAULT_ENTRIES_PAGE_SIZE,
  keyboard_shortcuts: true,
  show_reading_time: true,
  entry_swipe: true,
};

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

function normalizeReaderPreferences(
  data: ReaderPreferences | undefined,
): ReaderPreferences {
  return {
    ...DEFAULT_READER_PREFERENCES,
    ...(data ?? {}),
    entries_per_page:
      data && data.entries_per_page > 0
        ? data.entries_per_page
        : DEFAULT_ENTRIES_PAGE_SIZE,
  };
}

export default function Home() {
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null);
  // Tags toggled on in the header; a post must have all of them.
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [statusFilter, setStatusFilter] = useState<'unread' | 'all'>('unread');
  const [isStarredView, setIsStarredView] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  const [isTogglingStar, setIsTogglingStar] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isProvisioned, setIsProvisioned] = useState(false);
  const [provisionError, setProvisionError] = useState<string | null>(null);
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [newFeedTagIds, setNewFeedTagIds] = useState<number[]>([]);
  const [addFeedLoading, setAddFeedLoading] = useState(false);
  const [addFeedError, setAddFeedError] = useState<string | null>(null);
  const [discoveredFeeds, setDiscoveredFeeds] = useState<DiscoveredFeed[]>([]);
  const [selectedDiscoveredFeedUrl, setSelectedDiscoveredFeedUrl] =
    useState('');
  const [newTagTitle, setNewTagTitle] = useState('');
  const [addTagLoading, setAddTagLoading] = useState(false);
  const [addTagError, setAddTagError] = useState<string | null>(null);
  const fetchingOriginalEntryIdsRef = useRef<Set<number>>(new Set());
  const [fetchingOriginalEntryIds, setFetchingOriginalEntryIds] = useState<
    Set<number>
  >(new Set());
  const [originalFetchStatusById, setOriginalFetchStatusById] = useState<
    Record<number, 'success' | 'error'>
  >({});
  const [activeModal, setActiveModal] = useState<ActiveModal>('none');
  const [isOffline, setIsOffline] = useState(false);

  // Edit modal form state
  const [editType, setEditType] = useState<'feed' | 'tag' | null>(null);
  const [editItemId, setEditItemId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editFeedUrl, setEditFeedUrl] = useState('');
  const [editTagIds, setEditTagIds] = useState<number[]>([]);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const queryClient = useQueryClient();
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

  const starredEntriesQuery = useQuery({
    queryKey: readerQueryKeys.starredEntries(readerPreferences.entries_per_page),
    enabled: readerDataEnabled && activeModal === 'menu',
    queryFn: ({ signal }) =>
      fetchStarredEntries(readerPreferences.entries_per_page, { signal }),
  });
  const starredEntries = starredEntriesQuery.data?.entries ?? [];

  const view = useMemo(
    () => ({
      searchMode,
      searchQuery: activeSearchQuery,
      isStarredView,
      selectedTagIds,
      statusFilter,
    }),
    [
      searchMode,
      activeSearchQuery,
      isStarredView,
      selectedTagIds,
      statusFilter,
    ],
  );

  const {
    feeds,
    tags,
    counts,
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

  // Tags a person can put on a feed: their own, minus the managed
  // Instagram/Twitter ones. Automatic tags belong to posts, not feeds.
  const assignableTags = useMemo(
    () =>
      tags.filter(
        (tag) => tag.kind === 'manual' && !isProtectedCategoryTitle(tag.title),
      ),
    [tags],
  );

  const resetAddModalForm = useCallback(() => {
    setNewTagTitle('');
    setAddTagError(null);
    setNewFeedUrl('');
    setNewFeedTagIds([]);
    setAddFeedError(null);
    setDiscoveredFeeds([]);
    setSelectedDiscoveredFeedUrl('');
  }, []);

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
    setEditTagIds([]);
    setEditError(null);
  }, []);

  const openEditModal = useCallback(
    (type: 'feed' | 'tag', item: Feed | Tag) => {
      if (type === 'tag') {
        const tag = item as Tag;
        if (tag.kind === 'auto' || isProtectedCategoryTitle(tag.title)) {
          toast.error('This tag is managed automatically.');
          return;
        }
      }
      resetEditModalForm();
      setEditType(type);
      setEditItemId(item.id);
      setEditTitle(item.title);
      if (type === 'feed') {
        const feed = item as Feed;
        setEditFeedUrl(feed.feed_url || '');
        setEditTagIds(feed.tag_ids ?? []);
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

  // Header: the person's own tags, then the automatic ones that
  // currently match at least one post.
  const headerTags = useMemo(
    () => tags.filter((tag) => tag.kind === 'manual' || tag.has_entries),
    [tags],
  );

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
        .then(() => {
          // Keep the post in the loaded list (as read) so the open
          // panel stays open; only the counts need re-reading.
          setEntries((prev) =>
            prev.map((entry) =>
              entry.id === entryId ? { ...entry, status: 'read' } : entry,
            ),
          );
          return Promise.all([
            queryClient.invalidateQueries({ queryKey: readerQueryKeys.tags }),
            queryClient.invalidateQueries({ queryKey: readerQueryKeys.feeds }),
          ]);
        })
        .catch((e) => {
          console.error('Failed to mark entry as read on open', e);
        });
    },
    [markEntryStatus, queryClient, setEntries],
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

    // Everything unread in the current view: the selected tags, or
    // without tags the whole main list.
    await fetchJson<{ ok: true }>('/api/entries/mark-all-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_ids: selectedTagIds }),
    });
  }, [isStarredView, markEntryStatus, searchMode, selectedTagIds]);

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

  async function addFeed(e: React.FormEvent): Promise<boolean> {
    e.preventDefault();

    const trimmedUrl = newFeedUrl.trim();
    const trimmedSelectedFeedUrl = selectedDiscoveredFeedUrl.trim();
    if (!trimmedUrl && !trimmedSelectedFeedUrl) {
      setAddFeedError('Enter a feed URL.');
      return false;
    }

    setAddFeedLoading(true);
    setAddFeedError(null);

    try {
      const requestBody: {
        feed_url?: string;
        selected_feed_url?: string;
        tag_ids: number[];
      } = { tag_ids: newFeedTagIds };
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

      setNewFeedUrl('');
      setNewFeedTagIds([]);
      setDiscoveredFeeds([]);
      setSelectedDiscoveredFeedUrl('');
      await invalidateReaderData();
      return true;
    } catch (e) {
      setAddFeedError(e instanceof Error ? e.message : 'Failed to add feed');
      return false;
    } finally {
      setAddFeedLoading(false);
    }
  }

  async function addTag(e: React.FormEvent): Promise<boolean> {
    e.preventDefault();

    const trimmedTitle = newTagTitle.trim();
    if (!trimmedTitle) return false;

    setAddTagLoading(true);
    setAddTagError(null);

    try {
      await fetchJson<unknown>('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmedTitle }),
      });

      setNewTagTitle('');
      await invalidateReaderData();
      return true;
    } catch (e) {
      setAddTagError(e instanceof Error ? e.message : 'Failed to add tag');
      return false;
    } finally {
      setAddTagLoading(false);
    }
  }

  async function deleteTag(tagId: number): Promise<boolean> {
    setIsLoading(true);
    setError(null);

    try {
      await fetchJson<{ ok: boolean }>(`/api/tags/${tagId}`, {
        method: 'DELETE',
      });

      setSelectedTagIds((prev) => prev.filter((id) => id !== tagId));
      await invalidateReaderData();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete tag');
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

  async function updateTag(e: React.FormEvent): Promise<boolean> {
    e.preventDefault();

    if (!editItemId) return false;

    const trimmedTitle = editTitle.trim();
    if (!trimmedTitle) return false;

    setEditLoading(true);
    setEditError(null);

    try {
      await fetchJson<{ ok: boolean }>(`/api/tags/${editItemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmedTitle }),
      });

      await invalidateReaderData();
      return true;
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Failed to update tag');
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
      const requestBody = {
        title: trimmedTitle,
        feed_url: trimmedUrl,
        tag_ids: editTagIds,
      };

      await fetchJson<{ ok: boolean }>(`/api/feeds/${editItemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      await invalidateReaderData();
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
        setActiveSearchQuery('');
        setSearchMode(false);
      }
      return next;
    });
  }, []);

  const toggleCategories = useCallback(() => {
    setIsCategoriesOpen((prev) => !prev);
  }, []);

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
    setSearchQuery('');
    setActiveSearchQuery('');
    setSearchMode(false);
  }, []);

  // Unread and All switch the status and keep the selected tags.
  const handleSelectUnread = useCallback(() => {
    closeSearch();
    setIsStarredView(false);
    setStatusFilter('unread');
  }, [closeSearch]);

  const handleSelectAll = useCallback(() => {
    closeSearch();
    setIsStarredView(false);
    setStatusFilter('all');
  }, [closeSearch]);

  const handleSelectStarred = useCallback(() => {
    // Starred view is exclusive from search/tag filters.
    closeSearch();
    setSelectedTagIds([]);
    setIsStarredView(true);
  }, [closeSearch]);

  // Tags are toggles: several can be on at once and narrow the list
  // to posts that have all of them.
  const handleToggleTag = useCallback((tagId: number) => {
    setIsStarredView(false);
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
    );
  }, []);

  const handleToggleEntryTag = useCallback(
    async (entryId: number, tagId: number, on: boolean) => {
      try {
        const result = await fetchJson<{ ok: boolean; tag_ids: number[] }>(
          `/api/entries/${entryId}/tags`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tag_id: tagId, on }),
          },
        );
        setEntries((prev) =>
          prev.map((entry) =>
            entry.id === entryId
              ? { ...entry, tag_ids: result.tag_ids }
              : entry,
          ),
        );
        await queryClient.invalidateQueries({ queryKey: readerQueryKeys.tags });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to update tags');
      }
    },
    [queryClient, setEntries],
  );

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
          tag_ids?: number[];
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
                    tag_ids: result.tag_ids ?? e.tag_ids,
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

  // Bootstrap on mount
  useEffect(() => {
    void bootstrap();
  }, []);

  // Query keys reload entries; selection only needs clearing.
  useEffect(() => {
    if (!readerDataEnabled) return;
    setSelectedEntryId(null);
  }, [
    activeSearchQuery,
    selectedTagIds,
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

  // The selected tags live in the URL (?tags=games,review) so a
  // combination can be bookmarked and survives a reload.
  const didReadTagsFromUrlRef = useRef(false);
  useEffect(() => {
    if (didReadTagsFromUrlRef.current || tags.length === 0) return;
    didReadTagsFromUrlRef.current = true;
    const slugs = (searchParams.get('tags') ?? '')
      .split(',')
      .map((slug) => slug.trim())
      .filter(Boolean);
    if (slugs.length === 0) return;
    const ids = slugs
      .map((slug) => tags.find((tag) => tag.slug === slug)?.id)
      .filter((id): id is number => typeof id === 'number');
    if (ids.length > 0) setSelectedTagIds(ids);
  }, [searchParams, tags]);

  useEffect(() => {
    if (!didReadTagsFromUrlRef.current) return;
    const slugs = selectedTagIds
      .map((id) => tags.find((tag) => tag.id === id)?.slug)
      .filter((slug): slug is string => Boolean(slug));
    const next = slugs.join(',');
    if ((searchParams.get('tags') ?? '') === next) return;

    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set('tags', next);
    else params.delete('tags');
    const qs = params.toString().replace(/%2C/g, ',');
    router.replace(qs ? `/?${qs}` : '/', { scroll: false });
  }, [router, searchParams, selectedTagIds, tags]);

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
              tags={tags}
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
              tags={assignableTags}
              newTagTitle={newTagTitle}
              setNewTagTitle={setNewTagTitle}
              addTagLoading={addTagLoading}
              addTagError={addTagError}
              addTag={addTag}
              newFeedUrl={newFeedUrl}
              setNewFeedUrl={handleSetNewFeedUrl}
              newFeedTagIds={newFeedTagIds}
              setNewFeedTagIds={setNewFeedTagIds}
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
              tags={assignableTags}
              editTitle={editTitle}
              editFeedUrl={editFeedUrl}
              editTagIds={editTagIds}
              editLoading={editLoading}
              editError={editError}
              onClose={closeEditModal}
              onDeleteTag={deleteTag}
              onDeleteFeed={deleteFeed}
              onUpdateTag={updateTag}
              onUpdateFeed={updateFeed}
              onChangeTitle={setEditTitle}
              onChangeFeedUrl={setEditFeedUrl}
              onChangeTagIds={setEditTagIds}
            />

            <TheHeader
              isMenuOpen={activeModal === 'menu'}
              onOpenMenu={openMenuModal}
              isCategoriesOpen={isCategoriesOpen}
              onToggleCategories={toggleCategories}
              isOffline={isOffline}
              tags={headerTags}
              selectedTagIds={selectedTagIds}
              isUnreadView={isUnreadMode}
              isAllEntriesView={isAllMode}
              isStarredView={isStarredView}
              totalUnreadCount={counts.unread}
              totalAllCount={counts.all}
              totalStarredCount={counts.starred}
              isLoading={isLoading}
              isSearchOpen={isSearchOpen}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              onToggleSearch={toggleSearch}
              onSelectUnread={handleSelectUnread}
              onSelectAll={handleSelectAll}
              onSelectStarred={handleSelectStarred}
              onToggleTag={handleToggleTag}
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
              tags={tags}
              onToggleTag={(tagId, on) => {
                if (!selectedEntry) return;
                void handleToggleEntryTag(selectedEntry.id, tagId, on);
              }}
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
