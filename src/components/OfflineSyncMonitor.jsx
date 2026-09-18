import { useEffect, useState } from "react";
import { Check, RefreshCw, WifiOff } from "lucide-react";
import { subscribeOfflineQueue, syncOfflineQueue } from "@/lib/offlineQueue";

// Auto-syncs queued delivery data whenever the connection returns and shows
// a compact status pill (queued / syncing / synced). The sync itself runs
// app-wide; the pill is hidden during locked GPS to keep driving
// distraction-free.
export default function OfflineSyncMonitor({ showPill = true }) {
  const [snap, setSnap] = useState({ pending: 0, syncing: false });
  const [justSynced, setJustSynced] = useState(0);

  useEffect(() => subscribeOfflineQueue(setSnap), []);

  useEffect(() => {
    let hideTimer;
    async function trySync() {
      if (typeof navigator === "undefined" || !navigator.onLine) return;
      const res = await syncOfflineQueue();
      if (res.synced > 0) {
        setJustSynced(res.synced);
        hideTimer = setTimeout(() => setJustSynced(0), 4000);
      }
    }
    trySync();
    window.addEventListener("online", trySync);
    return () => {
      window.removeEventListener("online", trySync);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!showPill) return null;
  if (snap.pending === 0 && justSynced === 0) return null;

  const offline = typeof navigator !== "undefined" && !navigator.onLine;

  return (
    <div
      aria-live="polite"
      className="fixed left-3 z-50 inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-[9px] font-extrabold tracking-[0.08em] shadow-lg backdrop-blur"
      style={{
        bottom: "calc(5.6rem + env(safe-area-inset-bottom))",
        ...(snap.syncing
          ? { borderColor: "rgba(34,211,238,.4)", background: "rgba(5,10,12,.85)", color: "#22D3EE" }
          : justSynced > 0
            ? { borderColor: "rgba(124,252,30,.4)", background: "rgba(5,10,5,.85)", color: "#7CFC1E" }
            : { borderColor: "rgba(255,210,0,.4)", background: "rgba(10,8,2,.85)", color: "#FFD200" }),
      }}
    >
      {snap.syncing ? (
        <>
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          SYNCING {snap.pending}…
        </>
      ) : justSynced > 0 ? (
        <>
          <Check className="h-3.5 w-3.5" />
          SYNCED {justSynced} RECORD{justSynced > 1 ? "S" : ""}
        </>
      ) : (
        <>
          <WifiOff className="h-3.5 w-3.5" />
          OFFLINE · {snap.pending} SAVED LOCALLY
        </>
      )}
    </div>
  );
}