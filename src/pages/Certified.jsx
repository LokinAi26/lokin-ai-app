import { useEffect, useMemo, useState } from "react";
import { GraduationCap, ShieldCheck, Lock, Award, Store, QrCode, Clock3, BadgeCheck, ScanLine, PackageCheck, Undo2, FileText } from "lucide-react";
import { base44 } from "@/api/base44Client";

const LESSONS = [
  { title: "Virginia cannabis law", desc: "Know what is legal today and what changes when the regulated retail market opens." },
  { title: "Age & identity verification", desc: "Use a strict 21+ ID-check workflow and know when to refuse a handoff." },
  { title: "Safe driving & custody", desc: "No consumption while driving; protect sealed orders and follow lawful custody rules." },
  { title: "Refusals & returns", desc: "Practice refusal, return-to-merchant, and incident-reporting scenarios." },
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

const FLOW = [
  { icon: BadgeCheck, title: "Eligibility Gate", text: "Only certified drivers can see regulated offers. Cannabis remains locked until legally enabled." },
  { icon: PackageCheck, title: "Pickup Custody", text: "Confirm merchant, sealed order, category, and chain-of-custody handoff." },
  { icon: ScanLine, title: "ID Verification", text: "Require in-person identity/age verification before a regulated handoff." },
  { icon: Undo2, title: "Refuse / Return", text: "If verification fails, do not hand off. Trigger refusal and merchant return workflow." },
  { icon: FileText, title: "Audit Trail", text: "Log pickup, verification result, handoff/refusal, return, and incidents." },
];

export default function Certified() {
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [cert, setCert] = useState(null);
  const [me, setMe] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const user = await base44.auth.me();
        setMe(user);
        const rows = await base44.entities.DriverCertification.filter({ program: "cannabis_training" });
        setCert(rows[0] || null);
      } catch {}
    })();
  }, []);

  const score = useMemo(() => QUESTIONS.reduce((n, x, i) => n + (answers[i] === x.a ? 1 : 0), 0), [answers]);
  const pct = Math.round((score / QUESTIONS.length) * 100);
  const passed = submitted && pct >= 80;

  async function grade() {
    setSubmitted(true);
    if (pct < 80) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const certificateId = cert?.certificate_id || `LOKIN-${Date.now().toString(36).toUpperCase()}`;
      const payload = {
        user_id: me?.id,
        program: "cannabis_training",
        status: "passed",
        score: pct,
        certificate_id: certificateId,
        completed_at: now,
        eligible_for_regulated_offers: false,
        notes: "Educational LOKIN training complete. Government/merchant eligibility still required.",
      };
      const saved = cert?.id
        ? await base44.entities.DriverCertification.update(cert.id, payload)
        : await base44.entities.DriverCertification.create(payload);
      setCert(saved);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 space-y-4 pb-8">
      <div className="rounded-3xl border border-primary/25 lokin-panel radial-fade p-5">
        <div className="flex items-center gap-2 text-primary"><GraduationCap className="h-5 w-5"/><span className="text-[11px] tracking-[0.2em] font-display">LOKIN ACADEMY</span></div>
        <h1 className="text-3xl font-extrabold font-display metal-text mt-2">LOKIN Certified</h1>
        <p className="text-sm text-white/55 mt-2">Driver training, certification wallet, merchant eligibility, and compliance workflows.</p>
      </div>

      <div className="rounded-3xl border border-amber-400/25 bg-amber-400/[0.06] p-4">
        <div className="flex gap-3"><Lock className="h-5 w-5 text-amber-300 shrink-0"/><div><div className="font-bold text-white">Virginia Adult-Use Cannabis Delivery</div><div className="text-xs text-white/55 mt-1">COMING JULY 1, 2027 — subject to Virginia Cannabis Control Authority licensing, final regulations, merchant eligibility, and LOKIN compliance approval. Completing this course does not authorize cannabis delivery.</div></div></div>
      </div>

      <div className="rounded-3xl border border-white/10 lokin-panel p-4">
        <div className="flex items-center justify-between"><div><div className="text-[11px] tracking-[0.18em] text-primary/70 font-display">CERTIFICATION WALLET</div><div className="text-lg font-bold text-white mt-1">Cannabis Delivery Training</div></div><QrCode className="h-7 w-7 text-primary"/></div>
        {cert?.status === "passed" ? (
          <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/[0.06] p-4">
            <div className="flex items-center gap-2 text-primary font-bold"><Award className="h-5 w-5"/> Training complete</div>
            <div className="grid grid-cols-2 gap-2 mt-3 text-xs"><div><span className="text-white/40">Score</span><div className="text-white font-bold">{cert.score}%</div></div><div><span className="text-white/40">Certificate</span><div className="text-white font-bold truncate">{cert.certificate_id}</div></div></div>
            <div className="text-[11px] text-amber-300/80 mt-3">Regulated-offer eligibility remains OFF until licensing, merchant, and government requirements are satisfied.</div>
          </div>
        ) : <div className="text-sm text-white/45 mt-3">No completed cannabis training credential yet.</div>}
      </div>

      <div>
        <div className="text-xs tracking-[0.18em] text-primary/75 font-display mb-2">TRAINING MODULES</div>
        <div className="space-y-2">{LESSONS.map((x,i)=><div key={x.title} className="rounded-2xl border border-white/10 lokin-panel p-3 flex gap-3"><div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/25 flex items-center justify-center text-xs font-bold text-primary">{i+1}</div><div><div className="text-sm font-bold text-white">{x.title}</div><div className="text-xs text-white/45 mt-0.5">{x.desc}</div></div></div>)}</div>
      </div>

      <div className="rounded-3xl border border-white/10 lokin-panel p-4 space-y-4">
        <div className="flex items-center justify-between"><div><div className="font-bold text-white">Knowledge Check</div><div className="text-xs text-white/45">Pass score: 80% or higher</div></div><ShieldCheck className="h-6 w-6 text-primary"/></div>
        {QUESTIONS.map((x,i)=><div key={x.q}><div className="text-sm font-semibold text-white/85 mb-2">{i+1}. {x.q}</div><div className="space-y-1.5">{x.choices.map((c,j)=><button key={c} onClick={()=>{setAnswers(a=>({...a,[i]:j}));setSubmitted(false)}} className={`w-full text-left rounded-xl border px-3 py-2 text-xs ${answers[i]===j?"border-primary bg-primary/10 text-primary":"border-white/10 text-white/55"}`}>{c}</button>)}</div></div>)}
        <button disabled={Object.keys(answers).length !== QUESTIONS.length || saving} onClick={grade} className="w-full rounded-2xl bg-primary text-primary-foreground py-3 font-bold disabled:opacity-40">{saving ? "SAVING…" : "GRADE TEST"}</button>
        {submitted && <div className={`rounded-2xl border p-4 ${passed?"border-primary/35 bg-primary/[0.07]":"border-destructive/35 bg-destructive/[0.06]"}`}><div className="text-2xl font-bold font-display">{pct}%</div><div className="text-sm mt-1">{passed?"Passed — your LOKIN training credential is saved.":"Not passed yet — review the modules and retake the test."}</div></div>}
      </div>

      <div>
        <div className="text-xs tracking-[0.18em] text-primary/75 font-display mb-2">REGULATED DELIVERY FLOW</div>
        <div className="space-y-2">{FLOW.map(({icon:Icon,title,text})=><div key={title} className="rounded-2xl border border-white/10 lokin-panel p-3 flex gap-3"><Icon className="h-5 w-5 text-primary shrink-0 mt-0.5"/><div><div className="text-sm font-bold text-white">{title}</div><div className="text-xs text-white/45 mt-0.5">{text}</div></div></div>)}</div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-white/10 lokin-panel p-3"><Store className="h-5 w-5 text-primary mb-2"/><div className="text-sm font-bold">Merchant Pilot</div><div className="text-xs text-white/45 mt-1">MerchantPartner records now support interested, onboarding, pilot-ready, active, and paused states.</div></div>
        <div className="rounded-2xl border border-white/10 lokin-panel p-3"><Clock3 className="h-5 w-5 text-accent mb-2"/><div className="text-sm font-bold">Renewal Ready</div><div className="text-xs text-white/45 mt-1">Certification records support expiration and retraining when final rules define requirements.</div></div>
      </div>
    </div>
  );
}
