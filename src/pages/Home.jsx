import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, Gauge, Fuel as FuelIcon, MapPin, ChevronRight, Brain, Power, Truck, TrendingUp, Radar, SlidersHorizontal, ScanLine, BarChart3, Package, Activity, Flame } from "lucide-react";
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
import { guardedInvoke } from "@/lib/creditGuardian";

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

  async function loadCommand(force = false) {
    setLoading(true);
    try {
      const res = await guardedInvoke(base44, "optimizeRoute", { mode: (await loadPrefs())?.optimization_mode || "most_profit" }, { force, userInitiated: force });
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
    <PullToRefresh onRefresh={() => loadCommand(true)}>
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
      <div className="flex items-center gap-2.5">
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center text-black font-bold">{(firstName || "L").charAt(0)}</div>
        <div>
          <div className="text-xs text-white/45">{greeting()},</div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-xl font-bold font-heading metal-text">{firstName}</h1>
            {working && <Flame className="h-4 w-4 text-orange-400" />}
          </div>
        </div>
      </div>

      {/* Focused driver dashboard — intentionally keeps secondary intelligence off the home screen. */}
      <div className="rounded-3xl border border-white/10 lokin-panel radial-fade p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-white/55"><Activity className="h-4 w-4 text-primary" /> Today&apos;s Goal</div>
          <Link to="/settings" className="text-[10px] rounded-full border border-white/10 px-3 py-1.5 text-white/55">GOAL SETTINGS</Link>
        </div>
        <div className="mt-2 text-5xl font-extrabold font-display text-primary text-glow">${dailyGoal}</div>
        <div className="relative mt-4 h-2.5 rounded-full bg-white/10 overflow-visible">
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%`, boxShadow: "0 0 14px hsl(80 100% 50% / .8)" }} />
          <div className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-white bg-primary" style={{left:`calc(${pct}% - 8px)`,boxShadow:"0 0 14px #baff00"}} />
        </div>
        <div className="mt-3 flex justify-between text-xs"><span><b className="text-primary">${today.toFixed(2)}</b> <span className="text-white/45">earned</span></span><span><b>${remaining.toFixed(2)}</b> <span className="text-white/45">remaining</span></span></div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {[["NET/HR", `$${netPerHour.toFixed(2)}`], ["ACTIVE", working ? "ON" : "OFF"], ["ORDERS", `${data?.stats?.stops ?? 0}`], ["MILES", `${miles.toFixed(1)}`]].map(([k,v]) => <div key={k} className="rounded-2xl border border-white/10 bg-white/[.025] py-3 px-1 text-center"><div className="text-[9px] text-white/45">{k}</div><div className="mt-1 text-sm sm:text-base font-bold text-primary">{v}</div></div>)}
      </div>

      {/* The lock is the visual center and the single primary action. */}
      {working ? (
        <div className="space-y-3 text-center">
          <Link to="/ai-gps?focus=locked" className="block rounded-3xl border border-primary/35 bg-primary/[.06] p-6 glow-primary"><LokinGlyph size={86} className="mx-auto lokin-pulse"/><div className="mt-3 font-display text-xl font-black tracking-wider text-primary">YOU&apos;RE LOCKED IN</div><div className="text-xs text-white/45 mt-1">Focused AI GPS is ready</div></Link>
          <button onClick={tapOut} className="w-full rounded-full border border-destructive/50 bg-destructive/[.08] py-3 font-display font-bold tracking-[.18em] text-destructive">TAP OUT</button>
        </div>
      ) : (
        <button onClick={startLockIn} className="w-full flex flex-col items-center active:scale-[.99] transition-transform">
          <div className="relative flex h-44 w-44 items-center justify-center rounded-full border border-primary/20" style={{background:"radial-gradient(circle,rgba(180,255,0,.13),transparent 64%)",boxShadow:"0 0 42px rgba(170,255,0,.12)"}}><LokinGlyph size={112} className="lokin-pulse"/></div>
          <div className="-mt-1 w-[82%] max-w-sm rounded-full bg-primary py-3.5 text-lg font-black tracking-wide text-black glow-primary">START WORK</div>
          <div className="mt-2 text-[10px] tracking-[.18em] text-white/35">LOCK IN &amp; START EARNING</div>
        </button>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between px-1"><span className="lokin-kicker">PERFORMANCE ECOSYSTEM</span><span className="text-[9px] text-white/30">ONE SYSTEM</span></div>
        <div className="grid grid-cols-4 gap-2">
          <QuickLink to="/categories" icon={Package} label="Earn" />
          <QuickLink to="/fitness" icon={Activity} label="Train" />
          <QuickLink to="/safety" icon={Radar} label="Protect" />
          <QuickLink to="/more" icon={SlidersHorizontal} label="More" />
        </div>
      </div>

      <Link to="/lokin" className="flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/[.045] p-3.5 active:scale-[.99] transition-transform">
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-primary/50 bg-primary/10 glow-primary"><Brain className="h-5 w-5 text-primary"/></div>
        <div className="min-w-0 flex-1"><div className="text-xs font-bold">LOKIN AI <span className="text-primary">COPILOT</span></div><div className="text-[11px] text-white/45">Your AI copilot is ready.</div></div>
        <div className="rounded-full border border-white/10 px-3 py-2 text-[10px] text-white/70">TAP TO TALK</div>
      </Link>

      <div className="rounded-2xl border border-white/8 bg-white/[.02] p-3 flex items-center justify-between gap-3">
        <div className="text-[11px] text-white/45">AI recommendation</div>
        <div className="text-xs text-right text-white/75 line-clamp-2">{loading ? "LOKIN is analyzing your day…" : (data?.briefing || "Ready when you are.")}</div>
      </div>

      <AwarenessBanner />

      <div className="text-center text-[10px] tracking-[0.2em] text-white/30 pt-1 pb-2">
        DRIVE SAFER. WORK SMARTER. LIVE SIMPLER.
      </div>

      <LockInSequence active={locking} onComplete={handleLockInComplete} />
      <WorkModeSheet open={showWork} onClose={() => setShowWork(false)} prefs={prefs} onStarted={() => loadCommand()} />
      <UserTypeSelector open={showType} onClose={() => setShowType(false)} prefs={prefs} onSaved={() => loadCommand()} />
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

function CommandCard({ to, icon: Icon, title, desc }) {
  return (
    <Link to={to} className="rounded-2xl border border-white/10 bg-black/25 p-3 active:scale-[0.98] active:border-primary/40 transition-all">
      <Icon className="h-4 w-4 text-primary mb-2" />
      <div className="text-xs font-bold text-white leading-tight">{title}</div>
      <div className="text-[10px] text-white/40 mt-1 leading-tight">{desc}</div>
    </Link>
  );
}