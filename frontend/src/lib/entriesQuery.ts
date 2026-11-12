export const DEFAULT_ENTRIES_PAGE_SIZE = 100;

type EntriesQueryOptions = {
  limit?: number;
  offset?: number;
  order?: string;
  direction?: 'asc' | 'desc';
  searchQuery?: string;
  isStarredView?: boolean;
  /** Posts must have all of these tags. */
  selectedTagIds?: number[];
  status?: 'read' | 'unread' | 'all' | null;
  globallyVisible?: boolean;
  changedAfter?: number;
  publishedAfter?: number;
};

export function buildEntriesUrl({
  limit = DEFAULT_ENTRIES_PAGE_SIZE,
  offset = 0,
  order = 'published_at',
  direction = 'desc',
  searchQuery,
  isStarredView = false,
  selectedTagIds = [],
  status = 'unread',
  globallyVisible = false,
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
  } else if (status) {
    qs.set('status', status);
  }

  if (selectedTagIds.length > 0) {
    qs.set('tags', selectedTagIds.join(','));
  }

  if (globallyVisible) {
    qs.set('globally_visible', 'true');
  }

  if (changedAfter) {
    qs.set('changed_after', String(changedAfter));
  }

  if (publishedAfter) {
    qs.set('published_after', String(publishedAfter));
  }

  return `/api/entries?${qs.toString()}`;
}
