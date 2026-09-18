import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Activity, Banknote, ToggleRight, ClipboardList, Milestone, Power, Settings } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { LOKIN_HEADER_LOCKUP, LOKIN_CENTER, LOKIN_CENTER_PAUSED } from "@/components/Brand";
import { LkIconOnline, LkIconScooter } from "@/components/brand/LkIcons";
import WorkModeSheet from "@/components/WorkModeSheet";
import LockInSequence from "@/components/LockInSequence";
import PullToRefresh from "@/components/PullToRefresh";
import ShiftMileageCard from "@/components/ShiftMileageCard";
import OfferEvaluator from "@/components/OfferEvaluator";
import SessionSummaryModal from "@/components/session/SessionSummaryModal";
import { endShiftTracking, beginShiftTracking, getShiftSnapshot } from "@/lib/shiftMileage";
import { getTtsVolume } from "@/lib/lokinVoicePipeline";
import { createOrQueue } from "@/lib/offlineQueue";
import { loadSessionRouteRecord } from "@/lib/sessionRouteRecord";
import UserTypeSelector from "@/components/UserTypeSelector";
import AwarenessBanner from "@/components/AwarenessBanner";
import HomeSignalIndicator from "@/components/HomeSignalIndicator";
import GoalMilestoneAlerts from "@/components/earnings/GoalMilestoneAlerts";
import ShiftNudgeMonitor from "@/components/ShiftNudgeMonitor";
import { getRoleMeta } from "@/lib/userTypes";
import { guardedInvoke } from "@/lib/creditGuardian";
import { normalizeWorkStatus, sessionStatusLabel } from "@/lib/sessionState";
import { setWorkStatusOptimistic, withPendingWorkStatus } from "@/lib/workStatusStore";

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
  const [todayEarnings, setTodayEarnings] = useState(null);
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showWork, setShowWork] = useState(false);
  const [showOfferEval, setShowOfferEval] = useState(false);
  const [showType, setShowType] = useState(false);
  const [summary, setSummary] = useState(null);
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
    // End GPS mileage tracking for this shift (stops the watch, clears state).
    const snap = endShiftTracking() || { miles: 0, finalMiles: 0, milesSource: "gps", startedAt: null, category: null, path: [], odometerStart: null, odometerEnd: null };
    const optimizedRoute = loadSessionRouteRecord();
    const endedAt = Date.now();
    // Optimistic: the UI flips to off instantly; the preference write syncs in the background.
    setPrefs({ ...prefs, work_status: "off" });
    setWorkStatusOptimistic(prefs, "off", { break_active: false }).then((r) => setPrefs(r.prefs));
    // Earnings logged while the session was live: records created since the shift started.
    let earnings = 0;
    if (snap.startedAt) {
      try {
        const rows = await base44.entities.Earning.filter({}, "-created_date", 50);
        earnings = rows
          .filter((r) => {
            const t = r.created_date ? new Date(r.created_date).getTime() : null;
            return t != null && t >= snap.startedAt && t <= endedAt + 60000;
          })
          .reduce((s, r) => s + (r.amount || 0), 0);
      } catch {
        /* recap still shows with $0 earnings if the read fails */
      }
    }
    // Pre-trip checklist logged at session start — include it in the recap.
    let preTrip = null;
    try {
      const checkRows = await base44.entities.TripCheck.filter({}, "-created_date", 1);
      const rec = checkRows[0];
      if (rec && snap.startedAt && new Date(rec.created_date).getTime() >= snap.startedAt - 60000) {
        preTrip = { passed: rec.passed_count || 0, total: rec.total_count || 0, items: rec.items || [] };
      }
    } catch {
      /* recap still renders without the checklist if the read fails */
    }
    // Persist the tagged session so category profitability can be tracked over time.
    let sessionId = null;
    if (me?.id) {
      // Offline-safe: if Tap Out happens with no signal, the session record
      // is stored locally and syncs automatically once the connection returns.
      try {
        const res = await createOrQueue("DriverSession", {
          user_id: me.id,
          status: "ended",
          category: snap.category || "mixed",
          started_at: new Date(snap.startedAt || endedAt).toISOString(),
          ended_at: new Date(endedAt).toISOString(),
          miles: Math.round((snap.finalMiles || 0) * 100) / 100,
          gps_miles: Math.round((snap.miles || 0) * 100) / 100,
          miles_source: snap.milesSource || "gps",
          odometer_start: snap.odometerStart,
          odometer_end: snap.odometerEnd,
          earnings: Math.round(earnings * 100) / 100,
        });
        sessionId = res && !res.queued ? res.record?.id || null : null;
      } catch {
        /* recap still shows even if the session write fails */
      }
    }
    setSummary({ miles: snap.finalMiles, gpsMiles: snap.miles, milesSource: snap.milesSource, earnings, startedAt: snap.startedAt, endedAt, path: snap.path || [], optimizedRoute, preTrip, category: snap.category || "mixed", sessionId, odometerStart: snap.odometerStart });
  }

  // Recap modal finalized the odometer end reading: recompute authoritative
  // miles and patch the stored DriverSession record.
  async function finalizeShiftOdometer({ odometerEnd, finalMiles }) {
    if (!summary?.sessionId) return;
    try {
      await base44.entities.DriverSession.update(summary.sessionId, {
        miles: Math.round((finalMiles || 0) * 100) / 100,
        miles_source: "odometer",
        odometer_end: odometerEnd,
      });
      setSummary((s) => (s ? { ...s, miles: finalMiles, milesSource: "odometer", odometerEnd } : s));
    } catch {
      /* keep the GPS miles if the patch fails */
    }
  }

  async function resumeWork() {
    if (!prefs?.id) return;
    // Optimistic: resume feels instant; the preference write syncs in the background.
    setPrefs({ ...prefs, work_status: "working" });
    setWorkStatusOptimistic(prefs, "working", { break_active: false }).then((r) => setPrefs(r.prefs));
    // Resume GPS mileage tracking for the shift, pinning the driver
    // presets so they survive app-switching until tap-out.
    const snap = getShiftSnapshot();
    beginShiftTracking({
      category: snap.category || null,
      dailyGoal: prefs?.daily_goal ?? null,
      voiceLevel: getTtsVolume(),
    });
    sessionStorage.removeItem("lokin_app_free_roam");
    navigate("/ai-gps?focus=locked&nav=1&view=real");
  }

  async function loadPrefs() {
    const p = await base44.entities.DriverPreference.filter({});
    let pref = p[0] || null;
    // Never open on a phantom shift: a stale "working" flag (sign-in,
    // force-close, failed tap-out write) with no live shift behind it is
    // reset, so locked-in only ever means a real session is running.
    const st = normalizeWorkStatus(pref?.work_status);
    if (pref?.id && (st === "working" || st === "paused") && !getShiftSnapshot().active) {
      try {
        pref = await base44.entities.DriverPreference.update(pref.id, { work_status: "off", break_active: false });
      } catch {
        pref = { ...pref, work_status: "off" };
      }
    }
    setPrefs(withPendingWorkStatus(pref));
    return pref;
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

  // Real-time goal progress: recompute today's earnings whenever a delivery
  // is logged (or edited), so the progress bar updates without a refresh.
  async function refreshTodayEarnings() {
    try {
      const key = new Date().toISOString().slice(0, 10);
      const rows = await base44.entities.Earning.filter({ date: key });
      setTodayEarnings(rows.reduce((s, r) => s + (r.amount || 0), 0));
    } catch {
      /* keep the last known value */
    }
  }

  useEffect(() => {
    refreshTodayEarnings();
    const unsubscribe = base44.entities.Earning.subscribe(() => refreshTodayEarnings());
    return unsubscribe;
  }, []);

  const dailyGoal = prefs?.daily_goal || 150;
  const today = todayEarnings ?? (data?.todayEarnings || 0);
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
            {working && (
              <span className="flex items-center gap-1 text-[9px] font-bold tracking-[0.14em] text-primary">
                <i className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" style={{ boxShadow: "0 0 6px #7CFC1E" }} /> LIVE
              </span>
            )}
            <Link to="/settings" className="inline-flex items-center gap-1.5 rounded-full border border-primary/50 bg-primary/[0.07] px-3 py-1.5 font-heading text-[10px] font-bold uppercase tracking-[0.08em] text-primary active:scale-95 transition-transform" style={{ boxShadow: "0 0 10px rgba(124,252,30,.35)" }}>
              <Settings className="h-3.5 w-3.5" /> GOAL SETTINGS
            </Link>
          </div>
          <div className="amt">${dailyGoal}</div>
          <div className="track">
            <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg, var(--brand-secondary), var(--brand-lime))", boxShadow: "0 0 14px rgba(124,252,30,.7)", transition: "width .4s ease" }} />
            <span style={{ left: `calc(${pct}% - 8px)` }} />
          </div>
          <div className="row">
            <div className="text-primary"><b>${today.toFixed(2)}</b> earned · <b>{pct}%</b></div>
            <div className="text-white"><b className="text-white">${remaining.toFixed(2)}</b> remaining</div>
          </div>
        </div>
      </div>

      {/* Peak-window alerts are disabled until they can run on real offer
          data — the old time-of-day model used seeded sample zones. */}
      <GoalMilestoneAlerts />
      <ShiftNudgeMonitor workStatus={workStatus} />

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

      <ShiftMileageCard workStatus={workStatus} />

      {/* The lock is the visual center and the single primary action. */}
      {working ? (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-4 text-center">
          <Link to="/ai-gps?focus=locked" className="lokin-card relative z-10 block w-full p-6">
            <div className="font-heading font-black text-xl text-primary uppercase">YOU&apos;RE LOCKED IN</div>
            <div className="text-xs text-white/45 mt-1">Focused AI GPS is ready</div>
          </Link>
          {/* Offer evaluation — snap a delivery offer screen, LOKIN scores it */}
          <button
            onClick={() => setShowOfferEval((s) => !s)}
            aria-expanded={showOfferEval}
            className="relative z-10 w-full rounded-2xl border border-primary/40 bg-primary/[0.07] py-3 flex items-center justify-center gap-2 active:scale-[0.99] transition-transform"
          >
            <ClipboardList className="h-5 w-5 text-primary" strokeWidth={1.8} />
            <span className="font-heading text-sm font-bold uppercase tracking-[0.08em] text-primary">
              {showOfferEval ? "Hide offer check" : "Evaluate offer"}
            </span>
          </button>
          {showOfferEval && (
            <div className="relative z-10 w-full text-left">
              <OfferEvaluator />
            </div>
          )}
          <button onClick={tapOut} className="lk-tile-danger relative z-10 w-full">
            <Power className="h-6 w-6" strokeWidth={1.8} />
            <span>TAP OUT</span>
          </button>
        </div>
      ) : paused ? (
        <div className="w-full flex-1 min-h-0 flex flex-col items-center justify-center relative z-10">
          <button onClick={resumeWork} className="flex-1 min-h-0 w-full flex items-center justify-center bg-background active:scale-[.99] transition-transform" aria-label="Resume work">
            <img src={LOKIN_CENTER_PAUSED} alt="Resume work" draggable="false" className="max-h-full w-auto max-w-full object-contain" />
          </button>
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

      <SessionSummaryModal summary={summary} onClose={() => setSummary(null)} onFinalizeOdometer={finalizeShiftOdometer} />
      <LockInSequence active={locking} onComplete={handleLockInComplete} />
      <WorkModeSheet open={showWork} onClose={() => setShowWork(false)} prefs={prefs} onStarted={() => loadCommand()} />
      <UserTypeSelector open={showType} onClose={() => setShowType(false)} prefs={prefs} onSaved={() => loadCommand()} />
    </div>
    </PullToRefresh>
  );
}