import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, ReferenceLine } from "recharts";
import { TrendingDown, TrendingUp, Trophy } from "lucide-react";

const BRAND = "#8FE44E";
const BRAND_DIM = "hsl(81 84% 51% / 0.35)";
const TOOLTIP = { borderRadius: 12, background: "#0a0a0a", border: "1px solid hsl(0 0% 100% / 0.12)", fontSize: 12, color: "#fff" };
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dayKey(d) { return d.toISOString().slice(0, 10); }

// Last-30-day income trends: daily bars, week-over-week comparison, and the
// most profitable weekday callout so drivers can spot their strongest days.
export default function MonthlyTrends({ records }) {
  const { daily, weeks, bestDay, wow } = useMemo(() => {
    const now = new Date();

    // — Daily totals for the last 30 days
    const daily = [];
    const sums = {};
    const cutoff = new Date(now); cutoff.setDate(now.getDate() - 29);
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now); d.setDate(now.getDate() - i);
      const k = dayKey(d);
      sums[k] = 0;
      daily.push({ key: k, label: d.toLocaleDateString("en-US", { month: "numeric", day: "numeric" }), weekday: d.getDay(), value: 0 });
    }
    for (const r of records) if (sums[r.date] !== undefined) sums[r.date] += r.amount || 0;
    for (const p of daily) p.value = Math.round((sums[p.key] || 0) * 100) / 100;

    // — Calendar weeks (Mon–Sun), latest 5 weeks that overlap the window
    const weeks = [];
    const monday = new Date(now);
    const dow = (now.getDay() + 6) % 7; // Mon=0 … Sun=6
    monday.setDate(now.getDate() - dow);
    for (let w = 4; w >= 0; w--) {
      const start = new Date(monday); start.setDate(monday.getDate() - w * 7);
      const end = new Date(start); end.setDate(start.getDate() + 6);
      const startKey = dayKey(start);
      const endKey = dayKey(end);
      const total = records
        .filter((r) => r.date >= startKey && r.date <= endKey)
        .reduce((s, r) => s + (r.amount || 0), 0);
      const label = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      weeks.push({ label, total: Math.round(total * 100) / 100 });
    }

    // — Week-over-week change (last full/partial week vs the one before)
    const last = weeks[weeks.length - 1]?.total || 0;
    const prev = weeks[weeks.length - 2]?.total || 0;
    const wow = prev > 0 ? Math.round(((last - prev) / prev) * 100) : null;

    // — Average earnings per weekday over the window
    const byWeekday = Array.from({ length: 7 }, () => ({ total: 0, count: 0 }));
    for (const p of daily) {
      if (p.value > 0) {
        byWeekday[p.weekday].total += p.value;
        byWeekday[p.weekday].count += 1;
      }
    }
    const averages = byWeekday.map((b, i) => ({ label: WEEKDAYS[i], avg: b.count ? Math.round((b.total / b.count) * 100) / 100 : 0 }));
    const bestDay = averages.reduce((best, cur, i) => (cur.avg > (averages[best]?.avg || 0) ? i : best), 0);

    return { daily, weeks, bestDay, wow, averages };
  }, [records]);

  const bestAvg = daily.length ? (daily.filter((p) => p.weekday === bestDay).reduce((s, p) => s + p.value, 0) / Math.max(1, daily.filter((p) => p.weekday === bestDay).length)) : 0;

  return (
    <div className="space-y-4">
      <div className="lokin-card p-4">
        <div className="lokin-kicker lokin-kicker-lime mb-1">Last 30 days</div>
        <div className="text-sm text-white/45 mb-3">Daily income trend</div>
        <div className="h-44 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={daily} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: "hsl(0 0% 100% / 0.45)" }} axisLine={false} tickLine={false} interval={4} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(0 0% 100% / 0.45)" }} axisLine={false} tickLine={false} width={36} tickFormatter={(v) => `$${v}`} />
              <Tooltip cursor={{ fill: "hsl(81 84% 51% / 0.08)" }} contentStyle={TOOLTIP} formatter={(v) => [`$${Number(v).toFixed(2)}`, "Earnings"]} />
              <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                {daily.map((p) => (
                  <Cell key={p.key} fill={p.weekday === bestDay ? BRAND : BRAND_DIM} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/[0.06] px-3 py-2">
          <Trophy className="h-4 w-4 shrink-0 text-primary" />
          <div className="text-[11px] leading-tight text-white/70">
            <span className="font-bold text-primary">{WEEKDAYS[bestDay]}</span> is your most profitable day — averaging <span className="font-bold text-primary">${bestAvg.toFixed(2)}</span> over the last month.
          </div>
        </div>
      </div>

      <div className="lokin-card p-4">
        <div className="flex items-center justify-between mb-1">
          <div className="lokin-kicker lokin-kicker-lime">Week-over-week</div>
          {wow !== null && (
            <div className={`flex items-center gap-1 text-xs font-bold ${wow >= 0 ? "text-primary" : "text-lokin-red"}`}>
              {wow >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {wow >= 0 ? "+" : ""}{wow}%
            </div>
          )}
        </div>
        <div className="text-sm text-white/45 mb-3">Total earnings per week (Mon–Sun)</div>
        <div className="h-40 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeks} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(0 0% 100% / 0.45)" }} axisLine={false} tickLine={false} interval={0} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(0 0% 100% / 0.45)" }} axisLine={false} tickLine={false} width={36} tickFormatter={(v) => `$${v}`} />
              <Tooltip cursor={{ fill: "hsl(81 84% 51% / 0.08)" }} contentStyle={TOOLTIP} formatter={(v) => [`$${Number(v).toFixed(2)}`, "Week total"]} />
              <Bar dataKey="total" fill={BRAND} radius={[4, 4, 0, 0]} style={{ filter: "drop-shadow(0 0 6px hsl(81 84% 51% / 0.45))" }} />
              {weeks.length === 5 && <ReferenceLine x={weeks[3].label} stroke="hsl(0 0% 100% / 0.25)" strokeDasharray="4 4" />}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-1 text-[10px] text-white/35">This week is highlighted against last week — the dashed line marks the split.</div>
      </div>
    </div>
  );
}