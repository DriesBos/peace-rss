export const INITIAL_ENTRIES_LIMIT = 250;
export const ENTRIES_PAGE_SIZE = 50;

type EntriesQueryOptions = {
  limit?: number;
  offset?: number;
  order?: string;
  direction?: 'asc' | 'desc';
  searchQuery?: string;
  isStarredView?: boolean;
  selectedFeedId?: number | null;
  selectedCategoryId?: number | null;
  status?: 'read' | 'unread';
  changedAfter?: number;
  publishedAfter?: number;
};

export function buildEntriesUrl({
  limit = INITIAL_ENTRIES_LIMIT,
  offset = 0,
  order = 'published_at',
  direction = 'desc',
  searchQuery,
  isStarredView = false,
  selectedFeedId = null,
  selectedCategoryId = null,
  status = 'unread',
  changedAfter,
  publishedAfter,
}: EntriesQueryOptions): string {
  const qs = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    order,
    direction,
  });

  const trimmedQuery = searchQuery?.trim();
  if (trimmedQuery) {
    qs.set('search', trimmedQuery);
  } else if (isStarredView) {
    qs.set('starred', 'true');
  } else {
    qs.set('status', status);
  }

  if (!trimmedQuery && selectedFeedId) {
    qs.set('feed_id', String(selectedFeedId));
  }

  if (!trimmedQuery && selectedCategoryId !== null) {
    qs.set('category_id', String(selectedCategoryId));
  }

  if (changedAfter) {
    qs.set('changed_after', String(changedAfter));
  }

  if (publishedAfter) {
    qs.set('published_after', String(publishedAfter));
  }

  return `/api/entries?${qs.toString()}`;
}
