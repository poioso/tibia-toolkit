import { timingSafeEqual } from "node:crypto";

const LOOPBACK_ADDRESSES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

export function isInternalApiRequest(request, internalToken = "") {
  const remoteAddress = String(request?.socket?.remoteAddress || "").trim();
  if (LOOPBACK_ADDRESSES.has(remoteAddress)) return true;

  const expected = String(internalToken || "").trim();
  if (!expected) return false;

  const authorization = String(request?.headers?.authorization || "").trim();
  const supplied = authorization.replace(/^Bearer\s+/i, "").trim();
  return safeTokenEquals(supplied, expected);
}

export function sanitizeMiniWorldChangeWorld(world) {
  if (!world || typeof world !== "object") return null;

  return {
    name: String(world.name || "").trim(),
    activeMiniWorldChanges: Array.isArray(world.activeMiniWorldChanges)
      ? world.activeMiniWorldChanges.map(sanitizeMiniWorldChange).filter(Boolean)
      : []
  };
}

export function createFixedWindowRateLimiter({ windowMs = 60_000, maxRequests = 90 } = {}) {
  const buckets = new Map();

  return {
    consume(key, now = Date.now()) {
      const normalizedKey = String(key || "unknown");
      const existing = buckets.get(normalizedKey);
      const bucket = !existing || now >= existing.resetAt
        ? { count: 0, resetAt: now + windowMs }
        : existing;

      bucket.count += 1;
      buckets.set(normalizedKey, bucket);

      if (buckets.size > 10_000) {
        pruneExpiredBuckets(buckets, now);
      }

      return {
        allowed: bucket.count <= maxRequests,
        limit: maxRequests,
        remaining: Math.max(0, maxRequests - bucket.count),
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
      };
    },
    clear() {
      buckets.clear();
    }
  };
}

export function getRequestAddress(request, trustProxy = false) {
  if (trustProxy) {
    const forwarded = String(request?.headers?.["x-forwarded-for"] || "")
      .split(",")[0]
      .trim();
    if (forwarded) return forwarded;
  }

  return String(request?.socket?.remoteAddress || "unknown").trim() || "unknown";
}

export function getPublicJsonHeaders(extraHeaders = {}) {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Cross-Origin-Resource-Policy": "same-site",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    ...extraHeaders
  };
}

function sanitizeMiniWorldChange(change) {
  if (!change || typeof change !== "object") return null;

  const name = String(change.name || "").trim();
  if (!name) return null;

  return {
    name,
    displayName: String(change.displayName || name).trim() || name
  };
}

function safeTokenEquals(left, right) {
  const leftBuffer = Buffer.from(String(left || ""), "utf8");
  const rightBuffer = Buffer.from(String(right || ""), "utf8");
  if (leftBuffer.length === 0 || leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function pruneExpiredBuckets(buckets, now) {
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}
