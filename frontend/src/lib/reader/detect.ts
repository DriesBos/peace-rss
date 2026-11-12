import {
  extractThumbnailFromHtml,
  resolveAbsoluteUrl,
} from '@/lib/entryThumbnail';
import { createEntryPreview } from '@/lib/entryListMeta';

/**
 * Automatic tags: set on a post when it is mirrored.
 * Thresholds are deliberately in one place so they are easy to tune.
 */
export const LONG_FORM_MINUTES = 10;
export const IMAGES_MIN_COUNT = 3;
export const IMAGES_MAX_WORDS = 150;

export const AUTO_TAGS = [
  { slug: 'video', title: 'Video' },
  { slug: 'audio', title: 'Audio' },
  { slug: 'images', title: 'Images' },
  { slug: 'long-form', title: 'Long-form' },
] as const;

export type AutoTagSlug = (typeof AUTO_TAGS)[number]['slug'];

export type Enclosure = {
  url?: string;
  mime_type?: string;
};

export type DetectableEntry = {
  url?: string;
  content?: string;
  reading_time?: number;
  enclosures?: Enclosure[] | null;
};

const VIDEO_HOSTS = [
  'youtube.com',
  'youtu.be',
  'youtube-nocookie.com',
  'vimeo.com',
  'twitch.tv',
  'dailymotion.com',
];

const VIDEO_EMBED_RE =
  /<(?:iframe|embed)\b[^>]*\bsrc\s*=\s*["'][^"']*(?:youtube\.com|youtube-nocookie\.com|youtu\.be|player\.vimeo\.com|player\.twitch\.tv|dailymotion\.com)[^"']*["']/i;
const VIDEO_TAG_RE = /<video\b/i;
const AUDIO_TAG_RE = /<audio\b/i;
const IMG_TAG_RE = /<img\b/gi;

function hostMatches(url: string | undefined, hosts: string[]): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\.|^m\./, '');
    return hosts.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

function hasEnclosure(
  enclosures: Enclosure[] | null | undefined,
  prefix: string,
): boolean {
  return (enclosures ?? []).some((enclosure) =>
    (enclosure.mime_type ?? '').toLowerCase().startsWith(prefix),
  );
}

export function htmlToText(html: string | undefined): string {
  if (!html) return '';
  return html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function countWords(text: string): number {
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

export function detectAutoTags(entry: DetectableEntry): AutoTagSlug[] {
  const tags: AutoTagSlug[] = [];
  const content = entry.content ?? '';

  const isVideo =
    hostMatches(entry.url, VIDEO_HOSTS) ||
    hasEnclosure(entry.enclosures, 'video/') ||
    VIDEO_EMBED_RE.test(content) ||
    VIDEO_TAG_RE.test(content);
  if (isVideo) tags.push('video');

  const isAudio =
    hasEnclosure(entry.enclosures, 'audio/') || AUDIO_TAG_RE.test(content);
  if (isAudio) tags.push('audio');

  if (!isVideo && !isAudio) {
    const imageCount = content.match(IMG_TAG_RE)?.length ?? 0;
    if (
      imageCount >= IMAGES_MIN_COUNT &&
      countWords(htmlToText(content)) < IMAGES_MAX_WORDS
    ) {
      tags.push('images');
    }
  }

  if ((entry.reading_time ?? 0) >= LONG_FORM_MINUTES) tags.push('long-form');

  return tags;
}

export type DerivedEntryFields = {
  thumbnailUrl: string | null;
  preview: string | null;
  contentText: string;
  autoTags: AutoTagSlug[];
};

const MAX_SEARCH_TEXT_LENGTH = 20000;

export function deriveEntryFields(entry: DetectableEntry): DerivedEntryFields {
  const imageEnclosure = (entry.enclosures ?? []).find((enclosure) =>
    (enclosure.mime_type ?? '').toLowerCase().startsWith('image/'),
  );
  const thumbnail =
    resolveAbsoluteUrl(extractThumbnailFromHtml(entry.content), entry.url) ||
    imageEnclosure?.url ||
    null;

  return {
    thumbnailUrl: thumbnail,
    preview: createEntryPreview(entry.content, 200) || null,
    contentText: htmlToText(entry.content).slice(0, MAX_SEARCH_TEXT_LENGTH),
    autoTags: detectAutoTags(entry),
  };
}
