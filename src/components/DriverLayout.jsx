import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Route as RouteIcon, BarChart3, Menu, ChevronLeft, Truck, Navigation } from "lucide-react";
import { motion } from "framer-motion";
import { LokinGlyph } from "@/components/Brand";
import { base44 } from "@/api/base44Client";

import CommandEngine from "@/components/CommandEngine";
import GlobalVoiceAssistant from "@/components/GlobalVoiceAssistant";

const NESTED_PATHS = [
  "/categories", "/locator", "/avoid", "/fuel", "/settings", "/earnings-intelligence", "/driver-platforms", "/driver-platforms/uber/callback",
  "/drive", "/brand", "/oasis", "/support", "/gigs", "/receipts", "/pricing", "/on-the-road", "/shop-deliver", "/driver-dispatch", "/vision-bridge",
  "/stash", "/stash/cart", "/green-delivery", "/insurance",
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
  if (path.startsWith("/route") || path.startsWith("/drive") || path.startsWith("/ai-gps")) return "route";
  if (path.startsWith("/lokin")) return "lokin";
  if (path.startsWith("/earnings")) return "earnings";
  return "more";
}

const NAV = [
  { key: "home", label: "Delivery", icon: Truck },
  { key: "route", label: "Route", icon: RouteIcon },
  { key: "lokin", label: "LOKIN", icon: LokinGlyph, center: true },
  { key: "earnings", label: "Earnings", icon: BarChart3 },
  { key: "more", label: "More", icon: Menu },
];

export default function DriverLayout() {
  const loc = useLocation();
  const navigate = useNavigate();
  const [working, setWorking] = useState(false);
  const [appFreeRoam, setAppFreeRoam] = useState(() => typeof window !== "undefined" && sessionStorage.getItem("lokin_app_free_roam") === "1");
  const [lastPaths, setLastPaths] = useState(TAB_ROOTS);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const isNested = NESTED_PATHS.includes(loc.pathname);
  const isShopFlow = loc.pathname === "/locator" || loc.pathname === "/shop-deliver";
  const currentTab = pathToTab(loc.pathname);
  const gpsParams = new URLSearchParams(loc.search);
  const lockedGps = loc.pathname === "/ai-gps" && gpsParams.get("focus") === "locked";
  const activeNavigation = lockedGps && gpsParams.get("nav") === "1";

  useEffect(() => {
    let alive = true;
    base44.entities.DriverPreference.filter({}).then((p) => {
      if (!alive) return;
      const workStatus = p[0]?.work_status || "off";
      const isWorking = workStatus === "working";
      setWorking(isWorking);
      const roamActive = sessionStorage.getItem("lokin_app_free_roam") === "1";
      setAppFreeRoam(roamActive);
      // DriverPreference.work_status is authoritative during session restore.
      // Resolve paused before any navigation-engine or route optimization work.
      if (workStatus === "paused" && loc.pathname === "/") {
        navigate("/break-time", { replace: true });
      } else if (isWorking && !roamActive && loc.pathname === "/") {
        // GPS is the primary Home surface while working, except when the driver
        // deliberately opened app Free Roam to use the rest of LOKIN.
        navigate("/ai-gps?focus=locked&nav=1&view=real", { replace: true });
      }
    }).catch(() => {});
    return () => { alive = false; };
  }, [loc.pathname, navigate]);

  // Entering active navigation is itself a lock-in action. Persist that state so
  // returning to Home during the shift restores the GPS instead of the dashboard.
  useEffect(() => {
    if (!activeNavigation) return;
    sessionStorage.removeItem("lokin_app_free_roam");
    setAppFreeRoam(false);
    let alive = true;
    base44.entities.DriverPreference.filter({}).then(async (p) => {
      if (!alive) return;
      if (p[0]?.id) await base44.entities.DriverPreference.update(p[0].id, { work_status: "working" });
      else await base44.entities.DriverPreference.create({ work_status: "working" });
      if (alive) setWorking(true);
    }).catch(() => {});
    return () => { alive = false; };
  }, [activeNavigation]);

  // Track the last visited path per tab so switching back restores it
  useEffect(() => {
    if (currentTab && loc.pathname !== lastPaths[currentTab]) {
      setLastPaths((prev) => ({ ...prev, [currentTab]: loc.pathname }));
    }
  }, [loc.pathname, currentTab]);

  function resumeGps() {
    const resumeUrl = sessionStorage.getItem("lokin_gps_resume_url") || "/ai-gps?focus=locked&nav=1&view=real";
    sessionStorage.removeItem("lokin_app_free_roam");
    setAppFreeRoam(false);
    navigate(resumeUrl);
  }

  function handleTabClick(tabKey) {
    if (tabKey === currentTab) {
      // Tapping the active tab pops to its root (iOS convention)
      navigate(TAB_ROOTS[tabKey]);
      return;
    }
    navigate(lastPaths[tabKey] || TAB_ROOTS[tabKey]);
  }

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col w-full">
      {!lockedGps && <header className="sticky top-0 z-30 glass border-b border-white/8 pt-[env(safe-area-inset-top)] select-none">
        <div className="max-w-md mx-auto px-4 h-12 flex items-center justify-between">
          {isNested ? (
            <button onClick={() => navigate(isShopFlow && loc.pathname === "/locator" ? "/shop-deliver" : TAB_ROOTS[currentTab])} aria-label="Go back" className="flex items-center gap-1 -ml-1 py-1 select-none">
              <ChevronLeft className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium text-white/80">Back</span>
            </button>
          ) : (
            <button onClick={() => setCmdOpen(true)} aria-label="LOKIN command engine" className="flex items-center gap-1.5 select-none">
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
      </header>}

      <main className={lockedGps
        ? "flex-1 mx-0 w-screen max-w-none min-w-0 overflow-hidden p-0"
        : "flex-1 w-full max-w-md mx-auto px-0 pb-[calc(5.75rem+env(safe-area-inset-bottom))]"
      }>
        <motion.div
          key={loc.pathname}
          className={lockedGps ? "h-[100dvh] w-screen max-w-full min-w-0 overflow-hidden" : ""}
          initial={lockedGps ? false : { opacity: 0, x: 16 }}
          animate={lockedGps ? { opacity: 1 } : { opacity: 1, x: 0 }}
          transition={lockedGps ? { duration: 0 } : { duration: 0.22, ease: "easeOut" }}
        >
          <Outlet />
        </motion.div>
      </main>

      {!lockedGps && <nav aria-label="Main navigation" className="fixed bottom-0 inset-x-0 border-t border-white/8 glass z-40 pb-[env(safe-area-inset-bottom)] select-none">
        <div className="max-w-md mx-auto grid grid-cols-5">
          {NAV.map(({ key, label, icon: Icon, center }) => {
            const active = currentTab === key;
            if (center) {
              return (
                <button key={key} onClick={() => setVoiceOpen(true)} aria-label="LOKIN command station"
                  className="flex flex-col items-center gap-0.5 pt-1.5 pb-2 text-[11px] font-medium">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full -mt-5 border-2 transition-all ${active ? "border-primary bg-primary/10" : "border-primary/40 bg-card"} glow-primary`}>
                    <Icon size={24} />
                  </div>
                  <span className={active ? "text-primary" : "text-white/45"}>LOKIN</span>
                </button>
              );
            }
            return (
              <button key={key} onClick={() => handleTabClick(key)} aria-label={label}
                className={`flex flex-col items-center gap-0.5 pt-2.5 pb-2 text-[11px] font-medium transition-colors ${active ? "text-primary" : "text-white/45"}`}>
                <Icon className="h-5 w-5" />
                {label}
              </button>
            );
          })}
        </div>
      </nav>}

      {!lockedGps && working && appFreeRoam && (
        <button
          type="button"
          onClick={resumeGps}
          className="fixed right-3 z-50 inline-flex items-center gap-1.5 rounded-full border border-primary/35 bg-black/85 px-3 py-2 text-[9px] font-extrabold tracking-[0.08em] text-primary shadow-lg backdrop-blur active:scale-95"
          style={{ bottom: "calc(5.6rem + env(safe-area-inset-bottom))" }}
          aria-label="Resume locked GPS navigation"
        >
          <Navigation className="h-3.5 w-3.5" /> RESUME GPS
        </button>
      )}

      {!lockedGps && <CommandEngine open={cmdOpen} onClose={() => setCmdOpen(false)} />}
      <GlobalVoiceAssistant open={voiceOpen} onOpenChange={setVoiceOpen} drivingMode={activeNavigation || (working && appFreeRoam)} />
    </div>
  );
}