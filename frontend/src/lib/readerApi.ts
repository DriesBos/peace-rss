import { fetchJson } from '@/app/_lib/fetchJson';
import type {
  Category,
  EntriesResponse,
  Feed,
  ReaderPreferences,
} from '@/app/_lib/types';
import { DEFAULT_ENTRIES_PAGE_SIZE } from '@/lib/entriesQuery';

export async function fetchFeeds(): Promise<Feed[]> {
  return fetchJson<Feed[]>('/api/feeds');
}

export async function fetchCategories(): Promise<Category[]> {
  return fetchJson<Category[]>('/api/categories?counts=true');
}

export async function fetchEntries(url: string): Promise<EntriesResponse> {
  return fetchJson<EntriesResponse>(url);
}

export async function fetchStarredEntries(
  limit = DEFAULT_ENTRIES_PAGE_SIZE,
): Promise<EntriesResponse> {
  return fetchJson<EntriesResponse>(
    `/api/entries?starred=true&offset=0&limit=${limit}`,
  );
}

export async function fetchStarredCount(): Promise<EntriesResponse> {
  return fetchJson<EntriesResponse>('/api/entries?starred=true&offset=0&limit=1');
}

export async function fetchAllCount(): Promise<EntriesResponse> {
  return fetchJson<EntriesResponse>(
    '/api/entries?status=all&globally_visible=true&offset=0&limit=1',
  );
}

export async function fetchReaderPreferences(): Promise<ReaderPreferences> {
  return fetchJson<ReaderPreferences>('/api/me');
}
