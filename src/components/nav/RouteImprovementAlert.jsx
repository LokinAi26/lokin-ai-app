import { Zap, X } from "lucide-react";

// Mid-delivery alert shown when LOKIN detects a meaningfully faster route.
// The driver applies or declines it — the route never swaps on its own.
export default function RouteImprovementAlert({ improvement, onApply, onDismiss, floating = false }) {
  if (!improvement) return null;
  const mins = Math.max(1, Math.round(Number(improvement.savings_s || 0) / 60));
  return (
    <div
      role="alert"
      className={
        floating
          ? "pointer-events-auto absolute left-3 right-3 top-[calc(4.6rem+env(safe-area-inset-top))] z-40 lokin-card border-primary/50 p-3 backdrop-blur"
          : "lokin-card border-primary/50 p-4"
      }
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10 glow-primary">
          <Zap className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="lokin-kicker lokin-kicker-lime">FASTER ROUTE FOUND</div>
          <div className="mt-0.5 text-sm font-bold text-white">Save ~{mins} min{mins === 1 ? "" : "s"} on your remaining stops</div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Keep current route"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 text-white/50 active:scale-95"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <button type="button" onClick={onApply} className="lokin-cta lokin-cta-sm mt-3 w-full">APPLY FASTER ROUTE</button>
    </div>
  );
}