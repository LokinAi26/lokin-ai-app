// LOKIN AI brand mark — the "O" in LOKIN: a padlock fused with a clock.
// Lock = focus. Clock = time. "Lock in your time because time is money."

export function LokinGlyph({ size = 28, className = "" }) {
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
        <linearGradient id="lokinNeon" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="hsl(142 80% 60%)" />
          <stop offset="100%" stopColor="hsl(170 80% 45%)" />
        </linearGradient>
      </defs>
      {/* clock ring */}
      <circle cx="50" cy="54" r="34" stroke="url(#lokinNeon)" strokeWidth="7" />
      {/* tick 12 */}
      <line x1="50" y1="24" x2="50" y2="31" stroke="url(#lokinNeon)" strokeWidth="5" strokeLinecap="round" />
      {/* tick 3 */}
      <line x1="80" y1="54" x2="73" y2="54" stroke="url(#lokinNeon)" strokeWidth="5" strokeLinecap="round" />
      {/* tick 9 */}
      <line x1="20" y1="54" x2="27" y2="54" stroke="url(#lokinNeon)" strokeWidth="5" strokeLinecap="round" />
      {/* clock hands 10:10 */}
      <line x1="50" y1="54" x2="38" y2="40" stroke="url(#lokinNeon)" strokeWidth="5" strokeLinecap="round" />
      <line x1="50" y1="54" x2="64" y2="58" stroke="url(#lokinNeon)" strokeWidth="5" strokeLinecap="round" />
      {/* padlock shackle */}
      <path d="M38 32 V24 a12 12 0 0 1 24 0 V32" stroke="url(#lokinNeon)" strokeWidth="7" strokeLinecap="round" fill="none" />
      {/* keyhole */}
      <circle cx="50" cy="54" r="4" fill="url(#lokinNeon)" />
    </svg>
  );
}

export function LokinWordmark({ size = 28, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <LokinGlyph size={size} />
      <span className="font-display font-extrabold tracking-[0.18em] leading-none">
        <span className="text-foreground">L</span>
        <span className="text-foreground">O</span>
        <span className="text-foreground">K</span>
        <span className="text-foreground">IN</span>
        <span className="text-primary text-glow ml-1.5 text-[0.62em] align-middle">AI</span>
      </span>
    </span>
  );
}

export default function Brand({ size = 28, withText = true, className = "" }) {
  return withText
    ? <LokinWordmark size={size} className={className} />
    : <LokinGlyph size={size} className={className} />;
}