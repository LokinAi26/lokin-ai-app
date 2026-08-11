import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, ReferenceLine, Cell, Tooltip } from "recharts";
import { Sparkles, TrendingUp, Clock, MapPin, Fuel as FuelIcon, DollarSign } from "lucide-react";
import { base44 } from "@/api/base44Client";

const RANGES = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
];

function dayKey(d) { return d.toISOString().slice(0, 10); }

export default function Earnings() {
  const [records, setRecords] = useState([]);
  const [prefs, setPrefs] = useState(null);
  const [range, setRange] = useState("today");

  useEffect(() => {
    Promise.all([
      base44.entities.Earning.filter({}, "date"),
      base44.entities.DriverPreference.filter({}),
    ]).then(([e, p]) => { setRecords(e); setPrefs(p[0] || null); });
  }, []);

  const dailyGoal = prefs?.daily_goal || 150;

  const filtered = useMemo(() => {
    const now = new Date();
    const today = dayKey(now);
    if (range === "today") return records.filter((r) => r.date === today);
    const days = range === "week" ? 7 : 30;
    const cutoff = new Date(now); cutoff.setDate(now.getDate() - (days - 1));
    const ck = dayKey(cutoff);
    return records.filter((r) => r.date >= ck);
  }, [records, range]);

  const gross = filtered.reduce((s, r) => s + (r.amount || 0), 0);
  const miles = filtered.reduce((s, r) => s + (r.miles || 0), 0);
  const trips = filtered.reduce((s, r) => s + (r.trips || 0), 0);
  const fuel = miles > 0 ? (miles / (prefs?.vehicle_mpg || 26)) * (prefs?.gas_price || 3.45) : 0;
  const net = gross - fuel;
  const avgPayout = trips > 0 ? gross / trips : 0;
  const avgTrip = trips > 0 ? miles / trips : 0;
  const hours = trips * 0.4;
  const netPerHour = hours > 0 ? net / hours : 0;
  const goalPct = range === "today" ? Math.min(100, Math.round((gross / Math.max(1, dailyGoal)) * 100)) : null;

  // group by platform
  const byPlatform = useMemo(() => {
    const m = {};
    for (const r of filtered) m[r.platform || "mixed"] = (m[r.platform || "mixed"] || 0) + (r.amount || 0);
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  // chart data: per-day for week/month, single bar for today
  const chart = useMemo(() => {
    if (range === "today") {
      return [{ label: "Today", value: Math.round(gross * 100) / 100 }];
    }
    const days = range === "week" ? 7 : 30;
    const now = new Date();
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now); d.setDate(now.getDate() - i);
      const k = dayKey(d);
      const sum = records.filter((r) => r.date === k).reduce((s, r) => s + (r.amount || 0), 0);
      out.push({ label: d.toLocaleDateString("en-US", { month: "numeric", day: "numeric" }), value: Math.round(sum * 100) / 100 });
    }
    return out;
  }, [records, range, gross]);

  // rule-based AI insights
  const insights = useMemo(() => {
    const out = [];
    if (range === "today" && gross > 0 && goalPct !== null) {
      if (goalPct >= 100) out.push(`You hit your $${dailyGoal} goal today. Lock in the rest as bonus.`);
      else out.push(`You're ${goalPct}% to your $${dailyGoal} goal — $${Math.max(0, dailyGoal - gross).toFixed(0)} to go.`);
    }
    if (byPlatform[0]) out.push(`Your best platform this period is ${byPlatform[0][0]} at $${byPlatform[0][1].toFixed(0)}.`);
    if (netPerHour > 0 && prefs?.min_per_hour) {
      if (netPerHour >= prefs.min_per_hour) out.push(`Your net $${netPerHour.toFixed(0)}/hr beats your $${prefs.min_per_hour} target.`);
      else out.push(`You're under your $${prefs.min_per_hour}/hr target at $${netPerHour.toFixed(0)}/hr net.`);
    }
    if (avgTrip > 0) out.push(`Average trip is ${avgTrip.toFixed(1)} miles for $${avgPayout.toFixed(2)} gross.`);
    return out;
  }, [range, gross, goalPct, byPlatform, netPerHour, avgTrip, avgPayout, prefs, dailyGoal]);

  const stats = [
    { icon: DollarSign, label: "Gross", value: `$${gross.toFixed(0)}` },
    { icon: FuelIcon, label: "Fuel", value: `$${fuel.toFixed(2)}` },
    { icon: TrendingUp, label: "Net", value: `$${net.toFixed(0)}` },
    { icon: Clock, label: "Net/hr", value: `$${netPerHour.toFixed(0)}` },
    { icon: MapPin, label: "Miles", value: `${miles.toFixed(0)}` },
    { icon: Sparkles, label: "Trips", value: `${trips}` },
  ];

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold font-heading">Earnings</h1>
        <p className="text-sm text-muted-foreground">True earning rate — gross, fuel, mileage, net.</p>
      </div>

      <div className="flex rounded-xl bg-muted p-1 text-sm">
        {RANGES.map((r) => (
          <button key={r.value} onClick={() => setRange(r.value)}
            className={`flex-1 rounded-lg py-1.5 font-medium ${range === r.value ? "bg-background shadow-sm text-primary" : "text-muted-foreground"}`}>
            {r.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Net {RANGES.find((r) => r.value === range)?.label}</div>
        <div className="text-4xl font-bold font-display text-primary text-glow">${net.toFixed(0)}</div>
        <div className="text-xs text-muted-foreground">gross ${gross.toFixed(0)} · fuel ${fuel.toFixed(2)}</div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-3 text-center">
            <s.icon className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <div className="text-lg font-bold font-display">{s.value}</div>
            <div className="text-[10px] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="text-sm font-semibold mb-2">Daily earnings</div>
        <div className="h-44 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} interval={range === "month" ? 4 : 0} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={36} tickFormatter={(v) => `$${v}`} />
              <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={{ borderRadius: 10, border: "1px solid hsl(var(--border))", fontSize: 12 }} formatter={(v) => [`$${v.toFixed(2)}`, "Earnings"]} />
              {range === "today" && <ReferenceLine y={dailyGoal} stroke="hsl(var(--primary))" strokeDasharray="4 4" />}
              <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={range === "month" ? 14 : 42}>
                {chart.map((d, i) => (
                  <Cell key={i} fill={d.value >= dailyGoal ? "#34d399" : "hsl(var(--primary))"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold mb-2 text-primary">
          <Sparkles className="h-4 w-4" /> AI Insights
        </div>
        <ul className="space-y-1.5">
          {insights.map((t, i) => (
            <li key={i} className="text-sm flex gap-2"><span className="text-primary">›</span>{t}</li>
          ))}
          {insights.length === 0 && <li className="text-sm text-muted-foreground">No data for this period yet.</li>}
        </ul>
      </div>

      {byPlatform.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-sm font-semibold mb-2">By platform</div>
          <div className="space-y-2">
            {byPlatform.map(([name, amt]) => (
              <div key={name} className="flex items-center justify-between text-sm">
                <span className="capitalize">{name}</span>
                <span className="font-medium">${amt.toFixed(0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}