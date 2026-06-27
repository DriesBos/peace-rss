import type { ReaderPreferences } from '@/app/_lib/types';
import { DEFAULT_ENTRIES_PAGE_SIZE } from '@/lib/entriesQuery';

export const DEFAULT_READER_PREFERENCES: ReaderPreferences = {
  id: 0,
  entries_per_page: DEFAULT_ENTRIES_PAGE_SIZE,
  keyboard_shortcuts: true,
  show_reading_time: true,
  entry_swipe: true,
};

export function normalizeReaderPreferences(
  data: ReaderPreferences | undefined,
): ReaderPreferences {
  return {
    ...DEFAULT_READER_PREFERENCES,
    ...(data ?? {}),
    entries_per_page:
      data && data.entries_per_page > 0
        ? data.entries_per_page
        : DEFAULT_ENTRIES_PAGE_SIZE,
  };
}
