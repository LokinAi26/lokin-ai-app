import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, Dumbbell, Droplets, Footprints, Moon, Play, Plus, Sparkles, Trophy, ScanLine, TrendingUp } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { summarizeFitnessLearning } from "@/lib/lokinLearningIntelligence";

function Stat({ icon: Icon, label, value, sub }) {
  return <div className="rounded-2xl border border-white/10 lokin-panel p-3"><Icon className="h-4 w-4 text-primary mb-2"/><div className="text-lg font-bold text-white">{value}</div><div className="text-xs text-white/55">{label}</div>{sub && <div className="text-[10px] text-white/30 mt-1">{sub}</div>}</div>;
}

export default function Fitness() {
  const [me, setMe] = useState(null);
  const [profile, setProfile] = useState(null);
  const [daily, setDaily] = useState(null);
  const [activities, setActivities] = useState([]);
  const [signals, setSignals] = useState([]);
  const [busy, setBusy] = useState(false);
  const today = new Date().toISOString().slice(0,10);

  async function load() {
    const user = await base44.auth.me().catch(() => null); setMe(user); if (!user?.id) return;
    const [profiles, logs, acts, learn] = await Promise.all([
      base44.entities.FitnessProfile.filter({ user_id: user.id }).catch(()=>[]),
      base44.entities.FitnessDailyLog.filter({ user_id: user.id, date: today }).catch(()=>[]),
      base44.entities.FitnessActivity.filter({ user_id: user.id }).catch(()=>[]),
      base44.entities.FitnessLearningSignal.filter({ user_id: user.id }).catch(()=>[]),
    ]);
    setProfile(profiles[0] || null); setDaily(logs[0] || null); setActivities(acts); setSignals(learn);
  }
  useEffect(() => { load(); }, []);

  const learning = useMemo(() => summarizeFitnessLearning(signals), [signals]);
  const completedThisWeek = activities.filter(a => a.completed_at).slice(-7).length;
  const water = Number(daily?.water_oz || 0); const waterGoal = Number(profile?.daily_water_oz_target || 80);
  const steps = Number(daily?.steps || 0); const stepGoal = Number(profile?.daily_steps_target || 8000);

  async function ensureProfile() {
    if (profile?.id || !me?.id) return profile;
    const created = await base44.entities.FitnessProfile.create({ user_id: me.id, primary_goal: "driver_wellness", experience_level: "beginner", workout_minutes_target: 20, weekly_workout_target: 4, daily_steps_target: 8000, daily_water_oz_target: 80, fitness_mode_enabled: true, updated_at_client: new Date().toISOString() });
    setProfile(created); return created;
  }
  async function logWater(oz=16) {
    if (!me?.id) return; setBusy(true);
    try { await ensureProfile();
      if (daily?.id) await base44.entities.FitnessDailyLog.update(daily.id, { water_oz: water + oz });
      else await base44.entities.FitnessDailyLog.create({ user_id: me.id, date: today, water_oz: oz, steps: 0, active_minutes: 0, workout_completed: false, driver_breaks: 0 });
      await base44.entities.FitnessLearningSignal.create({ user_id: me.id, signal_type: "hydration_logged", feature: "water", context: "fitness_hub", weight: 1, occurred_at: new Date().toISOString() });
      await load();
    } finally { setBusy(false); }
  }
  async function startDriverReset() {
    if (!me?.id) return; setBusy(true);
    try { await ensureProfile();
      await base44.entities.FitnessActivity.create({ user_id: me.id, activity_type: "driver_break", title: "7-Minute Driver Reset", duration_minutes: 7, intensity: "light", source: "lokin", started_at: new Date().toISOString() });
      await base44.entities.FitnessLearningSignal.create({ user_id: me.id, signal_type: "workout_preferred", feature: "driver_reset", context: "driver_break", weight: 1, occurred_at: new Date().toISOString() });
      await load();
    } finally { setBusy(false); }
  }
  async function completeQuickWorkout() {
    if (!me?.id) return; setBusy(true);
    try { const now = new Date().toISOString(); await ensureProfile();
      await base44.entities.FitnessActivity.create({ user_id: me.id, activity_type: "mobility", title: "LOKIN Quick Mobility", duration_minutes: 10, intensity: "light", source: "lokin", started_at: now, completed_at: now });
      await base44.entities.FitnessLearningSignal.create({ user_id: me.id, signal_type: "workout_completed", feature: "mobility", context: "fitness_hub", weight: 1, occurred_at: now });
      if (daily?.id) await base44.entities.FitnessDailyLog.update(daily.id, { active_minutes: Number(daily.active_minutes || 0) + 10, workout_completed: true });
      else await base44.entities.FitnessDailyLog.create({ user_id: me.id, date: today, active_minutes: 10, water_oz: 0, steps: 0, workout_completed: true, driver_breaks: 0 });
      await load();
    } finally { setBusy(false); }
  }

  return <div className="p-4 space-y-5">
    <div className="rounded-3xl border border-primary/25 bg-primary/[0.06] p-5 overflow-hidden relative">
      <div className="absolute -right-6 -top-8 h-28 w-28 rounded-full bg-primary/10 blur-2xl"/>
      <div className="flex items-center gap-2 text-primary text-xs font-bold tracking-[0.2em]"><Activity className="h-4 w-4"/> LOKIN FITNESS</div>
      <h1 className="text-3xl font-bold font-heading mt-2 metal-text">Move. Recover. Level Up.</h1>
      <p className="text-sm text-white/55 mt-2">Fitness built around real workdays: mobility, strength, hydration, recovery and driver-friendly movement.</p>
    </div>

    <div className="grid grid-cols-2 gap-3">
      <Stat icon={Footprints} label="Steps today" value={steps.toLocaleString()} sub={`${Math.min(100, Math.round(steps/stepGoal*100)||0)}% of ${stepGoal.toLocaleString()}`} />
      <Stat icon={Droplets} label="Water" value={`${water} oz`} sub={`${Math.min(100, Math.round(water/waterGoal*100)||0)}% of ${waterGoal} oz`} />
      <Stat icon={Dumbbell} label="Active minutes" value={daily?.active_minutes || 0} sub="Today" />
      <Stat icon={Trophy} label="Recent sessions" value={completedThisWeek} sub="Momentum" />
    </div>

    <div className="rounded-2xl border border-white/10 lokin-panel p-4">
      <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary"/><div className="font-semibold">LOKIN Coach</div></div>
      <div className="text-sm text-white/60 mt-2">{learning.preferredWorkouts.length ? `Learning your style: ${learning.preferredWorkouts.join(", ")}.` : "Complete a few sessions and LOKIN will begin learning which workouts fit you best."}</div>
      <div className="text-xs text-white/35 mt-1">Completion learning: {learning.completionRate}% · {learning.signalCount} fitness signals</div>
    </div>

    <Link to="/fitness/form-guide" className="block rounded-3xl border border-primary/30 bg-primary/[0.07] p-5 active:scale-[0.99] transition-transform">
      <div className="flex items-center justify-between"><div><div className="flex items-center gap-2 text-primary text-xs font-bold tracking-[.16em]"><ScanLine className="h-4 w-4"/> FORM GUIDE INTELLIGENCE</div><div className="text-xl font-bold mt-2">Maximize the quality of every rep.</div><div className="text-xs text-white/50 mt-1">Technique cues + learning intelligence + work/fitness balance.</div></div><TrendingUp className="h-7 w-7 text-primary shrink-0 ml-3"/></div>
    </Link>

    <div className="grid grid-cols-2 gap-3">
      <button disabled={busy} onClick={startDriverReset} className="rounded-2xl border border-primary/25 bg-primary/[0.06] p-4 text-left active:scale-[0.98]"><Play className="h-5 w-5 text-primary mb-2"/><div className="font-semibold text-sm">7-Min Driver Reset</div><div className="text-xs text-white/45 mt-1">Neck, hips, back & circulation</div></button>
      <button disabled={busy} onClick={completeQuickWorkout} className="rounded-2xl border border-white/10 lokin-panel p-4 text-left active:scale-[0.98]"><Dumbbell className="h-5 w-5 text-accent mb-2"/><div className="font-semibold text-sm">Quick Mobility</div><div className="text-xs text-white/45 mt-1">10-minute level-up session</div></button>
      <button disabled={busy} onClick={() => logWater(16)} className="rounded-2xl border border-white/10 lokin-panel p-4 text-left active:scale-[0.98]"><Plus className="h-5 w-5 text-accent mb-2"/><div className="font-semibold text-sm">+16 oz Water</div><div className="text-xs text-white/45 mt-1">Log hydration fast</div></button>
      <div className="rounded-2xl border border-white/10 lokin-panel p-4"><Moon className="h-5 w-5 text-white/60 mb-2"/><div className="font-semibold text-sm">Recovery</div><div className="text-xs text-white/45 mt-1">Sleep: {daily?.sleep_hours || "—"} h · Energy: {daily?.energy_level || "—"}</div></div>
    </div>

    <div className="rounded-2xl border border-white/10 lokin-panel p-4">
      <div className="text-xs tracking-[0.18em] text-white/40">FITNESS PROFILE</div>
      <div className="mt-2 flex items-center justify-between"><span className="text-sm text-white/70">Primary goal</span><span className="text-sm font-semibold text-primary">{(profile?.primary_goal || "driver_wellness").replaceAll("_"," ")}</span></div>
      <div className="mt-2 flex items-center justify-between"><span className="text-sm text-white/70">Weekly target</span><span className="text-sm text-white">{profile?.weekly_workout_target || 4} workouts</span></div>
      {!profile && <button onClick={ensureProfile} className="mt-3 w-full rounded-xl border border-primary/30 bg-primary/10 py-2 text-sm font-semibold text-primary">Activate LOKIN Fitness</button>}
    </div>

    <div className="text-[10px] text-white/30 text-center px-4">LOKIN Fitness supports general fitness and wellness. It does not diagnose or treat medical conditions.</div>
  </div>;
}
