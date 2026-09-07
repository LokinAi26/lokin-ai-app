import { useEffect, useState } from "react";
import { Route as RouteIcon, MapPin, Clock, DollarSign, ChevronRight, Sparkles, Navigation, Store } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { CATEGORY_LABELS, OPTIMIZATION_MODES } from "@/lib/deliveryLabels";
import LockInScore from "@/components/LockInScore";
import SealDecisionCard from "@/components/SealDecisionCard";
import RouteHeatMap from "@/components/RouteHeatMap";
import LocalOfferCapture from "@/components/LocalOfferCapture";
import SatelliteRoutePreview from "@/components/SatelliteRoutePreview";
import { guardedInvoke } from "@/lib/creditGuardian";
import { saveOptimizedRouteSession } from "@/lib/optimizedRouteSession";

export default function RoutePlanner() {
  const navigate = useNavigate();
  const [origin, setOrigin] = useState("");
  const [mode, setMode] = useState("most_profit");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [prefs, setPrefs] = useState(null);
  const [offerRevision, setOfferRevision] = useState(0);

  useEffect(() => {
    base44.entities.DriverPreference.filter({}).then((p) => {
      setPrefs(p[0] || null);
      if (p[0]?.optimization_mode) setMode(p[0].optimization_mode);
    });
  }, []);

  async function optimizeAndLaunchGps() {
    const directDestination = origin.trim();
    if (directDestination) {
      setError("");
      const params = new URLSearchParams({
        focus: "locked",
        nav: "1",
        view: "real",
        source: "route-planner",
        destination: directDestination,
      });
      navigate(`/ai-gps?${params.toString()}`);
      return;
    }

    setLoading(true);
    setError("");
    setData(null);
    try {
      const res = await guardedInvoke(
        base44,
        "optimizeRoute",
        { originAddress: origin, mode },
        { force: true, userInitiated: true },
      );
      const optimized = res.data || {};
      const sequenced = Array.isArray(optimized.sequenced) ? optimized.sequenced : [];
      setData(optimized);

      if (!sequenced.length) {
        setError(optimized.briefing || "No current verified offers are available to launch in GPS. Add or refresh an eligible offer, then try again.");
        return;
      }

      const handoffSaved = saveOptimizedRouteSession({
        stops: sequenced,
        mode: optimized.mode || mode,
        originAddress: origin,
      });
      if (!handoffSaved) {
        setError("LOKIN optimized the route but could not transfer it to GPS. Keep this screen open and try again.");
        return;
      }

      if (prefs?.id) {
        await base44.entities.DriverPreference.update(prefs.id, { optimization_mode: mode }).catch(() => null);
      }
      navigate("/ai-gps?focus=locked&nav=1&view=real&source=optimizer");
    } catch (e) {
      setError(e?.message || "LOKIN could not optimize and launch this route.");
    } finally {
      setLoading(false);
    }
  }

  const stops = data?.sequenced || [];

  // Parse a store-hours string like "7AM-11PM" or "07:00-23:00" into an
  // {open, close} pair of decimal hours (0-24). Returns null if unparseable.
  function parseHours(raw) {
    if (!raw) return null;
    const m = raw.toUpperCase().replace(/\s+/g, "").match(/(\d{1,2})(?::(\d{2}))?(AM|PM)?[-–TO]+(\d{1,2})(?::(\d{2}))?(AM|PM)?/);
    if (!m) return null;
    const toDec = (h, mm, ap) => {
      let v = Number(h) + (Number(mm || 0) / 60);
      if (ap === "AM" && v === 12) v = 0;
      if (ap === "PM" && v < 12) v += 12;
      return v;
    };
    const open = toDec(m[1], m[2], m[3]);
    let close = toDec(m[4], m[5], m[6] || m[3]);
    if (close < open) close += 24; // closes after midnight
    return { open, close };
  }

  function hoursStatus(raw) {
    const h = parseHours(raw);
    if (!h) return { label: raw || "Hours n/a", open: null };
    const now = new Date();
    const cur = now.getHours() + now.getMinutes() / 60;
    const isOpen = cur >= h.open && cur < h.close;
    return { label: raw, open: isOpen };
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <RouteIcon className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold font-heading metal-text">Route Optimizer</h1>
      </div>
      <p className="text-sm text-white/45 -mt-2">Enter a destination to launch GPS directly, or leave it blank to optimize verified delivery stops first.</p>

      <RouteHeatMap
        mode={mode}
        originAddress={origin}
        selectedOfferIds={stops.map((stop) => stop.id)}
        refreshKey={offerRevision}
      />

      <LocalOfferCapture
        onSaved={() => {
          setOfferRevision((value) => value + 1);
          setData(null);
        }}
      />

      <div className="flex flex-wrap gap-2">
        {OPTIMIZATION_MODES.map((m) => (
          <button key={m.value} onClick={() => setMode(m.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${mode === m.value ? "border-primary bg-primary/15 text-primary" : "border-white/10 bg-white/[0.03] text-white/50"}`}>
            {m.label}
          </button>
        ))}
      </div>

      <div className="grid gap-2 min-[480px]:grid-cols-[minmax(0,1fr)_auto]">
        <input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="Store, business, place, or address"
          className="min-h-12 w-full min-w-0 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-white/30" />
        <button onClick={optimizeAndLaunchGps} disabled={loading} className="min-h-12 w-full rounded-xl bg-primary px-5 text-sm font-extrabold text-primary-foreground glow-primary disabled:opacity-60 min-[480px]:w-auto">
          {loading ? "OPTIMIZING ROUTE…" : origin.trim() ? "LAUNCH GPS" : "OPTIMIZE + LAUNCH GPS"}
        </button>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}

      {loading && (
        <div className="rounded-3xl border border-white/10 lokin-panel p-4 space-y-3">
          <div className="grid grid-cols-4 gap-2">
            {[0,1,2,3].map((i) => <div key={i} className="h-12 rounded-xl bg-white/8 animate-pulse" />)}
          </div>
          <div className="h-24 rounded-2xl bg-white/[0.06] animate-pulse" />
        </div>
      )}

      {!data && !loading && !error && (
        <div className="rounded-3xl border border-white/10 lokin-panel p-6 text-center">
          <RouteIcon className="h-6 w-6 text-primary mx-auto mb-2" />
          <div className="text-sm text-white/70">Pick a mode and tap <span className="text-primary font-bold">Optimize + Launch GPS</span> to sequence your offers and begin navigation.</div>
        </div>
      )}

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

      {data?.seal && <SealDecisionCard seal={data.seal} />}

      {stops.length > 0 && (
        <div className="rounded-3xl border border-white/10 overflow-hidden lokin-panel">
          <SatelliteRoutePreview stops={stops} compact />
          <Link to="/ai-gps?focus=locked&nav=1&view=real"
            className="w-full flex items-center justify-center gap-2 border-t border-white/10 bg-primary/10 py-3 text-sm font-bold text-primary">
            <Navigation className="h-4 w-4" /> Start LOKIN Navigation
          </Link>
        </div>
      )}

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
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-white/45">{CATEGORY_LABELS[o.category] || o.category}</div>
                    {o.seal && (
                      <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-black ${
                        o.seal.action === "TAKE"
                          ? "border-primary/35 bg-primary/10 text-primary"
                          : "border-amber-400/35 bg-amber-400/10 text-amber-300"
                      }`}>
                        SEAL {o.seal.action} · {o.seal.score}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/55">
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-primary" />{o.miles}mi</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-primary" />{o.est_minutes}m</span>
                    <span className="flex items-center gap-1 text-primary font-semibold"><DollarSign className="h-3 w-3" />{o.rate.netPerHour}/hr</span>
                  </div>
                  <div className="mt-1 text-[11px] flex gap-2 text-white/40">
                    <span>net ${o.rate.net}</span><span>fuel ${o.rate.fuel}</span><span>exp ${o.rate.expenses}</span>
                  </div>
                  <div className="mt-1 text-xs truncate text-white/45"><span className="text-primary">→ </span>{o.dropoff_address}</div>
                  {o.store_hours && (() => {
                    const st = hoursStatus(o.store_hours);
                    return (
                      <div className="mt-1.5 flex items-center gap-1.5 text-xs">
                        <Store className="h-3 w-3 text-accent" />
                        <span className="text-white/55">{st.label}</span>
                        {st.open !== null && (
                          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${st.open ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"}`}>
                            {st.open ? "Open now" : "Closed"}
                          </span>
                        )}
                      </div>
                    );
                  })()}
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