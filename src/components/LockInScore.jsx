import { Lock } from "lucide-react";

const CATEGORIES = [
  { key: "earningsEff", label: "Earnings" },
  { key: "goalProgress", label: "Goal" },
  { key: "offerQuality", label: "Offer Quality" },
  { key: "timeUtil", label: "Time Use" },
  { key: "mileageEff", label: "Mileage" },
  { key: "routeEff", label: "Route" },
];

export default function LockInScore({ score, compact = false }) {
  const overall = score?.overall ?? 0;
  const breakdown = score?.breakdown || {};
  const color = overall >= 80 ? "#A8FF00" : overall >= 55 ? "#facc15" : "#f87171";
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = (overall / 100) * circ;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="relative h-9 w-9">
          <svg viewBox="0 0 120 120" className="h-9 w-9 -rotate-90">
            <circle cx="60" cy="60" r="52" stroke="hsl(var(--muted))" strokeWidth="12" fill="none" />
            <circle cx="60" cy="60" r="52" stroke={color} strokeWidth="12" fill="none"
              strokeLinecap="round" strokeDasharray={`${dash} ${circ}`} style={{ filter: `drop-shadow(0 0 5px ${color})` }} />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold font-display">{overall}</span>
        </div>
        <div className="leading-tight">
          <div className="text-[10px] uppercase tracking-wider text-white/50">Lock In Score</div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 lokin-panel p-5">
      <div className="flex items-center gap-2 mb-4">
        <Lock className="h-4 w-4 text-primary" />
        <div className="text-sm font-semibold tracking-wide text-white">LOCK IN SCORE</div>
      </div>
      <div className="flex items-center gap-5">
        <div className="relative h-28 w-28 shrink-0">
          <svg viewBox="0 0 120 120" className="h-28 w-28 -rotate-90">
            <circle cx="60" cy="60" r={r} stroke="hsl(var(--muted))" strokeWidth="10" fill="none" />
            <circle cx="60" cy="60" r={r} stroke={color} strokeWidth="10" fill="none"
              strokeLinecap="round" strokeDasharray={`${dash} ${circ}`} style={{ filter: `drop-shadow(0 0 7px ${color})` }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold font-display" style={{ color }}>{overall}</span>
            <span className="text-[10px] text-white/40 -mt-1">/ 100</span>
          </div>
        </div>
        <div className="flex-1 space-y-1.5">
          {CATEGORIES.map((c) => {
            const v = breakdown[c.key] ?? 0;
            return (
              <div key={c.key} className="flex items-center gap-2">
                <span className="text-[11px] text-white/50 w-20 shrink-0">{c.label}</span>
                <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${v}%`, boxShadow: "0 0 8px hsl(80 100% 50% / 0.6)" }} />
                </div>
                <span className="text-[10px] font-medium w-6 text-right text-white/70">{v}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}