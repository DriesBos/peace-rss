const YOUTUBE_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

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

  const isYouTubeHost =
    host === 'youtube.com' ||
    host === 'www.youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'youtube-nocookie.com' ||
    host === 'www.youtube-nocookie.com';

  if (!isYouTubeHost) return null;

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

export function getYouTubePosterUrl(videoId: string): string {
  // hqdefault exists reliably; maxresdefault is often missing.
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export function getYouTubeEmbedUrl(videoId: string): string {
  // Privacy-enhanced mode.
  const qs = new URLSearchParams({
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
  });
  return `https://www.youtube-nocookie.com/embed/${videoId}?${qs.toString()}`;
}

