import { useCallback, useMemo, useState } from 'react';
import type { Feed } from '@/app/_lib/types';
import { fetchFeedCounters, fetchStarredCount } from '@/lib/readerApi';

export function useUnreadCounters({
  isProvisioned,
  feeds,
}: {
  isProvisioned: boolean;
  feeds: Feed[];
}) {
  const [unreadsByFeed, setUnreadsByFeed] = useState<Record<string, number>>(
    {}
  );
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const [totalStarredCount, setTotalStarredCount] = useState(0);

  const refreshUnreadCounters = useCallback(async () => {
    if (!isProvisioned) return;
    try {
      const counters = await fetchFeedCounters();
      const unreads = counters.unreads ?? {};
      setUnreadsByFeed(unreads);
      const total = Object.values(unreads).reduce(
        (sum, value) => sum + value,
        0
      );
      setTotalUnreadCount(total);
    } catch (err) {
      console.error('Failed to load unread counters', err);
    }
  }, [isProvisioned]);

  const refreshStarredCount = useCallback(async () => {
    if (!isProvisioned) return;
    try {
      const data = await fetchStarredCount();
      setTotalStarredCount(data.total ?? 0);
    } catch (err) {
      console.error('Failed to load starred count', err);
    }
  }, [isProvisioned]);

  const categoryUnreadCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const feed of feeds) {
      const categoryId = feed.category?.id;
      if (!categoryId) continue;
      const fallback = typeof feed.unread_count === 'number' ? feed.unread_count : 0;
      const count = unreadsByFeed[String(feed.id)] ?? fallback;
      counts.set(categoryId, (counts.get(categoryId) ?? 0) + count);
    }
    return counts;
  }, [feeds, unreadsByFeed]);

  return {
    totalUnreadCount,
    totalStarredCount,
    categoryUnreadCounts,
    refreshUnreadCounters,
    refreshStarredCount,
  };
}
