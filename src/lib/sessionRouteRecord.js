// Persists the AI-optimized route geometry + delivery stops while navigating,
// so the end-of-session Shift Recap can draw the efficiency map comparing the
// path actually driven against the planned route.
const STORAGE_KEY = "lokin:session-route:v1";
const MAX_AGE_MS = 6 * 60 * 60 * 1000; // covers a full shift

function normalizeGeometry(geometry) {
  const coords = Array.isArray(geometry?.coordinates) ? geometry.coordinates : Array.isArray(geometry) ? geometry : [];
  const valid = coords
    .map((c) => [Number(c?.[0]), Number(c?.[1])])
    .filter((c) => Number.isFinite(c[0]) && Number.isFinite(c[1]));
  return valid.length > 4000 ? valid.filter((_, i) => i % 2 === 0) : valid;
}

function normalizeStops(stops) {
  return (Array.isArray(stops) ? stops : [])
    .map((s) => ({
      sequence: Number(s?.sequence) || 0,
      coordinate: [Number(s?.coordinate?.[0]), Number(s?.coordinate?.[1])],
    }))
    .filter((s) => s.sequence > 0 && Number.isFinite(s.coordinate[0]) && Number.isFinite(s.coordinate[1]))
    .slice(0, 50);
}

export function saveSessionRouteRecord({ geometry, stops } = {}) {
  if (typeof window === "undefined") return false;
  const geo = normalizeGeometry(geometry);
  if (geo.length < 2) return false;
  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, createdAt: Date.now(), geometry: geo, stops: normalizeStops(stops) })
    );
    return true;
  } catch {
    return false;
  }
}

export function loadSessionRouteRecord() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw);
    const createdAt = Number(payload?.createdAt || 0);
    if (payload?.version !== 1 || !Number.isFinite(createdAt) || Date.now() - createdAt > MAX_AGE_MS) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    const geometry = normalizeGeometry(payload.geometry);
    if (geometry.length < 2) return null;
    return { geometry, stops: normalizeStops(payload.stops), createdAt };
  } catch {
    window.sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function clearSessionRouteRecord() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage may be unavailable in a restricted browser context.
  }
}