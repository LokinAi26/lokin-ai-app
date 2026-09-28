// LOKIN AI signature brand mark.
// The O is a padlock fused with a clock: lock your time because time is money.
// GLYPH artwork (Kendall: "Change the GLYPH", 2026-09-28): his crowned chrome
// lock-clock render, transparent cutout in public/assets. Replaces the old inline SVG.

export function LokinGlyph({ size = 28, className = "" }) {
  return (
    <img
      src="/assets/lokin-glyph-crown.png"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="LOKIN lock clock logo"
      alt="LOKIN lock clock logo"
      draggable={false}
    />
  );
}

// The one and only official LOKIN clock: transparent clean padlock-clock
// cutout, no glow (LOCKED 2026-09-16). Used as the "O" in the wordmark.
export const LOKIN_CLOCK_OFFICIAL = "https://media.base44.com/images/public/6a7a1c830b6bae64604c3139/64627fadc_official-lokin-clean-clock-lock_247_noeffect-SQUARE.png";

export function LokinWordmark({ size = 28, className = "" }) {
  return (
    <span className={`inline-flex items-center ${className}`}>
      <span className="font-display font-black tracking-[0.1em] leading-none flex items-center">
        <span className="metal-text">L</span>
        <img src={LOKIN_CLOCK_OFFICIAL} alt="O" width={size * 0.95} height={size * 0.95} className="mx-0.5 -my-0.5 inline-block" draggable={false} />
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
export const LOKIN_CENTER = "https://media.base44.com/images/public/6a7a1c830b6bae64604c3139/ff2958bee_official-lokin-clean-lock_no_ticker_247.png";
// Paused-state center artwork: vivid lock emblem only (no START WORK pill), from Kendall's color reference 2026-09-15.
export const LOKIN_CENTER_PAUSED = "https://media.base44.com/images/public/6a7a1c830b6bae64604c3139/ff2958bee_official-lokin-clean-lock_no_ticker_247.png";

// LOKIN AI brand logo from the workspace brand kit — chrome padlock-clock emblem
// with the "Unlock your potential" wordmark. Used for sticky logo headers.
export const LOKIN_LOGO = "https://media.base44.com/images/public/workspaces/6a7a1b84642cb1ece6bc8361/brands/7594fbdca_brand_upload_logo.png";