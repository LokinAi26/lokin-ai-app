const EARTH_RADIUS_M = 6371008.8;

function toRad(v) { return (Number(v) * Math.PI) / 180; }
function toDeg(v) { return (Number(v) * 180) / Math.PI; }

export function haversineMeters(a, b) {
  if (!a || !b) return Infinity;
  const lon1 = Number(a[0]), lat1 = Number(a[1]);
  const lon2 = Number(b[0]), lat2 = Number(b[1]);
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const p1 = toRad(lat1), p2 = toRad(lat2);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

function localMeters(coord, anchor) {
  const lat0 = toRad(anchor[1]);
  return [
    toRad(coord[0] - anchor[0]) * EARTH_RADIUS_M * Math.cos(lat0),
    toRad(coord[1] - anchor[1]) * EARTH_RADIUS_M,
  ];
}

function fromLocalMeters(x, y, anchor) {
  const lat0 = toRad(anchor[1]);
  const lon = anchor[0] + toDeg(x / (EARTH_RADIUS_M * Math.max(0.000001, Math.cos(lat0))));
  const lat = anchor[1] + toDeg(y / EARTH_RADIUS_M);
  return [lon, lat];
}

function projectPointToSegment(point, a, b) {
  const anchor = a;
  const p = localMeters(point, anchor);
  const av = [0, 0];
  const bv = localMeters(b, anchor);
  const vx = bv[0] - av[0], vy = bv[1] - av[1];
  const wx = p[0] - av[0], wy = p[1] - av[1];
  const vv = vx * vx + vy * vy;
  const t = vv > 0 ? Math.max(0, Math.min(1, (wx * vx + wy * vy) / vv)) : 0;
  const x = av[0] + t * vx, y = av[1] + t * vy;
  const dx = p[0] - x, dy = p[1] - y;
  return { coordinate: fromLocalMeters(x, y, anchor), distance_m: Math.hypot(dx, dy), t };
}

export function routeCumulativeDistances(geometry = []) {
  const out = [0];
  for (let i = 1; i < geometry.length; i++) out.push(out[i - 1] + haversineMeters(geometry[i - 1], geometry[i]));
  return out;
}

export function snapToRoute(point, geometry = [], cumulativeInput) {
  if (!point || !Array.isArray(geometry) || geometry.length === 0) return null;
  if (geometry.length === 1) return { coordinate: geometry[0], distance_m: haversineMeters(point, geometry[0]), segment_index: 0, segment_fraction: 0, along_route_m: 0, progress: 0 };

  const cumulative = cumulativeInput || routeCumulativeDistances(geometry);
  let best = null;
  for (let i = 0; i < geometry.length - 1; i++) {
    const p = projectPointToSegment(point, geometry[i], geometry[i + 1]);
    if (!best || p.distance_m < best.distance_m) {
      const segLen = haversineMeters(geometry[i], geometry[i + 1]);
      best = {
        coordinate: p.coordinate,
        distance_m: p.distance_m,
        segment_index: i,
        segment_fraction: p.t,
        along_route_m: cumulative[i] + segLen * p.t,
      };
    }
  }
  const total = cumulative[cumulative.length - 1] || 0;
  return { ...best, progress: total > 0 ? Math.max(0, Math.min(1, best.along_route_m / total)) : 0 };
}

export function nearestGeometryIndex(coord, geometry = []) {
  if (!coord || !geometry.length) return 0;
  let bestIndex = 0, bestDistance = Infinity;
  for (let i = 0; i < geometry.length; i++) {
    const d = haversineMeters(coord, geometry[i]);
    if (d < bestDistance) { bestDistance = d; bestIndex = i; }
  }
  return bestIndex;
}

export function prepareManeuvers(route) {
  const geometry = route?.geometry?.coordinates || [];
  return (route?.maneuvers || []).map((m) => ({
    ...m,
    geometry_index: m?.maneuver?.location ? nearestGeometryIndex(m.maneuver.location, geometry) : 0,
  })).sort((a, b) => a.geometry_index - b.geometry_index);
}

export function nextManeuverForSnap(maneuvers = [], snap, geometry = []) {
  if (!maneuvers.length || !snap) return null;
  const currentIndex = snap.segment_index || 0;
  const next = maneuvers.find((m) => Number(m.geometry_index || 0) >= currentIndex) || maneuvers[maneuvers.length - 1];
  const location = next?.maneuver?.location;
  return {
    ...next,
    distance_from_driver_m: location ? haversineMeters(snap.coordinate, location) : null,
  };
}

export function formatDistance(meters) {
  const m = Number(meters || 0);
  if (m < 160.934) return `${Math.max(20, Math.round(m / 10) * 10)} ft`;
  const miles = m / 1609.344;
  return miles < 10 ? `${miles.toFixed(1)} mi` : `${Math.round(miles)} mi`;
}

export function formatDuration(seconds) {
  const min = Math.max(0, Math.round(Number(seconds || 0) / 60));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), r = min % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

export function bearingDegrees(a, b) {
  if (!a || !b) return 0;
  const lon1 = toRad(a[0]), lat1 = toRad(a[1]);
  const lon2 = toRad(b[0]), lat2 = toRad(b[1]);
  const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function geometryToScenePoints(geometry = [], maxPoints = 180, span = 18) {
  if (!Array.isArray(geometry) || geometry.length === 0) return { points: [], project: () => null };
  const step = Math.max(1, Math.ceil(geometry.length / maxPoints));
  const sampled = geometry.filter((_, i) => i === 0 || i === geometry.length - 1 || i % step === 0);
  const anchor = sampled[0];
  const local = sampled.map((c) => localMeters(c, anchor));
  const xs = local.map((p) => p[0]), ys = local.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2;
  const extent = Math.max(1, maxX - minX, maxY - minY);
  const scale = span / extent;
  const points = local.map(([x, y]) => ({ x: (x - centerX) * scale, z: -(y - centerY) * scale }));
  const project = (coord) => {
    if (!coord) return null;
    const [x, y] = localMeters(coord, anchor);
    return { x: (x - centerX) * scale, z: -(y - centerY) * scale };
  };
  return { points, project, scale, anchor };
}
