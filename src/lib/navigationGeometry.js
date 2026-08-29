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

function angularDifferenceDeg(a, b) {
  if (!Number.isFinite(Number(a)) || !Number.isFinite(Number(b))) return 0;
  return Math.abs((((Number(a) - Number(b)) % 360) + 540) % 360 - 180);
}

/**
 * Online HMM-style route matcher. Emission probability comes from distance and
 * heading agreement; transition probability comes from along-route continuity.
 * This is stateful across fixes through previousSnap and avoids the common
 * nearest-segment failure on parallel roads and divided highways.
 */
export function matchToRouteHMM(point, geometry = [], cumulativeInput, options = {}) {
  if (!point || !Array.isArray(geometry) || geometry.length < 2) return snapToRoute(point, geometry, cumulativeInput);

  const cumulative = cumulativeInput || routeCumulativeDistances(geometry);
  const previous = options.previousSnap || null;
  const heading = options.heading == null ? Number.NaN : Number(options.heading);
  const speedMps = Math.max(0, Number(options.speedMps) || 0);
  const accuracyM = Math.max(4, Math.min(60, Number(options.accuracyM) || 12));
  const timestamp = Number(options.timestamp) || Date.now();
  const sigmaDistance = Math.max(6, accuracyM);
  const sigmaHeading = speedMps >= 5 ? 28 : 45;

  const evaluate = (start, end) => {
    let best = null;
    for (let i = start; i < end; i++) {
      const p = projectPointToSegment(point, geometry[i], geometry[i + 1]);
      const segLen = haversineMeters(geometry[i], geometry[i + 1]);
      const alongRouteM = cumulative[i] + segLen * p.t;
      const segmentHeading = bearingDegrees(geometry[i], geometry[i + 1]);

      const distanceCost = Math.pow(p.distance_m / sigmaDistance, 2);
      const headingError = Number.isFinite(heading) && speedMps > 1.5 ? angularDifferenceDeg(heading, segmentHeading) : 0;
      const headingCost = Number.isFinite(heading) && speedMps > 1.5
        ? 0.9 * Math.pow(headingError / sigmaHeading, 2)
        : 0;

      let transitionCost = 0;
      if (previous && Number.isFinite(Number(previous.along_route_m))) {
        const dt = Math.max(0.05, Math.min(10, (timestamp - Number(previous.timestamp || timestamp)) / 1000));
        const previousSpeed = Math.max(0, Number(previous.speed_mps) || speedMps);
        const expectedTravel = previousSpeed * dt;
        const actualTravel = alongRouteM - Number(previous.along_route_m);

        // Strongly penalize jumping backward on the route unless position
        // uncertainty is large; modestly penalize impossible forward jumps.
        if (actualTravel < -Math.max(12, accuracyM)) {
          transitionCost += 5.0 * Math.pow(Math.abs(actualTravel) / Math.max(20, accuracyM * 1.5), 2);
        }
        const forwardResidual = Math.abs(actualTravel - expectedTravel);
        transitionCost += 0.55 * Math.pow(forwardResidual / Math.max(30, expectedTravel + accuracyM * 1.5), 2);

        const segmentJump = Math.abs(i - Number(previous.segment_index || 0));
        if (segmentJump > 45) transitionCost += Math.pow((segmentJump - 45) / 35, 2);
      }

      const cost = distanceCost + headingCost + transitionCost;
      if (!best || cost < best.cost) {
        best = {
          coordinate: p.coordinate,
          distance_m: p.distance_m,
          segment_index: i,
          segment_fraction: p.t,
          along_route_m: alongRouteM,
          cost,
          heading_error_deg: headingError,
          segment_heading_deg: segmentHeading,
        };
      }
    }
    return best;
  };

  let candidate;
  if (previous && Number.isFinite(Number(previous.segment_index))) {
    const center = Number(previous.segment_index);
    candidate = evaluate(Math.max(0, center - 24), Math.min(geometry.length - 1, center + 100));
    // If the local window is a very poor spatial fit, recover globally. This
    // allows route re-entry without letting every noisy fix teleport the snap.
    if (!candidate || candidate.distance_m > Math.max(75, accuracyM * 3.5)) {
      candidate = evaluate(0, geometry.length - 1);
    }
  } else {
    candidate = evaluate(0, geometry.length - 1);
  }

  if (!candidate) return null;
  const total = cumulative[cumulative.length - 1] || 0;
  const confidence = Math.max(0.01, Math.min(0.999, Math.exp(-candidate.cost / 2)));
  return {
    ...candidate,
    progress: total > 0 ? Math.max(0, Math.min(1, candidate.along_route_m / total)) : 0,
    match_confidence: confidence,
    match_method: "online-hmm",
  };
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
  const cumulative = routeCumulativeDistances(geometry);
  return (route?.maneuvers || []).map((m) => {
    const geometryIndex = m?.maneuver?.location ? nearestGeometryIndex(m.maneuver.location, geometry) : 0;
    return {
      ...m,
      geometry_index: geometryIndex,
      along_route_m: Number(cumulative?.[geometryIndex] || 0),
    };
  }).sort((a, b) => Number(a.along_route_m || 0) - Number(b.along_route_m || 0));
}

export function nextManeuverForSnap(maneuvers = [], snap, geometry = []) {
  if (!maneuvers.length || !snap) return null;
  const currentAlongM = Number(snap.along_route_m || 0);
  const passedToleranceM = 5;
  const next = maneuvers.find((m) => Number(m.along_route_m || 0) >= currentAlongM - passedToleranceM) || maneuvers[maneuvers.length - 1];
  const maneuverAlongM = Number(next?.along_route_m || 0);
  const routeDistanceM = Math.max(0, maneuverAlongM - currentAlongM);
  const location = next?.maneuver?.location;
  return {
    ...next,
    distance_from_driver_m: Number.isFinite(routeDistanceM)
      ? routeDistanceM
      : location ? haversineMeters(snap.coordinate, location) : null,
  };
}

export function formatDistance(meters) {
  const m = Number(meters || 0);
  if (m < 160.934) return `${Math.max(20, Math.round(m / 10) * 10)} ft`;
  const miles = m / 1609.344;
  return miles < 10 ? `${miles.toFixed(1)} mi` : `${Math.round(miles)} mi`;
}

export function formatDuration(seconds) {
  const value = Math.max(0, Number(seconds || 0));
  if (value > 0 && value < 60) return "<1 min";
  const min = Math.max(0, Math.round(value / 60));
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
