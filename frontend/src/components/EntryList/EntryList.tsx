'use client';

import { useInView } from 'react-intersection-observer';
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
  const { ref, inView } = useInView({
    threshold: 0.5,
    triggerOnce: true,
  });

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
  isStarredView,
}: EntryListProps) {
  return (
    <div className={styles.entryList}>
      {entries.length === 0 ? (
        <div className={styles.muted}>
          {searchMode
            ? 'No results found.'
            : isStarredView
            ? 'No starred entries.'
            : 'No unread entries.'}
        </div>
      ) : (
        entries.map((entry) => (
          <LazyEntryItem
            key={entry.id}
            entry={entry}
            selectedEntryId={selectedEntryId}
            feedsById={feedsById}
            onEntryClick={onEntrySelect}
          />
        ))
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
