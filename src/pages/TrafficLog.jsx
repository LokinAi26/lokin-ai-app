import { useEffect, useMemo, useState } from "react";
import { Trash2, Timer, ShieldAlert } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { DAY_PART_LABELS } from "@/lib/trafficDelayLog";

export default function TrafficLog() {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    const rows = await base44.entities.TrafficDelay.filter({}, "-created_date", 300);
    setItems(rows || []);
    setLoaded(true);
  }
  useEffect(() => { load(); }, []);

  async function remove(id) {
    const prev = items;
    setItems(items.filter((i) => i.id !== id));
    try {
      await base44.entities.TrafficDelay.delete(id);
    } catch {
      setItems(prev);
    }
  }

  // Avoid pattern: group by area × day part → count + average delay.
  const patterns = useMemo(() => {
    const byArea = new Map();
    for (const i of items) {
      const key = String(i.area || "").toLowerCase().trim();
      if (!key) continue;
      if (!byArea.has(key)) byArea.set(key, { area: i.area, parts: new Map() });
      const entry = byArea.get(key);
      const part = i.day_part || "late_night";
      const agg = entry.parts.get(part) || { count: 0, total: 0 };
      agg.count += 1;
      agg.total += Number(i.delay_minutes) || 0;
      entry.parts.set(part, agg);
    }
    return [...byArea.values()]
      .map((e) => ({
        area: e.area,
        reports: [...e.parts.entries()].map(([day_part, { count, total }]) => ({
          day_part,
          count,
          avg: total / count,
        })),
        totalReports: [...e.parts.values()].reduce((s, p) => s + p.count, 0),
      }))
      .sort((a, b) => b.totalReports - a.totalReports);
  }, [items]);

  return (
    <div className="p-4 space-y-4">
      <div className="lokin-kicker lokin-kicker-lime">TRAFFIC DELAY LOG</div>
      <div className="flex items-center gap-2">
        <Timer className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold font-heading metal-text">Traffic Delays</h1>
      </div>
      <p className="text-sm text-white/45 -mt-2">
        Slowdowns announced during navigation (or reported by voice) are logged automatically. Use the patterns below to know which areas to avoid at which times.
      </p>

      {loaded && items.length === 0 ? (
        <div className="text-sm text-white/45 text-center py-6">
          No delays logged yet. LOKIN records them as you drive — check back after a shift.
        </div>
      ) : null}

      {patterns.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2 text-[11px] tracking-[0.2em] text-primary/70 font-display">
            <ShieldAlert className="h-3.5 w-3.5" /> WHEN TO AVOID
          </div>
          {patterns.map((p) => (
            <div key={p.area} className="rounded-2xl border border-white/10 lokin-panel lokin-card p-3.5">
              <div className="text-sm font-medium text-white">{p.area}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {p.reports.map((r) => (
                  <span
                    key={r.day_part}
                    className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/[0.07] px-2.5 py-1 text-[11px] text-primary"
                  >
                    {DAY_PART_LABELS[r.day_part] || r.day_part}
                    <span className="text-white/55">×{r.count}</span>
                    <span className="font-bold">avg {r.avg.toFixed(0)}m</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {items.length > 0 && (
        <section className="space-y-2">
          <div className="text-[11px] tracking-[0.2em] text-primary/70 font-display">RECENT LOG</div>
          {items.slice(0, 30).map((i) => (
            <div key={i.id} className="flex items-start justify-between rounded-2xl border border-white/10 lokin-panel lokin-card p-3">
              <div>
                <div className="text-sm text-white">{i.area}</div>
                <div className="text-xs text-white/45">
                  {DAY_PART_LABELS[i.day_part] || i.day_part} · {new Date(i.reported_at || i.created_date).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {i.source === "voice_report" ? "voice report" : "auto warning"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-destructive">{Math.round(Number(i.delay_minutes) || 0)}m</span>
                <button onClick={() => remove(i.id)} className="text-destructive p-1" aria-label="Delete entry">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}