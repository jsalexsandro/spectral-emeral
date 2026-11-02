type RateLimitBucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, RateLimitBucket>()
const MAX_BUCKETS = 10_000

export type RateLimitResult =
  | { ok: true; remaining: number; resetAt: number }
  | { ok: false; retryAfterMs: number; resetAt: number }

function pruneExpired(now: number) {
  if (buckets.size < MAX_BUCKETS) {
    return
  }

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key)
    }
  }
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  pruneExpired(now)

  const bucket = buckets.get(key)

  if (!bucket || bucket.resetAt <= now) {
    const resetAt = now + windowMs
    buckets.set(key, { count: 1, resetAt })

    return { ok: true, remaining: limit - 1, resetAt }
  }

  if (bucket.count >= limit) {
    return {
      ok: false,
      retryAfterMs: Math.max(0, bucket.resetAt - now),
      resetAt: bucket.resetAt,
    }
  }

  bucket.count += 1

  return {
    ok: true,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
  }
}

export function resetRateLimit(key?: string) {
  if (key === undefined) {
    buckets.clear()
    return
  }

  buckets.delete(key)
}
