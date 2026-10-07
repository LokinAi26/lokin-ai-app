import { haversineMeters } from "@/lib/navigationGeometry";

// Live posted speed limit from OpenStreetMap — the same honest-data channel
// the destination-hours and map-architect lookups use: strict timeout, mirror
// fallback, and render-nothing when OSM has no answer.
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const TIMEOUT_MS = 8000;
const MAX_WAY_DISTANCE_M = 60;

// OSM maxspeed tags: bare numbers are km/h by OSM convention, "55 mph" is
// explicitly imperial. Zone tags like "US:VA:urban" carry no number — rejected,
// never guessed (honest-data rule).
function parseMaxspeedMph(tag) {
  const raw = String(tag || "").trim().toLowerCase();
  const match = raw.match(/^(\d+(?:\.\d+)?)\s*(mph|km\/h|kph)?$/);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0 || value > 200) return null;
  if (match[2] === "mph") return Math.round(value);
  return Math.round(value * 0.621371); // bare / km/h → mph
}

function distanceToWay(lat, lon, geometry) {
  let best = Infinity;
  for (const point of geometry || []) {
    const d = haversineMeters(lat, lon, Number(point[1]), Number(point[0]));
    if (d < best) best = d;
  }
  return best;
}

/**
 * Nearest OSM way with a maxspeed tag around the position.
 * Returns { speed_limit_mph, distance_m, road_name } or null — never invented.
 */
export async function fetchSpeedLimit(lat, lon) {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) return null;
  const query = `[out:json][timeout:8];way(around:45,${Number(lat)},${Number(lon)})["maxspeed"];out geom 12;`;

  let data = null;
  for (const endpoint of ENDPOINTS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(`${endpoint}?data=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      });
      if (!response.ok) continue;
      const parsed = await response.json().catch(() => null);
      if (parsed?.elements?.length) {
        data = parsed;
        break;
      }
    } catch {
      // Overpass degraded — try the next mirror, else fail safe (null).
    } finally {
      clearTimeout(timer);
    }
  }

  if (!data) return null;
  let best = null;
  for (const el of data.elements || []) {
    const mph = parseMaxspeedMph(el?.tags?.maxspeed);
    if (!mph) continue;
    const distance = distanceToWay(lat, lon, el?.geometry);
    if (!Number.isFinite(distance) || distance > MAX_WAY_DISTANCE_M) continue;
    if (!best || distance < best.distance_m) {
      best = { speed_limit_mph: mph, distance_m: Math.round(distance), road_name: el?.tags?.name || null };
    }
  }
  return best;
}