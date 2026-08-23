import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Signal, Zap, Activity, RefreshCw, ArrowUpRight, Wifi, Gauge as GaugeIcon, ShieldCheck } from "lucide-react";

function getNetInfo() {
  if (typeof navigator === "undefined") return null;
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  return c ? { effectiveType: c.effectiveType, downlink: c.downlink, rtt: c.rtt, saveData: c.saveData } : null;
}

function connectionScore(net, online) {
  if (!online) return 0;
  if (!net) return null;
  let score = { "slow-2g": 1, "2g": 1, "3g": 2, "4g": 4 }[net.effectiveType] ?? 3;
  if (net.downlink != null) {
    if (net.downlink >= 10) score = Math.max(score, 4);
    if (net.downlink >= 20) score = 5;
    if (net.downlink < 1) score = Math.min(score, 1);
  }
  if (net.rtt != null && net.rtt > 300) score = Math.min(score, 2);
  return score;
}

export default function FiveG() {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [net, setNet] = useState(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    function refresh() {
      setOnline(navigator.onLine);
      setNet(getNetInfo());
    }
    refresh();
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    c?.addEventListener?.("change", refresh);
    const id = setInterval(refresh, 5000);
    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
      c?.removeEventListener?.("change", refresh);
      clearInterval(id);
    };
  }, []);

  const score = connectionScore(net, online);
  const pct = score == null ? 0 : (score / 5) * 100;
  const quality = !online ? "OFFLINE" : score == null ? "CONNECTED" : score >= 4 ? "STRONG" : score >= 2 ? "FAIR" : "WEAK";
  const qColor = !online ? "text-destructive" : score != null && score < 3 ? "text-[#FFD200]" : "text-primary";
  const R = 54;
  const C = 2 * Math.PI * R;

  function refreshNow() {
    setScanning(true);
    setOnline(navigator.onLine);
    setNet(getNetInfo());
    setTimeout(() => setScanning(false), 450);
  }

  return (
    <div className="p-4 space-y-4 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] tracking-[0.28em] text-primary/70 font-display">DEVICE NETWORK DATA</div>
          <h1 className="text-2xl font-bold font-heading metal-text">Connection Diagnostics</h1>
        </div>
        <button onClick={refreshNow} className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary active:scale-95 glow-primary">
          <RefreshCw className={`h-3.5 w-3.5 ${scanning ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className="relative rounded-3xl border border-primary/25 lokin-panel radial-fade p-6 overflow-hidden">
        <div className="absolute inset-0 brand-grid opacity-20" />
        <div className="relative flex flex-col items-center">
          <div className="relative h-44 w-44">
            <svg viewBox="0 0 140 140" className="absolute inset-0 h-full w-full -rotate-90">
              <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="9" />
              {score != null && (
                <circle cx="70" cy="70" r={R} fill="none" stroke="#ccff00" strokeWidth="9" strokeLinecap="round"
                  strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} className="lokin-route"
                  style={{ filter: "drop-shadow(0 0 6px rgba(168,255,0,0.85))" }} />
              )}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
              <Signal className={`h-9 w-9 ${qColor}`} />
              <span className={`text-sm font-bold mt-2 ${qColor}`}>{quality}</span>
              <span className="text-[10px] text-white/40 mt-1">{net?.effectiveType ? `effective ${net.effectiveType.toUpperCase()}` : online ? "metrics not exposed" : "no connection"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Metric icon={Wifi} label="Effective type" value={net?.effectiveType ? net.effectiveType.toUpperCase() : "—"} unit="" accent />
        <Metric icon={Zap} label="Downlink" value={net?.downlink != null ? `${net.downlink}` : "—"} unit={net?.downlink != null ? "Mbps" : ""} />
        <Metric icon={Activity} label="Latency" value={net?.rtt != null ? `${net.rtt}` : "—"} unit={net?.rtt != null ? "ms" : ""} />
        <Metric icon={GaugeIcon} label="Data Saver" value={net?.saveData === true ? "ON" : net?.saveData === false ? "OFF" : "—"} unit="" />
      </div>

      <div className="rounded-3xl border border-primary/25 bg-primary/[0.05] p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary mb-2"><ShieldCheck className="h-4 w-4" /> iPhone-safe diagnostics</div>
        <p className="text-xs text-white/60 leading-relaxed">
          LOKIN reports only network information the app environment exposes. It does not force 5G/LTE mode, select radio bands, increase signal bars, read true cellular dBm, or override carrier settings. Those controls remain with iOS and your carrier.
        </p>
      </div>

      <div className="rounded-3xl border border-accent/25 bg-accent/[0.05] p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-accent mb-2"><Signal className="h-4 w-4" /> Connection tips</div>
        <ul className="space-y-1.5 text-xs text-white/65 leading-relaxed">
          <li>• If service weakens, move to a safe open area before retrying internet-dependent actions.</li>
          <li>• Keep your phone charged; weak-service searching can increase battery use.</li>
          <li>• If your carrier connection is unstable, use iPhone Settings to manage cellular options.</li>
          <li>• Treat displayed throughput and latency as device/browser estimates when available.</li>
        </ul>
      </div>

      <Link to="/connectivity" className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.02] p-4 active:scale-[0.99] transition-transform">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/30 bg-primary/10"><GaugeIcon className="h-4 w-4 text-primary" /></div>
          <div><div className="text-sm font-bold text-white">Stay Linked Dashboard</div><div className="text-[11px] text-white/45">Online status · supported metrics · safety guidance</div></div>
        </div>
        <ArrowUpRight className="h-4 w-4 text-white/40" />
      </Link>

      <div className="text-center text-[10px] tracking-[0.2em] text-white/30 pt-1">LOKIN NETWORK · NO SIMULATED RADIO CONTROL</div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, unit, accent }) {
  return (
    <div className="rounded-2xl border border-white/10 lokin-panel p-3.5">
      <div className="flex items-center gap-1.5 text-[11px] text-white/45"><Icon className={`h-3.5 w-3.5 ${accent ? "text-primary" : "text-white/50"}`} /> {label}</div>
      <div className="flex items-baseline gap-1 mt-1"><span className={`text-2xl font-bold font-display ${accent ? "text-primary text-glow" : "text-white"}`}>{value}</span>{unit && <span className="text-[11px] text-white/40">{unit}</span>}</div>
    </div>
  );
}
