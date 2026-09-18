// GPS Super Agent — monitoring, control, and proactive GPS intelligence for LOKIN AI.
//
// DESIGN CONTRACT (do not violate):
// 1. NEVER starts its own location watcher. No watchPosition, no startNativeLocation.
//    It subscribes to the existing native location event bus (read-only monitoring).
// 2. Accuracy modes change REAL acquisition behavior through the navigation hook's
//    cooperation: the hook reads getWebOptions()/getNativeMode() when (re)starting
//    its watchers, and registers a restart handler the agent may invoke.
// 3. Route-session ownership stays with useLokinNavigation. The agent requests
//    restarts; the hook decides when it is safe.
// 4. Battery uses navigator.getBattery() when available, otherwise "unavailable".
//    Never fabricate a battery percentage.
// 5. All monitoring degrades silently — the agent must never break navigation.

import {
  nativeLocationAvailable,
  subscribeNativeLocation,
  subscribeNativeLocationAuthorization,
  subscribeNativeLocationError,
  subscribeNativeLocationRuntime,
} from "@/lib/nativeLocationBridge";

// ---------------------------------------------------------------------------
// Accuracy modes -> real acquisition parameters.
// "high" matches the pre-agent default behavior exactly (no behavior change
// unless the user picks another mode).
// ---------------------------------------------------------------------------
export const GPS_ACCURACY_MODES = {
  high: {
    id: "high",
    label: "High Accuracy",
    nativeMode: "activeNavigation",
    webOptions: { enableHighAccuracy: true, maximumAge: 5000, timeout: 8000 },
    description: "Best fix quality for active turn-by-turn navigation.",
  },
  balanced: {
    id: "balanced",
    label: "Balanced",
    nativeMode: "balancedNavigation",
    webOptions: { enableHighAccuracy: true, maximumAge: 5000, timeout: 8000 },
    description: "Good accuracy with lower battery use.",
  },
  battery_saver: {
    id: "battery_saver",
    label: "Battery Saver",
    nativeMode: "lowPower",
    webOptions: { enableHighAccuracy: false, maximumAge: 30000, timeout: 15000 },
    description: "Minimal battery draw for background tracking.",
  },
};

const DEFAULT_MODE = "high";
const MAX_SAMPLES = 120;
const STALE_MS = 15000;
const LOST_MS = 45000;

function now() {
  return Date.now();
}

class GPSSuperAgent {
  constructor() {
    this.samples = []; // ring buffer of { accuracy_m, timestamp, source, ... }
    this.mode = DEFAULT_MODE;
    this.version = 0; // bumped on mode change so watchers re-configure
    this.modeListeners = new Set();
    this.healthListeners = new Set();
    this.restartHandler = null;
    this.authorization = null;
    this.nativeRuntime = null;
    this.lastError = null;
    this.monitoring = false;
    this.unsubscribers = [];
    this.battery = { available: false, level: null, charging: null };
    this.alerts = [];
  }

  // -- Monitoring ------------------------------------------------------------
  startMonitoring() {
    if (this.monitoring || typeof window === "undefined") return;
    this.monitoring = true;
    try {
      this.unsubscribers.push(
        subscribeNativeLocation((raw) => {
          if (raw) this.ingest(this.normalize(raw, "native"));
        }),
        subscribeNativeLocationAuthorization((auth) => {
          this.authorization = auth?.status || null;
          this.emitHealth();
        }),
        subscribeNativeLocationError((err) => {
          this.lastError = err?.message || "Native location error";
          this.pushAlert("error", this.lastError);
          this.emitHealth();
        }),
        subscribeNativeLocationRuntime((payload) => {
          if (payload && typeof payload === "object") {
            this.nativeRuntime = payload;
            this.emitHealth();
          }
        })
      );
    } catch {
      // Monitoring must never throw into the host page.
    }
    this.pollBattery();
  }

  stopMonitoring() {
    this.monitoring = false;
    this.unsubscribers.forEach((fn) => {
      try { fn(); } catch {}
    });
    this.unsubscribers = [];
  }

  normalize(raw, fallbackSource) {
    const latitude = Number(raw.latitude);
    const longitude = Number(raw.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return {
      latitude,
      longitude,
      accuracy_m: Number(raw.horizontalAccuracyM ?? raw.accuracy_m ?? 0),
      speed_mps: Number.isFinite(Number(raw.speedMps ?? raw.speed_mps))
        ? Number(raw.speedMps ?? raw.speed_mps) : null,
      heading: Number.isFinite(Number(raw.headingDeg ?? raw.heading))
        ? Number(raw.headingDeg ?? raw.heading) : null,
      timestamp: Number(raw.timestampMs ?? raw.timestamp ?? now()),
      source: raw.source || fallbackSource || "unknown",
    };
  }

  // Called by the navigation hook for web-geolocation samples so the agent
  // sees the same pipeline without owning a watcher.
  ingest(sample) {
    if (!sample || !Number.isFinite(Number(sample.latitude))) return;
    this.samples.push({ ...sample, ingested_at: now() });
    if (this.samples.length > MAX_SAMPLES) {
      this.samples.splice(0, this.samples.length - MAX_SAMPLES);
    }
    this.emitHealth();
  }

  // -- Health ----------------------------------------------------------------
  getHealth() {
    const latest = this.samples[this.samples.length - 1] || null;
    const ageMs = latest ? Math.max(0, now() - Number(latest.timestamp || 0)) : Infinity;

    let signal = "unknown";
    if (!latest) signal = "no_fix";
    else if (ageMs > LOST_MS) signal = "lost";
    else if (ageMs > STALE_MS) signal = "stale";
    else {
      const acc = Number(latest.accuracy_m || 0);
      if (acc > 0 && acc <= 10) signal = "excellent";
      else if (acc <= 25) signal = "good";
      else if (acc <= 60) signal = "degraded";
      else signal = "poor";
    }

    // Sample rate over the last 60s.
    const windowStart = now() - 60000;
    const recent = this.samples.filter((s) => Number(s.timestamp || 0) >= windowStart);
    const ratePerMin = recent.length;

    // Source mix.
    const sources = {};
    recent.forEach((s) => { sources[s.source || "unknown"] = (sources[s.source || "unknown"] || 0) + 1; });

    const accuracies = recent
      .map((s) => Number(s.accuracy_m || 0))
      .filter((a) => a > 0)
      .sort((a, b) => a - b);
    const medianAccuracy = accuracies.length
      ? accuracies[Math.floor(accuracies.length / 2)]
      : null;

    return {
      signal,
      latest,
      ageMs: Number.isFinite(ageMs) ? Math.round(ageMs) : null,
      samplesPerMin: ratePerMin,
      medianAccuracyM: medianAccuracy != null ? Math.round(medianAccuracy) : null,
      sources,
      authorization: this.authorization,
      nativeAvailable: nativeLocationAvailable(),
      nativeRuntime: this.nativeRuntime,
      lastError: this.lastError,
      mode: this.mode,
      battery: { ...this.battery },
      updatedAt: now(),
    };
  }

  // Short spoken-style status for voice intents ("Hey LOKIN, GPS status").
  getStatusReport() {
    const h = this.getHealth();
    const modeLabel = GPS_ACCURACY_MODES[this.mode]?.label || this.mode;
    if (h.signal === "no_fix") return "No GPS fix yet. Waiting for the device location.";
    if (h.signal === "lost") return "GPS signal lost. The last fix is over 45 seconds old.";
    const acc = h.medianAccuracyM != null ? ` Accuracy plus or minus ${h.medianAccuracyM} meters.` : "";
    const batt = h.battery.available && h.battery.level != null
      ? ` Battery at ${Math.round(h.battery.level * 100)} percent${h.battery.charging ? ", charging" : ""}.`
      : "";
    return `GPS ${h.signal}. Mode: ${modeLabel}.${acc}${batt}`;
  }

  onHealth(listener) {
    this.healthListeners.add(listener);
    return () => this.healthListeners.delete(listener);
  }

  emitHealth() {
    if (!this.healthListeners.size) return;
    const health = this.getHealth();
    this.healthListeners.forEach((fn) => {
      try { fn(health); } catch {}
    });
  }

  // -- Accuracy mode control ---------------------------------------------------
  // Changing the mode bumps `version`; the navigation hook subscribes and
  // restarts its watchers with the new acquisition parameters. The agent never
  // touches the location engine directly.
  getAccuracyMode() {
    return this.mode;
  }

  getModeVersion() {
    return this.version;
  }

  getWebOptions() {
    return { ...(GPS_ACCURACY_MODES[this.mode]?.webOptions || GPS_ACCURACY_MODES[DEFAULT_MODE].webOptions) };
  }

  getNativeMode() {
    return GPS_ACCURACY_MODES[this.mode]?.nativeMode || GPS_ACCURACY_MODES[DEFAULT_MODE].nativeMode;
  }

  onModeChange(listener) {
    this.modeListeners.add(listener);
    return () => this.modeListeners.delete(listener);
  }

  setAccuracyMode(modeId) {
    if (!GPS_ACCURACY_MODES[modeId] || modeId === this.mode) return false;
    this.mode = modeId;
    this.version += 1;
    this.pushAlert("info", `GPS accuracy mode set to ${GPS_ACCURACY_MODES[modeId].label}.`);
    this.modeListeners.forEach((fn) => {
      try { fn(modeId, this.version); } catch {}
    });
    this.emitHealth();
    return true;
  }

  // -- Restart coordination ----------------------------------------------------
  // The navigation hook registers its restart routine here. The agent requests;
  // the hook owns the session and decides whether it is driving-safe.
  registerRestartHandler(fn) {
    this.restartHandler = typeof fn === "function" ? fn : null;
  }

  async requestRestart(reason = "manual") {
    if (!this.restartHandler) {
      this.pushAlert("warn", "No navigation session is active to restart.");
      return false;
    }
    try {
      await this.restartHandler(reason);
      this.pushAlert("info", "GPS acquisition restarted.");
      return true;
    } catch (e) {
      this.pushAlert("error", `GPS restart failed: ${e?.message || e}`);
      return false;
    }
  }

  // -- Battery -----------------------------------------------------------------
  // Uses the Battery Status API when the platform exposes it; otherwise the
  // status is honestly reported as unavailable (never fabricated).
  async pollBattery() {
    try {
      const nav = typeof navigator !== "undefined" ? navigator : null;
      if (nav && typeof nav.getBattery === "function") {
        const b = await nav.getBattery();
        const update = () => {
          this.battery = {
            available: true,
            level: Number.isFinite(Number(b.level)) ? Number(b.level) : null,
            charging: Boolean(b.charging),
          };
          this.emitHealth();
        };
        update();
        b.addEventListener?.("levelchange", update);
        b.addEventListener?.("chargingchange", update);
        return;
      }
    } catch {}
    this.battery = { available: false, level: null, charging: null };
  }

  // -- Alerts ------------------------------------------------------------------
  pushAlert(kind, message) {
    this.alerts.push({ kind, message, at: now() });
    if (this.alerts.length > 20) this.alerts.splice(0, this.alerts.length - 20);
  }

  getAlerts() {
    return [...this.alerts].reverse();
  }

  clearAlerts() {
    this.alerts = [];
  }
}

export const gpsSuperAgent = new GPSSuperAgent();
export default gpsSuperAgent;
