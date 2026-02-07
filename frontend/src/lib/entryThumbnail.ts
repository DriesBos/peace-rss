import { extractYouTubeVideoId, getYouTubePosterUrl } from '@/lib/youtube';

function extractThumbnailRegex(htmlContent: string): string | null {
  const youtubeMatch = htmlContent.match(
    /(https?:\/\/(?:www\.)?youtube\.com\/watch\?[^"'\s>]*v=([a-zA-Z0-9_-]{11})|https?:\/\/youtu\.be\/([a-zA-Z0-9_-]{11})|https?:\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/embed\/([a-zA-Z0-9_-]{11}))/i,
  );
  const youtubeId =
    (youtubeMatch && youtubeMatch[2]) ||
    (youtubeMatch && youtubeMatch[3]) ||
    (youtubeMatch && youtubeMatch[4]) ||
    null;
  if (youtubeId) return getYouTubePosterUrl(youtubeId);

  const ogMatch = htmlContent.match(
    /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i,
  );
  if (ogMatch && ogMatch[1]) return ogMatch[1];

  const videoPosterMatch = htmlContent.match(
    /<video[^>]*poster=["']([^"']+)["']/i,
  );
  if (videoPosterMatch && videoPosterMatch[1]) return videoPosterMatch[1];

  const pictureImgMatch = htmlContent.match(
    /<picture[^>]*>[\s\S]*?<img[^>]*src=["']([^"']+)["']/i,
  );
  if (pictureImgMatch && pictureImgMatch[1]) return pictureImgMatch[1];

  const imgMatch = htmlContent.match(/<img[^>]*src=["']([^"']+)["']/i);
  if (imgMatch && imgMatch[1]) return imgMatch[1];

  return null;
}

export function extractThumbnailFromHtml(
  htmlContent: string | undefined,
): string | null {
  if (!htmlContent) return null;

  let doc: Document;
  try {
    const parser = new DOMParser();
    doc = parser.parseFromString(htmlContent, 'text/html');
  } catch {
    return extractThumbnailRegex(htmlContent);
  }

  const youtubeCandidate = doc.querySelector(
    'iframe[src*="youtube"], iframe[src*="youtu.be"], a[href*="youtube"], a[href*="youtu.be"]',
  );
  const youtubeUrl =
    youtubeCandidate?.getAttribute('src') ??
    youtubeCandidate?.getAttribute('href') ??
    '';
  const youtubeId = youtubeUrl ? extractYouTubeVideoId(youtubeUrl) : null;
  if (youtubeId) {
    return getYouTubePosterUrl(youtubeId);
  }

  const ogImage = doc.querySelector('meta[property="og:image"]');
  if (ogImage) {
    const content = ogImage.getAttribute('content');
    if (content) return content;
  }

  const twitterImage = doc.querySelector(
    'meta[name="twitter:image"], meta[property="twitter:image"]',
  );
  if (twitterImage) {
    const content = twitterImage.getAttribute('content');
    if (content) return content;
  }

  const video = doc.querySelector('video[poster]');
  if (video) {
    const poster = video.getAttribute('poster');
    if (poster) return poster;
  }

  const picture = doc.querySelector('picture');
  if (picture) {
    const img = picture.querySelector('img');
    const pictureImgSrc = img?.getAttribute('src');
    if (pictureImgSrc) return pictureImgSrc;

    const source = picture.querySelector('source[srcset]');
    if (source) {
      const srcset = source.getAttribute('srcset');
      if (srcset) {
        const firstUrl = srcset.split(',')[0].trim().split(/\s+/)[0];
        if (firstUrl) return firstUrl;
      }
    }
  }

  const img = doc.querySelector('img');
  const imgSrc = img?.getAttribute('src');
  if (img && imgSrc) {
    const width = img.getAttribute('width');
    const height = img.getAttribute('height');
    if (width && height) {
      const parsedWidth = parseInt(width, 10);
      const parsedHeight = parseInt(height, 10);
      if (parsedWidth >= 100 && parsedHeight >= 100) {
        return imgSrc;
      }
    } else {
      return imgSrc;
    }
  }

  const videoNoPoster = doc.querySelector('video');
  const videoSrc = videoNoPoster?.getAttribute('src');
  if (videoSrc) return videoSrc;

  return null;
}

export function resolveAbsoluteUrl(
  value: string | null | undefined,
  baseUrl: string | undefined,
): string | null {
  if (!value) return null;

  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }

  if (value.startsWith('//')) {
    return `https:${value}`;
  }

  if (!baseUrl) return value;

  try {
    const parsedBaseUrl = new URL(baseUrl);
    return new URL(value, parsedBaseUrl).href;
  } catch {
    return value;
  }
}
