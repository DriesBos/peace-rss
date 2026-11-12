export type EntriesQueryParams = {
  pageSize: number;
  searchMode: boolean;
  searchQuery: string;
  isStarredView: boolean;
  selectedTagIds: number[];
  statusFilter: 'unread' | 'all';
};

export const readerQueryKeys = {
  all: ['reader'] as const,
  feeds: ['reader', 'feeds'] as const,
  tags: ['reader', 'tags'] as const,
  entriesRoot: ['reader', 'entries'] as const,
  entries: (params: EntriesQueryParams) =>
    ['reader', 'entries', params] as const,
  preferences: ['reader', 'preferences'] as const,
  starredEntriesRoot: ['reader', 'starredEntries'] as const,
  starredEntries: (limit: number) =>
    ['reader', 'starredEntries', limit] as const,
};
