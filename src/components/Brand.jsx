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

// Header lockup (lock icon + LOKIN AI + tagline), cropped from the approved concept.
export const LOKIN_HEADER_LOCKUP_V2 = "https://media.base44.com/images/public/6a7a1c830b6bae64604c3139/64627fadc_official-lokin-clean-clock-lock_247_noeffect-SQUARE.png";
export const LOKIN_HEADER_LOCKUP = LOKIN_HEADER_LOCKUP_V2;
export const LOKIN_NAV_CIRCLE = "https://media.base44.com/images/public/6a7a1c830b6bae64604c3139/64627fadc_official-lokin-clean-clock-lock_247_noeffect-SQUARE.png";
export const LOKIN_SKYLINE_BG = "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/f962c1480_city-skyline-night.png";
// The one and only Home center artwork: cut exactly from the approved concept image.
export const LOKIN_CENTER = "https://media.base44.com/images/public/6a7a1c830b6bae64604c3139/983c19285_official-lokin-clean-idle_no_ticker_247.png";
// Paused-state center artwork: vivid lock emblem only (no START WORK pill), from Kendall's color reference 2026-09-15.
export const LOKIN_CENTER_PAUSED = "https://media.base44.com/images/public/6a7a1c830b6bae64604c3139/ff2958bee_official-lokin-clean-lock_no_ticker_247.png";

// LOKIN AI brand logo from the workspace brand kit — chrome padlock-clock emblem
// with the "Unlock your potential" wordmark. Used for sticky logo headers.
export const LOKIN_LOGO = "https://media.base44.com/images/public/workspaces/6a7a1b84642cb1ece6bc8361/brands/7594fbdca_brand_upload_logo.png";