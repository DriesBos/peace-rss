import 'server-only';

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import type { SocialFeedTokenPayload } from './types';

const TOKEN_PREFIX = 'v1';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getTokenKey(): Buffer {
  const secret = process.env.SOCIAL_FEED_TOKEN_SECRET?.trim();
  if (!secret) {
    throw new Error('SOCIAL_FEED_TOKEN_SECRET is not set');
  }
  return createHash('sha256').update(secret).digest();
}

function toBase64Url(value: Buffer): string {
  return value.toString('base64url');
}

function fromBase64Url(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}

export function encodeSocialFeedToken(payload: SocialFeedTokenPayload): string {
  const key = getTokenKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const serialized = JSON.stringify(payload);
  const encrypted = Buffer.concat([
    cipher.update(serialized, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [TOKEN_PREFIX, toBase64Url(iv), toBase64Url(encrypted), toBase64Url(tag)].join(
    '.'
  );
}

export function decodeSocialFeedToken(token: string): SocialFeedTokenPayload {
  const [prefix, ivPart, cipherTextPart, tagPart] = token.split('.');
  if (!prefix || !ivPart || !cipherTextPart || !tagPart || prefix !== TOKEN_PREFIX) {
    throw new Error('Invalid social feed token');
  }

  const key = getTokenKey();
  const iv = fromBase64Url(ivPart);
  const cipherText = fromBase64Url(cipherTextPart);
  const tag = fromBase64Url(tagPart);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(cipherText), decipher.final()]);
  const parsed = JSON.parse(decrypted.toString('utf8')) as Partial<SocialFeedTokenPayload>;

  if (parsed.version !== 1) {
    throw new Error('Unsupported social feed token version');
  }
  if (
    !parsed.platform ||
    !parsed.handle ||
    !parsed.bridgeFeedUrl ||
    typeof parsed.platform !== 'string' ||
    typeof parsed.handle !== 'string' ||
    typeof parsed.bridgeFeedUrl !== 'string'
  ) {
    throw new Error('Invalid social feed token payload');
  }
  if (
    parsed.bridgeLoginUsername !== undefined &&
    typeof parsed.bridgeLoginUsername !== 'string'
  ) {
    throw new Error('Invalid social feed login username');
  }
  if (
    parsed.bridgeLoginPassword !== undefined &&
    typeof parsed.bridgeLoginPassword !== 'string'
  ) {
    throw new Error('Invalid social feed login password');
  }

  return parsed as SocialFeedTokenPayload;
}
