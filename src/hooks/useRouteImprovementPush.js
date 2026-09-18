import { useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";

// Instant faster-route alerts during a delivery shift:
//  - A local web Notification when LOKIN is backgrounded (works in the
//    installed PWA even when the map isn't visible).
//  - A native mobile push via the route-detour-push backend function.
// Fires once per detected improvement (deduped by received_at_ms); the in-app
// RouteImprovementAlert card and voice announcement stay as they are.
export default function useRouteImprovementPush(improvement) {
  const askedRef = useRef(false);
  const sentRef = useRef(null);

  useEffect(() => {
    if (!improvement?.received_at_ms) return;
    if (sentRef.current === improvement.received_at_ms) return;
    sentRef.current = improvement.received_at_ms;

    const mins = Math.max(1, Math.round((improvement.savings_s || 0) / 60));

    // Local web notification — only needed when the app is backgrounded; the
    // in-app card + voice already cover foreground use.
    if (typeof Notification !== "undefined") {
      if (Notification.permission === "granted") {
        if (document.hidden) {
          try {
            const n = new Notification("Faster route found", {
              body: `Save ~${mins} min on your remaining stops. Tap to open LOKIN and apply.`,
            });
            n.onclick = () => { window.focus(); n.close(); };
          } catch {}
        }
      } else if (Notification.permission === "default" && !askedRef.current) {
        askedRef.current = true;
        Notification.requestPermission().catch(() => {});
      }
    }

    // Native mobile push — fire-and-forget; the backend reports (but the
    // client ignores) delivery failures when push credentials aren't set up.
    base44.functions
      .invoke("route-detour-push", { savings_s: improvement.savings_s || 0 })
      .catch(() => {});
  }, [improvement?.received_at_ms, improvement?.savings_s]);
}