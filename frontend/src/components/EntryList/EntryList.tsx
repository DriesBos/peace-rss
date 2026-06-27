'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import styles from './EntryList.module.sass';
import { EntryItem } from '@/components/EntryItem/EntryItem';
import { Button } from '@/components/Button/Button';
import type { Entry, Feed } from '@/app/_lib/types';

const ROW_GAP = 24;

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

function getColumnCount(width: number): number {
  if (width >= 2000) return 5;
  if (width >= 1600) return 4;
  if (width >= 1200) return 3;
  if (width >= 800) return 2;
  return 1;
}

function chunkEntries(entries: Entry[], columnCount: number): Entry[][] {
  const rows: Entry[][] = [];
  for (let i = 0; i < entries.length; i += columnCount) {
    rows.push(entries.slice(i, i + columnCount));
  }
  return rows;
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
  const listRef = useRef<HTMLDivElement>(null);
  const [columnCount, setColumnCount] = useState(1);
  const [scrollMargin, setScrollMargin] = useState(0);
  const rows = useMemo(
    () => chunkEntries(entries, columnCount),
    [entries, columnCount],
  );
  const rowVirtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => 180,
    gap: ROW_GAP,
    overscan: 6,
    scrollMargin,
  });

  useEffect(() => {
    const updateLayout = () => {
      setColumnCount(getColumnCount(window.innerWidth));
      setScrollMargin(listRef.current?.offsetTop ?? 0);
    };

    updateLayout();
    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, []);

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
        <div
          ref={listRef}
          className={styles.entryList_Items}
          style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index] ?? [];
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                className={styles.entryList_Row}
                style={{
                  gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                  transform: `translateY(${
                    virtualRow.start - rowVirtualizer.options.scrollMargin
                  }px)`,
                }}
              >
                {row.map((entry) => {
                  const feedTitle =
                    entry.feed_title ??
                    entry.feed?.title ??
                    feedsById.get(entry.feed_id)?.title;
                  return (
                    <EntryItem
                      key={entry.id}
                      title={entry.title}
                      author={entry.author}
                      feedTitle={feedTitle}
                      publishedAt={formatDate(entry.published_at)}
                      active={entry.id === selectedEntryId}
                      marked={entry.status === 'read'}
                      starred={entry.starred}
                      preview={entry.preview}
                      thumbnailUrl={entry.thumbnail_url}
                      onClick={() => onEntrySelect(entry.id)}
                    />
                  );
                })}
              </div>
            );
          })}
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
