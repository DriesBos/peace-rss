import {
  extractThumbnailFromHtml,
  resolveAbsoluteUrl,
} from '@/lib/entryThumbnail';

type EntryEnclosure = {
  url?: string;
  mime_type?: string;
};

type EntryWithContent = {
  content?: string;
  url?: string;
  enclosures?: EntryEnclosure[] | null;
};

const IMAGE_EXTENSION_PATTERN = /\.(?:jpe?g|png|webp|gif|avif)$/i;

function isImageEnclosure(enclosure: EntryEnclosure): boolean {
  if (!enclosure.url) return false;
  if (enclosure.mime_type?.toLowerCase().startsWith('image/')) return true;
  try {
    return IMAGE_EXTENSION_PATTERN.test(new URL(enclosure.url).pathname);
  } catch {
    return false;
  }
}

function getEnclosureWidth(url: string): number {
  try {
    const width = Number(new URL(url).searchParams.get('width'));
    return Number.isFinite(width) ? width : 0;
  } catch {
    return 0;
  }
}

/**
 * Feeds like The Guardian put the article image in media:content, which
 * Miniflux exposes as enclosures rather than inside the entry HTML.
 * Prefer the widest one when a feed ships several sizes.
 */
export function extractThumbnailFromEnclosures(
  enclosures: EntryEnclosure[] | null | undefined,
): string | null {
  if (!Array.isArray(enclosures)) return null;

  const images = enclosures.filter(isImageEnclosure);
  if (images.length === 0) return null;

  return images.reduce((best, current) =>
    getEnclosureWidth(current.url!) > getEnclosureWidth(best.url!)
      ? current
      : best,
  ).url!;
}

export type EntryListMeta = {
  preview?: string;
  thumbnail_url?: string;
};

export function createEntryPreview(
  htmlContent: string | undefined,
  maxLength = 200,
): string {
  if (!htmlContent) return '';

  let textOnly = htmlContent
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();

  textOnly = textOnly.replace(/&#(\d+);/g, (_, dec) =>
    String.fromCharCode(parseInt(dec, 10)),
  );
  textOnly = textOnly.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16)),
  );

  const words = textOnly.split(/\s+/).filter(Boolean);
  if (words.length < 3) return '';

  const fullText = words.join(' ');
  if (fullText.length <= maxLength) return fullText;

  const truncated = fullText.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return `${lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated}…`;
}

export function getEntryListMeta(entry: EntryWithContent): EntryListMeta {
  const thumbnail = resolveAbsoluteUrl(
    extractThumbnailFromEnclosures(entry.enclosures) ??
      extractThumbnailFromHtml(entry.content),
    entry.url,
  );

  return {
    preview: createEntryPreview(entry.content, 200) || undefined,
    thumbnail_url: thumbnail || undefined,
  };
}

export function withEntryListMeta<T extends EntryWithContent>(
  entry: T,
): T & EntryListMeta {
  return {
    ...entry,
    ...getEntryListMeta(entry),
  };
}
