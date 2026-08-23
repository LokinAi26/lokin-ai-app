import { Radar, Sparkles, TrendingUp, Filter, Fuel, LineChart, Apple, Play } from "lucide-react";
import { LokinWordmark } from "@/components/Brand";

const FUTURISTIC = [
  { icon: Radar, title: "Hotspot Model Preview", desc: "Explore simulated earning-zone scenarios before live data integrations are enabled." },
  { icon: Sparkles, title: "Smart Route Builder", desc: "Optimize every stop for max profit." },
  { icon: TrendingUp, title: "Earnings Predictor", desc: "See pace and projected hourly rate." },
  { icon: Filter, title: "Auto Decline Filter", desc: "Low-pay warnings so you never waste a mile." },
  { icon: Fuel, title: "Fuel Tracker", desc: "Discounts, cashback & true cost per mile." },
  { icon: LineChart, title: "Performance Insights", desc: "Learn what pays. Earn more over time." },
];

const PILLARS = [
  { k: "Time", v: "Use every minute wisely." },
  { k: "Route", v: "Take the best routes." },
  { k: "Money", v: "Maximize every opportunity." },
  { k: "Goals", v: "Stay on track. Hit your goals." },
  { k: "Focus", v: "Eliminate distractions. Stay locked in." },
];

const NAV = ["Home", "Route", "Earnings", "Tasks", "Analytics", "Wallet", "Settings"];

export default function ShowcaseFooter() {
  return (
    <section className="space-y-8">
      <div>
        <div className="text-[11px] tracking-[0.22em] text-primary/70 font-display mb-3 text-center">FUTURISTIC FUNCTIONALITY</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {FUTURISTIC.map((f) => (
            <div key={f.title} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <f.icon className="h-5 w-5 text-primary mb-2" />
              <div className="text-sm font-semibold text-white">{f.title}</div>
              <div className="text-[11px] text-white/45 mt-0.5">{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {PILLARS.map((p) => (
          <div key={p.k} className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-3 text-center">
            <div className="text-xs font-display font-bold text-primary tracking-wide">{p.k.toUpperCase()}</div>
            <div className="text-[11px] text-white/55 mt-1">{p.v}</div>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-white/10 lokin-panel p-6 text-center">
        <LokinWordmark size={30} />
        <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-white/45">
          {NAV.map((n) => <span key={n}>{n}</span>)}
        </div>
        <div className="mt-4 flex justify-center gap-3">
          <div className="flex items-center gap-2 rounded-xl bg-black border border-white/20 px-3 py-2">
            <Apple className="h-4 w-4 text-white" />
            <div className="text-left"><div className="text-[8px] text-white/50 leading-none">Download on the</div><div className="text-xs font-semibold text-white leading-tight">App Store</div></div>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-black border border-white/20 px-3 py-2">
            <Play className="h-4 w-4 text-primary" />
            <div className="text-left"><div className="text-[8px] text-white/50 leading-none">Get it on</div><div className="text-xs font-semibold text-white leading-tight">Google Play</div></div>
          </div>
        </div>
        <div className="mt-5 font-display text-sm tracking-[0.28em] text-primary text-glow">LOCK IN. LEVEL UP.</div>
        <div className="mt-1 text-[10px] tracking-[0.2em] text-white/30">DRIVE SAFER. WORK SMARTER. LIVE SIMPLER.</div>
      </div>
    </section>
  );
}