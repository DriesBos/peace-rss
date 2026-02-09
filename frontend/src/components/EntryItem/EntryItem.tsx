'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import styles from './EntryItem.module.sass';
import { FormattedDate } from '../FormattedDate';
import {
  extractThumbnailFromHtml,
  resolveAbsoluteUrl,
} from '@/lib/entryThumbnail';
import { getYouTubeEmbedUrl, getYouTubePosterUrl } from '@/lib/youtube';

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
  layout?: 'default' | 'youtube' | 'instagram' | 'twitter';
  youtubeVideoId?: string;
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
  layout = 'default',
  youtubeVideoId,
}: EntryItemProps) {
  const isSocialLayout = layout === 'instagram' || layout === 'twitter';

  const preview = useMemo(() => {
    if (layout !== 'default') return '';
    return createPreview(content, 200);
  }, [content, layout]);

  const thumbnailUrl = useMemo(() => {
    if (layout !== 'default') return null;
    return extractThumbnailFromHtml(content);
  }, [content, layout]);

  const absoluteThumbnailUrl = useMemo(() => {
    if (layout !== 'default') return null;
    return resolveAbsoluteUrl(thumbnailUrl, url);
  }, [thumbnailUrl, url, layout]);

  const socialPreview = useMemo(() => {
    if (layout !== 'twitter') return '';
    return createPreview(content, 280);
  }, [content, layout]);

  const socialThumbnailUrl = useMemo(() => {
    if (!isSocialLayout) return null;
    return extractThumbnailFromHtml(content);
  }, [content, isSocialLayout]);

  const absoluteSocialThumbnailUrl = useMemo(() => {
    if (!isSocialLayout) return null;
    return resolveAbsoluteUrl(socialThumbnailUrl, url);
  }, [isSocialLayout, socialThumbnailUrl, url]);

  const [isThumbnailErrored, setIsThumbnailErrored] = useState(false);

  const [isYoutubePlaying, setIsYoutubePlaying] = useState(false);
  const youtubeAutoplayUrl = useMemo(() => {
    if (layout !== 'youtube' || !youtubeVideoId) return null;
    return getYouTubeEmbedUrl(youtubeVideoId, { autoplay: true });
  }, [layout, youtubeVideoId]);

  const youtubePosterUrl = useMemo(() => {
    if (layout !== 'youtube' || !youtubeVideoId) return null;
    return getYouTubePosterUrl(youtubeVideoId);
  }, [layout, youtubeVideoId]);

  const byline = author
    ? `${author}${feedTitle ? `, ${feedTitle}` : ''}`
    : feedTitle;

  return (
    <div
      className={styles.entryItem}
      data-active={active}
      data-marked={marked ? 'true' : 'false'}
      data-layout={layout}
      onClick={layout === 'youtube' ? undefined : onClick}
      role={layout === 'youtube' ? undefined : 'button'}
      tabIndex={layout === 'youtube' ? undefined : 0}
    >
      {layout === 'youtube' ? (
        <>
          <div className={styles.entryItem_Player}>
            {youtubeVideoId && isYoutubePlaying && youtubeAutoplayUrl ? (
              <iframe
                className={styles.entryItem_Iframe}
                src={youtubeAutoplayUrl}
                title={title || 'YouTube video'}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            ) : (
              <>
                {youtubePosterUrl ? (
                  <Image
                    src={youtubePosterUrl}
                    alt=""
                    fill
                    sizes="(max-width: 745px) 100vw, 376px"
                    quality={60}
                    unoptimized
                    loading="lazy"
                    style={{ objectFit: 'cover' }}
                  />
                ) : null}
                <button
                  type="button"
                  className={styles.entryItem_PlayButton}
                  aria-label={title ? `Play: ${title}` : 'Play video'}
                  onClick={() => setIsYoutubePlaying(true)}
                  disabled={!youtubeVideoId}
                />
              </>
            )}
          </div>

          <div className={styles.entryItem_Body}>
            <div className={styles.entryItem_Header}>
              <div className={styles.entryItem_Title}>
                {title || '(untitled)'}
              </div>
              <div className={styles.entryItem_Meta}>
                <span>
                  <FormattedDate date={publishedAt} />
                  {' — '}
                </span>
                <span>By </span>
                {byline ? (
                  <i className={styles.entryItem_FromText}>{byline}</i>
                ) : null}
              </div>
            </div>
          </div>
        </>
      ) : isSocialLayout ? (
        <>
          {absoluteSocialThumbnailUrl && !isThumbnailErrored ? (
            <div className={styles.entryItem_Media}>
              <Image
                src={absoluteSocialThumbnailUrl}
                alt=""
                fill
                sizes="(max-width: 745px) 100vw, 420px"
                quality={60}
                unoptimized
                loading="lazy"
                style={{ objectFit: 'cover' }}
                onError={() => setIsThumbnailErrored(true)}
              />
            </div>
          ) : null}

          <div className={styles.entryItem_Body}>
            <div className={styles.entryItem_Header}>
              <div className={styles.entryItem_Title}>
                {title || '(untitled)'}
              </div>
              <div className={styles.entryItem_Meta}>
                <span>
                  <FormattedDate date={publishedAt} />
                  {' — '}
                </span>
                <span>By </span>
                {byline ? (
                  <i className={styles.entryItem_FromText}>{byline}</i>
                ) : null}
              </div>
            </div>
            {socialPreview ? (
              <p className={styles.entryItem_Preview}>{socialPreview}</p>
            ) : null}
          </div>
        </>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
