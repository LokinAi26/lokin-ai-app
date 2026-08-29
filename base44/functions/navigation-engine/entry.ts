import { admitEcosystemOperation } from '../../shared/ecosystemAdmission.js';
import { createClientFromRequest } from "npm:@base44/sdk@0.8.43";

const MAPBOX_GEOCODE = "https://api.mapbox.com/search/geocode/v6";
const MAPBOX_DIRECTIONS = "https://api.mapbox.com/directions/v5/mapbox";
const MAX_COORDINATES = 25;
const DEFAULT_PROFILE = "driving-traffic";

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

function token() {
  return (Deno.env.get("MAPBOX_ACCESS_TOKEN") || Deno.env.get("MAPBOX_TOKEN") || "").trim();
}

function validCoord(value: any) {
  const longitude = Number(value?.longitude ?? value?.lng ?? value?.lon ?? value?.[0]);
  const latitude = Number(value?.latitude ?? value?.lat ?? value?.[1]);
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

function addressHasGeographicContext(address: string) {
  const q = String(address || "").trim();
  // ZIP codes and comma-delimited locality/state context are reliable signals.
  // Do NOT treat a bare two-letter token as a state because street suffixes like
  // "Ct" (Court) can otherwise be mistaken for "CT" (Connecticut).
  return /\b\d{5}(?:-\d{4})?\b/.test(q) || /,\s*[A-Za-z .'-]{2,}(?:\s+[A-Z]{2})?(?:\s+\d{5}(?:-\d{4})?)?(?:,|$)/i.test(q);
}

function localSearchBBox(proximity: { longitude: number; latitude: number }, radiusMiles = 55) {
  const latDelta = radiusMiles / 69;
  const cosLat = Math.max(0.25, Math.cos((proximity.latitude * Math.PI) / 180));
  const lonDelta = radiusMiles / (69 * cosLat);
  return [
    Math.max(-180, proximity.longitude - lonDelta),
    Math.max(-90, proximity.latitude - latDelta),
    Math.min(180, proximity.longitude + lonDelta),
    Math.min(90, proximity.latitude + latDelta),
  ];
}

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.message || data?.error || `Provider request failed (${response.status})`;
    throw new Error(message);
  }
  return data;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function pointLineDistance(point: number[], start: number[], end: number[]) {
  const x = point[0], y = point[1];
  const x1 = start[0], y1 = start[1];
  const x2 = end[0], y2 = end[1];
  const dx = x2 - x1, dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(x - x1, y - y1);
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

function douglasPeucker(points: number[][], tolerance: number): number[][] {
  if (points.length <= 2) return points;
  let maxDistance = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const distance = pointLineDistance(points[i], points[0], points[points.length - 1]);
    if (distance > maxDistance) { maxDistance = distance; index = i; }
  }
  if (maxDistance <= tolerance) return [points[0], points[points.length - 1]];
  const left = douglasPeucker(points.slice(0, index + 1), tolerance);
  const right = douglasPeucker(points.slice(index), tolerance);
  return [...left.slice(0, -1), ...right];
}

function simplifyStaticRoute(coords: any[], maxPoints = 120) {
  const valid = (coords || [])
    .map((c: any) => Array.isArray(c) && c.length >= 2 ? [Number(c[0]), Number(c[1])] : null)
    .filter((c: any) => c && Number.isFinite(c[0]) && Number.isFinite(c[1]));
  if (valid.length <= maxPoints) return valid.map((c: any) => [Number(c[0].toFixed(6)), Number(c[1].toFixed(6))]);

  // Preserve road shape instead of uniformly skipping points. Uniform sampling can
  // cut across intersections and curves; Douglas-Peucker keeps the meaningful bends.
  let low = 0;
  let high = 0.02;
  let simplified = valid;
  for (let i = 0; i < 18; i++) {
    const tolerance = (low + high) / 2;
    const candidate = douglasPeucker(valid, tolerance);
    if (candidate.length > maxPoints) low = tolerance;
    else { high = tolerance; simplified = candidate; }
  }
  return simplified.map((c: any) => [Number(c[0].toFixed(6)), Number(c[1].toFixed(6))]);
}

function encodeSigned(value: number) {
  let v = value < 0 ? ~(value << 1) : value << 1;
  let out = "";
  while (v >= 0x20) {
    out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  return out + String.fromCharCode(v + 63);
}

function encodePolyline5(coords: number[][]) {
  let prevLat = 0;
  let prevLon = 0;
  let encoded = "";
  for (const [lon, lat] of coords) {
    const latE5 = Math.round(lat * 1e5);
    const lonE5 = Math.round(lon * 1e5);
    encoded += encodeSigned(latE5 - prevLat);
    encoded += encodeSigned(lonE5 - prevLon);
    prevLat = latE5;
    prevLon = lonE5;
  }
  return encoded;
}

function staticRouteOverlay(routeGeometry: any) {
  const coords = simplifyStaticRoute(routeGeometry?.coordinates || routeGeometry || [], 240);
  if (coords.length < 2) return "";
  const polyline = encodeURIComponent(encodePolyline5(coords));
  return `path-7+A8FF00-1(${polyline})`;
}

function staticDriverOverlay(driverCoordinate: any) {
  const coord = Array.isArray(driverCoordinate)
    ? driverCoordinate
    : driverCoordinate && Number.isFinite(Number(driverCoordinate.longitude)) && Number.isFinite(Number(driverCoordinate.latitude))
      ? [Number(driverCoordinate.longitude), Number(driverCoordinate.latitude)]
      : null;
  if (!coord || coord.length < 2) return "";
  const longitude = Number(coord[0]);
  const latitude = Number(coord[1]);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return "";
  // Map-native marker is projected by the same pitched/bearing camera as the
  // 4D route, preventing the current-position marker from drifting or vanishing.
  return `pin-l+00E5FF(${longitude.toFixed(6)},${latitude.toFixed(6)})`;
}

async function fetchStaticMap(accessToken: string, viewport: any = {}) {
  const longitude = Number(viewport?.longitude);
  const latitude = Number(viewport?.latitude);
  const zoom = Math.max(1, Math.min(18.5, Number(viewport?.zoom || 15.5)));
  const width = Math.max(320, Math.min(1024, Math.round(Number(viewport?.width || 640))));
  const height = Math.max(220, Math.min(1024, Math.round(Number(viewport?.height || 420))));
  const bearing = ((Number(viewport?.bearing || 0) % 360) + 360) % 360;
  const pitch = Math.max(0, Math.min(60, Number(viewport?.pitch || 0)));
  const retina = viewport?.retina === true;
  const style = ["dark-v11", "streets-v12", "satellite-streets-v12"].includes(String(viewport?.style))
    ? String(viewport.style)
    : "dark-v11";
  const routeOverlay = staticRouteOverlay(viewport?.route_geometry);
  const driverOverlay = staticDriverOverlay(viewport?.driver_coordinate);
  const overlays = [routeOverlay, driverOverlay].filter(Boolean).join(",");
  const overlayPrefix = overlays ? `${overlays}/` : "";

  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) throw new Error("Valid map viewport coordinates are required");
  const params = new URLSearchParams({ access_token: accessToken, attribution: "true", logo: "true" });
  const densitySuffix = retina ? "@2x" : "";
  const url = `https://api.mapbox.com/styles/v1/mapbox/${style}/static/${overlayPrefix}${longitude},${latitude},${zoom},${bearing.toFixed(1)},${pitch.toFixed(1)}/${width}x${height}${densitySuffix}?${params.toString()}`;
  if (url.length > 8100) throw new Error("Static map route overlay is too large; reduce route detail");
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Static map request failed (${response.status})`);
  }
  const contentType = response.headers.get("content-type") || "image/png";
  const bytes = new Uint8Array(await response.arrayBuffer());
  return {
    data_url: `data:${contentType};base64,${bytesToBase64(bytes)}`,
    viewport: { longitude, latitude, zoom, width, height, style, bearing, pitch, retina },
    route_overlay: Boolean(routeOverlay),
    driver_overlay: Boolean(driverOverlay),
  };
}

async function geocodeAddress(address: string, accessToken: string, proximity?: { longitude: number; latitude: number } | null) {
  const q = String(address || "").trim();
  if (!q) throw new Error("Address is required");

  const hasContext = addressHasGeographicContext(q);
  const params = new URLSearchParams({
    q,
    access_token: accessToken,
    limit: proximity ? "5" : "1",
    autocomplete: "false",
    country: "us",
    permanent: "false",
    types: "address",
  });
  if (proximity) params.set("proximity", `${proximity.longitude},${proximity.latitude}`);
  if (proximity && !hasContext) {
    params.set("bbox", localSearchBBox(proximity).join(","));
  }

  const data = await fetchJson(`${MAPBOX_GEOCODE}/forward?${params.toString()}`);
  const candidates = (data?.features || [])
    .map((feature: any) => {
      const coords = feature?.geometry?.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) return null;
      const result = {
        feature,
        longitude: Number(coords[0]),
        latitude: Number(coords[1]),
      };
      return {
        ...result,
        proximity_miles: proximity ? milesBetween(proximity, result) : null,
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => Number(a?.proximity_miles ?? 0) - Number(b?.proximity_miles ?? 0));

  const selected: any = candidates[0];
  if (!selected) {
    if (proximity && !hasContext) {
      throw new Error(`Could not find this address near your current location. Add city, state, or ZIP to: ${q}`);
    }
    throw new Error(`Could not geocode: ${q}`);
  }

  if (proximity && !hasContext && Number(selected.proximity_miles) > 55) {
    throw new Error(`Address is ambiguous and the nearest local match is ${Math.round(selected.proximity_miles)} miles away. Add city, state, or ZIP to: ${q}`);
  }

  const feature = selected.feature;
  return {
    input: q,
    longitude: selected.longitude,
    latitude: selected.latitude,
    name: feature?.properties?.name || feature?.text || "",
    full_address: feature?.properties?.full_address || feature?.place_name || q,
    feature_type: feature?.properties?.feature_type || feature?.type || "",
    accuracy: feature?.properties?.coordinates?.accuracy || null,
    proximity_miles: selected.proximity_miles,
  };
}

async function reverseGeocode(coord: { longitude: number; latitude: number }, accessToken: string) {
  const params = new URLSearchParams({
    longitude: String(coord.longitude),
    latitude: String(coord.latitude),
    access_token: accessToken,
    limit: "1",
    permanent: "false",
  });
  const data = await fetchJson(`${MAPBOX_GEOCODE}/reverse?${params.toString()}`);
  const feature = data?.features?.[0];
  return feature ? {
    longitude: coord.longitude,
    latitude: coord.latitude,
    name: feature?.properties?.name || feature?.text || "",
    full_address: feature?.properties?.full_address || feature?.place_name || "",
  } : null;
}

function normalizeStep(step: any, legIndex: number, stepIndex: number) {
  const maneuver = step?.maneuver || {};
  const voice = Array.isArray(step?.voiceInstructions) ? step.voiceInstructions : [];
  const banners = Array.isArray(step?.bannerInstructions) ? step.bannerInstructions : [];
  return {
    leg_index: legIndex,
    step_index: stepIndex,
    distance_m: Number(step?.distance || 0),
    duration_s: Number(step?.duration || 0),
    road_name: step?.name || "",
    destinations: step?.destinations || "",
    exits: step?.exits || "",
    driving_side: step?.driving_side || null,
    maneuver: {
      instruction: maneuver?.instruction || "Continue",
      type: maneuver?.type || "turn",
      modifier: maneuver?.modifier || null,
      bearing_before: Number.isFinite(maneuver?.bearing_before) ? maneuver.bearing_before : null,
      bearing_after: Number.isFinite(maneuver?.bearing_after) ? maneuver.bearing_after : null,
      location: Array.isArray(maneuver?.location) ? maneuver.location.slice(0, 2).map(Number) : null,
    },
    voice_instructions: voice.map((v: any) => ({
      distance_along_geometry_m: Number(v?.distanceAlongGeometry || 0),
      announcement: v?.announcement || "",
      ssml_announcement: v?.ssmlAnnouncement || "",
    })),
    banner_instructions: banners.map((b: any) => ({
      distance_along_geometry_m: Number(b?.distanceAlongGeometry || 0),
      primary_text: b?.primary?.text || "",
      secondary_text: b?.secondary?.text || "",
      sub_text: b?.sub?.text || "",
    })),
  };
}

async function trafficEta(
  coordinates: Array<{ longitude: number; latitude: number }>,
  accessToken: string,
) {
  if (coordinates.length < 2) throw new Error("At least an origin and destination are required");
  if (coordinates.length > MAX_COORDINATES) throw new Error(`LOKIN navigation supports up to ${MAX_COORDINATES - 1} route destinations per request`);
  const coordPath = coordinates.map((c) => `${c.longitude},${c.latitude}`).join(";");
  const params = new URLSearchParams({
    access_token: accessToken,
    alternatives: "false",
    overview: "false",
    steps: "false",
    annotations: "duration,congestion_numeric",
  });
  const data = await fetchJson(`${MAPBOX_DIRECTIONS}/driving-traffic/${coordPath}?${params.toString()}`);
  if (data?.code && data.code !== "Ok") throw new Error(data?.message || data.code);
  const route = data?.routes?.[0];
  if (!route) throw new Error("No live traffic ETA was returned");
  return {
    provider: "mapbox",
    profile: "driving-traffic",
    live_traffic: true,
    generated_at: new Date().toISOString(),
    distance_m: Number(route.distance || 0),
    duration_s: Number(route.duration || 0),
  };
}

async function directions(
  coordinates: Array<{ longitude: number; latitude: number }>,
  accessToken: string,
  opts: any = {},
) {
  if (coordinates.length < 2) throw new Error("At least an origin and destination are required");
  if (coordinates.length > MAX_COORDINATES) throw new Error(`LOKIN navigation supports up to ${MAX_COORDINATES - 1} route destinations per request`);

  const profile = opts.profile === "driving" ? "driving" : DEFAULT_PROFILE;
  const coordPath = coordinates.map((c) => `${c.longitude},${c.latitude}`).join(";");
  const params = new URLSearchParams({
    access_token: accessToken,
    alternatives: "false",
    geometries: "geojson",
    overview: "full",
    steps: "true",
    voice_instructions: "true",
    banner_instructions: "true",
    voice_units: "imperial",
    language: "en",
    roundabout_exits: "true",
    annotations: profile === "driving-traffic"
      ? "distance,duration,congestion_numeric,maxspeed"
      : "distance,duration,maxspeed",
  });

  if (opts.curbApproach !== false) {
    params.set("approaches", coordinates.map((_, i) => (i === 0 ? "" : "curb")).join(";"));
  }

  const data = await fetchJson(`${MAPBOX_DIRECTIONS}/${profile}/${coordPath}?${params.toString()}`);
  if (data?.code && data.code !== "Ok") throw new Error(data?.message || data.code);
  const route = data?.routes?.[0];
  if (!route?.geometry?.coordinates?.length) throw new Error("No drivable road route was returned");

  const maneuvers = (route.legs || []).flatMap((leg: any, legIndex: number) =>
    (leg.steps || []).map((step: any, stepIndex: number) => normalizeStep(step, legIndex, stepIndex))
  );

  const legs = (route.legs || []).map((leg: any, legIndex: number) => ({
    leg_index: legIndex,
    distance_m: Number(leg?.distance || 0),
    duration_s: Number(leg?.duration || 0),
    summary: leg?.summary || "",
    step_count: Array.isArray(leg?.steps) ? leg.steps.length : 0,
  }));

  return {
    provider: "mapbox",
    profile,
    live_traffic: profile === "driving-traffic",
    generated_at: new Date().toISOString(),
    distance_m: Number(route.distance || 0),
    duration_s: Number(route.duration || 0),
    geometry: {
      type: "LineString",
      coordinates: route.geometry.coordinates.map((pair: any) => [Number(pair[0]), Number(pair[1])]),
    },
    waypoints: (data?.waypoints || []).map((w: any, index: number) => ({
      index,
      name: w?.name || "",
      distance_m: Number(w?.distance || 0),
      location: Array.isArray(w?.location) ? w.location.slice(0, 2).map(Number) : null,
    })),
    legs,
    maneuvers,
  };
}

export default async function navigationEngine(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return json({ error: "Unauthorized" }, 401);
    await admitEcosystemOperation(base44, { sourceApp:'LOKIN AI', domain:'provider', type:'provider_request', operation:'navigation_provider', priority:95, estimatedMs:5000, realtime:true, background:false, tags:['provider','realtime'] });

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "status");
    const accessToken = token();

    if (action === "status") {
      return json({
        ok: true,
        provider: "mapbox",
        configured: Boolean(accessToken),
        capabilities: ["forward_geocoding", "reverse_geocoding", "driving_traffic_directions", "live_traffic_eta_refresh", "turn_by_turn", "road_geometry", "live_route_snapping", "satellite_aerial_imagery", "retina_static_imagery", "pitched_heading_up_visualization"],
        max_destinations: MAX_COORDINATES - 1,
        storage: "temporary_geocoding_only",
      });
    }

    if (!accessToken) {
      return json({
        error: "Navigation provider is not configured",
        code: "NAV_PROVIDER_NOT_CONFIGURED",
        required_secret: "MAPBOX_ACCESS_TOKEN",
      }, 503);
    }

    if (action === "satellite_status") {
      return json({
        ok: true,
        provider: "mapbox",
        imagery_style: "satellite-streets-v12",
        imagery_type: "provider satellite/aerial mosaic",
        realtime: false,
        retina: true,
        max_pitch_degrees: 60,
        navigation_accuracy_source: "device GPS + Mapbox road geometry",
      });
    }

    if (action === "provider_probe") {
      const result = await geocodeAddress("1600 Pennsylvania Avenue NW, Washington, DC 20500", accessToken, null);
      return json({
        ok: true,
        provider: "mapbox",
        configured: true,
        verified: Boolean(result?.longitude && result?.latitude),
        capabilities: ["geocoding", "driving_traffic", "road_geometry", "turn_by_turn"],
      });
    }

    if (action === "static_map") {
      return json({ ok: true, map: await fetchStaticMap(accessToken, body?.viewport || {}) });
    }

    if (action === "geocode") {
      const proximity = validCoord(body?.proximity);
      return json({ ok: true, result: await geocodeAddress(body?.address, accessToken, proximity) });
    }

    if (action === "reverse_geocode") {
      const coord = validCoord(body?.coordinate);
      if (!coord) return json({ error: "Valid coordinate is required" }, 400);
      return json({ ok: true, result: await reverseGeocode(coord, accessToken) });
    }

    if (action === "route") {
      const coordinates = (body?.coordinates || []).map(validCoord).filter(Boolean) as Array<{ longitude: number; latitude: number }>;
      return json({ ok: true, route: await directions(coordinates, accessToken, body?.options || {}) });
    }

    if (action === "traffic_eta") {
      const coordinates = (body?.coordinates || []).map(validCoord).filter(Boolean) as Array<{ longitude: number; latitude: number }>;
      return json({ ok: true, eta: await trafficEta(coordinates, accessToken) });
    }

    if (action === "route_addresses") {
      let origin = validCoord(body?.origin);
      const destinationAddresses = (body?.destination_addresses || body?.destinations || [])
        .map((x: any) => String(x || "").trim())
        .filter(Boolean)
        .slice(0, MAX_COORDINATES - 1);

      if (!origin && body?.origin_address) {
        const g = await geocodeAddress(body.origin_address, accessToken, null);
        origin = { longitude: g.longitude, latitude: g.latitude };
      }
      if (!origin) return json({ error: "Current GPS origin or origin address is required" }, 400);
      if (!destinationAddresses.length) return json({ error: "At least one destination address is required" }, 400);

      const geocoded = [];
      for (const address of destinationAddresses) {
        geocoded.push(await geocodeAddress(address, accessToken, origin));
      }
      const coordinates = [origin, ...geocoded.map((g) => ({ longitude: g.longitude, latitude: g.latitude }))];
      const route = await directions(coordinates, accessToken, body?.options || {});
      return json({ ok: true, geocoded_destinations: geocoded, route });
    }

    return json({ error: `Unsupported navigation action: ${action}` }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Navigation engine failed";
    return json({ error: message, code: "NAV_ENGINE_ERROR" }, 500);
  }
}
