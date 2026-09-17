import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, Radio, Volume2, Pause, Play, Power, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";
import VoiceClockHands from "@/components/VoiceClockHands";
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
    // Shared LOKIN voice: user-picked male/female voice + iOS silent-speech workarounds.
    speakText(text, { rate: 1.05 });
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
    rec.continuous = true;
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

const HEADER_URL =
  "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/2306bf887_lokin-voice-header.jpg";
const CENTERPIECE_URL =
  "https://media.base44.com/images/public/6a7a1c830b6bae64604c3139/079c3a913_official-lokin-ticker-clock_247.jpg";

// Visual system lifted from the locked reskin1v5 Voice design
// (Official Lokin app page_reskin1v5), scoped under .lokinvoice-reskin.
const VOICE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Oxanium:wght@400;500;600;700&family=Sora:wght@400;500;600&display=swap');
.lokinvoice-reskin {
  --green: #8fe44e;
  --green-hot: #b9ff82;
  --cyan: #31e7f3;
  --red: #ff4d62;
  --black: #020302;
  --line: rgba(255,255,255,.14);
  font-family: "Sora", sans-serif;
  color: #f8fbf7;
  background: #000;
}
.lokinvoice-reskin button { font: inherit; -webkit-tap-highlight-color: transparent; }
.lokinvoice-reskin .app-shell {
  width: min(100%, 1020px);
  min-height: 100%;
  margin: 0 auto;
  background: linear-gradient(90deg, transparent, rgba(143,228,78,.025) 45%, transparent), #020302;
}
.lokinvoice-reskin .reference-header {
  position: relative; display: block; width: 100%;
  min-height: 0; padding: 0; aspect-ratio: 1170 / 242;
  overflow: hidden; background: #000;
}
.lokinvoice-reskin .reference-header img {
  width: 100%; height: auto; aspect-ratio: 1170 / 242;
  display: block; object-fit: contain;
}
.lokinvoice-reskin .reference-header .header-full-ai-hitbox {
  position: absolute; z-index: 2; left: 72.1%; top: 35.8%;
  width: 25.8%; height: 42.5%; border: 0; border-radius: 999px;
  padding: 0; background: transparent; color: transparent; cursor: pointer;
}
.lokinvoice-reskin .reference-header .header-full-ai-hitbox:focus-visible {
  outline: 2px solid #b9ff82; outline-offset: 2px;
  box-shadow: 0 0 20px rgba(143,228,78,.68);
}
.lokinvoice-reskin .workspace { padding: 20px 26px calc(28px + env(safe-area-inset-bottom)); }
.lokinvoice-reskin .voice-workspace { padding-top: 14px; }
.lokinvoice-reskin .kicker {
  font-family: "Oxanium", sans-serif; font-size: 9px;
  letter-spacing: .22em; text-transform: uppercase; color: rgba(255,255,255,.5);
}
.lokinvoice-reskin .centerpiece {
  position: relative; width: 100vw; max-width: none;
  margin: 0 0 16px calc(50% - 50vw);
  background: #000; display: block; border-radius: 0;
  overflow: visible; isolation: isolate;
}
.lokinvoice-reskin .centerpiece img {
  position: relative; z-index: 1; width: 100%; height: auto; display: block;
  filter: saturate(1.48) contrast(1.09) brightness(1.06);
}
.lokinvoice-reskin .centerpiece::after {
  content: ""; position: absolute; z-index: 2; inset: 0;
  background:
    linear-gradient(90deg,#000 0%,rgba(0,0,0,.62) 1.5%,rgba(0,0,0,.12) 5.5%,transparent 10%,transparent 90%,rgba(0,0,0,.12) 94.5%,rgba(0,0,0,.62) 98.5%,#000 100%),
    linear-gradient(180deg,rgba(0,0,0,.28) 0%,transparent 5%,transparent 93%,rgba(0,0,0,.16) 97%,#000 100%);
  pointer-events: none;
}
.lokinvoice-reskin .clock-face-button {
  position: absolute; z-index: 3; left: 51.3%; top: 54.8%;
  width: 35.2%; aspect-ratio: 1; transform: translate(-50%,-50%);
  padding: 0; border: 1px solid rgba(143,228,78,.35); border-radius: 50%;
  background: radial-gradient(circle,transparent 62%,rgba(143,228,78,.07) 78%,rgba(143,228,78,.16));
  box-shadow: inset 0 0 28px rgba(143,228,78,.08);
  cursor: pointer;
  transition: border-color .2s ease, box-shadow .2s ease, transform .15s ease;
}
.lokinvoice-reskin .clock-face-button:hover,
.lokinvoice-reskin .clock-face-button:focus-visible {
  border-color: rgba(185,255,130,.84);
  box-shadow: inset 0 0 42px rgba(143,228,78,.15), 0 0 24px rgba(143,228,78,.22);
  outline: none;
}
.lokinvoice-reskin .clock-face-button:active { transform: translate(-50%,-50%) scale(.97); }
.lokinvoice-reskin .clock-face-button.listening {
  border-color: var(--cyan);
  box-shadow: inset 0 0 48px rgba(49,231,243,.18), 0 0 30px rgba(49,231,243,.26);
}
.lokinvoice-reskin .clock-face-button:disabled { cursor: default; }
.lokinvoice-reskin .centerpiece-caption {
  position: absolute; z-index: 5; top: 56%;
  width: min(22%, 220px); transform: translateY(-50%);
  padding: 16px 10px; color: rgba(255,255,255,.86);
  font-family: "Oxanium", sans-serif; font-size: clamp(8px,.82vw,12px);
  font-weight: 400; line-height: 1.7; letter-spacing: .28em; text-transform: uppercase;
  text-wrap: balance; text-shadow: 0 1px 2px #000, 0 0 10px #000, 0 0 22px rgba(143,228,78,.2);
  background: radial-gradient(ellipse at center,rgba(0,0,0,.84) 0%,rgba(0,0,0,.55) 44%,transparent 76%);
  pointer-events: none;
}
.lokinvoice-reskin .centerpiece-caption.left { left: max(2.5%, env(safe-area-inset-left)); text-align: left; }
.lokinvoice-reskin .centerpiece-caption.right { right: max(2.5%, env(safe-area-inset-right)); text-align: right; }
.lokinvoice-reskin .listen-state {
  position: absolute; z-index: 4; left: 50%; top: 92%;
  transform: translateX(-50%); color: rgba(255,255,255,.82);
  font-family: "Oxanium", sans-serif; font-size: clamp(7px,.68vw,10px);
  font-weight: 700; letter-spacing: .32em; text-transform: uppercase;
  text-shadow: 0 1px 3px #000, 0 0 12px #000, 0 0 16px rgba(143,228,78,.22);
  white-space: nowrap; pointer-events: none;
}
.lokinvoice-reskin .clock-face-button.listening ~ .listen-state { color: var(--cyan); }
.lokinvoice-reskin .conversation { display: grid; gap: 12px; margin: 4px auto 20px; max-width: 820px; }
.lokinvoice-reskin .voice-conversation { margin-top: 0; }
.lokinvoice-reskin .bubble {
  border: 1px solid var(--line);
  background: linear-gradient(145deg, rgba(18,22,22,.98), rgba(8,10,10,.98));
  padding: 15px 16px; border-radius: 15px;
  display: grid; grid-template-columns: auto 1fr auto; align-items: start; gap: 12px;
  box-shadow: 0 12px 34px rgba(0,0,0,.18);
}
.lokinvoice-reskin .bubble.lokin {
  border-color: rgba(49,231,243,.58);
  background: linear-gradient(145deg, rgba(2,32,36,.88), rgba(5,14,16,.96));
  box-shadow: inset 0 0 28px rgba(49,231,243,.05), 0 0 18px rgba(49,231,243,.08);
}
.lokinvoice-reskin .speaker {
  width: 35px; height: 35px; border-radius: 50%; display: grid; place-items: center;
  color: var(--cyan); border: 1px solid rgba(49,231,243,.25);
  background: rgba(49,231,243,.06); cursor: pointer; flex: 0 0 auto;
}
.lokinvoice-reskin .bubble-label {
  padding-top: 2px; color: var(--green);
  font-family: "Oxanium", sans-serif; font-size: 10px; font-weight: 600; letter-spacing: .16em;
}
.lokinvoice-reskin .lokin .bubble-label { color: var(--cyan); }
.lokinvoice-reskin .bubble-copy { margin: 0; color: rgba(255,255,255,.88); line-height: 1.6; font-size: 14px; overflow-wrap: anywhere; }
.lokinvoice-reskin .consent-card {
  max-width: 820px; margin: 0 auto 20px; padding: 17px;
  border: 1px solid rgba(143,228,78,.35); border-radius: 15px;
  background: linear-gradient(135deg, rgba(10,16,10,.96), rgba(6,10,11,.98));
}
.lokinvoice-reskin .consent-title {
  font-family: "Oxanium", sans-serif; font-size: 11px; letter-spacing: .14em;
  text-transform: uppercase; color: rgba(255,255,255,.9); margin-bottom: 8px;
}
.lokinvoice-reskin .consent-copy { font-size: 12px; line-height: 1.6; color: rgba(255,255,255,.6); margin-bottom: 14px; }
.lokinvoice-reskin .consent-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.lokinvoice-reskin .primary-button {
  border: 0; border-radius: 999px; background: var(--cyan); color: #001013;
  padding: 10px 18px; font-family: "Oxanium", sans-serif; font-weight: 700;
  letter-spacing: .09em; text-transform: uppercase; cursor: pointer; font-size: 12px;
}
.lokinvoice-reskin .subtle-button {
  border: 1px solid var(--line); border-radius: 999px; background: transparent;
  color: rgba(255,255,255,.64); padding: 10px 18px; cursor: pointer; font-size: 12px;
}
.lokinvoice-reskin .wake-card {
  max-width: 820px; margin: 0 auto 14px;
  border: 1px solid var(--line); border-radius: 15px;
  background: linear-gradient(145deg, rgba(18,22,22,.98), rgba(7,9,9,.98));
  padding: 14px 15px;
}
.lokinvoice-reskin .wake-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.lokinvoice-reskin .wake-title { margin-top: 5px; font-family: "Oxanium", sans-serif; font-size: 14px; letter-spacing: .04em; }
.lokinvoice-reskin .wake-title span { color: var(--green); }
.lokinvoice-reskin .wake-help { margin: 11px 0 0; color: rgba(255,255,255,.48); font-size: 11px; line-height: 1.5; }
.lokinvoice-reskin .toggle {
  width: 48px; height: 26px; border: 1px solid rgba(143,228,78,.55); border-radius: 999px;
  background: rgba(143,228,78,.14); padding: 3px; cursor: pointer; flex: 0 0 auto;
}
.lokinvoice-reskin .toggle::after {
  content: ""; display: block; width: 18px; height: 18px; border-radius: 50%;
  background: var(--green); transform: translateX(20px);
  box-shadow: 0 0 12px rgba(143,228,78,.48);
  transition: transform .2s ease, background .2s ease;
}
.lokinvoice-reskin .toggle[aria-pressed="false"] { border-color: var(--line); background: rgba(255,255,255,.04); }
.lokinvoice-reskin .toggle[aria-pressed="false"]::after { transform: translateX(0); background: rgba(255,255,255,.4); box-shadow: none; }
.lokinvoice-reskin .action-grid {
  max-width: 820px; margin: 0 auto;
  display: grid; grid-template-columns: repeat(4,1fr); gap: 10px;
}
.lokinvoice-reskin .action-tile {
  min-height: 92px; border: 1px solid var(--line); border-radius: 14px;
  background: linear-gradient(145deg, rgba(17,21,21,.98), rgba(7,9,9,.98));
  color: rgba(255,255,255,.8); display: grid; place-items: center; align-content: center;
  gap: 9px; cursor: pointer;
  font-family: "Oxanium", sans-serif; font-size: 9px; font-weight: 600;
  letter-spacing: .16em; text-transform: uppercase;
}
.lokinvoice-reskin .action-tile svg { color: rgba(255,255,255,.66); }
.lokinvoice-reskin .action-tile.primary {
  border-color: rgba(143,228,78,.52); color: var(--green);
  box-shadow: inset 0 0 25px rgba(143,228,78,.05);
}
.lokinvoice-reskin .action-tile.primary svg { color: var(--green); }
.lokinvoice-reskin .action-tile.danger {
  border-color: rgba(255,77,98,.42); color: var(--red);
  box-shadow: inset 0 0 22px rgba(255,77,98,.05);
}
.lokinvoice-reskin .action-tile.danger svg { color: var(--red); }
.lokinvoice-reskin .footer-lockup {
  display: flex; align-items: center; gap: 14px;
  max-width: 680px; width: 100%; margin: 22px auto 0;
  color: rgba(255,255,255,.38); font-family: "Oxanium", sans-serif;
  font-size: 8px; letter-spacing: .4em; white-space: nowrap;
}
.lokinvoice-reskin .footer-lockup:before, .lokinvoice-reskin .footer-lockup:after {
  content: ""; height: 1px; flex: 1;
  background: linear-gradient(90deg, transparent, rgba(143,228,78,.55));
}
.lokinvoice-reskin .footer-lockup:after { transform: rotate(180deg); }
@media (max-width: 620px) {
  .lokinvoice-reskin .workspace { padding: 14px 14px calc(24px + env(safe-area-inset-bottom)); }
  .lokinvoice-reskin .voice-workspace { padding-top: 10px; }
  .lokinvoice-reskin .app-header.reference-header { min-height: 0; height: auto; padding: 0; }
  .lokinvoice-reskin .reference-header img { height: auto; }
  .lokinvoice-reskin .centerpiece { border-radius: 0; margin-bottom: 12px; }
  .lokinvoice-reskin .centerpiece-caption {
    top: 53%; width: 27%; padding: 10px 4px;
    font-size: clamp(6.5px,1.9vw,8px); line-height: 1.65; letter-spacing: .18em;
  }
  .lokinvoice-reskin .centerpiece-caption.left { left: max(1.5%, env(safe-area-inset-left)); }
  .lokinvoice-reskin .centerpiece-caption.right { right: max(1.5%, env(safe-area-inset-right)); }
  .lokinvoice-reskin .listen-state { top: 92%; font-size: clamp(6px,1.65vw,7px); letter-spacing: .2em; }
  .lokinvoice-reskin .bubble { grid-template-columns: 48px 1fr; gap: 8px 10px; padding: 14px; }
  .lokinvoice-reskin .bubble .speaker { grid-column: 2; width: 31px; height: 31px; }
  .lokinvoice-reskin .bubble-copy { font-size: 13px; }
  .lokinvoice-reskin .action-grid { grid-template-columns: repeat(2,1fr); }
  .lokinvoice-reskin .action-tile { min-height: 78px; }
  .lokinvoice-reskin .wake-help { font-size: 10px; }
  .lokinvoice-reskin .footer-lockup { font-size: 6px; letter-spacing: .25em; gap: 8px; }
}
`;

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 z-[1100] ${full ? "overflow-y-auto bg-black" : "flex items-end justify-center"}`}
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
                ? "relative mx-auto min-h-full w-full max-w-md bg-black pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)]"
                : "relative w-full max-w-md lokin-card rounded-t-3xl rounded-b-none border-t border-primary/30 p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"}
            >
              {full ? (
                <div className="lokinvoice-reskin">
                  <style>{VOICE_CSS}</style>
                  <div className="app-shell">
                    <header className="app-header reference-header">
                      <img src={HEADER_URL} alt="LOKIN Voice — Unlock Your Potential" draggable="false" />
                      <button
                        className="header-full-ai-hitbox"
                        type="button"
                        aria-label="Open Full AI"
                        onClick={() => { setOpen(false); navigate("/lokin"); }}
                      >
                        Full AI
                      </button>
                    </header>

                    <section className="workspace voice-workspace">
                      <div className="centerpiece">
                        <img src={CENTERPIECE_URL} alt="Chrome LOKIN lock-clock surrounded by green energy" draggable="false" />
                        <VoiceClockHands />
                        <span className="centerpiece-caption left">Focus Builds Freedom</span>
                        <button
                          className={`clock-face-button${listening ? " listening" : ""}`}
                          type="button"
                          aria-label="Tap the LOKIN clock face to speak"
                          aria-pressed={listening ? "true" : "false"}
                          onClick={startOnce}
                          disabled={busy}
                        />
                        <span className="centerpiece-caption right">Discipline Unlocks a Better You</span>
                        <span className="listen-state">
                          {listening ? "LISTENING…" : busy ? "THINKING…" : voiceSupported ? "Tap Watch Face to Speak" : "VOICE UNAVAILABLE"}
                        </span>
                      </div>

                      {(transcript || reply) ? (
                        <section className="conversation voice-conversation" aria-label="Conversation">
                          {transcript && (
                            <article className="bubble">
                              <div className="bubble-label">YOU</div>
                              <p className="bubble-copy">{transcript}</p>
                            </article>
                          )}
                          {reply && (
                            <article className="bubble lokin">
                              <div className="bubble-label">LOKIN</div>
                              <p className="bubble-copy">{reply}</p>
                              <button type="button" className="speaker" aria-label="Read response aloud" onClick={() => speak(reply)}>
                                <Volume2 style={{ width: 19, height: 19 }} />
                              </button>
                            </article>
                          )}
                        </section>
                      ) : null}

                      {consentRequired && (
                        <section className="consent-card" aria-label="AI processing consent">
                          <div className="consent-title">Allow AI processing?</div>
                          <div className="consent-copy">
                            LOKIN will securely send your spoken request and limited context needed to answer it to the app&apos;s configured AI service. You can keep using non-AI voice controls without allowing this.
                          </div>
                          <div className="consent-actions">
                            <button type="button" className="subtle-button" onClick={declineAiProcessing}>Not Now</button>
                            <button type="button" className="primary-button" onClick={allowAiProcessing}>Allow &amp; Retry</button>
                          </div>
                        </section>
                      )}

                      <section className="wake-card" aria-label="Wake word settings">
                        <div className="wake-row">
                          <div>
                            <div className="kicker">Wake word</div>
                            <div className="wake-title">Hey LOKIN · <span>{!voiceSupported ? "Unavailable" : alwaysOn ? "App Open" : "Off"}</span></div>
                          </div>
                          <button
                            className="toggle"
                            type="button"
                            role="switch"
                            aria-checked={alwaysOn}
                            aria-pressed={alwaysOn ? "true" : "false"}
                            aria-label="Toggle Hey LOKIN wake word"
                            onClick={toggleAlwaysOn}
                          />
                        </div>
                        <p className="wake-help">Keep LOKIN ready while the app is open. Tap the centerpiece whenever you want to speak.</p>
                      </section>

                      <section className="action-grid" aria-label="Work controls">
                        <button className="action-tile primary" type="button" onClick={() => handleCommand("lock in")}>
                          <Lock style={{ width: 23, height: 23 }} strokeWidth={1.6} />
                          <span>Lock In</span>
                        </button>
                        <button className="action-tile" type="button" onClick={() => handleCommand("pause")}>
                          <Pause style={{ width: 23, height: 23 }} strokeWidth={1.6} />
                          <span>Pause</span>
                        </button>
                        <button className="action-tile" type="button" onClick={() => handleCommand("resume")}>
                          <Play style={{ width: 23, height: 23 }} strokeWidth={1.6} />
                          <span>Resume</span>
                        </button>
                        <button className="action-tile danger" type="button" onClick={() => handleCommand("tap out")}>
                          <Power style={{ width: 23, height: 23 }} strokeWidth={1.8} />
                          <span>Tap Out</span>
                        </button>
                      </section>

                      <div className="footer-lockup">UNLOCK YOUR POTENTIAL</div>
                    </section>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-col items-center py-4">
                    <button
                      onClick={startOnce}
                      disabled={busy}
                      className={`flex h-20 w-20 items-center justify-center rounded-full border-2 transition-all disabled:opacity-60 ${listening ? "border-accent bg-accent/20 glow-cyan animate-pulse" : "border-primary bg-primary/10 glow-primary"}`}
                    >
                      {listening ? <Radio className="h-8 w-8 text-accent animate-pulse" /> : <Mic className="h-8 w-8 text-primary" />}
                    </button>
                    <div className="mt-2 text-xs text-white/55">
                      {listening ? "Listening…" : busy ? "Thinking…" : voiceSupported ? "Tap to speak" : "Voice unavailable · use controls"}
                    </div>
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

                  <button
                    onClick={toggleAlwaysOn}
                    className={`lokin-card rounded-2xl mt-4 w-full flex items-center justify-between px-3 py-2.5 ${alwaysOn ? "border-accent/50 bg-accent/10" : ""}`}
                  >
                    <span className="flex items-center gap-2 text-sm text-white/80">
                      <Mic className={`h-4 w-4 ${alwaysOn ? "text-accent" : "text-white/40"}`} />
                      Hey LOKIN · App Open
                    </span>
                    <span className={`text-xs font-bold ${alwaysOn ? "text-accent" : "text-white/40"}`}>
                      {!voiceSupported ? "UNAVAILABLE" : alwaysOn ? "ON" : "OFF"}
                    </span>
                  </button>
                  <div className="mt-1.5 text-center text-[10px] text-white/50">
                    Wake-word listening works while LOKIN is open. Use Siri shortcuts for system-level voice launch.
                  </div>

                  <div className="grid grid-cols-4 mt-3 gap-2">
                    <button onClick={() => handleCommand("lock in")} className="lk-tile h-[72px]" style={{ fontSize: 11, gap: 4 }}>
                      <Lock className="h-4 w-4" strokeWidth={1.6} />
                      <span>LOCK IN</span>
                    </button>
                    <button onClick={() => handleCommand("pause")} className="lk-tile-inactive h-[72px]" style={{ fontSize: 11, gap: 4 }}>
                      <Pause className="h-4 w-4" strokeWidth={1.6} />
                      <span>PAUSE</span>
                    </button>
                    <button onClick={() => handleCommand("resume")} className="lk-tile-inactive h-[72px]" style={{ fontSize: 11, gap: 4 }}>
                      <Play className="h-4 w-4" strokeWidth={1.6} />
                      <span>RESUME</span>
                    </button>
                    <button onClick={() => handleCommand("tap out")} className="lk-tile-danger h-[72px]" style={{ fontSize: 11, gap: 4 }}>
                      <Power className="h-4 w-4" strokeWidth={1.8} />
                      <span>TAP OUT</span>
                    </button>
                  </div>

                  <div className="mt-5 flex items-center gap-3 select-none">
                    <span className="h-px flex-1 bg-white/15" />
                    <span className="lokin-kicker text-[9px]">UNLOCK YOUR POTENTIAL</span>
                    <span className="h-px flex-1 bg-white/15" />
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}