import { useEffect, useMemo, useState } from "react";
import { BatteryCharging, Bolt, BrainCircuit, Gauge, Leaf, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { summarizeDriverLearning } from "@/lib/lokinLearningIntelligence";

const MODES = [
  { key: "adaptive", title: "Adaptive AI", desc: "Balances speed and battery automatically", icon: BrainCircuit },
  { key: "performance", title: "Peak Performance", desc: "Maximum responsiveness while plugged in or when speed matters", icon: Zap },
  { key: "balanced", title: "Balanced", desc: "Strong performance with moderate background activity", icon: Gauge },
  { key: "battery_saver", title: "Battery Saver", desc: "Cuts nonessential refresh and visual work", icon: Leaf },
];

export default function PerformanceCenter() {
  const [profile, setProfile] = useState(null);
  const [events, setEvents] = useState([]);
  const [legacySignals, setLegacySignals] = useState([]);
  const [v2Signals, setV2Signals] = useState([]);
  const [runtime, setRuntime] = useState(() => window.LOKINPerformance || null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const me = await base44.auth.me().catch(() => null);
    if (!me?.id) return;
    const [p, e, s1, s2] = await Promise.all([
      base44.entities.BatteryPerformanceProfile.filter({ user_id: me.id }).catch(() => []),
      base44.entities.BatteryPerformanceEvent.filter({ user_id: me.id }).catch(() => []),
      base44.entities.DriverLearningSignal.filter({ user_id: me.id }).catch(() => []),
      base44.entities.DriverLearningSignalV2.filter({ user_id: me.id }).catch(() => []),
    ]);
    setProfile(p[0] || { mode: "adaptive", low_battery_threshold: 20 });
    setEvents(e.slice(-20));
    setLegacySignals(s1);
    setV2Signals(s2);
  }

  useEffect(() => {
    load();
    const onMode = (e) => setRuntime(e.detail);
    window.addEventListener("lokin:performance-mode", onMode);
    return () => window.removeEventListener("lokin:performance-mode", onMode);
  }, []);

  const learning = useMemo(() => summarizeDriverLearning(legacySignals, v2Signals), [legacySignals, v2Signals]);

  async function setMode(mode) {
    setSaving(true);
    try {
      window.dispatchEvent(new CustomEvent("lokin:set-performance-profile", { detail: { mode } }));
      setProfile((p) => ({ ...(p || {}), mode }));
      setTimeout(() => setRuntime(window.LOKINPerformance || null), 100);
    } finally { setSaving(false); }
  }

  const recentOptimizations = events.filter(e => e.event_type === "optimization_applied").length;
  const selected = profile?.mode || "adaptive";
  const effective = runtime?.effectiveMode || selected;

  return <div className="p-4 space-y-5">
    <div className="rounded-3xl border border-primary/25 bg-primary/[0.06] p-5 relative overflow-hidden">
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/10 blur-3xl" />
      <div className="flex items-center gap-2 text-primary text-xs font-bold tracking-[.18em]"><Bolt className="h-4 w-4"/> LOKIN PERFORMANCE AI</div>
      <h1 className="text-3xl font-bold font-heading metal-text mt-2">Peak output. Smarter energy.</h1>
      <p className="text-sm text-white/55 mt-2">One intelligence layer coordinates responsiveness, battery pressure and protected driving features without making every optimization an AI call.</p>
    </div>

    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-2xl border border-white/10 lokin-panel p-4"><BatteryCharging className="h-5 w-5 text-primary mb-2"/><div className="text-xl font-bold">{runtime?.batteryLevel ?? "—"}{runtime?.batteryLevel != null ? "%" : ""}</div><div className="text-xs text-white/45">Battery signal</div><div className="text-[10px] text-white/30 mt-1">{runtime?.batterySupported ? (runtime?.charging ? "Charging" : "On battery") : "Device API unavailable"}</div></div>
      <div className="rounded-2xl border border-white/10 lokin-panel p-4"><Sparkles className="h-5 w-5 text-primary mb-2"/><div className="text-xl font-bold capitalize">{effective.replaceAll("_"," ")}</div><div className="text-xs text-white/45">Effective mode</div><div className="text-[10px] text-white/30 mt-1">Selected: {selected.replaceAll("_"," ")}</div></div>
    </div>

    <div className="space-y-2">{MODES.map(({key,title,desc,icon:Icon}) => <button disabled={saving} key={key} onClick={()=>setMode(key)} className={`w-full rounded-2xl border p-4 text-left flex gap-3 items-center ${selected===key?'border-primary/50 bg-primary/10':'border-white/10 lokin-panel'}`}><div className={`h-10 w-10 rounded-xl flex items-center justify-center ${selected===key?'bg-primary/15':'bg-white/5'}`}><Icon className={`h-5 w-5 ${selected===key?'text-primary':'text-white/45'}`}/></div><div className="flex-1"><div className="font-semibold">{title}</div><div className="text-xs text-white/45 mt-0.5">{desc}</div></div>{selected===key&&<div className="text-[10px] font-bold text-primary">ACTIVE</div>}</button>)}</div>

    <div className="rounded-3xl border border-white/10 lokin-panel p-5">
      <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary"/><div className="font-bold">Protected priorities</div></div>
      <div className="grid grid-cols-3 gap-2 mt-3">{[["Dashcam",runtime?.preserveDashcam],["Navigation",runtime?.preserveNavigation],["Voice",runtime?.preserveVoice]].map(([label,on])=><div key={label} className="rounded-xl bg-white/5 p-3 text-center"><div className={`text-xs font-bold ${on!==false?'text-primary':'text-white/45'}`}>{on!==false?'PROTECTED':'STANDARD'}</div><div className="text-[10px] text-white/40 mt-1">{label}</div></div>)}</div>
      <p className="text-xs text-white/45 mt-3">Battery Saver reduces nonessential visual and polling work first. Safety and active driving functions stay prioritized rather than being blindly shut down.</p>
    </div>

    <div className="rounded-3xl border border-white/10 lokin-panel p-5">
      <div className="flex items-center gap-2"><BrainCircuit className="h-5 w-5 text-primary"/><div className="font-bold">Learning Intelligence</div></div>
      <div className="text-sm text-white/60 mt-2">LOKIN can learn which performance modes you manually choose, then use that history alongside work context to improve future adaptive recommendations.</div>
      <div className="grid grid-cols-3 gap-2 mt-3"><div className="rounded-xl bg-white/5 p-3"><div className="text-lg font-bold">{learning.signalCount || 0}</div><div className="text-[10px] text-white/40">learning signals</div></div><div className="rounded-xl bg-white/5 p-3"><div className="text-lg font-bold">{learning.learningConfidence || 0}%</div><div className="text-[10px] text-white/40">confidence</div></div><div className="rounded-xl bg-white/5 p-3"><div className="text-lg font-bold">{recentOptimizations}</div><div className="text-[10px] text-white/40">recent optimizations</div></div></div>
    </div>

    <div className="text-[10px] text-white/30 text-center px-4">Adaptive optimization uses device signals only when available. iPhone Safari may not expose battery level, so LOKIN also uses visibility and app-state rules to reduce unnecessary work.</div>
  </div>;
}
