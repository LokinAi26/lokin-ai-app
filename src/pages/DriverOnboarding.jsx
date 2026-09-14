import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, ChevronRight, Link2, Loader2, LockKeyhole, MapPin, Mic, Sparkles, Target, UserCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { LokinGlyph } from "@/components/Brand";
import { normalizeWorkStatus } from "@/lib/sessionState";

function Step({ done, active, optional, icon: Icon, title, desc, actionLabel, to, onClick }) {
  const stateClass = done ? "border-primary/35 bg-primary/[0.06]" : active ? "border-accent/40 bg-accent/[0.05]" : "";
  return (
    <section className={`lokin-card p-4 transition-colors ${stateClass}`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${done ? "border-primary/35 bg-primary/15 text-primary" : active ? "border-accent/35 bg-accent/15 text-accent" : "border-white/10 bg-white/5 text-white/45"}`}>
          {done ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-bold text-white">{title}</h2>
            {done && <span className="rounded border border-primary/35 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-primary">DONE</span>}
            {active && !done && <span className="rounded border border-accent/35 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-accent">NEXT</span>}
            {optional && <span className="rounded border border-white/15 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-white/45">OPTIONAL</span>}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-white/55">{desc}</p>
        </div>
      </div>
      {!done && (to || onClick) && (to ? (
        <Link to={to} className="lokin-ghost mt-3 w-full px-4 py-3 text-xs">
          {actionLabel} <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      ) : (
        <button type="button" onClick={onClick} disabled={actionLabel === "Requesting…"} className="lokin-ghost mt-3 w-full px-4 py-3 text-xs disabled:opacity-50">
          {actionLabel} <ChevronRight className="h-3.5 w-3.5" />
        </button>
      ))}
    </section>
  );
}

export default function DriverOnboarding() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);
  const [prefs, setPrefs] = useState(null);
  const [locationGranted, setLocationGranted] = useState(false);
  const [microphoneGranted, setMicrophoneGranted] = useState(false);
  const [permissionBusy, setPermissionBusy] = useState(false);
  const [permissionMessage, setPermissionMessage] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [user, rows] = await Promise.all([
          base44.auth.me(),
          base44.entities.DriverPreference.filter({}).catch(() => []),
        ]);
        if (!alive) return;
        setMe(user);
        setPrefs(rows?.[0] || null);
        if (navigator.permissions?.query) {
          const checks = await Promise.allSettled([
            navigator.permissions.query({ name: "geolocation" }),
            navigator.permissions.query({ name: "microphone" }),
          ]);
          if (!alive) return;
          setLocationGranted(checks[0].status === "fulfilled" && checks[0].value.state === "granted");
          setMicrophoneGranted(checks[1].status === "fulfilled" && checks[1].value.state === "granted");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  async function requestPermissions() {
    setPermissionBusy(true);
    setPermissionMessage("");
    let locationOk = locationGranted;
    let microphoneOk = microphoneGranted;
    try {
      if (!locationOk && navigator.geolocation) {
        await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 12000 }));
        locationOk = true;
        setLocationGranted(true);
      }
      if (!microphoneOk && navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        microphoneOk = true;
        setMicrophoneGranted(true);
      }
      setPermissionMessage(locationOk && microphoneOk ? "Location and microphone are ready." : "Enable both permissions in device settings.");
    } catch {
      setPermissionMessage("Permission was not granted. You can enable it later in device settings.");
    } finally {
      setPermissionBusy(false);
    }
  }

  const accountDone = Boolean(me?.id || me?.email);
  const goalDone = Number(prefs?.daily_goal || 0) > 0;
  const permissionsDone = locationGranted && microphoneGranted;
  const sessionDone = normalizeWorkStatus(prefs?.work_status) !== "off";
  const requiredSteps = [
    { key: "account", done: accountDone, icon: UserCircle2, title: "Account ready", desc: "Your secure LOKIN driver account keeps goals and work sessions synced.", actionLabel: "Review account", to: "/settings" },
    { key: "goal", done: goalDone, icon: Target, title: "Set your daily goal", desc: "Choose the amount LOKIN should track throughout your workday.", actionLabel: "Set daily goal", to: "/settings" },
    { key: "permissions", done: permissionsDone, icon: MapPin, title: "Enable driving permissions", desc: "Location powers navigation. Microphone access enables hands-free Ask LOKIN commands.", actionLabel: permissionBusy ? "Requesting…" : "Enable permissions", onClick: requestPermissions },
    { key: "session", done: sessionDone, icon: LockKeyhole, title: "Lock in", desc: "Start Work when you are ready. LOKIN will preserve ACTIVE, PAUSED, and OFF across reopen.", actionLabel: "Go to Start Work", to: "/" },
  ];
  const completed = requiredSteps.filter((step) => step.done).length;
  const percent = Math.round((completed / requiredSteps.length) * 100);
  const ready = accountDone && goalDone && permissionsDone;

  if (loading) {
    return <div className="flex min-h-[55dvh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4 p-4 pb-8">
      <div className="lokin-kicker lokin-kicker-lime">ONBOARDING</div>
      <header className="lokin-card relative overflow-hidden radial-fade p-5">
        <div className="absolute -right-6 -top-6 opacity-15"><LokinGlyph size={112} /></div>
        <div className="relative">
          <div className="flex items-center gap-2 text-primary"><Sparkles className="h-4 w-4" /><span className="lokin-kicker lokin-kicker-lime font-display">WELCOME TO LOKIN AI</span></div>
          <h1 className="lokin-wordmark mt-2 font-display text-3xl font-extrabold">Your driver copilot</h1>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-white/60">Set your goal, enable safe hands-free tools, then lock in. Provider connections are optional.</p>
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-[11px] text-white/50"><span>{completed} of {requiredSteps.length} required steps</span><span className="font-bold text-primary">{percent}%</span></div>
            <div className="lokin-progress-track h-2"><motion.div initial={{ width: 0 }} animate={{ width: `${percent}%` }} transition={{ duration: 0.5, ease: "easeOut" }} className="lokin-progress-fill" /></div>
          </div>
        </div>
      </header>

      <div className="space-y-3">
        {requiredSteps.map((step, index) => <Step key={step.key} {...step} active={!step.done && requiredSteps.slice(0, index).every((item) => item.done)} />)}
        {permissionMessage && <p role="status" className="px-2 text-xs leading-relaxed text-white/55">{permissionMessage}</p>}
        <Step optional icon={Link2} title="Connect driver data sources" desc="Add supported provider feeds or verified capture when you are ready. You can skip this and start with manual offers." actionLabel="View connections" to="/driver-platforms" />
      </div>

      <section className={`lokin-card p-5 text-center ${ready ? "border-primary/40 bg-primary/[0.07] glow-primary" : ""}`}>
        <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border ${ready ? "border-primary/40 bg-primary/15 text-primary" : "border-white/10 bg-white/5 text-white/35"}`}>
          {ready ? <LockKeyhole className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
        </div>
        <h2 className={`mt-3 font-display text-lg font-extrabold ${ready ? "text-primary text-glow" : "metal-text"}`}>{ready ? "READY TO LOCK IN" : "FINISH YOUR SETUP"}</h2>
        <p className="mt-1 text-xs leading-relaxed text-white/55">{ready ? "Your core setup is complete. Start Work whenever you are ready to earn." : "Complete the required steps above. You can change every setting later."}</p>
        <button type="button" onClick={() => navigate("/")} className="lokin-cta mt-4 min-h-12">{sessionDone ? "RETURN TO DELIVERY" : "OPEN START WORK"}</button>
        <div className="lokin-cta-caption">Lock in &amp; start earning</div>
      </section>

      <p className="lokin-kicker text-center font-medium">DRIVE SAFER. WORK SMARTER. LIVE SIMPLER.</p>
    </div>
  );
}
