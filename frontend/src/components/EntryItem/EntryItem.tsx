'use client';

import { useState } from 'react';
import styles from './EntryItem.module.sass';
import { FormattedDate } from '../FormattedDate';

type EntryItemProps = {
  title?: string;
  feedTitle?: string;
  author?: string;
  publishedAt?: string;
  preview?: string;
  thumbnailUrl?: string;
  active?: boolean;
  marked: boolean;
  starred?: boolean;
  onClick?: () => void;
};

export function EntryItem({
  title,
  feedTitle,
  author,
  publishedAt,
  preview,
  thumbnailUrl,
  active,
  marked,
  starred,
  onClick,
}: EntryItemProps) {
  const [isThumbnailErrored, setIsThumbnailErrored] = useState(false);
  const hasMetaPrefix = Boolean(publishedAt);
  const hasSourceMeta = Boolean(author || feedTitle);

  return (
    <div
      className={styles.entryItem}
      data-active={active}
      data-marked={marked ? 'true' : 'false'}
      data-starred={starred ? 'true' : 'false'}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onClick?.();
      }}
      role="button"
      tabIndex={0}
    >
      <div className={styles.entryItem_Body}>
        <div className={styles.entryItem_Header}>
          <h1>{title}</h1>
          <div className={styles.entryItem_Meta}>
            {publishedAt ? (
              <span>
                <FormattedDate date={publishedAt} />
              </span>
            ) : null}
            {hasMetaPrefix && hasSourceMeta ? <span>{' — '}</span> : null}
            {hasSourceMeta ? (
              <span>
                By: <i>{author ? `${author}, ${feedTitle}` : feedTitle}</i>
              </span>
            ) : null}
          </div>
        </div>
        {preview && <p className={styles.entryItem_Preview}>{preview}</p>}
      </div>
      {thumbnailUrl && !isThumbnailErrored && (
        <div className={styles.entryItem_Thumbnail}>
          {/* ponytail: RSS thumbnails use arbitrary hosts; keep plain img. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbnailUrl}
            alt={title || 'Entry thumbnail'}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setIsThumbnailErrored(true)}
          />
        </div>
      )}
    </div>
  );
}
