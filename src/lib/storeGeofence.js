// LOKIN store geofence — automatic AI item locator trigger.
//
// While a shift's GPS watch is running, every accepted fix is checked against
// nearby grocery/retail stores (OpenStreetMap via Overpass, same endpoint the
// 3D map engine uses). Crossing into a store's radius fires an "enter" event;
// leaving fires "exit". The StoreEntrySheet listens and auto-opens the item
// locator prompt.
//
// Honest limits: this runs on the shift GPS pipeline, so it fires while
// Kendall is locked in with LOKIN foregrounded. iOS suspends web GPS when
// another app is in front, so entries that happen while LOKIN is backgrounded
// are not detected until he returns.
const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
const CACHE_KEY = "lokin_store_cache";
const ENABLED_KEY = "lokin_store_geofence_enabled";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_RADIUS_M = 1500;
const REFETCH_MOVE_M = 500;
const ENTER_RADIUS_M = 80;
const EXIT_RADIUS_M = 200;
const MAX_STORES = 40;

const SHOP_RE = "^(supermarket|grocery|convenience|department_store|variety_store|wholesale|general|deli|bakery|greengrocer|farm)$";

function haversineMeters(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function cellKey(lat, lon) {
  return `${Math.round(lat * 100) / 100}:${Math.round(lon * 100) / 100}`;
}

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY)) || {};
  } catch {
    return {};
  }
}

function writeCache(cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* storage unavailable */
  }
}

export function isStoreGeofenceEnabled() {
  try {
    const v = localStorage.getItem(ENABLED_KEY);
    return v == null ? true : v === "1";
  } catch {
    return true;
  }
}

export function setStoreGeofenceEnabled(on) {
  try {
    localStorage.setItem(ENABLED_KEY, on ? "1" : "0");
  } catch {
    /* storage unavailable */
  }
}

async function fetchNearbyStores(lat, lon) {
  const q = `[out:json][timeout:20];(node["shop"~"${SHOP_RE}"](around:${FETCH_RADIUS_M},${lat},${lon});way["shop"~"${SHOP_RE}"](around:${FETCH_RADIUS_M},${lat},${lon}););out center tags ${MAX_STORES};`;
  const res = await fetch(OVERPASS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
    body: "data=" + encodeURIComponent(q),
  });
  if (!res.ok) throw new Error(`store lookup failed (${res.status})`);
  const json = await res.json();
  const stores = [];
  for (const el of json.elements || []) {
    const plat = el.lat;
    const plon = el.lon;
    const c = el.center || {};
    const sla = Number.isFinite(plat) ? plat : c.lat;
    const slo = Number.isFinite(plon) ? plon : c.lon;
    if (!Number.isFinite(sla) || !Number.isFinite(slo)) continue;
    const tags = el.tags || {};
    stores.push({
      id: String(el.type || "?")[0] + (el.id ?? Math.round(sla * 1e5) + ":" + Math.round(slo * 1e5)),
      name: tags.name || tags.brand || "Grocery store",
      kind: tags.shop || "store",
      lat: sla,
      lon: slo,
    });
    if (stores.length >= MAX_STORES) break;
  }
  return stores;
}

const listeners = new Set();
let insideStore = null; // the store object we are currently inside, or null
let lastFetchAt = 0;
let lastFetchPos = null;
let lastStores = []; // in-memory store list from the most recent lookup
let fetchInFlight = null;

function notify(evt) {
  listeners.forEach((fn) => {
    try {
      fn(evt);
    } catch {
      /* listener errors never break the geofence */
    }
  });
}

export function subscribeStoreGeofence(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCurrentStore() {
  return insideStore;
}

async function refreshStores(lat, lon) {
  const now = Date.now();
  const moved = lastFetchPos ? haversineMeters(lastFetchPos, { lat, lon }) : Infinity;
  if (fetchInFlight) {
    const s = await fetchInFlight;
    return s || lastStores;
  }
  if (now - lastFetchAt < 5 * 60 * 1000 && moved < REFETCH_MOVE_M) return lastStores;
  const cache = readCache();
  const key = cellKey(lat, lon);
  const hit = cache[key];
  if (hit && now - hit.at < CACHE_TTL_MS) {
    lastFetchAt = now;
    lastFetchPos = { lat, lon };
    lastStores = hit.stores || [];
    return lastStores;
  }
  fetchInFlight = (async () => {
    try {
      const stores = await fetchNearbyStores(lat, lon);
      const c = readCache();
      c[key] = { at: Date.now(), stores };
      // keep the cache bounded: drop oldest cells beyond 20
      const keys = Object.keys(c).sort((a, b) => (c[a].at || 0) - (c[b].at || 0));
      while (keys.length > 20) delete c[keys.shift()];
      writeCache(c);
      lastFetchAt = Date.now();
      lastFetchPos = { lat, lon };
      lastStores = stores;
      return stores;
    } catch (e) {
      return lastStores; // offline or Overpass busy — keep the last known list
    } finally {
      fetchInFlight = null;
    }
  })();
  return fetchInFlight;
}

// Called (fire-and-forget) on every accepted shift GPS fix. Never throws.
export function checkStoreGeofence(lat, lon) {
  try {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    if (!isStoreGeofenceEnabled()) {
      if (insideStore) {
        insideStore = null;
        notify({ type: "exit", store: null });
      }
      return;
    }
    refreshStores(lat, lon)
      .then((stores) => {
        const list = Array.isArray(stores) ? stores : lastStores;
        let nearest = null;
        let nearestD = Infinity;
        for (const s of list) {
          const d = haversineMeters({ lat, lon }, s);
          if (d < nearestD) {
            nearestD = d;
            nearest = s;
          }
        }
        if (!insideStore && nearest && nearestD <= ENTER_RADIUS_M) {
          insideStore = nearest;
          notify({ type: "enter", store: nearest });
        } else if (insideStore && (!nearest || nearestD > EXIT_RADIUS_M || nearest.id !== insideStore.id)) {
          // left the radius, or the nearest store changed beyond exit radius
          const left = insideStore;
          insideStore = null;
          notify({ type: "exit", store: left });
          // re-check immediately in case we walked straight into a neighbor
          if (nearest && nearestD <= ENTER_RADIUS_M) {
            insideStore = nearest;
            notify({ type: "enter", store: nearest });
          }
        }
      })
      .catch(() => {
        /* offline or Overpass busy — keep the last known state */
      });
  } catch {
    /* never break the GPS pipeline */
  }
}

// Test seam: clear in-memory geofence state (used by diagnostics).
export function resetStoreGeofence() {
  insideStore = null;
  lastFetchAt = 0;
  lastFetchPos = null;
}
