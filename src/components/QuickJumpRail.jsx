import { useLocation, useNavigate } from "react-router-dom";
import { Navigation, Fuel, ShoppingBag } from "lucide-react";

// Compact neon-green quick-jump rail — fixed on the left edge so you can hop
// between Route Planner, Fuel Finder, and the Commerce Hub from anywhere
// without returning to Home. Mobile-first: floats above page content.
const ITEMS = [
  { to: "/route", label: "Route", icon: Navigation, match: (p) => p.startsWith("/route") || p.startsWith("/drive") },
  { to: "/fuel", label: "Fuel", icon: Fuel, match: (p) => p.startsWith("/fuel") },
  { to: "/brand", label: "Hub", icon: ShoppingBag, match: (p) => p.startsWith("/brand") },
];

export default function QuickJumpRail() {
  const loc = useLocation();
  const navigate = useNavigate();

  return (
    <div className="fixed left-2 top-1/2 -translate-y-1/2 z-30 select-none">
      <div className="flex flex-col items-center gap-1 rounded-2xl border border-primary/30 glass px-1.5 py-2 glow-primary">
        {ITEMS.map(({ to, label, icon: Icon, match }) => {
          const active = match(loc.pathname);
          return (
            <button
              key={to}
              onClick={() => navigate(to)}
              aria-label={`${label} jump`}
              className={`group relative flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
                active
                  ? "bg-primary/15 text-primary"
                  : "text-white/45 hover:text-primary hover:bg-primary/5"
              }`}
            >
              <Icon className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
              <span className="pointer-events-none absolute left-[calc(100%+6px)] whitespace-nowrap rounded-md border border-primary/20 bg-black/80 px-2 py-1 text-[10px] font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100">
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}