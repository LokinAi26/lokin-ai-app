import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, ReferenceLine, Cell, Tooltip } from "recharts";
import { Target, TrendingUp } from "lucide-react";
import { base44 } from "@/api/base44Client";

function fmtDate(d) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function dayKey(d) {
  return d.toISOString().slice(0, 10);
}

export default function EarningsDashboard() {
  const [records, setRecords] = useState([]);
  const [prefs, setPrefs] = useState(null);
  const [view, setView] = useState("daily"); // daily | weekly

  async function load() {
    const [e, p] = await Promise.all([
      base44.entities.Earning.filter({}, "date"),
      base44.entities.DriverPreference.filter({}),
    ]);
    setRecords(e);
    setPrefs(p[0] || null);
  }
  useEffect(() => { load(); }, []);

  const dailyGoal = prefs?.daily_goal ?? 150;
  const weeklyGoal = prefs?.weekly_goal ?? 850;

  // Build last 7 days (daily) or last 4 weeks (weekly) buckets
  const chartData = useMemo(() => {
    const byDate = {};
    for (const r of records) {
      byDate[r.date] = (byDate[r.date] || 0) + (r.amount || 0);
    }
    const today = new Date();
    if (view === "daily") {
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const k = dayKey(d);
        days.push({ label: fmtDate(d), value: byDate[k] || 0, key: k });
      }
      return days;
    } else {
      // weekly buckets, 4 weeks
      const weeks = [];
      for (let w = 3; w >= 0; w--) {
        let sum = 0;
        for (let i = 0; i < 7; i++) {
          const d = new Date(today);
          d.setDate(today.getDate() - (w * 7 + i));
          sum += byDate[dayKey(d)] || 0;
        }
        const start = new Date(today);
        start.setDate(today.getDate() - (w * 7 + 6));
        weeks.push({ label: w === 0 ? "This wk" : `${w}w ago`, value: Math.round(sum * 100) / 100 });
      }
      return weeks;
    }
  }, [records, view]);

  const total = chartData.reduce((s, d) => s + d.value, 0);
  const goal = view === "daily" ? dailyGoal : weeklyGoal;
  const pct = goal > 0 ? Math.min(100, Math.round((total / goal) * 100)) : 0;
  const hitting = total >= goal;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <div className="text-sm font-semibold">Earnings Dashboard</div>
        </div>
        <div className="flex rounded-lg bg-muted p-0.5 text-xs">
          <button
            onClick={() => setView("daily")}
            className={`px-2.5 py-1 rounded-md font-medium ${view === "daily" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
          >
            Daily
          </button>
          <button
            onClick={() => setView("weekly")}
            className={`px-2.5 py-1 rounded-md font-medium ${view === "weekly" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
          >
            Weekly
          </button>
        </div>
      </div>

      <div className="flex items-end justify-between mb-1">
        <div>
          <div className="text-2xl font-bold">${total.toFixed(0)}</div>
          <div className="text-xs text-muted-foreground">{view === "daily" ? "last 7 days" : "last 4 weeks"}</div>
        </div>
        <div className={`text-right ${hitting ? "text-emerald-600" : "text-amber-600"}`}>
          <div className="flex items-center gap-1 text-sm font-semibold justify-end">
            <TrendingUp className="h-3.5 w-3.5" />
            {pct}%
          </div>
          <div className="text-xs text-muted-foreground">of ${goal} goal</div>
        </div>
      </div>

      <div className="h-40 -mx-2 mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} interval={0} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={36} tickFormatter={(v) => `$${v}`} />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted))" }}
              contentStyle={{ borderRadius: 10, border: "1px solid hsl(var(--border))", fontSize: 12, padding: "6px 10px" }}
              formatter={(v) => [`$${v.toFixed(2)}`, "Earnings"]}
            />
            <ReferenceLine y={view === "daily" ? dailyGoal : weeklyGoal / 4} stroke="hsl(var(--primary))" strokeDasharray="4 4" strokeWidth={1.5} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={42}>
              {chartData.map((d, i) => (
                <Cell
                  key={i}
                  fill={
                    view === "daily"
                      ? (d.value >= dailyGoal ? "hsl(142 71% 45%)" : "hsl(var(--primary))")
                      : (d.value >= weeklyGoal / 4 ? "hsl(142 71% 45%)" : "hsl(var(--primary))")
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
        <span>Dashed line = {view === "daily" ? "daily" : "weekly"} goal</span>
        <span className={hitting ? "text-emerald-600 font-medium" : "text-amber-600 font-medium"}>
          {hitting ? "Goal hit ✓" : `$${(goal - total).toFixed(0)} to go`}
        </span>
      </div>
    </div>
  );
}