import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, Battery, Eye, Glasses, Navigation, Power, Radio, RefreshCw, Smartphone } from "lucide-react";
import { base44 } from "@/api/base44Client";
import {
  launchNativeVisionXr,
  nativeVisionXrAvailable,
  readNativeVisionXrState,
  requestNativeVisionXrStatus,
  subscribeNativeVisionXrState,
} from "@/lib/nativeVisionXrBridge";

const HEARTBEAT_MS = 30000;

function getOrCreateDeviceId() {
  const key = "lokin_vision_bridge_device_id";
  try {
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const random = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    const id = `vision-web-${random}`;
    window.localStorage.setItem(key, id);
    return id;
  } catch {
    return `vision-web-${Date.now()}`;
  }
}

function detectPlatform() {
  const ua = String(navigator.userAgent || "");
  if (/iPhone/i.test(ua)) return "iPhone Web Bridge";
  if (/iPad/i.test(ua)) return "iPad Web Bridge";
  if (/Android/i.test(ua)) return "Android Web Bridge";
  if (/Macintosh/i.test(ua)) return "macOS Web Simulator";
  if (/Windows/i.test(ua)) return "Windows Web Simulator";
  return "Web Simulator";
}

export default function VisionBridge() {
  const deviceId = useMemo(getOrCreateDeviceId, []);
  const platform = useMemo(detectPlatform, []);
  const [deviceType, setDeviceType] = useState("simulator");
  const [status, setStatus] = useState("online");
  const [navigationState, setNavigationState] = useState("standby");
  const [linked, setLinked] = useState(false);
  const [sending, setSending] = useState(false);
  const [lastSeen, setLastSeen] = useState(null);
  const [error, setError] = useState("");
  const [battery, setBattery] = useState(null);
  const nativeXrAvailable = useMemo(() => nativeVisionXrAvailable(), []);
  const [nativeXr, setNativeXr] = useState(() => readNativeVisionXrState());
  const timerRef = useRef(null);
  const nativeSyncRef = useRef(null);

  useEffect(() => {
    let alive = true;
    if (navigator.getBattery) {
      navigator.getBattery().then((manager) => {
        if (!alive) return;
        const update = () => setBattery(Math.round(Number(manager.level || 0) * 100));
        update();
        manager.addEventListener?.("levelchange", update);
      }).catch(() => {});
    }
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!nativeXrAvailable) return undefined;
    setDeviceType("phone_bridge");
    const initial = readNativeVisionXrState();
    if (initial) setNativeXr(initial);
    requestNativeVisionXrStatus();
    return subscribeNativeVisionXrState((next) => {
      if (next) setNativeXr(next);
    });
  }, [nativeXrAvailable]);

  const sendHeartbeat = useCallback(async (override = {}) => {
    setSending(true);
    setError("");
    try {
      const payload = {
        action: "vision_heartbeat",
        device_id: deviceId,
        device_type: override.deviceType || (nativeXr?.projected_connected ? "developer_glasses" : nativeXrAvailable ? "phone_bridge" : deviceType),
        platform: nativeXrAvailable ? "Android Jetpack XR Host" : platform,
        status: override.status || status,
        navigation_state: override.navigationState || navigationState,
        firmware_version: nativeXrAvailable ? "LOKIN Vision Android XR Bridge 1.0" : "LOKIN Vision Web Bridge 1.0",
        metadata: {
          source: nativeXrAvailable ? "android_xr_native_bridge" : "vision_bridge_page",
          heartbeat_interval_ms: HEARTBEAT_MS,
          user_agent_class: platform,
          native_xr: nativeXr || null,
        },
      };
      if (battery != null) payload.battery_percent = battery;
      const response = await base44.functions.invoke("legacy-deck", payload);
      const data = response?.data || response;
      setLinked(true);
      setLastSeen(data?.last_seen_at || new Date().toISOString());
      return true;
    } catch (err) {
      setLinked(false);
      setError(err?.response?.data?.error || err?.message || "Vision heartbeat failed.");
      return false;
    } finally {
      setSending(false);
    }
  }, [battery, deviceId, deviceType, nativeXr, nativeXrAvailable, navigationState, platform, status]);

  useEffect(() => {
    if (!nativeXrAvailable || !nativeXr) return;
    const stamp = nativeXr.updated_at_ms || JSON.stringify(nativeXr);
    if (nativeSyncRef.current === stamp) return;
    nativeSyncRef.current = stamp;
    const nextDeviceType = nativeXr.projected_connected ? "developer_glasses" : "phone_bridge";
    setDeviceType(nextDeviceType);
    sendHeartbeat({ deviceType: nextDeviceType });
  }, [nativeXr, nativeXrAvailable, sendHeartbeat]);

  const startLink = useCallback(async () => {
    const ok = await sendHeartbeat({ status: status === "offline" ? "online" : status });
    if (!ok) return;
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      if (document.visibilityState === "visible") sendHeartbeat();
    }, HEARTBEAT_MS);
  }, [sendHeartbeat, status]);

  const stopLink = useCallback(async () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    await sendHeartbeat({ status: "offline", navigationState: "stopped" });
    setStatus("offline");
    setLinked(false);
  }, [sendHeartbeat]);

  useEffect(() => {
    startLink();
    const onVisible = () => {
      if (document.visibilityState === "visible") startLink();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  function applyMode(nextStatus, nextNavigation) {
    setStatus(nextStatus);
    setNavigationState(nextNavigation);
    sendHeartbeat({ status: nextStatus, navigationState: nextNavigation });
  }

  return (
    <div className="p-4 pb-8 space-y-4">
      <div className="rounded-3xl border border-primary/25 bg-black/70 p-5 glow-border">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/35 bg-primary/10">
              <Glasses className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="font-display text-lg font-black tracking-[0.12em] text-primary">LOKIN VISION</div>
              <div className="text-[10px] tracking-[0.18em] text-white/40">LIVE HEARTBEAT BRIDGE</div>
            </div>
          </div>
          <div className={`rounded-full border px-3 py-1.5 text-[10px] font-extrabold ${linked ? "border-primary/40 bg-primary/10 text-primary" : "border-amber-400/30 bg-amber-400/10 text-amber-300"}`}>
            {linked ? "● CONNECTED" : "● WAITING"}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
          <Metric label="Device" value={deviceType.replace(/_/g, " ")} icon={Smartphone} />
          <Metric label="Status" value={status} icon={Radio} />
          <Metric label="Navigation" value={navigationState} icon={Navigation} />
          <Metric label="Battery" value={battery == null ? "Unavailable" : `${battery}%`} icon={Battery} />
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
        <div className="text-[10px] font-display tracking-[0.18em] text-white/45">DEVICE MODE</div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => { setDeviceType("simulator"); sendHeartbeat({ deviceType:"simulator" }); }} className={`rounded-2xl border p-3 text-xs font-bold ${deviceType === "simulator" ? "border-primary/40 bg-primary/10 text-primary" : "border-white/10 bg-black/30 text-white/60"}`}>VISION SIMULATOR</button>
          <button type="button" onClick={() => { setDeviceType("phone_bridge"); sendHeartbeat({ deviceType:"phone_bridge" }); }} className={`rounded-2xl border p-3 text-xs font-bold ${deviceType === "phone_bridge" ? "border-primary/40 bg-primary/10 text-primary" : "border-white/10 bg-black/30 text-white/60"}`}>PHONE BRIDGE</button>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
        <div className="text-[10px] font-display tracking-[0.18em] text-white/45">LIVE STATE</div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <ModeButton label="ONLINE" icon={Activity} active={status === "online" && navigationState === "standby"} onClick={() => applyMode("online", "standby")} />
          <ModeButton label="NAVIGATING" icon={Navigation} active={status === "navigating"} onClick={() => applyMode("navigating", "active_route")} />
          <ModeButton label="IDLE" icon={Eye} active={status === "idle"} onClick={() => applyMode("idle", "standby")} />
          <ModeButton label="SLEEP" icon={Power} active={status === "sleeping"} onClick={() => applyMode("sleeping", "sleep")} />
        </div>
      </div>

      {error && <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</div>}

      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={sending} onClick={startLink} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-xs font-extrabold text-black disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${sending ? "animate-spin" : ""}`} /> SEND HEARTBEAT
        </button>
        <button type="button" onClick={stopLink} className="min-h-12 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 text-xs font-extrabold text-red-300">STOP LINK</button>
      </div>

      <div className="rounded-2xl border border-white/8 bg-black/50 p-3 text-[10px] leading-relaxed text-white/40">
        <div>Device ID: <span className="font-mono text-white/60">{deviceId}</span></div>
        <div>Platform: {platform}</div>
        <div>Heartbeat: every 30 seconds while this page is visible.</div>
        <div>Last acknowledged: {lastSeen ? new Date(lastSeen).toLocaleTimeString() : "not yet"}</div>
        <div className="mt-2 text-primary/75">The Legacy Deck should report CONNECTED within its next 10-second refresh after a successful heartbeat.</div>
      </div>
    </div>
  );
}

function Metric({ label, value, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/40 p-3">
      <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.12em] text-white/35"><Icon className="h-3.5 w-3.5" /> {label}</div>
      <div className="mt-1 truncate text-xs font-bold capitalize text-white/80">{value}</div>
    </div>
  );
}

function ModeButton({ label, icon: Icon, active, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`flex min-h-14 items-center justify-center gap-2 rounded-2xl border text-xs font-bold ${active ? "border-primary/40 bg-primary/10 text-primary" : "border-white/10 bg-black/30 text-white/60"}`}>
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}
