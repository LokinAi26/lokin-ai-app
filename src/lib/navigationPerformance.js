export function clampNavigationValue(value, min, max) {
  return Math.max(min, Math.min(max, Number(value)));
}

export function shouldAcceptNavigationSample(sample, previous = null) {
  if (!sample?.coordinate || sample.coordinate.length < 2) return false;
  const timestamp = Number(sample.timestamp || 0);
  const seq = Number(sample.seq);
  if (!previous) return true;

  const previousTimestamp = Number(previous.timestamp || 0);
  const previousSeq = Number(previous.seq);

  if (Number.isFinite(seq) && Number.isFinite(previousSeq) && seq <= previousSeq) return false;
  if (timestamp > 0 && previousTimestamp > 0 && timestamp + 75 < previousTimestamp) return false;
  return true;
}

export function navigationSampleIntervalMs(sample, previous = null) {
  const explicit = Number(sample?.interval_ms);
  if (Number.isFinite(explicit) && explicit > 0) return clampNavigationValue(explicit, 80, 1200);
  const timestamp = Number(sample?.timestamp || 0);
  const previousTimestamp = Number(previous?.timestamp || 0);
  if (timestamp > 0 && previousTimestamp > 0 && timestamp > previousTimestamp) {
    return clampNavigationValue(timestamp - previousTimestamp, 80, 1200);
  }
  return 300;
}

export function rendererInterpolationBudgetMs(sample, nowMs = Date.now()) {
  const interval = navigationSampleIntervalMs(sample);
  const timestamp = Number(sample?.timestamp || nowMs);
  const ageMs = Math.max(0, nowMs - timestamp);
  const speedMps = Math.max(0, Number(sample?.speed_mps || 0));
  const deadReckoned = sample?.dead_reckoned === true;

  let target = interval * 0.72 - ageMs * 0.55;
  if (speedMps >= 22) target *= 0.82;
  if (deadReckoned) target *= 0.78;

  return clampNavigationValue(target, 90, 520);
}

export function navigationFreshness(sample, nowMs = Date.now()) {
  const timestamp = Number(sample?.timestamp || 0);
  if (!timestamp) return { ageMs: Infinity, state: "unknown" };
  const ageMs = Math.max(0, nowMs - timestamp);
  return {
    ageMs,
    state: ageMs <= 750 ? "fresh" : ageMs <= 2000 ? "aging" : "stale",
  };
}
