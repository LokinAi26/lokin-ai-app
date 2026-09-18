import { base44 } from "@/api/base44Client";
import { normalizeWorkStatus } from "@/lib/sessionState";

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