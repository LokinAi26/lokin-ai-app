import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";

const WEEK_WINDOW = 8;

function dayKey(d) { return d.toISOString().slice(0, 10); }

function weekStartOf(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

// Weekly income trend filtered by the delivery zones the driver chooses.
// Empty selection = all earnings; specific zones = only earnings tagged
// with one of the selected zones.
export default function WeeklyZoneTrend({ records = [] }) {
  const [zones, setZones] = useState([]);

  const zoneOptions = useMemo(() => {
    const tagged = records.map((r) => r.zone).filter(Boolean);
    return [...new Set(tagged)];
  }, [records]);

  function toggleZone(zone) {
    setZones((prev) => (prev.includes(zone) ? prev.filter((z) => z !== zone) : [...prev, zone]));
  }

  const weekly = useMemo(() => {
    const selected = records.filter((r) => zones.length === 0 || zones.includes(r.zone));
    const start = weekStartOf(new Date());
    const out = [];
    for (let w = WEEK_WINDOW - 1; w >= 0; w -= 1) {
      const from = new Date(start);
      from.setDate(start.getDate() - w * 7);
      const to = new Date(from);
      to.setDate(from.getDate() + 7);
      const sum = selected
        .filter((r) => r.date >= dayKey(from) && r.date < dayKey(to))
        .reduce((s, r) => s + (r.amount || 0), 0);
      out.push({ label: w === 0 ? "This wk" : `${w}w ago`, value: Math.round(sum * 100) / 100 });
    }
    return out;
  }, [records, zones]);

  // Trend: average weekly income of the recent half vs the earlier half.
  const trend = useMemo(() => {
    const half = Math.max(1, Math.floor(weekly.length / 2));
    const avg = (rows) => rows.reduce((s, r) => s + r.value, 0) / rows.length;
    const early = avg(weekly.slice(0, half));
    const recent = avg(weekly.slice(half));
    if (early <= 0) return { dir: recent > 0 ? "up" : "flat", pct: null };
    const pct = Math.round(((recent - early) / early) * 100);
    if (Math.abs(pct) < 2) return { dir: "flat", pct };
    return { dir: pct > 0 ? "up" : "down", pct: Math.abs(pct) };
  }, [weekly]);

  const TrendIcon = trend.dir === "up" ? TrendingUp : trend.dir === "down" ? TrendingDown : Minus;
  const trendColor = trend.dir === "up" ? "text-primary" : trend.dir === "down" ? "text-amber-300" : "text-white/45";
  const trendText = trend.dir === "flat"
    ? "Flat"
    : `Trending ${trend.dir}${trend.pct != null ? ` ${trend.pct}%` : ""}`;

  return (
    <div className="lokin-card p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="lokin-kicker lokin-kicker-lime">WEEKLY INCOME TREND</div>
          <div className="text-[10px] text-white/40 mt-1">
            {zones.length === 0 ? "All zones" : `${zones.length} zone${zones.length > 1 ? "s" : ""} selected`} · last {WEEK_WINDOW} weeks
          </div>
        </div>
        <div className={`flex shrink-0 items-center gap-1.5 text-xs font-bold ${trendColor}`}>
          <TrendIcon className="h-4 w-4" /> {trendText}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setZones([])}
          className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold ${zones.length === 0 ? "border-primary bg-primary/15 text-primary" : "border-white/10 bg-white/[0.03] text-white/55"}`}
        >
          All zones
        </button>
        {zoneOptions.map((z) => (
          <button
            key={z}
            type="button"
            onClick={() => toggleZone(z)}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold ${zones.includes(z) ? "border-primary bg-primary/15 text-primary" : "border-white/10 bg-white/[0.03] text-white/55"}`}
          >
            {z}
          </button>
        ))}
      </div>

      {records.length === 0 ? (
        <div className="py-6 text-center text-xs text-white/45">Log earnings with a delivery zone to see the weekly trend.</div>
      ) : (
        <div className="h-48 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weekly} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(0 0% 100% / 0.45)" }} axisLine={false} tickLine={false} interval={0} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(0 0% 100% / 0.45)" }} axisLine={false} tickLine={false} width={36} tickFormatter={(v) => `$${v}`} />
              <Tooltip cursor={{ stroke: "hsl(81 84% 51% / 0.4)", strokeWidth: 1 }} contentStyle={{ borderRadius: 12, background: "#0a0a0a", border: "1px solid hsl(0 0% 100% / 0.12)", fontSize: 12, color: "#fff" }} formatter={(v) => [`$${Number(v).toFixed(2)}`, "Weekly income"]} />
              <Line type="monotone" dataKey="value" stroke="#8FE44E" strokeWidth={3} dot={{ r: 3, fill: "#8FE44E" }} activeDot={{ r: 5 }} style={{ filter: "drop-shadow(0 0 6px hsl(81 84% 51% / 0.8))" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}