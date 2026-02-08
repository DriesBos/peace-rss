'use client';

import { useInView } from 'react-intersection-observer';
import styles from './EntryList.module.sass';
import { EntryItem } from '@/components/EntryItem/EntryItem';
import { Button } from '@/components/Button/Button';
import type { Entry, Feed } from '@/app/_lib/types';
import { extractYouTubeVideoId } from '@/lib/youtube';

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
  layout: 'default' | 'youtube' | 'instagram' | 'twitter';
};

function LazyEntryItem({
  entry,
  selectedEntryId,
  feedsById,
  onEntryClick,
  layout,
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
  const youtubeId = entry.url ? extractYouTubeVideoId(entry.url) : null;
  const entryLayout =
    layout === 'default' ? (youtubeId ? 'youtube' : 'default') : layout;

  return (
    <div ref={ref} className={styles.lazyEntryWrapper}>
      {inView && (
        <EntryItem
          layout={entryLayout}
          youtubeVideoId={entryLayout === 'youtube' ? youtubeId ?? undefined : undefined}
          title={entry.title}
          author={entry.author}
          feedTitle={feedTitle}
          publishedAt={published}
          active={entryLayout === 'youtube' ? false : isActive}
          marked={entry.status === 'read'}
          content={entryLayout === 'youtube' ? undefined : entry.content}
          url={entry.url}
          onClick={entryLayout === 'youtube' ? undefined : () => onEntryClick(entry.id)}
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
  layout?: 'default' | 'youtube' | 'instagram' | 'twitter';
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
  layout = 'default',
}: EntryListProps) {
  return (
    <div className={styles.entryList} data-layout={layout}>
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
            layout={layout}
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
