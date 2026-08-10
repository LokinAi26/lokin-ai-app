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
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <main className="flex-1 pb-20 max-w-md mx-auto w-full">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 inset-x-0 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 z-40">
        <div className="max-w-md mx-auto grid grid-cols-5">
          {NAV.map(({ to, label, icon: Icon, end }) => {
            const active = end ? loc.pathname === to : loc.pathname.startsWith(to);
            return (
              <NavLink
                key={to}
                to={to}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
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