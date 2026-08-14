import { useMemo, useState } from "react";
import { GraduationCap, ShieldCheck, Lock, CheckCircle2, Award, Store, QrCode, Clock3 } from "lucide-react";

const LESSONS = [
  { title: "Virginia cannabis law", desc: "Know what is legal today and what changes when the regulated retail market opens." },
  { title: "Age & identity verification", desc: "Learn a strict 21+ ID-check workflow and when to refuse a handoff." },
  { title: "Safe driving & custody", desc: "No consumption while driving; follow lawful product-custody and vehicle rules." },
  { title: "Refusals & prohibited handoffs", desc: "Practice safe refusal, return-to-merchant, and incident-reporting scenarios." },
  { title: "Merchant chain of custody", desc: "Pickup confirmation, sealed-order controls, handoff records, and audit trail." },
  { title: "Public safety", desc: "Recognize impairment, protect customers and drivers, and escalate emergencies appropriately." },
];

const QUESTIONS = [
  { q: "Can LOKIN activate adult-use marijuana delivery in Virginia today?", choices: ["Yes, statewide", "Only after applicable licensing/regulations permit it", "Yes, if the customer is 21+"], a: 1 },
  { q: "What is the minimum age this training uses for regulated adult-use handoff?", choices: ["18", "19", "21"], a: 2 },
  { q: "What should happen when an ID cannot be verified?", choices: ["Leave the order", "Refuse the handoff and follow the return/incident workflow", "Ask a neighbor"], a: 1 },
  { q: "May a driver consume cannabis while driving?", choices: ["No", "Only off-app", "Only after pickup"], a: 0 },
  { q: "What should LOKIN keep for regulated deliveries?", choices: ["No records", "A compliance/audit trail", "Only the driver's notes"], a: 1 },
];

export default function Certified() {
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const score = useMemo(() => QUESTIONS.reduce((n, x, i) => n + (answers[i] === x.a ? 1 : 0), 0), [answers]);
  const pct = Math.round((score / QUESTIONS.length) * 100);
  const passed = submitted && pct >= 80;

  return (
    <div className="p-4 space-y-4 pb-8">
      <div className="rounded-3xl border border-primary/25 lokin-panel radial-fade p-5">
        <div className="flex items-center gap-2 text-primary"><GraduationCap className="h-5 w-5"/><span className="text-[11px] tracking-[0.2em] font-display">LOKIN ACADEMY</span></div>
        <h1 className="text-3xl font-extrabold font-display metal-text mt-2">LOKIN Certified</h1>
        <p className="text-sm text-white/55 mt-2">Training and eligibility for higher-responsibility delivery categories.</p>
      </div>

      <div className="rounded-3xl border border-amber-400/25 bg-amber-400/[0.06] p-4">
        <div className="flex gap-3"><Lock className="h-5 w-5 text-amber-300 shrink-0"/><div><div className="font-bold text-white">Virginia Adult-Use Cannabis Delivery</div><div className="text-xs text-white/55 mt-1">COMING JULY 1, 2027 — subject to Virginia Cannabis Control Authority licensing, final regulations, merchant eligibility, and LOKIN compliance approval. This course does not authorize delivery by itself.</div></div></div>
      </div>

      <div>
        <div className="text-xs tracking-[0.18em] text-primary/75 font-display mb-2">TRAINING MODULES</div>
        <div className="space-y-2">{LESSONS.map((x,i)=><div key={x.title} className="rounded-2xl border border-white/10 lokin-panel p-3 flex gap-3"><div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/25 flex items-center justify-center text-xs font-bold text-primary">{i+1}</div><div><div className="text-sm font-bold text-white">{x.title}</div><div className="text-xs text-white/45 mt-0.5">{x.desc}</div></div></div>)}</div>
      </div>

      <div className="rounded-3xl border border-white/10 lokin-panel p-4 space-y-4">
        <div className="flex items-center justify-between"><div><div className="font-bold text-white">Knowledge Check</div><div className="text-xs text-white/45">Pass score: 80% or higher</div></div><ShieldCheck className="h-6 w-6 text-primary"/></div>
        {QUESTIONS.map((x,i)=><div key={x.q}><div className="text-sm font-semibold text-white/85 mb-2">{i+1}. {x.q}</div><div className="space-y-1.5">{x.choices.map((c,j)=><button key={c} onClick={()=>{setAnswers(a=>({...a,[i]:j}));setSubmitted(false)}} className={`w-full text-left rounded-xl border px-3 py-2 text-xs ${answers[i]===j?"border-primary bg-primary/10 text-primary":"border-white/10 text-white/55"}`}>{c}</button>)}</div></div>)}
        <button disabled={Object.keys(answers).length !== QUESTIONS.length} onClick={()=>setSubmitted(true)} className="w-full rounded-2xl bg-primary text-primary-foreground py-3 font-bold disabled:opacity-40">GRADE TEST</button>
        {submitted && <div className={`rounded-2xl border p-4 ${passed?"border-primary/35 bg-primary/[0.07]":"border-destructive/35 bg-destructive/[0.06]"}`}><div className="text-2xl font-bold font-display">{pct}%</div><div className="text-sm mt-1">{passed?"Passed — training knowledge check complete.":"Not passed yet — review the modules and retake the test."}</div></div>}
      </div>

      {passed && <div className="rounded-3xl border border-primary/35 bg-primary/[0.06] p-5 text-center"><Award className="h-10 w-10 text-primary mx-auto"/><div className="font-display font-extrabold text-xl text-primary mt-2">LOKIN TRAINING COMPLETE</div><div className="text-xs text-white/50 mt-1">Educational credential only — regulated-delivery eligibility remains locked until all government and merchant requirements are satisfied.</div><div className="mt-4 flex items-center justify-center gap-2 text-xs text-white/55"><QrCode className="h-4 w-4"/> Verification-ready certificate architecture</div></div>}

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-white/10 lokin-panel p-3"><Store className="h-5 w-5 text-primary mb-2"/><div className="text-sm font-bold">Merchant Pilot</div><div className="text-xs text-white/45 mt-1">Prepare participating stores using non-controlled merchandise while regulated lanes remain locked.</div></div>
        <div className="rounded-2xl border border-white/10 lokin-panel p-3"><Clock3 className="h-5 w-5 text-accent mb-2"/><div className="text-sm font-bold">Annual Renewal Ready</div><div className="text-xs text-white/45 mt-1">Architecture supports expiration and retraining once final rules define requirements.</div></div>
      </div>
    </div>
  );
}
