import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MapPin, PackageSearch, X, BellOff, BellRing } from "lucide-react";
import {
  subscribeStoreGeofence,
  isStoreGeofenceEnabled,
  setStoreGeofenceEnabled,
} from "@/lib/storeGeofence";
import { speakLokin } from "@/lib/lokinVoicePipeline";

const AUTO_OPEN_SECONDS = 5;

function isShopPath(p) {
  return p === "/locator" || p === "/shop-deliver";
}

// Active turn-by-turn navigation: never pull the driver out of it from a
// dwell alone (a long red light next to a store looks like a dwell). Arriving
// at a store destination still auto-opens, via the "arrival" enter.
function isActiveNavigationPath() {
  if (window.location.pathname !== "/ai-gps") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("focus") === "locked" && params.get("nav") === "1";
}

// Auto-trigger sheet for the AI item locator.
// When the store geofence fires an "enter" event (driver walked into a
// grocery/retail store), this sheet opens with the store name and announces
// it by voice once. When the visit "settles" (the driver stayed inside at
// walking pace, or navigation arrived at the store) and auto-open is on, it
// counts down and switches to the item locator unless the driver cancels.
export default function StoreEntrySheet() {
  const navigate = useNavigate();
  const location = useLocation();
  const [store, setStore] = useState(null);
  const [enabled, setEnabled] = useState(isStoreGeofenceEnabled());
  const [countdown, setCountdown] = useState(null); // seconds left, or null
  const dismissedRef = useRef(null); // store id dismissed for this visit

  useEffect(() => {
    return subscribeStoreGeofence((evt) => {
      if (evt.type === "exit") {
        dismissedRef.current = null;
        setStore(null);
        setCountdown(null);
        return;
      }
      if (evt.type === "settled" && evt.store) {
        if (!isStoreGeofenceEnabled()) return;
        if (dismissedRef.current === evt.store.id) return;
        if (isShopPath(window.location.pathname)) return;
        if (evt.store.kind !== "arrival" && isActiveNavigationPath()) return;
        setStore(evt.store);
        setCountdown(AUTO_OPEN_SECONDS);
        try {
          speakLokin("Opening the item locator.", { rate: 1.05 });
        } catch {
          /* voice is best-effort */
        }
        return;
      }
      if (evt.type === "enter" && evt.store) {
        if (!isStoreGeofenceEnabled()) return;
        if (dismissedRef.current === evt.store.id) return;
        // Already in a shopping flow — no need to interrupt.
        if (isShopPath(window.location.pathname)) return;
        setStore(evt.store);
        const label = evt.store.name && evt.store.name !== "Grocery store" ? evt.store.name : "this store";
        try {
          speakLokin(`You're at ${label}. Item locator ready.`, { rate: 1.05 });
        } catch {
          /* voice is best-effort */
        }
      }
    });
  }, []);

  // If the driver navigates to the locator themselves, drop the sheet.
  useEffect(() => {
    if (isShopPath(location.pathname)) {
      setStore(null);
      setCountdown(null);
    }
  }, [location.pathname]);

  // Auto-open countdown: switch to the item locator when it reaches zero.
  useEffect(() => {
    if (countdown == null) return undefined;
    if (countdown <= 0) {
      setCountdown(null);
      setStore(null);
      navigate("/locator");
      return undefined;
    }
    const timer = setTimeout(() => setCountdown((c) => (c == null ? null : c - 1)), 1000);
    return () => clearTimeout(timer);
  }, [countdown, navigate]);

  function dismiss() {
    if (store) dismissedRef.current = store.id;
    setStore(null);
    setCountdown(null);
  }

  function toggleEnabled() {
    const next = !enabled;
    setEnabled(next);
    setStoreGeofenceEnabled(next);
    if (!next) {
      setStore(null);
      setCountdown(null);
    }
  }

  if (!store) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none">
      <div className="pointer-events-auto w-full max-w-md mx-3 mb-4 rounded-3xl border border-primary/25 bg-[#0b0f0a]/95 backdrop-blur-xl p-5 shadow-[0_8px_40px_rgba(0,0,0,0.6)]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-primary">
            <MapPin className="h-4 w-4" />
            <span className="text-[10px] font-bold tracking-[0.2em]">STORE DETECTED</span>
          </div>
          <button onClick={dismiss} aria-label="Dismiss" className="rounded-lg p-1 text-white/40 active:scale-95">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-2 text-lg font-extrabold text-white leading-tight">{store.name}</div>
        <div className="mt-1 text-xs text-white/50">
          {countdown != null
            ? `Opening the item locator in ${countdown}s. Tap Not now to stay here.`
            : "AI item locator is ready — find any item by aisle and shelf."}
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => {
              setStore(null);
              setCountdown(null);
              navigate("/locator?import=1");
            }}
            className="lokin-cta flex-1 flex items-center justify-center gap-2"
          >
            <PackageSearch className="h-4 w-4" />
            IMPORT ITEMS
          </button>
          <button
            onClick={() => {
              setStore(null);
              setCountdown(null);
              navigate("/locator");
            }}
            className="rounded-2xl border border-primary/25 px-4 text-sm font-bold text-primary active:scale-95"
          >
            LOCATOR
          </button>
          <button
            onClick={dismiss}
            className="rounded-2xl border border-white/10 px-4 text-sm text-white/60 active:scale-95"
          >
            Not now
          </button>
        </div>
        <button
          onClick={toggleEnabled}
          className="mt-3 flex items-center gap-1.5 text-[10px] text-white/30 active:scale-95"
        >
          {enabled ? <BellRing className="h-3 w-3" /> : <BellOff className="h-3 w-3" />}
          {enabled ? "Auto-open is on — tap to turn off" : "Auto-open is off — tap to turn on"}
        </button>
      </div>
    </div>
  );
}
