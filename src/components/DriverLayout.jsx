import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, Navigation } from "lucide-react";
import { motion } from "framer-motion";
import { LOKIN_NAV_CIRCLE, LOKIN_LOGO } from "@/components/Brand";
import { LkNavDelivery, LkNavRoute, LkNavEarnings, LkNavMore, LkIconVoice } from "@/components/brand/LkIcons";
import { base44 } from "@/api/base44Client";
import { normalizeWorkStatus, resolveSessionRestoreRedirect, sessionStatusLabel } from "@/lib/sessionState";

import CommandEngine from "@/components/CommandEngine";
import GlobalVoiceAssistant from "@/components/GlobalVoiceAssistant";

const NESTED_PATHS = [
  "/categories", "/locator", "/avoid", "/fuel", "/settings", "/earnings-intelligence", "/driver-platforms", "/driver-platforms/uber/callback",
  "/drive", "/brand", "/oasis", "/support", "/gigs", "/receipts", "/pricing", "/on-the-road", "/shop-deliver", "/driver-dispatch", "/vision-bridge",
  "/stash", "/stash/cart", "/green-delivery", "/insurance", "/onboarding",
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
  { key: "home", label: "Delivery", icon: LkNavDelivery },
  { key: "route", label: "Route", icon: LkNavRoute },
  { key: "lokin", label: "LOKIN", icon: LkIconVoice, center: true },
  { key: "earnings", label: "Earnings", icon: LkNavEarnings },
  { key: "more", label: "More", icon: LkNavMore },
];

export default function DriverLayout() {
  const loc = useLocation();
  const navigate = useNavigate();
  const [workStatus, setWorkStatus] = useState("off");
  const working = workStatus === "working";
  const [appFreeRoam, setAppFreeRoam] = useState(() => typeof window !== "undefined" && sessionStorage.getItem("lokin_app_free_roam") === "1");
  const [lastPaths, setLastPaths] = useState(TAB_ROOTS);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const isNested = NESTED_PATHS.includes(loc.pathname);
  const isShopFlow = loc.pathname === "/locator" || loc.pathname === "/shop-deliver";
  const currentTab = pathToTab(loc.pathname);
  const gpsParams = new URLSearchParams(loc.search);
  const lockedGps = loc.pathname === "/ai-gps" && gpsParams.get("focus") === "locked";
  const hasExplicitGpsDestination = Boolean(gpsParams.get("destination")?.trim());
  const activeNavigation = lockedGps && gpsParams.get("nav") === "1";

  useEffect(() => {
    let alive = true;
    base44.entities.DriverPreference.filter({}).then((p) => {
      if (!alive) return;
      const restoredStatus = normalizeWorkStatus(p[0]?.work_status);
      setWorkStatus(restoredStatus);
      const roamActive = sessionStorage.getItem("lokin_app_free_roam") === "1";
      setAppFreeRoam(roamActive);
      // DriverPreference.work_status is the sole session-restore authority.
      // The resolver is pure and independent from navigation/optimization engines.
      const redirect = resolveSessionRestoreRedirect({
        workStatus: restoredStatus,
        pathname: loc.pathname,
        lockedGps,
        freeRoam: roamActive,
        hasExplicitGpsDestination,
      });
      if (redirect) navigate(redirect, { replace: true });
    }).catch(() => {});
    return () => { alive = false; };
  }, [loc.pathname, lockedGps, hasExplicitGpsDestination, navigate]);

  // Locked navigation is a view of an already-active session, never a state
  // transition. Start Work and Resume persist "working" before navigating here.
  useEffect(() => {
    if (!lockedGps) return;
    sessionStorage.removeItem("lokin_app_free_roam");
    setAppFreeRoam(false);
  }, [lockedGps]);

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
      {!lockedGps && loc.pathname !== "/" && <header className="chrome-shell sticky top-0 z-30 pt-[env(safe-area-inset-top)] select-none">
        <div className="max-w-md mx-auto px-4 h-12 flex items-center justify-between">
          {isNested ? (
            <button onClick={() => navigate(isShopFlow && loc.pathname === "/locator" ? "/shop-deliver" : TAB_ROOTS[currentTab])} aria-label="Go back" className="flex items-center gap-1 -ml-1 py-1 select-none">
              <ChevronLeft className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium text-white/80">Back</span>
            </button>
          ) : (
            <button onClick={() => setCmdOpen(true)} aria-label="LOKIN command engine" className="flex items-center gap-1.5 select-none">
              <img src={LOKIN_LOGO} alt="LOKIN AI — Unlock your potential" draggable="false" className="h-9 w-auto" />
            </button>
          )}
          {workStatus !== "off" && (
            <span className="inline-flex items-center gap-2 rounded-full border border-primary bg-primary/[0.06] px-4 py-1.5 font-heading text-[13px] font-bold uppercase tracking-[0.07em] text-primary select-none"
              style={{ boxShadow: "0 0 14px rgba(124,252,30,.4)", textShadow: "0 0 8px rgba(124,252,30,.6)" }}>
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" style={{ boxShadow: "0 0 8px #7CFC1E" }} /> {sessionStatusLabel(workStatus)}
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

      {!lockedGps && <nav aria-label="Main navigation" className="chrome-dock bg-black fixed bottom-0 inset-x-0 z-40 pb-[env(safe-area-inset-bottom)] select-none">
        <div className="max-w-md mx-auto grid grid-cols-5">
          {NAV.map(({ key, label, icon: Icon, center }) => {
            const active = currentTab === key;
            if (center) {
              return (
                <button key={key} onClick={() => setVoiceOpen(true)} aria-label="LOKIN command station"
                  className="flex flex-col items-center gap-0.5 pt-1.5 pb-2 text-[11px] font-medium">
                  <div className={`chrome-lock-button flex h-12 w-12 items-center justify-center rounded-full -mt-5 transition-all ${active ? "" : ""} glow-primary`}>
                    <img src={LOKIN_NAV_CIRCLE} alt="LOKIN" draggable="false" className="h-12 w-12 rounded-full object-cover" />
                  </div>
                  <span className={active ? "text-primary lokin-tab-active" : "text-white/45"}>LOKIN</span>
                </button>
              );
            }
            return (
              <button key={key} onClick={() => handleTabClick(key)} aria-label={label}
                className={`flex flex-col items-center gap-0.5 pt-2.5 pb-2 text-[11px] font-medium transition-colors ${active ? "text-primary lokin-tab-active" : "text-white/45"}`}>
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