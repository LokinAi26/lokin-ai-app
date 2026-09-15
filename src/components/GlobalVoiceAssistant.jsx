import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, Radio, X, Volume2, Ear, Pause, Play, Power, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { LOKIN_NAV_CIRCLE } from "@/components/Brand";
import { consumeExternalCommandFromLocation } from "@/lib/lokinCommandBus";
import { validateExternalCommand } from "@/lib/lokinCommandPolicy";
import { guardedInvoke } from "@/lib/creditGuardian";
import { setAiConsent } from "@/lib/aiConsent";

// Navigation intents the assistant can execute hands-free.
const NAV_COMMANDS = [
  { keys: ["earnings", "how much", "made today"], to: "/earnings", label: "Opening Earnings" },
  { keys: ["go home", "home screen", "open home"], to: "/", label: "Going Home" },
  { keys: ["route", "optimize", "best route", "plan my"], to: "/route", label: "Opening Route Optimizer" },
  { keys: ["gas", "fuel", "find gas", "cheapest gas"], to: "/fuel", label: "Finding Gas" },
  { keys: ["break", "play music", "music", "chill", "relax"], to: "/break-time", label: "Opening Break Time" },
  { keys: ["safety", "sos", "emergency", "help me now"], to: "/safety", label: "Opening Safety" },
  { keys: ["support", "report a bug", "billing"], to: "/support", label: "Opening Support" },
  { keys: ["on the road", "truck stop", "rest area", "rv park"], to: "/on-the-road", label: "On The Road" },
  { keys: ["vehicle", "mechanic", "maintenance", "car care"], to: "/vehicle-care", label: "Vehicle Care" },
  { keys: ["brand", "merch", "apparel", "shiesty"], to: "/brand", label: "Opening Brand" },
  { keys: ["settings", "preferences", "goals"], to: "/settings", label: "Opening Settings" },
  { keys: ["companion", "keep me company", "talk to me", "road companion", "drive mode", "driving mode"], to: "/drive", label: "Opening Drive Mode" },
  { keys: ["find item", "item locator", "locate item", "where is this item", "smart shop", "find everything"], to: "/locator", label: "Opening Smart Shop Item Locator" },
  { keys: ["shop and deliver", "shopping orders", "shopping route"], to: "/shop-deliver", label: "Opening Shop and Deliver" },
];

function includesAny(text, phrases) {
  const t = text.toLowerCase();
  return phrases.some((p) => t.includes(p));
}

const MUSIC_ACTIONS = [
  { keys: ["play music", "play driving music", "start music", "play a station", "play some music"], action: "play", label: "Playing your drive music", nav: "/drive" },
  { keys: ["pause music", "stop the music", "stop music", "pause the music"], action: "pause", label: "Pausing the music" },
  { keys: ["next station", "next song", "skip this", "skip song", "next track", "skip"], action: "next", label: "Skipping to the next station" },
  { keys: ["previous station", "last station", "previous song", "go back a station"], action: "prev", label: "Previous station" },
];

function matchMusic(text) {
  const t = text.toLowerCase();
  for (const c of MUSIC_ACTIONS) if (c.keys.some((k) => t.includes(k))) return c;
  return null;
}

function matchCommand(text) {
  const t = text.toLowerCase();
  for (const c of NAV_COMMANDS) {
    if (c.keys.some((k) => t.includes(k))) return c;
  }
  return null;
}

function extractNavigationDestination(raw) {
  const text = String(raw || "").trim();
  const patterns = [
    { pattern: /^(?:navigate|drive|route|go|head)\s+(?:me\s+)?to\s+(.+)$/i, explicit: true },
    { pattern: /^(?:take|bring)\s+me\s+to\s+(.+)$/i, explicit: true },
    { pattern: /^(?:get|give)\s+me\s+directions\s+to\s+(.+)$/i, explicit: true },
    { pattern: /^(?:directions|navigation)\s+to\s+(.+)$/i, explicit: true },
    { pattern: /^(?:i\s+(?:need|want)\s+to\s+go\s+to)\s+(.+)$/i, explicit: true },
    { pattern: /^(?:find|locate|search\s+for)\s+(?:the\s+)?(?:(?:nearest|closest|nearby)\s+)?(.+)$/i, explicit: false },
  ];
  for (const candidate of patterns) {
    const destination = text.match(candidate.pattern)?.[1]?.trim().replace(/[?.!,]+$/, "");
    if (destination && destination.length >= 2) return { destination, explicit: candidate.explicit };
  }
  return null;
}

function speechRecognitionCtor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function extractWakeCommand(raw) {
  const text = String(raw || "").toLowerCase().trim();
  // Wake recognition is deliberately gated: LOKIN does not react to ambient
  // speech unless the phrase begins with "Hey LOKIN" (speech engines may render
  // the brand phonetically as "lock in", so that spelling is accepted too).
  const match = text.match(/\bhey\s+(?:lokin|lock\s*in)\b(.*)$/i);
  return match ? { matched: true, command: (match[1] || "").trim() } : { matched: false, command: "" };
}

// Siri/Gemini-style hands-free voice assistant overlay, available app-wide.
// Tap the orb to talk, or enable "Always Listening" for wake-word ("Hey LOKIN") activation.
export default function GlobalVoiceAssistant({ open: controlledOpen, onOpenChange, drivingMode = false }) {
  const navigate = useNavigate();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen;
  const setOpen = onOpenChange || setUncontrolledOpen;
  const [listening, setListening] = useState(false);
  const [alwaysOn, setAlwaysOn] = useState(() => localStorage.getItem("lokin_always_on") === "1");
  const [wakeBlocked, setWakeBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [consentRequired, setConsentRequired] = useState(false);
  const [pendingAiCommand, setPendingAiCommand] = useState("");
  const recRef = useRef(null);
  const wakeRef = useRef(null);
  const wakeRestartRef = useRef(null);
  const wakeTriggerAtRef = useRef(0);
  const alwaysOnRef = useRef(alwaysOn);
  const voiceSupported = Boolean(speechRecognitionCtor());
  const wakeEnabled = (drivingMode || alwaysOn) && !wakeBlocked;
  alwaysOnRef.current = wakeEnabled;
  // Presentation: full-screen hero when opened from the LOKIN tab;
  // compact bottom sheet for in-flow (driving) invocations.
  const full = !drivingMode;

  useEffect(() => {
    if (drivingMode) setWakeBlocked(false);
  }, [drivingMode]);

  function speak(text) {
    try {
      const u = new SpeechSynthesisUtterance(text.replace(/[*#_`]/g, ""));
      u.rate = 1.05;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch {}
  }

  async function handleCommand(command) {
    if (!command.trim()) return;
    setBusy(true);
    setTranscript(command);
    setReply("");

    const t = command.toLowerCase();
    try {
      const prefsList = await base44.entities.DriverPreference.filter({});
      const prefs = prefsList[0] || null;
      const me = await base44.auth.me().catch(() => null);

      if (includesAny(t, ["level up", "start work", "start my shift", "begin work"])) {
        const next = { work_status: "working", break_active: false };
        if (prefs?.id) await base44.entities.DriverPreference.update(prefs.id, next);
        else await base44.entities.DriverPreference.create(next);
        if (me?.id) await base44.entities.DriverSession.create({ user_id: me.id, status: "working", started_at: new Date().toISOString(), source: "voice" });
        const msg = "Leveling up. You're locked in. AI GPS is ready.";
        setReply(msg); speak(msg); setTimeout(() => navigate("/ai-gps?focus=locked&nav=1&view=real"), 350); setBusy(false); return;
      }

      if (includesAny(t, ["lock in", "locked in", "focus mode"])) {
        const msg = "Locked in. Distractions minimized.";
        setReply(msg); speak(msg); setTimeout(() => navigate("/ai-gps?focus=locked&nav=1&view=real"), 300); setBusy(false); return;
      }

      if (includesAny(t, ["lokin pause", "pause work", "pause my shift", "pause"])) {
        if (prefs?.id) await base44.entities.DriverPreference.update(prefs.id, { work_status: "paused", break_active: true });
        const sessions = me?.id ? await base44.entities.DriverSession.filter({ user_id: me.id, status: "working" }, "-started_at") : [];
        if (sessions?.[0]?.id) await base44.entities.DriverSession.update(sessions[0].id, { status: "paused", paused_at: new Date().toISOString() });
        const msg = "Paused. Take your time. Say LOKIN, resume when you're ready to lock back in.";
        setReply(msg); speak(msg); setTimeout(() => navigate("/break-time"), 300); setBusy(false); return;
      }

      if (includesAny(t, ["resume", "resume work", "continue work", "lock back in"])) {
        if (prefs?.id) await base44.entities.DriverPreference.update(prefs.id, { work_status: "working", break_active: false });
        const sessions = me?.id ? await base44.entities.DriverSession.filter({ user_id: me.id, status: "paused" }, "-started_at") : [];
        if (sessions?.[0]?.id) await base44.entities.DriverSession.update(sessions[0].id, { status: "working", resumed_at: new Date().toISOString() });
        const msg = "Welcome back. Recalculating and locking you back in.";
        setReply(msg); speak(msg); setTimeout(() => navigate("/ai-gps?focus=locked&nav=1&view=real"), 350); setBusy(false); return;
      }

      if (includesAny(t, ["tap out", "end work", "end my shift", "finish work"])) {
        if (prefs?.id) await base44.entities.DriverPreference.update(prefs.id, { work_status: "off", break_active: false });
        const sessions = me?.id ? await base44.entities.DriverSession.filter({ user_id: me.id, status: { $in: ["working", "paused"] } }, "-started_at") : [];
        if (sessions?.[0]?.id) await base44.entities.DriverSession.update(sessions[0].id, { status: "ended", ended_at: new Date().toISOString() });
        const msg = "You're tapped out. Nice work today. I'll have your recap ready on the home screen.";
        setReply(msg); speak(msg); setTimeout(() => navigate("/"), 400); setBusy(false); return;
      }
    } catch (e) {
      // fall through to normal assistant handling if a session command fails
    }
    const music = matchMusic(command);
    if (music) {
      window.dispatchEvent(new CustomEvent("lokin:music", { detail: { action: music.action } }));
      speak(music.label);
      setReply(music.label);
      if (music.nav) setTimeout(() => navigate(music.nav), 400);
      setBusy(false);
      return;
    }
    const destinationIntent = extractNavigationDestination(command);
    const nav = matchCommand(command);
    if (destinationIntent && (destinationIntent.explicit || !nav)) {
      const destination = destinationIntent.destination;
      const msg = `Finding the nearest ${destination} and starting navigation.`;
      speak(msg);
      setReply(msg);
      const params = new URLSearchParams({
        focus: "locked",
        nav: "1",
        view: "real",
        source: "voice",
        destination,
      });
      setTimeout(() => navigate(`/ai-gps?${params.toString()}`), 350);
      setBusy(false);
      return;
    }
    if (nav) {
      speak(nav.label);
      setReply(nav.label);
      setTimeout(() => { navigate(nav.to); }, 500);
      setBusy(false);
      return;
    }
    try {
      const [earnings, prefsList] = await Promise.all([
        base44.entities.Earning.filter({}),
        base44.entities.DriverPreference.filter({}),
      ]);
      const today = new Date().toISOString().slice(0, 10);
      const todayEarnings = earnings.filter((e) => e.date === today).reduce((s, e) => s + (e.amount || 0), 0);
      const p = prefsList[0] || {};
      const res = await guardedInvoke(base44, "external-ai-gateway", {
        mode: "assistant",
        command,
        context: {
          todayEarnings,
          dailyGoal: p.daily_goal || 150,
          netPerHour: p.min_per_hour || 22,
          hoursWorked: 0,
          platform: "mixed",
        },
      });
      const data = res.data;
      setReply(data.reply || "I didn't catch that.");
      speak(data.reply || "I didn't catch that.");
    } catch (e) {
      if (e?.code === "LOKIN_AI_CONSENT_REQUIRED") {
        setPendingAiCommand(command);
        setConsentRequired(true);
        setReply("To answer open-ended requests, LOKIN needs permission to securely process your request with its configured AI service.");
      } else if (e?.code === "LOKIN_CREDIT_DEFERRED") {
        setReply("AI assistance is temporarily unavailable, but voice navigation commands still work. Try again in a moment.");
      } else {
        console.error("LOKIN voice assistant request failed", e);
        setReply("I heard you, but the AI response service did not complete the request. Try again, or use a voice navigation command.");
      }
    } finally {
      setBusy(false);
    }
  }

  function allowAiProcessing() {
    setAiConsent("granted");
    setConsentRequired(false);
    const retry = pendingAiCommand;
    setPendingAiCommand("");
    setReply("AI processing enabled. Retrying your request…");
    if (retry) setTimeout(() => handleCommand(retry), 120);
  }

  function declineAiProcessing() {
    setAiConsent("denied");
    setConsentRequired(false);
    setPendingAiCommand("");
    setReply("AI processing stays off. Voice navigation commands such as “find gas,” “lock in,” “pause,” and “resume” will still work.");
  }

  function startOnce(wakeGranted = false) {
    const SR = speechRecognitionCtor();
    if (!SR) {
      setOpen(true);
      setReply("Voice recognition is not available in this app environment. Use the on-screen controls or Siri shortcuts instead.");
      return;
    }
    if (wakeRef.current) { try { wakeRef.current.stop(); } catch {} }
    setListening(true);
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.onstart = () => setListening(true);
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
      if (alwaysOnRef.current && wakeRef.current) {
        wakeRestartRef.current = setTimeout(() => {
          if (alwaysOnRef.current && wakeRef.current) {
            try { wakeRef.current.start(); } catch {}
          }
        }, 650);
      }
    };
    rec.onresult = (e) => {
      const text = e.results?.[0]?.[0]?.transcript || "";
      if (!text.trim()) return;
      if (drivingMode && !wakeGranted) {
        const wakeCommand = extractWakeCommand(text);
        if (!wakeCommand.matched) return;
        if (wakeCommand.command) handleCommand(wakeCommand.command);
        else {
          speak("I'm listening.");
          setTimeout(() => startOnce(true), 250);
        }
        return;
      }
      handleCommand(text);
    };
    rec.onerror = (e) => {
      setListening(false);
      recRef.current = null;
      const code = e?.error || "voice_error";
      if (["not-allowed", "service-not-allowed", "audio-capture"].includes(code)) {
        setOpen(true);
        setReply("Microphone and speech access are required for LOKIN voice. Enable them in iPhone Settings, then tap the microphone again.");
      } else if (code !== "aborted" && code !== "no-speech") {
        setReply("Voice recognition stopped. Tap the microphone to retry.");
      }
    };
    recRef.current = rec;
    try { rec.start(); } catch {
      setListening(false);
      setReply("Voice recognition could not start. Tap the microphone to retry.");
    }
  }

  // One command ingress for UI controls, deep links, Siri/App Intents,
  // Android App Actions, widgets, hardware buttons, and future integrations.
  useEffect(() => {
    const onVoiceCommand = (e) => {
      const command = e?.detail?.command;
      if (!command) return;
      setOpen(true);
      handleCommand(command);
    };
    window.addEventListener("lokin:voice-command", onVoiceCommand);
    const external = consumeExternalCommandFromLocation();
    if (external?.command) {
      const validated = validateExternalCommand(external.command, external.payload);
      if (validated.ok) {
        const phrases = { lock_in: "lock in", pause: "pause", resume: "resume", tap_out: "tap out", find_item: "find item", smart_shop: "smart shop", open_route: "best route", safety: "safety" };
        const phrase = phrases[external.command] || external.command;
        // Destructive/session-ending external actions require the user to confirm in LOKIN.
        if (validated.policy.confirmation === "explicit") {
          setOpen(true);
          setTranscript(`External request: ${phrase}`);
          setReply(`LOKIN received “${phrase}”. Confirm it in the app before I execute it.`);
        } else {
          setTimeout(() => onVoiceCommand({ detail: { command: phrase, ...external, payload: validated.payload } }), 250);
        }
      }
    }
    return () => window.removeEventListener("lokin:voice-command", onVoiceCommand);
  }, []);

  // Foreground wake-word listener. iOS may suspend web speech recognition when
  // the app is backgrounded, so system-level Siri shortcuts remain the native
  // entry point outside the open LOKIN app.
  useEffect(() => {
    const SR = speechRecognitionCtor();
    if (wakeRestartRef.current) { clearTimeout(wakeRestartRef.current); wakeRestartRef.current = null; }
    if (!SR || !wakeEnabled) {
      if (wakeRef.current) { try { wakeRef.current.stop(); } catch {} wakeRef.current = null; }
      return;
    }
    const wake = new SR();
    wake.continuous = true;
    wake.interimResults = true;
    wake.lang = "en-US";
    wake.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const heard = e.results?.[i]?.[0]?.transcript || "";
        const wakeCommand = extractWakeCommand(heard);
        if (!wakeCommand.matched) continue;
        const now = Date.now();
        if (now - wakeTriggerAtRef.current < 1400) break;
        wakeTriggerAtRef.current = now;
        try { wake.stop(); } catch {}
        if (wakeCommand.command) {
          if (!drivingMode) setOpen(true);
          handleCommand(wakeCommand.command);
        } else {
          speak("I'm listening.");
          if (!drivingMode) {
            setOpen(true);
            setReply("I'm listening.");
          }
          setTimeout(() => startOnce(true), 300);
        }
        break;
      }
    };
    wake.onend = () => {
      if (!alwaysOnRef.current) return;
      wakeRestartRef.current = setTimeout(() => {
        if (alwaysOnRef.current && wakeRef.current === wake && !recRef.current) {
          try { wake.start(); } catch {}
        }
      }, 650);
    };
    wake.onerror = (e) => {
      const code = e?.error || "voice_error";
      if (["not-allowed", "service-not-allowed", "audio-capture"].includes(code)) {
        alwaysOnRef.current = false;
        setWakeBlocked(true);
        if (!drivingMode) {
          setAlwaysOn(false);
          localStorage.setItem("lokin_always_on", "0");
          setOpen(true);
          setReply("Always Listening was turned off because microphone or speech access is unavailable. Enable access in iPhone Settings and try again.");
        }
      }
    };
    wakeRef.current = wake;
    try { wake.start(); } catch {
      setWakeBlocked(true);
      if (!drivingMode) {
        setAlwaysOn(false);
        localStorage.setItem("lokin_always_on", "0");
      }
    }
    return () => {
      if (wakeRestartRef.current) clearTimeout(wakeRestartRef.current);
      wakeRestartRef.current = null;
      try { wake.stop(); } catch {}
      if (wakeRef.current === wake) wakeRef.current = null;
    };
  }, [wakeEnabled, drivingMode]);

  function toggleAlwaysOn() {
    if (!voiceSupported) {
      setOpen(true);
      setReply("Always Listening is unavailable in this app environment. Use the microphone button or Siri shortcuts.");
      return;
    }
    setWakeBlocked(false);
    setAlwaysOn((v) => {
      const next = !v;
      localStorage.setItem("lokin_always_on", next ? "1" : "0");
      if (next) speak("Foreground listening enabled. Say Hey LOKIN while the app is open.");
      return next;
    });
  }

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 z-50 ${full ? "overflow-y-auto bg-black" : "flex items-end justify-center"}`}
            onClick={() => setOpen(false)}
          >
            <div className={`absolute inset-0 ${full ? "bg-black" : "bg-black/60 backdrop-blur-sm"}`} />
            <motion.div
              initial={full ? { opacity: 0 } : { y: "100%" }}
              animate={full ? { opacity: 1 } : { y: 0 }}
              exit={full ? { opacity: 0 } : { y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className={full
                ? "relative mx-auto flex min-h-full w-full max-w-md flex-col bg-black px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
                : "relative w-full max-w-md lokin-card rounded-t-3xl rounded-b-none border-t border-primary/30 p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <img src={LOKIN_NAV_CIRCLE} alt="LOKIN" draggable="false" className="h-8 w-8 object-contain" />
                  <div>
                    <div className="font-display font-black tracking-[0.06em] leading-none">
                      <span className="lokin-wordmark">LOKIN</span> <span className="text-primary">VOICE</span>
                    </div>
                    <div className="lokin-kicker mt-1.5 text-[8px]">UNLOCK YOUR POTENTIAL</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setOpen(false); navigate("/lokin"); }} className="lokin-ghost border-primary/60 text-primary px-3 py-1.5 text-[10px] font-bold tracking-wider active:scale-90">
                    FULL AI →
                  </button>
                  <button onClick={() => setOpen(false)} aria-label="Close LOKIN Voice" className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl text-white/60 active:scale-90">
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Hero emblem with flanking captions (full overlay) */}
              {full && (
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="flex-1 text-right text-[10px] tracking-widest leading-relaxed text-white/40 select-none">FOCUS BUILDS FREEDOM</span>
                  <button
                    onClick={startOnce}
                    disabled={busy}
                    aria-label="Tap to speak"
                    className="relative shrink-0 transition-transform active:scale-95 disabled:opacity-60"
                  >
                    <img src={LOKIN_NAV_CIRCLE} alt="LOKIN voice emblem" draggable="false" className={`h-[200px] w-[200px] object-contain rounded-full ${listening ? "glow-cyan animate-pulse" : "glow-primary"}`} />
                  </button>
                  <span className="flex-1 text-left text-[10px] tracking-widest leading-relaxed text-white/40 select-none">DISCIPLINE UNLOCKS A BETTER YOU</span>
                </div>
              )}
              <div className={`flex flex-col items-center ${full ? "pt-2 pb-5" : "py-4"}`}>
                {!full && (
                  <button
                    onClick={startOnce}
                    disabled={busy}
                    className={`flex h-20 w-20 items-center justify-center rounded-full border-2 transition-all disabled:opacity-60 ${listening ? "border-accent bg-accent/20 glow-cyan animate-pulse" : "border-primary bg-primary/10 glow-primary"}`}
                  >
                    {listening ? <Radio className="h-8 w-8 text-accent animate-pulse" /> : <Mic className="h-8 w-8 text-primary" />}
                  </button>
                )}
                {full ? (
                  <div className="text-[11px] font-bold tracking-[0.28em] text-white/80">
                    {listening ? "LISTENING…" : busy ? "THINKING…" : voiceSupported ? "TAP TO SPEAK" : "VOICE UNAVAILABLE"}
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-white/55">
                    {listening ? "Listening…" : busy ? "Thinking…" : voiceSupported ? "Tap to speak" : "Voice unavailable · use controls"}
                  </div>
                )}
              </div>

              {transcript && (
                <div className="lokin-card rounded-2xl px-3.5 py-2.5 text-sm text-white/80">
                  <span className="lokin-kicker text-primary mr-1.5">YOU</span>{transcript}
                </div>
              )}
              {reply && (
                <div className="mt-2 lokin-card-cyan rounded-2xl px-3.5 py-2.5 text-sm text-white/90 flex items-start justify-between gap-2">
                  <span className="flex-1"><span className="lokin-kicker lokin-kicker-cyan mr-1.5">LOKIN</span>{reply}</span>
                  <button onClick={() => speak(reply)} className="shrink-0 pt-0.5 text-accent/80" aria-label="Speak reply">
                    <Volume2 className="h-4 w-4" />
                  </button>
                </div>
              )}

              {consentRequired && (
                <div className="mt-3 rounded-xl border border-primary/30 bg-primary/[0.06] p-3">
                  <div className="text-xs font-semibold text-white/90">Allow AI processing?</div>
                  <div className="mt-1 text-[11px] leading-relaxed text-white/55">
                    LOKIN will securely send your spoken request and limited context needed to answer it to the app&apos;s configured AI service. You can keep using non-AI voice controls without allowing this.
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      onClick={declineAiProcessing}
                      className="min-h-11 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs font-semibold text-white/65"
                    >
                      Not Now
                    </button>
                    <button
                      onClick={allowAiProcessing}
                      className="min-h-11 rounded-xl border border-primary/40 bg-primary/15 px-3 text-xs font-bold text-primary"
                    >
                      Allow & Retry
                    </button>
                  </div>
                </div>
              )}

              {/* Foreground wake-word toggle */}
              <button
                onClick={toggleAlwaysOn}
                className={`lokin-card rounded-2xl mt-4 w-full flex items-center justify-between px-3 py-2.5 ${alwaysOn ? "border-accent/50 bg-accent/10" : ""}`}
              >
                <span className="flex items-center gap-2 text-sm text-white/80">
                  <Ear className={`h-4 w-4 ${alwaysOn ? "text-accent" : "text-white/40"}`} />
                  Hey LOKIN · App Open
                </span>
                <span className={`text-xs font-bold ${alwaysOn ? "text-accent" : "text-white/40"}`}>
                  {!voiceSupported ? "UNAVAILABLE" : alwaysOn ? "ON" : "OFF"}
                </span>
              </button>
              <div className="mt-1.5 text-center text-[10px] text-white/50">
                Wake-word listening works while LOKIN is open. Use Siri shortcuts for system-level voice launch.
              </div>

              <div className={`grid grid-cols-4 ${full ? "mt-4 gap-3" : "mt-3 gap-2"}`}>
                <button onClick={() => handleCommand("lock in")} className={`${full ? "min-h-[96px] rounded-2xl p-3" : "rounded-xl p-2"} lokin-card border-primary/60 text-center glow-primary`}>
                  <Lock className={`${full ? "h-6 w-6" : "h-4 w-4"} text-primary mx-auto`} />
                  <div className={`lokin-kicker text-primary ${full ? "text-[10px] mt-2" : "text-[9px] mt-1"}`}>LOCK IN</div>
                </button>
                <button onClick={() => handleCommand("pause")} className={`${full ? "min-h-[96px] rounded-2xl p-3" : "rounded-xl p-2"} lokin-card text-center`}>
                  <Pause className={`${full ? "h-6 w-6" : "h-4 w-4"} text-white/70 mx-auto`} />
                  <div className={`lokin-kicker ${full ? "text-[10px] mt-2" : "text-[9px] mt-1"}`}>PAUSE</div>
                </button>
                <button onClick={() => handleCommand("resume")} className={`${full ? "min-h-[96px] rounded-2xl p-3" : "rounded-xl p-2"} lokin-card text-center`}>
                  <Play className={`${full ? "h-6 w-6" : "h-4 w-4"} text-white/70 mx-auto`} />
                  <div className={`lokin-kicker ${full ? "text-[10px] mt-2" : "text-[9px] mt-1"}`}>RESUME</div>
                </button>
                <button onClick={() => handleCommand("tap out")} className={`${full ? "min-h-[96px] rounded-2xl p-3" : "rounded-xl p-2"} lokin-card-danger text-center`}>
                  <Power className={`${full ? "h-6 w-6" : "h-4 w-4"} text-[#FF3B5C] mx-auto`} />
                  <div className={`lokin-kicker text-[#FF3B5C] ${full ? "text-[10px] mt-2" : "text-[9px] mt-1"}`}>TAP OUT</div>
                </button>
              </div>

              <div className="mt-5 flex items-center gap-3 select-none">
                <span className="h-px flex-1 bg-white/15" />
                <span className="lokin-kicker text-[9px]">UNLOCK YOUR POTENTIAL</span>
                <span className="h-px flex-1 bg-white/15" />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}