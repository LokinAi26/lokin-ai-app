import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Navigation, Fuel, ShoppingBag, Wifi, Search, Briefcase, LifeBuoy, LayoutGrid, X, Leaf, ShieldCheck } from "lucide-react";

// Compact neon-green quick-jump hub — pinned to the top-right so you can hop
// to Route, Fuel, the Commerce Hub, Connectivity, Locator, Gigs and Support
// from anywhere. Collapses to a small rectangle; tap to expand the jump grid.
// Sits just below the global header so it never covers page actions.

const ITEMS = [
  { to: "/route", label: "Route", icon: Navigation, match: (p) => p.startsWith("/route") || p.startsWith("/drive") },
  { to: "/fuel", label: "Fuel", icon: Fuel, match: (p) => p.startsWith("/fuel") },
  { to: "/brand", label: "Hub", icon: ShoppingBag, match: (p) => p.startsWith("/brand") },
  { to: "/connectivity", label: "Signal", icon: Wifi, match: (p) => p.startsWith("/connectivity") },
  { to: "/locator", label: "Locator", icon: Search, match: (p) => p.startsWith("/locator") },
  { to: "/gigs", label: "Gigs", icon: Briefcase, match: (p) => p.startsWith("/gigs") },
  { to: "/support", label: "Support", icon: LifeBuoy, match: (p) => p.startsWith("/support") },
  { to: "/stash", label: "Green", icon: Leaf, match: (p) => p.startsWith("/stash") || p.startsWith("/green-delivery") },
  { to: "/insurance", label: "Cover", icon: ShieldCheck, match: (p) => p.startsWith("/insurance") },
];

export default function QuickJumpRail() {
  const loc = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const activeItem = ITEMS.find((i) => i.match(loc.pathname));
  const ActiveIcon = activeItem?.icon || LayoutGrid;

  // Close on route change
  useEffect(() => { setOpen(false); }, [loc.pathname]);

  function go(to) {
    setOpen(false);
    navigate(to);
  }

  return (
    <div className="fixed right-2 top-[calc(3rem+env(safe-area-inset-top)+6px)] z-40 select-none">
      {/* Collapsed: small rectangle hub button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Quick jump hub"
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/30 glass glow-primary active:scale-95 transition-transform"
      >
        {open ? <X className="h-4 w-4 text-primary" /> : <ActiveIcon className="h-4 w-4 text-primary" />}
        {!open && activeItem && (
          <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary glow-primary" />
        )}
      </button>

      {/* Expanded: jump grid */}
      {open && (
        <div className="mt-2 w-44 rounded-2xl border border-primary/30 glass p-2 glow-primary">
          <div className="grid grid-cols-3 gap-1.5">
            {ITEMS.map(({ to, label, icon: Icon, match }) => {
              const active = match(loc.pathname);
              return (
                <button
                  key={to}
                  onClick={() => go(to)}
                  className={`flex flex-col items-center gap-1 rounded-xl py-2 transition-all active:scale-95 ${
                    active ? "bg-primary/15 text-primary border border-primary/40" : "text-white/60 border border-transparent hover:bg-primary/5"
                  }`}
                >
                  <Icon className="h-4 w-4" style={{ width: 16, height: 16 }} />
                  <span className="text-[9px] font-semibold tracking-wide">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}