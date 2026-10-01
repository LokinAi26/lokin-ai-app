import {
  drainNativeLocationQueue,
  nativeLocationAvailable,
  normalizeNativeLocationSample,
  requestNativeRuntimeStatus,
  requestNativeWhenInUse,
  startNativeLocation,
  stopNativeLocation,
  subscribeNativeLocationAuthorization,
  subscribeNativeLocationError,
  subscribeNativeLocationQueue,
} from "@/lib/nativeLocationBridge";
import { gpsSuperAgent } from "@/lib/gpsSuperAgent";

// App-scope location session (global-readiness fix).
//
// Owns RAW location acquisition for the whole app lifetime: the native engine
// start/stop via the native bridge, the permission flow, the web
// watchPosition fallback, queue drain / warm-start, and accuracy-mode-change
// restarts. Previously this lived in the navigation hook, so leaving AiGps /
// VisionHud stopped the engine and the GPS Command Center showed a decaying
// tail with a dead RESTART button. Now acquisition starts once at app launch
// (DriverLayout mount) and never stops on page navigation.
//
// Sample flow:
// - Native live samples keep flowing on the existing native bus (the hook and
//   the GPS super agent already subscribe to it directly).
// - Web + warm-start samples are published on LOCATION_SAMPLE_EVENT and
//   ingested into the super agent here.
// - Lifecycle ("starting" | "active" | "waiting" | "denied" | "error") is
//   published on LOCATION_SESSION_EVENT for hook / page UX.
// The super agent's restart handler is registered here PERMANENTLY (never
// nulled on unmount) — requestRestart("manual") from the Command Center now
// re-acquires from any page.

export const LOCATION_SAMPLE_EVENT = "lokin:location-sample";
export const LOCATION_SESSION_EVENT = "lokin:location-session";

let started = false;
let sessionState = "idle";
let sessionMessage = "";
let startedAt = null;
let nativeEngineOn = false;
let webWatchId = null;
let watchdogId = null;
let sessionId = null;
let unsubscribers = [];

function emitSession(state, message = "") {
  sessionState = state;
  sessionMessage = message || "";
  try {
    window.dispatchEvent(
      new CustomEvent(LOCATION_SESSION_EVENT, {
        detail: { state, message: sessionMessage, at: Date.now() },
      })
    );
  } catch {
    /* bus unavailable — state is still readable via getSessionState() */
  }
}

function publishSample(sample, source) {
  const enriched = { ...sample, source };
  // Native live samples are ingested by the super agent's own native-bus
  // subscription; web + warm-start samples are ingested here so the agent
  // sees them even when no navigation page is mounted.
  if (source !== "native-live") {
    try {
      gpsSuperAgent.ingest(enriched);
    } catch {
      /* monitoring must never throw into acquisition */
    }
  }
  try {
    window.dispatchEvent(new CustomEvent(LOCATION_SAMPLE_EVENT, { detail: enriched }));
  } catch {
    /* ignore */
  }
}

function clearWatchdog() {
  if (watchdogId != null) {
    window.clearTimeout(watchdogId);
    watchdogId = null;
  }
}

function teardownAcquisition() {
  clearWatchdog();
  if (webWatchId != null && typeof navigator !== "undefined" && navigator.geolocation) {
    try {
      navigator.geolocation.clearWatch(webWatchId);
    } catch {
      /* ignore */
    }
    webWatchId = null;
  }
  unsubscribers.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
  unsubscribers = [];
  if (nativeEngineOn) {
    try {
      stopNativeLocation();
    } catch {
      /* ignore */
    }
    nativeEngineOn = false;
  }
}

function startNativeAcquisition() {
  // The native engine starts only after the OS confirms permission — same
  // ordering the hook used: subscribe first, then request. This avoids racing
  // the permission dialog and prevents a foreground service from starting
  // and immediately stopping before the grant lands.
  unsubscribers.push(
    subscribeNativeLocationAuthorization((authorization) => {
      const authStatus = authorization?.status;
      if (["always", "whenInUse"].includes(authStatus) && !nativeEngineOn) {
        nativeEngineOn = true;
        clearWatchdog();
        emitSession("active", "");
        startNativeLocation({ mode: gpsSuperAgent.getNativeMode(), sessionId });
        return;
      }
      if (["denied", "restricted"].includes(authStatus)) {
        clearWatchdog();
        emitSession(
          "denied",
          "Location access is required for live LOKIN navigation. Enable Precise Location for LOKIN in device Settings."
        );
        return;
      }
      // Unrecognized authorization string (e.g. "notDetermined"): the OS has
      // not delivered a usable decision yet. Say so instead of going silent.
      // (A re-emitted grant after the engine started is intentionally a no-op.)
      if (!["always", "whenInUse"].includes(authStatus)) {
        emitSession("waiting", "Waiting on your location permission — allow location for LOKIN when your device asks.");
      }
    })
  );
  unsubscribers.push(
    subscribeNativeLocationError((nativeError) => {
      clearWatchdog();
      emitSession("error", nativeError?.message || "LOKIN native location engine reported an error.");
    })
  );
  // Warm-start: route immediately from a recent trusted native fix while the
  // OS acquires a fresh navigation-grade anchor.
  unsubscribers.push(
    subscribeNativeLocationQueue((payload) => {
      const points = Array.isArray(payload?.points) ? payload.points : [];
      const latest = points
        .map(normalizeNativeLocationSample)
        .filter(Boolean)
        .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0))[0];
      const ageMs = latest ? Math.max(0, Date.now() - Number(latest.timestamp || 0)) : Infinity;
      if (latest && ageMs <= 45_000 && Number(latest.accuracy_m || 0) <= 100) {
        clearWatchdog();
        emitSession("active", "");
        publishSample({ ...latest, source: "native-warm-start" }, "native-warm-start");
      }
    })
  );

  requestNativeRuntimeStatus();

  // Start routing immediately from a recent trusted native fix while the OS
  // acquires a fresh navigation-grade anchor.
  drainNativeLocationQueue(12);

  // Watchdog: the native engine speaks only through event callbacks. If the
  // OS never delivers a permission decision or a fix (and no native error
  // fires), name the blocker after 20s instead of spinning forever. A real
  // fix or error clears it.
  watchdogId = window.setTimeout(() => {
    emitSession(
      "waiting",
      "Still waiting on the LOKIN location engine — make sure location is allowed for LOKIN in device Settings and Location Services is on."
    );
  }, 20000);

  // Fail fast: the bridge exists but the shell did not accept the permission
  // command — re-posting it on every retry just loops the honest copy with
  // zero chance of a prompt. Name the real blocker immediately instead.
  const permissionRequestAccepted = requestNativeWhenInUse();
  if (!permissionRequestAccepted) {
    clearWatchdog();
    emitSession(
      "error",
      "The LOKIN app shell did not ask iOS for location. Grant Location for LOKIN in iOS Settings (While Using, with Precise Location on), or use the LOKIN website in Safari."
    );
  }
}

function startWebAcquisition() {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    emitSession("error", "This device does not expose GPS location to LOKIN.");
    return;
  }
  let fixReceived = false;

  // Watchdog: watchPosition can hang forever when the OS never delivers a
  // permission decision or a fix (common in embedded preview WebViews). After
  // 20s with no fix, name the actual blocker instead of spinning forever.
  watchdogId = window.setTimeout(() => {
    if (fixReceived) return;
    const probe = navigator.permissions?.query
      ? navigator.permissions.query({ name: "geolocation" }).then((p) => p?.state, () => "unknown")
      : Promise.resolve("unknown");
    probe.then((permissionState) => {
      if (fixReceived) return;
      if (permissionState === "denied") {
        emitSession(
          "denied",
          "Location access is required for live LOKIN navigation. Enable Precise Location for LOKIN in device Settings."
        );
      } else if (permissionState === "prompt") {
        // Honest copy: inside the stock app wrapper no device prompt is
        // coming on its own — only the app shell can ask iOS for location.
        // Never promise a prompt that can't arrive.
        emitSession(
          "waiting",
          "Still waiting on your location permission. If a prompt appears, allow Precise Location. In the LOKIN app no prompt appears on its own — grant Location for LOKIN in iOS Settings (While Using, with Precise Location on), or use the LOKIN website in Safari."
        );
      } else if (permissionState === "granted") {
        emitSession(
          "waiting",
          "GPS fix is taking longer than usual — make sure Location Services is on and you have a clear view of the sky."
        );
      } else {
        emitSession(
          "waiting",
          "Still waiting for your device's GPS — check that Location Services is on and location is allowed for this page."
        );
      }
    });
  }, 20000);

  webWatchId = navigator.geolocation.watchPosition(
    (position) => {
      const coords = position?.coords;
      if (!coords) return;
      fixReceived = true;
      clearWatchdog();
      emitSession("active", "");
      publishSample(
        {
          coordinate: [Number(coords.longitude), Number(coords.latitude)],
          latitude: Number(coords.latitude),
          longitude: Number(coords.longitude),
          accuracy_m: Number(coords.accuracy || 0),
          heading: Number.isFinite(coords.heading) ? coords.heading : null,
          speed_mps: Number.isFinite(coords.speed) ? coords.speed : null,
          altitude_m: Number.isFinite(coords.altitude) ? coords.altitude : null,
          timestamp: position.timestamp || Date.now(),
          source: "web-geolocation",
        },
        "web-geolocation"
      );
    },
    (geoError) => {
      clearWatchdog();
      const message =
        geoError?.code === 1
          ? "Location access is required for live LOKIN navigation. Enable Precise Location for LOKIN in device Settings."
          : geoError?.message || "LOKIN could not read the current GPS position.";
      emitSession(geoError?.code === 1 ? "denied" : "error", message);
    },
    gpsSuperAgent.getWebOptions()
  );
}

function startAcquisition() {
  teardownAcquisition();
  sessionId = `lokin-app-${Date.now()}`;
  startedAt = Date.now();
  emitSession("starting", "");
  if (nativeLocationAvailable()) {
    startNativeAcquisition();
  } else {
    startWebAcquisition();
  }
}

// Idempotent app-launch entry point. Safe to call from React StrictMode
// double-mounts: the second call is a no-op.
export function ensureStarted() {
  if (started) return;
  started = true;
  // The super agent's health monitoring runs app-wide now, not per page.
  try {
    gpsSuperAgent.startMonitoring();
  } catch {
    /* monitoring must never throw into app launch */
  }
  // Permanent restart wiring: the Command Center's RESTART GPS and accuracy
  // mode changes re-acquire through the live session from any page. Unlike
  // the old hook registration, this is never nulled on unmount.
  gpsSuperAgent.registerRestartHandler((reason) => reacquire(reason));
  gpsSuperAgent.onModeChange(() => reacquire("accuracy_mode_change"));
  startAcquisition();
}

// Re-run acquisition (re-registers the watch / re-prompts). Used by RETRY
// GPS and by the Command Center's RESTART GPS via the super agent.
export function reacquire() {
  if (!started) {
    ensureStarted();
    return;
  }
  startAcquisition();
}

// Full teardown. Only for logout / engine shutdown — page navigation no
// longer stops acquisition.
export function stopSession() {
  teardownAcquisition();
  emitSession("idle", "");
}

export function getSessionState() {
  return { state: sessionState, message: sessionMessage, startedAt };
}
