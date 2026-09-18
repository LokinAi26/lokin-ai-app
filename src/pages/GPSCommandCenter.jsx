import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Battery,
  BatteryLow,
  ChevronLeft,
  Crosshair,
  Info,
  Leaf,
  RefreshCw,
  Satellite,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { gpsSuperAgent, GPS_ACCURACY_MODES } from "@/lib/gpsSuperAgent";

const SIGNAL_STYLES = {
  excellent: { label: "EXCELLENT", cls: "text-primary border-primary/40 bg-primary/10" },
  good: { label: "GOOD", cls: "text-emerald-300 border-emerald-400/40 bg-emerald-400/10" },
  degraded: { label: "DEGRADED", cls: "text-amber-300 border-amber-400/40 bg-amber-400/10" },
  poor: { label: "POOR", cls: "text-orange-300 border-orange-400/40 bg-orange-400/10" },
  stale: { label: "STALE", cls: "text-amber-300 border-amber-400/40 bg-amber-400/10" },
  lost: { label: "SIGNAL LOST", cls: "text-red-300 border-red-400/40 bg-red-400/10" },
  no_fix: { label: "NO FIX", cls: "text-white/40 border-white/15 bg-white/[0.03]" },
  unknown: { label: "UNKNOWN", cls: "text-white/40 border-white/15 bg-white/[0.03]" },
};

const MODE_ICONS = {
  high: Crosshair,
  balanced: ShieldCheck,
  battery_saver: Leaf,
};

function formatAge(ms) {
  if (ms == null || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return "just now";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ${s % 60}s ago`;
}

export default function GPSCommandCenter() {
  const [health, setHealth] = useState(() => gpsSuperAgent.getHealth());
  const [mode, setMode] = useState(() => gpsSuperAgent.getAccuracyMode());
  const [restarting, setRestarting] = useState(false);
  const [alerts, setAlerts] = useState(() => gpsSuperAgent.getAlerts());

  useEffect(() => {
    gpsSuperAgent.startMonitoring();
    const offHealth = gpsSuperAgent.onHealth(setHealth);
    const offMode = gpsSuperAgent.onModeChange((next) => setMode(next));
    const timer = window.setInterval(() => {
      setHealth(gpsSuperAgent.getHealth());
      setAlerts(gpsSuperAgent.getAlerts());
    }, 2000);
    return () => {
      offHealth();
      offMode();
      window.clearInterval(timer);
    };
  }, []);

  const signal = SIGNAL_STYLES[health.signal] || SIGNAL_STYLES.unknown;
  const batteryPct = health.battery.available && health.battery.level != null
    ? Math.round(health.battery.level * 100)
    : null;

  const sourceSummary = useMemo(() => {
    const entries = Object.entries(health.sources || {});
    if (!entries.length) return "—";
    return entries.map(([k, v]) => `${k} ×${v}`).join(" · ");
  }, [health.sources]);

  async function changeMode(next) {
    if (next === mode) return;
    gpsSuperAgent.setAccuracyMode(next);
    setMode(next);
    // Ask the navigation session to re-acquire with the new parameters.
    // The hook owns the session and decides whether it is safe right now.
    setRestarting(true);
    try {
      await gpsSuperAgent.requestRestart("accuracy_mode_change");
    } finally {
      setRestarting(false);
      setHealth(gpsSuperAgent.getHealth());
      setAlerts(gpsSuperAgent.getAlerts());
    }
  }

  async function restartGps() {
    setRestarting(true);
    try {
      await gpsSuperAgent.requestRestart("manual");
    } finally {
      setRestarting(false);
      setHealth(gpsSuperAgent.getHealth());
      setAlerts(gpsSuperAgent.getAlerts());
    }
  }

  return (
    <div className="p-4 space-y-4 pb-6">
      <div className="flex items-center gap-3">
        <Link
          to="/ai-gps"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/60 active:scale-95"
          aria-label="Back to GPS"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-2">
          <Satellite className="h-5 w-5 text-accent" />
          <div>
            <h1 className="lokin-wordmark text-xl font-bold font-heading leading-none tracking-[0.04em]">
              GPS COMMAND CENTER
            </h1>
            <div className="lokin-kicker lokin-kicker-cyan mt-1 font-display">
              SUPER AGENT · MONITOR + CONTROL
            </div>
          </div>
        </div>
      </div>

      {/* Signal status */}
      <div className="lokin-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl border border-accent/30 bg-accent/10 flex items-center justify-center">
              <Satellite className="h-6 w-6 text-accent" />
            </div>
            <div>
              <div className="lokin-kicker lokin-kicker-cyan">LIVE SIGNAL</div>
              <div className="mt-1 text-lg font-extrabold text-white">
                {health.medianAccuracyM != null ? `±${health.medianAccuracyM}m` : "—"}
              </div>
              <div className="text-[10px] text-white/40">
                fix {formatAge(health.ageMs)} · {health.samplesPerMin}/min
              </div>
            </div>
          </div>
          <span className={`rounded-full border px-3 py-1.5 font-display text-[10px] font-extrabold tracking-[0.18em] ${signal.cls}`}>
            {signal.label}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="lokin-stat-tile">
            <div className="lokin-stat-value text-xs font-display">
              {health.nativeAvailable ? "NATIVE" : "WEB"}
            </div>
            <div className="lokin-kicker mt-1">engine</div>
          </div>
          <div className="lokin-stat-tile">
            <div className="lokin-stat-value text-xs font-display truncate px-1">
              {sourceSummary}
            </div>
            <div className="lokin-kicker mt-1">sources</div>
          </div>
          <div className="lokin-stat-tile">
            <div className="lokin-stat-value text-xs font-display">
              {health.authorization ? health.authorization.toUpperCase() : "—"}
            </div>
            <div className="lokin-kicker mt-1">permission</div>
          </div>
        </div>
        {health.lastError && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/[0.06] p-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-300 mt-0.5" />
            <div className="text-[11px] text-red-200">{health.lastError}</div>
          </div>
        )}
      </div>

      {/* Accuracy modes */}
      <div className="lokin-card p-4">
        <div className="lokin-kicker lokin-kicker-lime">ACCURACY MODE</div>
        <div className="mt-1 text-[11px] text-white/45">
          Changes the real GPS acquisition parameters. The navigation session re-acquires on change.
        </div>
        <div className="mt-3 space-y-2">
          {Object.values(GPS_ACCURACY_MODES).map((m) => {
            const Icon = MODE_ICONS[m.id] || Zap;
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => changeMode(m.id)}
                disabled={restarting}
                className={`w-full rounded-2xl border p-3 text-left active:scale-[0.99] disabled:opacity-60 ${
                  active
                    ? "border-primary/50 bg-primary/[0.08]"
                    : "border-white/10 bg-white/[0.02]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 shrink-0 rounded-xl border flex items-center justify-center ${
                    active ? "border-primary/40 bg-primary/15" : "border-white/10 bg-black/40"
                  }`}>
                    <Icon className={`h-5 w-5 ${active ? "text-primary" : "text-white/40"}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-bold ${active ? "text-white" : "text-white/70"}`}>
                      {m.label}
                      {active && <span className="ml-2 text-[9px] font-extrabold tracking-[0.18em] text-primary">ACTIVE</span>}
                    </div>
                    <div className="mt-0.5 text-[11px] text-white/40">{m.description}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Battery + recovery */}
      <div className="lokin-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl border border-white/10 bg-black/40 flex items-center justify-center">
              {batteryPct != null && batteryPct <= 20 && !health.battery.charging ? (
                <BatteryLow className="h-5 w-5 text-red-300" />
              ) : (
                <Battery className="h-5 w-5 text-white/60" />
              )}
            </div>
            <div>
              <div className="lokin-kicker">BATTERY</div>
              <div className="mt-0.5 text-sm font-bold text-white">
                {health.battery.available
                  ? batteryPct != null
                    ? `${batteryPct}%${health.battery.charging ? " · charging" : ""}`
                    : "Reading…"
                  : "Unavailable on this device"}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={restartGps}
            disabled={restarting}
            className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-xs font-bold text-primary disabled:opacity-50 active:scale-95"
          >
            <RefreshCw className={`h-4 w-4 ${restarting ? "animate-spin" : ""}`} />
            {restarting ? "RESTARTING…" : "RESTART GPS"}
          </button>
        </div>
        <div className="mt-2 flex items-start gap-2 text-[10px] text-white/35">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>Restart re-acquires the GPS fix through the active navigation session. It never starts a second location engine.</span>
        </div>
      </div>

      {/* Agent log */}
      {alerts.length > 0 && (
        <div className="lokin-card p-4">
          <div className="lokin-kicker lokin-kicker-cyan">AGENT LOG</div>
          <div className="mt-2 space-y-1.5">
            {alerts.slice(0, 8).map((a, i) => (
              <div key={i} className="flex items-start gap-2 text-[11px]">
                <span className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                  a.kind === "error" ? "bg-red-400" : a.kind === "warn" ? "bg-amber-300" : "bg-primary"
                }`} />
                <span className="text-white/55">{a.message}</span>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => { gpsSuperAgent.clearAlerts(); setAlerts([]); }}
            className="mt-2 text-[10px] font-semibold text-white/35"
          >
            Clear log
          </button>
        </div>
      )}
    </div>
  );
}
