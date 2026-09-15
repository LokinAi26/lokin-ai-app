// Nav Fusion v3.5 — NavigationPosition value type and factory.
// The web layer never sees raw IMU; it receives normalized location samples
// from the native bridge and projects them into this common shape. The
// error-state Kalman filter itself stays on the native side.

export const POSITION_SOURCES = Object.freeze([
  "GNSS",
  "FUSED",
  "DEAD_RECKONED",
  "ROAD_MATCHED",
  "PREDICTED",
]);

/**
 * @typedef {Object} NavigationPosition
 * @property {number|null} latitude
 * @property {number|null} longitude
 * @property {number|null} altitude
 * @property {number|null} speed
 * @property {number|null} bearing
 * @property {number|null} yawRate
 * @property {number|null} horizontalAccuracy
 * @property {number|null} confidenceRadius
 * @property {"GNSS"|"FUSED"|"DEAD_RECKONED"|"ROAD_MATCHED"|"PREDICTED"} source
 * @property {number|null} roadMatchConfidence
 * @property {number} predictionAgeMs
 * @property {number|null} sensorTimestamp
 * @property {number|null} renderTimestamp
 * @property {{ semiMajorM: number, semiMinorM: number, orientationDeg: number }} confidenceEllipse
 * @property {number} predictionHorizonMs
 */

function numOrNull(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function buildEllipse(input, radius) {
  const ellipse = input.confidenceEllipse;
  const semiMajorM = numOrNull(ellipse?.semiMajorM);
  if (semiMajorM != null) {
    return {
      semiMajorM,
      semiMinorM: numOrNull(ellipse?.semiMinorM) ?? semiMajorM,
      orientationDeg: numOrNull(ellipse?.orientationDeg) ?? 0,
    };
  }
  return { semiMajorM: radius, semiMinorM: radius, orientationDeg: 0 };
}

/**
 * Factory: builds a fully-populated NavigationPosition, nulling invalid
 * fields and defaulting the confidence ellipse to a circle around the
 * confidence radius.
 */
export function createNavigationPosition(input = {}) {
  const horizontalAccuracy = numOrNull(input.horizontalAccuracy);
  const confidenceRadius = numOrNull(input.confidenceRadius);
  const radius = confidenceRadius ?? horizontalAccuracy ?? 0;
  return {
    latitude: numOrNull(input.latitude),
    longitude: numOrNull(input.longitude),
    altitude: numOrNull(input.altitude),
    speed: numOrNull(input.speed),
    bearing: numOrNull(input.bearing),
    yawRate: numOrNull(input.yawRate),
    horizontalAccuracy,
    confidenceRadius,
    source: POSITION_SOURCES.includes(input.source) ? input.source : "GNSS",
    roadMatchConfidence: numOrNull(input.roadMatchConfidence),
    predictionAgeMs: Math.max(0, Number(input.predictionAgeMs) || 0),
    sensorTimestamp: numOrNull(input.sensorTimestamp),
    renderTimestamp: numOrNull(input.renderTimestamp),
    confidenceEllipse: buildEllipse(input, radius),
    predictionHorizonMs: Math.max(0, Number(input.predictionHorizonMs) || 0),
  };
}

/** Resolves the fusion source label for a normalized location sample. */
export function resolvePositionSource(sample) {
  if (sample?.dead_reckoned === true) return "DEAD_RECKONED";
  const source = String(sample?.source || "");
  if (source.startsWith("native")) return "FUSED";
  if (source === "road-matched") return "ROAD_MATCHED";
  return "GNSS";
}