// Best-effort per-caller rate limiting for anonymous endpoints
// (public support form, public AI/geo lookups).
//
// Buckets are in-memory per isolate, so this blunts scripted abuse rather than
// enforcing a hard global quota — the platform gateway may run several
// isolates. When no client IP can be resolved from gateway headers the
// limiter is skipped rather than collapsing all callers into one bucket.

function clientIpFromRequest(req) {
  try {
    const headers = req?.headers;
    const get = (name) => (typeof headers?.get === "function" ? headers.get(name) : null);
    const direct = get("cf-connecting-ip") || get("x-real-ip");
    if (direct && String(direct).trim()) return String(direct).trim();
    const forwarded = get("x-forwarded-for");
    if (forwarded) {
      const first = String(forwarded).split(",")[0].trim();
      if (first) return first;
    }
  } catch {
    // Header access is best-effort; skip limiting on failure.
  }
  return "";
}

const buckets = new Map(); // key -> array of recent hit timestamps

export function checkRateLimit(key, limit, windowMs) {
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((hits[0] + windowMs - now) / 1000)) };
  }
  hits.push(now);
  buckets.set(key, hits);
  // Keep memory bounded when many distinct keys are seen.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
    }
  }
  return { allowed: true, retryAfterSec: 0 };
}

// Returns a 429 Response when the caller is over the limit, or null when the
// request should proceed (allowed, or no client IP could be resolved).
export function rateLimitResponse(req, scope, limit, windowMs) {
  const ip = clientIpFromRequest(req);
  if (!ip) return null;
  const result = checkRateLimit(`${scope}:${ip}`, limit, windowMs);
  if (result.allowed) return null;
  return Response.json(
    { error: "Too many requests. Please try again shortly." },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSec) } },
  );
}