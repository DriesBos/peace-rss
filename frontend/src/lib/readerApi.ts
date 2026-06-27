import { fetchJson } from '@/app/_lib/fetchJson';
import type {
  Category,
  EntriesResponse,
  Feed,
  ReaderPreferences,
} from '@/app/_lib/types';
import { DEFAULT_ENTRIES_PAGE_SIZE } from '@/lib/entriesQuery';

export async function fetchFeeds(init?: RequestInit): Promise<Feed[]> {
  return fetchJson<Feed[]>('/api/feeds', init);
}

export async function fetchCategories(init?: RequestInit): Promise<Category[]> {
  return fetchJson<Category[]>('/api/categories?counts=true', init);
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

export async function fetchStarredCount(
  init?: RequestInit,
): Promise<EntriesResponse> {
  return fetchJson<EntriesResponse>(
    '/api/entries?starred=true&offset=0&limit=1',
    init,
  );
}

export async function fetchAllCount(init?: RequestInit): Promise<EntriesResponse> {
  return fetchJson<EntriesResponse>(
    '/api/entries?status=all&globally_visible=true&offset=0&limit=1',
    init,
  );
}

export async function fetchReaderPreferences(
  init?: RequestInit,
): Promise<ReaderPreferences> {
  return fetchJson<ReaderPreferences>('/api/me', init);
}
