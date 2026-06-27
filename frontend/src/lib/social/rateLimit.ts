import 'server-only';

type RateLimitOptions = {
  max: number;
  windowMs: number;
};

type BucketState = {
  count: number;
  resetAt: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

const buckets = new Map<string, BucketState>();
let checksSinceCleanup = 0;
// ponytail: process-local limiter for one self-hosted instance; Redis only if this runs on multiple app replicas.
const MAX_BUCKETS = 5000;

function cleanupExpiredBuckets(now: number) {
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

function setBucket(key: string, bucket: BucketState) {
  buckets.delete(key);
  buckets.set(key, bucket);
  while (buckets.size > MAX_BUCKETS) {
    const oldestKey = buckets.keys().next().value;
    if (oldestKey === undefined) break;
    buckets.delete(oldestKey);
  }
}

export function checkRateLimit(
  key: string,
  options: RateLimitOptions
): RateLimitResult {
  const now = Date.now();
  checksSinceCleanup += 1;
  if (checksSinceCleanup >= 200) {
    cleanupExpiredBuckets(now);
    checksSinceCleanup = 0;
  }

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const fresh: BucketState = {
      count: 1,
      resetAt: now + options.windowMs,
    };
    setBucket(key, fresh);
    return {
      allowed: true,
      remaining: Math.max(0, options.max - fresh.count),
      retryAfterSeconds: 0,
    };
  }

  if (existing.count >= options.max) {
    setBucket(key, existing);
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((existing.resetAt - now) / 1000)
    );
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  existing.count += 1;
  setBucket(key, existing);
  return {
    allowed: true,
    remaining: Math.max(0, options.max - existing.count),
    retryAfterSeconds: 0,
  };
}
