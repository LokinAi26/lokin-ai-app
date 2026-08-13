import { useEffect, useState } from "react";
import { Route as RouteIcon, MapPin, Clock, DollarSign, ChevronRight, Sparkles, Navigation, Radar } from "lucide-react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { CATEGORY_LABELS, OPTIMIZATION_MODES } from "@/lib/deliveryLabels";
import LockInScore from "@/components/LockInScore";
import RouteHeatMap from "@/components/RouteHeatMap";
import AiGps4D from "@/components/AiGps4D";

export default function RoutePlanner() {
  const [origin, setOrigin] = useState("");
  const [mode, setMode] = useState("most_profit");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [prefs, setPrefs] = useState(null);

  useEffect(() => {
    base44.entities.DriverPreference.filter({}).then((p) => {
      setPrefs(p[0] || null);
      if (p[0]?.optimization_mode) setMode(p[0].optimization_mode);
    });
  }, []);

  async function optimize() {
    setLoading(true); setError(""); setData(null);
    try {
      const res = await base44.functions.invoke("optimizeRoute", { originAddress: origin, mode });
      setData(res.data);
      if (prefs?.id) base44.entities.DriverPreference.update(prefs.id, { optimization_mode: mode });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function openInMaps() {
    const stops = data?.sequenced || [];
    if (stops.length === 0) return;
    const dest = stops[stops.length - 1].dropoff_address || "";
    const originParam = origin ? `&origin=${encodeURIComponent(origin)}` : "";
    const waypoints = stops.slice(0, -1).map((s) => encodeURIComponent(s.dropoff_address || s.merchant)).join("|");
    const wpParam = waypoints ? `&waypoints=${waypoints}` : "";
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}${originParam}${wpParam}`, "_blank", "noopener,noreferrer");
  }

  const stops = data?.sequenced || [];

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <RouteIcon className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold font-heading metal-text">Route Optimizer</h1>
        </div>
        <Link to="/drive" className="flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-bold text-accent glow-cyan">
          <Radar className="h-3.5 w-3.5" /> AI GPS
        </Link>
      </div>
      <p className="text-sm text-white/45 -mt-2">Pick a mode — LOKIN ranks offers for that goal and sequences them by zone.</p>

      <RouteHeatMap />

      <div className="flex flex-wrap gap-2">
        {OPTIMIZATION_MODES.map((m) => (
          <button key={m.value} onClick={() => setMode(m.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${mode === m.value ? "border-primary bg-primary/15 text-primary" : "border-white/10 bg-white/[0.03] text-white/50"}`}>
            {m.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="Start address / zip"
          className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-white/30" />
        <button onClick={optimize} disabled={loading} className="rounded-xl bg-primary text-primary-foreground px-5 text-sm font-bold glow-primary disabled:opacity-60">
          {loading ? "…" : "Optimize"}
        </button>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}

      {data?.stats && (
        <div className="rounded-3xl border border-white/10 lokin-panel p-4">
          <div className="grid grid-cols-4 gap-2 text-center">
            <Stat label="stops" value={data.stats.stops} />
            <Stat label="miles" value={data.stats.miles} />
            <Stat label="net" value={`$${data.stats.net}`} accent />
            <Stat label="net/hr" value={`$${data.stats.perHour}`} accent />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            <MiniStat label="gross" value={`$${data.stats.gross}`} />
            <MiniStat label="fuel" value={`$${data.stats.fuel}`} />
            <MiniStat label="net/mi" value={`$${data.stats.efficiency}`} />
          </div>
        </div>
      )}

      {/* Dark map card with bright route line */}
      {stops.length > 0 && (
        <div className="rounded-3xl border border-white/10 overflow-hidden lokin-panel">
          <div className="relative h-40 bg-black">
            <div className="absolute inset-0 brand-grid opacity-40" />
            <svg viewBox="0 0 320 160" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
              <path d="M30 130 C 80 110, 90 60, 140 70 S 220 120, 290 30" stroke="hsl(80 100% 50%)" strokeWidth="3" fill="none" strokeLinecap="round" style={{ filter: "drop-shadow(0 0 6px hsl(80 100% 50% / 0.9))" }} />
              {stops.slice(0, 6).map((_, i) => {
                const pts = [[30, 130], [110, 80], [170, 95], [230, 70], [290, 30]];
                const p = pts[Math.min(i, pts.length - 1)];
                return <circle key={i} cx={p[0]} cy={p[1]} r="5" fill="hsl(80 100% 50%)" stroke="#000" strokeWidth="2" />;
              })}
            </svg>
            <div className="absolute top-2 left-3 text-[10px] uppercase tracking-wider text-white/40">Optimized route</div>
          </div>
          <button onClick={openInMaps}
            className="w-full flex items-center justify-center gap-2 border-t border-white/10 bg-primary/10 py-3 text-sm font-bold text-primary">
            <Navigation className="h-4 w-4" /> Open in Maps
          </button>
        </div>
      )}

      {stops.length > 0 && <AiGps4D stops={stops} compact />}

      {data?.lockInScore && <LockInScore score={data.lockInScore} />}

      {data?.briefing && (
        <div className="rounded-3xl border border-primary/25 bg-primary/[0.06] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold mb-2 text-primary">
            <Sparkles className="h-4 w-4" /> AI Strategy ({OPTIMIZATION_MODES.find((m) => m.value === data.mode)?.label})
          </div>
          <p className="text-sm whitespace-pre-wrap leading-relaxed text-white/80">{data.briefing}</p>
        </div>
      )}

      {stops.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-semibold text-white/80">Optimized Order</div>
          {stops.map((o, i) => (
            <div key={o.id} className="rounded-2xl border border-white/10 lokin-panel p-3.5">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold glow-primary">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-sm truncate text-white">{o.merchant}</div>
                    <div className="text-sm font-bold text-primary">${o.rate.gross}</div>
                  </div>
                  <div className="text-xs text-white/45">{CATEGORY_LABELS[o.category] || o.category}</div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/55">
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-primary" />{o.miles}mi</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-primary" />{o.est_minutes}m</span>
                    <span className="flex items-center gap-1 text-primary font-semibold"><DollarSign className="h-3 w-3" />{o.rate.netPerHour}/hr</span>
                  </div>
                  <div className="mt-1 text-[11px] flex gap-2 text-white/40">
                    <span>net ${o.rate.net}</span><span>fuel ${o.rate.fuel}</span><span>exp ${o.rate.expenses}</span>
                  </div>
                  <div className="mt-1 text-xs truncate text-white/45"><span className="text-primary">→ </span>{o.dropoff_address}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-white/30 mt-1" />
              </div>
            </div>
          ))}
        </div>
      )}

      {data && stops.length === 0 && (
        <div className="text-sm text-white/45 text-center py-8">No offers match your filters. Adjust them in More → Work Filters.</div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }) {
  return <div><div className={`font-bold text-lg font-display ${accent ? "text-primary text-glow" : "text-white"}`}>{value}</div><div className="text-[11px] text-white/40 uppercase tracking-wide">{label}</div></div>;
}
function MiniStat({ label, value }) {
  return <div className="rounded-xl border border-white/8 bg-white/[0.02] p-2"><div className="font-bold text-white">{value}</div><div className="text-white/40 text-[10px]">{label}</div></div>;
}