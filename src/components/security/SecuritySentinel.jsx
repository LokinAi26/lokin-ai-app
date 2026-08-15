import { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert, Activity, LockKeyhole, BrainCircuit, Radar, Zap } from "lucide-react";
import { getSecuritySnapshot, subscribeSecurity, securityRecommendation } from "@/lib/lokinSecurityEngine";

export default function SecuritySentinel({ compact = false }) {
  const [s, setS] = useState(getSecuritySnapshot());
  useEffect(() => subscribeSecurity(setS), []);
  const Icon = s.posture === "protected" ? ShieldCheck : ShieldAlert;
  if (compact) return (
    <div className="rounded-2xl border border-primary/20 bg-black/70 px-3 py-2 flex items-center gap-3">
      <Icon className="h-5 w-5 text-primary"/><div className="min-w-0 flex-1"><div className="text-[10px] tracking-[.18em] text-primary">LOKIN SENTINEL</div><div className="text-xs text-white/65 truncate">{s.posture.toUpperCase()} · {s.score}/100</div></div><Activity className="h-4 w-4 text-white/30"/>
    </div>
  );
  return <section className="rounded-3xl border border-primary/20 bg-gradient-to-b from-primary/[.07] to-black p-5 overflow-hidden relative">
    <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-3xl" />
    <div className="relative flex items-start justify-between gap-4"><div><div className="text-[10px] tracking-[.24em] text-primary">LOKIN AI SECURITY SENTINEL</div><h2 className="mt-1 text-xl font-bold">Adaptive protection engine</h2><p className="mt-1 text-xs text-white/45">Fail-closed command defense · live policy posture · anomaly awareness</p></div><div className="h-12 w-12 rounded-2xl border border-primary/30 bg-primary/10 grid place-items-center"><Icon className="h-6 w-6 text-primary"/></div></div>
    <div className="relative mt-5 grid grid-cols-3 gap-2"><Metric icon={LockKeyhole} label="POSTURE" value={s.posture.toUpperCase()}/><Metric icon={BrainCircuit} label="TRUST" value={`${s.score}/100`}/><Metric icon={ShieldCheck} label="BLOCKED" value={String(s.blocked)}/></div>
    <div className="relative mt-2 grid grid-cols-2 gap-2"><Metric icon={Radar} label="ADAPTIVE MODE" value={s.adaptiveMode.toUpperCase()}/><Metric icon={Zap} label="INGRESS" value="FAIL-CLOSED"/></div>
    <div className="relative mt-3 rounded-2xl border border-white/10 bg-black/50 p-3"><div className="text-[10px] tracking-[.16em] text-white/35">SENTINEL GUIDANCE</div><p className="mt-1 text-xs leading-relaxed text-white/65">{securityRecommendation(s)}</p></div>
    <div className="relative mt-3 space-y-1.5">{s.events.slice(0,3).map(e=><div key={e.id} className="flex items-center gap-2 text-[10px] text-white/45"><span className={`h-1.5 w-1.5 rounded-full ${e.accepted?'bg-primary':'bg-red-400'}`}/><span className="flex-1 truncate">{e.accepted ? 'Validated' : 'Blocked'} · {e.command || e.reason}</span><span>{new Date(e.at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span></div>)}</div>
  </section>;
}
function Metric({icon:Icon,label,value}) { return <div className="rounded-2xl border border-white/10 bg-black/55 p-3"><Icon className="h-4 w-4 text-primary"/><div className="mt-2 text-[9px] tracking-[.14em] text-white/30">{label}</div><div className="mt-0.5 text-xs font-bold text-white">{value}</div></div> }
