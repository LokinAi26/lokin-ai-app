import { useEffect, useState } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { Home, Route as RouteIcon, Mic, BarChart3, Menu } from "lucide-react";
import { LokinGlyph } from "@/components/Brand";
import { base44 } from "@/api/base44Client";

const MORE_PATHS = ["/more", "/avoid", "/settings", "/locator", "/fuel", "/categories"];

const NAV = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/route", label: "Route", icon: RouteIcon, match: (p) => p.startsWith("/route") },
  { to: "/lokin", label: "LOKIN", icon: LokinGlyph, match: (p) => p.startsWith("/lokin"), center: true },
  { to: "/earnings", label: "Earnings", icon: BarChart3, match: (p) => p.startsWith("/earnings") },
  { to: "/more", label: "More", icon: Menu, match: (p) => MORE_PATHS.some((s) => p.startsWith(s)) },
];

export default function DriverLayout() {
  const loc = useLocation();
  const [working, setWorking] = useState(false);

  useEffect(() => {
    base44.entities.DriverPreference.filter({}).then((p) => setWorking((p[0] && p[0].work_status) === "working"));
  }, [loc.pathname]);

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col w-full">
      <header className="sticky top-0 z-30 glass border-b border-border">
        <div className="max-w-md mx-auto px-4 h-12 flex items-center justify-between">
          <NavLink to="/" className="flex items-center gap-1.5">
            <LokinGlyph size={20} />
            <span className="font-display font-extrabold tracking-[0.2em] text-sm">
              LOKIN<span className="text-primary text-glow ml-1">AI</span>
            </span>
          </NavLink>
          {working && (
            <span className="flex items-center gap-1.5 rounded-full bg-primary/15 border border-primary/40 px-2.5 py-1 text-[11px] font-semibold text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> LOCKED IN
            </span>
          )}
        </div>
      </header>

      <main className="flex-1 w-full max-w-md mx-auto px-0 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 inset-x-0 border-t border-border glass z-40 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-md mx-auto grid grid-cols-5">
          {NAV.map(({ to, label, icon: Icon, end, match, center }) => {
            const active = match ? match(loc.pathname) : end ? loc.pathname === to : loc.pathname.startsWith(to);
            if (center) {
              return (
                <NavLink key={to} to={to}
                  className="flex flex-col items-center gap-0.5 pt-1.5 pb-2 text-[11px] font-medium">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-full -mt-5 border-2 ${active ? "border-primary bg-primary/15 glow-primary" : "border-border bg-card"}`}>
                    <Icon size={22} />
                  </div>
                  <span className={active ? "text-primary" : "text-muted-foreground"}>LOKIN</span>
                </NavLink>
              );
            }
            return (
              <NavLink key={to} to={to}
                className={`flex flex-col items-center gap-0.5 pt-2.5 pb-2 text-[11px] font-medium transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}>
                <Icon className="h-5 w-5" />
                {label}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}