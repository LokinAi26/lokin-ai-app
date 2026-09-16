// LOKIN MapArchitect — manages detailed 3D artifacts on the GPS map:
// enhanced building depth, procedural 3D landmarks (bridges, fountains,
// monuments, towers), exaggerated terrain, quality presets, and day/night
// lighting on the Mapbox Standard style.

const BASEMAP_CONFIG = "basemap";
const DEM_SOURCE = "mapbox-dem";
const BUILDING_DEPTH_SOURCE = "lokin-3d-building-depth-source";
const BUILDING_DEPTH_LAYER = "lokin-3d-building-depth";
const LANDMARK_TYPES = ["fountain", "bridge", "monument", "tower"];

// ---------------------------------------------------------------------------
// Procedural geometry: builds simple meshes and encodes them as a minimal
// binary GLB so map.addModel() can consume them without any asset pipeline.
// ---------------------------------------------------------------------------

class MeshBuilder {
  constructor() {
    this.positions = [];
    this.normals = [];
    this.indices = [];
  }

  quad(a, b, c, d, normal) {
    const base = this.positions.length / 3;
    [a, b, c, d].forEach((p) => {
      this.positions.push(p[0], p[1], p[2]);
      this.normals.push(normal[0], normal[1], normal[2]);
    });
    this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  box(cx, cz, width, height, depth, yBase = 0) {
    const x0 = cx - width / 2;
    const x1 = cx + width / 2;
    const z0 = cz - depth / 2;
    const z1 = cz + depth / 2;
    const y0 = yBase;
    const y1 = yBase + height;
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]);
    this.quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [1, 0, 0]);
    this.quad([x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0], [0, 0, -1]);
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]);
    this.quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [0, 1, 0]);
  }

  frustum(cx, cz, rBottom, rTop, yBottom, yTop, segments = 16) {
    const top = Math.max(rTop, 0.02);
    for (let i = 0; i < segments; i++) {
      const a0 = ((i + 0.5) / segments) * Math.PI * 2;
      const a1 = ((i + 1.5) / segments) * Math.PI * 2;
      const aMid = ((i + 1) / segments) * Math.PI * 2;
      this.quad(
        [cx + Math.cos(a0) * rBottom, yBottom, cz + Math.sin(a0) * rBottom],
        [cx + Math.cos(a1) * rBottom, yBottom, cz + Math.sin(a1) * rBottom],
        [cx + Math.cos(a1) * top, yTop, cz + Math.sin(a1) * top],
        [cx + Math.cos(a0) * top, yTop, cz + Math.sin(a0) * top],
        [Math.cos(aMid), 0.35, Math.sin(aMid)],
      );
    }
    const centerIndex = this.positions.length / 3;
    this.positions.push(cx, yTop, cz);
    this.normals.push(0, 1, 0);
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      this.positions.push(cx + Math.cos(a) * top, yTop, cz + Math.sin(a) * top);
      this.normals.push(0, 1, 0);
    }
    for (let i = 0; i < segments; i++) {
      this.indices.push(centerIndex, centerIndex + 1 + i, centerIndex + 1 + ((i + 1) % segments));
    }
  }
}

// Bridge: stepped boxes trace an arch span between two piers.
function buildBridge(builder) {
  const span = 40;
  const width = 6;
  const rise = 6;
  const steps = 14;
  for (let i = 0; i < steps; i++) {
    const t = (i + 0.5) / steps;
    const x = -span / 2 + t * span;
    const y = Math.sin(t * Math.PI) * rise;
    builder.box(x, 0, span / steps + 0.5, 1.2, width, y);
  }
  builder.box(-span / 2 - 2, 0, 4, 4, width * 1.4, 0);
  builder.box(span / 2 + 2, 0, 4, 4, width * 1.4, 0);
}

// Fountain: stacked tiered cylinders. Models cannot carry custom shaders, so
// the animated water is approximated by the cascading tier geometry.
function buildFountain(builder) {
  builder.frustum(0, 0, 6, 6, 0, 1, 20);
  builder.frustum(0, 0, 1.4, 1.4, 1, 2.2, 12);
  builder.frustum(0, 0, 3.6, 3.6, 2.2, 3, 20);
  builder.frustum(0, 0, 1.6, 1.6, 3, 3.6, 12);
  builder.frustum(0, 0, 2.2, 2.2, 3.6, 4.2, 16);
  builder.frustum(0, 0, 0.5, 0.5, 4.2, 5.6, 8);
}

function buildMonument(builder) {
  builder.box(0, 0, 6, 1.2, 6, 0);
  builder.box(0, 0, 4, 1.2, 4, 1.2);
  builder.frustum(0, 0, 1.4, 1.4, 2.4, 10, 12);
  builder.frustum(0, 0, 2, 0.9, 10, 11, 12);
  builder.frustum(0, 0, 0.9, 0.02, 11, 12.5, 8);
}

function buildTower(builder) {
  builder.frustum(0, 0, 5, 4.6, 0, 12, 16);
  builder.frustum(0, 0, 4, 3.4, 12, 24, 16);
  builder.frustum(0, 0, 3, 2.2, 24, 34, 16);
  builder.frustum(0, 0, 0.8, 0.02, 34, 42, 8);
}

const LANDMARK_BUILDERS = {
  bridge: buildBridge,
  fountain: buildFountain,
  monument: buildMonument,
  tower: buildTower,
};

function padTo4(length) {
  return (4 - (length % 4)) % 4;
}

function encodeGlb(type) {
  const builder = new MeshBuilder();
  (LANDMARK_BUILDERS[type] || buildMonument)(builder);

  const positions = new Float32Array(builder.positions);
  const normals = new Float32Array(builder.normals);
  const indices = new Uint16Array(builder.indices);
  const vertexCount = positions.length / 3;
  const indexCount = indices.length;

  const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (let i = 0; i < vertexCount; i++) {
    for (let axis = 0; axis < 3; axis++) {
      const v = builder.positions[i * 3 + axis];
      if (v < bounds.min[axis]) bounds.min[axis] = v;
      if (v > bounds.max[axis]) bounds.max[axis] = v;
    }
  }

  const posLength = positions.byteLength;
  const nrmLength = normals.byteLength;
  const idxLength = indices.byteLength;
  const binLength = posLength + nrmLength + idxLength;

  const json = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: type }],
    meshes: [
      {
        primitives: [
          {
            attributes: { POSITION: 0, NORMAL: 1 },
            indices: 2,
            mode: 4,
            material: 0,
          },
        ],
      },
    ],
    materials: [{ doubleSided: true }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: vertexCount, type: "VEC3", min: bounds.min, max: bounds.max },
      { bufferView: 1, componentType: 5126, count: vertexCount, type: "VEC3" },
      { bufferView: 2, componentType: 5123, count: indexCount, type: "SCALAR" },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: posLength, target: 34962 },
      { buffer: 0, byteOffset: posLength, byteLength: nrmLength, target: 34962 },
      { buffer: 0, byteOffset: posLength + nrmLength, byteLength: idxLength, target: 34963 },
    ],
    buffers: [{ byteLength: binLength }],
  };

  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonPad = padTo4(jsonBytes.length);
  const binPad = padTo4(binLength);
  const total = 12 + 8 + jsonBytes.length + jsonPad + 8 + binLength + binPad;

  const buffer = new ArrayBuffer(total);
  const view = new DataView(buffer);
  let offset = 0;
  view.setUint32(offset, 0x46546c67, true); offset += 4; // 'glTF'
  view.setUint32(offset, 2, true); offset += 4;
  view.setUint32(offset, total, true); offset += 4;
  view.setUint32(offset, jsonBytes.length + jsonPad, true); offset += 4;
  view.setUint32(offset, 0x4e4f534a, true); offset += 4; // 'JSON'
  new Uint8Array(buffer, offset, jsonBytes.length).set(jsonBytes);
  for (let i = 0; i < jsonPad; i++) view.setUint8(offset + jsonBytes.length + i, 0x20);
  offset += jsonBytes.length + jsonPad;
  view.setUint32(offset, binLength + binPad, true); offset += 4;
  view.setUint32(offset, 0x004e4942, true); offset += 4; // 'BIN'
  new Uint8Array(buffer, offset, posLength).set(new Uint8Array(positions.buffer, positions.byteOffset, posLength));
  offset += posLength;
  new Uint8Array(buffer, offset, nrmLength).set(new Uint8Array(normals.buffer, normals.byteOffset, nrmLength));
  offset += nrmLength;
  new Uint8Array(buffer, offset, idxLength).set(new Uint8Array(indices.buffer, indices.byteOffset, idxLength));

  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:model/gltf-binary;base64,${btoa(binary)}`;
}

// ---------------------------------------------------------------------------
// MapArchitect
// ---------------------------------------------------------------------------

class MapArchitect {
  constructor(map = null) {
    this.map = map;
    this.quality = null;
    this.layers = [];
    this.sources = [];
    this.models = new Set();
    this.landmarks = new Map();
    this.terrainEnabled = false;
    this._modelUriCache = new Map();
  }

  _setConfig(property, value) {
    try {
      this.map?.setConfigProperty?.(BASEMAP_CONFIG, property, value);
    } catch {
      // Older cached style fragments may not expose every Standard setting.
    }
  }

  _layerExists(id) {
    try {
      return Boolean(this.map?.getLayer?.(id));
    } catch {
      return false;
    }
  }

  _sourceExists(id) {
    try {
      return Boolean(this.map?.getSource?.(id));
    } catch {
      return false;
    }
  }

  _setVisibility(layerId, visibility) {
    try {
      this.map?.setLayoutProperty(layerId, "visibility", visibility);
    } catch {
      // Layer may not exist in this style fragment.
    }
  }

  _addSource(id, source) {
    if (!this.map || this._sourceExists(id)) return;
    try {
      this.map.addSource(id, source);
      this.sources.push(id);
    } catch {}
  }

  _addLayer(layer) {
    if (!this.map || this._layerExists(layer.id)) return;
    try {
      this.map.addLayer(layer);
      this.layers.push(layer.id);
    } catch {}
  }

  _ensureBuildingDepthLayer() {
    this._addSource(BUILDING_DEPTH_SOURCE, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    this._addLayer({
      id: BUILDING_DEPTH_LAYER,
      type: "fill-extrusion",
      source: BUILDING_DEPTH_SOURCE,
      minzoom: 14,
      paint: {
        "fill-extrusion-color": "#1B211C",
        "fill-extrusion-height": ["coalesce", ["get", "height"], 12],
        "fill-extrusion-base": 0,
        "fill-extrusion-opacity": 0.85,
        "fill-extrusion-vertical-gradient": true,
      },
    });
  }

  _ensureModel(modelId, type) {
    if (this.models.has(modelId) || !this.map) return modelId;
    let uri = this._modelUriCache.get(type);
    if (!uri) {
      uri = encodeGlb(type);
      this._modelUriCache.set(type, uri);
    }
    try {
      this.map.addModel(modelId, uri);
      this.models.add(modelId);
    } catch {}
    return modelId;
  }

  _ensureTerrain() {
    if (this.terrainEnabled || !this.map) return;
    this._addSource(DEM_SOURCE, {
      type: "raster-dem",
      url: "mapbox://mapbox.mapbox-terrain-dem-v1",
      tileSize: 512,
      maxzoom: 14,
    });
    try {
      this.map.setTerrain({ source: DEM_SOURCE, exaggeration: 1.5 });
      this.terrainEnabled = true;
    } catch {}
  }

  _removeTerrain() {
    if (!this.terrainEnabled || !this.map) return;
    try {
      this.map.setTerrain(null);
    } catch {}
    this.terrainEnabled = false;
  }

  // (2) Enhanced building depth on the Standard style.
  enable3DBuildings() {
    if (!this.map) return;
    this._setConfig("show3dObjects", true);
    this._setConfig("showPlaceLabels", true);
    this._ensureBuildingDepthLayer();
    this._setVisibility(BUILDING_DEPTH_LAYER, "visible");
  }

  // (3) 3D landmarks: register the procedural bridge/fountain models and
  // exaggerate real terrain for mountain depth.
  enable3DLandmarks() {
    if (!this.map) return;
    this._ensureModel("lokin-bridge", "bridge");
    this._ensureModel("lokin-fountain", "fountain");
    this._ensureTerrain();
  }

  // (4) Quality presets.
  setQuality(level) {
    if (!this.map) return;
    const ultra = level === "ultra";
    const balanced = level === "balanced";
    const performance = level === "performance";
    this.quality = level;

    // The Standard style has no explicit shadow switch; ultra relies on full
    // 3D object lighting, and the extrusion depth layer carries the gradient.
    this._setConfig("show3dObjects", ultra);
    this._setConfig("show3dBuildings", ultra || balanced);
    this._setConfig("show3dTrees", ultra);
    this._setConfig("show3dLandmarks", ultra);
    this._setConfig("showPlaceLabels", ultra || balanced);

    this.landmarks.forEach((landmark) => {
      this._setVisibility(landmark.id, ultra ? "visible" : "none");
    });

    if (ultra) {
      this._ensureTerrain();
    } else {
      this._removeTerrain();
    }

    if (performance) {
      this._ensureBuildingDepthLayer();
      this._setVisibility(BUILDING_DEPTH_LAYER, "visible");
    } else if (this._layerExists(BUILDING_DEPTH_LAYER)) {
      this._setVisibility(BUILDING_DEPTH_LAYER, "none");
    }
  }

  // (5) Place a custom 3D landmark model at a coordinate.
  addCustomLandmark(lng, lat, type, options = {}) {
    if (!this.map) return null;
    const kind = LANDMARK_TYPES.includes(type) ? type : "monument";
    const modelId = this._ensureModel(`lokin-${kind}`, kind);
    const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const sourceId = `lokin-landmark-src-${kind}-${token}`;
    const layerId = `lokin-landmark-${kind}-${token}`;
    const feature = {
      type: "Feature",
      properties: {
        modelId,
        rotation: Number(options.rotation || 0),
        scale: Number(options.scale || 1),
      },
      geometry: { type: "Point", coordinates: [Number(lng), Number(lat)] },
    };
    this._addSource(sourceId, { type: "geojson", data: feature });
    this._addLayer({
      id: layerId,
      type: "model",
      source: sourceId,
      layout: {
        "model-id": ["coalesce", ["get", "modelId"], modelId],
      },
    });
    const record = {
      id: layerId,
      sourceId,
      modelId,
      type: kind,
      lng: Number(lng),
      lat: Number(lat),
      options,
    };
    this.landmarks.set(layerId, record);
    return record;
  }

  // (6) Day/night lighting for the 3D scene.
  setDayNight(isNight) {
    this._setConfig("lightPreset", isNight ? "night" : "day");
  }

  // (7) Teardown: remove every custom layer, source, model, and terrain.
  destroy() {
    const map = this.map;
    if (map) {
      this._removeTerrain();
      [...this.layers].reverse().forEach((layerId) => {
        if (this._layerExists(layerId)) {
          try {
            map.removeLayer(layerId);
          } catch {}
        }
      });
      this.sources.forEach((sourceId) => {
        if (this._sourceExists(sourceId)) {
          try {
            map.removeSource(sourceId);
          } catch {}
        }
      });
      if (this._sourceExists(DEM_SOURCE)) {
        try {
          map.removeSource(DEM_SOURCE);
        } catch {}
      }
      this.models.forEach((modelId) => {
        try {
          map.removeModel?.(modelId);
        } catch {}
      });
    }
    this.layers = [];
    this.sources = [];
    this.models.clear();
    this.landmarks.clear();
    this.terrainEnabled = false;
    this.quality = null;
    this.map = null;
  }
}

export const mapArchitect = new MapArchitect();
export default MapArchitect;