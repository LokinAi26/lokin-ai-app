import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GraduationCap, ShieldCheck, UserCircle2, Truck, CheckCircle2, Circle, ChevronRight, Loader2, Sparkles, Leaf } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";

// Unified driver onboarding hub. Guides a new driver through the full verification
// path in one place — profile → cannabis training → LOKIN Cover insurance → unlock
// Green Delivery — so they can get verified and start taking regulated orders without
// hunting across the app for each step.

function Step({ step, done, active, icon: Icon, title, desc, actionLabel, to, onClick }) {
  return (
    <div className={`rounded-3xl border p-4 transition-colors ${done ? "border-primary/30 bg-primary/[0.05]" : active ? "border-accent/40 bg-accent/[0.05]" : "border-white/10 lokin-panel"}`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-full shrink-0 ${done ? "bg-primary/15 text-primary" : active ? "bg-accent/15 text-accent" : "bg-white/5 text-white/40"}`}>
          {done ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-sm font-bold text-white">{title}</div>
            {done && <span className="text-[9px] font-bold tracking-wide text-primary border border-primary/30 rounded px-1.5 py-0.5">DONE</span>}
            {active && !done && <span className="text-[9px] font-bold tracking-wide text-accent border border-accent/30 rounded px-1.5 py-0.5">NEXT</span>}
          </div>
          <div className="text-xs text-white/50 mt-0.5">{desc}</div>
        </div>
      </div>
      {!done && (to ? (
        <Link to={to} className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-2xl border border-white/12 bg-white/5 py-2.5 text-xs font-bold text-white/80 active:scale-95 transition-transform">
          {actionLabel} <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      ) : onClick ? (
        <button onClick={onClick} className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-2xl border border-white/12 bg-white/5 py-2.5 text-xs font-bold text-white/80 active:scale-95 transition-transform">
          {actionLabel} <ChevronRight className="h-3.5 w-3.5" />
        </button>
      ) : null)}
    </div>
  );
}

export default function DriverOnboarding() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);
  const [prefs, setPrefs] = useState(null);
  const [cert, setCert] = useState(null);
  const [insurance, setInsurance] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const user = await base44.auth.me();
        setMe(user);
        const [prefRows, certRows, insRows] = await Promise.all([
          base44.entities.DriverPreference.filter({}).catch(() => []),
          base44.entities.DriverCertification.filter({ program: "cannabis_training" }).catch(() => []),
          base44.entities.InsuranceApplication.list("-created_date", 5).catch(() => []),
        ]);
        setPrefs(prefRows?.[0] || null);
        setCert(certRows?.[0] || null);
        setInsurance(insRows?.[0] || null);
      } catch (e) { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, []);

  const profileDone = Boolean(me?.full_name && prefs?.vehicle_mpg);
  const trainingDone = cert?.status === "passed";
  const insuranceDone = Boolean(insurance && ["submitted", "under_review", "approved", "active"].includes(insurance.status));
  const insuranceActive = insurance?.status === "active";

  const steps = [
    { key: "profile", done: profileDone, icon: UserCircle2, title: "Complete your profile", desc: "Set your name, vehicle MPG, and goals so LOKIN can optimize your day.", actionLabel: "Open Settings", to: "/settings" },
    { key: "training", done: trainingDone, icon: GraduationCap, title: "Pass cannabis training", desc: "Complete the LOKIN Academy knowledge check to earn your delivery certificate.", actionLabel: "Go to Academy", to: "/certified" },
    { key: "insurance", done: insuranceDone, icon: ShieldCheck, title: "Apply for LOKIN Cover", desc: "Submit your insurance application so you're protected while you drive.", actionLabel: insuranceActive ? "View policy" : "Apply now", to: "/insurance" },
  ];

  const completed = steps.filter((s) => s.done).length;
  const pct = Math.round((completed / steps.length) * 100);
  const allDone = completed === steps.length;

  if (loading) {
    return <div className="p-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-4 space-y-4 pb-8">
      <div className="rounded-3xl border border-primary/25 lokin-panel radial-fade p-5">
        <div className="flex items-center gap-2 text-primary"><Sparkles className="h-5 w-5" /><span className="text-[11px] tracking-[0.2em] font-display">DRIVER ONBOARDING</span></div>
        <h1 className="text-3xl font-extrabold font-display metal-text mt-2">Get Verified</h1>
        <p className="text-sm text-white/55 mt-2">Three steps to unlock regulated Green Delivery offers. Complete them in any order — LOKIN tracks your progress here.</p>
        <div className="mt-4">
          <div className="flex items-center justify-between text-[11px] text-white/50 mb-1.5">
            <span>{completed} of {steps.length} complete</span>
            <span className="font-bold text-primary">{pct}%</span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5, ease: "easeOut" }} className="h-full bg-primary glow-primary" />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {steps.map((s, i) => {
          const prevDone = i === 0 || steps[i - 1].done;
          const active = !s.done && prevDone;
          return <Step key={s.key} step={i + 1} done={s.done} active={active} icon={s.icon} title={s.title} desc={s.desc} actionLabel={s.actionLabel} to={s.to} />;
        })}
      </div>

      {/* Final unlock card */}
      <div className={`rounded-3xl border p-5 text-center transition-colors ${allDone ? "border-primary/40 bg-primary/[0.07] glow-primary" : "border-white/10 lokin-panel"}`}>
        <div className={`flex h-14 w-14 items-center justify-center rounded-full mx-auto ${allDone ? "bg-primary/20 text-primary" : "bg-white/5 text-white/30"}`}>
          {allDone ? <CheckCircle2 className="h-7 w-7" /> : <Circle className="h-7 w-7" />}
        </div>
        {allDone ? (
          <>
            <div className="font-display text-xl font-extrabold text-primary mt-3">YOU'RE VERIFIED</div>
            <div className="text-xs text-white/55 mt-1">You've completed onboarding. Regulated Green Delivery offers are now visible on your dispatch board.</div>
            <button onClick={() => navigate("/green-delivery")} className="mt-4 w-full rounded-2xl bg-primary text-primary-foreground py-3.5 text-sm font-bold glow-primary active:scale-[0.98] transition-transform flex items-center justify-center gap-2">
              <Leaf className="h-4 w-4" /> Open Green Delivery
            </button>
          </>
        ) : (
          <>
            <div className="font-display text-lg font-bold text-white/70 mt-3">Unlock Green Delivery</div>
            <div className="text-xs text-white/45 mt-1">Finish all three steps to accept regulated cannabis delivery orders.</div>
            <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-white/35">
              <Truck className="h-3 w-3" /> Regulated offers stay locked until your profile, training, and insurance are complete.
            </div>
          </>
        )}
      </div>
    </div>
  );
}