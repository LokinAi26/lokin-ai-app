import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

const CLASS_STYLES = {
  irreversible: "text-red-300",
  destructive: "text-red-300",
  financial: "text-amber-300",
  public: "text-accent",
  credential: "text-amber-300",
};

export default function ApprovalCard({ approval, onDecided }) {
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const tick = () => setLeft(Math.max(0, Math.round((new Date(approval.expires_at).getTime() - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [approval.expires_at]);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  async function decide(decision) {
    if (busy) return;
    setBusy(true);
    try {
      await base44.functions.invoke("lokin-l3-dispatch", { action: "decide", approval_id: approval.id, decision });
      onDecided?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="lokin-card-danger p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="lokin-kicker text-red-300">
            APPROVAL REQUIRED · <span className={CLASS_STYLES[approval.checkpoint_class] || "text-red-300"}>{(approval.checkpoint_class || "").toUpperCase()}</span>
          </div>
          <div className="mt-1 text-sm font-bold text-white">{approval.action}</div>
          <div className="mt-1 text-[10px] text-white/40">A yes covers exactly this action — changed terms need a new card.</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-display text-lg font-extrabold text-red-300">{mm}:{ss}</div>
          <div className="lokin-kicker mt-0.5">TTL · DENY AT 00:00</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button onClick={() => decide("deny")} disabled={busy} className="min-h-11 rounded-xl border border-white/12 bg-white/[0.04] text-xs font-bold text-white/70 active:scale-95">DENY</button>
        <button onClick={() => decide("approve")} disabled={busy || left <= 0} className="min-h-11 rounded-xl bg-primary text-xs font-extrabold text-black active:scale-95 disabled:opacity-40">APPROVE</button>
      </div>
    </div>
  );
}