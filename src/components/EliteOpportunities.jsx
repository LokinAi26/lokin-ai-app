import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Crown, Flame, TrendingUp, Zap, Gift, Check } from "lucide-react";
import { RELEASE_FLAGS } from "@/lib/releaseFlags";

// Curated opportunity intelligence for Elite members.
// LOKIN analyzes only user-visible or authorized partner-supplied data; it does not reserve or pre-claim third-party offers.
const OPPORTUNITIES = [
  {
    id: "dashlink_boost",
    name: "DashLink Boost",
    partner: "DoorDash",
    desc: "Analyze high-value DashLink-style promotions when they are visible to the driver or supplied through an authorized feed.",
    value: "+$3–8 / order",
    icon: Flame,
    tag: "Promo",
  },
  {
    id: "veho_priority",
    name: "Veho Priority Blocks",
    partner: "Veho",
    desc: "Rank visible delivery blocks by expected net earnings and route fit during high-demand windows.",
    value: "+25% routes",
    icon: TrendingUp,
    tag: "Blocks",
  },
  {
    id: "flex_surge",
    name: "Amazon Flex Surge Zones",
    partner: "Amazon Flex",
    desc: "Score user-visible surge blocks against distance, time, expenses, and the next-best route decision.",
    value: "+$2–6 / block",
    icon: Zap,
    tag: "Surge",
  },
  {
    id: "instacart_bonus",
    name: "Instacart Batch Bonuses",
    partner: "Instacart",
    desc: "Stack big-batch bonuses with the route optimizer for max $/hr.",
    value: "+$4–12",
    icon: Gift,
    tag: "Bonus",
  },
  {
    id: "spark_early",
    name: "Spark Offer Analysis",
    partner: "Walmart Spark",
    desc: "Score current Spark offers the driver can see or that arrive through a future approved official adapter.",
    value: "Value score",
    icon: Flame,
    tag: "Analysis",
  },
  {
    id: "fuel_boost",
    name: "Fuel Cashback Boost",
    partner: "LOKIN",
    desc: "Double cashback at partner stations plus AI fill-up timing.",
    value: "2x cashback",
    icon: TrendingUp,
    tag: "Fuel",
  },
];

export default function EliteOpportunities({ plan }) {
  const navigate = useNavigate();
  const [locked, setLocked] = useState({});
  if (!RELEASE_FLAGS.partnerPromotions) return null;
  const isElite = plan === "elite";

  function lockIn(opp) {
    setLocked((prev) => ({ ...prev, [opp.id]: true }));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Crown className="h-5 w-5 text-primary" />
        <h2 className="text-base font-bold font-heading metal-text">Elite Opportunity Intelligence</h2>
      </div>
      <p className="text-xs text-white/45 -mt-1">
        High-value opportunities prioritized from authorized or user-provided data. LOKIN never reserves or pre-claims third-party offers.
      </p>

      <div className="space-y-3">
        {OPPORTUNITIES.map((opp) => {
          const Icon = opp.icon;
          const isLockedIn = locked[opp.id];
          return (
            <div
              key={opp.id}
              className={`relative rounded-3xl border overflow-hidden ${
                isElite ? "border-primary/30 lokin-panel" : "border-white/10 lokin-panel"
              }`}
            >
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-sm text-white truncate">{opp.name}</div>
                      <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                        {opp.value}
                      </span>
                    </div>
                    <div className="text-xs text-white/45 mt-0.5">
                      {opp.partner} · <span className="text-accent/80">{opp.tag}</span>
                    </div>
                    <p className="text-xs text-white/60 mt-1.5">{opp.desc}</p>
                  </div>
                </div>

                {isElite ? (
                  isLockedIn ? (
                    <div className="mt-3 flex items-center justify-center gap-1.5 rounded-2xl border border-primary/40 bg-primary/15 py-2.5 text-sm font-bold text-primary">
                      <Check className="h-4 w-4" /> Tracked
                    </div>
                  ) : (
                    <button
                      onClick={() => lockIn(opp)}
                      className="mt-3 w-full rounded-2xl bg-primary text-primary-foreground py-2.5 text-sm font-bold glow-primary active:scale-[0.98] transition-transform"
                    >
                      Track This Opportunity
                    </button>
                  )
                ) : (
                  <button
                    onClick={() => navigate("/pricing")}
                    className="mt-3 w-full rounded-2xl border border-white/15 bg-white/[0.04] py-2.5 text-sm font-semibold text-white/70 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                  >
                    <Lock className="h-3.5 w-3.5" /> Unlock with Elite
                  </button>
                )}
              </div>

              {!isElite && (
                <div className="pointer-events-none absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
              )}
            </div>
          );
        })}
      </div>

      {!isElite && (
        <button
          onClick={() => navigate("/pricing")}
          className="w-full rounded-2xl border border-primary/40 bg-primary/10 py-3 text-sm font-bold text-primary flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          <Crown className="h-4 w-4" /> Upgrade to Elite opportunity intelligence
        </button>
      )}
    </div>
  );
}