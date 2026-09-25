// Retail building extrusions — real store buildings in 3D.
//
// Data: OpenStreetMap building footprints with retail/commercial tags, fetched
// live from Overpass for the visible map area (same feed family as the store
// geofence). Rendered as a Mapbox fill-extrusion layer so strip malls and
// storefronts that Mapbox's own 3D buildings leave flat get real mass, plus a
// symbol layer that labels the buildings carrying real OSM name/brand tags —
// the layer never invents a building or a store name.
//
// Honest-data rules: footprints and heights come from OSM tags only. A missing
// height tag falls back to a documented 7 m retail estimate — the layer never
// invents a building that is not in the OSM response.
//
// Performance guards: zoom-gated (>= 13.5), debounced on moveend, in-memory
// cell cache (geometry is too large for localStorage), hard cap on building
// count, 30 s Overpass deadline, and fully disabled in "performance" quality.

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const OVERPASS_TIMEOUT_MS = 30000;
// Retry schedule across endpoints: primary -> fallback -> primary, then stop.
// The layer never invents data; when every attempt fails it reports an honest
// error status instead of failing silently.
const RETRY_DELAYS_MS = [2000, 5000];
const AUTO_RETRY_MS = 45000;
const MAX_BUILDINGS = 350;
const MIN_ZOOM = 13.5;
const CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_CELLS = 12;
const DEBOUNCE_MS = 900;
const REFETCH_MOVE_M = 300;
const DEFAULT_RETAIL_HEIGHT_M = 7;
const LEVEL_HEIGHT_M = 3.4;

const SOURCE_ID = "lokin-retail-buildings";
const LAYER_ID = "lokin-retail-extrusions";
const LABEL_LAYER_ID = "lokin-retail-labels";
// Labels appear a touch closer than the extrusions so they never clutter
// the mid-zoom view — the buildings arrive first, names follow.
const LABEL_MIN_ZOOM = 14.5;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function haversineMeters(a, b) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLon / 2);
  const h = s1 * s1 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * s2 * s2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function cellKey(lat, lon) {
  // ~500 m grid cells keep nearby pans on the same cache entry.
  return `${Math.round(lat * 200)}:${Math.round(lon * 200)}`;
}

function parseHeight(tags) {
  const raw = tags?.height;
  if (typeof raw === "string") {
    const m = parseFloat(raw.replace(/[^0-9.]/g, ""));
    if (Number.isFinite(m) && m > 0) return Math.min(m, 60);
  }
  const levels = parseFloat(tags?.["building:levels"]);
  if (Number.isFinite(levels) && levels > 0) return Math.min(levels * LEVEL_HEIGHT_M, 60);
  return DEFAULT_RETAIL_HEIGHT_M;
}

function ringAreaDeg2(ring) {
  // Shoelace in degree space — only used to drop slivers, not for display.
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return Math.abs(sum / 2);
}

function waysToGeoJSON(elements) {
  const features = [];
  for (const el of elements || []) {
    if (el.type !== "way" || !Array.isArray(el.geometry) || el.geometry.length < 4) continue;
    const ring = el.geometry.map((p) => [p.lon, p.lat]);
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0], first[1]]);
    // Drop slivers and sheds: roughly < 150 m^2 at mid latitudes.
    if (ringAreaDeg2(ring) < 1.1e-8) continue;
    const tags = el.tags || {};
    features.push({
      type: "Feature",
      properties: {
        id: `w${el.id}`,
        name: tags.name || tags.brand || "",
        height_m: parseHeight(tags),
        estimated: !tags.height && !tags["building:levels"],
      },
      geometry: { type: "Polygon", coordinates: [ring] },
    });
    if (features.length >= MAX_BUILDINGS) break;
  }
  return { type: "FeatureCollection", features };
}

class RetailExtrusion {
  constructor() {
    this.map = null;
    this.enabled = false; // quality/style gate, set by the view
    this.cache = new Map();
    this.inFlight = null;
    this.lastCenter = null;
    this.debounceTimer = null;
    this.disposed = false;
    this.visible = false;
    // Honest data-service status for the view: idle | loading | ready | error.
    // "error" means every fetch attempt failed and nothing is on the map.
    // When cached data is still visible, a failed refresh stays silent.
    this.status = "idle";
    this.statusListeners = new Set();
    this.autoRetryTimer = null;
  }

  setStatus(next) {
    if (this.status === next || this.disposed) return;
    this.status = next;
    for (const cb of this.statusListeners) {
      try {
        cb(next);
      } catch {
        /* listener bug must not break the layer */
      }
    }
  }

  // Subscribe to data-service status. Returns an unsubscribe function.
  onStatus(cb) {
    this.statusListeners.add(cb);
    try {
      cb(this.status);
    } catch {
      /* ignore */
    }
    return () => this.statusListeners.delete(cb);
  }

  setEnabled(on) {
    this.enabled = !!on;
    if (!this.map || this.disposed) return;
    if (!this.enabled) {
      this.hide();
    } else if (this.map.isStyleLoaded() && this.map.getZoom() >= MIN_ZOOM) {
      this.refresh(this.map.getBounds());
    }
  }

  async refresh(bounds) {
    if (!this.map || this.disposed || !this.enabled) return;
    if (!bounds || this.map.getZoom() < MIN_ZOOM) {
      this.hide();
      return;
    }
    window.clearTimeout(this.debounceTimer);
    this.debounceTimer = window.setTimeout(() => this.loadForBounds(bounds), DEBOUNCE_MS);
  }

  async loadForBounds(bounds) {
    if (!this.map || this.disposed || !this.enabled) return;
    const center = bounds.getCenter();
    const at = { lat: center.lat, lon: center.lng };
    if (this.lastCenter && haversineMeters(this.lastCenter, at) < REFETCH_MOVE_M && this.visible) return;

    if (this.inFlight) {
      try {
        await this.inFlight;
      } catch {
        /* fall through to cache-or-empty */
      }
      return;
    }

    const key = cellKey(at.lat, at.lon);
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      this.lastCenter = at;
      this.applyGeoJSON(hit.geojson);
      this.setStatus("ready");
      window.clearTimeout(this.autoRetryTimer);
      this.autoRetryTimer = null;
      return;
    }

    this.inFlight = this.fetchBuildings(bounds);
    const hadVisible = this.visible;
    if (!hadVisible) this.setStatus("loading");
    try {
      const geojson = await this.inFlight;
      this.cache.set(key, { at: Date.now(), geojson });
      while (this.cache.size > MAX_CELLS) {
        const oldest = this.cache.keys().next().value;
        this.cache.delete(oldest);
      }
      this.lastCenter = at;
      this.applyGeoJSON(geojson);
      this.setStatus("ready");
      window.clearTimeout(this.autoRetryTimer);
      this.autoRetryTimer = null;
    } catch {
      // Overpass busy or offline: keep whatever is on the map, never blank it.
      // Only report an honest error when there is nothing to show.
      if (!this.visible) {
        this.setStatus("error");
        this.scheduleAutoRetry();
      }
    } finally {
      this.inFlight = null;
    }
  }

  scheduleAutoRetry() {
    window.clearTimeout(this.autoRetryTimer);
    this.autoRetryTimer = window.setTimeout(() => {
      this.autoRetryTimer = null;
      if (this.disposed || !this.enabled || !this.map) return;
      if (this.status !== "error") return;
      // refresh() re-checks the zoom gate and hides cleanly when zoomed out.
      this.refresh(this.map.getBounds());
    }, AUTO_RETRY_MS);
  }

  buildOverpassQuery(bounds) {
    // Clamp the query box to ~1.6 km so Overpass stays fast on mobile data.
    const c = bounds.getCenter();
    const dLat = 0.0072;
    const dLon = 0.0072 / Math.max(0.2, Math.cos((c.lat * Math.PI) / 180));
    const s = Math.max(-90, c.lat - dLat);
    const n = Math.min(90, c.lat + dLat);
    const w = c.lng - dLon;
    const e = c.lng + dLon;
    const bbox = `${s.toFixed(5)},${w.toFixed(5)},${n.toFixed(5)},${e.toFixed(5)}`;
    return `[out:json][timeout:20];(way["building"~"retail|commercial|supermarket|warehouse"](${bbox});way["shop"](${bbox});way["amenity"~"restaurant|fast_food|cafe"](${bbox}););out geom tags ${MAX_BUILDINGS};`;
  }

  async fetchOnce(endpoint, q) {
    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), OVERPASS_TIMEOUT_MS);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
        body: "data=" + encodeURIComponent(q),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`retail building lookup failed (${res.status})`);
      const json = await res.json();
      return waysToGeoJSON(json.elements);
    } finally {
      clearTimeout(abortTimer);
    }
  }

  async fetchBuildings(bounds) {
    const q = this.buildOverpassQuery(bounds);
    let lastError = null;
    const attempts = OVERPASS_ENDPOINTS.length + 1; // primary -> fallback -> primary
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (attempt > 0) {
        await sleep(RETRY_DELAYS_MS[Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)]);
      }
      if (this.disposed || !this.enabled) throw lastError || new Error("retail layer stopped");
      const endpoint = OVERPASS_ENDPOINTS[attempt % OVERPASS_ENDPOINTS.length];
      try {
        return await this.fetchOnce(endpoint, q);
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError;
  }

  applyGeoJSON(geojson) {
    const map = this.map;
    if (!map || this.disposed || !map.isStyleLoaded()) return;
    try {
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, { type: "geojson", data: geojson });
      } else {
        map.getSource(SOURCE_ID).setData(geojson);
      }
      // Insert below the first symbol layer so extrusions never cover
      // map labels. The name labels go in the same slot, right above the
      // extrusions, so they sit under street/POI labels too.
      let beforeId = null;
      for (const layer of map.getStyle().layers || []) {
        if (layer.type === "symbol") {
          beforeId = layer.id;
          break;
        }
      }
      if (!map.getLayer(LAYER_ID)) {
        map.addLayer(
          {
            id: LAYER_ID,
            type: "fill-extrusion",
            source: SOURCE_ID,
            paint: {
              "fill-extrusion-color": "#31402a",
              "fill-extrusion-height": ["get", "height_m"],
              "fill-extrusion-base": 0,
              "fill-extrusion-opacity": 0.88,
            },
          },
          beforeId
        );
      }
      if (!map.getLayer(LABEL_LAYER_ID)) {
        map.addLayer(
          {
            id: LABEL_LAYER_ID,
            type: "symbol",
            source: SOURCE_ID,
            minzoom: LABEL_MIN_ZOOM,
            // Only buildings that carry a real OSM name/brand get a label —
            // the layer never invents a store name.
            filter: ["!=", ["get", "name"], ""],
            layout: {
              "text-field": ["get", "name"],
              "text-size": ["interpolate", ["linear"], ["zoom"], 14.5, 10, 17, 13],
              "text-anchor": "center",
              "text-justify": "center",
              "text-max-width": 8,
              "text-allow-overlap": false,
              "symbol-placement": "point",
            },
            paint: {
              "text-color": "#dff5cf",
              "text-halo-color": "rgba(6,10,6,0.9)",
              "text-halo-width": 1.5,
              "text-opacity": 0.95,
            },
          },
          beforeId
        );
      }
      map.setLayoutProperty(LAYER_ID, "visibility", "visible");
      map.setLayoutProperty(LABEL_LAYER_ID, "visibility", "visible");
      this.visible = true;
    } catch {
      // Style mid-reload: the next style.load re-applies from cache.
    }
  }

  hide() {
    this.visible = false;
    window.clearTimeout(this.autoRetryTimer);
    this.autoRetryTimer = null;
    this.setStatus("idle");
    try {
      if (this.map?.getLayer(LAYER_ID)) this.map.setLayoutProperty(LAYER_ID, "visibility", "none");
      if (this.map?.getLayer(LABEL_LAYER_ID))
        this.map.setLayoutProperty(LABEL_LAYER_ID, "visibility", "none");
    } catch {
      /* map tearing down */
    }
  }

  reapplyAfterStyleLoad() {
    // A style reload wipes custom sources/layers — rebuild from the cache.
    if (!this.map || this.disposed || !this.enabled) return;
    this.visible = false;
    this.lastCenter = null;
    if (this.map.getZoom() >= MIN_ZOOM) this.loadForBounds(this.map.getBounds());
  }

  destroy() {
    this.disposed = true;
    window.clearTimeout(this.debounceTimer);
    window.clearTimeout(this.autoRetryTimer);
    this.autoRetryTimer = null;
    this.statusListeners.clear();
    this.cache.clear();
    this.inFlight = null;
    try {
      if (this.map?.getLayer(LABEL_LAYER_ID)) this.map.removeLayer(LABEL_LAYER_ID);
      if (this.map?.getLayer(LAYER_ID)) this.map.removeLayer(LAYER_ID);
      if (this.map?.getSource(SOURCE_ID)) this.map.removeSource(SOURCE_ID);
    } catch {
      /* map already removed */
    }
    this.map = null;
  }
}

export const retailExtrusion = new RetailExtrusion();
