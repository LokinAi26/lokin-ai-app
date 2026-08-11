import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Home, Route as RouteIcon, BarChart3, Menu, ChevronLeft } from "lucide-react";
import { motion } from "framer-motion";
import { LokinGlyph } from "@/components/Brand";
import { base44 } from "@/api/base44Client";

const NESTED_PATHS = [
  "/categories", "/locator", "/avoid", "/fuel", "/settings", "/more",
  "/drive", "/brand", "/support", "/gigs", "/receipts", "/pricing",
];

const TAB_ROOTS = {
  home: "/",
  route: "/route",
  lokin: "/lokin",
  earnings: "/earnings",
  more: "/more",
};

function pathToTab(path) {
  if (path === "/") return "home";
  if (path.startsWith("/route") || path.startsWith("/drive")) return "route";
  if (path.startsWith("/lokin")) return "lokin";
  if (path.startsWith("/earnings")) return "earnings";
  return "more";
}

const NAV = [
  { key: "home", label: "Home", icon: Home },
  { key: "route", label: "Route", icon: RouteIcon },
  { key: "lokin", label: "LOKIN", icon: LokinGlyph, center: true },
  { key: "earnings", label: "Earnings", icon: BarChart3 },
  { key: "more", label: "More", icon: Menu },
];

export default function DriverLayout() {
  const loc = useLocation();
  const navigate = useNavigate();
  const [working, setWorking] = useState(false);
  const [lastPaths, setLastPaths] = useState(TAB_ROOTS);
  const isNested = NESTED_PATHS.includes(loc.pathname);
  const currentTab = pathToTab(loc.pathname);

  useEffect(() => {
    base44.entities.DriverPreference.filter({}).then((p) => setWorking((p[0] && p[0].work_status) === "working"));
  }, [loc.pathname]);

  // Track the last visited path per tab so switching back restores it
  useEffect(() => {
    if (currentTab && loc.pathname !== lastPaths[currentTab]) {
      setLastPaths((prev) => ({ ...prev, [currentTab]: loc.pathname }));
    }
  }, [loc.pathname, currentTab]);

  function handleTabClick(tabKey) {
    if (tabKey === currentTab) return;
    navigate(lastPaths[tabKey] || TAB_ROOTS[tabKey]);
  }

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col w-full">
      <header className="sticky top-0 z-30 glass border-b border-white/8 pt-[env(safe-area-inset-top)] select-none">
        <div className="max-w-md mx-auto px-4 h-12 flex items-center justify-between">
          {isNested ? (
            <button onClick={() => navigate(-1)} className="flex items-center gap-1 -ml-1 py-1 select-none">
              <ChevronLeft className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium text-white/80">Back</span>
            </button>
          ) : (
            <button onClick={() => handleTabClick("home")} className="flex items-center gap-1.5 select-none">
              <LokinGlyph size={20} />
              <span className="font-display font-extrabold tracking-[0.22em] text-sm">
                <span className="metal-text">L</span>
                <span className="metal-text">OKIN</span>
                <span className="text-primary text-glow ml-1">AI</span>
              </span>
            </button>
          )}
          {working && (
            <span className="flex items-center gap-1.5 rounded-full bg-primary/15 border border-primary/40 px-2.5 py-1 text-[11px] font-bold tracking-wide text-primary select-none">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> LOCKED IN
            </span>
          )}
        </div>
      </header>

      <main className="flex-1 w-full max-w-md mx-auto px-0 pb-[calc(5.75rem+env(safe-area-inset-bottom))]">
        <motion.div
          key={loc.pathname}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          <Outlet />
        </motion.div>
      </main>

      <nav className="fixed bottom-0 inset-x-0 border-t border-white/8 glass z-40 pb-[env(safe-area-inset-bottom)] select-none">
        <div className="max-w-md mx-auto grid grid-cols-5">
          {NAV.map(({ key, label, icon: Icon, center }) => {
            const active = currentTab === key;
            if (center) {
              return (
                <button key={key} onClick={() => handleTabClick(key)}
                  className="flex flex-col items-center gap-0.5 pt-1.5 pb-2 text-[11px] font-medium">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full -mt-5 border-2 transition-all ${active ? "border-primary bg-primary/10 glow-primary" : "border-white/10 bg-card"}`}>
                    <Icon size={24} />
                  </div>
                  <span className={active ? "text-primary" : "text-white/45"}>LOKIN</span>
                </button>
              );
            }
            return (
              <button key={key} onClick={() => handleTabClick(key)}
                className={`flex flex-col items-center gap-0.5 pt-2.5 pb-2 text-[11px] font-medium transition-colors ${active ? "text-primary" : "text-white/45"}`}>
                <Icon className="h-5 w-5" />
                {label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}