import type {
  NormalizedSocialFeedInput,
  SocialFeedRequestInput,
  SocialPlatform,
} from './types';

const SUPPORTED_SOCIAL_PLATFORMS = new Set<string>(['instagram', 'twitter']);

const INSTAGRAM_HOSTS = new Set([
  'instagram.com',
  'www.instagram.com',
  'm.instagram.com',
]);

const TWITTER_HOSTS = new Set([
  'x.com',
  'www.x.com',
  'mobile.x.com',
  'twitter.com',
  'www.twitter.com',
  'mobile.twitter.com',
]);

const RESERVED_INSTAGRAM_SEGMENTS = new Set([
  'accounts',
  'about',
  'developer',
  'explore',
  'legal',
  'p',
  'reel',
  'reels',
  'stories',
  'tv',
]);

const RESERVED_TWITTER_SEGMENTS = new Set([
  'compose',
  'explore',
  'hashtag',
  'home',
  'i',
  'intent',
  'login',
  'messages',
  'notifications',
  'search',
  'settings',
  'share',
  'signup',
]);

const INSTAGRAM_HANDLE_RE = /^[a-zA-Z0-9._]{1,30}$/;
const TWITTER_HANDLE_RE = /^[a-zA-Z0-9_]{1,15}$/;

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseMaybeUrl(value: string): URL | null {
  const withScheme = value.startsWith('//') ? `https:${value}` : value;
  const looksLikeUrl = /^https?:\/\//i.test(withScheme);
  if (!looksLikeUrl) return null;
  try {
    return new URL(withScheme);
  } catch {
    return null;
  }
}

function normalizePlatform(value: unknown): SocialPlatform {
  if (typeof value !== 'string') {
    throw new Error('social.platform is required');
  }
  const normalized = value.trim().toLowerCase();
  if (!SUPPORTED_SOCIAL_PLATFORMS.has(normalized)) {
    throw new Error('Unsupported social platform');
  }
  return normalized as SocialPlatform;
}

function normalizeInstagramHandle(rawValue: string): string | null {
  const parsedUrl = parseMaybeUrl(rawValue);
  let candidate = rawValue;

  if (parsedUrl) {
    const host = parsedUrl.hostname.toLowerCase();
    if (!INSTAGRAM_HOSTS.has(host)) return null;
    const segments = parsedUrl.pathname.split('/').filter(Boolean);
    const first = segments[0];
    if (!first) return null;
    if (RESERVED_INSTAGRAM_SEGMENTS.has(first.toLowerCase())) return null;
    candidate = decodeURIComponent(first);
  }

  candidate = candidate.replace(/^@+/, '').trim();
  if (!INSTAGRAM_HANDLE_RE.test(candidate)) return null;
  return candidate.toLowerCase();
}

function normalizeTwitterHandle(rawValue: string): string | null {
  const parsedUrl = parseMaybeUrl(rawValue);
  let candidate = rawValue;

  if (parsedUrl) {
    const host = parsedUrl.hostname.toLowerCase();
    if (!TWITTER_HOSTS.has(host)) return null;
    const segments = parsedUrl.pathname.split('/').filter(Boolean);
    const first = segments[0];
    if (!first) return null;
    if (RESERVED_TWITTER_SEGMENTS.has(first.toLowerCase())) return null;
    candidate = decodeURIComponent(first);
  }

  candidate = candidate.replace(/^@+/, '').trim();
  if (!TWITTER_HANDLE_RE.test(candidate)) return null;
  return candidate.toLowerCase();
}

function normalizeHandle(platform: SocialPlatform, value: unknown): string {
  const rawValue = asNonEmptyString(value);
  if (!rawValue) {
    throw new Error('social.handle is required');
  }

  const normalized =
    platform === 'instagram'
      ? normalizeInstagramHandle(rawValue)
      : normalizeTwitterHandle(rawValue);

  if (!normalized) {
    throw new Error(`Invalid ${platform} handle`);
  }

  return normalized;
}

function normalizeOptionalCredential(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function normalizeSocialInput(
  input: SocialFeedRequestInput
): NormalizedSocialFeedInput {
  const platform = normalizePlatform(input.platform);
  const handle = normalizeHandle(platform, input.handle);
  const loginUsername = normalizeOptionalCredential(input.login_username);
  const loginPassword = normalizeOptionalCredential(input.login_password);

  if ((loginUsername && !loginPassword) || (!loginUsername && loginPassword)) {
    throw new Error(
      'Provide both login username and login password, or leave both empty'
    );
  }

  return {
    platform,
    handle,
    loginUsername,
    loginPassword,
  };
}
