import { useEffect, useRef, useState } from "react";
import { Headphones, Send, LifeBuoy, Sparkles, ThumbsUp, ThumbsDown, UserRound } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { guardedInvoke } from "@/lib/creditGuardian";
import { useToast } from "@/components/ui/use-toast";
import SupportMessageBubble from "@/components/support/SupportMessageBubble";

const AGENT = "lokin-support";
const GREETING = "Hey, I'm LOKIN Support. How can I help you today?";
const QUICK = [
  "How do I start a shift?",
  "How do I optimize my route?",
  "Where's my Green order?",
  "The app feels slow, help",
];

// Normalize an agent message (role + content) into the shape the feedback UI uses.
function toUi(m) {
  if (!m) return null;
  return { role: m.role, text: m.content || "", tool_calls: m.tool_calls };
}

export default function Support() {
  const { toast } = useToast();
  const [mode, setMode] = useState("agent");
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([{ role: "assistant", text: GREETING, rated: false, escalated: false }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function initializeConversation() {
      try {
        const conv = await base44.agents.createConversation({ agent_name: AGENT, metadata: { name: "LOKIN Support" } });
        if (cancelled) return;
        setConversationId(conv.id);
        const init = (conv.messages && conv.messages.length) ? conv.messages.map(toUi) : [{ role: "assistant", text: GREETING, rated: false, escalated: false }];
        setMessages(init);
        setMode("agent");
      } catch (e) {
        if (cancelled) return;
        // Agent not available — fall back to the external-ai-gateway support mode.
        console.warn("lokin-support agent unavailable, using gateway fallback", e?.message || e);
        setMode("fallback");
      }
    }

    initializeConversation();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!conversationId) return;
    const unsubscribe = base44.agents.subscribeToConversation(conversationId, (data) => {
      const incoming = (data.messages || []).map(toUi);
      // preserve any local feedback flags on matching assistant turns by index
      setMessages((prev) => incoming.map((m, i) => ({ ...m, rated: prev[i]?.rated, escalated: prev[i]?.escalated })));
      const last = incoming[incoming.length - 1];
      if (last && last.role === "assistant" && last.text) setBusy(false);
    });
    return () => unsubscribe();
  }, [conversationId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);

  async function sendAgent(text) {
    if (!conversationId) return;
    setBusy(true);
    try {
      const conv = await base44.agents.getConversation(conversationId);
      await base44.agents.addMessage(conv, { role: "user", content: text });
      // optimistic local echo so the user sees their message immediately
      setMessages((prev) => [...prev, { role: "user", text, rated: false, escalated: false }]);
    } catch (e) {
      setBusy(false);
      setMessages((prev) => [...prev, { role: "assistant", text: "I hit a snag sending that. Try again in a moment.", rated: false, escalated: false }]);
    }
  }

  async function sendFallback(text) {
    const history = messages.map((m) => ({ role: m.role, content: m.text }));
    setBusy(true);
    try {
      const res = await guardedInvoke(base44, "external-ai-gateway", { mode: "support", message: text, context: { history_count: history.length } });
      setMessages((prev) => [...prev, { role: "assistant", text: res.data.reply, rated: false, escalated: false }]);
    } catch (e) {
      setMessages((prev) => [...prev, { role: "assistant", text: "Something went wrong on my end. Try again in a moment.", rated: false, escalated: false }]);
    } finally {
      setBusy(false);
    }
  }

  function send(text) {
    const msg = (text ?? input).trim();
    if (!msg || busy) return;
    setInput("");
    if (mode === "agent") sendAgent(msg);
    else sendFallback(msg);
  }

  // Feedback loop (unchanged): 👍/👎 on each AI reply; 👎 surfaces human handoff.
  async function rate(idx, rating) {
    const m = messages[idx];
    if (!m || m.rated) return;
    setMessages((prev) => prev.map((x, i) => (i === idx ? { ...x, rated: true, rating } : x)));
    try {
      let user = null;
      try { user = await base44.auth.me(); } catch {}
      const prevUser = messages[idx - 1]?.text || "";
      await base44.entities.SupportFeedback.create({
        user_id: user?.id || null,
        user_message: prevUser,
        ai_reply: m.text,
        rating,
        escalated: false,
        resolved_by_ai: rating === "positive",
        occurred_at: new Date().toISOString(),
      });
    } catch (e) { /* best-effort */ }
  }

  async function escalate(idx) {
    const m = messages[idx];
    if (!m || m.escalated) return;
    setMessages((prev) => prev.map((x, i) => (i === idx ? { ...x, escalated: true } : x)));
    try {
      let user = null;
      try { user = await base44.auth.me(); } catch {}
      const prevUser = messages[idx - 1]?.text || "";
      await base44.entities.SupportFeedback.create({
        user_id: user?.id || null,
        user_message: prevUser,
        ai_reply: m.text,
        rating: m.rating || "negative",
        escalated: true,
        resolved_by_ai: false,
        occurred_at: new Date().toISOString(),
      });
      toast({ title: "A human rep will follow up", description: "Your message is queued for our team. We'll reach out via email." });
    } catch (e) { /* best-effort */ }
  }

  return (
    <div className="flex flex-col" style={{ minHeight: "calc(100dvh - 7rem)" }}>
      <div className="p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-accent/40 bg-accent/10 glow-cyan">
            <Headphones className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-heading metal-text leading-none">LOKIN Support</h1>
            <div className="flex items-center gap-1 text-[11px] text-accent/80 mt-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" /> Adaptive AI · online
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-3">
        {messages.map((m, i) => (
          <div key={i}>
            <SupportMessageBubble message={{ role: m.role, content: m.text, tool_calls: m.tool_calls }} />
            {m.role === "assistant" && i > 0 && !busy && (
              <div className="mt-1.5 flex items-center gap-2">
                <button onClick={() => rate(i, "positive")} disabled={m.rated} className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold transition ${m.rated && m.rating === "positive" ? "border-primary/40 bg-primary/15 text-primary" : "border-white/10 text-white/45"}`}><ThumbsUp className="h-3 w-3" /></button>
                <button onClick={() => rate(i, "negative")} disabled={m.rated} className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold transition ${m.rated && m.rating === "negative" ? "border-destructive/40 bg-destructive/15 text-destructive" : "border-white/10 text-white/45"}`}><ThumbsDown className="h-3 w-3" /></button>
                {m.rated && m.rating === "negative" && !m.escalated && (
                  <button onClick={() => escalate(i)} className="flex items-center gap-1 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1 text-[10px] font-bold text-accent active:scale-95 transition-transform"><UserRound className="h-3 w-3" /> Talk to a human</button>
                )}
                {m.escalated && <span className="text-[10px] text-accent/70 font-semibold">Escalated to our team</span>}
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="lokin-panel border border-white/10 rounded-2xl rounded-bl-md px-3.5 py-3 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: "120ms" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: "240ms" }} />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {messages.length <= 1 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {QUICK.map((q) => (
            <button key={q} onClick={() => send(q)}
              className="rounded-full border border-white/15 lokin-panel px-3 py-1.5 text-xs text-white/75 active:scale-95 transition-transform flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-primary" /> {q}
            </button>
          ))}
        </div>
      )}

      <div className="sticky bottom-0 p-3 glass border-t border-white/8">
        <div className="flex items-center gap-2 rounded-2xl border border-white/12 lokin-panel px-3 py-2">
          <LifeBuoy className="h-4 w-4 text-accent shrink-0" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Tell me what's going on…"
            className="flex-1 bg-transparent text-sm text-white placeholder:text-white/35 outline-none"
          />
          <button onClick={() => send()} disabled={busy || !input.trim()}
            className="h-8 w-8 flex items-center justify-center rounded-xl bg-primary text-black disabled:opacity-40 active:scale-90 transition-transform">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}