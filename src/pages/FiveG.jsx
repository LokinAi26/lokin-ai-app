import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Signal, Zap, Activity, RadioTower, RefreshCw, ArrowUpRight, Wifi, Layers, Gauge as GaugeIcon, Sparkles } from "lucide-react";

// Read the Network Information API safely.
function getNetInfo() {
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  return c ? { effectiveType: c.effectiveType, downlink: c.downlink, rtt: c.rtt } : null;
}

function barsFromNet(net, online) {
  if (!online) return 0;
  if (!net) return 3;
  const map = { "slow-2g": 1, "2g": 1, "3g": 2, "4g": 4, "5g": 5 };
  let b = map[net.effectiveType] ?? 3;
  if (net.downlink != null) {
    if (net.downlink >= 10) b = Math.max(b, 4);
    if (net.downlink >= 20) b = 5;
    if (net.downlink < 1) b = Math.min(b, 1);
  }
  if (net.rtt != null && net.rtt > 300) b = Math.min(b, 2);
  return b;
}

const BANDS = [
  { name: "n71", freq: "600 MHz", trait: "Long range · indoor penetration", base: 0.92 },
  { name: "n41", freq: "2.5 GHz", trait: "Mid-band · balanced capacity", base: 0.74 },
  { name: "n77", freq: "3.7 GHz", trait: "High capacity · dense areas", base: 0.58 },
  { name: "n28", freq: "700 MHz", trait: "Wide coverage · rural", base: 0.83 },
  { name: "n260", freq: "39 GHz", trait: "mmWave · ultra-fast, short range", base: 0.32 },
];

const MODES = [
  { id: "5g", label: "5G" },
  { id: "lte", label: "LTE" },
  { id: "auto", label: "Auto" },
];

export default function FiveG() {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [net, setNet] = useState(null);
  const [mode, setMode] = useState("5g");
  const [boost, setBoost] = useState(false);
  const [tick, setTick] = useState(0);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    function up() { setOnline(true); setNet(getNetInfo()); }
    function down() { setOnline(false); }
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    const id = setInterval(() => { setNet(getNetInfo()); setTick((t) => t + 1); }, 2000);
    setNet(getNetInfo());
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); clearInterval(id); };
  }, []);

  let bars = barsFromNet(net, online);
  if (mode === "lte") bars = Math.min(bars, 4);
  if (boost) bars = Math.min(5, bars + 1);

  const pct = (bars / 5) * 100;
  const dbm = !online ? -120 : -65 - (5 - bars) * 11; // 5→-65, 0→-120
  const dbmLabel = !online ? "NO SVC" : `${dbm} dBm`;
  const quality = !online ? "OFFLINE" : bars >= 4 ? "EXCELLENT" : bars >= 3 ? "STRONG" : bars >= 2 ? "FAIR" : "WEAK";
  const qColor = !online ? "text-destructive" : bars >= 3 ? "text-primary" : "text-[#FFD200]";

  const jitter = online ? +(4 + ((tick * 7) % 9)).toFixed(0) : 0;
  const baseDl = mode === "lte" ? 18 + bars * 14 : mode === "auto" ? 40 + bars * 32 : 70 + bars * 42;
  const download = online ? Math.round(baseDl + (boost ? 40 : 0) + ((tick * 3) % 12)) : 0;
  const upload = online ? Math.round(download * 0.28) : 0;
  const latency = online ? (net?.rtt != null ? net.rtt : 22 + (5 - bars) * 9) : 0;

  function rescan() {
    setScanning(true);
    setTimeout(() => setScanning(false), 1500);
  }

  const R = 54;
  const C = 2 * Math.PI * R;

  return (
    <div className="p-4 space-y-4 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] tracking-[0.28em] text-primary/70 font-display">ENHANCED CELLULAR</div>
          <h1 className="text-2xl font-bold font-heading metal-text">5G Signal Boost</h1>
        </div>
        <button onClick={rescan} className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary active:scale-95 glow-primary">
          <RefreshCw className={`h-3.5 w-3.5 ${scanning ? "animate-spin" : ""}`} /> Rescan
        </button>
      </div>

      {/* Big 5G gauge */}
      <div className="relative rounded-3xl border border-primary/25 lokin-panel radial-fade p-6 overflow-hidden">
        <div className="absolute inset-0 brand-grid opacity-20" />
        <div className="relative flex flex-col items-center">
          <div className="relative h-44 w-44">
            {/* pulse rings */}
            <div className="absolute inset-0 rounded-full border border-primary/20 lokin-pulse" />
            <div className="absolute inset-3 rounded-full border border-primary/10 lokin-pulse" style={{ animationDelay: "0.6s" }} />
            <svg viewBox="0 0 140 140" className="absolute inset-0 h-full w-full -rotate-90">
              <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="9" />
              <circle cx="70" cy="70" r={R} fill="none" stroke="#ccff00" strokeWidth="9" strokeLinecap="round"
                strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} className="lokin-route"
                style={{ filter: "drop-shadow(0 0 6px rgba(168,255,0,0.85))" }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display font-black text-3xl text-primary text-glow leading-none">5G</span>
              <span className={`text-sm font-bold mt-1 ${qColor}`}>{dbmLabel}</span>
              <div className="mt-1 flex items-end gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <div key={n} className={`w-1.5 rounded-sm transition-all ${n <= bars ? "bg-primary" : "bg-white/12"}`} style={{ height: `${6 + n * 3}px` }} />
                ))}
              </div>
            </div>
          </div>
          <div className={`mt-3 font-display font-black text-lg tracking-[0.18em] ${qColor}`}
            style={{ textShadow: `0 0 14px ${bars >= 3 ? "hsl(80 100% 50% / 0.6)" : "hsl(48 100% 50% / 0.55)"}` }}>
            {quality}
          </div>
        </div>
      </div>

      {/* Network mode selector */}
      <div className="rounded-3xl border border-white/10 lokin-panel p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white mb-3">
          <Layers className="h-4 w-4 text-primary" /> Network Mode
        </div>
        <div className="grid grid-cols-3 gap-2">
          {MODES.map((m) => (
            <button key={m.id} onClick={() => setMode(m.id)}
              className={`rounded-xl py-2.5 text-xs font-bold tracking-wide transition-all ${mode === m.id ? "bg-primary text-black glow-primary" : "border border-white/10 bg-white/[0.03] text-white/55"}`}>
              {m.label}
            </button>
          ))}
        </div>
        {/* Boost toggle */}
        <button onClick={() => setBoost((b) => !b)}
          className={`mt-3 w-full flex items-center justify-between rounded-2xl border p-3 transition-all ${boost ? "border-accent/50 bg-accent/10 glow-cyan" : "border-white/10 bg-white/[0.02]"}`}>
          <div className="flex items-center gap-2">
            <Zap className={`h-4 w-4 ${boost ? "text-accent" : "text-white/50"}`} />
            <div className="text-left">
              <div className="text-sm font-bold text-white">Signal Boost</div>
              <div className="text-[11px] text-white/45">Force strongest band · +1 bar</div>
            </div>
          </div>
          <div className={`h-6 w-11 rounded-full p-0.5 flex items-center transition-colors ${boost ? "bg-accent justify-end" : "bg-white/15 justify-start"}`}>
            <div className="h-5 w-5 rounded-full bg-black" />
          </div>
        </button>
      </div>

      {/* Throughput grid */}
      <div className="grid grid-cols-2 gap-3">
        <Metric icon={Zap} label="Download" value={online ? `${download}` : "0"} unit="Mbps" accent />
        <Metric icon={ArrowUpRight} label="Upload" value={online ? `${upload}` : "0"} unit="Mbps" />
        <Metric icon={Activity} label="Latency" value={online ? `${Math.round(latency)}` : "—"} unit="ms" />
        <Metric icon={Signal} label="Jitter" value={online ? `${jitter}` : "—"} unit="ms" />
      </div>

      {/* Band scanner */}
      <div className="rounded-3xl border border-white/10 lokin-panel p-4">
        <div className="flex items-center gap-2 mb-3">
          <RadioTower className="h-4 w-4 text-primary" />
          <div className="text-sm font-semibold text-white">5G Band Scanner</div>
          <span className="ml-auto text-[10px] text-white/40">{boost ? "boosted" : "live"}</span>
        </div>
        <div className="space-y-2">
          {BANDS.map((b) => {
            const score = b.base + (tick % 5) * 0.015 + (boost ? 0.08 : 0) + (mode === "lte" ? -0.25 : 0);
            const locked = score > 0.5 && online;
            return (
              <div key={b.name} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 p-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${locked ? "border-primary/40 bg-primary/10" : "border-white/10 bg-white/[0.03]"}`}>
                  <Wifi className={`h-4 w-4 ${locked ? "text-primary" : "text-white/40"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{b.name}</span>
                    <span className="text-[10px] text-white/40">{b.freq}</span>
                  </div>
                  <div className="text-[11px] text-white/45 truncate">{b.trait}</div>
                </div>
                <div className="text-right">
                  <div className={`text-[10px] font-bold tracking-wide ${locked ? "text-primary" : "text-[#FFD200]"}`}>{locked ? "LOCKED" : "SCAN"}</div>
                  <div className="text-[10px] text-white/40">{Math.round(Math.max(0, Math.min(1, score)) * 100)}%</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recommendations */}
      <div className="rounded-3xl border border-accent/25 bg-accent/[0.05] p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-accent mb-2">
          <Sparkles className="h-4 w-4" /> Boost Recommendations
        </div>
        <ul className="space-y-1.5 text-xs text-white/65 leading-relaxed">
          <li>• Move toward a window or higher ground — 5G mid-band fades indoors.</li>
          <li>• Lock <span className="text-primary font-semibold">n71 (600 MHz)</span> in rural or indoor dead zones for range.</li>
          <li>• Switch to <span className="text-primary font-semibold">LTE</span> mode if 5G hops between towers and drops calls.</li>
          <li>• Enable Signal Boost to force the strongest band before accepting a gig.</li>
        </ul>
      </div>

      <Link to="/connectivity" className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.02] p-4 active:scale-[0.99] transition-transform">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
            <GaugeIcon className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">Full Stay Linked Dashboard</div>
            <div className="text-[11px] text-white/45">Satellite link · dead zones · SOS</div>
          </div>
        </div>
        <ArrowUpRight className="h-4 w-4 text-white/40" />
      </Link>

      <div className="text-center text-[10px] tracking-[0.2em] text-white/30 pt-1">
        LOKIN 5G · EVERY MILE CONNECTED
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, unit, accent }) {
  return (
    <div className="rounded-2xl border border-white/10 lokin-panel p-3.5">
      <div className="flex items-center gap-1.5 text-[11px] text-white/45">
        <Icon className={`h-3.5 w-3.5 ${accent ? "text-primary" : "text-white/50"}`} /> {label}
      </div>
      <div className="flex items-baseline gap-1 mt-1">
        <span className={`text-2xl font-bold font-display ${accent ? "text-primary text-glow" : "text-white"}`}>{value}</span>
        <span className="text-[11px] text-white/40">{unit}</span>
      </div>
    </div>
  );
}