import { useState } from "react";
import { Wand2, Sparkles, Lightbulb, X, Check, ChevronDown } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { guardedInvoke } from "@/lib/creditGuardian";

const TONES = ["professional", "casual", "concise", "friendly"];

// Grammarly-style AI typing helper rendered above a text input.
// Props: value (current text), onApply(newText), disabled.
export default function AiKeyboardBar({ value, onApply, disabled }) {
  const [busy, setBusy] = useState(null);
  const [result, setResult] = useState(null); // { mode, text, tone }
  const [suggestions, setSuggestions] = useState(null);
  const [tone, setTone] = useState("professional");
  const [showTone, setShowTone] = useState(false);
  const [err, setErr] = useState(null);

  async function run(mode, useTone = tone) {
    if (disabled || !value.trim()) return;
    setErr(null);
    setResult(null);
    setSuggestions(null);
    setShowTone(false);
    setBusy(mode);
    try {
      const res = await guardedInvoke(base44, "external-ai-gateway", { mode: "text", text: value, writingMode: mode, tone: useTone });
      const data = res.data;
      if (data.error) throw new Error(data.error);
      if (mode === "complete") {
        setSuggestions(data.suggestions || []);
      } else {
        setResult({ mode, text: data.result || "", tone: useTone });
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  }

  function apply(text) {
    onApply(text);
    setResult(null);
    setSuggestions(null);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => run("polish")}
          disabled={disabled || !!busy}
          className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-medium text-white/75 active:scale-95 transition-transform disabled:opacity-50"
        >
          <Wand2 className="h-3.5 w-3.5 text-primary" /> Fix
        </button>

        <div className="relative">
          <button
            onClick={() => setShowTone((s) => !s)}
            disabled={disabled || !!busy}
            className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-medium text-white/75 active:scale-95 transition-transform disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5 text-accent" /> Tone
            <ChevronDown className="h-3 w-3 text-white/40" />
          </button>
          {showTone && (
            <div className="absolute bottom-full left-0 mb-1.5 z-20 w-36 rounded-xl border border-white/10 bg-neutral-950 p-1 shadow-xl">
              {TONES.map((t) => (
                <button
                  key={t}
                  onClick={() => { setTone(t); run("rewrite", t); }}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] capitalize active:scale-95 ${t === tone ? "bg-primary/15 text-primary" : "text-white/75"}`}
                >
                  {t}
                  {t === tone && <Check className="h-3 w-3" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => run("complete")}
          disabled={disabled || !!busy}
          className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-medium text-white/75 active:scale-95 transition-transform disabled:opacity-50"
        >
          <Lightbulb className="h-3.5 w-3.5 text-yellow-400" /> Suggest
        </button>

        {busy && <span className="text-[10px] text-accent animate-pulse">thinking…</span>}
      </div>

      {err && <div className="text-[11px] text-destructive">{err}</div>}

      {result && (
        <div className="rounded-xl border border-primary/40 bg-primary/[0.07] p-2.5">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] font-semibold tracking-wide text-primary">
              {result.mode === "rewrite" ? `REWRITTEN · ${result.tone}` : "POLISHED"}
            </span>
            <button onClick={() => setResult(null)} className="text-white/40 active:scale-90">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-sm leading-relaxed text-white/90">{result.text}</p>
          <button
            onClick={() => apply(result.text)}
            className="mt-2 flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-bold text-primary-foreground active:scale-95 transition-transform"
          >
            <Check className="h-3.5 w-3.5" /> Apply
          </button>
        </div>
      )}

      {suggestions && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => apply(s)}
              className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs text-accent active:scale-95 transition-transform"
            >
              {s}
            </button>
          ))}
          <button onClick={() => setSuggestions(null)} className="text-white/40 self-center">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}