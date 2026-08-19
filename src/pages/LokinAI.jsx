import { useEffect, useRef, useState } from "react";
import { Mic, Send, Volume2, Radio, ThumbsUp, ThumbsDown, Brain } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { LokinGlyph } from "@/components/Brand";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import AiKeyboardBar from "@/components/AiKeyboardBar";
import VoiceWaveform from "@/components/VoiceWaveform";
import { guardedInvoke } from "@/lib/creditGuardian";

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
      setLog((l) => [...l, { role: "lokin", text: `Error: ${e.message}` }]);
    } finally {
      setBusy(false);
    }
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
    try {
      const u = new SpeechSynthesisUtterance(text.replace(/[*#_`]/g, ""));
      u.rate = 1.05;
      const v = voices.find((x) => x.voiceURI === voiceURI);
      if (v) u.voice = v;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch {}
  }

  function pickVoice(uri) {
    setVoiceURI(uri);
    localStorage.setItem("lokin_voice", uri);
    speak("LOKIN online. Locked in.");
  }

  return (
    <div className="p-4 space-y-4 flex flex-col min-h-[calc(100dvh-9rem)]">
      <div className="flex items-center gap-2">
        <LokinGlyph size={22} />
        <h1 className="text-xl font-bold font-heading metal-text">LOKIN AI</h1>
        <span className="text-[11px] text-accent/80 tracking-wide">voice assistant</span>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-accent/20 bg-accent/[0.06] px-2 py-1 text-[10px] text-accent/80">
          <Brain className="h-3 w-3" />
          Learning v2 {learning.enabled ? "ON" : "OFF"} · profile {learning.profileVersion}
        </span>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <Volume2 className="h-3.5 w-3.5 shrink-0 text-accent/70" />
        <span className="text-white/60 shrink-0">Voice</span>
        <Select value={voiceURI || "default"} onValueChange={(v) => pickVoice(v === "default" ? "" : v)}>
          <SelectTrigger className="flex-1 min-w-0 rounded-lg border-white/10 bg-white/[0.03] text-white/80 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-neutral-900 border-white/10 text-white">
            <SelectItem value="default">System default</SelectItem>
            {voices.map((v) => (
              <SelectItem key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button onClick={() => speak("LOKIN online. Locked in.")}
          className="shrink-0 rounded-lg border border-accent/40 bg-accent/10 px-2 py-1.5 text-accent">
          Preview
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto no-scrollbar pb-2">
        {log.length === 0 && (
          <div className="flex flex-col items-center text-center py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-accent/40 bg-accent/10 glow-cyan mb-4">
              <LokinGlyph size={36} />
            </div>
            <VoiceWaveform active={listening} className="mb-3" />
            <div className="text-sm text-white/60">Say <span className="text-accent font-semibold">“Hey LOKIN…”</span></div>
            <div className="text-xs text-white/55 mt-1">or tap a quick command below.</div>
          </div>
        )}
        {log.map((m, i) => (
          <div key={i} className={`flex ${m.role === "you" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${m.role === "you" ? "bg-primary text-primary-foreground font-medium" : "border border-white/10 lokin-panel text-white/85"}`}>
              <div>{m.text}</div>
              {m.role === "lokin" && (
                <div className="mt-1.5 flex items-center gap-2">
                  <button onClick={() => speak(m.text)} className="text-accent/70 hover:text-accent" title="Read aloud">
                    <Volume2 className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => sendFeedback(i, 1)} disabled={!!m.feedback}
                    className={`${m.feedback === 1 ? "text-accent" : "text-white/50 hover:text-accent"} disabled:opacity-80`} title="Helpful — teach LOKIN">
                    <ThumbsUp className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => sendFeedback(i, -1)} disabled={!!m.feedback}
                    className={`${m.feedback === -1 ? "text-red-400" : "text-white/50 hover:text-red-400"} disabled:opacity-80`} title="Not helpful — teach LOKIN">
                    <ThumbsDown className="h-3.5 w-3.5" />
                  </button>
                  {m.feedback && <span className="text-[9px] text-white/50">learned</span>}
                </div>
              )}
            </div>
          </div>
        ))}
        {listening && <div className="flex items-center gap-2 pl-1"><VoiceWaveform active bars={7} /><span className="text-xs text-accent">Listening…</span></div>}
        {busy && <div className="text-xs text-accent/70 pl-1 flex items-center gap-1"><Radio className="h-3 w-3 animate-pulse" /> LOKIN is thinking…</div>}

        {draft && (
          <div className="rounded-2xl border border-accent/50 bg-accent/[0.08] p-3">
            <div className="text-xs font-semibold text-accent mb-1 tracking-wide">DRAFTED MESSAGE</div>
            <p className="text-sm text-white/90">{draft}</p>
            <div className="flex gap-2 mt-2">
              <button onClick={() => { speak("Message sent."); setLog((l) => [...l, { role: "lokin", text: "Sent." }]); setDraft(null); }}
                className="flex items-center gap-1 rounded-lg bg-accent text-accent-foreground px-3 py-1.5 text-xs font-bold glow-cyan">
                <Send className="h-3.5 w-3.5" /> SEND
              </button>
              <button onClick={() => setDraft(null)} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/60">Discard</button>
            </div>
            <div className="text-[10px] text-white/50 mt-1.5">Confirm before sending. Auto-send coming soon.</div>
          </div>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {QUICK.map((q) => (
          <button key={q} onClick={() => ask(q)} disabled={busy}
            className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/65 disabled:opacity-50">
            {q}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <AiKeyboardBar value={transcript} onApply={setTranscript} disabled={busy} />
        <div className="flex items-center gap-2">
          <input
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask(transcript)}
            placeholder="Say or type a command…"
            className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-white/30"
          />
          <button onClick={startListening} disabled={busy}
            className={`flex h-11 w-11 items-center justify-center rounded-xl transition-all disabled:opacity-60 ${listening ? "bg-accent text-accent-foreground glow-cyan animate-pulse" : "bg-accent/15 border border-accent/40 text-accent"}`}>
            <Mic className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}