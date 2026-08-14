import { Truck, ShoppingBag, Car, Package, ClipboardList, Trees, Grid3x3 } from "lucide-react";
import { LokinWordmark } from "@/components/Brand";

const CATEGORIES = [
  { icon: Truck, label: "Delivery" },
  { icon: ShoppingBag, label: "Shop & Deliver" },
  { icon: Car, label: "Rideshare" },
  { icon: Package, label: "Packages" },
  { icon: ClipboardList, label: "Tasks" },
  { icon: Trees, label: "Field Work" },
  { icon: Grid3x3, label: "& More" },
];

export default function ShowcaseHero() {
  return (
    <section className="text-center pt-6 pb-2">
      <LokinWordmark size={42} />
      <div className="mt-3 font-display text-[11px] tracking-[0.32em] text-primary text-glow">LOCK IN. LEVEL UP.</div>
      <h1 className="mt-5 text-2xl sm:text-4xl font-display font-extrabold metal-text leading-tight">
        DRIVE SAFER. WORK SMARTER. LIVE SIMPLER.
      </h1>
      <p className="mt-2 text-sm text-white/50 max-w-md mx-auto">
        The AI operating system for delivery drivers, truckers & road travelers.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {CATEGORIES.map((c) => (
          <div key={c.label} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-white/70">
            <c.icon className="h-3.5 w-3.5 text-primary" /> {c.label}
          </div>
        ))}
      </div>
    </section>
  );
}