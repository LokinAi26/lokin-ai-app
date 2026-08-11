// LOKIN AI brand mark — the "O" in LOKIN: a padlock fused with a clock.
// Lock = focus. Clock = time. "Lock in your time because time is money."

export function LokinGlyph({ size = 28, className = "" }) {
  const gid = "lokinNeon";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="hsl(80 100% 62%)" />
          <stop offset="100%" stopColor="hsl(92 100% 42%)" />
        </linearGradient>
      </defs>

      {/* speed streaks trailing behind — fast motion */}
      <g stroke={`url(#${gid})`} strokeWidth="4" strokeLinecap="round" opacity="0.9">
        <line x1="6" y1="46" x2="16" y2="46" className="lokin-streak" />
        <line x1="4" y1="58" x2="18" y2="58" className="lokin-streak" style={{ animationDelay: "0.15s" }} />
        <line x1="6" y1="70" x2="16" y2="70" className="lokin-streak" style={{ animationDelay: "0.3s" }} />
      </g>

      {/* padlock shackle — bold arch on top */}
      <path
        d="M37 40 V28 a13 13 0 0 1 26 0 V40"
        stroke={`url(#${gid})`}
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
      />

      {/* lock body = clock face ring */}
      <circle cx="50" cy="58" r="33" stroke={`url(#${gid})`} strokeWidth="8" />

      {/* clock ticks — 12 / 3 / 6 / 9 */}
      <line x1="50" y1="30" x2="50" y2="36" stroke={`url(#${gid})`} strokeWidth="5" strokeLinecap="round" />
      <line x1="78" y1="58" x2="72" y2="58" stroke={`url(#${gid})`} strokeWidth="5" strokeLinecap="round" />
      <line x1="50" y1="86" x2="50" y2="80" stroke={`url(#${gid})`} strokeWidth="5" strokeLinecap="round" />
      <line x1="22" y1="58" x2="28" y2="58" stroke={`url(#${gid})`} strokeWidth="5" strokeLinecap="round" />

      {/* clock hands — spinning fast to convey motion */}
      <g className="lokin-spin" stroke={`url(#${gid})`} strokeWidth="5" strokeLinecap="round">
        <line x1="50" y1="58" x2="38" y2="44" />
        <line x1="50" y1="58" x2="64" y2="62" />
        <circle cx="50" cy="58" r="2.5" fill={`url(#${gid})`} stroke="none" />
      </g>

      {/* keyhole in center */}
      <circle cx="50" cy="58" r="4.5" fill={`url(#${gid})`} />
      <rect x="48.5" y="58" width="3" height="7" rx="1.5" fill={`url(#${gid})`} />
    </svg>
  );
}

export function LokinWordmark({ size = 28, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span className="font-display font-extrabold tracking-[0.2em] leading-none flex items-center">
        <span className="metal-text">L</span>
        <LokinGlyph size={size * 0.8} className="mx-[1px] -my-0.5" />
        <span className="metal-text">KIN</span>
        <span className="text-primary text-glow ml-1.5 text-[0.6em] align-middle">AI</span>
      </span>
    </span>
  );
}

export default function Brand({ size = 28, withText = true, className = "" }) {
  return withText
    ? <LokinWordmark size={size} className={className} />
    : <LokinGlyph size={size} className={className} />;
}