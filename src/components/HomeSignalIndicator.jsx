import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Signal, WifiOff } from "lucide-react";

// Network-status pill for the Home screen. It uses only information the
// current app environment exposes and never fabricates cellular radio data.

function getNetInfo() {
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  return c
    ? { effectiveType: c.effectiveType, downlink: c.downlink, rtt: c.rtt }
    : null;
}

function barsFromNet(net, online) {
  if (!online) return 0;
  if (!net) return null;
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

export default function HomeSignalIndicator() {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [net, setNet] = useState(null);

  useEffect(() => {
    function up() { setOnline(true); setNet(getNetInfo()); }
    function down() { setOnline(false); }
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (c) c.addEventListener?.("change", () => setNet(getNetInfo()));
    setNet(getNetInfo());
    const id = setInterval(() => setNet(getNetInfo()), 5000);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
      clearInterval(id);
    };
  }, []);

  const bars = barsFromNet(net, online);
  const label = !online ? "OFFLINE" : net?.effectiveType ? net.effectiveType.toUpperCase() : "ONLINE";
  const color = !online ? "text-destructive" : bars != null && bars < 3 ? "text-[#FFD200]" : "text-primary";
  const barColor = !online ? "bg-destructive" : bars != null && bars < 3 ? "bg-[#FFD200]" : "bg-primary";

  return (
    <Link
      to="/connectivity"
      className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 active:scale-[0.97] transition-transform"
      aria-label="Network status — open Stay Linked"
    >
      {!online ? <WifiOff className="h-3.5 w-3.5 text-destructive" /> : <Signal className={`h-3.5 w-3.5 ${color}`} />}
      <div className="flex items-end gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <div
            key={n}
            className={`w-[3px] rounded-sm transition-all ${bars != null && n <= bars ? barColor : "bg-white/15"}`}
            style={{ height: `${5 + n * 2}px` }}
          />
        ))}
      </div>
      <span className={`text-[10px] font-bold tracking-wider ${color}`}>{label}</span>
    </Link>
  );
}