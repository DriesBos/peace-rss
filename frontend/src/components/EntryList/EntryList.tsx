'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './EntryList.module.sass';
import { EntryItem } from '@/components/EntryItem/EntryItem';
import { Button } from '@/components/Button/Button';
import type { Entry, Feed } from '@/app/_lib/types';

function formatDate(value?: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

type LazyEntryItemProps = {
  entry: Entry;
  selectedEntryId: number | null;
  feedsById: Map<number, Feed>;
  onEntryClick: (id: number) => void;
};

function LazyEntryItem({
  entry,
  selectedEntryId,
  feedsById,
  onEntryClick,
}: LazyEntryItemProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (inView) return;
    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setInView(true);
        observer.disconnect();
      },
      { threshold: 0.5 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [inView]);

  const isActive = entry.id === selectedEntryId;
  const feedTitle =
    entry.feed_title ??
    entry.feed?.title ??
    feedsById.get(entry.feed_id)?.title;
  const published = formatDate(entry.published_at);

  return (
    <div ref={ref} className={styles.lazyEntryWrapper}>
      {inView && (
        <EntryItem
          title={entry.title}
          author={entry.author}
          feedTitle={feedTitle}
          publishedAt={published}
          active={isActive}
          marked={entry.status === 'read'}
          starred={entry.starred}
          content={entry.content}
          url={entry.url}
          onClick={() => onEntryClick(entry.id)}
        />
      )}
    </div>
  );
}

export type EntryListProps = {
  entries: Entry[];
  selectedEntryId: number | null;
  feedsById: Map<number, Feed>;
  onEntrySelect: (id: number) => void;
  canLoadMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  searchMode: boolean;
  isAllEntriesView: boolean;
  isStarredView: boolean;
};

export function EntryList({
  entries,
  selectedEntryId,
  feedsById,
  onEntrySelect,
  canLoadMore,
  isLoading,
  onLoadMore,
  searchMode,
  isAllEntriesView,
  isStarredView,
}: EntryListProps) {
  const emptyMessage = isLoading
    ? 'loading...'
    : searchMode
    ? 'No results found.'
    : isAllEntriesView
    ? 'No entries.'
    : isStarredView
    ? 'No starred entries.'
    : 'No unread entries.';

  return (
    <div className={styles.entryList}>
      {entries.length === 0 ? (
        <div className={styles.muted}>{emptyMessage}</div>
      ) : (
        <div className={styles.entryList_Items}>
          {entries.map((entry) => (
            <LazyEntryItem
              key={entry.id}
              entry={entry}
              selectedEntryId={selectedEntryId}
              feedsById={feedsById}
              onEntryClick={onEntrySelect}
            />
          ))}
        </div>
      )}
      <div className={styles.entryList_Footer}>
        {canLoadMore && (
          <Button
            variant="primary"
            onClick={onLoadMore}
            disabled={isLoading}
          >
            Load more
          </Button>
        )}
      </div>
    </div>
  );
}
