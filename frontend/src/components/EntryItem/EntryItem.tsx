'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import styles from './EntryItem.module.sass';
import { FormattedDate } from '../FormattedDate';
import {
  extractThumbnailFromHtml,
  resolveAbsoluteUrl,
} from '@/lib/entryThumbnail';

type EntryItemProps = {
  title?: string;
  feedTitle?: string;
  author?: string;
  publishedAt?: string;
  content?: string;
  url?: string;
  active?: boolean;
  marked: boolean;
  onClick?: () => void;
};

/**
 * Creates a plain text preview from HTML content
 * @param htmlContent - HTML string to convert
 * @param maxLength - Maximum character length (default: 200)
 * @returns Plain text preview with ellipsis if truncated, or empty string if less than 6 words
 */
function createPreview(
  htmlContent: string | undefined,
  maxLength = 200,
): string {
  if (!htmlContent) return '';

  // Strip HTML tags
  let textOnly = htmlContent
    .replace(/<[^>]*>/g, ' ')
    // Replace multiple spaces/newlines with single space
    .replace(/\s+/g, ' ')
    // Decode common named HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();

  // Decode numeric HTML entities (decimal: &#34; and hex: &#x22;)
  textOnly = textOnly.replace(/&#(\d+);/g, (_, dec) => {
    return String.fromCharCode(parseInt(dec, 10));
  });
  textOnly = textOnly.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });

  // Count words (split by whitespace and filter empty strings)
  const words = textOnly.split(/\s+/).filter((word) => word.length > 0);

  // Only show preview if there are at least a few words
  if (words.length < 3) return '';

  const fullText = words.join(' ');

  if (fullText.length <= maxLength) return fullText;

  // Truncate at word boundary to avoid cutting words
  const truncated = fullText.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + '…';
}

export function EntryItem({
  title,
  feedTitle,
  author,
  publishedAt,
  content,
  url,
  active,
  marked,
  onClick,
}: EntryItemProps) {
  const preview = useMemo(() => {
    return createPreview(content, 200);
  }, [content]);

  const thumbnailUrl = useMemo(() => {
    return extractThumbnailFromHtml(content);
  }, [content]);

  const absoluteThumbnailUrl = useMemo(() => {
    return resolveAbsoluteUrl(thumbnailUrl, url);
  }, [thumbnailUrl, url]);

  const [isThumbnailErrored, setIsThumbnailErrored] = useState(false);

  return (
    <div
      className={styles.entryItem}
      data-active={active}
      data-marked={marked ? 'true' : 'false'}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      <div className={styles.entryItem_Body}>
        <div className={styles.entryItem_Header}>
          <h1>{title}</h1>
          <div className={styles.entryItem_Meta}>
            <span>
              <FormattedDate date={publishedAt} />
              {' — '}
            </span>
            <span>
              By: <i>{author ? `${author}, ${feedTitle}` : feedTitle}</i>
            </span>
          </div>
        </div>
        {preview && <p className={styles.entryItem_Preview}>{preview}</p>}
      </div>
      {absoluteThumbnailUrl && !isThumbnailErrored && (
        <div className={styles.entryItem_Thumbnail}>
          <Image
            src={absoluteThumbnailUrl}
            alt={title || 'Entry thumbnail'}
            fill
            sizes="(max-width: 745px) 23vw, 90px"
            quality={60}
            unoptimized
            loading="lazy"
            style={{ objectFit: 'cover' }}
            onError={() => setIsThumbnailErrored(true)}
          />
        </div>
      )}
    </div>
  );
}
