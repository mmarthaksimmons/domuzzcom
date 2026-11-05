// Simple in-memory rate limiter
// Limits requests per IP per time window
// For production, consider using Vercel KV or a database-backed solution

interface RateLimitEntry {
  count: number;
  resetAt: number; // timestamp in ms
}

const store = new Map<string, RateLimitEntry>();

/** Clean up expired entries periodically */
const CLEANUP_INTERVAL = 60 * 1000; // 1 minute
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}

/**
 * Check if a given key (typically IP) is within rate limits.
 * Returns { allowed: boolean, remaining: number, resetAt: number }
 */
export function checkRateLimit(
  key: string,
  maxRequests: number = 5,
  windowMs: number = 60 * 60 * 1000 // 1 hour default
): { allowed: boolean; remaining: number; resetAt: number } {
  cleanup();
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    // New window
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: maxRequests - 1, resetAt };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

/**
 * Give a request slot back. Used when a request never reached the expensive
 * work (cache hit, aborted request) or failed upstream, so users do not get
 * locked out because of failed attempts.
 */
export function refundRateLimit(key: string): void {
  const entry = store.get(key);
  if (!entry) return;
  if (Date.now() > entry.resetAt) {
    store.delete(key);
    return;
  }
  entry.count = Math.max(0, entry.count - 1);
}

/**
 * Extract IP from request headers (works on Vercel)
 */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}