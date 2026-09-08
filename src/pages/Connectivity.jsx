import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Wifi, Signal, Activity, MapPin, Navigation, AlertTriangle,
  Zap, ArrowUpRight, RefreshCw, Database, Gauge,
} from "lucide-react";

function getNetInfo() {
  if (typeof navigator === "undefined") return null;
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  return c
    ? { effectiveType: c.effectiveType, downlink: c.downlink, rtt: c.rtt, saveData: c.saveData }
    : null;
}

function qualityFromNet(net, online) {
  if (!online) return { score: 0, label: "OFFLINE" };
  if (!net) return { score: null, label: "CONNECTED" };
  let score = { "slow-2g": 1, "2g": 1, "3g": 2, "4g": 4 }[net.effectiveType] ?? 3;
  if (net.downlink != null) {
    if (net.downlink >= 10) score = Math.max(score, 4);
    if (net.downlink >= 20) score = 5;
    if (net.downlink < 1) score = Math.min(score, 1);
  }
  if (net.rtt != null && net.rtt > 300) score = Math.min(score, 2);
  return { score, label: score >= 4 ? "STRONG" : score >= 2 ? "FAIR" : "WEAK" };
}

export default function Connectivity() {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [net, setNet] = useState(null);
  const [history, setHistory] = useState([]);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    function refresh() {
      const nextOnline = navigator.onLine;
      const nextNet = getNetInfo();
      setOnline(nextOnline);
      setNet(nextNet);
      const q = qualityFromNet(nextNet, nextOnline);
      if (q.score != null) {
        setHistory((h) => [...h.slice(-23), q.score]);
      }
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

  const quality = qualityFromNet(net, online);
  const statusColor = !online ? "text-destructive" : quality.score != null && quality.score < 3 ? "text-[#FFD200]" : "text-primary";
  const supportsMetrics = Boolean(net);
  const effectiveType = net?.effectiveType ? net.effectiveType.toUpperCase() : "—";
  const downlink = net?.downlink != null ? `${net.downlink} Mbps` : "—";
  const rtt = net?.rtt != null ? `${net.rtt} ms` : "—";
  const dataSaver = net?.saveData === true ? "ON" : net?.saveData === false ? "OFF" : "—";

  function findNearestSignal() {
    const q = encodeURIComponent("public wifi near me");
    window.open(`https://www.google.com/maps/search/${q}`, "_blank", "noopener,noreferrer");
  }

  function rescan() {
    setScanning(true);
    const nextOnline = navigator.onLine;
    const nextNet = getNetInfo();
    setOnline(nextOnline);
    setNet(nextNet);
    const q = qualityFromNet(nextNet, nextOnline);
    if (q.score != null) setHistory((h) => [...h.slice(-23), q.score]);
    setTimeout(() => setScanning(false), 450);
  }

  return (
    <div className="p-4 space-y-4 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] tracking-[0.28em] text-primary/70 font-display">NETWORK DIAGNOSTICS</div>
          <h1 className="text-2xl font-bold font-heading metal-text">Stay Linked</h1>
        </div>
        <button onClick={rescan} className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary active:scale-95">
          <RefreshCw className={`h-3.5 w-3.5 ${scanning ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className="relative rounded-3xl border border-primary/25 lokin-panel radial-fade p-5 overflow-hidden">
        <div className="absolute inset-0 brand-grid opacity-20" />
        <div className="relative flex flex-col items-center text-center py-3">
          <div className={`flex h-20 w-20 items-center justify-center rounded-full border ${online ? "border-primary/40 bg-primary/10 glow-primary" : "border-destructive/40 bg-destructive/10"}`}>
            {online ? <Wifi className="h-9 w-9 text-primary" /> : <AlertTriangle className="h-9 w-9 text-destructive" />}
          </div>
          <div className={`mt-3 font-display font-black text-xl tracking-[0.18em] ${statusColor}`}>{quality.label}</div>
          <div className="mt-1 text-xs text-white/45">
            {supportsMetrics ? "Live connection estimates reported by this device environment" : online ? "Online · detailed connection metrics are not exposed on this device" : "No internet connection detected"}
          </div>
        </div>
      </div>

      {quality.score != null && (
        <div className="rounded-3xl border border-white/10 lokin-panel p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Signal className="h-4 w-4 text-primary" /> Connection Quality
            </div>
            <div className="flex items-end gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n} className={`w-2.5 rounded-sm ${n <= quality.score ? "bg-primary glow-primary" : "bg-white/10"}`} style={{ height: `${10 + n * 6}px` }} />
              ))}
            </div>
          </div>
          <div className="flex items-end gap-1 h-12">
            {history.length === 0 && <div className="text-xs text-white/40 self-center">Collecting supported samples…</div>}
            {history.map((b, i) => (
              <div key={`${i}-${b}`} className="flex-1 rounded-sm" style={{ height: `${(b / 5) * 100}%`, background: "hsl(81 84% 51% / 0.75)", minHeight: "3px" }} />
            ))}
          </div>
          <div className="mt-2 text-[10px] text-white/40 flex items-center gap-1"><Activity className="h-3 w-3" /> Device-reported connection history</div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <DetailCard icon={Wifi} label="Effective type" value={effectiveType} sub={supportsMetrics ? "browser estimate" : "not exposed"} accent={online} />
        <DetailCard icon={Zap} label="Downlink" value={downlink} sub={supportsMetrics ? "estimated" : "not exposed"} />
        <DetailCard icon={Activity} label="Latency" value={rtt} sub={supportsMetrics ? "estimated RTT" : "not exposed"} />
        <DetailCard icon={Database} label="Data Saver" value={dataSaver} sub={supportsMetrics ? "device preference" : "not exposed"} />
      </div>

      <div className="rounded-3xl border border-accent/25 bg-accent/[0.05] p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-accent mb-2"><Gauge className="h-4 w-4" /> What LOKIN can verify</div>
        <p className="text-xs text-white/60 leading-relaxed">
          LOKIN can detect online/offline status and, where the device exposes them, estimated effective connection type, downlink, latency, and Data Saver status. iOS controls cellular radios and satellite services; LOKIN does not claim to change bands, boost signal, or create a satellite connection.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={findNearestSignal} className="rounded-2xl border border-primary/30 bg-primary/10 p-4 text-left active:scale-[0.98] transition-transform">
          <MapPin className="h-5 w-5 text-primary mb-2" />
          <div className="text-sm font-bold text-white">Find Public Wi-Fi</div>
          <div className="text-[11px] text-white/50">Opens external map search</div>
        </button>
        <Link to="/safety" className="rounded-2xl border border-white/10 lokin-panel p-4 text-left active:scale-[0.98] transition-transform">
          <AlertTriangle className="h-5 w-5 text-destructive mb-2" />
          <div className="text-sm font-bold text-white">Safety Tools</div>
          <div className="text-[11px] text-white/50">Open LOKIN safety center</div>
        </Link>
      </div>

      <div className="rounded-3xl border border-white/10 lokin-panel p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white mb-2"><Navigation className="h-4 w-4 text-primary" /> Low-Signal Playbook</div>
        <ul className="space-y-1.5 text-xs text-white/65 leading-relaxed">
          <li>• Keep navigation information loaded before entering a weak-service area.</li>
          <li>• Keep your phone powered; repeated network searching can increase battery use.</li>
          <li>• Move to a safer location with service before relying on internet-based app actions.</li>
          <li>• Use iPhone-native emergency features according to Apple and carrier availability.</li>
        </ul>
      </div>

      <Link to="/5g" className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.02] p-4 active:scale-[0.99] transition-transform">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/30 bg-primary/10"><Signal className="h-4 w-4 text-primary" /></div>
          <div><div className="text-sm font-bold text-white">Connection Details</div><div className="text-[11px] text-white/45">See supported network metrics</div></div>
        </div>
        <ArrowUpRight className="h-4 w-4 text-white/40" />
      </Link>

      <div className="text-center text-[10px] tracking-[0.2em] text-white/30 pt-1">LOKIN LINK · DEVICE-REPORTED DATA</div>
    </div>
  );
}

function DetailCard({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className="rounded-2xl border border-white/10 lokin-panel p-3.5">
      <div className="flex items-center gap-1.5 text-[11px] text-white/45"><Icon className={`h-3.5 w-3.5 ${accent ? "text-primary" : "text-white/50"}`} /> {label}</div>
      <div className={`text-lg font-bold font-display mt-1 ${accent ? "text-primary text-glow" : "text-white"}`}>{value}</div>
      <div className="text-[11px] text-white/40">{sub}</div>
    </div>
  );
}
