// POI brand-mark anchors — Idea #2 ported to the live app.
//
// Data: 100% real OSM, derived from the retail-extrusion building dataset
// (same fetch, same honest-data rules — the layer never invents a building or
// a name). Only buildings carrying a real OSM name/brand tag become anchors.
// Corridor: 500 m buffer around the active route (or the viewport center when
// there is no route). Hard cap: 12 anchors, ranked by on-route proximity,
// then brand-tagged over generic, then driver distance.
//
// Rendering: a single Mapbox custom layer. Each anchor is a camera-facing
// billboard badge (green ring + brand initials, beta brand marks — no scraped
// logos) floating above its rooftop, with a faint vertical leader line from
// the roof to the badge. One draw call, preallocated buffers, zero per-frame
// allocation outside the vertex rebuild. Depth-tested against buildings at
// every pitch (badges never punch through the 3D massing).
//
// Perf gates: zoom >= 14, disabled in "performance" quality, max 12 sprites.

import mapboxgl from "mapbox-gl";

export const POI_LAYER_ID = "lokin-poi-anchors";
export const POI_MAX = 12;
export const POI_CORRIDOR_M = 500;
export const POI_MIN_ZOOM = 14;
const POI_LIFT_M = 16; // leader height: roof -> badge bottom
const POI_HALF_M = 13; // badge half-size (26 m badge)
const POI_LEADER_HALF_M = 0.7;
const RETAIL_SOURCE_ID = "lokin-retail-buildings";
const GREEN = "#8FE44E";

function centroidOf(ring) {
  let x = 0;
  let y = 0;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    x += ring[i][0];
    y += ring[i][1];
  }
  return [x / n, y / n];
}

// Equirectangular point-to-segment distance in meters.
function segDistM(px, py, ax, ay, bx, by, kx, ky) {
  const dx = (bx - ax) * kx;
  const dy = (by - ay) * ky;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((px - ax) * kx * dx + (py - ay) * ky * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const ex = (ax + (bx - ax) * t - px) * kx;
  const ey = (ay + (by - ay) * t - py) * ky;
  return Math.hypot(ex, ey);
}

function routeDistanceM(lng, lat, routeCoords) {
  if (!routeCoords || routeCoords.length < 2) return Infinity;
  const kx = 111320 * Math.cos((lat * Math.PI) / 180);
  const ky = 111320;
  let best = Infinity;
  for (let i = 0; i < routeCoords.length - 1; i++) {
    const a = routeCoords[i];
    const b = routeCoords[i + 1];
    // Cheap bbox reject before the projection.
    const minLng = Math.min(a[0], b[0]) - 0.01;
    const maxLng = Math.max(a[0], b[0]) + 0.01;
    const minLat = Math.min(a[1], b[1]) - 0.01;
    const maxLat = Math.max(a[1], b[1]) + 0.01;
    if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) continue;
    const d = segDistM(lng, lat, a[0], a[1], b[0], b[1], kx, ky);
    if (d < best) best = d;
  }
  return best;
}

function haversineM(lng1, lat1, lng2, lat2) {
  const kx = 111320 * Math.cos(((lat1 + lat2) / 2) * Math.PI / 180);
  return Math.hypot((lng2 - lng1) * kx, (lat2 - lat1) * 111320);
}

export function brandInitials(name) {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

// Ranked, capped anchor list. Never invents data: every anchor comes from a
// real OSM building feature already in the extrusion source.
export function getPoiAnchors(map, routeCoords, driverCoord) {
  let feats = [];
  try {
    feats = map.querySourceFeatures(RETAIL_SOURCE_ID, {
      filter: ["!=", ["get", "name"], ""],
    }) || [];
  } catch {
    return [];
  }
  const hasRoute = Array.isArray(routeCoords) && routeCoords.length >= 2;
  const center = !hasRoute && map ? map.getCenter() : null;
  const out = [];
  for (const f of feats) {
    const geom = f.geometry;
    if (!geom || geom.type !== "Polygon" || !geom.coordinates?.[0]?.length) continue;
    const [lng, lat] = centroidOf(geom.coordinates[0]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    const props = f.properties || {};
    const name = String(props.name || "").trim();
    if (!name) continue;
    const roofH = Number(props.height_m);
    const anchor = {
      lng,
      lat,
      roofH: Number.isFinite(roofH) && roofH > 0 ? roofH : 7, // same 7 m retail fallback as the extrusion layer
      name,
      brand: String(props.brand || "").trim(),
      initials: brandInitials(name),
    };
    let corridorD;
    if (hasRoute) {
      corridorD = routeDistanceM(lng, lat, routeCoords);
    } else if (center) {
      corridorD = haversineM(lng, lat, center.lng, center.lat);
    } else {
      corridorD = Infinity;
    }
    if (corridorD > POI_CORRIDOR_M) continue;
    anchor.corridorD = corridorD;
    anchor.driverD =
      driverCoord && Number.isFinite(driverCoord[0])
        ? haversineM(lng, lat, driverCoord[0], driverCoord[1])
        : Infinity;
    out.push(anchor);
  }
  out.sort((a, b) => {
    if (a.corridorD !== b.corridorD) return a.corridorD - b.corridorD;
    const ab = a.brand ? 0 : 1;
    const bb = b.brand ? 0 : 1;
    if (ab !== bb) return ab - bb;
    return a.driverD - b.driverD;
  });
  return out.slice(0, POI_MAX);
}

// ---- Brand-mark badge atlas ------------------------------------------------
// One canvas per anchor (128px): dark disc, LOKIN-green ring, brand initials,
// micro name. Packed 4x3 into a single GL texture; UVs baked per quad.

const CELL = 128;
const ATLAS_COLS = 4;
const ATLAS_ROWS = 3;

function drawBadge(anchor) {
  const c = document.createElement("canvas");
  c.width = CELL;
  c.height = CELL;
  const g = c.getContext("2d");
  const cx = CELL / 2;
  const cy = CELL / 2;
  // Disc
  g.beginPath();
  g.arc(cx, cy, 56, 0, Math.PI * 2);
  g.fillStyle = "rgba(6,10,6,0.92)";
  g.fill();
  // Green ring
  g.lineWidth = 6;
  g.strokeStyle = GREEN;
  g.shadowColor = GREEN;
  g.shadowBlur = 14;
  g.stroke();
  g.shadowBlur = 0;
  // Initials
  g.fillStyle = "#f2ffe6";
  g.font = "800 46px system-ui, -apple-system, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(anchor.initials, cx, cy - 8);
  // Micro name
  const label = anchor.name.length > 14 ? anchor.name.slice(0, 13) + "…" : anchor.name;
  g.fillStyle = GREEN;
  g.font = "700 15px system-ui, -apple-system, sans-serif";
  g.fillText(label.toUpperCase(), cx, cy + 30);
  return c;
}

function uvFor(index) {
  const col = index % ATLAS_COLS;
  const row = Math.floor(index / ATLAS_COLS);
  const u0 = col / ATLAS_COLS;
  const u1 = (col + 1) / ATLAS_COLS;
  const v1 = 1 - row / ATLAS_ROWS;
  const v0 = 1 - (row + 1) / ATLAS_ROWS;
  return [u0, v0, u1, v1];
}

// ---- Custom GL layer --------------------------------------------------------

const POI_VERT = `
attribute vec3 a_pos;
attribute vec2 a_uv;
attribute float a_mode;
uniform mat4 u_matrix;
varying vec2 v_uv;
varying float v_mode;
void main() {
  v_uv = a_uv;
  v_mode = a_mode;
  gl_Position = u_matrix * vec4(a_pos, 1.0);
}
`;

const POI_FRAG = `
precision mediump float;
uniform sampler2D u_atlas;
uniform vec3 u_green;
varying vec2 v_uv;
varying float v_mode;
void main() {
  if (v_mode < 0.5) {
    vec4 tex = texture2D(u_atlas, v_uv);
    if (tex.a < 0.02) discard;
    gl_FragColor = tex;
  } else {
    float a = mix(0.05, 0.45, v_uv.y);
    gl_FragColor = vec4(u_green, a);
  }
}
`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  return sh;
}

export function createPoiAnchorLayer() {
  let program = null;
  let buffer = null;
  let texture = null;
  let layerMap = null;
  const uniforms = {};
  const attribs = {};
  const state = { anchors: [], signature: "", atlasDirty: true };
  // 12 anchors x 12 verts x 6 floats — preallocated, zero per-frame allocation.
  const vertData = new Float32Array(POI_MAX * 12 * 6);

  const setAnchors = (anchors) => {
    const list = Array.isArray(anchors) ? anchors : [];
    const sig = list.map((a) => a.name).join("|");
    state.anchors = list;
    if (sig !== state.signature) {
      state.signature = sig;
      state.atlasDirty = true;
    }
  };

  const rebuildAtlas = (gl) => {
    const canvas = document.createElement("canvas");
    canvas.width = CELL * ATLAS_COLS;
    canvas.height = CELL * ATLAS_ROWS;
    const g = canvas.getContext("2d");
    state.anchors.forEach((a, i) => {
      const col = i % ATLAS_COLS;
      const row = Math.floor(i / ATLAS_COLS);
      g.drawImage(drawBadge(a), col * CELL, row * CELL);
    });
    if (texture) gl.deleteTexture(texture);
    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    state.atlasDirty = false;
  };

  // Rebuild billboard vertices for the current camera. Same mercator approach
  // as the destination beam layer.
  const buildVertices = (map) => {
    const anchors = state.anchors;
    if (!anchors.length) return 0;
    let rx = 1;
    let ry = 0;
    try {
      const a0 = anchors[0];
      const cam = map.getFreeCameraOptions().position;
      const mc = mapboxgl.MercatorCoordinate.fromLngLat({ lng: a0.lng, lat: a0.lat });
      let dx = mc.x - cam.x;
      let dy = mc.y - cam.y;
      const len = Math.hypot(dx, dy) || 1;
      rx = -(dy / len);
      ry = dx / len;
    } catch {
      // North-facing fallback; anchors still draw.
    }
    let o = 0;
    const push = (x, y, z, u, v, mode) => {
      vertData[o++] = x;
      vertData[o++] = y;
      vertData[o++] = z;
      vertData[o++] = u;
      vertData[o++] = v;
      vertData[o++] = mode;
    };
    const M = mapboxgl.MercatorCoordinate;
    anchors.forEach((a, i) => {
      const mPerDegLat = 111320;
      const mPerDegLng = 111320 * Math.cos((a.lat * Math.PI) / 180);
      const at = (eastM, northM, altM) => {
        const mc = M.fromLngLat(
          { lng: a.lng + eastM / mPerDegLng, lat: a.lat + northM / mPerDegLat },
          altM
        );
        return [mc.x, mc.y, mc.z];
      };
      const [u0, v0, u1, v1] = uvFor(i);
      const hs = POI_HALF_M;
      const cz = a.roofH + POI_LIFT_M + hs; // badge center altitude
      // Badge billboard: 6 verts, mode 0.
      const bl = at(-rx * hs, -ry * hs, cz - hs);
      const br = at(rx * hs, ry * hs, cz - hs);
      const tr = at(rx * hs, ry * hs, cz + hs);
      const tl = at(-rx * hs, -ry * hs, cz + hs);
      push(...bl, u0, v0, 0); push(...br, u1, v0, 0); push(...tr, u1, v1, 0);
      push(...bl, u0, v0, 0); push(...tr, u1, v1, 0); push(...tl, u0, v1, 0);
      // Leader: vertical quad roof -> badge bottom, mode 1, v=0 at roof.
      const lw = POI_LEADER_HALF_M;
      const top = a.roofH + POI_LIFT_M;
      const l0 = at(-rx * lw, -ry * lw, a.roofH);
      const l1 = at(rx * lw, ry * lw, a.roofH);
      const l2 = at(rx * lw, ry * lw, top);
      const l3 = at(-rx * lw, -ry * lw, top);
      push(...l0, 0, 0, 1); push(...l1, 1, 0, 1); push(...l2, 1, 1, 1);
      push(...l0, 0, 0, 1); push(...l2, 1, 1, 1); push(...l3, 0, 1, 1);
    });
    return anchors.length * 12;
  };

  return {
    id: POI_LAYER_ID,
    type: "custom",
    renderingMode: "3d",
    setAnchors,
    onAdd(map, gl) {
      layerMap = map;
      const vs = compile(gl, gl.VERTEX_SHADER, POI_VERT);
      const fs = compile(gl, gl.FRAGMENT_SHADER, POI_FRAG);
      program = gl.createProgram();
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      buffer = gl.createBuffer();
      uniforms.u_matrix = gl.getUniformLocation(program, "u_matrix");
      uniforms.u_atlas = gl.getUniformLocation(program, "u_atlas");
      uniforms.u_green = gl.getUniformLocation(program, "u_green");
      attribs.a_pos = gl.getAttribLocation(program, "a_pos");
      attribs.a_uv = gl.getAttribLocation(program, "a_uv");
      attribs.a_mode = gl.getAttribLocation(program, "a_mode");
    },
    render(gl, matrix) {
      if (!program || !buffer || !state.anchors.length) return;
      if (state.atlasDirty) rebuildAtlas(gl);
      const count = buildVertices(layerMap);
      if (!count) return;
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertData, gl.DYNAMIC_DRAW);
      const stride = 24;
      gl.enableVertexAttribArray(attribs.a_pos);
      gl.vertexAttribPointer(attribs.a_pos, 3, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(attribs.a_uv);
      gl.vertexAttribPointer(attribs.a_uv, 2, gl.FLOAT, false, stride, 12);
      gl.enableVertexAttribArray(attribs.a_mode);
      gl.vertexAttribPointer(attribs.a_mode, 1, gl.FLOAT, false, stride, 20);
      gl.uniformMatrix4fv(uniforms.u_matrix, false, matrix);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(uniforms.u_atlas, 0);
      gl.uniform3f(uniforms.u_green, 0x8f / 255, 0xe4 / 255, 0x4e / 255);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.enable(gl.DEPTH_TEST); // badges stay behind nearer buildings — honest anchoring
      gl.depthMask(false);
      gl.drawArrays(gl.TRIANGLES, 0, count);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    },
    onRemove(map, gl) {
      if (texture) gl.deleteTexture(texture);
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
      program = null;
      buffer = null;
      texture = null;
      layerMap = null;
    },
  };
}
