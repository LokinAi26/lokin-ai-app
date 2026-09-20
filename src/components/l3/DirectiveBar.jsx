import { useState } from "react";
import { Zap } from "lucide-react";
import { base44 } from "@/api/base44Client";

const MODES = { automate: "AUTOMATE", rootcause: "ROOT CAUSE", debug: "DEBUG", x10: "X10", productivity: "PRODUCTIVITY" };

export default function DirectiveBar({ mode, onDispatched }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [last, setLast] = useState(null);

  async function submit(e) {
    e.preventDefault();
    const directive = value.trim();
    if (!directive || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await base44.functions.invoke("lokin-l3-dispatch", {
        action: "dispatch",
        directive,
        source: "lokin",
        command: mode || "",
      });
      setLast(res.data);
      setValue("");
      onDispatched?.(res.data);
    } catch {
      setError("Dispatch failed — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form onSubmit={submit} className="lokin-card-cyan p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="lokin-kicker lokin-kicker-cyan font-display">L3 DISPATCHER</div>
            <div className="text-[10px] text-white/35">Every directive is classified before anything executes. Checkpoint actions pause for your approval card.</div>
          </div>
          {mode && (
            <span className="shrink-0 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 font-display text-[9px] font-extrabold tracking-[0.14em] text-accent">
              /{MODES[mode] || mode.toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-2xl border border-accent/25 bg-black/70 px-3">
            <Zap className="h-4 w-4 shrink-0 text-accent" />
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Type a directive — LOKIN classifies it"
              className="min-w-0 flex-1 bg-transparent py-3 text-sm text-white outline-none placeholder:text-white/25"
            />
          </div>
          <button type="submit" disabled={!value.trim() || busy} className="lokin-cta lokin-cta-sm font-extrabold">
            {busy ? "…" : "DISPATCH"}
          </button>
        </div>
        {error && <div className="mt-2 text-[11px] text-red-300">{error}</div>}
      </form>
      {last && (
        <div className="mt-2 rounded-2xl border border-white/8 bg-white/[0.025] px-3 py-2 text-[11px] text-white/55">
          Classified <span className="font-bold text-primary">{last.classification}</span>
          {last.checkpoint_class && last.checkpoint_class !== "none"
            ? <> · <span className="font-bold text-amber-300">{last.checkpoint_class} checkpoint</span> — approval card raised (TTL 30 min, default-DENY)</>
            : " · plan opened, first run log written"}
        </div>
      )}
    </div>
  );
}