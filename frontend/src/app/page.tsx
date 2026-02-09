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
import { HeaderCategories } from '@/components/HeaderCategories/HeaderCategories';
import { MenuModal } from '@/components/MenuModal/MenuModal';
import { useKeydown } from '@/hooks/useKeydown';
import { fetchJson } from '@/app/_lib/fetchJson';
import type { Category, Entry, Feed } from '@/app/_lib/types';
import { useReaderData } from '@/hooks/useReaderData';
import { useUnreadCounters } from '@/hooks/useUnreadCounters';
import { fetchStarredEntries } from '@/lib/readerApi';
import { ENTRIES_PAGE_SIZE, INITIAL_ENTRIES_LIMIT } from '@/lib/entriesQuery';
import { NOTIFICATION_COPY } from '@/lib/notificationCopy';
import type { SocialPlatform } from '@/lib/social/types';
import { isLikelyYouTubeChannelInput, isYouTubeFeedUrl } from '@/lib/youtube';
import { isProtectedCategoryTitle, normalizeCategoryTitle } from '@/lib/protectedCategories';
import {
  hasRemoveClickbaitRule,
  mergeManagedFilterWordsIntoBlocklistRules,
  parseFilterWordsInput,
  parseManagedFilterWordsFromBlocklistRules,
  setRemoveClickbaitRule,
} from '@/lib/minifluxRules';

type PullState = 'idle' | 'pulling' | 'fetching' | 'done';
type StoriesWindowDays = 7 | 30 | 90;

const PULL_TRIGGER_PX = 70;
const PULL_MAX_PX = 90;
const DONE_HOLD_MS = 700;
const FETCH_INDICATOR_HEIGHT = 32;
const SWIPE_THRESHOLD_PX = 60;
const SWIPE_MAX_VERTICAL_PX = 50;
const STORIES_WINDOW_STORAGE_KEY = 'peace-rss-stories-window-days';
const DEFAULT_STORIES_WINDOW_DAYS: StoriesWindowDays = 30;
const GLOBAL_FILTER_WORDS_DEBOUNCE_MS = 450;

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
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null);
  const [selectedFeedId, setSelectedFeedId] = useState<number | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    null,
  );
  const [isStarredView, setIsStarredView] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState(false);
  const [storiesWindowDays, setStoriesWindowDays] =
    useState<StoriesWindowDays>(DEFAULT_STORIES_WINDOW_DAYS);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  const [isTogglingStar, setIsTogglingStar] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isProvisioned, setIsProvisioned] = useState(false);
  const [provisionError, setProvisionError] = useState<string | null>(null);
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [newYoutubeFeedUrl, setNewYoutubeFeedUrl] = useState('');
  const [addYoutubeFeedLoading, setAddYoutubeFeedLoading] = useState(false);
  const [addYoutubeFeedError, setAddYoutubeFeedError] = useState<string | null>(
    null,
  );
  const [newInstagramHandle, setNewInstagramHandle] = useState('');
  const [addInstagramFeedLoading, setAddInstagramFeedLoading] = useState(false);
  const [addInstagramFeedError, setAddInstagramFeedError] = useState<string | null>(
    null,
  );
  const [newTwitterHandle, setNewTwitterHandle] = useState('');
  const [addTwitterFeedLoading, setAddTwitterFeedLoading] = useState(false);
  const [addTwitterFeedError, setAddTwitterFeedError] = useState<string | null>(
    null,
  );
  const [newFeedPlatform, setNewFeedPlatform] = useState<'' | SocialPlatform>(
    '',
  );
  const [newFeedHandle, setNewFeedHandle] = useState('');
  const [newFeedLoginUsername, setNewFeedLoginUsername] = useState('');
  const [newFeedLoginPassword, setNewFeedLoginPassword] = useState('');
  const [newFeedCategoryId, setNewFeedCategoryId] = useState<number | null>(
    null,
  );
  const [addFeedLoading, setAddFeedLoading] = useState(false);
  const [addFeedError, setAddFeedError] = useState<string | null>(null);
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
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [returnToMenuAfterSubModal, setReturnToMenuAfterSubModal] =
    useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [pullState, setPullState] = useState<PullState>('idle');
  const [pullDistance, setPullDistance] = useState(0);
  const appRef = useRef<HTMLDivElement | null>(null);
  const pullDistanceRef = useRef(0);
  const startYRef = useRef<number | null>(null);
  const startXRef = useRef<number | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const isRefreshingRef = useRef(false);
  const doneTimeoutRef = useRef<number | null>(null);
  const globalFilterWordsDebounceRef = useRef<number | null>(null);
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

  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editType, setEditType] = useState<'feed' | 'category' | null>(null);
  const [editItemId, setEditItemId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editFeedUrl, setEditFeedUrl] = useState('');
  const [editCategoryId, setEditCategoryId] = useState<number | null>(null);
  const [editRemoveClickbait, setEditRemoveClickbait] = useState(false);
  const [editOriginalFeedLayout, setEditOriginalFeedLayout] = useState<
    'default' | 'youtube' | 'instagram' | 'twitter'
  >('default');
  const [isEditingProtectedCategory, setIsEditingProtectedCategory] =
    useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [globalFilterWords, setGlobalFilterWords] = useState('');
  const [isApplyingGlobalFilterWords, setIsApplyingGlobalFilterWords] =
    useState(false);
  const [globalFilterWordsError, setGlobalFilterWordsError] = useState<
    string | null
  >(null);

  useEffect(() => {
    const win = getBrowserWindow();
    if (!win) return;
    try {
      const stored = win.localStorage.getItem(STORIES_WINDOW_STORAGE_KEY);
      if (!stored) return;
      const parsed = Number(stored);
      if (parsed === 7 || parsed === 30 || parsed === 90) {
        setStoriesWindowDays(parsed);
      }
    } catch {
      // Ignore storage errors.
    }
  }, []);

  useEffect(() => {
    const win = getBrowserWindow();
    if (!win) return;
    try {
      win.localStorage.setItem(
        STORIES_WINDOW_STORAGE_KEY,
        String(storiesWindowDays),
      );
    } catch {
      // Ignore storage errors.
    }
  }, [storiesWindowDays]);

  const view = useMemo(
    () => ({
      searchMode,
      searchQuery,
      isStarredView,
      selectedFeedId,
      selectedCategoryId,
      storiesWindowDays,
    }),
    [
      searchMode,
      searchQuery,
      isStarredView,
      selectedFeedId,
      selectedCategoryId,
      storiesWindowDays,
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
    (nextEntries: Entry[], previousEntries: Entry[], originalIds: Set<number>) => {
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
    const win = getBrowserWindow();
    if (win && globalFilterWordsDebounceRef.current !== null) {
      win.clearTimeout(globalFilterWordsDebounceRef.current);
      globalFilterWordsDebounceRef.current = null;
    }

    const words = new Set<string>();
    for (const feed of feeds) {
      for (const word of parseManagedFilterWordsFromBlocklistRules(
        feed.blocklist_rules,
      )) {
        words.add(word);
      }
    }
    setGlobalFilterWords(Array.from(words).sort().join(', '));
    setGlobalFilterWordsError(null);

    setIsMenuModalOpen(true);
    setIsAddModalOpen(false);
    setIsEditModalOpen(false);
    setReturnToMenuAfterSubModal(false);
  }, [feeds]);

  const closeMenuModal = useCallback(() => {
    setIsMenuModalOpen(false);
    setReturnToMenuAfterSubModal(false);
  }, []);

  const openAddModal = useCallback(() => {
    setAddFeedError(null);
    setAddYoutubeFeedError(null);
    setAddInstagramFeedError(null);
    setAddTwitterFeedError(null);
    setIsAddModalOpen(true);
    setIsMenuModalOpen(false);
    setIsEditModalOpen(false);
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

  useEffect(() => {
    const win = getBrowserWindow();
    return () => {
      if (globalFilterWordsDebounceRef.current !== null && win) {
        win.clearTimeout(globalFilterWordsDebounceRef.current);
      }
    };
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
      setEditType(type);
      setEditItemId(item.id);
      setEditTitle(item.title);
      setIsEditingProtectedCategory(
        type === 'category' && isProtectedCategoryTitle(item.title),
      );
      if (type === 'feed') {
        const feed = item as Feed;
        setEditFeedUrl(feed.feed_url || '');
        const originalKind = feed.category?.title
          ? normalizeCategoryTitle(feed.category.title)
          : null;
        const originalLayout =
          originalKind && isProtectedCategoryTitle(originalKind)
            ? (originalKind as 'youtube' | 'instagram' | 'twitter')
            : feed.feed_url && isYouTubeFeedUrl(feed.feed_url)
              ? 'youtube'
              : 'default';

        setEditOriginalFeedLayout(originalLayout);
        setEditCategoryId(originalLayout === 'default' ? feed.category?.id || null : null);
        setEditRemoveClickbait(
          originalLayout === 'default'
            ? hasRemoveClickbaitRule(feed.rewrite_rules)
            : false,
        );
      } else {
        setEditOriginalFeedLayout('default');
      }
      setIsEditModalOpen(true);
      setIsMenuModalOpen(false);
      setReturnToMenuAfterSubModal(true);
      setEditError(null);
    },
    [],
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
    setEditRemoveClickbait(false);
    setEditOriginalFeedLayout('default');
    setIsEditingProtectedCategory(false);
    setEditError(null);
  }, [returnToMenuAfterSubModal]);

  const feedsById = useMemo(() => {
    const map = new Map<number, Feed>();
    for (const feed of feeds) map.set(feed.id, feed);
    return map;
  }, [feeds]);

  const editFeedLayout = useMemo(() => {
    if (editType !== 'feed') return 'default';
    if (editOriginalFeedLayout !== 'default') return editOriginalFeedLayout;
    return editFeedUrl.trim() && isYouTubeFeedUrl(editFeedUrl.trim())
      ? 'youtube'
      : 'default';
  }, [editFeedUrl, editOriginalFeedLayout, editType]);

  useEffect(() => {
    if (!isEditModalOpen) return;
    if (editType !== 'feed') return;
    if (editFeedLayout === 'default') return;
    if (editCategoryId !== null) setEditCategoryId(null);
    if (editRemoveClickbait) setEditRemoveClickbait(false);
  }, [
    editCategoryId,
    editRemoveClickbait,
    editType,
    isEditModalOpen,
    editFeedLayout,
  ]);

  const selectedCategoryLayout = useMemo(() => {
    if (searchMode || isStarredView) return 'default';
    if (selectedCategoryId === null) return 'default';
    const cat = categories.find((c) => c.id === selectedCategoryId);
    if (!cat) return 'default';
    const kind = normalizeCategoryTitle(cat.title);
    if (kind === 'youtube' || kind === 'instagram' || kind === 'twitter') {
      return kind;
    }
    return 'default';
  }, [categories, isStarredView, searchMode, selectedCategoryId]);

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
      const data = await fetchStarredEntries(50);
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
            entry.id === entryId ? { ...entry, starred: previousStarred } : entry,
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
    const trimmedSocialHandle = newFeedHandle.trim();
    const trimmedLoginUsername = newFeedLoginUsername.trim();
    const trimmedLoginPassword = newFeedLoginPassword.trim();
    const hasSocialInput = Boolean(newFeedPlatform && trimmedSocialHandle);

    if (!trimmedUrl && !hasSocialInput) {
      setAddFeedError(
        'Enter a feed URL, or choose a social platform and handle.'
      );
      return false;
    }

    if (
      (trimmedLoginUsername && !trimmedLoginPassword) ||
      (!trimmedLoginUsername && trimmedLoginPassword)
    ) {
      setAddFeedError(
        'Provide both login username and login password, or leave both empty.'
      );
      return false;
    }

    setAddFeedLoading(true);
    setAddFeedError(null);

    try {
      const requestBody: {
        feed_url?: string;
        category_id?: number;
        social?: {
          platform: SocialPlatform;
          handle: string;
          login_username?: string;
          login_password?: string;
        };
      } = {};

      if (hasSocialInput && newFeedPlatform) {
        requestBody.social = {
          platform: newFeedPlatform,
          handle: trimmedSocialHandle,
          login_username: trimmedLoginUsername || undefined,
          login_password: trimmedLoginPassword || undefined,
        };
      } else {
        requestBody.feed_url = trimmedUrl;
      }

      if (newFeedCategoryId && !isYouTubeFeedUrl(trimmedUrl) && !hasSocialInput) {
        requestBody.category_id = newFeedCategoryId;
      }

      await fetchJson<unknown>('/api/feeds/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      // Success: clear input and refresh feeds
      setNewFeedUrl('');
      setNewFeedPlatform('');
      setNewFeedHandle('');
      setNewFeedLoginUsername('');
      setNewFeedLoginPassword('');
      setNewFeedCategoryId(null);
      await Promise.all([loadFeeds(), loadCategories(), refreshUnreadCounters()]);
      return true;
    } catch (e) {
      setAddFeedError(e instanceof Error ? e.message : 'Failed to add feed');
      return false;
    } finally {
      setAddFeedLoading(false);
    }
  }

  async function addYoutubeFeed(e: React.FormEvent): Promise<boolean> {
    e.preventDefault();

    const trimmedUrl = newYoutubeFeedUrl.trim();
    if (!trimmedUrl) {
      setAddYoutubeFeedError('Enter a YouTube feed URL, channel URL, or handle.');
      return false;
    }
    if (!isLikelyYouTubeChannelInput(trimmedUrl)) {
      setAddYoutubeFeedError(
        'Enter a YouTube feed URL, channel URL, or handle (for example @channel).',
      );
      return false;
    }

    setAddYoutubeFeedLoading(true);
    setAddYoutubeFeedError(null);

    try {
      await fetchJson<unknown>('/api/feeds/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feed_url: trimmedUrl }),
      });
      setNewYoutubeFeedUrl('');
      await Promise.all([loadFeeds(), loadCategories(), refreshUnreadCounters()]);
      return true;
    } catch (e) {
      setAddYoutubeFeedError(
        e instanceof Error ? e.message : 'Failed to add feed',
      );
      return false;
    } finally {
      setAddYoutubeFeedLoading(false);
    }
  }

  async function addInstagramFeed(e: React.FormEvent): Promise<boolean> {
    e.preventDefault();

    const trimmedHandle = newInstagramHandle.trim();
    const trimmedLoginUsername = newFeedLoginUsername.trim();
    const trimmedLoginPassword = newFeedLoginPassword.trim();

    if (!trimmedHandle) {
      setAddInstagramFeedError('Enter an Instagram handle or profile URL.');
      return false;
    }

    if (
      (trimmedLoginUsername && !trimmedLoginPassword) ||
      (!trimmedLoginUsername && trimmedLoginPassword)
    ) {
      setAddInstagramFeedError(
        'Provide both login username and login password, or leave both empty.'
      );
      return false;
    }

    setAddInstagramFeedLoading(true);
    setAddInstagramFeedError(null);

    try {
      await fetchJson<unknown>('/api/feeds/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          social: {
            platform: 'instagram' as const,
            handle: trimmedHandle,
            login_username: trimmedLoginUsername || undefined,
            login_password: trimmedLoginPassword || undefined,
          },
        }),
      });
      setNewInstagramHandle('');
      await Promise.all([loadFeeds(), loadCategories(), refreshUnreadCounters()]);
      return true;
    } catch (e) {
      setAddInstagramFeedError(
        e instanceof Error ? e.message : 'Failed to add feed',
      );
      return false;
    } finally {
      setAddInstagramFeedLoading(false);
    }
  }

  async function addTwitterFeed(e: React.FormEvent): Promise<boolean> {
    e.preventDefault();

    const trimmedHandle = newTwitterHandle.trim();
    const trimmedLoginUsername = newFeedLoginUsername.trim();
    const trimmedLoginPassword = newFeedLoginPassword.trim();

    if (!trimmedHandle) {
      setAddTwitterFeedError('Enter a Twitter / X handle or profile URL.');
      return false;
    }

    if (
      (trimmedLoginUsername && !trimmedLoginPassword) ||
      (!trimmedLoginUsername && trimmedLoginPassword)
    ) {
      setAddTwitterFeedError(
        'Provide both login username and login password, or leave both empty.'
      );
      return false;
    }

    setAddTwitterFeedLoading(true);
    setAddTwitterFeedError(null);

    try {
      await fetchJson<unknown>('/api/feeds/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          social: {
            platform: 'twitter' as const,
            handle: trimmedHandle,
            login_username: trimmedLoginUsername || undefined,
            login_password: trimmedLoginPassword || undefined,
          },
        }),
      });
      setNewTwitterHandle('');
      await Promise.all([loadFeeds(), loadCategories(), refreshUnreadCounters()]);
      return true;
    } catch (e) {
      setAddTwitterFeedError(
        e instanceof Error ? e.message : 'Failed to add feed',
      );
      return false;
    } finally {
      setAddTwitterFeedLoading(false);
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
    if (editOriginalFeedLayout === 'youtube' && !isYouTubeFeedUrl(trimmedUrl)) {
      setEditError(
        'YouTube feeds must use a YouTube RSS URL (it should contain /feeds/videos.xml).',
      );
      return false;
    }

    setEditLoading(true);
    setEditError(null);

    try {
      await fetchJson<{ ok: boolean }>(`/api/feeds/${editItemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          editFeedLayout !== 'default'
            ? {
                title: trimmedTitle,
                feed_url: trimmedUrl,
              }
            : {
                title: trimmedTitle,
                feed_url: trimmedUrl,
                category_id: editCategoryId,
                rewrite_rules: setRemoveClickbaitRule(
                  feedsById.get(editItemId)?.rewrite_rules,
                  editRemoveClickbait,
                ),
              },
        ),
      });

      // Success: refresh feeds/categories (category may be created/forced server-side)
      await Promise.all([loadFeeds(), loadCategories(), refreshUnreadCounters()]);
      return true;
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Failed to update feed');
      return false;
    } finally {
      setEditLoading(false);
    }
  }

  const applyGlobalFilterWords = useCallback(
    async (input: string): Promise<boolean> => {
      const { words, invalid } = parseFilterWordsInput(input);
      const normalizedWords = words.join(', ');
      if (invalid.length > 0) {
        setGlobalFilterWordsError(
          `Invalid filter words: ${invalid.join(', ')}. Use letters, numbers, _ or -.`,
        );
        return false;
      }

      const existingWords = new Set<string>();
      for (const feed of feeds) {
        for (const word of parseManagedFilterWordsFromBlocklistRules(
          feed.blocklist_rules,
        )) {
          existingWords.add(word);
        }
      }
      const existingCanonical = Array.from(existingWords).sort().join(',');
      const nextCanonical = words.join(',');
      if (existingCanonical === nextCanonical) {
        setGlobalFilterWords(normalizedWords);
        setGlobalFilterWordsError(null);
        return true;
      }

      setIsApplyingGlobalFilterWords(true);
      setGlobalFilterWordsError(null);

      try {
        await Promise.all(
          feeds.map((feed) => {
            const blocklistRules = mergeManagedFilterWordsIntoBlocklistRules(
              feed.blocklist_rules,
              words,
            );
            return fetchJson<{ ok: boolean }>(`/api/feeds/${feed.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ blocklist_rules: blocklistRules }),
            });
          }),
        );

        await Promise.all([loadFeeds(), refreshUnreadCounters()]);
        setGlobalFilterWords((currentValue) => {
          const currentCanonical = parseFilterWordsInput(currentValue).words.join(
            ',',
          );
          return currentCanonical === nextCanonical
            ? normalizedWords
            : currentValue;
        });
        return true;
      } catch (e) {
        setGlobalFilterWordsError(
          e instanceof Error ? e.message : 'Failed to apply filter words',
        );
        return false;
      } finally {
        setIsApplyingGlobalFilterWords(false);
      }
    },
    [feeds, loadFeeds, refreshUnreadCounters],
  );

  const handleGlobalFilterWordsChange = useCallback(
    (value: string) => {
      setGlobalFilterWords(value);
      setGlobalFilterWordsError(null);

      const win = getBrowserWindow();
      if (!win) return;

      if (globalFilterWordsDebounceRef.current !== null) {
        win.clearTimeout(globalFilterWordsDebounceRef.current);
      }

      globalFilterWordsDebounceRef.current = win.setTimeout(() => {
        globalFilterWordsDebounceRef.current = null;
        void applyGlobalFilterWords(value);
      }, GLOBAL_FILTER_WORDS_DEBOUNCE_MS);
    },
    [applyGlobalFilterWords],
  );

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
        const result = await fetchJson<{ ok: boolean; content: string }>(
          `/api/entries/${targetEntry.id}/fetch-content`,
          { method: 'POST' },
        );

        if (result.ok && result.content) {
          // Update the entry in the entries array with the new content
          setEntries((prev) =>
            prev.map((e) =>
              e.id === targetEntry.id ? { ...e, content: result.content } : e,
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
        setFetchingOriginalEntryIds(new Set(fetchingOriginalEntryIdsRef.current));
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
    [canSwipe, isProvisioned, isLoading],
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
    [isProvisioned, isLoading, pullState],
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
            await refreshAllDataWithToast();
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
    [
      canSwipe,
      hasNext,
      hasPrev,
      navigateToNext,
      navigateToPrev,
      refreshAllDataWithToast,
    ],
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
    storiesWindowDays,
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
    if (isMenuModalOpen || isAddModalOpen || isEditModalOpen) return;

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
    isMenuModalOpen,
    isAddModalOpen,
    isEditModalOpen,
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
              isOpen={isMenuModalOpen}
              onClose={closeMenuModal}
              categories={categories}
              feeds={feeds}
              storiesWindowDays={storiesWindowDays}
              onStoriesWindowDaysChange={setStoriesWindowDays}
              openEditModal={openEditModal}
              openAddModal={openAddModal}
              isLoading={isLoading}
              globalFilterWords={globalFilterWords}
              onGlobalFilterWordsChange={handleGlobalFilterWordsChange}
              onApplyGlobalFilterWords={applyGlobalFilterWords}
              isApplyingGlobalFilterWords={isApplyingGlobalFilterWords}
              globalFilterWordsError={globalFilterWordsError}
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
              newYoutubeFeedUrl={newYoutubeFeedUrl}
              setNewYoutubeFeedUrl={setNewYoutubeFeedUrl}
              addYoutubeFeedLoading={addYoutubeFeedLoading}
              addYoutubeFeedError={addYoutubeFeedError}
              addYoutubeFeed={addYoutubeFeed}
              newInstagramHandle={newInstagramHandle}
              setNewInstagramHandle={setNewInstagramHandle}
              addInstagramFeedLoading={addInstagramFeedLoading}
              addInstagramFeedError={addInstagramFeedError}
              addInstagramFeed={addInstagramFeed}
              newTwitterHandle={newTwitterHandle}
              setNewTwitterHandle={setNewTwitterHandle}
              addTwitterFeedLoading={addTwitterFeedLoading}
              addTwitterFeedError={addTwitterFeedError}
              addTwitterFeed={addTwitterFeed}
              newFeedUrl={newFeedUrl}
              setNewFeedUrl={setNewFeedUrl}
              newFeedPlatform={newFeedPlatform}
              setNewFeedPlatform={setNewFeedPlatform}
              newFeedHandle={newFeedHandle}
              setNewFeedHandle={setNewFeedHandle}
              newFeedLoginUsername={newFeedLoginUsername}
              setNewFeedLoginUsername={setNewFeedLoginUsername}
              newFeedLoginPassword={newFeedLoginPassword}
              setNewFeedLoginPassword={setNewFeedLoginPassword}
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
              editRemoveClickbait={editRemoveClickbait}
              editFeedLayout={editFeedLayout}
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
              onChangeRemoveClickbait={setEditRemoveClickbait}
            />

            <HeaderCategories
              isMenuOpen={isMenuModalOpen}
              onOpenMenu={openMenuModal}
              isCategoriesOpen={isCategoriesOpen}
              onToggleCategories={toggleCategories}
              isOffline={isOffline}
              categories={categories}
              feeds={feeds}
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
              layout={selectedCategoryLayout}
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
