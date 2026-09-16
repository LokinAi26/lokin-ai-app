// LOKIN 3D map scene system.
// MapArchitect owns basemap-level 3D configuration (buildings, terrain, quality).
// MasterBuilder enriches the visible area with OSM-derived real building
// footprints, park landscaping, and custom GLB landmarks.

const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
const OVERPASS_TIMEOUT_MS = 8000;

const BUILDING_MATERIAL_COLORS = {
  brick: "#9C4A3C",
  concrete: "#B7B5AC",
  stone: "#A8A49B",
  wood: "#7A5C3E",
  glass: "#7FB7BE",
  metal: "#8E9299",
  plaster: "#C4BFB2",
};
const DEFAULT_BUILDING_COLOR = "#6E7884";
const DEFAULT_BUILDING_HEIGHT_M = 10;
const LEVEL_HEIGHT_M = 3;

// MeshBuilder animation targets and tuning.
const FOUNTAIN_WATER_LAYER = "masterbuilder-water-fill";
const FOUNTAIN_TIER_LAYER = "masterbuilder-fountain-3d";
const BRIDGE_SOURCE_ID = "meshbuilder-bridges";
const BRIDGE_LAYER_ID = "meshbuilder-bridges-3d";
const WATER_ANIMATION_FPS = 20;
const WATER_SHADE_DEEP = "#1873CC";
const WATER_SHADE_LIGHT = "#7FD4FF";
const BRIDGE_SCALE_TRANSITION_MS = 320;

async function fetchOverpass(query) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OVERPASS_TIMEOUT_MS);
  try {
    const response = await fetch(`${OVERPASS_ENDPOINT}?data=${encodeURIComponent(query)}`, {
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Overpass responded ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function circleRing(lng, lat, radiusDeg, steps = 12) {
  const ring = [];
  for (let i = 0; i <= steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2;
    ring.push([lng + Math.cos(angle) * radiusDeg, lat + Math.sin(angle) * radiusDeg]);
  }
  return ring;
}

function pointInRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect = yi > point[1] !== yj > point[1]
      && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function boundsToBBox(bounds) {
  if (typeof bounds?.getWest === "function") {
    return [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
  }
  const [[west, south], [east, north]] = bounds;
  return [west, south, east, north];
}

function ringCentroid(ring) {
  let lng = 0;
  let lat = 0;
  ring.slice(0, -1).forEach(([x, y]) => { lng += x; lat += y; });
  const count = Math.max(1, ring.length - 1);
  return [lng / count, lat / count];
}

function lerpColor(hexA, hexB, t) {
  const clamped = Math.max(0, Math.min(1, Number(t) || 0));
  const channel = (hex, start) => parseInt(hex.slice(start, start + 2), 16);
  const rgb = [1, 3, 5].map((start) => Math.round(channel(hexA, start) + (channel(hexB, start) - channel(hexA, start)) * clamped));
  return `#${rgb.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

export class MapArchitect {
  constructor() {
    this.map = null;
    this.landmarks = new Map();
    this.quality = "balanced";
  }

  enable3DBuildings() {
    if (!this.map) return;
    try {
      this.map.setConfigProperty("basemap", "show3dObjects", true);
      this.map.setConfigProperty("basemap", "showPlaceLabels", true);
    } catch (error) {
      console.warn(`[MapArchitect] 3D buildings unavailable on this style: ${error?.message || error}`);
    }
  }

  enable3DLandmarks() {
    if (!this.map) return;
    try {
      if (!this.map.getSource("mapbox-dem")) {
        this.map.addSource("mapbox-dem", {
          type: "raster-dem",
          url: "mapbox://mapbox.mapbox-terrain-dem-v1",
          tileSize: 512,
          maxzoom: 14,
        });
      }
      this.map.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });
    } catch (error) {
      console.warn(`[MapArchitect] 3D landmark terrain unavailable: ${error?.message || error}`);
    }
  }

  setQuality(level) {
    if (!["ultra", "balanced", "performance"].includes(level)) {
      console.warn(`[MapArchitect] unknown quality "${level}" — expected ultra, balanced, or performance`);
      return;
    }
    if (!this.map) return;
    try {
      if (level === "ultra") {
        this.map.setConfigProperty("basemap", "show3dObjects", true);
        this.map.setConfigProperty("basemap", "showShadows", true);
      } else if (level === "balanced") {
        this.map.setConfigProperty("basemap", "show3dObjects", true);
        this.map.setConfigProperty("basemap", "showShadows", false);
      } else {
        this.map.setConfigProperty("basemap", "show3dObjects", false);
        this.map.setConfigProperty("basemap", "showShadows", false);
      }
      this.quality = level;
    } catch (error) {
      console.warn(`[MapArchitect] quality preset "${level}" failed: ${error?.message || error}`);
    }
  }

  addCustomLandmark(lng, lat, type, options = {}) {
    const validTypes = ["fountain", "bridge", "monument", "tower"];
    if (!validTypes.includes(type)) {
      console.warn(`[MapArchitect] unknown landmark type "${type}" — expected fountain, bridge, monument, or tower`);
      return null;
    }
    const id = `landmark-${type}-${Number(lng).toFixed(5)},${Number(lat).toFixed(5)}`;
    this.landmarks.set(id, { id, lng, lat, type, ...options });
    return id;
  }

  setDayNight(isNight) {
    if (!this.map) return;
    try {
      this.map.setConfigProperty("basemap", "lightPreset", isNight ? "night" : "day");
    } catch (error) {
      console.warn(`[MapArchitect] light preset unavailable: ${error?.message || error}`);
    }
  }

  destroy() {
    this.landmarks.clear();
    if (this.map) {
      try {
        this.map.setTerrain(null);
      } catch {
        // Map may already be tearing down.
      }
    }
  }
}

export class MasterBuilder {
  constructor() {
    this.map = null;
    this.buildings = new Map(); // osm way id -> feature
    this.trees = [];
    this.fountains = [];
    this.water = [];
    this.landmarks = new Map(); // name -> placement record
  }

  ensureGeojsonLayer(sourceId, layerId, layerSpec, data) {
    if (!this.map) return;
    if (this.map.getSource(sourceId)) {
      this.map.getSource(sourceId).setData(data);
    } else {
      this.map.addSource(sourceId, { type: "geojson", data });
      this.map.addLayer({ id: layerId, source: sourceId, ...layerSpec });
    }
  }

  // Reconstructs a real building from its OpenStreetMap footprint. Height comes
  // from building:levels × 3 m (estimated at 10 m when the tag is missing) and
  // the facade color from the building:material tag.
  async buildRealBuilding(lng, lat) {
    if (!this.map || !Number.isFinite(lng) || !Number.isFinite(lat)) return;
    let data = null;
    try {
      data = await fetchOverpass(`[out:json][timeout:10];way["building"](around:50,${lat},${lng});out geom;`);
    } catch (error) {
      console.warn(`[MasterBuilder] Overpass lookup failed for (${lng}, ${lat}): ${error?.message || error}`);
      return;
    }

    const ways = (data?.elements || []).filter((el) => el.type === "way" && Array.isArray(el.geometry) && el.geometry.length >= 4);
    if (ways.length === 0) {
      console.warn(`[MasterBuilder] no OSM building footprints found within 50 m of (${lng}, ${lat}) — building not added`);
      return;
    }

    let added = 0;
    ways.forEach((way) => {
      const ring = way.geometry.map((point) => [point.lon, point.lat]);
      ring.push(ring[0]);
      const levels = Number(way.tags?.["building:levels"]);
      const height = Number.isFinite(levels) && levels > 0 ? levels * LEVEL_HEIGHT_M : DEFAULT_BUILDING_HEIGHT_M;
      const estimated = !(Number.isFinite(levels) && levels > 0);
      if (estimated) {
        console.warn(`[MasterBuilder] building:levels missing on way ${way.id} — using estimated ${DEFAULT_BUILDING_HEIGHT_M} m height`);
      }
      this.buildings.set(way.id, {
        type: "Feature",
        properties: {
          osmId: way.id,
          name: way.tags?.name || null,
          height,
          estimated,
          color: BUILDING_MATERIAL_COLORS[way.tags?.["building:material"]] || DEFAULT_BUILDING_COLOR,
        },
        geometry: { type: "Polygon", coordinates: [ring] },
      });
      added += 1;
    });

    this.ensureGeojsonLayer(
      "masterbuilder-buildings",
      "masterbuilder-buildings-3d",
      {
        type: "fill-extrusion",
        paint: {
          "fill-extrusion-color": ["get", "color"],
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-base": 0,
          "fill-extrusion-opacity": 0.85,
        },
      },
      { type: "FeatureCollection", features: [...this.buildings.values()] },
    );
    return added;
  }

  // Scatters tree models inside OSM park polygons and adds a tiered-cylinder
  // fountain plus a translucent water pool feature.
  async addLandscaping(bounds) {
    if (!this.map || !bounds) return;
    const [west, south, east, north] = boundsToBBox(bounds);
    let data = null;
    try {
      data = await fetchOverpass(`[out:json][timeout:10];way["leisure"="park"](${south},${west},${north},${east});out geom;`);
    } catch (error) {
      console.warn(`[MasterBuilder] Overpass park lookup failed: ${error?.message || error}`);
    }

    const parks = (data?.elements || []).filter((el) => el.type === "way" && Array.isArray(el.geometry) && el.geometry.length >= 4);
    if (parks.length === 0) {
      console.warn("[MasterBuilder] no OSM leisure=park areas found in view — tree scattering skipped");
    }

    const MAX_TREES = 24;
    let treeCount = 0;
    parks.forEach((park) => {
      const ring = park.geometry.map((point) => [point.lon, point.lat]);
      ring.push(ring[0]);
      const [minLng, maxLng] = ring.reduce(([lo, hi], [x]) => [Math.min(lo, x), Math.max(hi, x)], [Infinity, -Infinity]);
      const [minLat, maxLat] = ring.reduce(([lo, hi], [, y]) => [Math.min(lo, y), Math.max(hi, y)], [Infinity, -Infinity]);
      let attempts = 0;
      while (treeCount < MAX_TREES && attempts < 40) {
        attempts += 1;
        const candidate = [minLng + Math.random() * (maxLng - minLng), minLat + Math.random() * (maxLat - minLat)];
        if (!pointInRing(candidate, ring)) continue;
        this.trees.push({
          type: "Feature",
          properties: {
            height: 5 + Math.random() * 4,
            color: "#2F5D2F",
          },
          geometry: { type: "Polygon", coordinates: [circleRing(candidate[0], candidate[1], 0.00003)] },
        });
        treeCount += 1;
      }
    });

    if (this.trees.length > 0) {
      this.ensureGeojsonLayer(
        "masterbuilder-trees",
        "masterbuilder-trees-3d",
        {
          type: "fill-extrusion",
          paint: {
            "fill-extrusion-color": ["get", "color"],
            "fill-extrusion-height": ["get", "height"],
            "fill-extrusion-base": 0,
            "fill-extrusion-opacity": 0.9,
          },
        },
        { type: "FeatureCollection", features: this.trees },
      );
    }

    let anchor = [(west + east) / 2, (south + north) / 2];
    if (parks.length > 0) {
      const parkRing = parks[0].geometry.map((p) => [p.lon, p.lat]);
      parkRing.push(parkRing[0]);
      anchor = ringCentroid(parkRing);
    }
    this.buildFountain(anchor[0], anchor[1]);
  }

  buildFountain(lng, lat) {
    if (!this.map || !Number.isFinite(lng) || !Number.isFinite(lat)) return;
    const tier = (radiusDeg, base, height) => ({
      type: "Feature",
      properties: { height, base, color: "#C9CFD4" },
      geometry: { type: "Polygon", coordinates: [circleRing(lng, lat, radiusDeg)] },
    });
    this.fountains.push(tier(0.00006, 0, 1.2), tier(0.00004, 1.2, 0.8), tier(0.00002, 2, 0.6));
    this.ensureGeojsonLayer(
      "masterbuilder-fountain",
      "masterbuilder-fountain-3d",
      {
        type: "fill-extrusion",
        paint: {
          "fill-extrusion-color": ["get", "color"],
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-base": ["get", "base"],
          "fill-extrusion-opacity": 0.95,
        },
      },
      { type: "FeatureCollection", features: this.fountains },
    );

    this.water.push({
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: [circleRing(lng, lat, 0.00009)] },
    });
    this.ensureGeojsonLayer(
      "masterbuilder-water",
      "masterbuilder-water-fill",
      {
        type: "fill",
        paint: { "fill-color": "#1E90FF", "fill-opacity": 0.8 },
      },
      { type: "FeatureCollection", features: this.water },
    );

    // Span the pool with an animated procedural bridge.
    meshBuilder.buildBridge(lng, lat);
  }

  // Registers and places a custom GLB landmark model at exact coordinates.
  addLandmark(name, lng, lat, modelUrl, scale = 1) {
    if (!this.map) return null;
    if (!name || !modelUrl) {
      console.warn("[MasterBuilder] addLandmark requires a name and a modelUrl");
      return null;
    }
    const modelId = `master-landmark-${name}`;
    const layerId = `${modelId}-layer`;
    try {
      if (typeof this.map.addModel !== "function") {
        throw new Error("this mapbox-gl build does not support addModel");
      }
      this.map.addModel(modelId, { type: "glb", url: modelUrl });
      this.map.addLayer({ id: layerId, type: "model", source: modelId });
      const record = { name, lng, lat, modelUrl, scale, modelId, layerId };
      this.landmarks.set(name, record);
      return record;
    } catch (error) {
      console.warn(`[MasterBuilder] landmark "${name}" placement failed — model was not placed at (${lng}, ${lat}): ${error?.message || error}`);
      return null;
    }
  }

  // Enriches the visible area with the OSM building at the view center plus
  // park landscaping across the current bounds.
  enhanceVisibleArea(bounds) {
    if (!this.map || !bounds) return;
    let centerLng = null;
    let centerLat = null;
    if (typeof bounds.getCenter === "function") {
      const center = bounds.getCenter();
      centerLng = center.lng;
      centerLat = center.lat;
    } else {
      const [west, south, east, north] = boundsToBBox(bounds);
      centerLng = (west + east) / 2;
      centerLat = (south + north) / 2;
    }
    this.buildRealBuilding(centerLng, centerLat);
    this.addLandscaping(bounds);
  }
}

// Procedural animated meshes: shimmering fountain water plus a bridge whose
// geometry scales smoothly with camera movement.
export class MeshBuilder {
  constructor() {
    this.map = null;
    this.running = false;
    this.frameRef = null;
    this.lastWaterFrameAt = 0;
    this.lastBridgeScale = null;
    this.moveHandler = null;
    this.bridges = [];
  }

  // One shimmer cycle per ~2 s: the water color breathes between deep and
  // light blue while the tier heights pulse so the water reads as active.
  renderWaterFrame(timestamp) {
    const map = this.map;
    if (!map) return;
    try {
      if (map.getLayer(FOUNTAIN_WATER_LAYER)) {
        const shimmer = (Math.sin((timestamp / 1000) * Math.PI) + 1) / 2;
        map.setPaintProperty(FOUNTAIN_WATER_LAYER, "fill-color", lerpColor(WATER_SHADE_DEEP, WATER_SHADE_LIGHT, shimmer));
        map.setPaintProperty(FOUNTAIN_WATER_LAYER, "fill-opacity", 0.62 + shimmer * 0.26);
      }
      if (map.getLayer(FOUNTAIN_TIER_LAYER)) {
        const pulse = 1 + Math.sin((timestamp / 1000) * Math.PI * 2) * 0.05;
        map.setPaintProperty(FOUNTAIN_TIER_LAYER, "fill-extrusion-height", ["*", ["get", "height"], pulse]);
      }
    } catch {
      // Style may be mid-switch; the next frame retries.
    }
  }

  // Procedural bridge: a deck spanning the water with pylons at both ends.
  buildBridge(lng, lat, spanDeg = 0.00012) {
    if (!this.map || !Number.isFinite(lng) || !Number.isFinite(lat)) return;
    const halfWidth = spanDeg * 0.22;
    const pylonSpan = spanDeg * 0.16;
    const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
    this.bridges.push(
      {
        type: "Feature",
        properties: { height: 3, base: 0.6, color: "#9AA3AB" },
        geometry: { type: "Polygon", coordinates: [rect(lng - spanDeg, lat - halfWidth, lng + spanDeg, lat + halfWidth)] },
      },
      {
        type: "Feature",
        properties: { height: 6.5, base: 0, color: "#6E7884" },
        geometry: { type: "Polygon", coordinates: [rect(lng - spanDeg * 0.95, lat - halfWidth * 0.8, lng - spanDeg * 0.95 + pylonSpan, lat + halfWidth * 0.8)] },
      },
      {
        type: "Feature",
        properties: { height: 6.5, base: 0, color: "#6E7884" },
        geometry: { type: "Polygon", coordinates: [rect(lng + spanDeg * 0.95 - pylonSpan, lat - halfWidth * 0.8, lng + spanDeg * 0.95, lat + halfWidth * 0.8)] },
      },
    );
    const data = { type: "FeatureCollection", features: this.bridges };
    if (this.map.getSource(BRIDGE_SOURCE_ID)) {
      this.map.getSource(BRIDGE_SOURCE_ID).setData(data);
    } else {
      this.map.addSource(BRIDGE_SOURCE_ID, { type: "geojson", data });
      this.map.addLayer({
        id: BRIDGE_LAYER_ID,
        source: BRIDGE_SOURCE_ID,
        type: "fill-extrusion",
        paint: {
          "fill-extrusion-color": ["get", "color"],
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-base": ["get", "base"],
          "fill-extrusion-opacity": 0.95,
          "fill-extrusion-vertical-gradient": true,
        },
      });
    }
    this.lastBridgeScale = null;
    this.renderBridgeScale();
  }

  // Scales the bridge geometry with camera zoom. Each update eases through a
  // paint transition so the geometry scales smoothly while you move.
  renderBridgeScale() {
    const map = this.map;
    if (!map || !map.getLayer(BRIDGE_LAYER_ID)) return;
    try {
      const scale = Math.max(0.3, Math.min(1, (map.getZoom() - 13) / 4));
      const rounded = Math.round(scale * 100) / 100;
      if (rounded === this.lastBridgeScale) return;
      this.lastBridgeScale = rounded;
      map.setPaintProperty(BRIDGE_LAYER_ID, "fill-extrusion-height-transition", { duration: BRIDGE_SCALE_TRANSITION_MS, delay: 0 });
      map.setPaintProperty(BRIDGE_LAYER_ID, "fill-extrusion-height", ["*", ["get", "height"], rounded]);
    } catch {
      // Style may be mid-switch.
    }
  }

  startAnimations() {
    if (!this.map || this.running) return;
    this.running = true;
    const tick = (timestamp) => {
      if (!this.running) return;
      if (timestamp - this.lastWaterFrameAt >= 1000 / WATER_ANIMATION_FPS) {
        this.lastWaterFrameAt = timestamp;
        this.renderWaterFrame(timestamp);
      }
      this.frameRef = window.requestAnimationFrame(tick);
    };
    this.frameRef = window.requestAnimationFrame(tick);
    this.moveHandler = () => this.renderBridgeScale();
    this.map.on("move", this.moveHandler);
    this.renderBridgeScale();
  }

  stopAnimations() {
    this.running = false;
    if (this.frameRef != null) {
      window.cancelAnimationFrame(this.frameRef);
      this.frameRef = null;
    }
    if (this.map && this.moveHandler) {
      try { this.map.off("move", this.moveHandler); } catch { /* map may be gone */ }
      this.moveHandler = null;
    }
  }

  destroy() {
    this.stopAnimations();
    this.bridges = [];
    this.lastBridgeScale = null;
  }
}

export const mapArchitect = new MapArchitect();
export const baggz247Master = new MasterBuilder();
export const meshBuilder = new MeshBuilder();