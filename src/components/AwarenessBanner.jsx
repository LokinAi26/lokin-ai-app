import { useState } from "react";
import { Link } from "react-router-dom";
import { Heart } from "lucide-react";

// Awareness dedication — LOKIN AI stands with drivers & families affected by
// breast cancer, cystic fibrosis, diabetes, and mental illness.
const CAUSES = [
  {
    name: "Breast Cancer",
    color: "#FF69B4",
    message: "In support of every driver who's fought breast cancer — and the families driving them through it. Early detection saves lives.",
  },
  {
    name: "Cystic Fibrosis",
    color: "#A78BFA",
    message: "Dedicated to those breathing through cystic fibrosis. Every mile driven helps fund the research that adds tomorrows.",
  },
  {
    name: "Diabetes",
    color: "#3B82F6",
    message: "For the drivers managing diabetes on the road — monitoring, fueling, and still showing up. You're not driving alone.",
  },
  {
    name: "Mental Illness",
    color: "#8FE44E",
    message: "You matter. The long haul is heavier in the mind than the mirrors. Reach out, take breaks, and keep going — LOKIN is with you.",
  },
];

function Ribbon({ color }) {
  return (
    <svg width="18" height="24" viewBox="0 0 18 24" fill="none" aria-hidden>
      <path
        d="M9 1 C5 7 3 12 9 22 C15 12 13 7 9 1 Z"
        fill={color}
        opacity="0.9"
        stroke={color}
        strokeWidth="0.5"
      />
      <path d="M9 6 L9 21" stroke="#000" strokeOpacity="0.18" strokeWidth="0.7" />
    </svg>
  );
}

export default function AwarenessBanner() {
  const [active, setActive] = useState(null);

  return (
    <div className="rounded-2xl border border-white/10 lokin-panel p-3.5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] tracking-[0.22em] text-white/40 font-display">LOKIN STANDS WITH</span>
        <div className="flex-1 h-px bg-white/8" />
      </div>
      <div className="grid grid-cols-4 gap-2">
        {CAUSES.map((c) => (
          <button
            key={c.name}
            onClick={() => setActive(c)}
            className="flex flex-col items-center gap-1 rounded-xl border border-white/5 bg-white/[0.02] py-2 active:scale-95 transition-transform"
          >
            <Ribbon color={c.color} />
            <span className="text-[9px] font-medium text-white/65 text-center leading-tight">{c.name}</span>
          </button>
        ))}
      </div>

      {active && (
        <div className="mt-3 rounded-xl border p-3" style={{ borderColor: `${active.color}66`, background: `${active.color}10` }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold" style={{ color: active.color }}>{active.name} Awareness</span>
            <button onClick={() => setActive(null)} className="text-white/40 text-xs">close</button>
          </div>
          <p className="text-xs leading-relaxed text-white/80">{active.message}</p>
        </div>
      )}

      <Link to="/awareness" className="mt-3 flex items-center justify-center gap-1.5 rounded-xl border border-primary/30 bg-primary/[0.06] py-2 text-xs font-semibold text-primary active:scale-[0.98] transition-transform">
        <Heart className="h-3.5 w-3.5" /> View spotlights & pledge
      </Link>
      <div className="mt-2 text-center text-[9px] text-white/30">
        A portion of every LOKIN Elite subscription supports research & support funds.
      </div>
    </div>
  );
}