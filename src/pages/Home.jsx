import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, TrendingUp, Gauge, Fuel as FuelIcon, MapPin, Play, ChevronRight, Brain, Power, Truck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { LokinGlyph, LokinWordmark } from "@/components/Brand";
import LockInScore from "@/components/LockInScore";
import WorkModeSheet from "@/components/WorkModeSheet";
import UpcomingShifts from "@/components/UpcomingShifts";
import LockInSequence from "@/components/LockInSequence";
import PullToRefresh from "@/components/PullToRefresh";
import UserTypeSelector from "@/components/UserTypeSelector";
import Ticker from "@/components/Ticker";
import AwarenessBanner from "@/components/AwarenessBanner";
import HomeSignalIndicator from "@/components/HomeSignalIndicator";
import { getRoleMeta } from "@/lib/userTypes";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function GoalDial({ pct }) {
  const r = 34;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(100, pct) / 100) * circ;
  return (
    <div className="relative h-20 w-20 shrink-0">
      <svg viewBox="0 0 100 100" className="h-20 w-20 -rotate-90">
        <circle cx="50" cy="50" r={r} stroke="hsl(0 0% 100% / 0.08)" strokeWidth="6" fill="none" />
        <circle cx="50" cy="50" r={r} stroke="hsl(80 100% 50%)" strokeWidth="6" fill="none"
          strokeLinecap="round" strokeDasharray={`${dash} ${circ}`} style={{ filter: "drop-shadow(0 0 5px hsl(80 100% 50% / 0.8))" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-base font-bold font-display text-primary text-glow leading-none">{pct}%</span>
        <span className="text-[8px] uppercase tracking-wider text-white/40">goal</span>
      </div>
    </div>
  );
}

export default function Home() {
  const [prefs, setPrefs] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showWork, setShowWork] = useState(false);
  const [showType, setShowType] = useState(false);
  const [locking, setLocking] = useState(false);
  const lockStartRef = useRef(false);

  function startLockIn() {
    if (lockStartRef.current || locking) return; // prevent double-trigger
    lockStartRef.current = true;
    setLocking(true);
  }
  function handleLockInComplete() {
    setLocking(false);
    lockStartRef.current = false;
    setShowWork(true);
  }

  async function tapOut() {
    if (!prefs?.id) return;
    const updated = await base44.entities.DriverPreference.update(prefs.id, { work_status: "off" });
    setPrefs(updated);
  }

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
  const role = getRoleMeta(prefs?.user_type);

  return (
    <PullToRefresh onRefresh={loadCommand}>
    <div className="p-4 space-y-4">
      {/* Brand header */}
      <div className="flex items-center justify-between pt-1">
        <LokinWordmark size={26} />
        <div className="flex items-center gap-2">
          <HomeSignalIndicator />
          <button onClick={() => setShowType(true)}
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-white/80 active:scale-[0.97] transition-transform">
            <span>{role.emoji}</span> {role.short}
          </button>
        </div>
      </div>
      <div>
        <div className="text-xs text-white/45">{greeting()}.</div>
        <h1 className="text-2xl font-bold font-heading metal-text">{role.homeTitle}</h1>
      </div>

      <Ticker />

      {/* Earnings + goal hero */}
      <div className="rounded-3xl border border-white/10 lokin-panel radial-fade p-5">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Today&apos;s Earnings</div>
            <div className="text-5xl font-bold font-display metal-text leading-none mt-1">${today.toFixed(0)}</div>
          </div>
          <GoalDial pct={pct} />
        </div>
        <div className="mt-3 h-2 rounded-full bg-white/8 overflow-hidden">
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%`, boxShadow: "0 0 10px hsl(80 100% 50% / 0.7)" }} />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px]">
          <span className="text-white/45">Goal ${dailyGoal}</span>
          <span className="font-semibold text-primary">${remaining.toFixed(0)} to go</span>
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatTile icon={Gauge} label="Net / hour" value={`$${netPerHour.toFixed(0)}`} sub={`target $${prefs?.min_per_hour || 22}`} accent />
        <StatTile icon={MapPin} label="Miles" value={`${miles.toFixed(0)} mi`} sub="route est." />
        <StatTile icon={FuelIcon} label="Fuel cost" value={`$${fuel.toFixed(2)}`} sub={`@ $${prefs?.gas_price || 3.45}/gal`} />
        <StatTile icon={TrendingUp} label="Status" value={working ? "LOCKED IN" : "Off"} sub={working ? "working" : "tap start"} accent={working} />
      </div>

      {/* Lock In Score */}
      {data?.lockInScore && <LockInScore score={data.lockInScore} />}

      {/* Upcoming Google Calendar shifts */}
      <UpcomingShifts />

      {/* AI recommendation */}
      <div className="rounded-3xl border border-primary/25 bg-primary/[0.06] p-4">
        <div className="flex items-center gap-2 text-sm font-semibold mb-2 text-primary">
          <Sparkles className="h-4 w-4" /> What should I do next?
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-white/50">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> LOKIN is analyzing your day…
          </div>
        ) : data?.briefing ? (
          <p className="text-sm whitespace-pre-wrap leading-relaxed text-white/80">{data.briefing}</p>
        ) : (
          <p className="text-sm text-white/50">{data?.error || "No data yet."}</p>
        )}
      </div>

      {/* Start work / locked in */}
      {working ? (
        <div className="space-y-3">
          <Link to="/lokin" className="block rounded-3xl border border-accent/40 bg-accent/[0.07] p-6 text-center active:scale-[0.99] transition-transform">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-accent bg-accent/10 glow-cyan">
              <Brain className="h-7 w-7 text-accent" />
            </div>
            <div className="mt-3 font-display text-xl font-extrabold tracking-wider text-accent text-glow-cyan">YOU&apos;RE LOCKED IN.</div>
            <div className="text-xs text-white/50 mt-1">Open LOKIN AI for hands-free help</div>
            <div className="mt-2 inline-flex items-center gap-1 text-xs text-white/50">Tap to continue <ChevronRight className="h-3 w-3" /></div>
          </Link>
          <button onClick={tapOut}
            className="w-full rounded-2xl border border-destructive/50 bg-destructive/[0.08] p-4 flex items-center justify-center gap-2 active:scale-[0.99] transition-transform"
            style={{ boxShadow: "0 0 16px -4px hsl(0 84% 60% / 0.45)" }}>
            <Power className="h-4 w-4 text-destructive" />
            <span className="font-display text-lg font-bold tracking-[0.18em] text-destructive" style={{ textShadow: "0 0 12px hsl(0 84% 60% / 0.55)" }}>TAP OUT</span>
          </button>
        </div>
      ) : (
        <button onClick={startLockIn}
          className="w-full rounded-3xl glow-border lokin-panel radial-fade p-6 text-center active:scale-[0.99] transition-transform">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-primary bg-primary/10 glow-primary">
            <LokinGlyph size={40} />
          </div>
          <div className="mt-3 font-display text-2xl font-extrabold tracking-[0.15em] text-primary text-glow">START WORK</div>
          <div className="text-xs text-white/45 mt-1 tracking-wide">LOCK IN. MAKE MORE.</div>
        </button>
      )}

      <div className="grid grid-cols-4 gap-2.5 pt-1">
        <QuickLink to="/route" icon={Sparkles} label="Optimize" />
        <QuickLink to="/on-the-road" icon={Truck} label="On Road" />
        <QuickLink to="/earnings" icon={TrendingUp} label="Earnings" />
        <QuickLink to="/more" icon={MapPin} label="More" />
      </div>

      <AwarenessBanner />

      <div className="text-center text-[10px] tracking-[0.2em] text-white/30 pt-1 pb-2">
        ONE APP. EVERY MILE. UNLOCK YOUR POTENTIAL.
      </div>

      <LockInSequence active={locking} onComplete={handleLockInComplete} />

      <WorkModeSheet open={showWork} onClose={() => setShowWork(false)} prefs={prefs}
        onStarted={() => loadCommand()} />
      <UserTypeSelector open={showType} onClose={() => setShowType(false)} prefs={prefs}
        onSaved={() => loadCommand()} />
    </div>
    </PullToRefresh>
  );
}

function StatTile({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className="rounded-2xl border border-white/10 lokin-panel p-3.5">
      <div className="flex items-center gap-1.5 text-[11px] text-white/45">
        <Icon className="h-3.5 w-3.5 text-primary" /> {label}
      </div>
      <div className={`text-xl font-bold mt-1 font-display ${accent ? "text-primary text-glow" : "text-white"}`}>{value}</div>
      <div className="text-[11px] text-white/40">{sub}</div>
    </div>
  );
}

function QuickLink({ to, icon: Icon, label }) {
  return (
    <Link to={to} className="rounded-2xl border border-white/10 lokin-panel p-3 text-center active:scale-[0.97] transition-transform">
      <Icon className="h-5 w-5 mx-auto text-primary mb-1" />
      <div className="text-xs font-medium text-white/80">{label}</div>
    </Link>
  );
}