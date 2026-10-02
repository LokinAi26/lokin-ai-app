import { base44 } from "@/api/base44Client";
import { getOperationalStore } from "@/architecture/store/index";
import { syncPendingEvents } from "@/architecture/sync/index";

// M1 WP6: opportunistic event sync wiring (I75 — observational only).
// Sends pending IndexedDB events to the syncShiftEvents backend function.
// Fire-and-forget: sync failure must never break the legacy flows that
// trigger it. Rejected events stay pending and are retried next run.
export function syncPendingEventsSoon() {
  syncPendingEvents({
    store: getOperationalStore(),
    invoke: (name, payload) => base44.functions.invoke(name, payload),
  })
    .then((report) => {
      if (report.attempted > 0 || report.error) {
        console.info("[m1-seam] event sync", {
          attempted: report.attempted,
          accepted: report.acceptedEventIds.length,
          alreadyPresent: report.alreadyPresentEventIds.length,
          rejected: report.rejected,
          remainingPending: report.remainingPending,
          error: report.error,
        });
      }
    })
    .catch(() => {});
}
