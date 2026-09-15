// Nav Fusion v3.5 telemetry — lightweight in-memory counters and timings for
// fusion diagnostics. No network calls, no persistence.

const MAX_CONFIDENCE_SAMPLES = 20;

function emptyTiming() {
  return { count: 0, totalMs: 0, lastMs: 0, maxMs: 0 };
}

function emptyState() {
  return {
    sensorToScreen: emptyTiming(),
    render: emptyTiming(),
    reroutesAllowed: 0,
    reroutesBlocked: 0,
    gnssOutageMs: 0,
    lastFixMs: null,
    confidenceAtReroute: [],
  };
}

let state = emptyState();

function recordTiming(bucket, durationMs) {
  const value = Math.max(0, Number(durationMs) || 0);
  bucket.count += 1;
  bucket.totalMs += value;
  bucket.lastMs = value;
  bucket.maxMs = Math.max(bucket.maxMs, value);
}

function timingSummary(bucket) {
  return {
    avgMs: bucket.count ? Math.round(bucket.totalMs / bucket.count) : 0,
    lastMs: Math.round(bucket.lastMs),
    maxMs: Math.round(bucket.maxMs),
    count: bucket.count,
  };
}

/** Latency from the sensor timestamp to the moment the sample reached the engine. */
export function recordSensorToScreen(sensorTimestampMs, nowMs = Date.now()) {
  recordTiming(state.sensorToScreen, Math.max(0, Number(nowMs) - Number(sensorTimestampMs)));
}

/** Time spent producing a rendered (predicted) marker position. */
export function recordRenderMs(durationMs) {
  recordTiming(state.render, durationMs);
}

/**
 * Tracks GNSS outages: the gap between fixes is accumulated as outage time
 * while the engine is dead-reckoning.
 */
export function recordFix({ deadReckoned = false, timestampMs = Date.now() } = {}) {
  const timestamp = Number(timestampMs) || Date.now();
  if (state.lastFixMs != null && deadReckoned) {
    state.gnssOutageMs += Math.max(0, timestamp - state.lastFixMs);
  }
  state.lastFixMs = timestamp;
}

export function recordRerouteAllowed(positionConfidence) {
  state.reroutesAllowed += 1;
  const value = Number(positionConfidence);
  state.confidenceAtReroute.push(Number.isFinite(value) ? Math.round(value * 1000) / 1000 : 0);
  if (state.confidenceAtReroute.length > MAX_CONFIDENCE_SAMPLES) {
    state.confidenceAtReroute = state.confidenceAtReroute.slice(-MAX_CONFIDENCE_SAMPLES);
  }
}

export function recordRerouteBlocked() {
  state.reroutesBlocked += 1;
}

/** Compact JSON-serializable diagnostic of the current session. */
export function getReport() {
  return {
    sensorToScreenMs: timingSummary(state.sensorToScreen),
    renderMs: timingSummary(state.render),
    reroutesAllowed: state.reroutesAllowed,
    reroutesBlocked: state.reroutesBlocked,
    gnssOutageMs: Math.round(state.gnssOutageMs),
    confidenceAtReroute: [...state.confidenceAtReroute],
  };
}

export function resetTelemetry() {
  state = emptyState();
}