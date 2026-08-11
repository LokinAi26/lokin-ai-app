import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { LokinGlyph } from "@/components/Brand";

export default function ThankYou() {
  const [plan, setPlan] = useState(null);

  useEffect(() => {
    let tries = 0;
    const t = setInterval(async () => {
      tries++;
      try {
        const u = await base44.auth.me();
        if (u?.plan && u.plan !== "free") {
          setPlan(u.plan);
          clearInterval(t);
          return;
        }
      } catch (_) {}
      if (tries > 12) clearInterval(t); // ~60s
    }, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full border border-primary/30 bg-black glow-primary mb-5">
        {plan ? <Check className="h-9 w-9 text-primary" /> : <Loader2 className="h-9 w-9 text-primary animate-spin" />}
      </div>
      <LokinGlyph size={32} className="mb-3" />
      <h1 className="text-2xl font-bold font-heading metal-text">
        {plan ? "You're locked in." : "Confirming your payment…"}
      </h1>
      <p className="text-sm text-white/50 mt-2 max-w-xs">
        {plan
          ? "Your premium features are unlocked. Go maximize your earnings."
          : "Hang tight — we're activating your subscription. This closes automatically."}
      </p>
      <Link
        to="/"
        className="mt-6 rounded-2xl bg-primary text-primary-foreground px-6 py-3 text-sm font-bold glow-primary active:scale-95 transition-transform"
      >
        {plan ? "Go to Command Center" : "Back to app"}
      </Link>
    </div>
  );
}