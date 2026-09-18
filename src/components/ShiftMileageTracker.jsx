import { useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { normalizeWorkStatus } from "@/lib/sessionState";
import { createOrQueue } from "@/lib/offlineQueue";
import { beginShiftTracking, DEDUCTION_RATE_PER_MILE, endShiftTracking, localDateString, suspendShiftTracking } from "@/lib/shiftMileage";

const MIN_COMMIT_MILES = 0.05;

// Invisible controller that keeps GPS shift tracking aligned with the
// persisted work session: working → track, paused → suspend, off → commit
// the shift's miles to the mileage log.
export default function ShiftMileageTracker() {
  const statusRef = useRef(null);

  useEffect(() => {
    let alive = true;

    function commitShift() {
      const snap = endShiftTracking();
      if (!snap || snap.miles < MIN_COMMIT_MILES) return;
      const miles = Math.round(snap.miles * 100) / 100;
      // Offline-safe: if the shift ends with no signal, the mileage log is
      // stored locally and syncs automatically once the connection returns.
      createOrQueue("MileageLog", {
        date: localDateString(),
        miles,
        type: "business",
        purpose: "Work shift (auto-tracked)",
        deduction: Math.round(miles * DEDUCTION_RATE_PER_MILE * 100) / 100,
      }).catch(() => {});
    }

    function applyStatus(next) {
      if (statusRef.current === next) return;
      statusRef.current = next;
      if (next === "working") beginShiftTracking();
      else if (next === "paused") suspendShiftTracking();
      else commitShift();
    }

    async function sync() {
      try {
        const rows = await base44.entities.DriverPreference.filter({});
        if (alive) applyStatus(normalizeWorkStatus(rows[0]?.work_status));
      } catch {
        /* preferences unavailable — keep the last known status */
      }
    }

    sync();
    const unsubscribe = base44.entities.DriverPreference.subscribe(() => sync());
    const resyncOnFocus = () => sync();
    window.addEventListener("focus", resyncOnFocus);
    document.addEventListener("visibilitychange", resyncOnFocus);
    return () => {
      alive = false;
      unsubscribe?.();
      window.removeEventListener("focus", resyncOnFocus);
      document.removeEventListener("visibilitychange", resyncOnFocus);
    };
  }, []);

  return null;
}