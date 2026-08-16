import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Satellite, Wifi, Signal, Activity, MapPin, Navigation, AlertTriangle,
  Radio, Zap, Battery, ArrowUpRight, RefreshCw, RadioTower,
} from "lucide-react";
import SatelliteView from "@/components/SatelliteView";
import useLokinPerformance, { cadenceFor } from "@/hooks/useLokinPerformance";

// Read the Network Information API safely (not all browsers expose it).
function getNetInfo() {
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  return c
    ? { effectiveType: c.effectiveType, downlink: c.downlink, rtt: c.rtt, saveData: c.saveData }
    : null;
}

// Simulated Starlink satellite constellation link — deterministic per session.
function useConstellation(online) {
  const [tick, setTick] = useState(0);
  const perf = useLokinPerformance();
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), cadenceFor(perf, 2200, 9000, 30000));
    return () => clearInterval(id);
  }, [perf?.effectiveMode, perf?.pauseNonessential]);
  // Base connected count wiggles ±1; offline forces 0
  const base = online ? 3 + ((tick % 3) === 0 ? 1 : 0) : 0;
  const connected = online ? Math.max(2, base) : 0;
  const latency = online ? 28 + (Math.sin(tick) * 6 + 8).toFixed(0) * 1 : null;
  return { connected, total: 6, latency };
}

// Simulated dead zones near the driver — generated deterministically.
function useDeadZones(pos) {
  return useMemo(() => {
    if (!pos) return [];
    const seed = Math.abs(Math.round(pos[0] * 1000 + pos[1] * 1000));
    const names = ["Tunnel — Rt 9", "Riverside Gorge", "Old Mill Hwy", "Pine Hollow", "Quarry Rd", "Bridge Underpass", "Forest Ridge", "Canyon Bend"];
    const zones = [];
    for (let i = 0; i < 4; i++) {
      const k = (seed + i * 137) % names.length;
      zones.push({
        name: names[k],
        dist: +(0.4 + ((seed + i * 53) % 90) / 30).toFixed(1),
        severity: ["low", "med", "high"][(seed + i * 7) % 3],
        miles: +((seed + i * 29) % 5 + 0.5).toFixed(1),
      });
    }
    return zones.sort((a, b) => a.dist - b.dist);
  }, [pos]);
}

export default function Connectivity() {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [net, setNet] = useState(null);
  const [pos, setPos] = useState(null);
  const [posErr, setPosErr] = useState("");
  const [hotspot, setHotspot] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [history, setHistory] = useState([]);
  const tickRef = useRef(0);
  const perf = useLokinPerformance();

  // Listen for connectivity changes
  useEffect(() => {
    function up() { setOnline(true); setNet(getNetInfo()); }
    function down() { setOnline(false); }
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    setNet(getNetInfo());
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  // Get geolocation for dead-zone context
  useEffect(() => {
    if (!navigator.geolocation) { setPosErr("Geolocation unavailable"); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => setPos([p.coords.latitude, p.coords.longitude]),
      () => setPosErr("Location denied — using regional estimate"),
      { timeout: 6000 }
    );
  }, []);

  // Poll network quality every 3s, push a sample to the rolling history
  useEffect(() => {
    const id = setInterval(() => {
      const n = getNetInfo();
      setNet(n);
      const bars = barsFromNet(n, navigator.onLine);
      setHistory((h) => {
        const next = [...h, bars];
        if (next.length > 24) next.shift();
        return next;
      });
      tickRef.current++;
    }, cadenceFor(perf, 3000, 12000, 30000));
    return () => clearInterval(id);
  }, [perf?.effectiveMode, perf?.pauseNonessential]);

  const constellation = useConstellation(online);
  const deadZones = useDeadZones(pos);

  const status = online ? (constellation.connected >= 3 ? "online" : "weak") : "offline";
  const statusLabel = status === "online" ? "STEADY LINK" : status === "weak" ? "WEAK SIGNAL" : "OFFLINE";
  const statusColor = status === "online" ? "text-primary" : status === "weak" ? "text-[#FFD200]" : "text-destructive";

  const bars = barsFromNet(net, online);
  const downlink = net?.downlink ? `${net.downlink} Mbps` : online ? "~12 Mbps" : "0 Mbps";
  const rtt = net?.rtt != null ? `${net.rtt} ms` : online ? "~40 ms" : "—";
  const netType = net?.effectiveType ? net.effectiveType.toUpperCase() : online ? "4G" : "NO SVC";

  function findNearestSignal() {
    // Open Maps searching for nearest wifi / cell tower
    const q = encodeURIComponent("free wifi near me");
    window.open(`https://www.google.com/maps/search/${q}`, "_blank", "noopener,noreferrer");
  }

  function rescan() {
    setScanning(true);
    setTimeout(() => setScanning(false), 1400);
  }

  return (
    <div className="p-4 space-y-4 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] tracking-[0.28em] text-primary/70 font-display">SATELLITE CONNECTIVITY</div>
          <h1 className="text-2xl font-bold font-heading metal-text">Stay Linked</h1>
        </div>
        <button onClick={rescan} className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary active:scale-95">
          <RefreshCw className={`h-3.5 w-3.5 ${scanning ? "animate-spin" : ""}`} /> Rescan
        </button>
      </div>

      {/* Hero status — Starlink style constellation */}
      <div className="relative rounded-3xl border border-primary/25 lokin-panel radial-fade p-5 overflow-hidden">
        <div className="absolute inset-0 brand-grid opacity-20" />
        <div className="relative flex flex-col items-center">
          <SatelliteView status={status} connected={constellation.connected} />
          <div className={`mt-1 font-display font-black text-xl tracking-[0.18em] ${statusColor}`}
            style={{ textShadow: `0 0 14px ${status === "online" ? "hsl(80 100% 50% / 0.6)" : status === "weak" ? "hsl(48 100% 50% / 0.55)" : "hsl(0 84% 60% / 0.55)"}` }}>
            {statusLabel}
          </div>
          <div className="text-xs text-white/45 mt-1 flex items-center gap-1.5">
            <Satellite className="h-3.5 w-3.5 text-primary" />
            {constellation.connected}/{constellation.total} satellites locked
            {constellation.latency != null && <span className="text-white/40">· {constellation.latency} ms</span>}
          </div>
        </div>
      </div>

      {/* Signal bars + rolling history */}
      <div className="rounded-3xl border border-white/10 lokin-panel p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Signal className="h-4 w-4 text-primary" /> Cellular Signal
          </div>
          <div className="flex items-end gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className={`w-2.5 rounded-sm transition-all ${n <= bars ? "bg-primary glow-primary" : "bg-white/10"}`}
                style={{ height: `${10 + n * 6}px` }} />
            ))}
          </div>
        </div>
        {/* Rolling 24-sample timeline */}
        <div className="flex items-end gap-1 h-12">
          {history.length === 0 && <div className="text-xs text-white/40 self-center">Collecting samples…</div>}
          {history.map((b, i) => (
            <div key={i} className="flex-1 rounded-sm transition-all"
              style={{ height: `${(b / 5) * 100}%`, background: b >= 3 ? "hsl(80 100% 50% / 0.85)" : b >= 1 ? "hsl(48 100% 55% / 0.8)" : "hsl(0 84% 60% / 0.7)", minHeight: "3px" }} />
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px] text-white/40">
          <span>last {history.length || 0} samples</span>
          <span className="flex items-center gap-1"><Activity className="h-3 w-3" /> live</span>
        </div>
      </div>

      {/* Network detail grid */}
      <div className="grid grid-cols-2 gap-3">
        <DetailCard icon={Wifi} label="Network" value={netType} sub={online ? "active" : "no service"} accent={online} />
        <DetailCard icon={Zap} label="Download" value={downlink} sub="effective" />
        <DetailCard icon={Activity} label="Latency" value={rtt} sub="round trip" />
        <DetailCard icon={Radio} label="Sat Link" value={online ? "LOCKED" : "SEARCH"} sub={`${constellation.connected} sats`} accent={online} />
      </div>

      {/* Dead zone radar */}
      <div className="rounded-3xl border border-white/10 lokin-panel p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-4 w-4 text-[#FFD200]" />
          <div className="text-sm font-semibold text-white">Dead Zones Near You</div>
          <span className="ml-auto text-[10px] text-white/40">{deadZones.length} ahead</span>
        </div>
        {posErr && <div className="text-xs text-white/40 mb-2">{posErr}</div>}
        {deadZones.length === 0 && !posErr ? (
          <div className="text-xs text-white/45 py-4 text-center">Locating your route…</div>
        ) : (
          <div className="space-y-2">
            {deadZones.map((z, i) => {
              const sev = z.severity === "high" ? "destructive" : z.severity === "med" ? "#FFD200" : "primary";
              const sevText = z.severity === "high" ? "text-destructive" : z.severity === "med" ? "text-[#FFD200]" : "text-primary";
              return (
                <div key={i} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 p-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border" style={{ borderColor: `hsl(var(--${sev === "destructive" ? "destructive" : "primary"}) / 0.4)` }}>
                    <RadioTower className={`h-4 w-4 ${sevText}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{z.name}</div>
                    <div className="text-[11px] text-white/45">{z.dist} mi ahead · ~{z.miles} mi gap</div>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wide ${sevText}`}>{z.severity}</span>
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-3 text-[11px] text-white/45 leading-relaxed">
          LOKIN caches your route, earnings, and AI briefing offline. Calls to partner apps may pause in dead zones — the satellite link keeps your navigation and SOS reachable.
        </p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={findNearestSignal} className="rounded-2xl border border-primary/30 bg-primary/10 p-4 text-left active:scale-[0.98] transition-transform glow-primary">
          <MapPin className="h-5 w-5 text-primary mb-2" />
          <div className="text-sm font-bold text-white">Find Signal</div>
          <div className="text-[11px] text-white/50">Nearest wifi &amp; towers</div>
        </button>
        <button onClick={() => setHotspot((h) => !h)} className={`rounded-2xl border p-4 text-left active:scale-[0.98] transition-transform ${hotspot ? "border-accent/40 bg-accent/10 glow-cyan" : "border-white/10 lokin-panel"}`}>
          <Battery className={`h-5 w-5 mb-2 ${hotspot ? "text-accent" : "text-white/60"}`} />
          <div className="text-sm font-bold text-white">Hotspot Boost</div>
          <div className={`text-[11px] ${hotspot ? "text-accent" : "text-white/50"}`}>{hotspot ? "Broadcasting" : "Share your link"}</div>
        </button>
      </div>

      {/* Tips */}
      <div className="rounded-3xl border border-accent/25 bg-accent/[0.05] p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-accent mb-2">
          <Navigation className="h-4 w-4" /> Low-Signal Playbook
        </div>
        <ul className="space-y-1.5 text-xs text-white/65 leading-relaxed">
          <li>• Download offline maps before long rural routes.</li>
          <li>• Keep a 12V / USB-C power bank — GPS drains fast when searching.</li>
          <li>• Switch to satellite link in tunnels &amp; canyons so SOS stays live.</li>
          <li>• Pause gig acceptance in red zones to avoid missed-deadline penalties.</li>
        </ul>
      </div>

      <Link to="/safety" className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.02] p-4 active:scale-[0.99] transition-transform">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-destructive/30 bg-destructive/10">
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">Emergency SOS</div>
            <div className="text-[11px] text-white/45">Satellite-assisted if you lose cell</div>
          </div>
        </div>
        <ArrowUpRight className="h-4 w-4 text-white/40" />
      </Link>

      <div className="text-center text-[10px] tracking-[0.2em] text-white/30 pt-1">
        LOKIN LINK · EVERY MILE CONNECTED
      </div>
    </div>
  );
}

// Map network info to a 1–5 bar reading
function barsFromNet(net, online) {
  if (!online) return 0;
  if (!net) return 3;
  const map = { "slow-2g": 1, "2g": 1, "3g": 2, "4g": 4, "5g": 5 };
  let b = map[net.effectiveType] ?? 3;
  // Downlink boost/cut
  if (net.downlink != null) {
    if (net.downlink >= 10) b = Math.max(b, 4);
    if (net.downlink >= 20) b = 5;
    if (net.downlink < 1) b = Math.min(b, 1);
  }
  // High latency cuts bars
  if (net.rtt != null && net.rtt > 300) b = Math.min(b, 2);
  return b;
}

function DetailCard({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className="rounded-2xl border border-white/10 lokin-panel p-3.5">
      <div className="flex items-center gap-1.5 text-[11px] text-white/45">
        <Icon className={`h-3.5 w-3.5 ${accent ? "text-primary" : "text-white/50"}`} /> {label}
      </div>
      <div className={`text-lg font-bold font-display mt-1 ${accent ? "text-primary text-glow" : "text-white"}`}>{value}</div>
      <div className="text-[11px] text-white/40">{sub}</div>
    </div>
  );
}