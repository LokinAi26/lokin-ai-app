const STORAGE_KEY = "lokin:optimized-route:v1";
const MAX_AGE_MS = 30 * 60 * 1000;

function validStops(stops) {
  if (!Array.isArray(stops)) return [];
  return stops.filter((stop) => {
    const address = String(stop?.dropoff_address || "").trim();
    return Boolean(stop?.id && address);
  });
}

export function saveOptimizedRouteSession({ stops, mode, originAddress = "" } = {}) {
  const sequenced = validStops(stops);
  if (!sequenced.length || typeof window === "undefined") return false;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      createdAt: Date.now(),
      mode: String(mode || "most_profit"),
      originAddress: String(originAddress || "").trim(),
      stops: sequenced,
    }));
    return true;
  } catch {
    return false;
  }
}

export function loadOptimizedRouteSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw);
    const createdAt = Number(payload?.createdAt || 0);
    const stops = validStops(payload?.stops);
    if (
      payload?.version !== 1 ||
      !Number.isFinite(createdAt) ||
      Date.now() - createdAt > MAX_AGE_MS ||
      !stops.length
    ) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return { ...payload, stops };
  } catch {
    window.sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function clearOptimizedRouteSession() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage may be unavailable in a restricted browser context.
  }
}
