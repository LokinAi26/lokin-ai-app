import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, Gauge, Fuel as FuelIcon, MapPin, ChevronRight, Brain, Power, Truck, TrendingUp } from "lucide-react";
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

export default function Home() {
  const [prefs, setPrefs] = useState(null);
  const [data, setData] = useState(null);
  const [me, setMe] = useState(null);
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

  useEffect(() => {
    loadCommand();
    base44.auth.me().then(setMe).catch(() => {});
  }, []);

  const dailyGoal = prefs?.daily_goal || 150;
  const today = data?.todayEarnings || 0;
  const remaining = Math.max(0, dailyGoal - today);
  const pct = Math.min(100, Math.round((today / Math.max(1, dailyGoal)) * 100));
  const netPerHour = data?.stats?.perHour || 0;
  const miles = data?.stats?.miles || 0;
  const fuel = data?.stats?.fuel || 0;
  const working = prefs?.work_status === "working";
  const role = getRoleMeta(prefs?.user_type);
  const firstName = (me?.full_name?.split(" ")[0]) || role.short;

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

      {/* Profile + streak */}
      <div>
        <div className="text-xs text-white/45">{greeting()},</div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold font-heading metal-text">{firstName}</h1>
          {working && <span className="text-lg leading-none" title="Locked-in streak">🔥</span>}
        </div>
      </div>

      <Ticker />

      {/* Today's Goal hero — linear progress to match the design target */}
      <div className="rounded-3xl border border-white/10 lokin-panel radial-fade p-5">
        <div className="flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Today&apos;s Goal</div>
          <div className="text-sm font-bold text-primary">${dailyGoal}</div>
        </div>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <div className="text-5xl font-bold font-display metal-text leading-none">${today.toFixed(2)}</div>
            <div className="text-[11px] text-white/45 mt-1">earned</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary text-glow leading-none">${remaining.toFixed(2)}</div>
            <div className="text-[11px] text-white/45 mt-1">remaining</div>
          </div>
        </div>
        <div className="mt-3 h-2.5 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%`, boxShadow: "0 0 10px hsl(80 100% 50% / 0.7)" }} />
        </div>
        <div className="mt-1.5 text-right text-[11px] text-white/40">{pct}% of goal</div>
      </div>

      {/* Stat row — Net/hr · Miles · Fuel */}
      <div className="grid grid-cols-3 gap-3">
        <StatTile icon={Gauge} label="Net / hr" value={`$${netPerHour.toFixed(0)}`} accent />
        <StatTile icon={MapPin} label="Miles" value={`${miles.toFixed(0)}`} />
        <StatTile icon={FuelIcon} label="Fuel" value={`$${fuel.toFixed(2)}`} />
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
        ONE APP. EVERY GIG. MAXIMUM EARNINGS.
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

function StatTile({ icon: Icon, label, value, accent }) {
  return (
    <div className="rounded-2xl border border-white/10 lokin-panel p-3.5">
      <div className="flex items-center gap-1.5 text-[11px] text-white/45">
        <Icon className="h-3.5 w-3.5 text-primary" /> {label}
      </div>
      <div className={`text-xl font-bold mt-1 font-display ${accent ? "text-primary text-glow" : "text-white"}`}>{value}</div>
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