export const SOCIAL_PLATFORMS = ['instagram', 'twitter'] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export type SocialFeedRequestInput = {
  platform?: unknown;
  handle?: unknown;
  login_username?: unknown;
  login_password?: unknown;
};

export type NormalizedSocialFeedInput = {
  platform: SocialPlatform;
  handle: string;
  loginUsername?: string;
  loginPassword?: string;
};

export type SocialFeedTokenPayload = {
  version: 1;
  platform: SocialPlatform;
  handle: string;
  bridgeFeedUrl: string;
  bridgeLoginUsername?: string;
  bridgeLoginPassword?: string;
};
