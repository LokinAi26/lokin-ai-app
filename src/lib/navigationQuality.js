export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value)));
}

export function sampleConfidence(sample) {
  const explicit = Number(sample?.confidence);
  if (Number.isFinite(explicit)) return clamp(explicit, 0, 1);
  const accuracy = Math.max(1, Number(sample?.accuracy_m) || 20);
  return clamp(Math.exp(-accuracy / 90), 0.05, 0.98);
}

/**
 * Adaptive off-route policy for noisy urban GPS and sensor-fusion outages.
 * Dead-reckoned samples are valid for map continuity but never authorize a
 * network reroute by themselves; a fresh absolute anchor must confirm it.
 */
export function reroutePolicy(sample, snap) {
  const accuracyM = Math.max(4, Number(sample?.accuracy_m) || 20);
  const confidence = sampleConfidence(sample);
  const matchConfidence = Number.isFinite(Number(snap?.match_confidence))
    ? clamp(Number(snap.match_confidence), 0, 1)
    : 0.7;
  const deadReckoned = sample?.dead_reckoned === true;

  const uncertaintyMultiplier = accuracyM <= 12 ? 1.45 : accuracyM <= 30 ? 1.8 : 2.25;
  const confidencePenalty = matchConfidence < 0.35 ? 25 : matchConfidence < 0.55 ? 10 : 0;
  const thresholdM = clamp(Math.max(32, accuracyM * uncertaintyMultiplier + confidencePenalty), 32, 140);

  const requiredSamples = accuracyM <= 12 && matchConfidence >= 0.6 ? 3
    : accuracyM <= 30 && matchConfidence >= 0.4 ? 4
      : 5;
  const cooldownMs = accuracyM <= 20 ? 12_000 : 18_000;

  return {
    thresholdM,
    requiredSamples,
    cooldownMs,
    confidence,
    matchConfidence,
    deadReckoned,
    canReroute: !deadReckoned && confidence >= 0.35 && matchConfidence >= 0.20,
    quality: confidence >= 0.72 && matchConfidence >= 0.55
      ? "high"
      : confidence >= 0.42 && matchConfidence >= 0.30
        ? "medium"
        : "low",
  };
}

/** Confidence curve used by the native v2.1 field-calibration simulator. */
export function deadReckoningEnvelope(anchorAccuracyM, ageS) {
  const age = clamp(ageS, 0, 120);
  const accuracy = Math.max(4, Number(anchorAccuracyM) || 8);
  const uncertaintyM = Math.min(220, accuracy + age * 5.5 + age * age * 0.20);
  const confidence = clamp(Math.exp(-age / 8.0) * Math.exp(-uncertaintyM / 180.0), 0.03, 0.98);
  return {
    ageS: age,
    uncertaintyM,
    confidence,
    usableForMapContinuity: age <= 20 && confidence >= 0.03,
    authoritative: false,
  };
}
