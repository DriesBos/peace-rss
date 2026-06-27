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
    // ponytail: mirror /api/entries MAX_ENTRIES_LIMIT=500 so the seeded first
    // page can never hold more rows than a client refetch returns. If that
    // ceiling changes in api/entries/route.ts, change it here too.
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
    // If we cannot even resolve identity (e.g. Clerk hiccup), treat as
    // unprovisioned and let the client bootstrap path take over — never 500.
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
          // NOTE: key pageSize stays unclamped (preferences.entries_per_page);
          // only the fetch limit is clamped inside entriesPath.
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

      // Match the /api/entries response shape exactly: the route enriches every
      // entry with preview + thumbnail_url, and EntryList renders those fields.
      // Without this, the hydrated first paint shows no previews/thumbnails.
      const entries: EntriesResponse = {
        ...rawEntries,
        entries: rawEntries.entries.map((entry) => withEntryListMeta(entry)),
      };

      return {
        provisioned: true,
        preferences,
        feeds,
        categories,
        entries,
        allCount, // only .total is read for counts; entries arrays unused -> leave raw
        starredCount,
      };
    } catch {
      // Token exists (user IS provisioned) but Miniflux failed transiently.
      // Skip bootstrap, seed nothing, and let the client queries refetch/error
      // gracefully instead of crashing the server render.
      return { ...EMPTY, provisioned: true };
    }
  },
);
