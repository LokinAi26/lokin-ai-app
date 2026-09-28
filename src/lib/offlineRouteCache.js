// Offline route resilience (2026-09-28): while navigating, LOKIN keeps the
// current road route, maneuvers, and resolved destinations in localStorage so
// a dead zone or app reload never leaves the driver without guidance. A
// cached route is only restored for the exact destinations being navigated.

const ROUTE_KEY = "lokin_offline_route_v1";
const MAX_ROUTE_COORDS = 6000;
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000;

function compactCoordinates(coordinates) {
  if (!Array.isArray(coordinates)) return [];
  const rounded = coordinates
    .filter(Array.isArray)
    .map((c) => [Number(Number(c[0]).toFixed(6)), Number(Number(c[1]).toFixed(6))]);
  if (rounded.length <= MAX_ROUTE_COORDS) return rounded;
  // Very long routes are thinned evenly (endpoint always kept) so the cache
  // stays well inside localStorage limits without losing the road shape.
  const step = Math.ceil(rounded.length / MAX_ROUTE_COORDS);
  const kept = rounded.filter((_, i) => i % step === 0);
  const last = rounded[rounded.length - 1];
  const lastKept = kept[kept.length - 1];
  if (!lastKept || lastKept[0] !== last[0] || lastKept[1] !== last[1]) kept.push(last);
  return kept;
}

export function saveOfflineRoute(route, geocodedDestinations = [], destinationKey = "") {
  try {
    const coordinates = compactCoordinates(route?.geometry?.coordinates);
    if (coordinates.length < 2) return null;
    const payload = {
      saved_at: new Date().toISOString(),
      destination_key: destinationKey,
      route: {
        geometry: { type: "LineString", coordinates },
        maneuvers: Array.isArray(route?.maneuvers) ? route.maneuvers : [],
        distance_m: Number(route?.distance_m || 0),
        duration_s: Number(route?.duration_s || 0),
        generated_at: route?.generated_at || new Date().toISOString(),
        destination_side: route?.destination_side || null,
        live_traffic: false,
      },
      geocoded: Array.isArray(geocodedDestinations) ? geocodedDestinations : [],
    };
    localStorage.setItem(ROUTE_KEY, JSON.stringify(payload));
    return payload;
  } catch {
    // Storage full or unavailable — offline caching is best-effort only.
    return null;
  }
}

export function loadOfflineRoute(destinationKey = "") {
  try {
    const raw = localStorage.getItem(ROUTE_KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw);
    if (!payload?.route?.geometry?.coordinates?.length) return null;
    if (destinationKey && payload.destination_key !== destinationKey) return null;
    if (Date.now() - new Date(payload.saved_at).getTime() > MAX_CACHE_AGE_MS) return null;
    return payload;
  } catch {
    return null;
  }
}

export function clearOfflineRoute() {
  try { localStorage.removeItem(ROUTE_KEY); } catch { /* best-effort */ }
}