const LOCATION_EVENT = "lokin:native-location";
const AUTH_EVENT = "lokin:native-location-authorization";
const ERROR_EVENT = "lokin:native-location-error";
const QUEUE_EVENT = "lokin:native-location-queue";

function iosHandler() {
  if (typeof window === "undefined") return null;
  const nativeWindow = /** @type {any} */ (window);
  return nativeWindow.webkit?.messageHandlers?.lokinLocation || null;
}

function androidHandler() {
  if (typeof window === "undefined") return null;
  const nativeWindow = /** @type {any} */ (window);
  return nativeWindow.LokinLocation || null;
}

export function nativeLocationAvailable() {
  return Boolean(iosHandler() || androidHandler());
}

export function postNativeLocationCommand(command, payload = {}) {
  const body = { command, ...payload };
  const ios = iosHandler();
  if (ios?.postMessage) {
    ios.postMessage(body);
    return true;
  }

  const android = androidHandler();
  if (android?.postMessage) {
    android.postMessage(JSON.stringify(body));
    return true;
  }
  return false;
}

/** @param {{ mode?: string, sessionId?: string }} [options] */
export function startNativeLocation({ mode = "activeNavigation", sessionId } = {}) {
  return postNativeLocationCommand("start", { mode, sessionId });
}

export function stopNativeLocation() {
  return postNativeLocationCommand("stop");
}

export function requestNativeWhenInUse() {
  return postNativeLocationCommand("requestWhenInUse");
}

export function requestNativeAlways() {
  return postNativeLocationCommand("requestAlways");
}

export function requestNativePrecise() {
  return postNativeLocationCommand("requestPrecise");
}

export function drainNativeLocationQueue(limit = 120) {
  return postNativeLocationCommand("drain", { limit });
}

export function acknowledgeNativeLocationQueue(throughSeq) {
  return postNativeLocationCommand("ack", { throughSeq });
}

export function subscribeNativeLocation(callback) {
  if (typeof window === "undefined") return () => {};
  const handler = (event) => callback(event.detail);
  window.addEventListener(LOCATION_EVENT, handler);
  return () => window.removeEventListener(LOCATION_EVENT, handler);
}

export function subscribeNativeLocationAuthorization(callback) {
  if (typeof window === "undefined") return () => {};
  const handler = (event) => callback(event.detail);
  window.addEventListener(AUTH_EVENT, handler);
  return () => window.removeEventListener(AUTH_EVENT, handler);
}

export function subscribeNativeLocationError(callback) {
  if (typeof window === "undefined") return () => {};
  const handler = (event) => callback(event.detail);
  window.addEventListener(ERROR_EVENT, handler);
  return () => window.removeEventListener(ERROR_EVENT, handler);
}

export function subscribeNativeLocationQueue(callback) {
  if (typeof window === "undefined") return () => {};
  const handler = (event) => callback(event.detail);
  window.addEventListener(QUEUE_EVENT, handler);
  return () => window.removeEventListener(QUEUE_EVENT, handler);
}

export function normalizeNativeLocationSample(sample) {
  if (!sample) return null;
  const latitude = Number(sample.latitude);
  const longitude = Number(sample.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    coordinate: [longitude, latitude],
    latitude,
    longitude,
    accuracy_m: Number(sample.horizontalAccuracyM ?? sample.accuracy_m ?? 0),
    heading: Number.isFinite(Number(sample.headingDeg)) ? Number(sample.headingDeg) : null,
    speed_mps: Number.isFinite(Number(sample.speedMps)) ? Number(sample.speedMps) : null,
    altitude_m: Number.isFinite(Number(sample.altitudeM)) ? Number(sample.altitudeM) : null,
    barometric_altitude_m: Number.isFinite(Number(sample.barometricAltitudeM)) ? Number(sample.barometricAltitudeM) : null,
    confidence: Number.isFinite(Number(sample.confidence)) ? Number(sample.confidence) : null,
    dead_reckoned: sample.deadReckoned === true,
    authoritative: sample.authoritative !== false && sample.deadReckoned !== true,
    anchor_seq: Number.isFinite(Number(sample.anchorSeq)) ? Number(sample.anchorSeq) : null,
    estimated_uncertainty_m: Number.isFinite(Number(sample.estimatedUncertaintyM))
      ? Number(sample.estimatedUncertaintyM)
      : Number(sample.horizontalAccuracyM ?? sample.accuracy_m ?? 0),
    timestamp: Number(sample.timestampMs ?? sample.timestamp ?? Date.now()),
    seq: Number.isFinite(Number(sample.seq)) ? Number(sample.seq) : null,
    source: sample.source || "native",
  };
}
