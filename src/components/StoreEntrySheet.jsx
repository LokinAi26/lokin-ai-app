import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MapPin, PackageSearch, X, BellOff, BellRing } from "lucide-react";
import {
  subscribeStoreGeofence,
  isStoreGeofenceEnabled,
  setStoreGeofenceEnabled,
} from "@/lib/storeGeofence";
import { speakLokin } from "@/lib/lokinVoicePipeline";

// Auto-trigger sheet for the AI item locator.
// When the store geofence fires an "enter" event (driver walked into a
// grocery/retail store while locked in), this sheet opens automatically with
// the store name, announces it by voice once, and offers the item locator.
export default function StoreEntrySheet() {
  const navigate = useNavigate();
  const location = useLocation();
  const [store, setStore] = useState(null);
  const [enabled, setEnabled] = useState(isStoreGeofenceEnabled());
  const dismissedRef = useRef(null); // store id dismissed for this visit

  useEffect(() => {
    return subscribeStoreGeofence((evt) => {
      if (evt.type === "exit") {
        dismissedRef.current = null;
        setStore(null);
        return;
      }
      if (evt.type === "enter" && evt.store) {
        if (!isStoreGeofenceEnabled()) return;
        if (dismissedRef.current === evt.store.id) return;
        // Already in a shopping flow — no need to interrupt.
        const p = window.location.pathname;
        if (p === "/locator" || p === "/shop-deliver") return;
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
    if (location.pathname === "/locator" || location.pathname === "/shop-deliver") {
      setStore(null);
    }
  }, [location.pathname]);

  function dismiss() {
    if (store) dismissedRef.current = store.id;
    setStore(null);
  }

  function toggleEnabled() {
    const next = !enabled;
    setEnabled(next);
    setStoreGeofenceEnabled(next);
    if (!next) setStore(null);
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
        <div className="mt-1 text-xs text-white/50">AI item locator is ready — find any item by aisle and shelf.</div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => {
              setStore(null);
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
