import { useCallback, useMemo, useState } from 'react';
import {
  type InfiniteData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { Category, EntriesResponse, Entry, Feed } from '@/app/_lib/types';
import {
  buildEntriesUrl,
  DEFAULT_ENTRIES_PAGE_SIZE,
} from '@/lib/entriesQuery';
import { fetchCategories, fetchEntries, fetchFeeds } from '@/lib/readerApi';
import { readerQueryKeys, type EntriesQueryParams } from '@/lib/readerQueryKeys';

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

type ListUpdater<T> = T[] | ((prev: T[]) => T[]);

function applyListUpdater<T>(updater: ListUpdater<T>, previous: T[]): T[] {
  return typeof updater === 'function' ? updater(previous) : updater;
}

function flattenEntries(
  data: InfiniteData<EntriesResponse> | undefined,
): Entry[] {
  return data?.pages.flatMap((page) => page.entries) ?? [];
}

function toEntriesResponse(
  data: InfiniteData<EntriesResponse> | undefined,
): EntriesResponse {
  const entries = flattenEntries(data);
  return {
    entries,
    total: data?.pages[0]?.total ?? entries.length,
  };
}

function errorMessage(error: unknown): string | null {
  if (!error) return null;
  return error instanceof Error ? error.message : 'Failed to load';
}

export function useReaderData({
  isProvisioned,
  view,
  pageSize = DEFAULT_ENTRIES_PAGE_SIZE,
}: {
  isProvisioned: boolean;
  view: ReaderView;
  pageSize?: number;
}) {
  const queryClient = useQueryClient();
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [isRefreshingFeeds, setIsRefreshingFeeds] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);

  const entriesParams = useMemo<EntriesQueryParams>(
    () => ({
      pageSize,
      searchMode: view.searchMode,
      searchQuery: view.searchMode ? view.searchQuery.trim() : '',
      isStarredView: view.searchMode ? false : view.isStarredView,
      selectedCategoryId: view.searchMode ? null : view.selectedCategoryId,
      statusFilter:
        view.searchMode || view.isStarredView ? 'all' : view.statusFilter,
    }),
    [
      pageSize,
      view.isStarredView,
      view.searchMode,
      view.searchQuery,
      view.selectedCategoryId,
      view.statusFilter,
    ],
  );

  const entriesKey = readerQueryKeys.entries(entriesParams);

  const feedsQuery = useQuery({
    queryKey: readerQueryKeys.feeds,
    enabled: isProvisioned,
    queryFn: ({ signal }) => fetchFeeds({ signal }),
  });

  const categoriesQuery = useQuery({
    queryKey: readerQueryKeys.categories,
    enabled: isProvisioned,
    queryFn: ({ signal }) => fetchCategories({ signal }),
  });

  const entriesQuery = useInfiniteQuery({
    queryKey: entriesKey,
    enabled: isProvisioned,
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => {
      const effectiveStatus =
        entriesParams.searchMode || entriesParams.isStarredView
          ? null
          : entriesParams.statusFilter;
      const url = buildEntriesUrl({
        limit: entriesParams.pageSize,
        offset: pageParam,
        searchQuery: entriesParams.searchQuery,
        isStarredView: entriesParams.isStarredView,
        selectedCategoryId: entriesParams.selectedCategoryId,
        status: effectiveStatus,
        globallyVisible:
          !entriesParams.searchMode &&
          !entriesParams.isStarredView &&
          entriesParams.selectedCategoryId === null,
      });
      return fetchEntries(url, { signal });
    },
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.entries.length, 0);
      const total = lastPage.total ?? loaded;
      return loaded < total ? loaded : undefined;
    },
  });

  const invalidateReaderData = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: readerQueryKeys.all });
  }, [queryClient]);

  const loadFeeds = useCallback(async (): Promise<Feed[]> => {
    const result = await feedsQuery.refetch();
    if (result.error) throw result.error;
    return result.data ?? [];
  }, [feedsQuery]);

  const loadCategories = useCallback(async (): Promise<Category[]> => {
    const result = await categoriesQuery.refetch();
    if (result.error) throw result.error;
    return result.data ?? [];
  }, [categoriesQuery]);

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
        (view.searchMode || view.isStarredView ? null : view.statusFilter);
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
    [pageSize, view],
  );

  const loadEntries = useCallback(
    async (options: LoadEntriesOptions = {}): Promise<EntriesResponse> => {
      setManualError(null);
      if (options.append) {
        const result = await entriesQuery.fetchNextPage();
        if (result.error) throw result.error;
        return toEntriesResponse(result.data);
      }

      const result = await entriesQuery.refetch();
      if (result.error) throw result.error;
      return toEntriesResponse(result.data);
    },
    [entriesQuery],
  );

  const resetEntries = useCallback(async (): Promise<EntriesResponse> => {
    return loadEntries();
  }, [loadEntries]);

  const loadMore = useCallback(async (): Promise<EntriesResponse> => {
    return loadEntries({ append: true });
  }, [loadEntries]);

  const refreshAll = useCallback(
    async (extraTasks?: () => Promise<unknown>[]) => {
      if (!isProvisioned || manualLoading) return null;
      setManualLoading(true);
      setIsRefreshingFeeds(true);
      setManualError(null);

      try {
        const [entriesResult, feedsResult, categoriesResult] =
          await Promise.all([
            entriesQuery.refetch(),
            feedsQuery.refetch(),
            categoriesQuery.refetch(),
            queryClient.invalidateQueries({ queryKey: readerQueryKeys.counts }),
            queryClient.invalidateQueries({
              queryKey: readerQueryKeys.starredEntriesRoot,
            }),
            ...(extraTasks?.() ?? []),
          ]);
        const firstError =
          entriesResult.error ?? feedsResult.error ?? categoriesResult.error;
        if (firstError) throw firstError;
        setLastRefreshedAt(Date.now());
        return toEntriesResponse(entriesResult.data);
      } catch (e) {
        setManualError(e instanceof Error ? e.message : 'Failed to load');
        return null;
      } finally {
        setIsRefreshingFeeds(false);
        setManualLoading(false);
      }
    },
    [
      categoriesQuery,
      entriesQuery,
      feedsQuery,
      isProvisioned,
      manualLoading,
      queryClient,
    ],
  );

  const setEntries = useCallback(
    (updater: ListUpdater<Entry>) => {
      queryClient.setQueriesData<InfiniteData<EntriesResponse>>(
        { queryKey: readerQueryKeys.entriesRoot },
        (data) => {
          if (!data) return data;
          return {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              entries: applyListUpdater(updater, page.entries),
            })),
          };
        },
      );

      queryClient.setQueriesData<EntriesResponse>(
        { queryKey: readerQueryKeys.starredEntriesRoot },
        (data) =>
          data
            ? {
                ...data,
                entries: applyListUpdater(updater, data.entries),
              }
            : data,
      );
    },
    [queryClient],
  );

  const setFeeds = useCallback(
    (updater: ListUpdater<Feed>) => {
      queryClient.setQueryData<Feed[]>(readerQueryKeys.feeds, (data) =>
        applyListUpdater(updater, data ?? []),
      );
    },
    [queryClient],
  );

  const setCategories = useCallback(
    (updater: ListUpdater<Category>) => {
      queryClient.setQueryData<Category[]>(
        readerQueryKeys.categories,
        (data) => applyListUpdater(updater, data ?? []),
      );
    },
    [queryClient],
  );

  const queryError =
    errorMessage(entriesQuery.error) ??
    errorMessage(feedsQuery.error) ??
    errorMessage(categoriesQuery.error);
  const entries = flattenEntries(entriesQuery.data);

  return {
    feeds: feedsQuery.data ?? [],
    categories: categoriesQuery.data ?? [],
    entries,
    total: entriesQuery.data?.pages[0]?.total ?? entries.length,
    isLoading:
      manualLoading ||
      entriesQuery.isPending ||
      entriesQuery.isFetchingNextPage ||
      feedsQuery.isPending ||
      categoriesQuery.isPending,
    isRefreshingFeeds,
    error: manualError ?? queryError,
    lastRefreshedAt,
    setTotal: () => {},
    setEntries,
    setFeeds,
    setCategories,
    setIsLoading: setManualLoading,
    setError: setManualError,
    loadFeeds,
    loadCategories,
    fetchEntriesData,
    loadEntries,
    resetEntries,
    loadMore,
    refreshAll,
    invalidateReaderData,
  };
}
