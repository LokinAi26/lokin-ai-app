import { useState } from "react";
import { Flame, Volume2, Square, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";

const MOODS = [
  { id: "in a slump", label: "In a slump" },
  { id: "exhausted and drained", label: "Exhausted" },
  { id: "need a push to start", label: "Need a push" },
  { id: "riding high, keep it going", label: "Riding high" },
];

export default function MotivationCoach() {
  const [mood, setMood] = useState(MOODS[2].id);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  async function motivate() {
    setLoading(true);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setSpeaking(false);
    try {
      const res = await base44.functions.invoke("motivationCoach", { mood });
      setMsg(res.data?.message || "You've got this. Lock in and go make that money.");
    } catch {
      setMsg("You've got this. Lock in and go make that money.");
    } finally {
      setLoading(false);
    }
  }

  function speak() {
    if (!window.speechSynthesis || !msg) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(msg);
    u.rate = 0.98;
    u.pitch = 1.05;
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  }

  function stopSpeak() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setSpeaking(false);
  }

  return (
    <div className="rounded-3xl border border-primary/25 bg-primary/[0.06] p-5">
      <div className="flex items-center gap-2 mb-1">
        <Flame className="h-4 w-4 text-primary" />
        <div className="text-sm font-semibold text-white">Motivation Coach</div>
      </div>
      <p className="text-xs text-white/45 mb-4">A locker-room pep talk, on demand.</p>

      <div className="text-[11px] uppercase tracking-wide text-white/40 mb-2">How are you feeling?</div>
      <div className="grid grid-cols-2 gap-2">
        {MOODS.map((m) => (
          <button key={m.id} onClick={() => setMood(m.id)}
            className={`rounded-2xl border px-3 py-2.5 text-xs font-semibold ${m.id === mood ? "border-primary bg-primary/15 text-primary" : "border-white/10 bg-white/[0.03] text-white/55"}`}>
            {m.label}
          </button>
        ))}
      </div>

      <button onClick={motivate} disabled={loading}
        className="mt-4 w-full rounded-2xl glow-border lokin-panel py-3.5 font-display text-sm font-bold tracking-[0.12em] text-primary text-glow flex items-center justify-center gap-2 disabled:opacity-60">
        {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Flame className="h-4 w-4" />}
        {loading ? "COACHING…" : msg ? "NEW PEP TALK" : "GET A PEP TALK"}
      </button>

      {msg && (
        <div className="mt-4 rounded-2xl border border-primary/20 bg-black/30 p-4">
          <p className="text-sm leading-relaxed text-white/85 whitespace-pre-wrap">{msg}</p>
          <div className="mt-3 flex gap-2">
            {speaking ? (
              <button onClick={stopSpeak} className="flex-1 rounded-xl border border-destructive/50 bg-destructive/[0.08] py-2.5 text-xs font-semibold text-destructive flex items-center justify-center gap-2">
                <Square className="h-3.5 w-3.5 fill-destructive" /> STOP VOICE
              </button>
            ) : (
              <button onClick={speak} className="flex-1 rounded-xl border border-primary/40 bg-primary/[0.08] py-2.5 text-xs font-semibold text-primary flex items-center justify-center gap-2">
                <Volume2 className="h-3.5 w-3.5" /> PLAY VOICE
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}