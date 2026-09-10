// LOKIN AI signature brand mark.
// The O is a padlock fused with a clock: lock your time because time is money.

export function LokinGlyph({ size = 28, className = "" }) {
  const gid = `lokin-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      role="img"
      aria-label="LOKIN lock clock logo"
    >
      <defs>
        <linearGradient id={`${gid}-neon`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#d7ff45" />
          <stop offset="45%" stopColor="#8dff00" />
          <stop offset="100%" stopColor="#39b900" />
        </linearGradient>
        <linearGradient id={`${gid}-metal`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="48%" stopColor="#c8ced8" />
          <stop offset="100%" stopColor="#707783" />
        </linearGradient>
        <radialGradient id={`${gid}-face`} cx="45%" cy="38%" r="65%">
          <stop offset="0%" stopColor="#171b20" />
          <stop offset="100%" stopColor="#020304" />
        </radialGradient>
        <filter id={`${gid}-glow`} x="-70%" y="-70%" width="240%" height="240%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle cx="50" cy="58" r="38" fill="#8dff00" opacity="0.08" filter={`url(#${gid}-glow)`} />

      {/* Padlock shackle */}
      <path
        d="M35 40 V27 a15 15 0 0 1 30 0 V40"
        stroke={`url(#${gid}-neon)`}
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
        filter={`url(#${gid}-glow)`}
      />

      {/* Metallic clock bezel + black clock face */}
      <circle cx="50" cy="58" r="35" fill="#050608" stroke={`url(#${gid}-metal)`} strokeWidth="6" />
      <circle cx="50" cy="58" r="30" fill={`url(#${gid}-face)`} stroke={`url(#${gid}-neon)`} strokeWidth="3" />

      {/* Twelve clock markers */}
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i * Math.PI) / 6;
        const x1 = 50 + Math.cos(a) * 25;
        const y1 = 58 + Math.sin(a) * 25;
        const x2 = 50 + Math.cos(a) * 21;
        const y2 = 58 + Math.sin(a) * 21;
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#d8dde5"
            strokeWidth={i % 3 === 0 ? 2.2 : 1.1}
            opacity="0.9"
          />
        );
      })}

      {/* Signature hands: forward-moving time */}
      <line x1="50" y1="58" x2="50" y2="41" stroke="#ffffff" strokeWidth="3.8" strokeLinecap="round" />
      <line x1="50" y1="58" x2="65" y2="48" stroke={`url(#${gid}-neon)`} strokeWidth="4" strokeLinecap="round" />
      <circle cx="50" cy="58" r="4" fill={`url(#${gid}-neon)`} stroke="#ffffff" strokeWidth="1.2" />

      {/* Keyhole accent */}
      <path d="M50 63 l-3 5 h6 z" fill={`url(#${gid}-neon)`} opacity="0.9" />
    </svg>
  );
}

export function LokinWordmark({ size = 28, className = "" }) {
  return (
    <span className={`inline-flex items-center ${className}`}>
      <span className="font-display font-black tracking-[0.1em] leading-none flex items-center">
        <span className="metal-text">L</span>
        <LokinGlyph size={size * 0.95} className="mx-0.5 -my-0.5" />
        <span className="metal-text">KIN</span>
        <span className="text-primary text-glow ml-1.5 text-[0.55em] align-middle font-black tracking-normal">AI</span>
      </span>
    </span>
  );
}

export default function Brand({ size = 28, withText = true, className = "" }) {
  return withText
    ? <LokinWordmark size={size} className={className} />
    : <LokinGlyph size={size} className={className} />;
}

// Concept emblem artwork (black-background PNG). Blends invisibly on black.
// Pass `cover` to fill a clipped container (e.g. a rounded-full ring) edge to
// edge so the artwork never renders as a floating box.
export function LokinEmblemImg({ size = 96, className = "", alt = "LOKIN emblem", cover = false }) {
  return (
    <img
      src="https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/e475600a6_lokin-emblem.png"
      width={size}
      height={size}
      alt={alt}
      draggable="false"
      className={className}
      style={cover ? { width: "100%", height: "100%", objectFit: "cover", display: "block" } : { maxWidth: "100%", height: "auto" }}
    />
  );
}

// Clean hero lock/clock artwork (no wordmark), cropped from the approved concept.
export const LOKIN_HERO_LOCK = "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/80310056f_lokin-hero-lock.png";
// Free-floating hero (transparent background), cropped from the approved concept.
export const LOKIN_HERO_LOCK_V4 = "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/fc4d3eae5_lokin-hero-lock-v4.png";
// Header lockup (lock icon + LOKIN AI + tagline), cropped from the approved concept.
export const LOKIN_HEADER_LOCKUP_V2 = "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/19590ff33_lokin-header-lockup-v2.png";
// Back-compat aliases — every surface now resolves to the exact concept-matched assets.
export const LOKIN_HERO_LOCK_V3 = LOKIN_HERO_LOCK_V4;
export const LOKIN_HERO_LOCK_V2 = LOKIN_HERO_LOCK_V4;
export const LOKIN_NAV_LOCK_V4 = LOKIN_NAV_LOCK_V5;
export const LOKIN_NAV_LOCK_V3 = LOKIN_NAV_LOCK_V5;
export const LOKIN_NAV_LOCK_V2 = LOKIN_NAV_LOCK_V4;
export const LOKIN_NAV_LOCK = LOKIN_NAV_LOCK_V3;
export const LOKIN_HEADER_LOCKUP = LOKIN_HEADER_LOCKUP_V2;
// Bottom-nav center lock, cropped from the approved concept.
export const LOKIN_NAV_LOCK_V5 = "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/19bb8929d_lokin-nav-lock-v5.png";

export const LOKIN_SKYLINE_BG = "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/f962c1480_city-skyline-night.png";
