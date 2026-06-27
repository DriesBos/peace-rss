import 'server-only';

import { cache } from 'react';
import type {
  Category,
  EntriesResponse,
  Feed,
  ReaderPreferences,
} from '@/app/_lib/types';
import { withEntryListMeta } from '@/lib/entryListMeta';
import { getMinifluxToken } from '@/lib/minifluxAuth';
import { mfFetchUser } from '@/lib/miniflux';
import { normalizeReaderPreferences } from '@/lib/readerPrefs';

export type InitialReaderData = {
  provisioned: boolean;
  preferences: ReaderPreferences | null;
  feeds: Feed[];
  categories: Category[];
  entries: EntriesResponse | null;
  allCount: EntriesResponse | null;
  starredCount: EntriesResponse | null;
};

const EMPTY: InitialReaderData = {
  provisioned: false,
  preferences: null,
  feeds: [],
  categories: [],
  entries: null,
  allCount: null,
  starredCount: null,
};

function entriesPath(limit: number): string {
  const qs = new URLSearchParams({
    // ponytail: mirror /api/entries MAX_ENTRIES_LIMIT=500; share constant if it changes often.
    limit: String(Math.min(limit, 500)),
    offset: '0',
    order: 'published_at',
    direction: 'desc',
    status: 'unread',
    globally_visible: 'true',
  });
  return `/v1/entries?${qs.toString()}`;
}

export const getInitialReaderData = cache(
  async (): Promise<InitialReaderData> => {
    const identity = await getMinifluxToken().catch(() => null);
    if (!identity) return EMPTY;

    try {
      const preferences = normalizeReaderPreferences(
        await mfFetchUser<ReaderPreferences>(identity.token, '/v1/me'),
      );

      const [feeds, categories, rawEntries, allCount, starredCount] =
        await Promise.all([
          mfFetchUser<Feed[]>(identity.token, '/v1/feeds'),
          mfFetchUser<Category[]>(identity.token, '/v1/categories?counts=true'),
          mfFetchUser<EntriesResponse>(
            identity.token,
            entriesPath(preferences.entries_per_page),
          ),
          mfFetchUser<EntriesResponse>(
            identity.token,
            '/v1/entries?status=all&globally_visible=true&offset=0&limit=1',
          ),
          mfFetchUser<EntriesResponse>(
            identity.token,
            '/v1/entries?starred=true&offset=0&limit=1',
          ),
        ]);

      return {
        provisioned: true,
        preferences,
        feeds,
        categories,
        entries: {
          ...rawEntries,
          entries: rawEntries.entries.map((entry) => withEntryListMeta(entry)),
        },
        allCount,
        starredCount,
      };
    } catch {
      return { ...EMPTY, provisioned: true };
    }
  },
);
