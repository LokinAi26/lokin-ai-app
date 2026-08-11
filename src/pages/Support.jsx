import { useEffect, useRef, useState } from "react";
import { Headphones, Send, LifeBuoy, Sparkles } from "lucide-react";
import { base44 } from "@/api/base44Client";

const QUICK = [
  "How do I start a shift?",
  "How do I optimize my route?",
  "What's included in Pro?",
  "The app feels slow, help",
];

function Bubble({ role, text }) {
  const me = role === "user";
  return (
    <div className={`flex ${me ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
        me
          ? "bg-primary/15 border border-primary/30 text-white rounded-br-md"
          : "lokin-panel border border-white/10 text-white/90 rounded-bl-md"
      }`}>
        {text}
      </div>
    </div>
  );
}

export default function Support() {
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Hey, I'm LOKIN Support. How can I help you today?" },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);

  async function send(text) {
    const msg = (text ?? input).trim();
    if (!msg || busy) return;
    setInput("");
    const history = messages.map((m) => ({ role: m.role, content: m.text }));
    const next = [...messages, { role: "user", text: msg }];
    setMessages(next);
    setBusy(true);
    try {
      const res = await base44.functions.invoke("lokinSupport", { message: msg, history });
      setMessages([...next, { role: "assistant", text: res.data.reply }]);
    } catch (e) {
      setMessages([...next, { role: "assistant", text: "Something went wrong on my end. Try again in a moment." }]);
    } finally {
      setBusy(false);
    }
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
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" /> AI rep · online
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-3">
        {messages.map((m, i) => <Bubble key={i} role={m.role} text={m.text} />)}
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
            placeholder="Ask about features, billing, or report a bug…"
            className="flex-1 bg-transparent text-sm text-white placeholder:text-white/35 outline-none"
          />
          <button onClick={() => send()} disabled={busy || !input.trim()}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-black disabled:opacity-40 active:scale-90 transition-transform">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}