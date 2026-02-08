import { useCallback, useMemo, useState } from 'react';
import type { Feed } from '@/app/_lib/types';
import type { ReaderView } from '@/hooks/useReaderData';
import { fetchFeedCounters, fetchStarredCount } from '@/lib/readerApi';
import { isProtectedCategoryTitle } from '@/lib/protectedCategories';

function isGloballyVisible(feed: Feed): boolean {
  if (feed.category?.title && isProtectedCategoryTitle(feed.category.title)) {
    return false;
  }
  return feed.hide_globally !== true;
}

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
      const total = feeds.reduce((sum, feed) => {
        if (!isGloballyVisible(feed)) return sum;
        const fallback =
          typeof feed.unread_count === 'number' ? feed.unread_count : 0;
        const count = unreads[String(feed.id)] ?? fallback;
        return sum + count;
      }, 0);
      setTotalUnreadCount(total);
      return total;
    } catch (err) {
      console.error('Failed to load unread counters', err);
      return null;
    }
  }, [feeds, isProvisioned]);

  const refreshStarredCount = useCallback(async () => {
    if (!isProvisioned) return;
    try {
      const data = await fetchStarredCount();
      setTotalStarredCount(data.total ?? 0);
      return data.total ?? 0;
    } catch (err) {
      console.error('Failed to load starred count', err);
      return null;
    }
  }, [isProvisioned]);

  const getTotalForView = useCallback(
    (view: ReaderView): number | null => {
      if (view.searchMode || view.isStarredView) return null;
      if (view.selectedFeedId) {
        const fallback = feeds.find((feed) => feed.id === view.selectedFeedId)
          ?.unread_count;
        return unreadsByFeed[String(view.selectedFeedId)] ?? fallback ?? 0;
      }
      if (view.selectedCategoryId !== null) {
        return feeds
          .filter((feed) => feed.category?.id === view.selectedCategoryId)
          .reduce((sum, feed) => {
            const fallback =
              typeof feed.unread_count === 'number' ? feed.unread_count : 0;
            const count = unreadsByFeed[String(feed.id)] ?? fallback;
            return sum + count;
          }, 0);
      }
      if (totalUnreadCount > 0) return totalUnreadCount;
      return feeds.reduce((sum, feed) => {
        if (!isGloballyVisible(feed)) return sum;
        if (typeof feed.unread_count !== 'number') return sum;
        return sum + feed.unread_count;
      }, 0);
    },
    [feeds, unreadsByFeed, totalUnreadCount]
  );

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
    getTotalForView,
  };
}
