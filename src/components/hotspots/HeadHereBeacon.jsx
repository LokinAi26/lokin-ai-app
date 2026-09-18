import { Flame, MapPin } from "lucide-react";
import { METRICS, heatColor, metricValue, metricDisplay } from "@/lib/heatData";

// Direction helpers for the "busiest area nearby" beacon.
const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

export function bearingTo(from, to) {
  const lat1 = (from[0] * Math.PI) / 180;
  const lat2 = (to[0] * Math.PI) / 180;
  const dLon = ((to[1] - from[1]) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

export function compassLabel(bearing) {
  return COMPASS[Math.round(bearing / 45) % 8];
}

// Best nearby zones: payoff per mile traveled, so a closer hot zone beats a
// distant one with a similar score.
export function pickHeadZones(zones, metric, count = 3) {
  return [...zones]
    .map((zone) => ({ zone, score: metricValue(zone, metric) / (1 + zone.dist) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((entry) => entry.zone);
}

// Highlights the busiest delivery areas near the driver: a compass beacon
// pointing at the single best zone to head toward, plus the runners-up.
export default function HeadHereBeacon({ zones, center, metric, onFocus }) {
  const picks = pickHeadZones(zones, metric, 3);
  if (!center || picks.length === 0) return null;

  const [lead, ...alsoBusy] = picks;
  const bearing = bearingTo(center, [lead.lat, lead.lng]);
  const leadColor = heatColor(metric, metricValue(lead, metric));
  const activeMetric = METRICS.find((m) => m.id === metric);

  return (
    <div className="lokin-card p-4 glow-border">
      <button
        type="button"
        onClick={() => onFocus([lead.lat, lead.lng])}
        className="w-full text-left transition-all active:scale-[0.99]"
      >
        <div className="flex items-center gap-4">
          {/* Compass dial — needle points toward the busiest zone */}
          <div className="relative h-16 w-16 shrink-0 rounded-full border border-primary/40 bg-black/70">
            <div className="absolute inset-1.5 rounded-full border border-primary/15" />
            <div className="absolute inset-0 flex items-center justify-center" style={{ transform: `rotate(${bearing}deg)` }}>
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                style={{ filter: `drop-shadow(0 0 8px ${leadColor})` }}
              >
                <path d="M12 2.5l6.5 16.5L12 15.4 5.5 19z" fill={leadColor} stroke="rgba(255,255,255,.75)" strokeWidth="0.6" />
              </svg>
            </div>
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full border border-primary/30 bg-black px-1.5 text-[8px] font-bold tracking-wider text-primary">
              {compassLabel(bearing)}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="lokin-kicker lokin-kicker-lime flex items-center gap-1.5">
              <Flame className="h-3 w-3" /> HEAD HERE NOW
            </div>
            <div className="mt-0.5 truncate font-heading text-xl font-black text-white">{lead.name}</div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-white/50">
              <span>{bearing.toFixed(0)}° {compassLabel(bearing)}</span>
              <span className="text-white/20">·</span>
              <span>{lead.dist == null ? "distance n/a" : `${lead.dist.toFixed(1)} mi away`}</span>
              <span className="text-white/20">·</span>
              <span>{lead.volume} vol</span>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div className="font-display font-black text-2xl leading-none" style={{ color: leadColor }}>
              {metricDisplay(lead, metric)}
            </div>
            <div className="text-[9px] tracking-widest text-white/40 font-display">{activeMetric.label.toUpperCase()}</div>
          </div>
        </div>
      </button>

      {alsoBusy.length > 0 && (
        <div className="mt-3 border-t border-white/10 pt-2.5">
          <div className="lokin-kicker mb-1.5">ALSO BUSY NEARBY</div>
          <div className="space-y-1.5">
            {alsoBusy.map((zone) => {
              const c = heatColor(metric, metricValue(zone, metric));
              return (
                <button
                  key={zone.id}
                  type="button"
                  onClick={() => onFocus([zone.lat, zone.lng])}
                  className="flex w-full items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-2.5 py-2 text-left transition-all active:scale-[0.99]"
                >
                  <MapPin className="h-3 w-3 shrink-0" style={{ color: c }} />
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold text-white/85">{zone.name}</span>
                  <span className="text-[10px] text-white/45">{zone.dist == null ? "—" : `${zone.dist.toFixed(1)} mi`}</span>
                  <span className="font-display font-bold text-sm" style={{ color: c }}>{metricDisplay(zone, metric)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}