import { FUSION_CONFIG } from "./config";
import { createNavigationPosition, resolvePositionSource } from "./types";
import { computeConfidence } from "./confidenceEngine";
import { predictRender, reconcileMarker } from "./predictor";
import { recordFix, recordSensorToScreen } from "./telemetry";

export { FUSION_CONFIG, fusionConfigToJSON, fusionConfigFromJSON } from "./config";
export { createNavigationPosition, POSITION_SOURCES, resolvePositionSource } from "./types";
export { computeConfidence } from "./confidenceEngine";
export { predictRender, predictNavigation, reconcileMarker } from "./predictor";
export { SCORING_WEIGHTS, getStubCandidates, scoreCandidates } from "./roadMatcher";
export {
  getReport,
  recordFix,
  recordRenderMs,
  recordRerouteAllowed,
  recordRerouteBlocked,
  recordSensorToScreen,
  resetTelemetry,
} from "./telemetry";

/**
 * FusionEngine — the web-layer fusion gate that sits on the samples the app
 * already receives. It resolves each accepted sample into a NavigationPosition,
 * eases the rendered marker between fixes, and maintains the confidence used
 * to gate reroutes. Raw IMU fusion stays on the native side.
 */
export class FusionEngine {
  constructor(config = FUSION_CONFIG) {
    this.config = config;
    this._position = null;
    this._roadMatch = null;
    this._confidence = null;
    this._lastSample = null;
  }

  /**
   * Ingests a normalized location sample and returns the marker-base
   * NavigationPosition (the eased position the renderer should lead from).
   */
  ingest(normalizedSample) {
    const nowMs = Date.now();
    const sample = normalizedSample || {};
    const sensorTimestamp = Number(sample.timestamp) || nowMs;
    const source = resolvePositionSource(sample);
    const roadMatchConfidence = Number(this._roadMatch?.confidence);
    const position = createNavigationPosition({
      latitude: sample.latitude,
      longitude: sample.longitude,
      altitude: sample.altitude_m,
      speed: sample.speed_mps,
      bearing: sample.heading,
      yawRate: sample.yawRateDeg ?? sample.yaw_rate_deg,
      horizontalAccuracy: sample.accuracy_m,
      confidenceRadius: sample.estimated_uncertainty_m ?? sample.accuracy_m,
      source,
      roadMatchConfidence: Number.isFinite(roadMatchConfidence) ? roadMatchConfidence : null,
      predictionAgeMs: 0,
      sensorTimestamp,
      renderTimestamp: nowMs,
    });

    recordSensorToScreen(sensorTimestamp, nowMs);
    recordFix({ deadReckoned: source === "DEAD_RECKONED", timestampMs: sensorTimestamp });
    this._lastSample = {
      ...sample,
      confidenceRadius: position.confidenceRadius,
      source,
      predictionAgeMs: 0,
    };

    // Predictive rendering: project where the previous fix said we would be
    // now, then ease the marker from that prediction toward the fresh fix —
    // never snap.
    let markerBase = position;
    const previous = this._position;
    if (previous && Number.isFinite(Number(previous.latitude)) && Number.isFinite(Number(previous.longitude))) {
      const elapsedMs = Math.max(0, sensorTimestamp - (Number(previous.sensorTimestamp) || sensorTimestamp));
      const predictedNow = predictRender(previous, elapsedMs);
      const anchoredPrediction = createNavigationPosition({
        ...predictedNow,
        renderTimestamp: previous.renderTimestamp,
      });
      markerBase = createNavigationPosition({
        ...reconcileMarker(anchoredPrediction, position, this.config),
        renderTimestamp: nowMs,
      });
    }

    this._position = position;
    this._confidence = computeConfidence(this._lastSample, this._roadMatch, {
      nowMs,
      config: this.config,
    });
    return markerBase;
  }

  /** Feeds the latest route-snap result back so the confidence gate can re-evaluate. */
  updateRoadMatch(match) {
    this._roadMatch = match;
    if (this._lastSample) {
      this._confidence = computeConfidence(this._lastSample, match, {
        nowMs: Date.now(),
        config: this.config,
      });
    }
  }

  getPosition() {
    return this._position;
  }

  getConfidence() {
    return this._confidence;
  }

  shouldAllowReroute() {
    return this._confidence?.usableForReroute === true;
  }

  reset() {
    this._position = null;
    this._roadMatch = null;
    this._confidence = null;
    this._lastSample = null;
  }
}