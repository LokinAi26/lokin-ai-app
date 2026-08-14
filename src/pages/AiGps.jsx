import { Radar, Move, Lock, ChevronLeft } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import AiGps4D from "@/components/AiGps4D";

export default function AiGps() {
  const [params] = useSearchParams();
  const locked = params.get("focus") === "locked";
  const orderId = params.get("order") || "";

  return (
    <div className={`${locked ? "p-3 pt-[calc(0.75rem+env(safe-area-inset-top))]" : "p-4"} space-y-4 pb-6`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radar className="h-5 w-5 text-accent" />
          <h1 className="text-xl font-bold font-heading metal-text">4D AI GPS</h1>
        </div>
        <span className="text-[11px] tracking-[0.22em] text-accent/80 font-display">{locked ? "LOCKED-IN MODE" : "PRECISION · TIME · RE-ROUTE"}</span>
      </div>
      {locked ? (
        <div className="rounded-2xl border border-primary/30 bg-primary/[0.06] p-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full border border-primary/40 bg-primary/10 flex items-center justify-center glow-primary"><Lock className="h-4 w-4 text-primary" /></div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-white">Distraction-Free Navigation</div>
            <div className="text-[11px] text-white/45">Neon LOKIN route guidance stays front and center while you work.</div>
          </div>
          <Link to="/ai-gps?focus=free" className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-semibold text-white/70">Free roam</Link>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-white/45">3D space + time. Re-route live and sharpen every drop.</p>
          <Link to="/ai-gps?focus=locked" className="shrink-0 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-[11px] font-semibold text-primary">Lock in</Link>
        </div>
      )}
      <AiGps4D />
      {locked && (
        <div className="sticky bottom-3 z-20 flex justify-center gap-2">
          {orderId && <Link to={`/compliance-handoff?order=${encodeURIComponent(orderId)}`} className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/15 backdrop-blur px-4 py-2 text-xs font-bold text-primary shadow-lg">Arrived · Verify handoff</Link>}
          <Link to="/?roam=1" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/85 backdrop-blur px-4 py-2 text-xs font-semibold text-white/65 shadow-lg">
            <Move className="h-3.5 w-3.5" /> Exit locked mode
          </Link>
        </div>
      )}
    </div>
  );
}