import { GitBranch, BarChart3, SlidersHorizontal, Ban, ScanLine, MessageSquare, Car, Target, PieChart, Network } from "lucide-react";

const FEATURES = [
  { icon: GitBranch, title: "AI Route Optimizer", desc: "Fastest • Most Profit • Goal Mode" },
  { icon: BarChart3, title: "Earnings Tracker", desc: "Gross • Net • $/hr • Fuel" },
  { icon: SlidersHorizontal, title: "Work Filters", desc: "You choose WHAT you want" },
  { icon: Ban, title: "Customer/Store Blocklist", desc: "Avoid what slows you down" },
  { icon: ScanLine, title: "Shopping AI", desc: "Barcode scan • Item locator" },
  { icon: MessageSquare, title: "Voice + Auto Messages", desc: "Hands-free customer updates" },
  { icon: Car, title: "Driving Mode", desc: "Minimal • Safe • Focused" },
  { icon: Target, title: "Daily Goals", desc: "Stay motivated • Track progress" },
  { icon: PieChart, title: "Analytics", desc: "Learn • Improve • Earn More" },
  { icon: Network, title: "Multi-Gig Support", desc: "All platforms. All in one place." },
];

export default function FeaturesSidebar() {
  return (
    <div>
      <div className="text-[11px] tracking-[0.22em] text-primary/70 font-display mb-3">POWERFUL AI FEATURES</div>
      <div className="space-y-2">
        {FEATURES.map((f) => (
          <div key={f.title} className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.02] p-3 active:scale-[0.99] transition-transform">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 shrink-0">
              <f.icon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">{f.title}</div>
              <div className="text-[11px] text-white/45">{f.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}