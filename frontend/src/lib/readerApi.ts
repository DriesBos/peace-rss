import { fetchJson } from '@/app/_lib/fetchJson';
import type {
  Category,
  EntriesResponse,
  Feed,
  FeedCountersResponse,
} from '@/app/_lib/types';

export async function fetchFeeds(): Promise<Feed[]> {
  return fetchJson<Feed[]>('/api/feeds');
}

export async function fetchCategories(): Promise<Category[]> {
  return fetchJson<Category[]>('/api/categories');
}

export async function fetchEntries(url: string): Promise<EntriesResponse> {
  return fetchJson<EntriesResponse>(url);
}

export async function fetchFeedCounters(): Promise<FeedCountersResponse> {
  return fetchJson<FeedCountersResponse>('/api/feeds/counters');
}

export async function fetchStarredEntries(): Promise<EntriesResponse> {
  return fetchJson<EntriesResponse>(`/api/entries?starred=true&offset=0`);
}

export async function fetchStarredCount(): Promise<EntriesResponse> {
  return fetchJson<EntriesResponse>('/api/entries?starred=true&offset=0');
}
