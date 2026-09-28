import { useEffect, useRef, useState } from "react";
import { Flame, Volume2, VolumeX, Square, RefreshCw, Send } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { guardedInvoke } from "@/lib/creditGuardian";
import {
  speakLokin,
  stopSpeaking,
  getTtsVoice,
  unlockVoiceAudio,
} from "@/lib/lokinVoicePipeline";

const AGENT = "thor";
const CONV_KEY = "lokin_thor_peptalk_conv";
const VOICE_KEY = "lokin_thor_voice_on";

const MOODS = [
  { id: "in a slump", label: "In a slump" },
  { id: "exhausted and drained", label: "Exhausted" },
  { id: "need a push to start", label: "Need a push" },
  { id: "riding high, keep it going", label: "Riding high" },
];

function toUi(m) {
  if (!m) return null;
  return { id: m.id, role: m.role, text: m.content || "" };
}

export default function MotivationCoach() {
  const [mood, setMood] = useState(MOODS[2].id);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceOn, setVoiceOn] = useState(() => {
    try { return localStorage.getItem(VOICE_KEY) !== "off"; } catch { return true; }
  });
  const [fallback, setFallback] = useState(false);
  const endRef = useRef(null);
  const seenRef = useRef(new Set());

  function toggleVoice() {
    setVoiceOn((v) => {
      const next = !v;
      try { localStorage.setItem(VOICE_KEY, next ? "on" : "off"); } catch {}
      if (!next) stopSpeaking();
      return next;
    });
  }

  async function speak(text) {
    if (!voiceOn || !text) return;
    setSpeaking(true);
    try {
      await speakLokin(text, { voice: getTtsVoice() });
    } finally {
      setSpeaking(false);
    }
  }

  // Resume the ongoing Thor conversation so the talk picks up
  // where it left off. Never auto-plays history on open.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let saved = null;
      try { saved = localStorage.getItem(CONV_KEY); } catch {}
      if (!saved) return;
      try {
        const conv = await base44.agents.getConversation(saved);
        if (cancelled || !conv) return;
        const ui = (conv.messages || []).map(toUi).filter(Boolean);
        ui.forEach((m) => seenRef.current.add(m.id));
        setMessages(ui);
        setConversationId(conv.id);
      } catch {
        try { localStorage.removeItem(CONV_KEY); } catch {}
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Live updates: new Thor replies appear and are spoken automatically.
  useEffect(() => {
    if (!conversationId) return;
    const unsubscribe = base44.agents.subscribeToConversation(conversationId, (data) => {
      const incoming = (data.messages || []).map(toUi).filter(Boolean);
      const fresh = incoming.filter((m) => !seenRef.current.has(m.id));
      fresh.forEach((m) => {
        seenRef.current.add(m.id);
        if (m.role === "assistant" && m.text) speak(m.text);
      });
      setMessages(incoming);
      const last = incoming[incoming.length - 1];
      if (last && last.role === "assistant" && last.text) setBusy(false);
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, voiceOn]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function startTalk(fresh) {
    unlockVoiceAudio();
    stopSpeaking();
    setSpeaking(false);
    setBusy(true);
    setFallback(false);
    try {
      if (fresh) {
        try { localStorage.removeItem(CONV_KEY); } catch {}
        setConversationId(null);
        setMessages([]);
        seenRef.current = new Set();
      }
      const conv = await base44.agents.createConversation({
        agent_name: AGENT,
        metadata: { name: "Pep Talk" },
      });
      try { localStorage.setItem(CONV_KEY, conv.id); } catch {}
      setConversationId(conv.id);
      const seed = `I need a pep talk. Right now I'm feeling: ${mood}.`;
      const full = await base44.agents.getConversation(conv.id);
      await base44.agents.addMessage(full, { role: "user", content: seed });
      setMessages([{ id: "seed", role: "user", text: seed }]);
    } catch (e) {
      // Thor unavailable — honest one-shot fallback, no fake conversation.
      console.warn("thor agent unavailable, using gateway fallback", e?.message || e);
      setBusy(false);
      setFallback(true);
      try {
        const res = await guardedInvoke(base44, "external-ai-gateway", { mode: "motivation", mood });
        const text = res.data?.message || "You've got this. Lock in and go make that money.";
        setMessages([{ id: "fb", role: "assistant", text }]);
        speak(text);
      } catch {
        setMessages([{ id: "fb", role: "assistant", text: "You've got this. Lock in and go make that money." }]);
      }
    }
  }

  async function send(text) {
    const msg = (text ?? input).trim();
    if (!msg || busy || !conversationId || fallback) return;
    setInput("");
    setBusy(true);
    try {
      const conv = await base44.agents.getConversation(conversationId);
      await base44.agents.addMessage(conv, { role: "user", content: msg });
      const echo = { id: `local-${Date.now()}`, role: "user", text: msg };
      seenRef.current.add(echo.id);
      setMessages((prev) => [...prev, echo]);
    } catch {
      setBusy(false);
    }
  }

  function stopVoice() {
    stopSpeaking();
    setSpeaking(false);
  }

  const started = messages.length > 0;

  return (
    <div className="rounded-3xl border border-primary/25 bg-primary/[0.06] p-5">
      <div className="flex items-center gap-2 mb-1">
        <Flame className="h-4 w-4 text-primary" />
        <div className="text-sm font-semibold text-white">Motivation Coach</div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={toggleVoice} title={voiceOn ? "Voice on" : "Voice off"}
            className="rounded-lg border border-white/10 bg-white/[0.04] p-1.5 text-white/60">
            {voiceOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          </button>
          {speaking && (
            <button onClick={stopVoice} title="Stop voice"
              className="rounded-lg border border-destructive/50 bg-destructive/[0.08] p-1.5 text-destructive">
              <Square className="h-3.5 w-3.5 fill-destructive" />
            </button>
          )}
        </div>
      </div>
      <p className="text-xs text-white/45 mb-4">
        A real conversation with Thor — he remembers your moods, goals, and past talks.
      </p>

      {!started && (
        <>
          <div className="text-[11px] uppercase tracking-wide text-white/40 mb-2">How are you feeling?</div>
          <div className="grid grid-cols-2 gap-2">
            {MOODS.map((m) => (
              <button key={m.id} onClick={() => setMood(m.id)}
                className={`rounded-2xl border px-3 py-2.5 text-xs font-semibold ${m.id === mood ? "border-primary bg-primary/15 text-primary" : "border-white/10 bg-white/[0.03] text-white/55"}`}>
                {m.label}
              </button>
            ))}
          </div>
        </>
      )}

      {started ? (
        <div className="mt-2">
          <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-primary/20 text-white border border-primary/30"
                    : "bg-black/40 text-white/85 border border-white/10"
                }`}>
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  {m.role === "assistant" && (
                    <button onClick={() => speak(m.text)} title="Replay"
                      className="mt-1.5 flex items-center gap-1 text-[11px] text-primary/80">
                      <Volume2 className="h-3 w-3" /> Replay
                    </button>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white/50">
                  Thor is thinking…
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="mt-3 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
              placeholder="Talk to Thor…"
              className="flex-1 rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-primary/50"
            />
            <button onClick={() => send()} disabled={busy || !input.trim()}
              className="rounded-xl border border-primary/40 bg-primary/15 px-4 text-primary disabled:opacity-40">
              <Send className="h-4 w-4" />
            </button>
          </div>
          <button onClick={() => startTalk(true)}
            className="mt-2.5 w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 text-xs font-semibold text-white/55 flex items-center justify-center gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> NEW PEP TALK
          </button>
        </div>
      ) : (
        <button onClick={() => startTalk(false)} disabled={busy}
          className="mt-4 w-full rounded-2xl glow-border lokin-panel py-3.5 font-display text-sm font-bold tracking-[0.12em] text-primary text-glow flex items-center justify-center gap-2 disabled:opacity-60">
          {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Flame className="h-4 w-4" />}
          {busy ? "CONNECTING…" : "GET A PEP TALK"}
        </button>
      )}
    </div>
  );
}
