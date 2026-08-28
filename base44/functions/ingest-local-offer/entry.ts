import { admitEcosystemOperation } from '../../shared/ecosystemAdmission.js';
import { createClientFromRequest } from "npm:@base44/sdk";
import { offerVisibleToUser, privateOfferScope } from "../../shared/offerAccess.js";

const MAPBOX_GEOCODE = "https://api.mapbox.com/search/geocode/v6";
const CATEGORIES = new Set(["food_pickup", "grocery_shop_deliver", "grocery_pickup", "retail", "package", "alcohol", "pharmacy"]);
const PLATFORMS = new Set(["doordash", "uber_eats", "instacart", "spark", "shipt", "grubhub", "amazon_flex", "roadie", "other"]);
const USER_SOURCES = new Set(["user_entered", "user_shared"]);

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

function token() {
  return (Deno.env.get("MAPBOX_ACCESS_TOKEN") || Deno.env.get("MAPBOX_TOKEN") || "").trim();
}

function text(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

function boundedNumber(value: unknown, name: string, min: number, max: number) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new Error(`${name} must be between ${min} and ${max}`);
  }
  return number;
}

function contextValue(feature: any, key: string) {
  const direct = feature?.properties?.context?.[key];
  if (direct) return direct;
  return (feature?.context || []).find((entry: any) => String(entry?.id || "").startsWith(`${key}.`)) || null;
}

function stateCode(feature: any) {
  const region = contextValue(feature, "region");
  const code = region?.region_code || region?.short_code || region?.properties?.short_code || "";
  if (String(code).toUpperCase().endsWith("-VA")) return "VA";
  const label = [
    region?.name,
    region?.text,
    region?.properties?.name,
    feature?.properties?.full_address,
    feature?.place_name,
  ].filter(Boolean).join(" ");
  return /\bVirginia\b|,\s*VA\b/i.test(label) ? "VA" : "";
}

function postalCode(feature: any) {
  const postcode = contextValue(feature, "postcode");
  return text(postcode?.name || postcode?.text || postcode?.properties?.name || "", 12);
}

function marketLabel(feature: any) {
  const place = contextValue(feature, "place");
  const locality = contextValue(feature, "locality");
  const name = text(locality?.name || locality?.text || place?.name || place?.text || "Virginia", 80);
  return `${name}, VA`;
}

async function geocodeVirginia(address: string, accessToken: string) {
  const params = new URLSearchParams({
    q: address,
    access_token: accessToken,
    limit: "3",
    autocomplete: "false",
    country: "us",
    permanent: "false",
    types: "address",
    bbox: "-83.6753,36.5407,-75.2423,39.4660",
  });
  const response = await fetch(`${MAPBOX_GEOCODE}/forward?${params.toString()}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || `Mapbox geocoding failed (${response.status})`);

  const feature = (data?.features || []).find((candidate: any) => stateCode(candidate) === "VA");
  if (!feature) throw new Error(`Address could not be verified in Virginia: ${address}`);

  const coordinates = feature?.geometry?.coordinates || [];
  if (!Number.isFinite(Number(coordinates[0])) || !Number.isFinite(Number(coordinates[1]))) {
    throw new Error(`Address has no verified map coordinate: ${address}`);
  }
  return {
    longitude: Number(coordinates[0]),
    latitude: Number(coordinates[1]),
    full_address: text(feature?.properties?.full_address || feature?.place_name || address, 300),
    state_code: "VA",
    postal_code: postalCode(feature),
    region: marketLabel(feature),
  };
}

export default async function ingestLocalOffer(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return json({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
    await admitEcosystemOperation(base44, { sourceApp:'LOKIN AI', domain:'provider', type:'provider_request', operation:'local_offer_geocode', priority:80, estimatedMs:5000, realtime:true, background:false, tags:['provider','realtime'] });

    const accessToken = token();
    if (!accessToken) {
      return json({
        error: "Virginia offer verification requires MAPBOX_ACCESS_TOKEN in Base44 secrets.",
        code: "MAP_PROVIDER_SETUP_REQUIRED",
      }, 503);
    }

    const body = await req.json().catch(() => ({}));
    const merchant = text(body?.merchant, 120);
    const pickupAddress = text(body?.pickup_address, 300);
    const dropoffAddress = text(body?.dropoff_address, 300);
    const category = text(body?.category, 40);
    const platform = PLATFORMS.has(text(body?.platform, 40)) ? text(body?.platform, 40) : "other";
    const sourceType = USER_SOURCES.has(text(body?.source_type, 40)) ? text(body?.source_type, 40) : "user_entered";
    const captureId = text(body?.capture_id, 100);

    if (!merchant) return json({ error: "Merchant is required", code: "INVALID_OFFER" }, 400);
    if (!pickupAddress || !dropoffAddress) {
      return json({ error: "Virginia pickup and drop-off addresses are required", code: "INVALID_OFFER" }, 400);
    }
    if (!CATEGORIES.has(category)) {
      return json({ error: "Select a supported delivery category", code: "INVALID_OFFER" }, 400);
    }

    const payout = boundedNumber(body?.payout, "Payout", 0.01, 500);
    const tip = body?.tip === "" || body?.tip == null ? 0 : boundedNumber(body.tip, "Tip", 0, 500);
    const miles = boundedNumber(body?.miles, "Miles", 0.1, 500);
    const estimatedMinutes = boundedNumber(body?.est_minutes, "Estimated minutes", 1, 1440);
    const expirationMinutes = Math.round(Math.max(15, Math.min(240, Number(body?.expires_in_minutes || 90))));

    if (captureId) {
      const duplicates = await base44.entities.Offer.filter({ capture_id: captureId });
      const duplicate = duplicates.find((offer: any) => offerVisibleToUser(offer, String(user.id)));
      if (duplicate) {
        return json({ ok: true, duplicate: true, offer: duplicate });
      }
    }

    const [pickup, dropoff] = await Promise.all([
      geocodeVirginia(pickupAddress, accessToken),
      geocodeVirginia(dropoffAddress, accessToken),
    ]);

    const capturedAt = new Date();
    const expiresAt = new Date(capturedAt.getTime() + expirationMinutes * 60000);
    const offer = await base44.entities.Offer.create({
      ...privateOfferScope(String(user.id)),
      merchant,
      category,
      platform,
      payout,
      tip,
      miles,
      est_minutes: estimatedMinutes,
      pickup_address: pickup.full_address,
      dropoff_address: dropoff.full_address,
      state_code: "VA",
      postal_code: pickup.postal_code,
      region: pickup.region,
      source_type: sourceType,
      source_reference: text(body?.source_reference, 160),
      source_disclosure: sourceType === "user_shared"
        ? "Shared by an authenticated LOKIN user. Virginia addresses were verified; platform availability and payout were not independently verified."
        : "Entered by an authenticated LOKIN user. Virginia addresses were verified; platform availability and payout were not independently verified.",
      verification_status: "address_verified",
      captured_at: capturedAt.toISOString(),
      source_received_at: capturedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      capture_id: captureId || crypto.randomUUID(),
      store_hours: text(body?.store_hours, 80),
      items_count: Math.round(Math.max(1, Math.min(500, Number(body?.items_count || 1)))),
      status: "available",
    });

    return json({
      ok: true,
      duplicate: false,
      offer: {
        id: offer.id,
        merchant: offer.merchant,
        platform: offer.platform,
        category: offer.category,
        payout: offer.payout,
        tip: offer.tip,
        miles: offer.miles,
        est_minutes: offer.est_minutes,
        pickup_address: offer.pickup_address,
        dropoff_address: offer.dropoff_address,
        region: offer.region,
        verification_status: offer.verification_status,
        captured_at: offer.captured_at,
        expires_at: offer.expires_at,
        source_disclosure: offer.source_disclosure,
      },
    }, 201);
  } catch (error) {
    return json({
      error: error instanceof Error ? error.message : "Could not ingest the Virginia offer",
      code: "OFFER_INGEST_FAILED",
    }, 400);
  }
}
