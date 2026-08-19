import { useEffect, useState } from "react";
import { Check, Sparkles, Crown, Zap, ShieldCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { LokinGlyph } from "@/components/Brand";
import { useToast } from "@/components/ui/use-toast";

const TIERS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "",
    icon: Zap,
    accent: false,
    cta: "Current plan",
    features: [
      "Basic route optimizer",
      "Daily earnings tracking",
      "Work filters & categories",
      "Gas discount codes",
      "Lock In Score (basic)",
    ],
  },
  {
    id: "pro_monthly",
    name: "Pro",
    tier: "pro",
    price: "$9.99",
    period: "/mo",
    icon: Sparkles,
    accent: true,
    badge: "MOST POPULAR",
    cta: "Upgrade to Pro",
    features: [
      "Advanced multi-stop routing",
      "Deeper AI analytics & briefings",
      "Full Lock In Score breakdown",
      "Weekly performance insights",
      "Priority offer sequencing",
      "Avoid-list aware routing",
    ],
  },
  {
    id: "elite_monthly",
    name: "Elite",
    tier: "elite",
    price: "$19.99",
    period: "/mo",
    icon: Crown,
    accent: false,
    cta: "Go Elite",
    features: [
      "Everything in Pro",
      "Locked-in elite opportunities",
      "DashLink boosts & priority blocks",
      "Priority AI assistant",
      "Elite routing (max $/hr)",
      "Fuel & mileage optimization AI",
    ],
    annualId: "elite_annual",
    annualPrice: "$149.99/yr",
  },
];

export default function Pricing() {
  const { toast } = useToast();
  const [plan, setPlan] = useState("free");
  const [loading, setLoading] = useState(null);

  useEffect(() => {
    base44.auth.me().then((u) => setPlan(u?.plan || "free")).catch(() => {});
  }, []);

  async function subscribe(productId) {
    setLoading(productId);
    try {
      const res = await base44.functions.invoke("create-checkout", { productId });
      const redirectUrl = res.data?.redirectUrl;
      if (redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        toast({ title: "Checkout unavailable", description: "Please try again later.", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Checkout failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="p-4 space-y-5 pb-8">
      <div className="text-center pt-2">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-black glow-primary mb-3">
          <LokinGlyph size={36} />
        </div>
        <h1 className="text-2xl font-bold font-heading metal-text">Unlock LOKIN</h1>
        <p className="text-sm text-white/50 mt-1">Advanced routing. Deeper AI. More money per hour.</p>
      </div>

      <div className="space-y-3">
        {TIERS.map((t) => {
          const active = plan === t.tier || (t.id !== "free" && plan !== "free" && t.id.startsWith(plan));
          const isPaidActive = t.id !== "free" && (plan === t.tier || (t.id === "elite_monthly" && plan === "elite"));
          return (
            <div
              key={t.id}
              className={`rounded-3xl border p-5 relative overflow-hidden ${
                t.accent ? "border-primary/50 glow-primary lokin-panel" : "border-white/10 lokin-panel"
              }`}
            >
              {t.badge && (
                <div className="absolute top-3 right-3 rounded-full bg-primary text-primary-foreground text-[9px] font-bold tracking-wider px-2 py-1">
                  {t.badge}
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${t.accent ? "border-primary/40 bg-primary/10" : "border-white/10 bg-white/5"}`}>
                  <t.icon className={`h-5 w-5 ${t.accent ? "text-primary" : "text-white/70"}`} />
                </div>
                <div>
                  <div className="text-lg font-bold font-heading text-white">{t.name}</div>
                  <div className="flex items-baseline gap-0.5">
                    <span className={`text-2xl font-display font-bold ${t.accent ? "text-primary text-glow" : "text-white"}`}>{t.price}</span>
                    <span className="text-xs text-white/45">{t.period}</span>
                  </div>
                </div>
              </div>

              {t.annualPrice && (
                <div className="mt-2 text-[11px] text-accent/80 flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" /> or {t.annualPrice} with 14-day free trial
                </div>
              )}

              <ul className="mt-4 space-y-2">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-white/75">
                    <Check className={`h-4 w-4 mt-0.5 shrink-0 ${t.accent ? "text-primary" : "text-white/50"}`} />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => t.id !== "free" && subscribe(t.id)}
                disabled={loading !== null || t.id === "free" || isPaidActive}
                className={`mt-5 w-full rounded-2xl py-3 text-sm font-bold transition-transform active:scale-[0.98] ${
                  isPaidActive
                    ? "border border-primary/40 bg-primary/10 text-primary"
                    : t.accent
                    ? "bg-primary text-primary-foreground glow-primary"
                    : t.id === "free"
                    ? "border border-white/10 bg-white/5 text-white/50"
                    : "border border-primary/40 bg-primary/10 text-primary"
                }`}
              >
                {loading === t.id ? "Redirecting…" : isPaidActive ? "Your current plan" : t.cta}
              </button>

              {t.annualId && !isPaidActive && (
                <button
                  onClick={() => subscribe(t.annualId)}
                  disabled={loading !== null}
                  className="mt-2 w-full rounded-2xl border border-accent/30 bg-accent/5 py-2.5 text-xs font-semibold text-accent active:scale-[0.98] transition-transform"
                >
                  {loading === t.annualId ? "Redirecting…" : `Save with Annual — ${t.annualPrice}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-1.5 flex-wrap pt-2">
        {["Apple Pay", "Google Pay", "Visa", "Mastercard", "Amex"].map((m) => (
          <span
            key={m}
            className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold text-white/55"
          >
            {m}
          </span>
        ))}
      </div>
      <div className="text-center text-[10px] tracking-[0.2em] text-white/30">
        TAP TO PAY · SECURE CHECKOUT · CANCEL ANYTIME
      </div>
    </div>
  );
}