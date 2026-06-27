import {
  extractThumbnailFromHtml,
  resolveAbsoluteUrl,
} from '@/lib/entryThumbnail';

type EntryWithContent = {
  content?: string;
  url?: string;
};

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
