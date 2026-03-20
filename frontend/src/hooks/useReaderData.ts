import { useCallback, useState } from 'react';
import type { Category, EntriesResponse, Entry, Feed } from '@/app/_lib/types';
import {
  buildEntriesUrl,
  DEFAULT_ENTRIES_PAGE_SIZE,
} from '@/lib/entriesQuery';
import { fetchCategories, fetchEntries, fetchFeeds } from '@/lib/readerApi';

export type ReaderView = {
  searchMode: boolean;
  searchQuery: string;
  isStarredView: boolean;
  selectedCategoryId: number | null;
  statusFilter: 'unread' | 'all';
};

type LoadEntriesOptions = {
  append?: boolean;
  offset?: number;
  limit?: number;
  status?: 'read' | 'unread' | 'all' | null;
  changedAfter?: number;
  publishedAfter?: number;
};

export function useReaderData({
  isProvisioned,
  view,
  pageSize = DEFAULT_ENTRIES_PAGE_SIZE,
}: {
  isProvisioned: boolean;
  view: ReaderView;
  pageSize?: number;
}) {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshingFeeds, setIsRefreshingFeeds] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);

  const loadFeeds = useCallback(async (): Promise<Feed[]> => {
    const data = await fetchFeeds();
    setFeeds(data);
    return data;
  }, []);

  const loadCategories = useCallback(async (): Promise<Category[]> => {
    const data = await fetchCategories();
    setCategories(data);
    return data;
  }, []);

  const fetchEntriesData = useCallback(
    async (options: LoadEntriesOptions = {}): Promise<EntriesResponse> => {
      const {
        offset = 0,
        limit = pageSize,
        status,
        changedAfter,
        publishedAfter: publishedAfterOverride,
      } = options;
      const effectiveStatus =
        status ??
        (view.searchMode || view.isStarredView
          ? null
          : view.statusFilter);
      const url = buildEntriesUrl({
        limit,
        offset,
        searchQuery: view.searchMode ? view.searchQuery : '',
        isStarredView: view.searchMode ? false : view.isStarredView,
        selectedCategoryId: view.searchMode ? null : view.selectedCategoryId,
        status: effectiveStatus,
        globallyVisible:
          !view.searchMode &&
          !view.isStarredView &&
          view.selectedCategoryId === null,
        changedAfter,
        publishedAfter: publishedAfterOverride,
      });
      return fetchEntries(url);
    },
    [pageSize, view]
  );

  const loadEntries = useCallback(
    async (options: LoadEntriesOptions = {}): Promise<EntriesResponse> => {
      const { append = false } = options;
      const data = await fetchEntriesData(options);
      setTotal(data.total ?? 0);

      if (append) {
        setEntries((prev) => [...prev, ...data.entries]);
      } else {
        setEntries(data.entries);
      }

      return data;
    },
    [fetchEntriesData]
  );

  const resetEntries = useCallback(async (): Promise<EntriesResponse> => {
    return loadEntries({
      append: false,
      offset: 0,
      limit: pageSize,
    });
  }, [loadEntries, pageSize]);

  const loadMore = useCallback(async (): Promise<EntriesResponse> => {
    return loadEntries({
      append: true,
      offset: entries.length,
      limit: pageSize,
    });
  }, [entries.length, loadEntries, pageSize]);

  const refreshAll = useCallback(
    async (extraTasks?: () => Promise<unknown>[]) => {
      if (!isProvisioned || isLoading) return null;
      setIsLoading(true);
      setIsRefreshingFeeds(true);
      setError(null);

      try {
        const entriesPromise = resetEntries();
        const tasks: Promise<unknown>[] = [
          loadFeeds(),
          loadCategories(),
          entriesPromise,
        ];
        if (extraTasks) {
          tasks.push(...extraTasks());
        }
        await Promise.all(tasks);
        setLastRefreshedAt(Date.now());
        return await entriesPromise;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
        return null;
      } finally {
        setIsRefreshingFeeds(false);
        setIsLoading(false);
      }
    },
    [isProvisioned, isLoading, loadFeeds, loadCategories, resetEntries]
  );

  return {
    feeds,
    categories,
    entries,
    total,
    isLoading,
    isRefreshingFeeds,
    error,
    lastRefreshedAt,
    setTotal,
    setEntries,
    setFeeds,
    setCategories,
    setIsLoading,
    setError,
    loadFeeds,
    loadCategories,
    fetchEntriesData,
    loadEntries,
    resetEntries,
    loadMore,
    refreshAll,
  };
}
