import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Activity, Flame, Banknote, ToggleRight, ClipboardList, Milestone, Settings } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { LokinEmblemImg, LOKIN_HERO_LOCK_V2, LOKIN_HEADER_LOCKUP } from "@/components/Brand";
import WorkModeSheet from "@/components/WorkModeSheet";
import LockInSequence from "@/components/LockInSequence";
import PullToRefresh from "@/components/PullToRefresh";
import UserTypeSelector from "@/components/UserTypeSelector";
import HomeSignalIndicator from "@/components/HomeSignalIndicator";
import { getRoleMeta } from "@/lib/userTypes";
import { guardedInvoke } from "@/lib/creditGuardian";
import { normalizeWorkStatus, sessionStatusLabel } from "@/lib/sessionState";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function Home() {
  const navigate = useNavigate();
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
    const updated = await base44.entities.DriverPreference.update(prefs.id, { work_status: "off", break_active: false });
    setPrefs(updated);
  }

  async function resumeWork() {
    if (!prefs?.id) return;
    const updated = await base44.entities.DriverPreference.update(prefs.id, { work_status: "working", break_active: false });
    setPrefs(updated);
    sessionStorage.removeItem("lokin_app_free_roam");
    navigate("/ai-gps?focus=locked&nav=1&view=real");
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
  const workStatus = normalizeWorkStatus(prefs?.work_status);
  const working = workStatus === "working";
  const paused = workStatus === "paused";
  const role = getRoleMeta(prefs?.user_type);
  const firstName = (me?.full_name?.split(" ")[0]) || role.short;

  return (
    <PullToRefresh onRefresh={() => loadCommand(true)}>
    <div className="lokin-dashboard relative isolate p-4 space-y-4">
      {/* Brand header */}
      <div className="relative z-10 flex items-center gap-2 pt-1 pb-1">
        <img src={LOKIN_HEADER_LOCKUP} alt="LOKIN AI — Unlock your potential" draggable="false" className="h-11 w-auto" />
        <div className="ml-auto flex items-center gap-2">
          <HomeSignalIndicator />
          <button onClick={() => setShowType(true)}
            className="flex items-center gap-1.5 rounded-full border border-lokin-neon/40 bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white/85 glow-primary active:scale-[0.97] transition-transform">
            <span>{role.emoji}</span> {role.short}
          </button>
        </div>
      </div>

      {/* Profile + streak */}
      <div className="relative z-10 flex items-center gap-3 px-1 py-1">
        <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center text-black font-black text-xl" style={{boxShadow:"0 0 18px rgba(162,235,27,.45)"}}>{(firstName || "L").charAt(0)}</div>
        <div>
          <div className="text-xs text-white/45">{greeting()},</div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-2xl font-extrabold text-white font-heading">{firstName}</h1>
            {working && <Flame className="h-4 w-4 text-orange-400" />}
          </div>
        </div>
        <div className="ml-auto text-right text-[9px] font-bold leading-tight tracking-[0.18em] text-primary/80">DRIVE<br />EARN<br />LEVEL UP</div>
      </div>

      {/* Focused driver dashboard — intentionally keeps secondary intelligence off the home screen. */}
      <div className="lokin-card relative z-10 overflow-hidden p-5">
        <div className="flex items-center justify-between">
          <div className="lokin-kicker lokin-kicker-lime flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> TODAY&apos;S GOAL</div>
          <Link to="/settings" className="flex items-center gap-1.5 rounded-full border border-lokin-neon/50 px-3 py-1.5 text-[10px] font-bold tracking-[0.14em] text-white/80"><Settings className="h-3.5 w-3.5 text-white/70" />GOAL SETTINGS</Link>
        </div>
        <div className="lokin-hero-number mt-3 font-display text-6xl">${dailyGoal}</div>
        <div className="lokin-progress-track relative mt-4 h-2.5 overflow-visible">
          <div className="lokin-progress-fill" style={{ width: `${pct}%` }} />
          <div className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-white bg-primary" style={{left:`calc(${pct}% - 8px)`,boxShadow:"0 0 14px #A2EB1B"}} />
        </div>
        <div className="mt-3 flex justify-between text-xs"><span><b className="text-primary">${today.toFixed(2)}</b> <span className="text-white/45">earned</span></span><span><b>${remaining.toFixed(2)}</b> <span className="text-white/45">remaining</span></span></div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {(loading && !data) ? ["NET/HR","ACTIVE","ORDERS","MILES"].map((k) => (
          <div key={k} className="lokin-stat-tile">
            <div className="lokin-kicker">{k}</div>
            <div className="mt-1 h-4 mx-auto w-8 rounded bg-white/10 animate-pulse" />
          </div>
        )) : [["NET/HR", `$${netPerHour.toFixed(2)}`, Banknote], ["ACTIVE", sessionStatusLabel(workStatus), ToggleRight], ["ORDERS", `${data?.stats?.stops ?? 0}`, ClipboardList], ["MILES", `${miles.toFixed(1)}`, Milestone]].map(([k,v,Icon]) => <div key={k} className="lokin-stat-tile"><div className="lokin-kicker flex items-center justify-center gap-1"><Icon className="h-3.5 w-3.5 text-primary" />{k}</div><div className="lokin-stat-value mt-1 text-lg font-black">{v}</div></div>)}
      </div>

      {/* The lock is the visual center and the single primary action. */}
      {working ? (
        <div className="space-y-3 text-center">
          <Link to="/ai-gps?focus=locked" className="lokin-card block p-6"><img src={LOKIN_HERO_LOCK_V2} alt="LOKIN emblem" draggable="false" className="mx-auto h-auto w-[190px]" /><div className="mt-3 font-display text-xl font-black tracking-wider text-primary">YOU&apos;RE LOCKED IN</div><div className="text-xs text-white/45 mt-1">Focused AI GPS is ready</div></Link>
          <button onClick={tapOut} className="w-full rounded-full border border-destructive/50 bg-destructive/[.08] py-3 font-display font-bold tracking-[.18em] text-destructive">TAP OUT</button>
        </div>
      ) : paused ? (
        <button onClick={resumeWork} className="w-full flex flex-col items-center active:scale-[.99] transition-transform">
          <img src={LOKIN_HERO_LOCK_V2} alt="LOKIN emblem" draggable="false" className="h-auto w-[330px] max-w-[88%]" />
          <div className="mt-3 w-[82%] max-w-sm rounded-full bg-primary py-3.5 text-lg font-black tracking-wide text-black glow-primary">RESUME</div>
          <div className="mt-2 text-[10px] tracking-[.18em] text-white/35">SESSION PAUSED</div>
        </button>
      ) : (
        <button onClick={startLockIn} className="w-full flex flex-col items-center active:scale-[.99] transition-transform">
          <img src={LOKIN_HERO_LOCK_V2} alt="LOKIN emblem" draggable="false" className="h-auto w-[330px] max-w-[88%]" />
          <div className="mt-3 w-[82%] max-w-sm"><span className="lokin-cta font-display text-lg tracking-wide">START WORK &raquo;</span></div>
          <div className="lokin-cta-caption">LOCK IN &amp; START EARNING</div>
        </button>
      )}

      <LockInSequence active={locking} onComplete={handleLockInComplete} />
      <WorkModeSheet open={showWork} onClose={() => setShowWork(false)} prefs={prefs} onStarted={() => loadCommand()} />
      <UserTypeSelector open={showType} onClose={() => setShowType(false)} prefs={prefs} onSaved={() => loadCommand()} />
    </div>
    </PullToRefresh>
  );
}