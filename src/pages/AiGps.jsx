import { Radar, Move, Lock, Mic, Pause, Power, Navigation, Sparkles, Volume2 } from "lucide-react";
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
      <div className={locked ? "rounded-[2rem] border border-primary/25 bg-black/70 p-1 shadow-[0_0_40px_-18px_hsl(80_100%_50%)]" : ""}>
        <AiGps4D />
      </div>

      {locked && (
        <>
          <div className="rounded-3xl border border-primary/30 bg-primary/[0.06] p-4 shadow-[0_0_30px_-18px_hsl(80_100%_50%)]">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] tracking-[0.2em] text-primary/70">LOKIN COPILOT · LIVE</div>
                <div className="mt-1 text-sm font-bold text-white">Only what matters, when it matters.</div>
                <div className="mt-1 text-xs text-white/45">Route changes, earnings pace, customer updates, and safety alerts can surface here without leaving navigation.</div>
              </div>
              <div className="h-12 w-12 shrink-0 rounded-full border border-primary/40 bg-black/60 flex items-center justify-center glow-primary">
                <Volume2 className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div className="mt-3 rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white/65">
              Say <span className="font-bold text-primary">“Hey LOKIN…”</span> and ask naturally. Example: “What should I do next?”
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-center">
              <Navigation className="mx-auto h-4 w-4 text-primary" />
              <div className="mt-1 text-[10px] text-white/40">NAVIGATION</div>
              <div className="text-xs font-bold text-white">ACTIVE</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-center">
              <Sparkles className="mx-auto h-4 w-4 text-primary" />
              <div className="mt-1 text-[10px] text-white/40">AI COPILOT</div>
              <div className="text-xs font-bold text-white">WATCHING</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-center">
              <Lock className="mx-auto h-4 w-4 text-primary" />
              <div className="mt-1 text-[10px] text-white/40">FOCUS</div>
              <div className="text-xs font-bold text-white">LOCKED</div>
            </div>
          </div>

          <div className="rounded-3xl border border-primary/25 bg-black/80 p-3 backdrop-blur-xl">
            <div className="mb-2 text-center text-[10px] tracking-[0.2em] text-primary/70">HANDS-FREE DRIVE CONTROLS</div>
            <div className="grid grid-cols-3 gap-2">
              <Link to="/lokin" className="rounded-2xl bg-primary py-3 text-center text-black active:scale-[0.98]">
                <Mic className="mx-auto h-5 w-5" /><div className="mt-1 text-[10px] font-extrabold">TALK TO LOKIN</div>
              </Link>
              <Link to="/break-time" className="rounded-2xl border border-white/10 bg-white/[0.04] py-3 text-center text-white/70 active:scale-[0.98]">
                <Pause className="mx-auto h-5 w-5" /><div className="mt-1 text-[10px] font-bold">PAUSE</div>
              </Link>
              <Link to="/" className="rounded-2xl border border-red-500/25 bg-red-500/[0.07] py-3 text-center text-red-400 active:scale-[0.98]">
                <Power className="mx-auto h-5 w-5" /><div className="mt-1 text-[10px] font-bold">TAP OUT</div>
              </Link>
            </div>
          </div>

          <div className="sticky bottom-3 z-20 flex justify-center gap-2">
            {orderId && <Link to={`/compliance-handoff?order=${encodeURIComponent(orderId)}`} className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/15 backdrop-blur px-4 py-2 text-xs font-bold text-primary shadow-lg">Arrived · Verify handoff</Link>}
            <Link to="/ai-gps?focus=free" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/90 backdrop-blur px-4 py-2 text-xs font-semibold text-white/65 shadow-lg">
              <Move className="h-3.5 w-3.5" /> Free roam
            </Link>
          </div>
        </>
      )}
    </div>
  );
}