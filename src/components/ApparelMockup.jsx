import { LokinGlyph } from "@/components/Brand";

const SWATCH = "#0b0f14";
const NEON = "#AAFF00";

function Tee({ glyphColor = NEON }) {
  return (
    <svg viewBox="0 0 240 240" className="h-full w-full">
      <path d="M70 64 L38 50 L26 92 L60 104 L60 212 L180 212 L180 104 L214 92 L202 50 L170 64 Q120 54 70 64 Z" fill={SWATCH} stroke="hsl(80 100% 50% / 0.35)" strokeWidth="2" />
      <path d="M95 64 Q120 50 145 64" fill="none" stroke="hsl(0 0% 100% / 0.18)" strokeWidth="3" />
      <g transform="translate(120 110)">
        <LokinGlyph size={70} />
      </g>
    </svg>
  );
}

function Hoodie({ glyphColor = NEON }) {
  return (
    <svg viewBox="0 0 240 240" className="h-full w-full">
      <path d="M70 70 L36 54 L24 96 L60 108 L60 214 L180 214 L180 108 L216 96 L204 54 L170 70 Z" fill={SWATCH} stroke="hsl(80 100% 50% / 0.35)" strokeWidth="2" />
      <path d="M95 70 Q120 30 145 70 Q120 84 95 70 Z" fill="#05080b" stroke="hsl(80 100% 50% / 0.3)" strokeWidth="2" />
      <line x1="108" y1="74" x2="108" y2="150" stroke="hsl(0 0% 100% / 0.12)" strokeWidth="2" />
      <line x1="132" y1="74" x2="132" y2="150" stroke="hsl(0 0% 100% / 0.12)" strokeWidth="2" />
      <rect x="80" y="150" width="80" height="46" rx="8" fill="hsl(0 0% 0% / 0.4)" stroke="hsl(80 100% 50% / 0.2)" strokeWidth="1.5" />
      <g transform="translate(120 120)">
        <LokinGlyph size={62} />
      </g>
    </svg>
  );
}

function Cap({ glyphColor = NEON }) {
  return (
    <svg viewBox="0 0 240 240" className="h-full w-full">
      <path d="M34 132 Q34 64 120 58 Q206 64 206 132 Z" fill={SWATCH} stroke="hsl(80 100% 50% / 0.35)" strokeWidth="2" />
      <path d="M22 130 Q120 158 218 130 L218 142 Q120 166 22 142 Z" fill="#05080b" stroke="hsl(80 100% 50% / 0.3)" strokeWidth="2" />
      <rect x="92" y="66" width="56" height="44" rx="8" fill="#05080b" stroke="hsl(80 100% 50% / 0.25)" strokeWidth="1.5" />
      <g transform="translate(95 72)">
        <LokinGlyph size={48} />
      </g>
    </svg>
  );
}

function Sticker({ glyphColor = NEON }) {
  return (
    <svg viewBox="0 0 240 240" className="h-full w-full">
      <rect x="30" y="60" width="180" height="120" rx="16" transform="rotate(-6 120 120)" fill="#05080b" stroke="hsl(80 100% 50% / 0.5)" strokeWidth="2" />
      <g transform="translate(95 78) rotate(6 25 42)">
        <LokinGlyph size={56} />
      </g>
      <text x="130" y="150" transform="rotate(-6 120 120)" fill={NEON} fontFamily="var(--font-display)" fontWeight="800" fontSize="20" letterSpacing="2">LOKIN AI</text>
    </svg>
  );
}

function DeliveryBag({ glyphColor = NEON }) {
  return (
    <svg viewBox="0 0 240 240" className="h-full w-full">
      <rect x="40" y="70" width="160" height="150" rx="14" fill={SWATCH} stroke="hsl(80 100% 50% / 0.35)" strokeWidth="2" />
      <rect x="40" y="70" width="160" height="34" rx="14" fill="#05080b" stroke="hsl(80 100% 50% / 0.3)" strokeWidth="2" />
      <rect x="58" y="60" width="124" height="20" rx="6" fill="none" stroke="hsl(0 0% 100% / 0.25)" strokeWidth="3" />
      <rect x="100" y="48" width="40" height="16" rx="5" fill="#05080b" stroke="hsl(80 100% 50% / 0.3)" strokeWidth="2" />
      <line x1="120" y1="74" x2="120" y2="104" stroke="hsl(0 0% 100% / 0.15)" strokeWidth="2" />
      <rect x="74" y="120" width="92" height="74" rx="8" fill="hsl(0 0% 0% / 0.35)" stroke="hsl(80 100% 50% / 0.25)" strokeWidth="1.5" />
      <g transform="translate(95 126)">
        <LokinGlyph size={54} />
      </g>
      <text x="122" y="186" fill={NEON} fontFamily="var(--font-display)" fontWeight="700" fontSize="9" letterSpacing="1.5" textAnchor="middle">INSULATED</text>
    </svg>
  );
}

function CateringBag({ glyphColor = NEON }) {
  return (
    <svg viewBox="0 0 240 240" className="h-full w-full">
      <rect x="28" y="80" width="184" height="140" rx="10" fill={SWATCH} stroke="hsl(80 100% 50% / 0.35)" strokeWidth="2" />
      <rect x="28" y="80" width="184" height="28" rx="10" fill="#05080b" stroke="hsl(80 100% 50% / 0.3)" strokeWidth="2" />
      <path d="M52 78 V54 Q52 44 62 44 H90 Q100 44 100 54 V78" fill="none" stroke="hsl(0 0% 100% / 0.25)" strokeWidth="3" />
      <path d="M140 78 V54 Q140 44 150 44 H178 Q188 44 188 54 V78" fill="none" stroke="hsl(0 0% 100% / 0.25)" strokeWidth="3" />
      <line x1="120" y1="108" x2="120" y2="220" stroke="hsl(0 0% 100% / 0.12)" strokeWidth="2" />
      <g transform="translate(96 140)">
        <LokinGlyph size={48} />
      </g>
      <text x="122" y="196" fill={NEON} fontFamily="var(--font-display)" fontWeight="700" fontSize="9" letterSpacing="1.5" textAnchor="middle">CATERING</text>
    </svg>
  );
}

function PizzaBag({ glyphColor = NEON }) {
  return (
    <svg viewBox="0 0 240 240" className="h-full w-full">
      <rect x="44" y="78" width="152" height="140" rx="12" fill={SWATCH} stroke="hsl(80 100% 50% / 0.35)" strokeWidth="2" />
      <rect x="44" y="78" width="152" height="30" rx="12" fill="#05080b" stroke="hsl(80 100% 50% / 0.3)" strokeWidth="2" />
      <rect x="64" y="70" width="112" height="16" rx="5" fill="none" stroke="hsl(0 0% 100% / 0.25)" strokeWidth="3" />
      <rect x="72" y="120" width="96" height="80" rx="8" fill="hsl(0 0% 0% / 0.35)" stroke="hsl(80 100% 50% / 0.25)" strokeWidth="1.5" />
      <g transform="translate(96 126)">
        <LokinGlyph size={46} />
      </g>
      <text x="122" y="190" fill={NEON} fontFamily="var(--font-display)" fontWeight="700" fontSize="9" letterSpacing="1.5" textAnchor="middle">PIZZA</text>
    </svg>
  );
}

function Shiesty({ glyphColor = NEON }) {
  return (
    <svg viewBox="0 0 240 240" className="h-full w-full">
      {/* Balaclava head + neck */}
      <path d="M70 56 Q120 26 170 56 L170 150 Q170 168 152 170 H88 Q70 168 70 150 Z M88 170 L84 214 H156 L152 170 Z" fill={SWATCH} stroke="hsl(80 100% 50% / 0.35)" strokeWidth="2" />
      {/* Face opening */}
      <path d="M92 70 Q120 64 148 70 L142 120 Q120 132 98 120 Z" fill="#05080b" stroke="hsl(80 100% 50% / 0.3)" strokeWidth="2" />
      {/* Single eye slit */}
      <rect x="104" y="86" width="44" height="9" rx="4.5" fill="#020303" stroke="hsl(80 100% 50% / 0.5)" strokeWidth="1.2" />
      {/* Crown seam */}
      <path d="M92 52 Q120 44 148 52" fill="none" stroke="hsl(0 0% 100% / 0.14)" strokeWidth="2" />
      <g transform="translate(96 138)">
        <LokinGlyph size={48} />
      </g>
    </svg>
  );
}

function Tote({ glyphColor = NEON }) {
  return (
    <svg viewBox="0 0 240 240" className="h-full w-full">
      <path d="M56 86 H184 L176 214 H64 Z" fill={SWATCH} stroke="hsl(80 100% 50% / 0.35)" strokeWidth="2" />
      <path d="M88 86 Q88 52 120 52 Q152 52 152 86" fill="none" stroke="hsl(0 0% 100% / 0.25)" strokeWidth="3" />
      <g transform="translate(95 120)">
        <LokinGlyph size={52} />
      </g>
      <text x="122" y="184" fill={NEON} fontFamily="var(--font-display)" fontWeight="700" fontSize="10" letterSpacing="1.5" textAnchor="middle">LOKIN</text>
    </svg>
  );
}

function CupHolder({ glyphColor = NEON }) {
  return (
    <svg viewBox="0 0 240 240" className="h-full w-full">
      <path d="M40 112 H200 L190 200 H50 Z" fill={SWATCH} stroke="hsl(80 100% 50% / 0.35)" strokeWidth="2" />
      <rect x="40" y="100" width="160" height="22" rx="6" fill="#05080b" stroke="hsl(80 100% 50% / 0.3)" strokeWidth="2" />
      <circle cx="86" cy="84" r="26" fill="#05080b" stroke="hsl(80 100% 50% / 0.3)" strokeWidth="2" />
      <circle cx="154" cy="84" r="26" fill="#05080b" stroke="hsl(80 100% 50% / 0.3)" strokeWidth="2" />
      <circle cx="86" cy="84" r="15" fill="#020303" />
      <circle cx="154" cy="84" r="15" fill="#020303" />
      <g transform="translate(96 146)">
        <LokinGlyph size={48} />
      </g>
      <text x="122" y="194" fill={NEON} fontFamily="var(--font-display)" fontWeight="700" fontSize="8" letterSpacing="1.5" textAnchor="middle">CARRIER</text>
    </svg>
  );
}

function SeatCushion({ glyphColor = NEON }) {
  return (
    <svg viewBox="0 0 240 240" className="h-full w-full">
      <rect x="38" y="120" width="164" height="72" rx="16" fill={SWATCH} stroke="hsl(80 100% 50% / 0.35)" strokeWidth="2" />
      <path d="M50 120 V72 Q50 58 64 58 H176 Q190 58 190 72 V120 Z" fill={SWATCH} stroke="hsl(80 100% 50% / 0.35)" strokeWidth="2" />
      <line x1="120" y1="62" x2="120" y2="118" stroke="hsl(0 0% 100% / 0.12)" strokeWidth="2" />
      <line x1="58" y1="152" x2="182" y2="152" stroke="hsl(0 0% 100% / 0.12)" strokeWidth="2" />
      <g transform="translate(96 72)">
        <LokinGlyph size={46} />
      </g>
      <text x="122" y="180" fill={NEON} fontFamily="var(--font-display)" fontWeight="700" fontSize="8" letterSpacing="1.5" textAnchor="middle">CUSHION</text>
    </svg>
  );
}

function MassageCover({ glyphColor = NEON }) {
  return (
    <svg viewBox="0 0 240 240" className="h-full w-full">
      <path d="M50 124 V74 Q50 58 66 58 H174 Q190 58 190 74 V124 Z" fill={SWATCH} stroke="hsl(80 100% 50% / 0.35)" strokeWidth="2" />
      <rect x="38" y="124" width="164" height="66" rx="16" fill={SWATCH} stroke="hsl(80 100% 50% / 0.35)" strokeWidth="2" />
      <circle cx="86" cy="92" r="7" fill="#05080b" stroke={NEON} strokeWidth="1.5" />
      <circle cx="154" cy="92" r="7" fill="#05080b" stroke={NEON} strokeWidth="1.5" />
      <circle cx="86" cy="156" r="7" fill="#05080b" stroke={NEON} strokeWidth="1.5" />
      <circle cx="154" cy="156" r="7" fill="#05080b" stroke={NEON} strokeWidth="1.5" />
      <g transform="translate(96 70)">
        <LokinGlyph size={40} />
      </g>
      <text x="122" y="182" fill={NEON} fontFamily="var(--font-display)" fontWeight="700" fontSize="8" letterSpacing="1.5" textAnchor="middle">VIBRO</text>
    </svg>
  );
}

function Socks({ glyphColor = NEON }) {
  return (
    <svg viewBox="0 0 240 240" className="h-full w-full">
      <path d="M96 40 H142 V122 Q142 134 152 140 L180 160 Q190 168 190 184 V198 Q190 210 178 210 H104 Q92 210 92 198 V178 Q92 170 84 164 L66 152 Q56 146 56 134 V52 Q56 40 70 40 Z" fill={SWATCH} stroke="hsl(80 100% 50% / 0.35)" strokeWidth="2" />
      <rect x="96" y="50" width="46" height="8" fill={NEON} opacity="0.75" />
      <rect x="96" y="62" width="46" height="5" fill="hsl(0 0% 100% / 0.25)" />
      <g transform="translate(72 92)">
        <LokinGlyph size={34} />
      </g>
      <text x="124" y="194" fill={NEON} fontFamily="var(--font-display)" fontWeight="700" fontSize="8" letterSpacing="1.5" textAnchor="middle">WICK</text>
    </svg>
  );
}

function SelfDefenseKit({ glyphColor = NEON }) {
  return (
    <svg viewBox="0 0 240 240" className="h-full w-full">
      {/* Utility belt — horizontal band */}
      <rect x="24" y="132" width="192" height="26" rx="6" fill={SWATCH} stroke="hsl(80 100% 50% / 0.35)" strokeWidth="2" />
      <rect x="24" y="138" width="192" height="6" fill="hsl(0 0% 0% / 0.45)" />
      <rect x="100" y="128" width="40" height="34" rx="5" fill="#05080b" stroke="hsl(80 100% 50% / 0.45)" strokeWidth="2" />
      <g transform="translate(104 132)"><LokinGlyph size={32} /></g>

      {/* Mace canister — top left */}
      <rect x="48" y="54" width="26" height="78" rx="7" fill={SWATCH} stroke="hsl(80 100% 50% / 0.4)" strokeWidth="2" />
      <rect x="48" y="54" width="26" height="18" rx="7" fill="#05080b" stroke="hsl(80 100% 50% / 0.35)" strokeWidth="2" />
      <rect x="56" y="40" width="10" height="16" rx="3" fill="#05080b" stroke="hsl(80 100% 50% / 0.35)" strokeWidth="2" />
      <rect x="52" y="88" width="18" height="6" rx="2" fill={NEON} opacity="0.75" />
      <text x="61" y="108" fill={NEON} fontFamily="var(--font-display)" fontWeight="700" fontSize="7" letterSpacing="1" textAnchor="middle">MACE</text>

      {/* Taser — top center */}
      <rect x="104" y="48" width="30" height="84" rx="8" fill={SWATCH} stroke="hsl(80 100% 50% / 0.4)" strokeWidth="2" />
      <rect x="104" y="48" width="30" height="22" rx="8" fill="#05080b" stroke="hsl(0 84% 60% / 0.6)" strokeWidth="2" />
      <path d="M112 48 V36 L118 30 M126 48 V36 L120 30" stroke={NEON} strokeWidth="2" fill="none" />
      <circle cx="119" cy="28" r="3" fill={NEON} />
      <circle cx="119" cy="74" r="9" fill="#05080b" stroke={NEON} strokeWidth="1.8" />
      <path d="M115 74 H123 M119 70 V78" stroke={NEON} strokeWidth="1.6" />
      <text x="119" y="116" fill={NEON} fontFamily="var(--font-display)" fontWeight="700" fontSize="7" letterSpacing="1" textAnchor="middle">TASER</text>

      {/* Seatbelt cutter / window breaker — top right */}
      <rect x="164" y="56" width="28" height="76" rx="7" fill={SWATCH} stroke="hsl(80 100% 50% / 0.4)" strokeWidth="2" />
      <rect x="164" y="56" width="28" height="20" rx="7" fill="#05080b" stroke="hsl(80 100% 50% / 0.35)" strokeWidth="2" />
      {/* blade */}
      <path d="M172 56 V44 L178 38 L184 44 V56 Z" fill={NEON} opacity="0.85" stroke="hsl(80 100% 50% / 0.5)" strokeWidth="1.2" />
      {/* window breaker tip */}
      <circle cx="178" cy="124" r="6" fill="#05080b" stroke={NEON} strokeWidth="2" />
      <text x="178" y="108" fill={NEON} fontFamily="var(--font-display)" fontWeight="700" fontSize="6" letterSpacing="0.5" textAnchor="middle">CUT/BREAK</text>

      {/* Panic alarm — bottom dangling */}
      <circle cx="120" cy="200" r="20" fill={SWATCH} stroke="hsl(0 84% 60% / 0.6)" strokeWidth="2" />
      <circle cx="120" cy="200" r="13" fill="#05080b" stroke={NEON} strokeWidth="1.8" />
      <circle cx="120" cy="200" r="4" fill={NEON} />
      {/* sound waves */}
      <path d="M146 188 Q156 200 146 212" fill="none" stroke="hsl(0 84% 60% / 0.7)" strokeWidth="2" />
      <path d="M154 182 Q168 200 154 218" fill="none" stroke="hsl(0 84% 60% / 0.5)" strokeWidth="2" />
      {/* keychain ring */}
      <circle cx="120" cy="158" r="7" fill="none" stroke="hsl(0 0% 100% / 0.35)" strokeWidth="3" />
      <line x1="120" y1="165" x2="120" y2="180" stroke="hsl(0 0% 100% / 0.25)" strokeWidth="2" />
    </svg>
  );
}

const VARIANTS = {
  tee: Tee,
  hoodie: Hoodie,
  cap: Cap,
  sticker: Sticker,
  delivery: DeliveryBag,
  catering: CateringBag,
  pizza: PizzaBag,
  tote: Tote,
  shiesty: Shiesty,
  cupholder: CupHolder,
  seatcushion: SeatCushion,
  massagecover: MassageCover,
  socks: Socks,
  selfdefense: SelfDefenseKit,
};

export default function ApparelMockup({ variant = "tee", className = "" }) {
  const C = VARIANTS[variant] || Tee;
  return (
    <div className={`relative aspect-square w-full ${className}`}>
      <C />
    </div>
  );
}