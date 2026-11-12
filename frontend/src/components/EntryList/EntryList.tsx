'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import styles from './EntryList.module.sass';
import { EntryItem } from '@/components/EntryItem/EntryItem';
import { Button } from '@/components/Button/Button';
import type { Entry, Feed } from '@/app/_lib/types';

const ROW_GAP = 24;
const LOAD_MORE_THRESHOLD_ROWS = 3;

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

const SKELETON_CARD_COUNT = 6;

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
    // Key rows by their entries so cached heights follow the content, not the index.
    getItemKey: (index) =>
      rows[index]?.map((entry) => entry.id).join('-') ?? index,
  });

  // Web fonts change line wrapping after the first measure; re-measure once they load.
  useEffect(() => {
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (cancelled) return;
      setScrollMargin(listRef.current?.offsetTop ?? 0);
      rowVirtualizer.measure();
    });
    return () => {
      cancelled = true;
    };
  }, [rowVirtualizer]);

  useEffect(() => {
    const updateLayout = () => {
      setColumnCount(getColumnCount(window.innerWidth));
      setScrollMargin(listRef.current?.offsetTop ?? 0);
    };

    updateLayout();
    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, []);

  const virtualItems = rowVirtualizer.getVirtualItems();
  const lastVisibleIndex = virtualItems[virtualItems.length - 1]?.index ?? -1;

  // Infinite scroll: fetch the next page when the last rendered row nears the end.
  // Only once per list length, so a failed fetch doesn't retry in a loop
  // (the Load more button stays as a fallback).
  const autoLoadedAtRef = useRef<number | null>(null);
  useEffect(() => {
    if (!canLoadMore || isLoading || rows.length === 0) return;
    if (lastVisibleIndex < rows.length - 1 - LOAD_MORE_THRESHOLD_ROWS) return;
    if (autoLoadedAtRef.current === entries.length) return;
    autoLoadedAtRef.current = entries.length;
    onLoadMore();
  }, [
    lastVisibleIndex,
    rows.length,
    entries.length,
    canLoadMore,
    isLoading,
    onLoadMore,
  ]);

  const emptyMessage = searchMode
    ? 'No results found.'
    : isAllEntriesView
    ? 'No entries.'
    : isStarredView
    ? 'No starred entries.'
    : 'No unread entries.';

  return (
    <div className={styles.entryList}>
      {entries.length === 0 && isLoading ? (
        <div
          className={styles.entryList_Skeleton}
          style={{
            gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
          }}
          role="status"
          aria-label="Loading entries"
        >
          {Array.from({ length: SKELETON_CARD_COUNT }, (_, index) => (
            <div
              key={index}
              className={styles.entryList_SkeletonCard}
              data-loading="true"
            />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className={styles.muted}>{emptyMessage}</div>
      ) : (
        <div
          ref={listRef}
          className={styles.entryList_Items}
          style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
        >
          {/* Rows sit in normal flow inside one translated wrapper, so a row
              that grows after measuring pushes the next one down instead of
              overlapping it. */}
          <div
            className={styles.entryList_Window}
            style={{
              gap: `${ROW_GAP}px`,
              transform: `translateY(${
                (virtualItems[0]?.start ?? 0) -
                rowVirtualizer.options.scrollMargin
              }px)`,
            }}
          >
            {virtualItems.map((virtualRow) => {
              const row = rows[virtualRow.index] ?? [];
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  className={styles.entryList_Row}
                  style={{
                    gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
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
