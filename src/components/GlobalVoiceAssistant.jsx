import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, Radio, X, Volume2, Ear, Pause, Play, Power, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { LokinGlyph } from "@/components/Brand";
import { consumeExternalCommandFromLocation } from "@/lib/lokinCommandBus";
import { validateExternalCommand } from "@/lib/lokinCommandPolicy";
import { guardedInvoke } from "@/lib/creditGuardian";
import { routeLokinIntelligence } from "@/lib/lokinIntelligenceRouter";

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

// Siri/Gemini-style hands-free voice assistant overlay, available app-wide.
// Tap the orb to talk, or enable "Always Listening" for wake-word ("Hey LOKIN") activation.
export default function GlobalVoiceAssistant() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [alwaysOn, setAlwaysOn] = useState(() => localStorage.getItem("lokin_always_on") === "1");
  const [busy, setBusy] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [nativeVoice, setNativeVoice] = useState({ available: false, state: "web-fallback" });
  const recRef = useRef(null);
  const wakeRef = useRef(null);
  const conversationRef = useRef([]);
  const alwaysOnRef = useRef(alwaysOn);
  alwaysOnRef.current = alwaysOn;

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
    const intelligence = routeLokinIntelligence(command);
    try {
      const prefsList = await base44.entities.DriverPreference.filter({});
      const prefs = prefsList[0] || null;
      const me = await base44.auth.me().catch(() => null);

      if (includesAny(t, ["level up", "start work", "start my shift", "begin work"])) {
        const next = { work_status: "working" };
        if (prefs?.id) await base44.entities.DriverPreference.update(prefs.id, next);
        else await base44.entities.DriverPreference.create(next);
        if (me?.id) await base44.entities.DriverSession.create({ user_id: me.id, status: "working", started_at: new Date().toISOString(), source: "voice" });
        const msg = "Leveling up. You're locked in. AI GPS is ready.";
        setReply(msg); speak(msg); setTimeout(() => navigate("/ai-gps?focus=locked"), 350); setBusy(false); return;
      }

      if (includesAny(t, ["lock in", "locked in", "focus mode"])) {
        const msg = "Locked in. Distractions minimized.";
        setReply(msg); speak(msg); setTimeout(() => navigate("/ai-gps?focus=locked"), 300); setBusy(false); return;
      }

      if (includesAny(t, ["lokin pause", "pause work", "pause my shift", "pause"])) {
        if (prefs?.id) await base44.entities.DriverPreference.update(prefs.id, { work_status: "paused" });
        const sessions = me?.id ? await base44.entities.DriverSession.filter({ user_id: me.id, status: "working" }, "-started_at") : [];
        if (sessions?.[0]?.id) await base44.entities.DriverSession.update(sessions[0].id, { status: "paused", paused_at: new Date().toISOString() });
        const msg = "Paused. Take your time. Say LOKIN, resume when you're ready to lock back in.";
        setReply(msg); speak(msg); setTimeout(() => navigate("/break-time"), 300); setBusy(false); return;
      }

      if (includesAny(t, ["resume", "resume work", "continue work", "lock back in"])) {
        if (prefs?.id) await base44.entities.DriverPreference.update(prefs.id, { work_status: "working" });
        const sessions = me?.id ? await base44.entities.DriverSession.filter({ user_id: me.id, status: "paused" }, "-started_at") : [];
        if (sessions?.[0]?.id) await base44.entities.DriverSession.update(sessions[0].id, { status: "working", resumed_at: new Date().toISOString() });
        const msg = "Welcome back. Recalculating and locking you back in.";
        setReply(msg); speak(msg); setTimeout(() => navigate("/ai-gps?focus=locked"), 350); setBusy(false); return;
      }

      if (includesAny(t, ["tap out", "end work", "end my shift", "finish work"])) {
        if (prefs?.id) await base44.entities.DriverPreference.update(prefs.id, { work_status: "off" });
        const sessions = me?.id ? await base44.entities.DriverSession.filter({ user_id: me.id, status: { $in: ["working", "paused"] } }, "-started_at") : [];
        if (sessions?.[0]?.id) await base44.entities.DriverSession.update(sessions[0].id, { status: "ended", ended_at: new Date().toISOString() });
        const msg = "You're tapped out. Nice work today. I'll have your recap ready on the home screen.";
        setReply(msg); speak(msg); setTimeout(() => navigate("/"), 400); setBusy(false); return;
      }
    } catch (e) {
      // fall through to normal assistant handling if a session command fails
    }
    const music = intelligence.lane === "local-music" ? intelligence : matchMusic(command);
    if (music) {
      window.dispatchEvent(new CustomEvent("lokin:music", { detail: { action: music.action } }));
      const musicReply = music.label || music.reply;
      speak(musicReply);
      setReply(musicReply);
      if (music.nav || music.to) setTimeout(() => navigate(music.nav || music.to), 400);
      setBusy(false);
      return;
    }
    const nav = intelligence.lane === "local-navigation" ? { to: intelligence.to, label: intelligence.reply } : matchCommand(command);
    if (nav) {
      speak(nav.label);
      setReply(nav.label);
      setTimeout(() => { navigate(nav.to); }, 500);
      setBusy(false);
      return;
    }
    // Only the reasoning lane may spend an external AI call. All recognized
    // deterministic lanes have already returned above.
    if (intelligence.lane !== "external-ai") {
      setReply("LOKIN couldn't safely route that command.");
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
      const recentConversation = conversationRef.current.slice(-6);
      const res = await guardedInvoke(base44, "external-ai-gateway", {
        mode: intelligence.mode || "assistant",
        command,
        context: {
          todayEarnings,
          dailyGoal: p.daily_goal || 150,
          netPerHour: p.min_per_hour || 22,
          hoursWorked: 0,
          platform: "mixed",
          recentConversation: JSON.stringify(recentConversation).slice(0, 1800),
        },
      });
      const data = res?.data ?? res ?? {};
      const answer = data.reply || "I didn't catch that.";
      conversationRef.current = [...recentConversation, { role: "user", text: command }, { role: "assistant", text: answer }].slice(-8);
      setReply(answer);
      speak(answer);
    } catch (e) {
      const message = e?.response?.data?.error || e?.message || "Something went wrong.";
      setReply(`LOKIN couldn't complete that request: ${message}`);
    } finally {
      setBusy(false);
    }
  }

  async function transcribeRecordedCommand() {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferred = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find((t) => window.MediaRecorder?.isTypeSupported?.(t));
      const recorder = preferred ? new MediaRecorder(stream, { mimeType: preferred }) : new MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
      setListening(true);
      setReply("Listening — speak your command now.");
      recorder.start();
      // Give natural commands a little more room while keeping latency low.
      await new Promise((resolve) => setTimeout(resolve, 6000));
      const stopped = new Promise((resolve) => { recorder.onstop = resolve; });
      recorder.stop();
      await stopped;
      setListening(false);
      const blob = new Blob(chunks, { type: recorder.mimeType || preferred || "audio/webm" });
      if (!blob.size) throw new Error("No microphone audio was captured.");
      const audioBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      setReply("LOKIN heard you. Transcribing…");
      const res = await base44.functions.invoke("voice-transcribe", { audioBase64, mimeType: blob.type });
      const text = String(res?.data?.text || res?.text || "").trim();
      if (!text) throw new Error("I couldn't make out the command.");
      const cleaned = text.replace(/^hey\s+(?:lo+kin|lock\s*in)[,.!?\s-]*/i, "").trim();
      await handleCommand(cleaned || "what should I do next");
    } catch (e) {
      setListening(false);
      const denied = /permission|notallowed|not allowed/i.test(String(e?.name || "") + String(e?.message || ""));
      setReply(denied ? "Microphone access is blocked. Allow microphone access for Base44 in Safari, then tap the talk button again." : `Voice capture failed: ${e?.message || "Please try again."}`);
    } finally {
      stream?.getTracks?.().forEach((t) => t.stop());
    }
  }

  function startOnce() {
    // iOS Safari/Base44 previews can expose SpeechRecognition but never deliver
    // a result. Use recorded-audio transcription there instead of showing a
    // false “Listening…” state forever.
    const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (isiOS || !SR) { transcribeRecordedCommand(); return; }
    setListening(true);
    let gotResult = false;
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.onstart = () => setListening(true);
    rec.onend = () => { setListening(false); if (!gotResult) transcribeRecordedCommand(); };
    rec.onresult = (e) => {
      gotResult = true;
      const text = e.results[0][0].transcript;
      handleCommand(text.replace(/^hey\s+lo+kin[,.!?\s-]*/i, "").trim() || "what should I do next");
    };
    rec.onerror = () => { setListening(false); if (!gotResult) transcribeRecordedCommand(); };
    recRef.current = rec;
    try { rec.start(); } catch { transcribeRecordedCommand(); }
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

  // Native shells report their voice capability through NativeVoiceBridge.
  // The web preview remains a deliberate fallback; it must never pretend that
  // iOS Safari can provide a true background wake word.
  useEffect(() => {
    const onNativeStatus = (e) => setNativeVoice({
      available: Boolean(e?.detail?.available),
      state: e?.detail?.state || "ready",
    });
    window.addEventListener("lokin:native-voice-status", onNativeStatus);
    const available = Boolean(window.LOKINNativeVoice?.isAvailable?.());
    setNativeVoice({ available, state: available ? "ready" : "web-fallback" });
    return () => window.removeEventListener("lokin:native-voice-status", onNativeStatus);
  }, []);

  // Always-on wake-word listener
  useEffect(() => {
    if (nativeVoice.available) {
      if (wakeRef.current) { try { wakeRef.current.stop(); } catch {} wakeRef.current = null; }
      if (alwaysOn) window.LOKINNativeVoice?.startWake?.();
      else window.LOKINNativeVoice?.stopWake?.();
      return () => window.LOKINNativeVoice?.stopWake?.();
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR || !alwaysOn) {
      if (wakeRef.current) { try { wakeRef.current.stop(); } catch {} wakeRef.current = null; }
      return;
    }
    const wake = new SR();
    wake.continuous = true;
    wake.interimResults = true;
    wake.lang = "en-US";
    wake.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript.toLowerCase();
        if (text.includes("lokin")) {
          const after = text.split("lokin")[1].trim();
          try { wake.stop(); } catch {}
          if (after) {
            handleCommand(after);
          } else {
            speak("I'm here.");
            setOpen(true);
            setReply("I'm listening.");
            setTimeout(() => startOnce(), 350);
          }
          break;
        }
      }
    };
    wake.onend = () => {
      if (alwaysOnRef.current) { try { wake.start(); } catch {} }
    };
    wake.onerror = () => {};
    wakeRef.current = wake;
    try { wake.start(); } catch {}
    return () => { try { wake.stop(); } catch {} wakeRef.current = null; };
  }, [alwaysOn, nativeVoice.available]);

  function toggleAlwaysOn() {
    setAlwaysOn((v) => {
      const next = !v;
      localStorage.setItem("lokin_always_on", next ? "1" : "0");
      if (next) {
        speak(nativeVoice.available
          ? "Hands free voice is on. Say Hey LOKIN."
          : "Wake word preview is on. Keep LOKIN open, or tap the microphone on iPhone Safari.");
      }
      return next;
    });
  }

  return (
    <>
      {/* Floating orb */}
      <button
        onClick={() => setOpen(true)}
        aria-label="LOKIN voice assistant"
        className={`fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full border-2 active:scale-95 transition-all ${alwaysOn ? "border-accent bg-accent/15 glow-cyan" : "border-primary/50 bg-card glow-primary"}`}
        style={{ bottom: "calc(6rem + env(safe-area-inset-bottom))" }}
      >
        {alwaysOn ? <Ear className="h-6 w-6 text-accent" /> : <Mic className="h-6 w-6 text-primary" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center"
            onClick={() => setOpen(false)}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md lokin-panel border-t border-primary/30 rounded-t-3xl p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <LokinGlyph size={24} />
                  <span className="font-display font-bold tracking-wider metal-text">LOKIN VOICE</span>
                </div>
                <button onClick={() => setOpen(false)} className="text-white/50 active:scale-90">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Listening orb */}
              <div className="flex flex-col items-center py-4">
                <button
                  onClick={startOnce}
                  disabled={busy}
                  className={`flex h-20 w-20 items-center justify-center rounded-full border-2 transition-all disabled:opacity-60 ${listening ? "border-accent bg-accent/20 glow-cyan animate-pulse" : "border-primary bg-primary/10 glow-primary"}`}
                >
                  {listening ? <Radio className="h-8 w-8 text-accent animate-pulse" /> : <Mic className="h-8 w-8 text-primary" />}
                </button>
                <div className="mt-2 text-xs text-white/55">
                  {listening ? "Listening…" : busy ? "Thinking…" : nativeVoice.available ? "Tap or say Hey LOKIN" : "Tap to speak"}
                </div>
              </div>

              {transcript && (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/80">
                  <span className="text-[10px] text-white/40 mr-1">YOU</span>{transcript}
                </div>
              )}
              {reply && (
                <div className="mt-2 rounded-xl border border-accent/30 bg-accent/[0.06] px-3 py-2 text-sm text-white/90">
                  <span className="text-[10px] text-accent mr-1">LOKIN</span>{reply}
                  <button onClick={() => speak(reply)} className="ml-2 align-middle text-accent/70">
                    <Volume2 className="h-3.5 w-3.5 inline" />
                  </button>
                </div>
              )}

              {/* Always-on toggle */}
              <button
                onClick={toggleAlwaysOn}
                className={`mt-4 w-full flex items-center justify-between rounded-xl border px-3 py-2.5 ${alwaysOn ? "border-accent/50 bg-accent/10" : "border-white/10 bg-white/[0.03]"}`}
              >
                <span className="flex items-center gap-2 text-sm text-white/80">
                  <Ear className={`h-4 w-4 ${alwaysOn ? "text-accent" : "text-white/40"}`} />
                  Always Listening
                </span>
                <span className={`text-xs font-bold ${alwaysOn ? "text-accent" : "text-white/40"}`}>
                  {alwaysOn ? (nativeVoice.available ? "ON · native wake word" : "ON · foreground preview") : "OFF"}
                </span>
              </button>
              {!nativeVoice.available && alwaysOn && (
                <div className="mt-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.05] px-3 py-2 text-[10px] leading-relaxed text-amber-100/70">
                  Browser mode: iPhone Safari cannot provide a reliable system-level “Hey LOKIN” wake word. Tap-to-speak works now; true hands-free wake activation switches on automatically in the native iOS app.
                </div>
              )}

              <div className="mt-3 grid grid-cols-4 gap-2">
                <button onClick={() => handleCommand("lock in")} className="rounded-xl border border-primary/25 bg-primary/[0.06] p-2 text-center"><Lock className="h-4 w-4 text-primary mx-auto"/><div className="text-[9px] text-white/65 mt-1">LOCK IN</div></button>
                <button onClick={() => handleCommand("pause")} className="rounded-xl border border-white/10 bg-white/[0.03] p-2 text-center"><Pause className="h-4 w-4 text-white/60 mx-auto"/><div className="text-[9px] text-white/65 mt-1">PAUSE</div></button>
                <button onClick={() => handleCommand("resume")} className="rounded-xl border border-white/10 bg-white/[0.03] p-2 text-center"><Play className="h-4 w-4 text-white/60 mx-auto"/><div className="text-[9px] text-white/65 mt-1">RESUME</div></button>
                <button onClick={() => handleCommand("tap out")} className="rounded-xl border border-red-500/25 bg-red-500/[0.05] p-2 text-center"><Power className="h-4 w-4 text-red-400 mx-auto"/><div className="text-[9px] text-red-300 mt-1">TAP OUT</div></button>
              </div>

              <div className="mt-2 text-center text-[10px] text-white/35">
                Try “Level up”, “Lock in”, “Pause”, “Resume”, “Tap out”, “find gas”, or “what should I do next”.
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}