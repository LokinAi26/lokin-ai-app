import { useEffect, useRef, useState } from "react";
import { Mic, Send, Volume2, Radio, ThumbsUp, ThumbsDown, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import AiKeyboardBar from "@/components/AiKeyboardBar";
import VoiceWaveform from "@/components/VoiceWaveform";
import { guardedInvoke } from "@/lib/creditGuardian";
import { setAiConsent } from "@/lib/aiConsent";
import { speakText, setStoredVoiceURI, getStoredVoiceURI } from "@/lib/lokinVoice";

const QUICK = [
  "What should I do next?",
  "How much have I made?",
  "How much more do I need?",
  "What's my best route?",
  "Am I on pace for my goal?",
  "Tell my customer I'm five minutes away.",
  "Tell my customer I'm waiting for the order.",
  "Tell my customer traffic is slowing me down.",
  "Tell my customer I'm outside.",
];

const EMBLEM_URL =
  "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/92b953e33_lokin-fullai-emblem.jpg";
const BG_URL =
  "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/3ed491a2b_fullai-background-final.jpg";
const HEADER_LOCKUP_URL = "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/71d6f52bf_official-lokin-fullai-header-lockup_247.jpg";

// Visual system lifted from the locked reskin1v5 Full AI design
// (Official Lokin app page_reskin1v5), scoped under .lokinai-reskin.
const RESKIN_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Oxanium:wght@400;500;600;700&family=Sora:wght@400;500;600&display=swap');
.lokinai-reskin {
  --green: #8fe44e;
  --green-hot: #b9ff82;
  --cyan: #31e7f3;
  --red: #ff4d62;
  --black: #020302;
  --panel: #090c0d;
  --panel-2: #0d1214;
  --line: rgba(255,255,255,.14);
  --muted: rgba(241,247,239,.58);
  --chrome: linear-gradient(180deg,#fff 0%,#848b8d 44%,#f4f6f6 56%,#717779 100%);
  font-family: "Sora", sans-serif;
  color: #f8fbf7;
}
.lokinai-reskin button, .lokinai-reskin input, .lokinai-reskin select { font: inherit; }
.lokinai-reskin button { -webkit-tap-highlight-color: transparent; }
.lokinai-reskin .fullai-page {
  display: flex; flex-direction: column;
  min-height: calc(100dvh - 9rem);
  background-size: cover; background-position: center; background-repeat: no-repeat; background-attachment: fixed;
}
.lokinai-reskin .app-header {
  display: flex; align-items: center; justify-content: space-between;
  min-height: 88px; padding: 14px 27px 13px;
  border-bottom: 0; background: #000; flex: 0 0 auto;
}
.lokinai-reskin .brand { display: flex; align-items: center; min-width: 0; gap: 13px; }
.lokinai-reskin .brand-mark {
  width: 45px; height: 59px; flex: 0 0 auto; object-fit: contain;
  mix-blend-mode: screen;
  filter: saturate(1.22) contrast(1.08) drop-shadow(0 0 8px rgba(143,228,78,.42));
  clip-path: circle(46% at 50% 50%);
}
.lokinai-reskin .wordmark {
  font-family: "Oxanium", sans-serif;
  font-size: clamp(24px, 3.1vw, 31px); font-weight: 700;
  line-height: .95; letter-spacing: .055em; white-space: nowrap;
}
.lokinai-reskin .chrome {
  background: var(--chrome);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.lokinai-reskin .wordmark .ai { color: var(--green); text-shadow: 0 0 16px rgba(143,228,78,.35); }
.lokinai-reskin .tagline {
  margin-top: 7px; color: rgba(255,255,255,.58);
  font-family: "Oxanium", sans-serif; font-size: 8px; font-weight: 500;
  letter-spacing: .42em; white-space: nowrap;
}
.lokinai-reskin .learning-badge {
  display: flex; align-items: center; gap: 8px;
  border: 1px solid rgba(143,228,78,.32); background: rgba(12,17,13,.9);
  color: rgba(255,255,255,.72); border-radius: 999px; padding: 9px 12px;
  font-family: "Oxanium", sans-serif; font-size: 10px;
  letter-spacing: .08em; text-transform: uppercase; flex: 0 0 auto;
}
.lokinai-reskin .pulse-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--green); box-shadow: 0 0 10px var(--green); flex: 0 0 auto;
}
.lokinai-reskin .pulse-dot.off { background: var(--red); box-shadow: 0 0 10px var(--red); }
.lokinai-reskin .workspace {
  flex: 1 1 auto; min-height: 0;
  display: flex; flex-direction: column;
  padding: 20px 26px calc(28px + env(safe-area-inset-bottom));
}
.lokinai-reskin .voice-row {
  display: grid; grid-template-columns: auto minmax(160px,1fr) auto; align-items: center; gap: 14px;
  border: 1px solid var(--line);
  background: linear-gradient(180deg, rgba(16,20,20,.92), rgba(7,9,9,.92));
  padding: 12px 13px 12px 16px; border-radius: 14px; flex: 0 0 auto;
}
.lokinai-reskin .voice-label { display: flex; align-items: center; gap: 9px; color: var(--cyan); }
.lokinai-reskin .kicker {
  font-family: "Oxanium", sans-serif; font-size: 9px;
  letter-spacing: .22em; text-transform: uppercase; color: rgba(255,255,255,.5);
}
.lokinai-reskin .select-wrap { position: relative; border-left: 1px solid var(--line); padding-left: 16px; min-width: 0; }
.lokinai-reskin .select-wrap:after {
  content: "\u2304"; position: absolute; right: 2px; top: -2px;
  color: rgba(255,255,255,.5); pointer-events: none;
}
.lokinai-reskin select {
  appearance: none; -webkit-appearance: none;
  width: 100%; min-width: 0; border: 0; outline: 0;
  color: #f5f8f5; background: transparent; font-size: 14px; cursor: pointer;
  padding: 2px 18px 2px 0; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;
}
.lokinai-reskin select option { background: #0d1214; color: #f5f8f5; }
.lokinai-reskin .ghost-button {
  border: 1px solid rgba(49,231,243,.48); background: rgba(49,231,243,.06); color: var(--cyan);
  padding: 10px 14px; border-radius: 999px; cursor: pointer;
  font-family: "Oxanium", sans-serif; font-size: 11px; font-weight: 600;
  letter-spacing: .08em; text-transform: uppercase; white-space: nowrap;
}
.lokinai-reskin .ghost-button:hover { background: rgba(49,231,243,.12); }
.lokinai-reskin .convo-scroll {
  flex: 1 1 auto; min-height: 0; overflow-y: auto;
  scrollbar-width: none; margin: 0 -4px; padding: 0 4px;
}
.lokinai-reskin .convo-scroll::-webkit-scrollbar { display: none; }
.lokinai-reskin .conversation { display: grid; gap: 12px; margin: 14px auto 20px; max-width: 820px; }
.lokinai-reskin .empty-prompt {
  text-align: center; color: rgba(255,255,255,.6);
  font-size: 14px; line-height: 1.7; padding: 26px 0;
}
.lokinai-reskin .empty-prompt span { color: var(--green); font-weight: 600; }
.lokinai-reskin .bubble {
  border: 1px solid var(--line);
  background: linear-gradient(145deg, rgba(18,22,22,.98), rgba(8,10,10,.98));
  padding: 15px 16px; border-radius: 15px;
  display: grid; grid-template-columns: auto 1fr auto; align-items: start; gap: 12px;
  box-shadow: 0 12px 34px rgba(0,0,0,.18);
}
.lokinai-reskin .bubble.lokin {
  border-color: rgba(49,231,243,.58);
  background: linear-gradient(145deg, rgba(2,32,36,.88), rgba(5,14,16,.96));
  box-shadow: inset 0 0 28px rgba(49,231,243,.05), 0 0 18px rgba(49,231,243,.08);
}
.lokinai-reskin .speaker {
  width: 35px; height: 35px; border-radius: 50%; display: grid; place-items: center;
  color: var(--cyan); border: 1px solid rgba(49,231,243,.25);
  background: rgba(49,231,243,.06); cursor: pointer; flex: 0 0 auto;
}
.lokinai-reskin .bubble-label {
  padding-top: 2px; color: var(--green);
  font-family: "Oxanium", sans-serif; font-size: 10px; font-weight: 600; letter-spacing: .16em;
}
.lokinai-reskin .lokin .bubble-label { color: var(--cyan); }
.lokinai-reskin .bubble-copy { margin: 0; color: rgba(255,255,255,.88); line-height: 1.6; font-size: 14px; overflow-wrap: anywhere; }
.lokinai-reskin .teach-row { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
.lokinai-reskin .teach-row button {
  border: 0; color: rgba(255,255,255,.5); background: transparent; padding: 3px; cursor: pointer;
  display: grid; place-items: center;
}
.lokinai-reskin .teach-row button:disabled { opacity: .8; cursor: default; }
.lokinai-reskin .teach-row button.active-good { color: var(--green); }
.lokinai-reskin .teach-row button.active-bad { color: var(--red); }
.lokinai-reskin .learned-tag { font-size: 9px; color: rgba(255,255,255,.5); letter-spacing: .08em; }
.lokinai-reskin .status-line {
  display: flex; align-items: center; gap: 8px;
  padding: 2px 4px; color: var(--cyan); font-size: 12px;
}
.lokinai-reskin .draft-card {
  max-width: 820px; margin: 0 auto 20px; padding: 17px;
  border: 1px solid rgba(49,231,243,.55); border-radius: 15px;
  background: linear-gradient(135deg, rgba(5,25,29,.94), rgba(6,10,11,.98));
}
.lokinai-reskin .draft-card p { margin: 10px 0 15px; line-height: 1.6; color: rgba(255,255,255,.86); font-size: 14px; }
.lokinai-reskin .draft-actions { display: flex; justify-content: flex-end; gap: 10px; }
.lokinai-reskin .primary-button {
  border: 0; border-radius: 999px; background: var(--cyan); color: #001013;
  padding: 10px 18px; font-family: "Oxanium", sans-serif; font-weight: 700;
  letter-spacing: .09em; text-transform: uppercase; cursor: pointer; font-size: 12px;
}
.lokinai-reskin .subtle-button {
  border: 1px solid var(--line); border-radius: 999px; background: transparent;
  color: rgba(255,255,255,.64); padding: 10px 18px; cursor: pointer; font-size: 12px;
}
.lokinai-reskin .consent-card {
  max-width: 820px; margin: 0 auto 20px; padding: 17px;
  border: 1px solid rgba(143,228,78,.35); border-radius: 15px;
  background: linear-gradient(135deg, rgba(10,16,10,.96), rgba(6,10,11,.98));
}
.lokinai-reskin .consent-title {
  font-family: "Oxanium", sans-serif; font-size: 11px; letter-spacing: .14em;
  text-transform: uppercase; color: rgba(255,255,255,.9); margin-bottom: 8px;
}
.lokinai-reskin .consent-copy { font-size: 12px; line-height: 1.6; color: rgba(255,255,255,.6); margin-bottom: 14px; }
.lokinai-reskin .consent-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.lokinai-reskin .quick-section { max-width: 820px; width: 100%; margin: 0 auto 16px; flex: 0 0 auto; }
.lokinai-reskin .quick-label { margin-bottom: 10px; text-align: center; }
.lokinai-reskin .quick-grid { display: flex; flex-wrap: wrap; justify-content: center; gap: 9px; }
.lokinai-reskin .quick-chip {
  border: 1px solid rgba(255,255,255,.17); background: rgba(10,13,13,.94);
  color: rgba(255,255,255,.75); border-radius: 999px;
  padding: 10px 14px; cursor: pointer; font-size: 12px;
}
.lokinai-reskin .quick-chip:hover { border-color: rgba(143,228,78,.45); color: var(--green-hot); }
.lokinai-reskin .quick-chip:disabled { opacity: .5; }
.lokinai-reskin .composer { max-width: 820px; width: 100%; margin: 0 auto; display: grid; grid-template-columns: 1fr; gap: 10px; align-items: center; flex: 0 0 auto; }
.lokinai-reskin .input-wrap {
  border: 1px solid var(--line); border-radius: 16px;
  background: linear-gradient(180deg, rgba(16,20,20,.98), rgba(7,9,9,.98));
  padding: 7px 8px 7px 15px;
  display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: 8px; min-width: 0;
}
.lokinai-reskin .input-wrap input {
  width: 100%; min-width: 0; border: 0; outline: 0;
  background: transparent; color: #fff; padding: 8px 0; font-size: 14px;
}
.lokinai-reskin .input-wrap input::placeholder { color: rgba(255,255,255,.32); }
.lokinai-reskin .send {
  width: 38px; height: 38px; border-radius: 11px; border: 0;
  background: rgba(143,228,78,.14); color: var(--green);
  display: grid; place-items: center; cursor: pointer; flex: 0 0 auto;
}
.lokinai-reskin .send.ready { background: var(--green); color: #071006; box-shadow: 0 0 18px rgba(143,228,78,.3); }
.lokinai-reskin .send:disabled { opacity: .5; }
.lokinai-reskin .mic-button {
  width: 38px; height: 38px; border-radius: 50%;
  border: 1px solid rgba(143,228,78,.4); background: rgba(143,228,78,.1); color: var(--green);
  display: grid; place-items: center; cursor: pointer; flex: 0 0 auto;
}
.lokinai-reskin .mic-button.listening {
  background: var(--green); color: #071006;
  box-shadow: 0 0 18px rgba(143,228,78,.4);
}
.lokinai-reskin .mic-button:disabled { opacity: .5; }
.lokinai-reskin .footer-lockup {
  display: flex; align-items: center; gap: 14px;
  max-width: 680px; width: 100%; margin: 22px auto 0;
  color: rgba(255,255,255,.38); font-family: "Oxanium", sans-serif;
  font-size: 8px; letter-spacing: .4em; white-space: nowrap; flex: 0 0 auto;
}
.lokinai-reskin .footer-lockup:before, .lokinai-reskin .footer-lockup:after {
  content: ""; height: 1px; flex: 1;
  background: linear-gradient(90deg, transparent, rgba(143,228,78,.55));
}
.lokinai-reskin .footer-lockup:after { transform: rotate(180deg); }
.lokinai-reskin .back-button {
  width: 38px; height: 38px; border-radius: 50%; flex: 0 0 auto;
  border: 1px solid rgba(255,255,255,.17); background: rgba(10,13,13,.9);
  color: rgba(255,255,255,.75); display: grid; place-items: center; cursor: pointer;
}
.lokinai-reskin .back-button:hover { border-color: rgba(143,228,78,.45); color: var(--green-hot); }
@media (max-width: 620px) {
  .lokinai-reskin .app-header { min-height: 70px; padding: 9px 14px 8px; }
  .lokinai-reskin .brand { gap: 8px; }
  .lokinai-reskin .brand-mark { width: 32px; height: 42px; }
  .lokinai-reskin .wordmark { font-size: 21px; letter-spacing: .04em; }
  .lokinai-reskin .tagline { margin-top: 5px; font-size: 5.5px; letter-spacing: .3em; }
  .lokinai-reskin .learning-badge { padding: 8px 9px; font-size: 0; }
  .lokinai-reskin .learning-badge:after { content: "V2"; font-size: 9px; }
  .lokinai-reskin .workspace { padding: 14px 14px calc(24px + env(safe-area-inset-bottom)); }
  .lokinai-reskin .voice-row { grid-template-columns: auto 1fr auto; gap: 10px; padding-left: 13px; }
  .lokinai-reskin .voice-label .kicker { display: none; }
  .lokinai-reskin .ghost-button { padding: 9px 11px; font-size: 9px; }
  .lokinai-reskin .bubble { grid-template-columns: 48px 1fr; gap: 8px 10px; padding: 14px; }
  .lokinai-reskin .bubble .speaker { grid-column: 2; width: 31px; height: 31px; }
  .lokinai-reskin .bubble-copy { font-size: 13px; }
  .lokinai-reskin .quick-grid { justify-content: flex-start; }
  .lokinai-reskin .quick-chip { font-size: 11px; padding: 9px 11px; }
  .lokinai-reskin .composer { grid-template-columns: 1fr; gap: 8px; }
  .lokinai-reskin .footer-lockup { font-size: 6px; letter-spacing: .25em; gap: 8px; }
  .lokinai-reskin .back-button { width: 32px; height: 32px; }
}
@media (max-width: 380px) {
  .lokinai-reskin .learning-badge { display: none; }
  .lokinai-reskin .voice-row { grid-template-columns: auto minmax(0,1fr); }
  .lokinai-reskin .ghost-button { grid-column: 1 / -1; width: 100%; }
  .lokinai-reskin .quick-chip { width: 100%; text-align: left; }
}
`;
export default function LokinAI() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState([]); // { role, text, draft }
  const [draft, setDraft] = useState(null);
  const recRef = useRef(null);
  const scrollRef = useRef(null);
  const [voices, setVoices] = useState([]);
  const [voiceURI, setVoiceURI] = useState(() => localStorage.getItem("lokin_voice") || "");
  const [learning, setLearning] = useState({ enabled: true, memoryCount: 0, profileVersion: 1 });
  const [consentRequired, setConsentRequired] = useState(false);
  const [pendingAiCommand, setPendingAiCommand] = useState("");
  const navigate = useNavigate();

  function goBack() {
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  }

  useEffect(() => {
    base44.functions.invoke("learning-intelligence", { action: "context" })
      .then((res) => setLearning({
        enabled: res.data?.learning_enabled !== false,
        memoryCount: res.data?.memories?.length || 0,
        profileVersion: res.data?.profile?.version || 1,
      }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    function loadVoices() { setVoices(window.speechSynthesis?.getVoices() || []); }
    loadVoices();
    window.speechSynthesis?.addEventListener?.("voiceschanged", loadVoices);
    return () => window.speechSynthesis?.removeEventListener?.("voiceschanged", loadVoices);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [log, draft]);

  async function ask(command) {
    if (!command.trim()) return;
    setBusy(true);
    setLog((l) => [...l, { role: "you", text: command }]);
    setTranscript("");
    try {
      // gather lightweight context from earnings + prefs
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
      setLog((l) => [...l, { role: "lokin", text: data.reply, input: command, feedback: null }]);
      if (data.learning) setLearning((prev) => ({ ...prev, ...data.learning }));
      if (data.draftedMessage) setDraft(data.draftedMessage);
    } catch (e) {
      if (e?.code === "LOKIN_AI_CONSENT_REQUIRED") {
        setPendingAiCommand(command);
        setConsentRequired(true);
        setLog((l) => [...l, { role: "lokin", text: "To answer open-ended requests, LOKIN needs permission to securely process your request with its configured AI service." }]);
      } else if (e?.code === "LOKIN_CREDIT_DEFERRED") {
        setLog((l) => [...l, { role: "lokin", text: "AI assistance is temporarily unavailable, but core LOKIN navigation and deterministic voice controls still work." }]);
      } else {
        console.error("LOKIN AI request failed", e);
        setLog((l) => [...l, { role: "lokin", text: "I heard you, but the AI response service did not complete the request. Try again in a moment." }]);
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
    if (retry) window.setTimeout(() => ask(retry), 120);
  }

  function declineAiProcessing() {
    setAiConsent("denied");
    setConsentRequired(false);
    setPendingAiCommand("");
    setLog((l) => [...l, { role: "lokin", text: "AI processing stays off. You can still use LOKIN's non-AI navigation and app controls." }]);
  }

  async function sendFeedback(index, rating) {
    const message = log[index];
    if (!message || message.role !== "lokin" || message.feedback) return;
    setLog((items) => items.map((item, i) => i === index ? { ...item, feedback: rating } : item));
    try {
      const res = await base44.functions.invoke("learning-intelligence", {
        action: "feedback",
        feature: "assistant",
        input_text: message.input || "",
        response_text: message.text || "",
        rating,
        topic: "assistant-response-style",
      });
      if (res.data?.profile) {
        setLearning((prev) => ({
          ...prev,
          enabled: res.data.profile.learning_enabled !== false,
          profileVersion: res.data.profile.version || prev.profileVersion,
          memoryCount: Math.max(prev.memoryCount, 1),
        }));
      }
    } catch {
      setLog((items) => items.map((item, i) => i === index ? { ...item, feedback: null } : item));
    }
  }

  function startListening() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      ask("What should I do next?");
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onresult = (e) => {
      const text = e.results[0][0].transcript;
      setTranscript(text);
      ask(text);
    };
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
  }

  function speak(text) {
    // Shared LOKIN voice: respects the global male/female pick + iOS workarounds.
    speakText(text, { rate: 1.05 });
  }

  function pickVoice(uri) {
    setVoiceURI(uri);
    localStorage.setItem("lokin_voice", uri);
    speak("LOKIN online. Locked in.");
  }

  return (
    <div className="lokinai-reskin">
      <style>{RESKIN_CSS}</style>
      <div
        className="fullai-page"
        style={{
          backgroundImage: `linear-gradient(rgba(0,0,0,0.65), rgba(0,0,0,0.65)), url('${BG_URL}')`,
        }}
      >
        <header className="app-header">
          <div className="brand">
            <button type="button" className="back-button" onClick={goBack} aria-label="Go back">
              <ChevronLeft style={{ width: 20, height: 20 }} />
            </button>
            <img src={HEADER_LOCKUP_URL} alt="LOKIN AI — Unlock your potential" style={{ height: '44px', width: 'auto', objectFit: 'contain' }} />
          </div>
          <div className="learning-badge">
            <span className={`pulse-dot${learning.enabled ? "" : " off"}`}></span>
            Learning v2 {learning.enabled ? "ON" : "OFF"}
          </div>
        </header>

        <section className="workspace">
          <div className="voice-row">
            <div className="voice-label">
              <Volume2 style={{ width: 20, height: 20 }} aria-hidden="true" />
              <span className="kicker">Voice</span>
            </div>
            <label className="select-wrap">
              <select
                value={voiceURI || "default"}
                onChange={(e) => pickVoice(e.target.value === "default" ? "" : e.target.value)}
                aria-label="Voice selection"
              >
                <option value="default">System default</option>
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
                ))}
              </select>
            </label>
            <button className="ghost-button" type="button" onClick={() => speak("LOKIN online. Locked in.")}>
              Preview
            </button>
          </div>

          <div ref={scrollRef} className="convo-scroll">
            <section className="conversation" aria-label="Conversation">
              {log.length === 0 && !busy && !listening && (
                <p className="empty-prompt">
                  Tap the mic and say <span>&ldquo;LOKIN&hellip;&rdquo;</span>
                  <br />or tap a quick command below.
                </p>
              )}
              {log.map((m, i) => (
                <article key={i} className={`bubble${m.role === "lokin" ? " lokin" : ""}`}>
                  <div className="bubble-label">{m.role === "you" ? "YOU" : "LOKIN"}</div>
                  <div>
                    <p className="bubble-copy">{m.text}</p>
                    {m.role === "lokin" && (
                      <div className="teach-row" aria-label="Response feedback">
                        <button
                          type="button" aria-label="Helpful" title="Helpful — teach LOKIN"
                          onClick={() => sendFeedback(i, 1)} disabled={!!m.feedback}
                          className={m.feedback === 1 ? "active-good" : ""}
                        >
                          <ThumbsUp style={{ width: 17, height: 17 }} />
                        </button>
                        <button
                          type="button" aria-label="Not helpful" title="Not helpful — teach LOKIN"
                          style={{ transform: "rotate(180deg)" }}
                          onClick={() => sendFeedback(i, -1)} disabled={!!m.feedback}
                          className={m.feedback === -1 ? "active-bad" : ""}
                        >
                          <ThumbsDown style={{ width: 17, height: 17 }} />
                        </button>
                        {m.feedback ? <span className="learned-tag">learned</span> : null}
                      </div>
                    )}
                  </div>
                  {m.role === "lokin" && (
                    <button type="button" className="speaker" aria-label="Read response aloud" onClick={() => speak(m.text)}>
                      <Volume2 style={{ width: 19, height: 19 }} />
                    </button>
                  )}
                </article>
              ))}
              {listening && (
                <div className="status-line"><VoiceWaveform active bars={7} /><span>Listening&hellip;</span></div>
              )}
              {busy && (
                <div className="status-line"><Radio style={{ width: 12, height: 12 }} className="animate-pulse" /><span>LOKIN is thinking&hellip;</span></div>
              )}
            </section>

            {draft && (
              <section className="draft-card" aria-label="Drafted message">
                <div className="kicker" style={{ color: "var(--cyan)" }}>Drafted message</div>
                <p>{draft}</p>
                <div className="draft-actions">
                  <button type="button" className="subtle-button" onClick={() => setDraft(null)}>Discard</button>
                  <button
                    type="button" className="primary-button"
                    onClick={() => { speak("Message sent."); setLog((l) => [...l, { role: "lokin", text: "Sent." }]); setDraft(null); }}
                  >
                    Send
                  </button>
                </div>
              </section>
            )}

            {consentRequired && (
              <section className="consent-card" aria-label="AI processing consent">
                <div className="consent-title">Allow AI processing?</div>
                <div className="consent-copy">
                  LOKIN will securely send your request and limited context needed to answer it to the app&apos;s configured AI service. Non-AI navigation controls remain available if you decline.
                </div>
                <div className="consent-actions">
                  <button type="button" className="subtle-button" onClick={declineAiProcessing}>Not Now</button>
                  <button type="button" className="primary-button" onClick={allowAiProcessing}>Allow &amp; Retry</button>
                </div>
              </section>
            )}
          </div>

          <section className="quick-section">
            <div className="kicker quick-label">Quick commands</div>
            <div className="quick-grid">
              {QUICK.map((q) => (
                <button key={q} type="button" className="quick-chip" onClick={() => ask(q)} disabled={busy}>
                  {q}
                </button>
              ))}
            </div>
          </section>

          <form
            className="composer"
            onSubmit={(e) => { e.preventDefault(); ask(transcript); }}
          >
            <AiKeyboardBar value={transcript} onApply={setTranscript} disabled={busy} />
            <div className="input-wrap">
              <input
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Ask LOKIN anything…"
                aria-label="Message"
              />
              <button
                type="button"
                className={`mic-button${listening ? " listening" : ""}`}
                onClick={startListening}
                disabled={busy}
                aria-label="Tap to speak"
              >
                <Mic style={{ width: 18, height: 18 }} />
              </button>
              <button
                type="submit"
                className={`send${transcript.trim() ? " ready" : ""}`}
                disabled={busy}
                aria-label="Send message"
              >
                <Send style={{ width: 19, height: 19 }} />
              </button>
            </div>
          </form>

          <div className="footer-lockup">UNLOCK YOUR POTENTIAL</div>
        </section>
      </div>
    </div>
  );
}