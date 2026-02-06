'use client';

import { useMemo } from 'react';
import styles from './EntryItem.module.sass';
import { FormattedDate } from '../FormattedDate';
import { extractYouTubeVideoId, getYouTubePosterUrl } from '@/lib/youtube';

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
 * Extracts thumbnail URL from HTML content using fallback chain:
 * 1. Open Graph image meta tag
 * 2. First <img> or <picture> or <video> (preferring video poster)
 * @param htmlContent - HTML string to parse
 * @returns Thumbnail URL or null if none found
 */
function extractThumbnail(htmlContent: string | undefined): string | null {
  if (!htmlContent) return null;

  // Try to parse as HTML
  let parser: DOMParser;
  let doc: Document;

  try {
    parser = new DOMParser();
    doc = parser.parseFromString(htmlContent, 'text/html');
  } catch {
    // If parsing fails, fall back to regex
    return extractThumbnailRegex(htmlContent);
  }

  // YouTube: prefer video poster as the list thumbnail.
  const youtubeCandidate = doc.querySelector(
    'iframe[src*="youtube"], iframe[src*="youtu.be"], a[href*="youtube"], a[href*="youtu.be"]'
  );
  const youtubeUrl =
    youtubeCandidate?.getAttribute('src') ??
    youtubeCandidate?.getAttribute('href') ??
    '';
  const youtubeId = youtubeUrl ? extractYouTubeVideoId(youtubeUrl) : null;
  if (youtubeId) {
    return getYouTubePosterUrl(youtubeId);
  }

  // 1. First try: Open Graph image meta tag
  const ogImage = doc.querySelector('meta[property="og:image"]');
  if (ogImage) {
    const content = ogImage.getAttribute('content');
    if (content) return content;
  }

  // Also check for twitter:image
  const twitterImage = doc.querySelector(
    'meta[name="twitter:image"], meta[property="twitter:image"]'
  );
  if (twitterImage) {
    const content = twitterImage.getAttribute('content');
    if (content) return content;
  }

  // 2. Second try: First <video> with poster (smaller size)
  const video = doc.querySelector('video[poster]');
  if (video) {
    const poster = video.getAttribute('poster');
    if (poster) return poster;
  }

  // 3. Third try: First <picture> element with source
  const picture = doc.querySelector('picture');
  if (picture) {
    const img = picture.querySelector('img');
    const pictureImgSrc = img?.getAttribute('src');
    if (pictureImgSrc) return pictureImgSrc;

    // Try source elements
    const source = picture.querySelector('source[srcset]');
    if (source) {
      const srcset = source.getAttribute('srcset');
      if (srcset) {
        // Get first URL from srcset (format: "url width, url width")
        const firstUrl = srcset.split(',')[0].trim().split(/\s+/)[0];
        if (firstUrl) return firstUrl;
      }
    }
  }

  // 4. Fourth try: First <img> element
  const img = doc.querySelector('img');
  const imgSrc = img?.getAttribute('src');
  if (img && imgSrc) {
    // Filter out very small images (likely tracking pixels)
    const width = img.getAttribute('width');
    const height = img.getAttribute('height');
    if (width && height) {
      const w = parseInt(width, 10);
      const h = parseInt(height, 10);
      // Skip if smaller than 100x100 (likely tracking pixel)
      if (w >= 100 && h >= 100) {
        return imgSrc;
      }
    } else {
      // If no size attributes, include it anyway
      return imgSrc;
    }
  }

  // 5. Fallback: Check for video without poster
  const videoNoPoster = doc.querySelector('video');
  const videoSrc = videoNoPoster?.getAttribute('src');
  if (videoSrc) return videoSrc;

  return null;
}

/**
 * Fallback regex-based extraction if DOMParser fails
 */
function extractThumbnailRegex(htmlContent: string): string | null {
  const youtubeMatch = htmlContent.match(
    /(https?:\/\/(?:www\.)?youtube\.com\/watch\?[^"'\s>]*v=([a-zA-Z0-9_-]{11})|https?:\/\/youtu\.be\/([a-zA-Z0-9_-]{11})|https?:\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/embed\/([a-zA-Z0-9_-]{11}))/i
  );
  const youtubeId =
    (youtubeMatch && youtubeMatch[2]) ||
    (youtubeMatch && youtubeMatch[3]) ||
    (youtubeMatch && youtubeMatch[4]) ||
    null;
  if (youtubeId) return getYouTubePosterUrl(youtubeId);

  // Try OG image
  const ogMatch = htmlContent.match(
    /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i
  );
  if (ogMatch && ogMatch[1]) return ogMatch[1];

  // Try video poster
  const videoPosterMatch = htmlContent.match(
    /<video[^>]*poster=["']([^"']+)["']/i
  );
  if (videoPosterMatch && videoPosterMatch[1]) return videoPosterMatch[1];

  // Try picture img
  const pictureImgMatch = htmlContent.match(
    /<picture[^>]*>[\s\S]*?<img[^>]*src=["']([^"']+)["']/i
  );
  if (pictureImgMatch && pictureImgMatch[1]) return pictureImgMatch[1];

  // Try first img
  const imgMatch = htmlContent.match(/<img[^>]*src=["']([^"']+)["']/i);
  if (imgMatch && imgMatch[1]) return imgMatch[1];

  return null;
}

/**
 * Creates a plain text preview from HTML content
 * @param htmlContent - HTML string to convert
 * @param maxLength - Maximum character length (default: 200)
 * @returns Plain text preview with ellipsis if truncated, or empty string if less than 6 words
 */
function createPreview(
  htmlContent: string | undefined,
  maxLength = 200
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

function getAbsoluteUrl(
  imageUrl: string | null,
  baseUrl: string | undefined
): string | null {
  if (!imageUrl) return null;

  if (
    imageUrl.startsWith('http://') ||
    imageUrl.startsWith('https://') ||
    imageUrl.startsWith('//')
  ) {
    return imageUrl;
  }

  if (!baseUrl) return imageUrl;

  try {
    const parsedBaseUrl = new URL(baseUrl);
    return new URL(imageUrl, parsedBaseUrl).href;
  } catch {
    return imageUrl;
  }
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
  const preview = useMemo(() => createPreview(content, 200), [content]);
  const thumbnailUrl = useMemo(() => extractThumbnail(content), [content]);
  const absoluteThumbnailUrl = useMemo(
    () => getAbsoluteUrl(thumbnailUrl, url),
    [thumbnailUrl, url]
  );

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
            <p>
              <FormattedDate date={publishedAt} />
            </p>
            <p>
              By: <i>{author ? `${author}, ${feedTitle}` : feedTitle}</i>
            </p>
          </div>
        </div>
        {preview && <p className={styles.entryItem_Preview}>{preview}</p>}
      </div>
      {absoluteThumbnailUrl && (
        <div className={styles.entryItem_Thumbnail}>
          <img
            src={absoluteThumbnailUrl}
            alt={title || 'Entry thumbnail'}
            loading="lazy"
            onError={(e) => {
              // Hide thumbnail container if image fails to load
              const target = e.currentTarget;
              if (target.parentElement) {
                target.parentElement.style.display = 'none';
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
