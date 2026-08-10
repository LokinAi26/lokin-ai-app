import { Outlet, NavLink, useLocation } from "react-router-dom";
import { Home, Route, SlidersHorizontal, ScanLine, Fuel } from "lucide-react";

const NAV = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/route", label: "Route", icon: Route },
  { to: "/categories", label: "Filters", icon: SlidersHorizontal },
  { to: "/locator", label: "Locator", icon: ScanLine },
  { to: "/fuel", label: "Fuel", icon: Fuel },
];

export default function Layout() {
  const loc = useLocation();
  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col w-full">
      <main className="flex-1 w-full max-w-md mx-auto px-0 pb-[calc(5rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 inset-x-0 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 z-40 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-md mx-auto grid grid-cols-5">
          {NAV.map(({ to, label, icon: Icon, end }) => {
            const active = end ? loc.pathname === to : loc.pathname.startsWith(to);
            return (
              <NavLink
                key={to}
                to={to}
                className={`flex flex-col items-center gap-0.5 pt-2.5 pb-2 text-[11px] font-medium transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
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