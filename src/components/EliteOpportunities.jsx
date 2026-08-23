import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Crown, Flame, TrendingUp, Zap, Gift, Check } from "lucide-react";
import { RELEASE_FLAGS } from "@/lib/releaseFlags";

// Curated high-value promotional opportunities locked in for Elite members.
// Modeled after partner-app promos like DashLink boosts, priority blocks, and surge windows.
const OPPORTUNITIES = [
  {
    id: "dashlink_boost",
    name: "DashLink Boost",
    partner: "DoorDash",
    desc: "Exclusive high-payout delivery windows locked in before they hit the public offer pool.",
    value: "+$3–8 / order",
    icon: Flame,
    tag: "Promo",
  },
  {
    id: "veho_priority",
    name: "Veho Priority Blocks",
    partner: "Veho",
    desc: "Reserve first-pick delivery blocks during peak holiday surges before they fill.",
    value: "+25% routes",
    icon: TrendingUp,
    tag: "Blocks",
  },
  {
    id: "flex_surge",
    name: "Amazon Flex Surge Zones",
    partner: "Amazon Flex",
    desc: "AI flags surge zones near you and locks the offer window before it refreshes.",
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
    name: "Spark Early Claim",
    partner: "Walmart Spark",
    desc: "Lock in high-value Spark offers 60 seconds before they go public.",
    value: "+$3–10",
    icon: Flame,
    tag: "Early",
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
        <h2 className="text-base font-bold font-heading metal-text">Elite Locked-In Opportunities</h2>
      </div>
      <p className="text-xs text-white/45 -mt-1">
        High-value promos &amp; offers reserved for Elite members — locked in before they go public.
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
                      <Check className="h-4 w-4" /> Locked In
                    </div>
                  ) : (
                    <button
                      onClick={() => lockIn(opp)}
                      className="mt-3 w-full rounded-2xl bg-primary text-primary-foreground py-2.5 text-sm font-bold glow-primary active:scale-[0.98] transition-transform"
                    >
                      Lock In This Opportunity
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
          <Crown className="h-4 w-4" /> Upgrade to Elite to lock these in
        </button>
      )}
    </div>
  );
}