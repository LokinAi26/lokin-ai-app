import { haversineMeters } from "@/lib/navigationGeometry";

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
const BRIDGE_ANIMATION_FPS = 20;
const BRIDGE_RISE_MS = 900;
const BRIDGE_SHIMMER_PERIOD_MS = 3400;

// Arch bridge generation: procedural spans aligned with navigation road segments.
const ARCH_SEGMENT_COUNT = 14;
const ARCH_DECK_BOTTOM_M = 6;
const ARCH_DECK_THICKNESS_M = 1;
const GUARDRAIL_HEIGHT_M = 0.9;
const ROAD_BRIDGE_WIDTH_M = 11;
const MIN_ROUTE_SEGMENT_M = 80;
const MIN_BRIDGE_SPAN_M = 60;
const MAX_BRIDGE_SPAN_M = 140;
const MIN_BRIDGE_SPACING_M = 400;
const MAX_ROUTE_BRIDGES = 2;

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

function bearingDeg(from, to) {
  const dx = Number(to[0]) - Number(from[0]);
  const dy = Number(to[1]) - Number(from[1]);
  return (Math.atan2(dx, dy) * 180) / Math.PI;
}

function offsetFromBearing(lng, lat, bearingDeg, distanceM) {
  const bearing = (Number(bearingDeg) * Math.PI) / 180;
  const dLat = (Math.cos(bearing) * distanceM) / 111320;
  const dLng = (Math.sin(bearing) * distanceM) / (111320 * Math.max(0.2, Math.cos((Number(lat) * Math.PI) / 180)));
  return [lng + dLng, lat + dLat];
}

// Rectangle ring centered at (lng, lat), alongM long in the road bearing and
// crossM wide across it — keeps generated geometry glued to the road segment.
function rotatedRectRing(lng, lat, bearingDeg, alongM, crossM) {
  const halfAlong = alongM / 2;
  const halfCross = crossM / 2;
  const corners = [
    [-halfAlong, -halfCross],
    [halfAlong, -halfCross],
    [halfAlong, halfCross],
    [-halfAlong, halfCross],
    [-halfAlong, -halfCross],
  ];
  return corners.map(([along, cross]) => {
    const alongPoint = offsetFromBearing(lng, lat, bearingDeg, along);
    return offsetFromBearing(alongPoint[0], alongPoint[1], bearingDeg + 90, cross);
  });
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
  }

  // Registers and places a custom GLB landmark model at exact coordinates.
  addLandmark(name, lng, lat, modelUrl, scale = 1) {
    if (!this.map) return null;
    if (!name || !modelUrl) {
      console.warn("[MasterBuilder] addLandmark requires a name and a modelUrl");
      return null;
    }
    const modelId = `master-landmark-${name}`;
    const sourceId = `${modelId}-src`;
    const layerId = `${modelId}-layer`;
    try {
      if (typeof this.map.addModel !== "function") {
        throw new Error("this mapbox-gl build does not support addModel");
      }
      // Already placed on this map instance — return the existing placement.
      if (this.map.getLayer(layerId) && this.map.getSource(sourceId)) {
        const existing = { name, lng, lat, modelUrl, scale, modelId, sourceId, layerId };
        this.landmarks.set(name, existing);
        return existing;
      }
      // Register the model with the style, then pin it to its coordinates via a
      // GeoJSON point source consumed by a model layer.
      this.map.addModel(modelId, { type: "glb", url: modelUrl });
      const point = {
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: [Number(lng), Number(lat)] },
      };
      if (this.map.getSource(sourceId)) {
        this.map.getSource(sourceId).setData(point);
      } else {
        this.map.addSource(sourceId, { type: "geojson", data: point });
      }
      this.map.addLayer({
        id: layerId,
        type: "model",
        source: sourceId,
        layout: { "model-id": modelId },
      });
      const record = { name, lng, lat, modelUrl, scale, modelId, sourceId, layerId };
      this.landmarks.set(name, record);
      return record;
    } catch (error) {
      console.warn(`[MasterBuilder] landmark "${name}" placement failed — model was not placed at (${lng}, ${lat}): ${error?.message || error}`);
      return null;
    }
  }

  // BAGGZ_247 Batch 1 — signature landmark models for the Hampton Roads market.
  // Stylized approximations, not survey-grade replicas.
  registerSignatureLandmarks() {
    const landmarks = [
      {
        id: "baggz247-dome",
        name: "The Dome at Atlantic Park",
        lat: 36.847164,
        lng: -75.979075,
        url: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/c0640846b_baggz247-dome.glb",
      },
      {
        id: "baggz247-surf-lagoon",
        name: "Atlantic Park surf lagoon",
        lat: 36.84605,
        lng: -75.97712,
        url: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/c222e21d5_baggz247-surf-lagoon.glb",
      },
      {
        id: "baggz247-waterside",
        name: "Waterside District",
        lat: 36.84483,
        lng: -76.29102,
        url: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/b71dd4fac_baggz247-waterside.glb",
      },
      {
        id: "baggz247-town-center",
        name: "Virginia Beach Town Center",
        lat: 36.84344,
        lng: -76.13266,
        url: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/0d8e372f4_baggz247-town-center.glb",
      },
    ];
    for (const lm of landmarks) {
      try {
        this.addLandmark(lm.id, lm.lng, lm.lat, lm.url);
      } catch (e) {
        console.warn("[baggz247] signature landmark failed:", lm.id, e);
      }
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
    this.lastBridgeFrameAt = 0;
    this.lastBridgeScale = null;
    this.moveHandler = null;
    this.bridges = [];
    this.riseStartedAt = null;
    this.routeSignature = null;
    this.routeBridgeCount = 0;
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

  syncBridgeLayer() {
    if (!this.map) return;
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
  }

  // Procedural arch bridge: a deck slab riding a parabolic arch ring, both
  // rotated onto the road segment's bearing so the span aligns with the road.
  buildArchBridge(lng, lat, bearing, spanM) {
    if (!this.map || !Number.isFinite(lng) || !Number.isFinite(lat)) return null;
    const span = Math.max(MIN_BRIDGE_SPAN_M, Math.min(MAX_BRIDGE_SPAN_M, Number(spanM) || MIN_BRIDGE_SPAN_M));
    const features = [];

    // Arch ring: segment blocks whose base follows the parabolic intrados, so
    // the opening is widest at the center and solid at the abutments.
    const segmentLength = span / ARCH_SEGMENT_COUNT;
    for (let i = 0; i < ARCH_SEGMENT_COUNT; i += 1) {
      const t = (i + 0.5) / ARCH_SEGMENT_COUNT;
      const intrados = ARCH_DECK_BOTTOM_M * (1 - (2 * t - 1) ** 2);
      const center = offsetFromBearing(lng, lat, bearing, (t - 0.5) * span);
      features.push({
        type: "Feature",
        properties: {
          height: Math.max(0.05, ARCH_DECK_BOTTOM_M - intrados),
          base: intrados,
          color: "#A8A49B",
        },
        geometry: { type: "Polygon", coordinates: [rotatedRectRing(center[0], center[1], bearing, segmentLength * 1.02, ROAD_BRIDGE_WIDTH_M)] },
      });
    }

    // Deck slab and guardrails along the road direction.
    features.push({
      type: "Feature",
      properties: { height: ARCH_DECK_THICKNESS_M, base: ARCH_DECK_BOTTOM_M, color: "#B7B5AC" },
      geometry: { type: "Polygon", coordinates: [rotatedRectRing(lng, lat, bearing, span, ROAD_BRIDGE_WIDTH_M)] },
    });
    [-1, 1].forEach((side) => {
      const edge = offsetFromBearing(lng, lat, bearing + 90, side * (ROAD_BRIDGE_WIDTH_M / 2 - 0.6));
      features.push({
        type: "Feature",
        properties: { height: GUARDRAIL_HEIGHT_M, base: ARCH_DECK_BOTTOM_M + ARCH_DECK_THICKNESS_M, color: "#9AA3AB" },
        geometry: { type: "Polygon", coordinates: [rotatedRectRing(edge[0], edge[1], bearing, span, 1.2)] },
      });
    });

    this.bridges.push(...features);
    return features;
  }

  // Places arch bridges on the route's road segments so the generated spans sit
  // on the navigation layer instead of floating over unrelated terrain.
  alignWithRoute(coordinates) {
    if (!this.map) return 0;
    const coords = (coordinates?.coordinates || coordinates || [])
      .map((point) => (Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]) ? point : null))
      .filter(Boolean);
    if (coords.length < 2) {
      this.routeSignature = null;
      this.routeBridgeCount = 0;
      this.bridges = this.bridges.filter((feature) => !feature.properties.routeAligned);
      this.syncBridgeLayer();
      return 0;
    }

    // Same road segments: keep the placed spans where they are so repeated
    // route updates while driving never pop or re-animate the bridges.
    const signature = coords.map((p) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`).join("|");
    if (signature === this.routeSignature) return this.routeBridgeCount;

    this.bridges = this.bridges.filter((feature) => !feature.properties.routeAligned);
    const placed = [];
    for (let i = 0; i < coords.length - 1 && placed.length < MAX_ROUTE_BRIDGES; i += 1) {
      const a = coords[i];
      const b = coords[i + 1];
      const lengthM = haversineMeters(a, b);
      if (lengthM < MIN_ROUTE_SEGMENT_M) continue;
      const midLng = (a[0] + b[0]) / 2;
      const midLat = (a[1] + b[1]) / 2;
      const tooClose = placed.some((p) => haversineMeters([p.lng, p.lat], [midLng, midLat]) < MIN_BRIDGE_SPACING_M);
      if (tooClose) continue;
      const created = this.buildArchBridge(midLng, midLat, bearingDeg(a, b), lengthM);
      if (created) {
        created.forEach((feature) => { feature.properties.routeAligned = true; });
        placed.push({ lng: midLng, lat: midLat });
      }
    }

    this.routeSignature = signature;
    this.routeBridgeCount = placed.length;
    this.syncBridgeLayer();
    if (placed.length > 0 && this.running) {
      // New spans rise from the road they sit on instead of popping in.
      this.beginBridgeRise();
    } else {
      this.lastBridgeScale = null;
      this.renderBridgeScale();
    }
    return placed.length;
  }

  // Resets the arch animation so newly placed spans ease up from the road.
  beginBridgeRise() {
    try {
      this.map.setPaintProperty(BRIDGE_LAYER_ID, "fill-extrusion-height-transition", { duration: 0, delay: 0 });
      this.map.setPaintProperty(BRIDGE_LAYER_ID, "fill-extrusion-height", ["*", ["get", "height"], 0]);
    } catch {
      // Style may be mid-switch; the next animation frame picks the rise up.
    }
    this.riseStartedAt = performance.now();
    this.lastBridgeScale = 0;
  }

  // Camera-zoom scale for the bridge geometry.
  bridgeZoomScale() {
    return Math.max(0.3, Math.min(1, (this.map.getZoom() - 13) / 4));
  }

  // Combined scale factor: zoom scale eased in by the rise animation that plays
  // whenever new spans are placed on the route's road segments.
  bridgeScaleFactor(timestamp) {
    const zoomScale = this.bridgeZoomScale();
    if (this.riseStartedAt == null) return zoomScale;
    const progress = Math.min(1, (timestamp - this.riseStartedAt) / BRIDGE_RISE_MS);
    if (progress >= 1) {
      this.riseStartedAt = null;
      return zoomScale;
    }
    const eased = progress * progress * (3 - 2 * progress);
    return zoomScale * eased;
  }

  // Drives the arch bridge animation each frame: spans rise from the road when
  // placed, the geometry tracks camera zoom through short paint transitions,
  // and the arches shimmer subtly so the spans read as part of the living scene.
  renderBridgeFrame(timestamp) {
    const map = this.map;
    if (!map || !map.getLayer(BRIDGE_LAYER_ID) || this.bridges.length === 0) return;
    try {
      const scale = Math.round(this.bridgeScaleFactor(timestamp) * 100) / 100;
      if (scale !== this.lastBridgeScale) {
        this.lastBridgeScale = scale;
        map.setPaintProperty(BRIDGE_LAYER_ID, "fill-extrusion-height-transition", { duration: BRIDGE_SCALE_TRANSITION_MS, delay: 0 });
        map.setPaintProperty(BRIDGE_LAYER_ID, "fill-extrusion-height", ["*", ["get", "height"], scale]);
      }
      const shimmer = (Math.sin((timestamp / BRIDGE_SHIMMER_PERIOD_MS) * Math.PI * 2) + 1) / 2;
      map.setPaintProperty(BRIDGE_LAYER_ID, "fill-extrusion-opacity", 0.9 + shimmer * 0.1);
    } catch {
      // Style may be mid-switch; the next frame retries.
    }
  }

  // Camera-move hook: keeps scaling smooth between animation frames.
  renderBridgeScale() {
    this.renderBridgeFrame(performance.now());
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
      if (timestamp - this.lastBridgeFrameAt >= 1000 / BRIDGE_ANIMATION_FPS) {
        this.lastBridgeFrameAt = timestamp;
        this.renderBridgeFrame(timestamp);
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
    this.riseStartedAt = null;
    this.routeSignature = null;
    this.routeBridgeCount = 0;
  }
}

export const mapArchitect = new MapArchitect();
export const baggz247Master = new MasterBuilder();
export const meshBuilder = new MeshBuilder();