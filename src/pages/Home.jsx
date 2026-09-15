import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Activity, Banknote, ToggleRight, ClipboardList, Milestone, Power, Settings } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { LOKIN_HEADER_LOCKUP, LOKIN_CENTER } from "@/components/Brand";
import { LkIconOnline, LkIconScooter } from "@/components/brand/LkIcons";
import WorkModeSheet from "@/components/WorkModeSheet";
import LockInSequence from "@/components/LockInSequence";
import PullToRefresh from "@/components/PullToRefresh";
import UserTypeSelector from "@/components/UserTypeSelector";
import AwarenessBanner from "@/components/AwarenessBanner";
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
  const workStatus = normalizeWorkStatus(prefs?.work_status);
  const working = workStatus === "working";
  const paused = workStatus === "paused";
  const role = getRoleMeta(prefs?.user_type);
  const firstName = (me?.full_name?.split(" ")[0]) || role.short;

  const statTiles = [
    { k: "NET/HR", v: `$${netPerHour.toFixed(2)}`, Icon: Banknote },
    { k: "ACTIVE", v: sessionStatusLabel(workStatus), Icon: ToggleRight, accent: true },
    { k: "ORDERS", v: `${data?.stats?.stops ?? 0}`, Icon: ClipboardList },
    { k: "MILES", v: `${miles.toFixed(1)}`, Icon: Milestone },
  ];

  return (
    <PullToRefresh onRefresh={() => loadCommand(true)}>
    <div className="lokin-dashboard relative isolate px-4 pt-3 pb-2 flex flex-col space-y-4 min-h-[calc(100dvh-5.75rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))]">
      {/* Sticky brand header — logo top-left, status pill top-right */}
      <div className="relative z-10 flex items-center justify-between gap-2 pt-1 pb-1 shrink-0">
        <img src={LOKIN_HEADER_LOCKUP} alt="LOKIN AI — Unlock your potential" draggable="false" className="h-12 w-auto object-contain object-left min-w-0" />
        <div className="flex items-center gap-1.5 shrink-0">
          <HomeSignalIndicator />
          <button onClick={() => setShowType(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/[0.04] px-3 py-1.5 font-heading text-[11px] font-bold uppercase tracking-[0.07em] text-white active:scale-95 transition-transform">
            <LkIconScooter className="h-4 w-4" /> {role.short}
          </button>
        </div>
      </div>

      {/* Greeting + goal — wrapped for the right-edge motto column */}
      <div className="relative z-10">
        <div className="flex items-center gap-3 px-1 py-1">
          <div className="h-12 w-12 shrink-0 rounded-full bg-primary flex items-center justify-center text-black font-black text-xl" style={{ boxShadow: "0 0 18px rgba(124,252,30,.45)" }}>{(firstName || "L").charAt(0)}</div>
          <div>
            <div className="text-xs text-white/50">{greeting()},</div>
            <div className="flex items-center gap-1.5">
              <div className="text-3xl font-extrabold text-white leading-tight">{firstName}</div>
              {working && <LkIconOnline className="h-5 w-5 text-primary" />}
            </div>
          </div>
          <span aria-hidden className="ml-auto flex flex-col items-center gap-1 select-none pointer-events-none shrink-0">
            <span className="text-[8px] italic font-black uppercase tracking-[0.16em] text-primary leading-none">Drive</span>
            <span className="text-[8px] italic font-black uppercase tracking-[0.16em] text-primary leading-none">Earn</span>
            <span className="text-[8px] italic font-black uppercase tracking-[0.16em] text-primary leading-none">Level Up</span>
            <span className="h-px w-7 bg-primary/70" />
          </span>
        </div>

        {/* Earnings goal — design-system card, bound to real earnings data */}
        <div className="lk-card-goal w-full max-w-none mt-4">
          <div className="flex items-center justify-between">
            <div className="eyebrow"><Activity className="h-3.5 w-3.5 text-primary" /> TODAY&apos;S GOAL</div>
            <Link to="/settings" className="inline-flex items-center gap-1.5 rounded-full border border-primary/50 bg-primary/[0.07] px-3 py-1.5 font-heading text-[10px] font-bold uppercase tracking-[0.08em] text-primary active:scale-95 transition-transform" style={{ boxShadow: "0 0 10px rgba(124,252,30,.35)" }}>
              <Settings className="h-3.5 w-3.5" /> GOAL SETTINGS
            </Link>
          </div>
          <div className="amt">${dailyGoal}</div>
          <div className="track"><span style={{ left: `calc(${pct}% - 8px)` }} /></div>
          <div className="row">
            <div className="text-primary"><b>${today.toFixed(2)}</b> earned</div>
            <div className="text-white"><b className="text-white">${remaining.toFixed(2)}</b> remaining</div>
          </div>
        </div>
      </div>

      {/* Stat tile grid — design-system compact metrics */}
      <div className="grid grid-cols-4 gap-2 relative z-10 shrink-0">
        {(loading && !data) ? statTiles.map((t) => (
          <div key={t.k} className="lk-card-tile w-full max-w-none items-center p-2 gap-1 text-center">
            <t.Icon className="h-5 w-5 text-white/85" strokeWidth={2} />
            <div className="lbl text-[9px] tracking-[0.06em] whitespace-nowrap">{t.k}</div>
            <div className="val sm"><span className="inline-block h-4 w-12 rounded bg-white/10 animate-pulse" /></div>
          </div>
        )) : statTiles.map(({ k, v, Icon, accent }) => (
          <div key={k} className="lk-card-tile w-full max-w-none items-center p-2 gap-1 text-center">
            <Icon className="h-5 w-5 text-white/85" strokeWidth={2} />
            <div className="lbl text-[9px] tracking-[0.06em] whitespace-nowrap">{k}</div>
            <div className={`val sm${accent ? "" : " text-white"}`}>{v}</div>
          </div>
        ))}
      </div>

      {/* The lock is the visual center and the single primary action. */}
      {working ? (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-4 text-center">
          <Link to="/ai-gps?focus=locked" className="lokin-card relative z-10 block w-full p-6">
            <div className="font-heading font-black text-xl text-primary uppercase">YOU&apos;RE LOCKED IN</div>
            <div className="text-xs text-white/45 mt-1">Focused AI GPS is ready</div>
          </Link>
          <button onClick={tapOut} className="lk-tile-danger relative z-10 w-full">
            <Power className="h-6 w-6" strokeWidth={1.8} />
            <span>TAP OUT</span>
          </button>
        </div>
      ) : paused ? (
        <div className="w-full flex-1 min-h-0 flex flex-col items-center justify-center gap-2 relative z-10">
          <button onClick={resumeWork} className="lk-btn-primary w-full">RESUME <span>»</span></button>
          <div className="lokin-cta-caption">SESSION PAUSED</div>
        </div>
      ) : (
        <div className="w-full flex-1 min-h-0 flex flex-col items-center relative z-10">
          <button onClick={startLockIn} className="flex-1 min-h-0 w-full flex items-center justify-center bg-background active:scale-[.99] transition-transform">
            <img src={LOKIN_CENTER} alt="Start Work" draggable="false" className="max-h-full w-auto max-w-full object-contain" />
          </button>
        </div>
      )}

      {/* LOKIN stands with — awareness dedication, restored 2026-09-13 per Kendall. */}
      <AwarenessBanner />

      <LockInSequence active={locking} onComplete={handleLockInComplete} />
      <WorkModeSheet open={showWork} onClose={() => setShowWork(false)} prefs={prefs} onStarted={() => loadCommand()} />
      <UserTypeSelector open={showType} onClose={() => setShowType(false)} prefs={prefs} onSaved={() => loadCommand()} />
    </div>
    </PullToRefresh>
  );
}