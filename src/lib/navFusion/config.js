// Nav Fusion v3.5 — single source of truth for every fusion threshold.
// Remote-config style: consumers read FUSION_CONFIG; an operator can serialize
// it with fusionConfigToJSON() and restore a validated subset with
// fusionConfigFromJSON() without touching code.

export const FUSION_CONFIG = {
  /** Minimum position confidence required before a fix may authorize a reroute. */
  minPositionConfidenceForReroute: 0.70,
  /** Minimum road-match confidence required to trust route-snapped geometry. */
  minRoadMatchConfidence: 0.60,
  /** A predicted position older than this is no longer trusted for rerouting. */
  maxPredictionAgeMs: 500,
  /** Always-on marker lead time for predictive rendering. */
  renderPredictionHorizonMs: 200,
  /** Longer navigation-only horizon; gated behind road-match confidence. */
  navPredictionHorizonMs: 1500,
  /** A fix older than this is stale and cannot authorize a reroute. */
  staleSampleMs: 5000,
  /** Linear confidence decay applied per second of sample age. */
  confidenceDecayPerSec: 0.35,
};

const NUMERIC_KEYS = Object.keys(FUSION_CONFIG);

/** Serializes the active (or a provided) config for remote-config transport. */
export function fusionConfigToJSON(config = FUSION_CONFIG) {
  return JSON.stringify(config, null, 2);
}

/** Restores a config from JSON, keeping fallback values for invalid entries. */
export function fusionConfigFromJSON(json, { fallback = FUSION_CONFIG } = {}) {
  let parsed = json;
  if (typeof json === "string") {
    try {
      parsed = JSON.parse(json);
    } catch {
      return { ...fallback };
    }
  }
  const merged = { ...fallback };
  for (const key of NUMERIC_KEYS) {
    const value = Number(parsed?.[key]);
    if (Number.isFinite(value) && value >= 0) merged[key] = value;
  }
  return merged;
}