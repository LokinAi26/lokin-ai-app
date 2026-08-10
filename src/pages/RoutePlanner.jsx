import { useState } from "react";
import { Route as RouteIcon, MapPin, Clock, DollarSign, Sparkles, ChevronRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { CATEGORY_LABELS } from "@/lib/deliveryLabels";

export default function RoutePlanner() {
  const [origin, setOrigin] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  async function optimize() {
    setLoading(true);
    setError("");
    setData(null);
    try {
      const res = await base44.functions.invoke("optimizeRoute", { originAddress: origin });
      setData(res.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <RouteIcon className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold font-heading">AI Route Optimizer</h1>
      </div>
      <p className="text-sm text-muted-foreground -mt-2">
        Orders are ranked by net $/hr, then sequenced by zip code & address so you drive one line, not a zig-zag.
      </p>

      <div className="flex gap-2">
        <input
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
          placeholder="Start address / zip"
          className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"
        />
        <button
          onClick={optimize}
          disabled={loading}
          className="rounded-lg bg-primary text-primary-foreground px-4 text-sm font-semibold disabled:opacity-60"
        >
          {loading ? "…" : "Optimize"}
        </button>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}

      {data?.stats && (
        <div className="grid grid-cols-4 gap-2 text-center text-xs rounded-xl border border-border bg-card p-3">
          <div><div className="font-bold text-base">{data.stats.stops}</div><div className="text-muted-foreground">stops</div></div>
          <div><div className="font-bold text-base">{data.stats.miles}</div><div className="text-muted-foreground">miles</div></div>
          <div><div className="font-bold text-base">${data.stats.net}</div><div className="text-muted-foreground">net</div></div>
          <div><div className="font-bold text-base">${data.stats.perHour}</div><div className="text-muted-foreground">/hr</div></div>
        </div>
      )}

      {data?.briefing && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold mb-2 text-primary">
            <Sparkles className="h-4 w-4" /> AI Strategy Advisor
          </div>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{data.briefing}</p>
        </div>
      )}

      {data?.sequenced?.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-semibold">Optimized Order</div>
          {data.sequenced.map((o, i) => (
            <div key={o.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-sm truncate">{o.merchant}</div>
                    <div className="text-sm font-bold">${(o.payout + (o.tip || 0)).toFixed(2)}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">{CATEGORY_LABELS[o.category] || o.category}</div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{o.miles}mi</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{o.est_minutes}m</span>
                    <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{o.score.perHour}/hr</span>
                  </div>
                  <div className="mt-1 text-xs truncate">
                    <span className="text-muted-foreground">→ </span>{o.dropoff_address}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground mt-1" />
              </div>
            </div>
          ))}
        </div>
      )}

      {data && data.sequenced?.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-8">
          No offers match your filters. Adjust them in the Filters tab.
        </div>
      )}
    </div>
  );
}