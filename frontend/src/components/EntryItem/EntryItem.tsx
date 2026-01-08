import styles from './EntryItem.module.sass';
import { FormattedDate } from '../FormattedDate';

type EntryItemProps = {
  title?: string;
  feedTitle?: string;
  author?: string;
  publishedAt?: string;
  content?: string;
  url?: string;
  active?: boolean;
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
    if (img && img.src) return img.src;

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
  if (img && img.src) {
    // Filter out very small images (likely tracking pixels)
    const width = img.getAttribute('width');
    const height = img.getAttribute('height');
    if (width && height) {
      const w = parseInt(width, 10);
      const h = parseInt(height, 10);
      // Skip if smaller than 100x100 (likely tracking pixel)
      if (w >= 100 && h >= 100) {
        return img.src;
      }
    } else {
      // If no size attributes, include it anyway
      return img.src;
    }
  }

  // 5. Fallback: Check for video without poster
  const videoNoPoster = doc.querySelector('video');
  if (videoNoPoster && videoNoPoster.src) {
    return videoNoPoster.src;
  }

  return null;
}

/**
 * Fallback regex-based extraction if DOMParser fails
 */
function extractThumbnailRegex(htmlContent: string): string | null {
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

  // Only show preview if there are at least 6 words
  if (words.length < 6) return '';

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
  onClick,
}: EntryItemProps) {
  // Generate preview from content
  const preview = createPreview(content, 200);
  // Extract thumbnail URL
  const thumbnailUrl = extractThumbnail(content);

  // Resolve relative URLs if needed
  const getAbsoluteUrl = (imageUrl: string | null): string | null => {
    if (!imageUrl) return null;
    // If already absolute, return as is
    if (
      imageUrl.startsWith('http://') ||
      imageUrl.startsWith('https://') ||
      imageUrl.startsWith('//')
    ) {
      return imageUrl;
    }
    // If relative and we have a base URL, resolve it
    if (url) {
      try {
        const baseUrl = new URL(url);
        return new URL(imageUrl, baseUrl.origin).href;
      } catch {
        // If URL parsing fails, return as is
        return imageUrl;
      }
    }
    return imageUrl;
  };

  const absoluteThumbnailUrl = getAbsoluteUrl(thumbnailUrl);

  return (
    <div
      className={styles.entryItem}
      data-active={active}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      <div className={styles.entryItem_Body}>
        <div className={styles.entryItem_Header}>
          <h1>{title}</h1>
          <div className={styles.entryItem_Meta}>
            <p>
              From: <i>{author ? `${author}, ${feedTitle}` : feedTitle}</i>
            </p>
            <p>
              <FormattedDate date={publishedAt} />
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
