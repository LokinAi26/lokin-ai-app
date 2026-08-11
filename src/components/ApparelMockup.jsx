import { LokinGlyph } from "@/components/Brand";

const SWATCH = "#0b0f14";
const NEON = "#A8FF00";

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

const VARIANTS = {
  tee: Tee,
  hoodie: Hoodie,
  cap: Cap,
  sticker: Sticker,
  delivery: DeliveryBag,
  catering: CateringBag,
  pizza: PizzaBag,
  tote: Tote,
};

export default function ApparelMockup({ variant = "tee", className = "" }) {
  const C = VARIANTS[variant] || Tee;
  return (
    <div className={`relative aspect-square w-full ${className}`}>
      <C />
    </div>
  );
}