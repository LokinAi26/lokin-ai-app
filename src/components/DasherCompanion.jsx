import { Truck, Zap } from "lucide-react";

const DASHER_TIPS = [
  "Stack DoorDash with Uber Eats during dinner rush for 2x earnings.",
  "Peak pay hours: 11am–1pm and 5pm–9pm — accept more for bonus pay.",
  "Keep acceptance rate above 60% to maintain Top Dasher status.",
  "Schedule dashes in advance for priority on high-paying orders.",
  "Use DasherDirect for instant daily payouts — no withdrawal fee.",
  "Park near restaurant clusters to receive more order offers.",
  "Decline orders under $1/mile — protect your $/hour average.",
  "Hotspots update live in the Dasher app — check before you park.",
];

export default function DasherCompanion() {
  const tip = DASHER_TIPS[new Date().getDate() % DASHER_TIPS.length];

  function launchDasher() {
    const start = Date.now();
    try { window.location.href = "doordash://dash"; } catch {}
    setTimeout(() => {
      if (Date.now() - start < 1800) {
        window.open("https://doordash.com/dash", "_blank", "noopener,noreferrer");
      }
    }, 700);
  }

  return (
    <div className="rounded-3xl border border-red-500/20 bg-red-500/[0.04] p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 text-red-400">
            <Truck className="h-4 w-4" />
          </div>
          <div className="text-sm font-semibold text-white/80">Dasher Companion</div>
        </div>
        <button onClick={launchDasher} className="flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-400 active:scale-95 transition-transform">
          <Zap className="h-3.5 w-3.5" /> Launch
        </button>
      </div>
      <div className="text-xs text-white/55 leading-relaxed">
        <span className="text-primary font-semibold">Daily tip · </span>{tip}
      </div>
    </div>
  );
}