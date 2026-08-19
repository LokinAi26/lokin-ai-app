import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Route as RouteIcon, BarChart3, Menu, ChevronLeft, Truck, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { LokinGlyph } from "@/components/Brand";
import { base44 } from "@/api/base44Client";

import CommandEngine from "@/components/CommandEngine";
import GlobalVoiceAssistant from "@/components/GlobalVoiceAssistant";
import { getAiConsent, setAiConsent, AI_CONSENT_VERSION } from "@/lib/aiConsent";

const NESTED_PATHS = [
  "/categories", "/locator", "/avoid", "/fuel", "/settings",
  "/drive", "/brand", "/support", "/gigs", "/receipts", "/pricing", "/on-the-road", "/shop-deliver",
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
  const [lastPaths, setLastPaths] = useState(TAB_ROOTS);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [aiConsent, setAiConsentState] = useState(() => getAiConsent());
  const isNested = NESTED_PATHS.includes(loc.pathname);
  const isShopFlow = loc.pathname === "/locator" || loc.pathname === "/shop-deliver";
  const currentTab = pathToTab(loc.pathname);
  const lockedGps = loc.pathname === "/ai-gps" && new URLSearchParams(loc.search).get("focus") === "locked";

  useEffect(() => {
    base44.entities.DriverPreference.filter({}).then((p) => setWorking((p[0] && p[0].work_status) === "working"));
  }, [loc.pathname]);

  // Track the last visited path per tab so switching back restores it
  useEffect(() => {
    if (currentTab && loc.pathname !== lastPaths[currentTab]) {
      setLastPaths((prev) => ({ ...prev, [currentTab]: loc.pathname }));
    }
  }, [loc.pathname, currentTab]);

  async function chooseAiConsent(value) {
    setAiConsent(value);
    setAiConsentState(value);
    try {
      const user = await base44.auth.me();
      if (user?.id) await base44.entities.AiConsentRecord.create({ user_id: user.id, granted: value === "granted", version: AI_CONSENT_VERSION, recorded_at: new Date().toISOString() });
    } catch (_) {}
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

      <main className={`flex-1 w-full max-w-md mx-auto px-0 ${lockedGps ? "pb-[env(safe-area-inset-bottom)]" : "pb-[calc(5.75rem+env(safe-area-inset-bottom))]"}`}>
        <motion.div
          key={loc.pathname}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
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

      {!lockedGps && <CommandEngine open={cmdOpen} onClose={() => setCmdOpen(false)} />}
      <GlobalVoiceAssistant open={voiceOpen} onOpenChange={setVoiceOpen} />
      {aiConsent == null && (
        <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl border border-primary/25 bg-card p-5 shadow-2xl">
            <div className="flex items-center gap-3"><div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center"><ShieldCheck className="h-5 w-5 text-primary" /></div><div><div className="font-bold">AI processing permission</div><div className="text-xs text-white/45">Your choice can be changed later.</div></div></div>
            <p className="mt-4 text-sm text-white/65 leading-relaxed">When you use LOKIN AI features, your prompt and the minimum context needed to answer may be sent to LOKIN's configured AI service provider. LOKIN does not need this permission for core non-AI features.</p>
            <div className="mt-5 grid grid-cols-2 gap-2"><button onClick={() => chooseAiConsent("declined")} className="rounded-xl border border-white/15 py-2.5 text-sm font-semibold">Not now</button><button onClick={() => chooseAiConsent("granted")} className="rounded-xl bg-primary text-primary-foreground py-2.5 text-sm font-bold">Allow AI</button></div>
          </div>
        </div>
      )}
    </div>
  );
}