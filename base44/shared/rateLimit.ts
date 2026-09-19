// Entity-backed fixed-window rate limiter for Base44 backend functions.
//
// Backing entity: RateLimitBucket { key_prefix, bucket_key, count, window_start }.
// Counting is approximate under concurrent load — sufficient for abuse prevention.
//
// Usage:
//   import { checkRateLimit } from "../../shared/rateLimit.ts";
//   const rl = await checkRateLimit(base44, req, { key: "public-support-request", limit: 3, windowMs: 60 * 60 * 1000 });
//   if (!rl.allowed) return Response.json({ error: "Too many requests. Please try again later." }, { status: 429 });

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0].trim();
    if (first) return first.slice(0, 64);
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp && realIp.trim()) return realIp.trim().slice(0, 64);
  // No IP headers: fall back to a single shared bucket so the limit still
  // applies globally instead of not at all.
  return "unknown";
}

export interface RateLimitOptions {
  key: string;
  limit: number;
  windowMs: number;
}

export async function checkRateLimit(
  base44: any,
  req: Request,
  opts: RateLimitOptions
): Promise<{ allowed: boolean; retryAfterMs: number }> {
  const ip = getClientIp(req);
  const windowId = Math.floor(Date.now() / opts.windowMs);
  const keyPrefix = `${opts.key}:${ip}`;
  const bucketKey = `${keyPrefix}:${windowId}`;
  const store = base44.asServiceRole.entities.RateLimitBucket;

  const existing = await store.filter({ bucket_key: bucketKey });
  const bucket = existing && existing[0];

  if (!bucket) {
    await store.create({
      key_prefix: keyPrefix,
      bucket_key: bucketKey,
      count: 1,
      window_start: new Date(windowId * opts.windowMs).toISOString(),
    });
    // Best-effort cleanup: drop this key's older windows so buckets stay bounded.
    // Runs once per window per client, not on every request.
    try {
      const prior = await store.filter({ key_prefix: keyPrefix });
      for (const b of prior || []) {
        if (b.bucket_key !== bucketKey) {
          await store.delete(b.id).catch(() => {});
        }
      }
    } catch {
      // Cleanup is best-effort; never block the request on it.
    }
    return { allowed: true, retryAfterMs: 0 };
  }

  if (Number(bucket.count) >= opts.limit) {
    return { allowed: false, retryAfterMs: (windowId + 1) * opts.windowMs - Date.now() };
  }

  await store.update(bucket.id, { count: Number(bucket.count) + 1 });
  return { allowed: true, retryAfterMs: 0 };
}
