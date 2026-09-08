// Starlink-style orbital satellite constellation visualization.
// Animated SVG: a glowing globe with orbiting satellites and connection beams
// to the device. Beam color reflects the current link quality.

export default function SatelliteView({ status = "online", connected = 4 }) {
  // status: "online" | "weak" | "offline"
  const beamColor =
    status === "online" ? "#A2EB1B" : status === "weak" ? "#FFD200" : "#FF3B3B";
  const glow =
    status === "online"
      ? "drop-shadow(0 0 8px rgba(168,255,0,0.85))"
      : status === "weak"
      ? "drop-shadow(0 0 8px rgba(255,210,0,0.8))"
      : "drop-shadow(0 0 8px rgba(255,59,59,0.7))";

  // Satellites distributed across 2 orbits
  const sats = [
    { orbit: 0, angle: 20 },
    { orbit: 0, angle: 150 },
    { orbit: 1, angle: 80 },
    { orbit: 1, angle: 260 },
  ];

  function satPos(orbit, angle) {
    const r = orbit === 0 ? 78 : 96;
    const rad = (angle * Math.PI) / 180;
    return { x: 120 + Math.cos(rad) * r, y: 120 + Math.sin(rad) * r * 0.62 };
  }

  return (
    <div className="relative aspect-square w-full max-w-[260px] mx-auto">
      <svg viewBox="0 0 240 240" className="h-full w-full">
        <defs>
          <radialGradient id="globe-grad" cx="42%" cy="38%" r="68%">
            <stop offset="0%" stopColor="#13202b" />
            <stop offset="60%" stopColor="#0a1014" />
            <stop offset="100%" stopColor="#020303" />
          </radialGradient>
          <linearGradient id="beam-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={beamColor} stopOpacity="0.9" />
            <stop offset="100%" stopColor={beamColor} stopOpacity="0.15" />
          </linearGradient>
        </defs>

        {/* Orbital rings (tilted ellipses) */}
        <g transform="rotate(-18 120 120)">
          <ellipse cx="120" cy="120" rx="78" ry="48" fill="none" stroke="hsl(81 84% 51% / 0.22)" strokeWidth="1" strokeDasharray="3 5" />
          <ellipse cx="120" cy="120" rx="96" ry="60" fill="none" stroke="hsl(188 95% 50% / 0.18)" strokeWidth="1" strokeDasharray="3 6" />
        </g>

        {/* Globe */}
        <circle cx="120" cy="120" r="46" fill="url(#globe-grad)" stroke="hsl(81 84% 51% / 0.4)" strokeWidth="1.5" />
        {/* Meridians + parallels for a planet look */}
        <g stroke="hsl(81 84% 51% / 0.18)" strokeWidth="0.8" fill="none">
          <ellipse cx="120" cy="120" rx="46" ry="14" />
          <ellipse cx="120" cy="120" rx="46" ry="28" />
          <ellipse cx="120" cy="120" rx="14" ry="46" />
          <ellipse cx="120" cy="120" rx="28" ry="46" />
          <line x1="74" y1="120" x2="166" y2="120" />
        </g>
        {/* Glow halo when online */}
        {status === "online" && (
          <circle cx="120" cy="120" r="52" fill="none" stroke={beamColor} strokeWidth="1.2" opacity="0.4" className="lokin-pulse" />
        )}

        {/* Connection beams from device (bottom) up to connected satellites */}
        {status !== "offline" &&
          sats.slice(0, Math.min(connected, sats.length)).map((s, i) => {
            const p = satPos(s.orbit, s.angle);
            return (
              <line
                key={`beam-${i}`}
                x1={p.x}
                y1={p.y}
                x2={120}
                y2={120}
                stroke="url(#beam-grad)"
                strokeWidth="1.4"
                strokeDasharray="2 4"
                style={{ filter: glow }}
              />
            );
          })}

        {/* Satellites */}
        <g transform="rotate(-18 120 120)">
          {sats.map((s, i) => {
            const p = satPos(s.orbit, s.angle);
            const linked = status !== "offline" && i < connected;
            const cls = s.orbit === 0 ? "sat-orbit-0" : "sat-orbit-1";
            return (
              <g key={i} style={{ transformOrigin: `${p.x}px ${p.y}px` }} className={cls}>
                {/* Solar panels */}
                <rect x={p.x - 9} y={p.y - 2} width={18} height={4} rx="1" fill="#0b1116" stroke={linked ? beamColor : "hsl(0 0% 60% / 0.6)"} strokeWidth="0.7" />
                {/* Body */}
                <rect x={p.x - 3} y={p.y - 3} width={6} height={6} rx="1" fill={linked ? beamColor : "#3a4250"} style={{ filter: linked ? glow : "none" }} />
                {/* Blink */}
                {linked && <circle cx={p.x} cy={p.y} r="1.4" fill="#fff" opacity="0.9" />}
              </g>
            );
          })}
        </g>

        {/* Device node at center bottom */}
        <g transform="translate(120 120)">
          <circle r="7" fill="#050608" stroke={beamColor} strokeWidth="2" style={{ filter: glow }} />
          <circle r="2.5" fill={beamColor} />
        </g>
      </svg>

      <style>{`
        @keyframes sat-rotate-0 { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes sat-rotate-1 { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
        .sat-orbit-0 { animation: sat-rotate-0 14s linear infinite; transform-box: fill-box; }
        .sat-orbit-1 { animation: sat-rotate-1 22s linear infinite; transform-box: fill-box; }
      `}</style>
    </div>
  );
}