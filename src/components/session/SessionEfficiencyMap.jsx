import { Route as RouteIcon } from "lucide-react";

// End-of-session efficiency map: draws the path actually driven during the
// shift against the AI-optimized route, with numbered stops and a route
// efficiency score (optimal distance vs actual GPS miles).
const W = 320;
const H = 176;
const PAD = 14;
const METERS_PER_MILE = 1609.344;

function validCoords(list) {
  return (Array.isArray(list) ? list : [])
    .map((c) => [Number(c?.[0]), Number(c?.[1])])
    .filter((c) => Number.isFinite(c[0]) && Number.isFinite(c[1]));
}

function polylineMeters(coords) {
  let total = 0;
  for (let i = 1; i < coords.length; i += 1) {
    const [lon1, lat1] = coords[i - 1];
    const [lon2, lat2] = coords[i];
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const x = dLon * Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180);
    total += Math.sqrt(x * x + dLat * dLat) * 6371000;
  }
  return total;
}

function toPathD(coords, project) {
  return coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${project(c)[0].toFixed(1)} ${project(c)[1].toFixed(1)}`)
    .join(" ");
}

export default function SessionEfficiencyMap({ actualPath = [], optimizedGeometry = [], stops = [], actualMiles = 0 }) {
  const actual = validCoords(actualPath);
  const optimized = validCoords(optimizedGeometry?.coordinates || optimizedGeometry);
  const hasActual = actual.length >= 2;
  const hasOptimized = optimized.length >= 2;
  if (!hasActual && !hasOptimized) return null;

  const all = [...actual, ...optimized];
  const lons = all.map((c) => c[0]);
  const lats = all.map((c) => c[1]);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const latScale = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const dx = Math.max(1e-9, (maxLon - minLon) * latScale);
  const dy = Math.max(1e-9, maxLat - minLat);
  const scale = Math.min((W - PAD * 2) / dx, (H - PAD * 2) / dy);
  const drawW = dx * scale;
  const drawH = dy * scale;
  const project = ([lon, lat]) => [
    PAD + (W - PAD * 2 - drawW) / 2 + (lon - minLon) * latScale * scale,
    PAD + (H - PAD * 2 - drawH) / 2 + (maxLat - lat) * scale,
  ];

  const optimizeMiles = hasOptimized ? polylineMeters(optimized) / METERS_PER_MILE : 0;
  const efficiency =
    optimizeMiles > 0 && actualMiles > 0 ? Math.min(100, Math.round((optimizeMiles / actualMiles) * 100)) : null;
  const extraMiles = Math.max(0, actualMiles - optimizeMiles);

  const stopPts = validCoords(stops.map((s) => s.coordinate)).map((c, i) => ({
    x: project(c)[0],
    y: project(c)[1],
    sequence: Number(stops[i]?.sequence) || i + 1,
  }));

  return (
    <div className="mt-4">
      <div className="lokin-kicker lokin-kicker-lime mb-2">ROUTE EFFICIENCY MAP</div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full rounded-2xl border border-white/10 bg-black/70"
        role="img"
        aria-label="Driven path compared with the AI-optimized route"
      >
        {[0.25, 0.5, 0.75].map((f) => (
          <g key={f} stroke="hsl(var(--primary) / 0.06)" strokeWidth="1">
            <line x1={W * f} y1="0" x2={W * f} y2={H} />
            <line x1="0" y1={H * f} x2={W} y2={H * f} />
          </g>
        ))}
        {hasOptimized && (
          <path
            d={toPathD(optimized, project)}
            fill="none"
            stroke="#22D3EE"
            strokeWidth="2"
            strokeDasharray="6 5"
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity="0.85"
          />
        )}
        {hasActual && (
          <path
            d={toPathD(actual, project)}
            fill="none"
            stroke="#8FE44E"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            style={{ filter: "drop-shadow(0 0 5px rgba(124,252,30,.7))" }}
          />
        )}
        {stopPts.map((s) => (
          <g key={s.sequence}>
            <circle cx={s.x} cy={s.y} r="9" fill="#050505" stroke="#8FE44E" strokeWidth="1.5" />
            <text x={s.x} y={s.y + 3.5} textAnchor="middle" fontSize="9" fontWeight="800" fill="#8FE44E">
              {s.sequence}
            </text>
          </g>
        ))}
      </svg>
      <div className="mt-2 flex items-center justify-between text-[10px] text-white/45">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded-full bg-[#8FE44E]" /> YOUR DRIVE
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-4 rounded-full"
            style={{ background: "repeating-linear-gradient(90deg,#22D3EE 0 4px,transparent 4px 7px)" }}
          />{" "}
          AI-OPTIMIZED ROUTE
        </span>
      </div>
      {efficiency != null && (
        <>
          <div className="mt-2 flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
            <span className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] text-white/50">
              <RouteIcon className="h-4 w-4 text-primary" /> EFFICIENCY
            </span>
            <span className="font-display font-black text-lg text-primary">{efficiency}%</span>
          </div>
          <div className="mt-1.5 text-center text-[10px] text-white/40">
            {actualMiles.toFixed(1)} mi driven vs {optimizeMiles.toFixed(1)} mi optimal
            {extraMiles >= 0.05 ? ` · ${extraMiles.toFixed(1)} mi extra` : " · on-optimal or better"}
          </div>
        </>
      )}
    </div>
  );
}