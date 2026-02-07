import 'server-only';

import { createHash } from 'crypto';
import type { NormalizedSocialFeedInput, SocialFeedTokenPayload } from './types';

function credentialFingerprint(
  loginUsername?: string,
  loginPassword?: string
): string {
  if (!loginUsername || !loginPassword) return 'anon';

  const digest = createHash('sha256')
    .update(`${loginUsername}\n${loginPassword}`)
    .digest('hex');
  return digest.slice(0, 16);
}

export function buildSocialSourceKey(
  platform: string,
  handle: string,
  loginUsername?: string,
  loginPassword?: string
): string {
  return [
    platform.trim().toLowerCase(),
    handle.trim().toLowerCase(),
    credentialFingerprint(loginUsername, loginPassword),
  ].join(':');
}

export function buildSocialSourceKeyFromInput(
  input: NormalizedSocialFeedInput
): string {
  return buildSocialSourceKey(
    input.platform,
    input.handle,
    input.loginUsername,
    input.loginPassword
  );
}

export function buildSocialSourceKeyFromTokenPayload(
  payload: SocialFeedTokenPayload
): string {
  return buildSocialSourceKey(
    payload.platform,
    payload.handle,
    payload.bridgeLoginUsername,
    payload.bridgeLoginPassword
  );
}
