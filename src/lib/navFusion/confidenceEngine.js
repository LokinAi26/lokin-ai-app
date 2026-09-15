import { clamp, sampleConfidence } from "@/lib/navigationQuality";
import { FUSION_CONFIG } from "./config";

/**
 * Nav Fusion v3.5 confidence engine — the ported decision layer of the
 * validated fusion-core prototype. Classifies each fix, decays confidence
 * with age, and applies the additive reroute gate. Every threshold comes from
 * config.js; no decision numbers live here.
 *
 * @returns {{
 *   positionConfidence: number,
 *   roadMatchConfidence: number,
 *   gnssQuality: "STRONG"|"WEAK"|"LOST",
 *   fusionState: "NOMINAL"|"COASTING"|"DEGRADED",
 *   usableForReroute: boolean,
 *   reasons: string[],
 * }}
 */
export function computeConfidence(sample, roadMatch = null, context = {}) {
  const config = context.config || FUSION_CONFIG;
  const nowMs = Number(context.nowMs) || Date.now();
  const sensorTimestamp = Number(sample?.timestamp) || nowMs;
  const ageMs = Math.max(0, nowMs - sensorTimestamp);
  const stale = ageMs > config.staleSampleMs;
  const deadReckoned = sample?.dead_reckoned === true || sample?.source === "DEAD_RECKONED";
  const predictionAgeMs = Math.max(0, Number(sample?.predictionAgeMs) || 0);

  // Base confidence comes from the validated sample curve; sample age decays it.
  const explicitConfidence = Number(sample?.confidence);
  const accuracyM = Number(sample?.confidenceRadius ?? sample?.accuracy_m);
  const baseConfidence = sampleConfidence({
    accuracy_m: Number.isFinite(accuracyM) ? accuracyM : undefined,
    ...(Number.isFinite(explicitConfidence) ? { confidence: explicitConfidence } : {}),
  });
  const ageFactor = clamp(1 - config.confidenceDecayPerSec * (ageMs / 1000), 0, 1);
  const positionConfidence = clamp(baseConfidence * ageFactor, 0, 1);

  const roadMatchConfidence = Number.isFinite(Number(roadMatch?.confidence))
    ? clamp(Number(roadMatch.confidence), 0, 1)
    : config.minRoadMatchConfidence;

  const strongFloor = config.minPositionConfidenceForReroute;
  const weakFloor = strongFloor / 2;
  let gnssQuality = "WEAK";
  if (!deadReckoned && positionConfidence >= strongFloor) {
    gnssQuality = "STRONG";
  } else if (deadReckoned || positionConfidence < weakFloor) {
    gnssQuality = "LOST";
  }

  let fusionState = "DEGRADED";
  if (deadReckoned && !stale) {
    fusionState = "COASTING";
  } else if (gnssQuality === "STRONG" && roadMatchConfidence >= config.minRoadMatchConfidence) {
    fusionState = "NOMINAL";
  }

  const reasons = [];
  let usableForReroute = true;
  if (deadReckoned && positionConfidence < strongFloor) {
    usableForReroute = false;
    reasons.push("dead_reckoned_below_position_confidence");
  }
  if (positionConfidence < strongFloor) {
    usableForReroute = false;
    reasons.push("position_confidence_below_threshold");
  }
  if (predictionAgeMs > config.maxPredictionAgeMs) {
    usableForReroute = false;
    reasons.push("prediction_age_exceeded");
  }
  if (gnssQuality === "LOST" && roadMatchConfidence < config.minRoadMatchConfidence) {
    usableForReroute = false;
    reasons.push("gnss_lost_without_road_match");
  }
  if (stale) {
    usableForReroute = false;
    reasons.push("stale_sample");
  }

  return {
    positionConfidence,
    roadMatchConfidence,
    gnssQuality,
    fusionState,
    usableForReroute,
    reasons,
  };
}