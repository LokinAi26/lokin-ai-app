import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { GitCompareArrows, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { SEEDS } from "@/lib/heatData";

const WEEK_WINDOW = 8;
const ZONE_COLORS = ["#8FE44E", "#22D3EE", "#C8FF3D", "#FF8A00", "#9B5DE5", "#FF3B3B"];

function dayKey(d) { return d.toISOString().slice(0, 10); }

function weekStartOf(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function trendOf(values) {
  const half = Math.max(1, Math.floor(values.length / 2));
  const avg = (rows) => rows.reduce((s, v) => s + v, 0) / rows.length;
  const early = avg(values.slice(0, half));
  const recent = avg(values.slice(half));
  if (early <= 0) return recent > 0 ? "up" : "flat";
  const pct = Math.round(((recent - early) / early) * 100);
  if (Math.abs(pct) < 2) return "flat";
  return pct > 0 ? "up" : "down";
}

// Side-by-side weekly income comparison across the delivery zones the driver
// toggles. Each selected zone gets its own color-coded trend line and a
// summary row (total, average per week, trend direction).
export default function ZoneComparison({ records = [] }) {
  const [zones, setZones] = useState([]);

  const tagged = useMemo(() => records.filter((r) => r.zone && r.amount != null), [records]);

  const zoneOptions = useMemo(() => {
    const fromData = [...new Set(tagged.map((r) => r.zone))];
    return fromData.length > 0 ? fromData.slice(0, 6) : SEEDS.slice(0, 3).map((s) => s.name);
  }, [tagged]);

  // Default comparison set: the top 3 zones by total tagged earnings.
  const defaultZones = useMemo(() => {
    const totals = new Map();
    tagged.forEach((r) => totals.set(r.zone, (totals.get(r.zone) || 0) + (r.amount || 0)));
    return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([z]) => z);
  }, [tagged]);

  const selected = useMemo(() => (zones.length > 0 ? zones : defaultZones), [zones, defaultZones]);

  function toggleZone(zone) {
    setZones((prev) => {
      const current = prev.length > 0 ? prev : defaultZones;
      return current.includes(zone) ? current.filter((z) => z !== zone) : [...current, zone];
    });
  }

  function colorOf(zone) {
    return ZONE_COLORS[Math.max(0, zoneOptions.indexOf(zone)) % ZONE_COLORS.length];
  }

  const weekly = useMemo(() => {
    const start = weekStartOf(new Date());
    const out = [];
    for (let w = WEEK_WINDOW - 1; w >= 0; w -= 1) {
      const from = new Date(start);
      from.setDate(start.getDate() - w * 7);
      const to = new Date(from);
      to.setDate(from.getDate() + 7);
      const row = { label: w === 0 ? "This wk" : `${w}w ago` };
      selected.forEach((z) => {
        row[z] = Math.round(tagged
          .filter((r) => r.zone === z && r.date >= dayKey(from) && r.date < dayKey(to))
          .reduce((s, r) => s + (r.amount || 0), 0) * 100) / 100;
      });
      out.push(row);
    }
    return out;
  }, [tagged, selected]);

  const summaries = useMemo(() => selected.map((z) => {
    const values = weekly.map((row) => row[z] || 0);
    const total = values.reduce((s, v) => s + v, 0);
    return {
      zone: z,
      color: colorOf(z),
      total,
      avg: total / values.length,
      trend: trendOf(values),
    };
  }).sort((a, b) => b.total - a.total), [weekly, selected, zoneOptions]);

  const TrendIcon = { up: TrendingUp, down: TrendingDown, flat: Minus };
  const trendClass = { up: "text-primary", down: "text-amber-300", flat: "text-white/45" };

  return (
    <div className="lokin-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <GitCompareArrows className="h-4 w-4 text-primary" />
        <div className="lokin-kicker lokin-kicker-lime">ZONE COMPARISON</div>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {zoneOptions.map((z) => {
          const active = selected.includes(z);
          return (
            <button
              key={z}
              type="button"
              onClick={() => toggleZone(z)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold ${active ? "text-black" : "border-white/10 bg-white/[0.03] text-white/55"}`}
              style={active ? { background: colorOf(z), borderColor: colorOf(z) } : undefined}
            >
              {z}
            </button>
          );
        })}
      </div>

      {tagged.length === 0 ? (
        <div className="py-6 text-center text-xs text-white/45">Log earnings with a delivery zone to compare zone performance.</div>
      ) : (
        <>
          <div className="h-48 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weekly} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(0 0% 100% / 0.45)" }} axisLine={false} tickLine={false} interval={0} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(0 0% 100% / 0.45)" }} axisLine={false} tickLine={false} width={36} tickFormatter={(v) => `$${v}`} />
                <Tooltip cursor={{ stroke: "hsl(0 0% 100% / 0.2)", strokeWidth: 1 }} contentStyle={{ borderRadius: 12, background: "#0a0a0a", border: "1px solid hsl(0 0% 100% / 0.12)", fontSize: 12, color: "#fff" }} formatter={(v, name) => [`$${Number(v).toFixed(2)}`, name]} />
                {selected.map((z) => (
                  <Line
                    key={z}
                    type="monotone"
                    dataKey={z}
                    stroke={colorOf(z)}
                    strokeWidth={2.5}
                    dot={{ r: 2.5, fill: colorOf(z) }}
                    activeDot={{ r: 4 }}
                    style={{ filter: `drop-shadow(0 0 5px ${colorOf(z)}80)` }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 space-y-1.5">
            {summaries.map((s) => {
              const Icon = TrendIcon[s.trend];
              return (
                <div key={s.zone} className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color, boxShadow: `0 0 8px ${s.color}` }} />
                    <span className="truncate text-xs font-semibold text-white/80">{s.zone}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3 text-[11px]">
                    <span className="font-semibold text-white/85">${s.total.toFixed(0)}</span>
                    <span className="text-white/45">${s.avg.toFixed(0)}/wk</span>
                    <Icon className={`h-3.5 w-3.5 ${trendClass[s.trend]}`} />
                  </span>
                </div>
              );
            })}
            {summaries.length === 0 && (
              <div className="py-2 text-center text-[11px] text-white/45">Toggle zones above to compare their weekly income trends.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}