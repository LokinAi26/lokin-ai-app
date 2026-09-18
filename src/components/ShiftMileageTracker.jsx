import { useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { normalizeWorkStatus } from "@/lib/sessionState";
import { createOrQueue } from "@/lib/offlineQueue";
import {
  beginShiftTracking,
  DEDUCTION_RATE_PER_MILE,
  endShiftTracking,
  getLastFixAt,
  getShiftSnapshot,
  localDateString,
  suspendShiftTracking,
} from "@/lib/shiftMileage";

const MIN_COMMIT_MILES = 0.05;
const WATCHDOG_INTERVAL_MS = 60000; // re-check the GPS watch every minute
const WATCHDOG_STALE_MS = 120000; // no fix for 2 min while working = dead watch

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

    // A stale "working" flag can survive sign-in, a force-close, or a failed
    // tap-out write. The local shift state is the authority: with no live
    // shift behind the flag, nobody is locked in — flip it off so a fresh
    // sign-in never opens on a phantom shift.
    async function reconcileStaleWorking(pref) {
      const status = normalizeWorkStatus(pref?.work_status);
      if ((status === "working" || status === "paused") && !getShiftSnapshot().active) {
        if (pref?.id) {
          base44.entities.DriverPreference.update(pref.id, { work_status: "off", break_active: false }).catch(() => {});
        }
        return "off";
      }
      return status;
    }

    async function sync() {
      try {
        const rows = await base44.entities.DriverPreference.filter({});
        if (!alive) return;
        applyStatus(await reconcileStaleWorking(rows[0] || null));
      } catch {
        /* preferences unavailable — keep the last known status */
      }
    }

    // Returning from another app (e.g. the Dasher app): iOS may have silently
    // killed the GPS watch while LOKIN was backgrounded. If the shift is
    // still live, re-register the watch so mileage keeps accumulating
    // automatically — no tap needed.
    function resumeWatchIfWorking() {
      if (statusRef.current === "working" && getShiftSnapshot().active) beginShiftTracking();
    }

    const resyncOnFocus = () => {
      sync();
      resumeWatchIfWorking();
    };

    sync();
    const unsubscribe = base44.entities.DriverPreference.subscribe(() => sync());
    window.addEventListener("focus", resyncOnFocus);
    document.addEventListener("visibilitychange", resyncOnFocus);

    // Watchdog: if no GPS fix has arrived for a while during a live shift,
    // the watch died silently — re-register it.
    const watchdog = setInterval(() => {
      if (statusRef.current !== "working") return;
      if (!getShiftSnapshot().active) return;
      if (Date.now() - getLastFixAt() < WATCHDOG_STALE_MS) return;
      beginShiftTracking();
    }, WATCHDOG_INTERVAL_MS);

    return () => {
      alive = false;
      unsubscribe?.();
      clearInterval(watchdog);
      window.removeEventListener("focus", resyncOnFocus);
      document.removeEventListener("visibilitychange", resyncOnFocus);
    };
  }, []);

  return null;
}