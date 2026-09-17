interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export function checkRateLimit(key: string, maxRequests: number, windowSeconds: number): {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + windowSeconds * 1000,
    });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      retryAfterSeconds: 0,
    };
  }

  if (entry.count < maxRequests) {
    entry.count++;
    return {
      allowed: true,
      remaining: maxRequests - entry.count,
      retryAfterSeconds: 0,
    };
  }

  const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
  return {
    allowed: false,
    remaining: 0,
    retryAfterSeconds: Math.max(1, retryAfter),
  };
}
