import { useState } from "react";
import { CircleCheck, CircleX } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function ShakedownPanel({ onDone }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function run() {
    if (running) return;
    setRunning(true);
    setError("");
    try {
      const res = await base44.functions.invoke("lokin-l3-dispatch", { action: "shakedown" });
      setResult(res.data);
      onDone?.();
    } catch {
      setError("Shakedown did not complete — try again.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="lokin-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="lokin-kicker lokin-kicker-lime">L3 SHAKEDOWN · $0 SPEND</div>
          <div className="mt-1 text-sm font-bold text-white">End-to-end test: triage, run logs, checkpoint card, default-DENY, idempotency, archive.</div>
        </div>
        <button onClick={run} disabled={running} className="lokin-cta lokin-cta-sm shrink-0 font-extrabold">
          {running ? "RUNNING…" : "RUN"}
        </button>
      </div>
      {error && <div className="mt-2 text-[11px] text-red-300">{error}</div>}
      {result && (
        <div className="mt-3 space-y-1.5">
          <div className={`font-display text-xs font-extrabold tracking-[0.14em] ${result.passed === result.total ? "text-primary" : "text-amber-300"}`}>
            {result.passed}/{result.total} GREEN{result.passed === result.total ? " · L3 OPERATIONAL" : ""}
          </div>
          {(result.steps || []).map((s) => (
            <div key={s.name} className="flex items-start gap-2 text-[11px]">
              {s.pass ? <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /> : <CircleX className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />}
              <span className="text-white/70">{s.name} <span className="text-white/40">— {s.detail}</span></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}