import { useState } from "react";
import { Link } from "react-router-dom";
import { Heart, ExternalLink, ShoppingBag, Sparkles, ArrowLeft } from "lucide-react";

const CAUSES = [
  {
    name: "Breast Cancer",
    color: "#FF69B4",
    tagline: "Early detection saves lives.",
    blurb: "In support of every driver who's fought breast cancer — and the families driving them through it. One in eight women will be diagnosed in her lifetime; screening catches it early.",
    org: { name: "National Breast Cancer Foundation", url: "https://www.nationalbreastcancer.org" },
    tee: "Pink Ribbon Tee",
  },
  {
    name: "Cystic Fibrosis",
    color: "#A78BFA",
    tagline: "Adding tomorrows, one mile at a time.",
    blurb: "Dedicated to those breathing through cystic fibrosis. Every mile driven helps fund the research that's turned a once-fatal diagnosis into a manageable life.",
    org: { name: "Cystic Fibrosis Foundation", url: "https://www.cff.org" },
    tee: "Breathe Hoodie",
  },
  {
    name: "Diabetes",
    color: "#3B82F6",
    tagline: "You're not driving alone.",
    blurb: "For the drivers managing diabetes on the road — monitoring glucose, fueling right, and still showing up every shift. Awareness keeps blood sugar in check and rigs safe.",
    org: { name: "American Diabetes Association", url: "https://www.diabetes.org" },
    tee: "Blue Circle Cap",
  },
  {
    name: "Mental Illness",
    color: "#8FE44E",
    tagline: "The long haul is heavier in the mind.",
    blurb: "You matter. The isolation of the road is real. Reach out, take breaks, and keep going — LOKIN is with you. You're never driving alone.",
    org: { name: "NAMI", url: "https://www.nami.org" },
    tee: "Mind Over Miles Tee",
  },
];

function Ribbon({ color }) {
  return (
    <svg width="20" height="26" viewBox="0 0 18 24" fill="none" aria-hidden>
      <path d="M9 1 C5 7 3 12 9 22 C15 12 13 7 9 1 Z" fill={color} opacity="0.9" stroke={color} strokeWidth="0.5" />
      <path d="M9 6 L9 21" stroke="#000" strokeOpacity="0.18" strokeWidth="0.7" />
    </svg>
  );
}

export default function Awareness() {
  const [pledge, setPledge] = useState(() => localStorage.getItem("lokin_roundup") === "1");
  const [cause, setCause] = useState(() => localStorage.getItem("lokin_roundup_cause") || "Mental Illness");

  function togglePledge() {
    const next = !pledge;
    setPledge(next);
    localStorage.setItem("lokin_roundup", next ? "1" : "0");
  }

  function chooseCause(c) {
    setCause(c);
    localStorage.setItem("lokin_roundup_cause", c);
  }

  return (
    <div className="p-4 space-y-5 pb-8">
      <div>
        <div className="text-[11px] tracking-[0.24em] text-primary/70 font-display">LOKIN STANDS WITH</div>
        <h1 className="text-2xl font-bold font-heading metal-text">Awareness Spotlights</h1>
        <p className="text-sm text-white/50 mt-1">Every mile can move research forward. Round up, learn, or rep the cause.</p>
      </div>

      {/* Round-up pledge */}
      <div className="rounded-3xl border border-primary/30 bg-primary/[0.06] p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 font-bold text-primary">
              <Sparkles className="h-4 w-4" /> Round Up My Rides
            </div>
            <p className="text-xs text-white/60 mt-1 leading-relaxed">
              Pledge to round up your weekly earnings to the nearest dollar. LOKIN tallies your spare change and sends it where you choose.
            </p>
          </div>
          <button
            onClick={togglePledge}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold border transition-colors ${pledge ? "border-primary bg-primary text-primary-foreground glow-primary" : "border-white/20 text-white/60"}`}
          >
            {pledge ? "PLEDGED" : "OPT IN"}
          </button>
        </div>
        {pledge && (
          <div className="mt-4">
            <div className="text-[10px] tracking-widest text-white/40 mb-2">SEND MY SPARE CHANGE TO</div>
            <div className="flex flex-wrap gap-2">
              {CAUSES.map((c) => (
                <button
                  key={c.name}
                  onClick={() => chooseCause(c.name)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${cause === c.name ? "text-black" : "border-white/15 text-white/55"}`}
                  style={cause === c.name ? { background: c.color, borderColor: c.color } : {}}
                >
                  {c.name}
                </button>
              ))}
            </div>
            <div className="mt-3 text-xs text-primary/80">
              You're rounding up this week for <span className="font-bold">{cause}</span>. Your contribution will show in Earnings.
            </div>
          </div>
        )}
      </div>

      {/* Cause spotlights */}
      <div className="space-y-3">
        {CAUSES.map((c) => (
          <div key={c.name} className="rounded-3xl border border-white/10 lokin-panel p-4" style={{ boxShadow: `inset 0 0 0 1px ${c.color}22` }}>
            <div className="flex items-center gap-3">
              <Ribbon color={c.color} />
              <div>
                <div className="font-bold" style={{ color: c.color }}>{c.name}</div>
                <div className="text-xs text-white/50">{c.tagline}</div>
              </div>
            </div>
            <p className="text-sm text-white/75 mt-3 leading-relaxed">{c.blurb}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={c.org.url} target="_blank" rel="noopener noreferrer"
                className="rounded-full border px-3 py-1.5 text-xs font-semibold flex items-center gap-1 active:scale-95 transition-transform"
                style={{ borderColor: `${c.color}66`, color: c.color }}>
                Donate to {c.org.name} <ExternalLink className="h-3 w-3" />
              </a>
              <Link to="/brand"
                className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/70 flex items-center gap-1 active:scale-95 transition-transform">
                <ShoppingBag className="h-3 w-3" /> {c.tee}
              </Link>
              {pledge && (
                <button onClick={() => chooseCause(c.name)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold flex items-center gap-1 ${cause === c.name ? "text-black" : "border border-white/15 text-white/55"}`}
                  style={cause === c.name ? { background: c.color } : {}}>
                  <Heart className="h-3 w-3" /> {cause === c.name ? "My cause" : "Make my cause"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Link to="/" className="flex items-center gap-1.5 text-xs text-white/50 pt-2 active:scale-95 transition-transform">
        <ArrowLeft className="h-3.5 w-3.5" /> Back home
      </Link>
    </div>
  );
}