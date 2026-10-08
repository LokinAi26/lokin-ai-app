// LOKIN store geofence — automatic AI item locator trigger.
//
// Every accepted GPS fix — from the shift watch AND the navigation watch — is
// checked against nearby grocery/retail stores (OpenStreetMap via Overpass,
// same endpoint the 3D map engine uses). Crossing into a store's radius fires
// an "enter" event; leaving fires "exit". A single "settled" event fires per
// visit once the driver has been at walking pace or slower for the whole of
// SETTLE_MS inside the radius, or for ARRIVAL_SETTLE_MS after navigation
// arrived at the store (parked and walked in, not a drive-by). The
// StoreEntrySheet listens: "enter" shows the prompt, "settled" switches to the
// item locator when auto-open is on. Entries missed while LOKIN is
// backgrounded are caught by a foreground re-check, and arrival at a
// grocery/retail destination fires the enter event directly.
//
// Honest limits: iOS suspends web GPS when another app is in front, so
// entries that happen while LOKIN is backgrounded are detected when he
// returns, not in real time. Store data comes from OpenStreetMap; stores
// missing from the map are not detected.
const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
const CACHE_KEY = "lokin_store_cache";
const ENABLED_KEY = "lokin_store_geofence_enabled";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_RADIUS_M = 1500;
const REFETCH_MOVE_M = 500;
const ENTER_RADIUS_M = 80;
const EXIT_RADIUS_M = 200;
const MAX_STORES = 40;
const SETTLE_MS = 45 * 1000; // walking-pace dwell before a geofence visit settles
const ARRIVAL_SETTLE_MS = 8 * 1000; // same, after navigation arrived at the store
const PACE_WINDOW_MS = 5 * 1000; // min span used to measure pace (smooths indoor jitter)
const WALKING_MAX_MPS = 2.5; // ~9 km/h: faster than this is still driving
const FIX_HISTORY_MS = 90 * 1000;
const FRESH_FIX_MS = 30 * 1000;

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
  // Client-side deadline: without it a hung Overpass connection holds the
  // fetchInFlight lock forever and store refresh silently stops updating.
  const controller = new AbortController();
  const abortTimer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(OVERPASS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
      body: "data=" + encodeURIComponent(q),
      signal: controller.signal,
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
  } finally {
    clearTimeout(abortTimer);
  }
}

const listeners = new Set();
let insideStore = null; // the store object we are currently inside, or null
let insideSince = 0; // when the current visit started (ms)
let arrivedAt = null; // when navigation arrived at this store (ms), null if it has not
let settledFired = false; // "settled" fires at most once per visit
let visitFixes = []; // recent {lat, lon, t} fixes during the current visit
let lastFetchAt = 0;
let lastFetchPos = null;
let lastStores = []; // in-memory store list from the most recent lookup
let fetchInFlight = null;

function startVisit(store, t) {
  insideStore = store;
  insideSince = t;
  arrivedAt = null;
  settledFired = false;
  visitFixes = [];
}

function endVisit() {
  insideStore = null;
  insideSince = 0;
  arrivedAt = null;
  settledFired = false;
  visitFixes = [];
}

// Fastest pace (m/s) over any PACE_WINDOW_MS span of visit fixes at or after
// `sinceT`, or null when the fixes do not yet span a full window.
function maxPaceSince(sinceT) {
  let max = null;
  for (let i = 0; i < visitFixes.length; i += 1) {
    if (visitFixes[i].t < sinceT) continue;
    for (let j = i + 1; j < visitFixes.length; j += 1) {
      const dt = visitFixes[j].t - visitFixes[i].t;
      if (dt >= PACE_WINDOW_MS) {
        const pace = haversineMeters(visitFixes[i], visitFixes[j]) / (dt / 1000);
        if (max == null || pace > max) max = pace;
        break;
      }
    }
  }
  return max;
}

function shouldSettle(now) {
  if (!insideStore || settledFired) return false;
  const arrived = arrivedAt != null;
  const since = arrived ? arrivedAt : now - SETTLE_MS;
  const dwellStart = arrived ? arrivedAt : insideSince;
  const dwellNeeded = arrived ? ARRIVAL_SETTLE_MS : SETTLE_MS;
  if (now - dwellStart < dwellNeeded) return false;
  const pace = maxPaceSince(since);
  return pace != null && pace <= WALKING_MAX_MPS;
}

// True while the driver is inside a store and the latest fixes show walking
// pace or slower. The StoreEntrySheet re-checks this right before it switches
// screens, so a driver who started moving again is never pulled away.
export function isVisitSettledNow(now = Date.now()) {
  if (!insideStore) return false;
  const last = visitFixes[visitFixes.length - 1];
  if (!last || now - last.t > FRESH_FIX_MS) return false;
  const pace = maxPaceSince(last.t - PACE_WINDOW_MS * 2);
  return pace != null && pace <= WALKING_MAX_MPS;
}

// Single gate for switching the driver to the item locator. Checked when a
// visit settles, again when the route changes, and again at the end of the
// countdown, so nothing that changed in between (navigation started, the
// driver drove off, auto-open was turned off) is missed.
export function canAutoOpenItemLocator({ pathname = "", search = "", storeId = null, now = Date.now() } = {}) {
  if (!isStoreGeofenceEnabled()) return false;
  if (!insideStore || (storeId != null && insideStore.id !== storeId)) return false;
  if (pathname === "/locator" || pathname === "/shop-deliver") return false;
  // Active turn-by-turn navigation: never pull the driver out of it from a
  // dwell alone (stopped traffic next to a store looks like a dwell). Arriving
  // at the store is the signal there.
  const params = new URLSearchParams(search);
  const activeNav = pathname === "/ai-gps" && params.get("focus") === "locked" && params.get("nav") === "1";
  if (activeNav && !insideStore.arrived) return false;
  return isVisitSettledNow(now);
}

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

// Arrival-at-grocery trigger. When navigation ends at a grocery/retail
// destination, the driver is standing in the store even if no geofence
// crossing was ever detected (e.g. iOS suspended GPS behind the Dasher app,
// so the entry moment was missed). Fires the SAME "enter" event the
// StoreEntrySheet already listens for; the visit then settles after a short
// walking-pace dwell. When already inside a store it upgrades that visit
// instead. No-op when the geofence is disabled or the name is not a
// grocery/retail place. Never throws.
export function reportStoreArrival(name, lat, lon, t = Date.now()) {
  try {
    if (!isStoreGeofenceEnabled()) return;
    const n = String(name || "").toLowerCase();
    if (!n) return;
    const STORE_RE = /\b(wegmans|walmart|kroger|aldi|costco|trader\s*joe|whole\s*foods?|food\s*lion|publix|safeway|giant(\s*food)?|harris\s*teeter|farm\s*fresh|food\s*city|martin's|lidl|bj'?s|sam'?s\s*club|dollar\s*(general|tree)|family\s*dollar|five\s*below|target|cvs|walgreens|rite\s*aid|grocery|supermarket|supercenter|wholesale|bodega|produce|butcher|bakery|deli)\b/;
    if (!STORE_RE.test(n)) return;
    // Avoid street-name false positives ("Market Street", "Grocery Ave")
    // unless a known store brand is also present.
    const STREET_RE = /\b(street|st\.|avenue|ave\.|road|rd\.|drive|dr\.|boulevard|blvd\.|lane|ln\.|court|ct\.|place|pl\.|pike|highway|hwy|circle|cir\.|terrace|ter\.|way)\b/;
    const BRAND_RE = /\b(wegmans|walmart|kroger|aldi|costco|trader\s*joe|whole\s*foods?|food\s*lion|publix|safeway|target|cvs|walgreens|harris\s*teeter|lidl)\b/;
    if (STREET_RE.test(n) && !BRAND_RE.test(n)) return;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const at = Number.isFinite(t) ? t : Date.now();
    if (insideStore) {
      // Already inside (the geofence caught the approach): navigation
      // arriving here upgrades the open visit so it settles on the short
      // arrival dwell instead of being ignored.
      if (arrivedAt == null) {
        arrivedAt = at;
        insideStore = { ...insideStore, arrived: true };
        // A dwell settle during navigation was suppressed by the sheet;
        // let the arrival settle fire for this visit.
        settledFired = false;
      }
      return;
    }
    const label = String(name).trim().slice(0, 80);
    startVisit({
      id: "arrival:" + label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name: label,
      kind: "arrival",
      arrived: true,
      lat,
      lon,
    }, at);
    arrivedAt = at;
    notify({ type: "enter", store: insideStore });
  } catch {
    /* never break the navigation pipeline */
  }
}

// Called (fire-and-forget) on every accepted shift/nav GPS fix. Never throws.
// `t` is the fix time in ms (defaults to now).
export function checkStoreGeofence(lat, lon, t = Date.now()) {
  try {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    if (!isStoreGeofenceEnabled()) {
      if (insideStore) {
        endVisit();
        notify({ type: "exit", store: null });
      }
      return;
    }
    const at = Number.isFinite(t) ? t : Date.now();
    refreshStores(lat, lon)
      .then((stores) => {
        const here = { lat, lon };
        const list = Array.isArray(stores) ? stores : lastStores;
        let nearest = null;
        let nearestD = Infinity;
        for (const s of list) {
          const d = haversineMeters(here, s);
          if (d < nearestD) {
            nearestD = d;
            nearest = s;
          }
        }
        if (insideStore) {
          // Exit is measured against the store we are inside, not whichever
          // store is nearest. An arrival-detected store has no OSM twin, and
          // neighbors in a strip mall swap "nearest" as GPS drifts indoors;
          // either used to fire an immediate exit that closed the prompt.
          if (haversineMeters(here, insideStore) > EXIT_RADIUS_M) {
            const left = insideStore;
            endVisit();
            notify({ type: "exit", store: left });
          }
        }
        if (!insideStore && nearest && nearestD <= ENTER_RADIUS_M) {
          startVisit(nearest, at);
          notify({ type: "enter", store: nearest });
        }
        if (insideStore) {
          visitFixes.push({ lat, lon, t: at });
          while (visitFixes.length && at - visitFixes[0].t > FIX_HISTORY_MS) visitFixes.shift();
          if (shouldSettle(at)) {
            settledFired = true;
            notify({ type: "settled", store: insideStore });
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
  endVisit();
  lastFetchAt = 0;
  lastFetchPos = null;
  lastStores = [];
}
