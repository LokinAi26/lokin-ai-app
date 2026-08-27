import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { getDriverProvider, normalizeDriverProviderKey } from "../../shared/driverProviderRegistry.js";

const CATEGORIES = new Set(["food_pickup", "grocery_shop_deliver", "grocery_pickup", "retail", "package", "alcohol", "pharmacy"]);
const PLATFORMS = new Set(["doordash", "uber_eats", "instacart", "spark", "shipt", "grubhub", "amazon_flex", "roadie", "other"]);
const SOURCE_TYPES = new Set(["official_api", "merchant_feed"]);
const MAX_RECORDS = 100;
const MAX_LIFETIME_MS = 4 * 60 * 60 * 1000;

function clean(value: unknown, max = 300) {
  return String(value ?? "").trim().slice(0, max);
}

function bounded(value: unknown, name: string, min: number, max: number) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw new Error(`${name} must be between ${min} and ${max}`);
  return number;
}

function safeIso(value: unknown, fallback: Date) {
  const raw = clean(value, 80);
  const parsed = raw ? Date.parse(raw) : NaN;
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback.toISOString();
}

function allowlist() {
  return new Set(
    String(Deno.env.get("LOKIN_DRIVER_PROVIDER_ALLOWLIST") || "")
      .split(",")
      .map((value) => normalizeDriverProviderKey(value))
      .filter(Boolean),
  );
}

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function expectedSignature(secret: string, rawBody: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  return `sha256=${hex(signature)}`;
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function normalizeRecord(input: any, receivedAt: Date) {
  const platform = normalizeDriverProviderKey(input?.platform);
  const provider = getDriverProvider(platform);
  if (!provider || !PLATFORMS.has(platform)) throw new Error("Unsupported provider platform");
  if (!allowlist().has(platform)) throw new Error(`Provider ${platform} is not activated in the signed-ingest allowlist`);

  const sourceType = clean(input?.source_type, 40);
  if (!SOURCE_TYPES.has(sourceType)) throw new Error("source_type must be official_api or merchant_feed");
  const visibility = input?.visibility === "market" ? "market" : "private";
  const ownerUserId = clean(input?.owner_user_id, 120);
  if (visibility === "private" && !ownerUserId) throw new Error("owner_user_id is required for private provider data");

  const eventId = clean(input?.provider_event_id, 180);
  if (!eventId) throw new Error("provider_event_id is required for idempotency");
  const merchant = clean(input?.merchant, 140);
  const category = clean(input?.category, 50);
  const pickupAddress = clean(input?.pickup_address, 320);
  const dropoffAddress = clean(input?.dropoff_address, 320);
  if (!merchant || !CATEGORIES.has(category) || !pickupAddress || !dropoffAddress) {
    throw new Error("merchant, supported category, pickup_address, and dropoff_address are required");
  }

  const capturedAt = safeIso(input?.captured_at, receivedAt);
  const defaultExpiry = new Date(Math.min(Date.parse(capturedAt) + 90 * 60_000, receivedAt.getTime() + MAX_LIFETIME_MS));
  const expiresAt = safeIso(input?.expires_at, defaultExpiry);
  const capturedMs = Date.parse(capturedAt);
  const expiresMs = Date.parse(expiresAt);
  if (expiresMs <= capturedMs) throw new Error("expires_at must be after captured_at");
  if (expiresMs - receivedAt.getTime() > MAX_LIFETIME_MS) throw new Error("provider offer lifetime may not exceed four hours from receipt");

  const sourceAccountId = clean(input?.source_account_id, 160);
  const sourceReference = clean(input?.source_reference, 180);
  const payout = bounded(input?.payout, "payout", 0.01, 5000);
  const tip = input?.tip == null ? 0 : bounded(input?.tip, "tip", 0, 5000);
  const miles = bounded(input?.miles, "miles", 0.1, 2000);
  const estimatedMinutes = bounded(input?.est_minutes, "est_minutes", 1, 1440);

  return {
    owner_user_id: visibility === "private" ? ownerUserId : "",
    visibility,
    provider_event_id: eventId,
    provider_sync_id: clean(input?.provider_sync_id, 180),
    source_account_id: visibility === "private" ? sourceAccountId : "",
    source_received_at: receivedAt.toISOString(),
    merchant,
    customer_name: visibility === "private" ? clean(input?.customer_name, 120) : "",
    category,
    platform,
    payout,
    tip,
    miles,
    est_minutes: estimatedMinutes,
    pickup_address: pickupAddress,
    dropoff_address: dropoffAddress,
    state_code: clean(input?.state_code, 2).toUpperCase(),
    postal_code: clean(input?.postal_code, 12),
    region: clean(input?.region, 100),
    source_type: sourceType,
    source_reference: sourceReference,
    source_disclosure: `${provider.label} data received through a server-side adapter activated by LOKIN after provider authorization. LOKIN does not auto-accept or manipulate platform offers.`,
    verification_status: "platform_verified",
    captured_at: capturedAt,
    expires_at: expiresAt,
    capture_id: `provider:${platform}:${eventId}`.slice(0, 240),
    store_hours: clean(input?.store_hours, 80),
    items_count: Math.round(Math.max(1, Math.min(1000, Number(input?.items_count || 1)))),
    status: "available",
  };
}

export default async function ingestAuthorizedProviderOffer(req: Request) {
  try {
    if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
    const secret = String(Deno.env.get("LOKIN_PARTNER_INGEST_SECRET") || "");
    if (!secret) return Response.json({ error: "Authorized provider ingestion is not configured" }, { status: 503 });

    const rawBody = await req.text();
    const supplied = String(req.headers.get("x-lokin-signature") || "");
    const expected = await expectedSignature(secret, rawBody);
    if (!supplied || !timingSafeEqual(supplied, expected)) {
      return Response.json({ error: "Invalid provider signature" }, { status: 401 });
    }

    const body = JSON.parse(rawBody || "{}");
    const inputs = Array.isArray(body?.offers) ? body.offers : body?.offer ? [body.offer] : body?.platform ? [body] : [];
    if (!inputs.length) return Response.json({ error: "One offer or an offers array is required" }, { status: 400 });
    if (inputs.length > MAX_RECORDS) return Response.json({ error: `Maximum ${MAX_RECORDS} offers per request` }, { status: 413 });

    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole;
    const receivedAt = new Date();
    const accepted = [];
    const duplicates = [];
    const rejected = [];

    for (let index = 0; index < inputs.length; index += 1) {
      try {
        const normalized = normalizeRecord(inputs[index], receivedAt);
        const existing = await db.entities.Offer.filter({
          platform: normalized.platform,
          provider_event_id: normalized.provider_event_id,
        });
        if (existing?.[0]) {
          duplicates.push({ index, provider_event_id: normalized.provider_event_id, id: existing[0].id });
          continue;
        }
        const created = await db.entities.Offer.create(normalized);
        accepted.push({ index, provider_event_id: normalized.provider_event_id, id: created.id });
      } catch (error) {
        rejected.push({ index, error: error instanceof Error ? error.message : "Invalid provider offer" });
      }
    }

    return Response.json({
      ok: rejected.length === 0,
      accepted,
      duplicates,
      rejected,
      counts: { accepted: accepted.length, duplicates: duplicates.length, rejected: rejected.length },
      safety: { driver_confirmation_required: true, automatic_platform_action: false },
    }, { status: rejected.length ? 207 : 200 });
  } catch (error) {
    console.error("ingest-authorized-provider-offer error", error);
    return Response.json({ error: "Authorized provider ingestion failed" }, { status: 500 });
  }
}
