import { base44 } from "@/api/base44Client";
import { normalizeWorkStatus, SESSION_STATUS } from "@/lib/sessionState";
import { getCachedUserId } from "@/lib/driverPrefsCache";
import { observeLockIn } from "@/architecture/seams/index";
import { syncPendingEventsSoon } from "@/lib/eventSyncWiring";

// Optimistic work-status store: Shift/Pause/Start toggles flip the UI
// immediately while the DriverPreference write syncs in the background.

let pending = null; // { status, token } while a write is in flight
const listeners = new Set();
let seq = 0;

function emit(pendingStatus, confirmed = null) {
  listeners.forEach((cb) => cb({ pending: pendingStatus, confirmed }));
}

export function getPendingWorkStatus() {
  return pending ? pending.status : null;
}

// Merge the in-flight status into freshly loaded prefs so a reload never
// flashes back to the pre-toggle server value.
export function withPendingWorkStatus(prefs) {
  return pending && prefs ? { ...prefs, work_status: pending.status } : prefs;
}

export function subscribeWorkStatus(cb) {
  listeners.add(cb);
  cb({ pending: getPendingWorkStatus(), confirmed: null });
  return () => { listeners.delete(cb); };
}

// Flip work_status optimistically, persist in the background.
// Resolves { ok, prefs, status }: the server record on success, the reverted
// record on failure — callers can setPrefs(result.prefs) in both cases.
export function setWorkStatusOptimistic(prefs, next, patch = {}) {
  const prev = normalizeWorkStatus(prefs?.work_status);
  const status = normalizeWorkStatus(next);
  const token = ++seq;
  pending = { status, token };
  emit(status);
  if (status === SESSION_STATUS.working) {
    // M1 WP5 observational seam (I75): the Lock In moment appends
    // SESSION_STARTED to the IndexedDB event log. Fire-and-forget — a seam
    // failure must never break the legacy DriverPreference write.
    // M1 WP6: opportunistic idempotent sync of the pending event log.
    getCachedUserId()
      .then((uid) => observeLockIn(uid || "unknown-driver"))
      .then(() => syncPendingEventsSoon())
      .catch(() => {});
  }
  const write = prefs?.id
    ? base44.entities.DriverPreference.update(prefs.id, { work_status: status, ...patch })
    : base44.entities.DriverPreference.create({ work_status: status, ...patch });
  return write.then(
    (updated) => {
      if (pending?.token === token) { pending = null; emit(null, status); }
      return { ok: true, prefs: updated || prefs, status };
    },
    (error) => {
      if (pending?.token === token) { pending = null; emit(null, prev); }
      return { ok: false, prefs: prefs ? { ...prefs, work_status: prev } : null, status: prev, error };
    }
  );
}