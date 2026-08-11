import { useEffect, useState } from "react";
import { Route as RouteIcon, MapPin, Clock, DollarSign, ChevronRight, Sparkles } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { CATEGORY_LABELS, OPTIMIZATION_MODES } from "@/lib/deliveryLabels";
import LockInScore from "@/components/LockInScore";

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

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <RouteIcon className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold font-heading">Route Optimizer</h1>
      </div>
      <p className="text-sm text-muted-foreground -mt-2">Pick a mode — LOKIN ranks offers for that goal and sequences them by zone.</p>

      <div className="flex flex-wrap gap-2">
        {OPTIMIZATION_MODES.map((m) => (
          <button key={m.value} onClick={() => setMode(m.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium border ${mode === m.value ? "border-primary bg-primary/15 text-primary" : "border-border bg-muted text-muted-foreground"}`}>
            {m.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="Start address / zip"
          className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm" />
        <button onClick={optimize} disabled={loading} className="rounded-lg bg-primary text-primary-foreground px-4 text-sm font-semibold glow-primary disabled:opacity-60">
          {loading ? "…" : "Optimize"}
        </button>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}

      {data?.stats && (
        <div className="grid grid-cols-4 gap-2 text-center text-xs rounded-2xl border border-border bg-card p-3">
          <Stat label="stops" value={data.stats.stops} />
          <Stat label="miles" value={data.stats.miles} />
          <Stat label="net" value={`$${data.stats.net}`} />
          <Stat label="net/hr" value={`$${data.stats.perHour}`} />
        </div>
      )}

      {data?.stats && (
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-xl border border-border bg-card p-2"><div className="font-bold">${data.stats.gross}</div><div className="text-muted-foreground">gross</div></div>
          <div className="rounded-xl border border-border bg-card p-2"><div className="font-bold">${data.stats.fuel}</div><div className="text-muted-foreground">fuel</div></div>
          <div className="rounded-xl border border-border bg-card p-2"><div className="font-bold">${data.stats.efficiency}</div><div className="text-muted-foreground">net/mi</div></div>
        </div>
      )}

      {data?.lockInScore && <LockInScore score={data.lockInScore} />}

      {data?.briefing && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold mb-2 text-primary">
            <Sparkles className="h-4 w-4" /> AI Strategy ({OPTIMIZATION_MODES.find((m) => m.value === data.mode)?.label})
          </div>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{data.briefing}</p>
        </div>
      )}

      {data?.sequenced?.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-semibold">Optimized Order</div>
          {data.sequenced.map((o, i) => (
            <div key={o.id} className="rounded-2xl border border-border bg-card p-3">
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-sm truncate">{o.merchant}</div>
                    <div className="text-sm font-bold">${o.rate.gross}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">{CATEGORY_LABELS[o.category] || o.category}</div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{o.miles}mi</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{o.est_minutes}m</span>
                    <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{o.rate.netPerHour}/hr</span>
                  </div>
                  <div className="mt-1 text-[11px] flex gap-2 text-muted-foreground">
                    <span>net ${o.rate.net}</span><span>fuel ${o.rate.fuel}</span><span>exp ${o.rate.expenses}</span>
                  </div>
                  <div className="mt-1 text-xs truncate"><span className="text-muted-foreground">→ </span>{o.dropoff_address}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground mt-1" />
              </div>
            </div>
          ))}
        </div>
      )}

      {data && data.sequenced?.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-8">No offers match your filters. Adjust them in More → Work Filters.</div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return <div><div className="font-bold text-base font-display">{value}</div><div className="text-muted-foreground">{label}</div></div>;
}