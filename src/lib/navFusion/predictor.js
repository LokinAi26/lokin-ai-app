import { FUSION_CONFIG } from "./config";
import { createNavigationPosition } from "./types";

const METERS_PER_DEGREE_LAT = 111320;

function isProjectable(position) {
  return (
    Number.isFinite(Number(position?.latitude)) &&
    Number.isFinite(Number(position?.longitude)) &&
    Number.isFinite(Number(position?.speed))
  );
}

/**
 * Kinematic projection: advances latitude/longitude along the bearing at the
 * reported speed, curving by yaw rate when the native layer supplies one.
 */
function projectKinematic(position, horizonMs) {
  const tS = Math.max(0, Number(horizonMs) || 0) / 1000;
  const speed = Math.max(0, Number(position.speed) || 0);
  if (!tS || !speed) {
    return { latitude: position.latitude, longitude: position.longitude };
  }
  const baseBearingRad = ((Number(position.bearing) || 0) * Math.PI) / 180;
  const yawRateRadPerS = ((Number(position.yawRate) || 0) * Math.PI) / 180;
  const curvedBearingRad = baseBearingRad + yawRateRadPerS * (tS / 2);
  const distanceM = speed * tS;
  const dNorthM = distanceM * Math.cos(curvedBearingRad);
  const dEastM = distanceM * Math.sin(curvedBearingRad);
  const latitude = Number(position.latitude) + dNorthM / METERS_PER_DEGREE_LAT;
  const longitude =
    Number(position.longitude) +
    dEastM / (METERS_PER_DEGREE_LAT * Math.cos((Number(position.latitude) * Math.PI) / 180));
  return { latitude, longitude };
}

/**
 * Short render horizon (default +200 ms). ALWAYS applied to the map marker so
 * it leads the reported fix and never appears to lag the vehicle.
 */
export function predictRender(position, horizonMs = FUSION_CONFIG.renderPredictionHorizonMs) {
  const leadMs = Math.max(0, Number(horizonMs) || 0);
  const base = {
    ...position,
    source: "PREDICTED",
    predictionAgeMs: 0,
    predictionHorizonMs: leadMs,
    renderTimestamp: Date.now(),
  };
  if (!isProjectable(position)) return createNavigationPosition(base);
  return createNavigationPosition({ ...base, ...projectKinematic(position, leadMs) });
}

/**
 * Longer navigation horizon (default 1500 ms). Only projected when the road
 * match is confident enough to trust snapped geometry; otherwise returns null
 * and callers must keep using the last confident position.
 */
export function predictNavigation(position, horizonMs = FUSION_CONFIG.navPredictionHorizonMs) {
  const roadMatchConfidence = Number(position?.roadMatchConfidence);
  if (!Number.isFinite(roadMatchConfidence) || roadMatchConfidence < FUSION_CONFIG.minRoadMatchConfidence) {
    return null;
  }
  const leadMs = Math.max(0, Number(horizonMs) || 0);
  const base = {
    ...position,
    source: "PREDICTED",
    predictionAgeMs: 0,
    predictionHorizonMs: leadMs,
    renderTimestamp: Date.now(),
  };
  if (!isProjectable(position)) return createNavigationPosition(base);
  return createNavigationPosition({ ...base, ...projectKinematic(position, leadMs) });
}

/**
 * Reconcile: when a fresh sample arrives, ease the marker from the predicted
 * point toward the actual fix over the render horizon — the blend converges
 * asymptotically, so the marker is never hard-snapped to a jump.
 */
export function reconcileMarker(predicted, actual, config = FUSION_CONFIG) {
  if (!actual) return predicted || null;
  if (!predicted) return actual;
  if (!isProjectable(predicted) || !isProjectable(actual)) return actual;
  const predictedAtMs = Number(predicted.renderTimestamp) || 0;
  const actualAtMs = Number(actual.renderTimestamp) || predictedAtMs;
  const elapsedMs = Math.max(0, actualAtMs - predictedAtMs);
  const ease = elapsedMs / (elapsedMs + Math.max(1, config.renderPredictionHorizonMs));
  return createNavigationPosition({
    ...actual,
    latitude: predicted.latitude + (actual.latitude - predicted.latitude) * ease,
    longitude: predicted.longitude + (actual.longitude - predicted.longitude) * ease,
  });
}