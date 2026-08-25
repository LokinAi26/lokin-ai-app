import { createClientFromRequest } from "npm:@base44/sdk";
import { filterAndRank, rankByMode, trueEarningRate, OPTIMIZATION_MODES } from "../../shared/delivery.js";

const MAPBOX_GEOCODE = "https://api.mapbox.com/search/geocode/v6";
const MAX_OFFERS = 30;
const MAX_RADIUS_MILES = 55;
const ZONE_STEP_DEGREES = 0.012;
const VIRGINIA_BEACH_ORIGIN = { longitude: -75.978, latitude: 36.8529 };
const TRUSTED_SOURCES = new Set(["user_entered", "user_shared", "official_api", "merchant_feed"]);
const TRUSTED_VERIFICATION = new Set(["address_verified", "platform_verified"]);

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

function mapboxToken() {
  return (Deno.env.get("MAPBOX_ACCESS_TOKEN") || Deno.env.get("MAPBOX_TOKEN") || "").trim();
}

function validCoordinate(value: any) {
  const longitude = Number(value?.longitude ?? value?.lng ?? value?.lon);
  const latitude = Number(value?.latitude ?? value?.lat);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) return null;
  return { longitude, latitude };
}

function milesBetween(a: { longitude: number; latitude: number }, b: { longitude: number; latitude: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const lat1 = a.latitude * rad;
  const lat2 = b.latitude * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 3958.7613 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function localSearchBBox(origin: { longitude: number; latitude: number }, radiusMiles = MAX_RADIUS_MILES) {
  const latDelta = radiusMiles / 69;
  const cosLat = Math.max(0.25, Math.cos((origin.latitude * Math.PI) / 180));
  const lonDelta = radiusMiles / (69 * cosLat);
  return [
    origin.longitude - lonDelta,
    origin.latitude - latDelta,
    origin.longitude + lonDelta,
    origin.latitude + latDelta,
  ].map((value, index) => index % 2 === 0
    ? Math.max(-180, Math.min(180, value))
    : Math.max(-90, Math.min(90, value)));
}

async function geocodeAddress(address: string, accessToken: string, origin: any) {
  const query = String(address || "").trim();
  if (!query) return null;

  const params = new URLSearchParams({
    q: query,
    access_token: accessToken,
    limit: "1",
    autocomplete: "false",
    country: "us",
    permanent: "false",
    types: "address,place,postcode",
  });
  if (origin) {
    params.set("proximity", `${origin.longitude},${origin.latitude}`);
    params.set("bbox", localSearchBBox(origin).join(","));
  }

  const response = await fetch(`${MAPBOX_GEOCODE}/forward?${params.toString()}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || `Mapbox geocoding failed (${response.status})`);

  const feature = data?.features?.[0];
  const coordinates = feature?.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;

  const point = { longitude: Number(coordinates[0]), latitude: Number(coordinates[1]) };
  if (!validCoordinate(point)) return null;
  const distanceMiles = origin ? milesBetween(origin, point) : null;
  if (origin && Number(distanceMiles) > MAX_RADIUS_MILES) return null;

  return {
    ...point,
    distance_miles: distanceMiles,
    label: feature?.properties?.full_address || feature?.place_name || query,
  };
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

function isCurrentTrustedOffer(offer: any, marketState = "") {
  if (offer?.status && offer.status !== "available") return false;
  if (!TRUSTED_SOURCES.has(String(offer?.source_type || ""))) return false;
  if (!TRUSTED_VERIFICATION.has(String(offer?.verification_status || ""))) return false;
  if (marketState && String(offer?.state_code || "").toUpperCase() !== marketState) return false;

  const capturedAt = Date.parse(String(offer?.captured_at || ""));
  const expiresAt = Date.parse(String(offer?.expires_at || ""));
  if (!Number.isFinite(capturedAt) || !Number.isFinite(expiresAt)) return false;
  if (capturedAt > Date.now() + 5 * 60000) return false;
  if (expiresAt <= Date.now()) return false;
  return true;
}

function freshness(updatedAt: string | null) {
  const timestamp = updatedAt ? Date.parse(updatedAt) : NaN;
  if (!Number.isFinite(timestamp)) return { state: "unknown", age_minutes: null };
  const ageMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  return {
    state: ageMinutes <= 15 ? "live" : ageMinutes <= 180 ? "recent" : "stale",
    age_minutes: ageMinutes,
  };
}

function modeScore(zone: any, mode: string, origin: any) {
  if (mode === "fastest") return 1 / Math.max(1, zone.avg_minutes);
  if (mode === "most_money") return zone.projected_gross;
  if (mode === "goal_mode") return zone.projected_net;
  if (mode === "low_stress") return 1 / Math.max(1, zone.avg_miles + zone.avg_minutes / 10);
  if (mode === "minimum_mileage") return 1 / Math.max(0.25, zone.avg_miles);
  if (mode === "homeward" && origin) {
    return 1 / Math.max(0.25, milesBetween(origin, { longitude: zone.longitude, latitude: zone.latitude }));
  }
  return zone.net_per_hour;
}

export default async function hotspotMap(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return json({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);

    const body = await req.json().catch(() => ({}));
    const accessToken = mapboxToken();
    if (!accessToken) {
      return json({
        error: "Real hotspot geocoding is not active. Add MAPBOX_ACCESS_TOKEN in Base44 secrets.",
        code: "MAP_PROVIDER_SETUP_REQUIRED",
        required_secret: "MAPBOX_ACCESS_TOKEN",
      }, 503);
    }

    let origin = validCoordinate(body?.origin);
    const originAddress = String(body?.origin_address || "").trim();
    if (!origin && originAddress) {
      const geocodedOrigin = await geocodeAddress(originAddress, accessToken, null);
      origin = geocodedOrigin
        ? { longitude: geocodedOrigin.longitude, latitude: geocodedOrigin.latitude }
        : null;
    }
    const marketState = String(body?.market_state || "VA").trim().toUpperCase() === "VA" ? "VA" : "";
    if (!origin && marketState === "VA") origin = VIRGINIA_BEACH_ORIGIN;
    const mode = OPTIMIZATION_MODES.some((item: any) => item.value === body?.mode) ? body.mode : "most_profit";
    const selectedOfferIds = new Set(
      Array.isArray(body?.selected_offer_ids)
        ? body.selected_offer_ids.slice(0, MAX_OFFERS).map((id: any) => String(id))
        : [],
    );

    const [allOffers, preferenceRows, blocked, avoidPlaces] = await Promise.all([
      base44.entities.Offer.filter({ status: "available" }),
      base44.entities.DriverPreference.filter({}),
      base44.entities.BlockedCustomer.filter({}),
      base44.entities.AvoidPlace.filter({}),
    ]);

    const preferences = preferenceRows[0] || {
      accepted_categories: ["food_pickup", "grocery_shop_deliver", "grocery_pickup", "retail", "package"],
      min_payout: 6,
      max_miles: 12,
      min_per_hour: 22,
      vehicle_mpg: 26,
      gas_price: 3.45,
      mileage_cost: 0.67,
    };

    const currentOffers = allOffers.filter((offer: any) => isCurrentTrustedOffer(offer, marketState));
    const eligible = filterAndRank(currentOffers, preferences, blocked, avoidPlaces);
    const ranked = rankByMode(eligible, mode, originAddress).slice(0, MAX_OFFERS);
    const geocoded = await mapWithConcurrency(ranked, 4, async (offer: any) => {
      try {
        const point = await geocodeAddress(offer.pickup_address, accessToken, origin);
        return point ? { offer, point, rate: offer._score || trueEarningRate(offer, preferences) } : null;
      } catch {
        return null;
      }
    });

    const located = geocoded.filter(Boolean) as any[];
    const buckets = new Map<string, any>();
    for (const item of located) {
      const x = Math.round(item.point.longitude / ZONE_STEP_DEGREES);
      const y = Math.round(item.point.latitude / ZONE_STEP_DEGREES);
      const key = `${x}:${y}`;
      const zone = buckets.get(key) || {
        id: key,
        latitude_sum: 0,
        longitude_sum: 0,
        offer_count: 0,
        projected_gross: 0,
        projected_net: 0,
        net_per_hour_sum: 0,
        avg_minutes_sum: 0,
        avg_miles_sum: 0,
        merchants: new Set<string>(),
        categories: new Set<string>(),
        offer_ids: [],
        selected_count: 0,
        nearest_distance_miles: null,
      };
      zone.latitude_sum += item.point.latitude;
      zone.longitude_sum += item.point.longitude;
      zone.offer_count += 1;
      zone.projected_gross += Number(item.rate.gross || 0);
      zone.projected_net += Number(item.rate.net || 0);
      zone.net_per_hour_sum += Number(item.rate.netPerHour || 0);
      zone.avg_minutes_sum += Number(item.offer.est_minutes || 0);
      zone.avg_miles_sum += Number(item.offer.miles || 0);
      zone.merchants.add(String(item.offer.merchant || "Merchant"));
      zone.categories.add(String(item.offer.category || ""));
      zone.offer_ids.push(String(item.offer.id));
      if (selectedOfferIds.has(String(item.offer.id))) zone.selected_count += 1;
      if (Number.isFinite(item.point.distance_miles)) {
        zone.nearest_distance_miles = zone.nearest_distance_miles == null
          ? item.point.distance_miles
          : Math.min(zone.nearest_distance_miles, item.point.distance_miles);
      }
      buckets.set(key, zone);
    }

    let zones = [...buckets.values()].map((zone: any) => {
      const count = Math.max(1, zone.offer_count);
      const merchants = [...zone.merchants];
      const result = {
        id: zone.id,
        latitude: Number((zone.latitude_sum / count).toFixed(6)),
        longitude: Number((zone.longitude_sum / count).toFixed(6)),
        name: merchants.length === 1 ? merchants[0] : `${merchants[0]} + ${merchants.length - 1} nearby`,
        merchants: merchants.slice(0, 5),
        categories: [...zone.categories].filter(Boolean),
        offer_ids: zone.offer_ids,
        offer_count: count,
        selected_count: zone.selected_count,
        projected_gross: Number(zone.projected_gross.toFixed(2)),
        projected_net: Number(zone.projected_net.toFixed(2)),
        net_per_hour: Number((zone.net_per_hour_sum / count).toFixed(2)),
        avg_minutes: Number((zone.avg_minutes_sum / count).toFixed(1)),
        avg_miles: Number((zone.avg_miles_sum / count).toFixed(1)),
        distance_miles: Number.isFinite(zone.nearest_distance_miles)
          ? Number(zone.nearest_distance_miles.toFixed(1))
          : null,
      };
      return { ...result, mode_score: modeScore(result, mode, origin) };
    });

    const maxScore = Math.max(...zones.map((zone: any) => Number(zone.mode_score || 0)), 0);
    zones = zones
      .map((zone: any) => ({
        ...zone,
        intensity: maxScore > 0 ? Math.max(0.12, Math.min(1, zone.mode_score / maxScore)) : 0.12,
      }))
      .sort((a: any, b: any) => b.mode_score - a.mode_score);

    const newestUpdate = ranked
      .map((offer: any) => offer.captured_at || null)
      .filter(Boolean)
      .sort()
      .at(-1) || null;
    const status = freshness(newestUpdate);

    return json({
      ok: true,
      mode,
      generated_at: new Date().toISOString(),
      source: {
        kind: "authenticated_offer_records",
        provider: "mapbox",
        freshness: status.state,
        age_minutes: status.age_minutes,
        newest_offer_at: newestUpdate,
        market_state: marketState || "CURRENT_LOCATION",
        active_verified_offers: currentOffers.length,
        excluded_untrusted_or_expired: Math.max(0, allOffers.length - currentOffers.length),
        eligible_offers: eligible.length,
        located_offers: located.length,
        skipped_unlocated: Math.max(0, ranked.length - located.length),
        radius_miles: origin ? MAX_RADIUS_MILES : null,
        privacy: "Merchant pickup locations only; customer and drop-off locations are excluded.",
      },
      center: origin || (zones[0] ? { longitude: zones[0].longitude, latitude: zones[0].latitude } : null),
      zones,
    });
  } catch (error) {
    return json({
      error: error instanceof Error ? error.message : "Could not build the real hotspot map",
      code: "HOTSPOT_MAP_FAILED",
    }, 500);
  }
}
