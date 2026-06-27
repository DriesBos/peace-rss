import { Suspense } from 'react';
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/react-query';
import type { EntriesResponse } from '@/app/_lib/types';
import { ReaderApp } from '@/app/ReaderApp';
import { DEFAULT_ENTRIES_PAGE_SIZE } from '@/lib/entriesQuery';
import { getInitialReaderData } from '@/lib/readerServer';
import { readerQueryKeys, type EntriesQueryParams } from '@/lib/readerQueryKeys';

function defaultEntriesParams(pageSize: number): EntriesQueryParams {
  return {
    pageSize,
    searchMode: false,
    searchQuery: '',
    isStarredView: false,
    selectedCategoryId: null,
    statusFilter: 'unread',
  };
}

export default async function Home() {
  const initialData = await getInitialReaderData();
  const queryClient = new QueryClient();

  if (initialData.preferences) {
    queryClient.setQueryData(
      readerQueryKeys.preferences,
      initialData.preferences,
    );
  }

  queryClient.setQueryData(readerQueryKeys.feeds, initialData.feeds);
  queryClient.setQueryData(readerQueryKeys.categories, initialData.categories);

  if (initialData.allCount) {
    queryClient.setQueryData(readerQueryKeys.allCount, initialData.allCount);
  }

  if (initialData.starredCount) {
    queryClient.setQueryData(
      readerQueryKeys.starredCount,
      initialData.starredCount,
    );
  }

  if (initialData.entries) {
    const pageSize =
      initialData.preferences?.entries_per_page ?? DEFAULT_ENTRIES_PAGE_SIZE;
    queryClient.setQueryData<InfiniteData<EntriesResponse>>(
      readerQueryKeys.entries(defaultEntriesParams(pageSize)),
      {
        pages: [initialData.entries],
        pageParams: [0],
      },
    );
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<div aria-busy="true" aria-label="Loading reader" />}>
        <ReaderApp initialProvisioned={initialData.provisioned} />
      </Suspense>
    </HydrationBoundary>
  );
}
