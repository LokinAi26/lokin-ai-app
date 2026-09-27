import { useState } from "react";
import { ArrowUp, ArrowUpLeft, ArrowUpRight, ChevronDown, ChevronUp, CornerUpLeft, CornerUpRight, MapPin, RefreshCw, RotateCw } from "lucide-react";
import { formatDistance, formatDuration } from "@/lib/navigationGeometry";

// Mapbox maneuver type/modifier → the one arrow that reads at a glance.
function maneuverArrow(type, modifier) {
  const t = String(type || "");
  const m = String(modifier || "");
  if (m.includes("uturn")) return RefreshCw;
  if (t.includes("roundabout") || t === "rotary") return RotateCw;
  if (m.includes("slight left")) return ArrowUpLeft;
  if (m.includes("slight right")) return ArrowUpRight;
  if (m.includes("left")) return CornerUpLeft;
  if (m.includes("right")) return CornerUpRight;
  return ArrowUp;
}

function streetFor(m) {
  return String(m?.road_name || m?.maneuver?.instruction || "").trim() || "Continue on route";
}

function arrivalClockTime(remainingDurationS, etaUpdatedAt) {
  const baseMs = etaUpdatedAt ? new Date(etaUpdatedAt).getTime() : Date.now();
  if (!Number.isFinite(baseMs)) return "—";
  const arrival = new Date(baseMs + Math.max(0, Number(remainingDurationS || 0)) * 1000);
  return arrival.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// The consolidated navigation HUD strip: maneuver arrow + street on the left,
// arrival clock + remaining minutes + remaining distance on the right. Tapping
// expands the full upcoming maneuver list above the strip.
export default function NavHudStrip({
  maneuver,
  maneuvers = [],
  drivenAlongM = 0,
  remainingDurationS,
  remainingDistanceM,
  arrivedLabel = "",
  etaLiveTraffic = false,
  etaUpdatedAt = null,
}) {
  const [open, setOpen] = useState(false);
  const arrived = Boolean(arrivedLabel);
  const Arrow = arrived ? MapPin : maneuverArrow(maneuver?.maneuver?.type, maneuver?.maneuver?.modifier);
  const clock = arrivalClockTime(remainingDurationS, etaUpdatedAt);
  const distanceText = Number.isFinite(Number(remainingDistanceM)) ? formatDistance(remainingDistanceM) : "";
  const upcoming = maneuvers.filter((m) => m?.maneuver && Number(m.along_route_m || 0) - drivenAlongM > -5);

  return (
    <div className="w-full min-w-0 max-w-full">
      {open && (
        <div className="lokin-card mb-2 max-h-[13rem] overflow-y-auto p-2 backdrop-blur" data-scroll-region>
          <div className="lokin-kicker lokin-kicker-lime px-1 pb-1.5">MANEUVERS</div>
          {upcoming.length === 0 ? (
            <div className="px-1 py-2 text-[11px] text-white/45">No upcoming maneuvers on this route.</div>
          ) : (
            upcoming.map((m, i) => {
              const RowIcon = maneuverArrow(m.maneuver?.type, m.maneuver?.modifier);
              const untilM = Math.max(0, Number(m.along_route_m || 0) - drivenAlongM);
              return (
                <div key={`${m.leg_index ?? ""}-${m.step_index ?? i}`} className="flex items-center gap-2.5 rounded-xl px-1.5 py-1.5">
                  <RowIcon className="h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1 truncate text-[12px] font-semibold text-white/85">{streetFor(m)}</div>
                  <div className="shrink-0 font-display text-[11px] font-bold text-primary/80">{formatDistance(untilM)}</div>
                </div>
              );
            })
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Collapse maneuver list" : "Expand maneuver list"}
        className="lokin-card flex w-full min-w-0 max-w-full items-center gap-2.5 px-3 py-2.5 text-left backdrop-blur active:scale-[0.99]"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/40 bg-primary/10 glow-primary">
          <Arrow className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="truncate text-[13px] font-extrabold leading-tight text-white">{arrived ? arrivedLabel : streetFor(maneuver)}</div>
        </div>
        {arrived ? (
          <span className="shrink-0 font-display text-sm font-black text-primary">DONE</span>
        ) : (
          <div className="flex shrink-0 items-center gap-1.5">
            {etaLiveTraffic && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent shadow-[0_0_6px_hsl(188_95%_50%)]" aria-hidden />}
            <span className="whitespace-nowrap font-display text-[15px] font-black leading-none text-primary">{clock}</span>
            <span className="whitespace-nowrap text-[10px] font-semibold text-white/50">
              {formatDuration(remainingDurationS)}{distanceText ? ` · ${distanceText}` : ""}
            </span>
            {open ? <ChevronUp className="h-4 w-4 shrink-0 text-white/45" /> : <ChevronDown className="h-4 w-4 shrink-0 text-white/45" />}
          </div>
        )}
      </button>
    </div>
  );
}