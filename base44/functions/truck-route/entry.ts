import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

const HAZMAT_TYPES = new Set([
  "explosive", "gas", "flammable", "combustible", "organic", "poison", "radioActive",
  "corrosive", "poisonousInhalation", "harmfulToWater", "other", "allhazardousGoods", "explosiveFlammable",
]);

function cleanText(value, max = 400) {
  return String(value || "").trim().slice(0, max);
}

function lbsToKg(lbs) {
  const n = Number(lbs || 0);
  return n > 0 ? Math.max(1, Math.round(n / 2.2046226218)) : 0;
}

function ftToCm(ft) {
  const n = Number(ft || 0);
  return n > 0 ? Math.max(1, Math.round(n * 30.48)) : 0;
}

async function hereJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) {
    const message = data?.title || data?.error_description || data?.message || `HERE request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

async function geocode(address, apiKey) {
  const q = new URLSearchParams({ q: address, limit: "1", apiKey });
  const data = await hereJson(`https://geocode.search.hereapi.com/v1/geocode?${q.toString()}`);
  const item = data?.items?.[0];
  if (!item?.position) throw new Error(`Could not geocode: ${address}`);
  return {
    lat: Number(item.position.lat),
    lng: Number(item.position.lng),
    label: item.address?.label || item.title || address,
  };
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const apiKey = Deno.env.get("HERE_API_KEY");
    if (!apiKey) {
      return Response.json({
        error: "Commercial truck routing is not configured",
        code: "TRUCK_ROUTING_NOT_CONFIGURED",
        required_secret: "HERE_API_KEY",
        provider: "HERE Routing API v8",
      }, { status: 503 });
    }

    const body = await req.json().catch(() => ({}));
    const originAddress = cleanText(body.origin_address);
    const destinationAddress = cleanText(body.destination_address);
    if (!originAddress || !destinationAddress) {
      return Response.json({ error: "Origin and destination are required" }, { status: 400 });
    }

    const vehicles = body.vehicle_id
      ? await base44.entities.TruckVehicle.filter({ id: cleanText(body.vehicle_id, 80), owner_user_id: user.id })
      : await base44.entities.TruckVehicle.filter({ owner_user_id: user.id });
    const vehicle = vehicles?.find((v) => v.status !== "maintenance" && v.status !== "offline") || vehicles?.[0];
    if (!vehicle) return Response.json({ error: "Add a truck profile before requesting a truck route" }, { status: 409 });

    const isHazmat = Boolean(body.hazmat);
    const hazmatType = cleanText(body.hazmat_type, 40);
    if (isHazmat && !HAZMAT_TYPES.has(hazmatType)) {
      return Response.json({
        error: "A valid hazardous-goods routing category is required before calculating a hazmat truck route",
        code: "HAZMAT_ROUTE_CLASS_REQUIRED",
      }, { status: 409 });
    }

    const [origin, destination] = await Promise.all([
      geocode(originAddress, apiKey),
      geocode(destinationAddress, apiKey),
    ]);

    const routeParams = new URLSearchParams({
      transportMode: "truck",
      routingMode: "fast",
      origin: `${origin.lat},${origin.lng}`,
      destination: `${destination.lat},${destination.lng}`,
      return: "summary,polyline,actions,instructions",
      spans: "notices",
      units: "imperial",
      departureTime: new Date().toISOString(),
      apiKey,
    });

    const grossKg = lbsToKg(vehicle.gross_weight_lbs);
    const currentKg = lbsToKg(vehicle.current_weight_lbs || vehicle.gross_weight_lbs);
    const heightCm = ftToCm(vehicle.height_ft);
    const widthCm = ftToCm(vehicle.width_ft);
    const lengthCm = ftToCm(vehicle.length_ft);
    if (grossKg) routeParams.set("vehicle[grossWeight]", String(grossKg));
    if (currentKg) routeParams.set("vehicle[currentWeight]", String(currentKg));
    if (heightCm) routeParams.set("vehicle[height]", String(heightCm));
    if (widthCm) routeParams.set("vehicle[width]", String(widthCm));
    if (lengthCm) routeParams.set("vehicle[length]", String(lengthCm));
    if (isHazmat) routeParams.set("vehicle[shippedHazardousGoods]", hazmatType);

    const data = await hereJson(`https://router.hereapi.com/v8/routes?${routeParams.toString()}`);
    const route = data?.routes?.[0];
    if (!route?.sections?.length) return Response.json({ error: "HERE returned no truck route" }, { status: 422 });

    const sections = route.sections;
    const notices = sections.flatMap((section) => section.notices || []);
    const criticalNotices = notices.filter((notice) => String(notice?.severity || "").toLowerCase() === "critical");
    const distanceM = sections.reduce((sum, section) => sum + Number(section.summary?.length || 0), 0);
    const durationS = sections.reduce((sum, section) => sum + Number(section.summary?.duration || 0), 0);
    const actions = sections.flatMap((section) => section.actions || []).slice(0, 250);

    return Response.json({
      ok: true,
      provider: "HERE Routing API v8",
      transport_mode: "truck",
      calculated_at: new Date().toISOString(),
      origin,
      destination,
      vehicle: {
        id: vehicle.id,
        unit_number: vehicle.unit_number,
        equipment_type: vehicle.equipment_type,
        gross_weight_lbs: vehicle.gross_weight_lbs,
        current_weight_lbs: vehicle.current_weight_lbs,
        height_ft: vehicle.height_ft,
        width_ft: vehicle.width_ft,
        length_ft: vehicle.length_ft,
      },
      route: {
        distance_m: distanceM,
        distance_miles: Math.round((distanceM / 1609.344) * 10) / 10,
        duration_s: durationS,
        duration_minutes: Math.round(durationS / 60),
        polyline: sections[0]?.polyline || null,
        sections: sections.map((section) => ({
          summary: section.summary,
          polyline: section.polyline,
          notices: section.notices || [],
        })),
        actions,
        notices,
        critical_notices: criticalNotices,
        restriction_clear: criticalNotices.length === 0,
      },
      warning: "Truck routing is a planning aid. Drivers remain responsible for posted restrictions, permits, temporary closures, dispatch instructions, and their certified ELD/RODS.",
    });
  } catch (error) {
    console.error("truck-route error", error);
    return Response.json({ error: error?.message || "Truck route calculation failed" }, { status: 500 });
  }
}
