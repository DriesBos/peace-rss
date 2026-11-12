import 'server-only';

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

/**
 * The sync worker needs each user's Miniflux token without a browser
 * session, so the token is stored in reader.accounts, encrypted with
 * AES-256-GCM. Key: READER_TOKEN_SECRET, falling back to MINIFLUX_TOKEN_KEY.
 * If the key ever changes, the token is simply stored again on the
 * user's next request.
 */
function getKey(): Buffer {
  const secret =
    process.env.READER_TOKEN_SECRET || process.env.MINIFLUX_TOKEN_KEY || '';
  if (!secret) {
    throw new Error('READER_TOKEN_SECRET (or MINIFLUX_TOKEN_KEY) is not set');
  }
  return createHash('sha256').update(`reader-token:${secret}`).digest();
}

export function encryptToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const data = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, data]).toString('base64url');
}

export function decryptToken(value: string): string | null {
  try {
    const raw = Buffer.from(value, 'base64url');
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const data = raw.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString(
      'utf8',
    );
  } catch {
    return null;
  }
}
