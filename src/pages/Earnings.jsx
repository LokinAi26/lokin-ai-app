import { useEffect, useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine, Tooltip } from "recharts";
import { Sparkles, TrendingUp, Clock, MapPin, Fuel as FuelIcon, DollarSign } from "lucide-react";
import { base44 } from "@/api/base44Client";
import LockInScore from "@/components/LockInScore";
import PullToRefresh from "@/components/PullToRefresh";

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
  const [score, setScore] = useState(null);

  useEffect(() => {
    Promise.all([
      base44.entities.Earning.filter({}, "date"),
      base44.entities.DriverPreference.filter({}),
    ]).then(([e, p]) => { setRecords(e); setPrefs(p[0] || null); });
  }, []);

  // lightweight Lock In Score for the earnings view
  useEffect(() => {
    let on = true;
    base44.functions.invoke("optimizeRoute", { mode: prefs?.optimization_mode || "most_profit" })
      .then((res) => { if (on) setScore(res.data?.lockInScore || null); })
      .catch(() => {});
    return () => { on = false; };
  }, [prefs?.optimization_mode]);

  async function refresh() {
    const [e, p] = await Promise.all([
      base44.entities.Earning.filter({}, "date"),
      base44.entities.DriverPreference.filter({}),
    ]);
    setRecords(e);
    setPrefs(p[0] || null);
    try {
      const res = await base44.functions.invoke("optimizeRoute", { mode: p[0]?.optimization_mode || "most_profit" });
      setScore(res.data?.lockInScore || null);
    } catch {}
  }

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
  const basePay = filtered.reduce((s, r) => s + (r.base_pay != null ? r.base_pay : (r.tips != null || r.bonuses != null || r.adjustments != null ? 0 : (r.amount || 0))), 0);
  const tipsTotal = filtered.reduce((s, r) => s + (r.tips || 0), 0);
  const bonuses = filtered.reduce((s, r) => s + (r.bonuses || 0), 0);
  const adjustments = filtered.reduce((s, r) => s + (r.adjustments || 0), 0);
  const goalPct = range === "today" ? Math.min(100, Math.round((gross / Math.max(1, dailyGoal)) * 100)) : null;

  const byPlatform = useMemo(() => {
    const m = {};
    for (const r of filtered) m[r.platform || "mixed"] = (m[r.platform || "mixed"] || 0) + (r.amount || 0);
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const chart = useMemo(() => {
    if (range === "today") return [{ label: "Today", value: Math.round(gross * 100) / 100 }];
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
    { icon: TrendingUp, label: "Net", value: `$${net.toFixed(0)}`, accent: true },
    { icon: Clock, label: "Net/hr", value: `$${netPerHour.toFixed(0)}`, accent: true },
    { icon: MapPin, label: "Miles", value: `${miles.toFixed(0)}` },
    { icon: Sparkles, label: "Trips", value: `${trips}` },
  ];

  return (
    <PullToRefresh onRefresh={refresh}>
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold font-heading metal-text">Earnings</h1>
        <p className="text-sm text-white/45">True earning rate — gross, fuel, mileage, net.</p>
      </div>

      <div className="flex rounded-2xl border border-white/10 bg-white/[0.03] p-1 text-sm">
        {RANGES.map((r) => (
          <button key={r.value} onClick={() => setRange(r.value)}
            className={`flex-1 rounded-xl py-1.5 font-medium transition-colors ${range === r.value ? "bg-primary/15 text-primary" : "text-white/50"}`}>
            {r.label}
          </button>
        ))}
      </div>

      <div className="rounded-3xl border border-white/10 lokin-panel radial-fade p-5">
        <div className="text-[11px] uppercase tracking-[0.18em] text-primary/80">EARNINGS</div>
        <div className="text-5xl font-bold font-display text-primary text-glow leading-none mt-1">${gross.toFixed(2)}</div>
        <div className="text-xs text-white/45 mt-2">Gross {RANGES.find((r) => r.value === range)?.label.toLowerCase()} · {trips} trips · {miles.toFixed(0)} mi</div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-white/10 lokin-panel p-3 text-center">
            <s.icon className={`h-4 w-4 mx-auto mb-1 ${s.accent ? "text-primary" : "text-white/40"}`} />
            <div className={`text-lg font-bold font-display ${s.accent ? "text-primary" : "text-white"}`}>{s.value}</div>
            <div className="text-[10px] text-white/40">{s.label}</div>
          </div>
        ))}
      </div>

      {score && <LockInScore score={score} />}

      <div className="rounded-3xl border border-white/10 lokin-panel p-4">
        <div className="text-sm font-semibold text-white/80 mb-2">Daily earnings</div>
        <div className="h-48 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(0 0% 100% / 0.45)" }} axisLine={false} tickLine={false} interval={range === "month" ? 4 : 0} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(0 0% 100% / 0.45)" }} axisLine={false} tickLine={false} width={36} tickFormatter={(v) => `$${v}`} />
              <Tooltip cursor={{ stroke: "hsl(80 100% 50% / 0.4)", strokeWidth: 1 }} contentStyle={{ borderRadius: 12, background: "#0a0a0a", border: "1px solid hsl(0 0% 100% / 0.12)", fontSize: 12, color: "#fff" }} formatter={(v) => [`$${v.toFixed(2)}`, "Earnings"]} />
              {range === "today" && <ReferenceLine y={dailyGoal} stroke="hsl(80 100% 50%)" strokeDasharray="4 4" />}
              <Line type="monotone" dataKey="value" stroke="#AAFF00" strokeWidth={3} dot={{ r: 3, fill: "#AAFF00" }} activeDot={{ r: 5 }} style={{ filter: "drop-shadow(0 0 6px hsl(80 100% 50% / 0.8))" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 lokin-panel p-4">
        <div className="text-sm font-semibold text-white/80 mb-2">Breakdown</div>
        <div className="space-y-1.5">
          {[["Base Pay", basePay], ["Tips", tipsTotal], ["Bonuses", bonuses], ["Adjustments", adjustments]].map(([k, v]) => (
            <div key={k} className="flex justify-between text-sm">
              <span className="text-white/45">{k}</span>
              <span className="text-white font-semibold">${(v || 0).toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-primary/25 bg-primary/[0.06] p-5">
        <div className="text-[11px] uppercase tracking-[0.18em] text-primary/70">Net Earnings</div>
        <div className="text-4xl font-bold font-display text-primary text-glow leading-none mt-1">${net.toFixed(2)}</div>
        <div className="text-xs text-white/45 mt-2">after fuel · ${netPerHour.toFixed(0)}/hr</div>
      </div>

      <div className="rounded-3xl border border-primary/25 bg-primary/[0.06] p-4">
        <div className="flex items-center gap-2 text-sm font-semibold mb-2 text-primary">
          <Sparkles className="h-4 w-4" /> AI Insights
        </div>
        <ul className="space-y-1.5">
          {insights.map((t, i) => (
            <li key={i} className="text-sm flex gap-2 text-white/80"><span className="text-primary">›</span>{t}</li>
          ))}
          {insights.length === 0 && <li className="text-sm text-white/45">No data for this period yet.</li>}
        </ul>
      </div>

      {byPlatform.length > 0 && (
        <div className="rounded-3xl border border-white/10 lokin-panel p-4">
          <div className="text-sm font-semibold text-white/80 mb-2">By platform</div>
          <div className="space-y-2">
            {byPlatform.map(([name, amt]) => (
              <div key={name} className="flex items-center justify-between text-sm">
                <span className="capitalize text-white/70">{name}</span>
                <span className="font-medium text-primary">${amt.toFixed(0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    </PullToRefresh>
  );
}