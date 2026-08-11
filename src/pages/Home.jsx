import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, TrendingUp, Gauge, Fuel as FuelIcon, MapPin, Lock, Play, ChevronRight, Brain } from "lucide-react";
import { base44 } from "@/api/base44Client";
import LockInScore from "@/components/LockInScore";
import WorkModeSheet from "@/components/WorkModeSheet";
import UpcomingShifts from "@/components/UpcomingShifts";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function Home() {
  const [prefs, setPrefs] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showWork, setShowWork] = useState(false);

  async function loadPrefs() {
    const p = await base44.entities.DriverPreference.filter({});
    setPrefs(p[0] || null);
    return p[0] || null;
  }

  async function loadCommand() {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("optimizeRoute", { mode: (await loadPrefs())?.optimization_mode || "most_profit" });
      setData(res.data);
    } catch (e) {
      setData({ error: e.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadCommand(); }, []);

  const dailyGoal = prefs?.daily_goal || 150;
  const today = data?.todayEarnings || 0;
  const remaining = Math.max(0, dailyGoal - today);
  const pct = Math.min(100, Math.round((today / Math.max(1, dailyGoal)) * 100));
  const netPerHour = data?.stats?.perHour || 0;
  const miles = data?.stats?.miles || 0;
  const fuel = data?.stats?.fuel || 0;
  const working = prefs?.work_status === "working";

  return (
    <div className="p-4 space-y-4">
      <div>
        <div className="text-sm text-muted-foreground">{greeting()}.</div>
        <h1 className="text-2xl font-bold font-heading">Command Center</h1>
      </div>

      {/* Earnings + goal */}
      <div className="rounded-2xl border border-border bg-card p-5 brand-grid">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Today&apos;s Earnings</div>
            <div className="text-4xl font-bold font-display text-glow text-primary">${today.toFixed(0)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Goal ${dailyGoal}</div>
            <div className="text-sm font-semibold text-amber-400">${remaining.toFixed(0)} to go</div>
          </div>
        </div>
        <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-primary glow-primary" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1 text-[11px] text-muted-foreground">{pct}% of daily goal</div>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatTile icon={Gauge} label="Net / hour" value={`$${netPerHour.toFixed(0)}`} sub={`target $${prefs?.min_per_hour || 22}`} />
        <StatTile icon={MapPin} label="Miles" value={`${miles.toFixed(0)} mi`} sub="route est." />
        <StatTile icon={FuelIcon} label="Fuel cost" value={`$${fuel.toFixed(2)}`} sub={`@ $${prefs?.gas_price || 3.45}/gal`} />
        <StatTile icon={TrendingUp} label="Status" value={working ? "LOCKED IN" : "Off"} sub={working ? "working" : "tap start"} accent={working} />
      </div>

      {/* Lock In Score */}
      {data?.lockInScore && <LockInScore score={data.lockInScore} />}

      {/* Upcoming Google Calendar shifts */}
      <UpcomingShifts />

      {/* AI recommendation */}
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold mb-2 text-primary">
          <Sparkles className="h-4 w-4" /> What should I do next?
        </div>
        {loading ? (
          <div className="text-sm text-muted-foreground">LOKIN is analyzing your day…</div>
        ) : data?.briefing ? (
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{data.briefing}</p>
        ) : (
          <p className="text-sm text-muted-foreground">{data?.error || "No data yet."}</p>
        )}
      </div>

      {/* Start work */}
      {working ? (
        <Link to="/lokin" className="block rounded-xl border border-accent/40 bg-accent/10 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-accent" />
              <div>
                <div className="text-sm font-semibold">You&apos;re locked in</div>
                <div className="text-xs text-muted-foreground">Open LOKIN AI for hands-free help</div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </Link>
      ) : (
        <button onClick={() => setShowWork(true)}
          className="w-full rounded-xl bg-primary text-primary-foreground font-bold py-4 glow-primary flex items-center justify-center gap-2">
          <Play className="h-5 w-5 fill-current" /> START WORK
        </button>
      )}

      <div className="grid grid-cols-3 gap-3 pt-1">
        <QuickLink to="/route" icon={Sparkles} label="Optimize" />
        <QuickLink to="/earnings" icon={TrendingUp} label="Earnings" />
        <QuickLink to="/more" icon={Lock} label="More" />
      </div>

      <WorkModeSheet open={showWork} onClose={() => setShowWork(false)} prefs={prefs}
        onStarted={() => loadCommand()} />
    </div>
  );
}

function StatTile({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className={`text-xl font-bold mt-1 font-display ${accent ? "text-primary text-glow" : ""}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function QuickLink({ to, icon: Icon, label }) {
  return (
    <Link to={to} className="rounded-xl border border-border bg-card p-3 text-center active:scale-[0.97] transition-transform">
      <Icon className="h-5 w-5 mx-auto text-primary mb-1" />
      <div className="text-xs font-medium">{label}</div>
    </Link>
  );
}