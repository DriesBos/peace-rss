import { fetchJson } from '@/app/_lib/fetchJson';
import type {
  EntriesResponse,
  Feed,
  ReaderPreferences,
  TagsResponse,
} from '@/app/_lib/types';
import { DEFAULT_ENTRIES_PAGE_SIZE } from '@/lib/entriesQuery';

export async function fetchFeeds(init?: RequestInit): Promise<Feed[]> {
  return fetchJson<Feed[]>('/api/feeds', init);
}

export async function fetchTags(init?: RequestInit): Promise<TagsResponse> {
  return fetchJson<TagsResponse>('/api/tags', init);
}

/** Pull new posts from Miniflux into our copy right now. */
export async function syncReader(init?: RequestInit): Promise<void> {
  await fetchJson<{ ok: boolean }>('/api/sync', { method: 'POST', ...init });
}

export async function fetchEntries(
  url: string,
  init?: RequestInit,
): Promise<EntriesResponse> {
  return fetchJson<EntriesResponse>(url, init);
}

export async function fetchStarredEntries(
  limit = DEFAULT_ENTRIES_PAGE_SIZE,
  init?: RequestInit,
): Promise<EntriesResponse> {
  return fetchJson<EntriesResponse>(
    `/api/entries?starred=true&offset=0&limit=${limit}`,
    init,
  );
}

export async function fetchReaderPreferences(
  init?: RequestInit,
): Promise<ReaderPreferences> {
  return fetchJson<ReaderPreferences>('/api/me', init);
}
