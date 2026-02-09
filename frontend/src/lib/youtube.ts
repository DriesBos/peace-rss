const YOUTUBE_ID_RE = /^[a-zA-Z0-9_-]{11}$/;
const YOUTUBE_HANDLE_RE = /^@?[a-zA-Z0-9._-]{3,30}$/;

function normalizeMaybeUrl(value: string): URL | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return new URL(trimmed);
  } catch {
    // Handle protocol-relative URLs: //youtube.com/watch?v=...
    if (trimmed.startsWith('//')) {
      try {
        return new URL(`https:${trimmed}`);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function isYouTubeHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === 'youtube.com' ||
    host === 'www.youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'youtube-nocookie.com' ||
    host === 'www.youtube-nocookie.com'
  );
}

export function extractYouTubeVideoId(value: string): string | null {
  const url = normalizeMaybeUrl(value);
  if (!url) return null;

  const host = url.hostname.toLowerCase();
  const pathname = url.pathname;

  // youtu.be/<id>
  if (host === 'youtu.be') {
    const id = pathname.replace(/^\/+/, '').split('/')[0] ?? '';
    return YOUTUBE_ID_RE.test(id) ? id : null;
  }

  if (!isYouTubeHost(host)) return null;

  // /watch?v=<id>
  const v = url.searchParams.get('v');
  if (v && YOUTUBE_ID_RE.test(v)) return v;

  // /embed/<id>
  const embedMatch = pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch?.[1] && YOUTUBE_ID_RE.test(embedMatch[1])) return embedMatch[1];

  // /shorts/<id>
  const shortsMatch = pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shortsMatch?.[1] && YOUTUBE_ID_RE.test(shortsMatch[1])) return shortsMatch[1];

  return null;
}

export function isYouTubeFeedUrl(value: string): boolean {
  const url = normalizeMaybeUrl(value);
  if (!url) return false;
  if (!isYouTubeHost(url.hostname)) return false;
  return url.pathname === '/feeds/videos.xml';
}

export function isLikelyYouTubeChannelInput(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (isYouTubeFeedUrl(trimmed)) return true;

  if (
    YOUTUBE_HANDLE_RE.test(trimmed) &&
    !trimmed.includes('/') &&
    !trimmed.includes('://')
  ) {
    return true;
  }

  const url = normalizeMaybeUrl(trimmed);
  if (!url) return false;
  if (!isYouTubeHost(url.hostname)) return false;

  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length === 0) return false;
  const first = segments[0]?.toLowerCase() || '';

  return (
    first.startsWith('@') ||
    first === 'channel' ||
    first === 'c' ||
    first === 'user'
  );
}

export function getYouTubePosterUrl(videoId: string): string {
  // hqdefault exists reliably; maxresdefault is often missing.
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export type YouTubeEmbedOptions = {
  autoplay?: boolean;
  controls?: 0 | 1;
  mute?: boolean;
};

export function getYouTubeEmbedUrl(
  videoId: string,
  options: YouTubeEmbedOptions = {},
): string {
  // Privacy-enhanced mode.
  const qs = new URLSearchParams({
    // Keep related videos scoped and reduce branding noise.
    rel: '0',
    modestbranding: '1',
    color: 'white',
    controls: '1',
    fs: '1',
    loop: '0',
    playsinline: '0',
    // Best-effort to reduce overlays/cards on compact embeds.
    iv_load_policy: '3',
    cc_load_policy: '0',
  });

  if (options.autoplay) qs.set('autoplay', '1');
  if (options.controls !== undefined) qs.set('controls', String(options.controls));
  if (options.mute) qs.set('mute', '1');

  return `https://www.youtube-nocookie.com/embed/${videoId}?${qs.toString()}`;
}
