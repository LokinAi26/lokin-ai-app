/**
 * M1 WP9 F4 — backend-snapshot guard for recovery.
 *
 * Frozen rule: "Older backend state must never overwrite newer local
 * active-shift state." During recovery the runtime may be OFFERED a backend
 * snapshot of the shift; this guard decides whether it may be applied.
 *
 * M1 semantics (frozen boundaries: I75 legacy-authoritative, observational
 * new paths only, no runtime-authority switch):
 *   - A snapshot OLDER than the local recovery manifest (lower
 *     lastSequence for the same shift) is LOGGED and NOT APPLIED. Local
 *     active-shift state is preserved byte-for-byte.
 *   - A snapshot for a different shift, or no local manifest at all, is
 *     likewise logged and not applied — there is nothing comparable to
 *     merge against.
 *   - A snapshot that is NOT older is still NOT APPLIED: M1 has no
 *     snapshot-pull path and no merge logic, and applying backend state
 *     would be a runtime-authority switch. This is recorded explicitly
 *     (NO_PULL_PATH_M1) so a future milestone can extend the decision
 *     type with an applied-true case behind a proper merge.
 *
 * In M1 the guard NEVER applies a snapshot — the decision type reflects
 * that honestly. The guard runs inside observeRelaunch() when a snapshot
 * is supplied (device Scenario C injects one synthetically); the decision
 * is console-logged with a stable `[m1-recovery]` prefix and recorded in
 * the relaunch report notes.
 */

import { getOperationalStore } from "../store/index.js";
import type { OperationalStore } from "../store/index.js";

/**
 * Minimal backend shift snapshot offered to recovery.
 * lastSequence is the highest event sequence the snapshot covers —
 * the recency signal compared against the local recovery manifest.
 */
export interface BackendShiftSnapshot {
  shiftId: string;
  lastSequence: number;
  lastEventId?: string;
  updatedAt: string; // ISO-8601
  manifestHash?: string;
}

export type SnapshotDecision =
  | {
      applied: false;
      reason: "OLDER_THAN_LOCAL" | "SHIFT_MISMATCH" | "NO_LOCAL_MANIFEST";
      detail: string;
    }
  | {
      applied: false;
      reason: "NO_PULL_PATH_M1";
      detail: string;
    };

/**
 * Decide whether a backend snapshot may be applied during recovery.
 * Never throws; never mutates the store — the local event log and
 * recovery manifest are only ever READ here.
 *
 * The trailing `store` parameter is a test seam (defaults to the real
 * Dexie OperationalStore); production call sites never pass it.
 */
export async function considerBackendSnapshot(
  snapshot: BackendShiftSnapshot,
  store: OperationalStore = getOperationalStore()
): Promise<SnapshotDecision> {
  const manifest = await store.getRecoveryManifest();

  let decision: SnapshotDecision;
  if (!manifest) {
    decision = {
      applied: false,
      reason: "NO_LOCAL_MANIFEST",
      detail:
        "no local recovery manifest; nothing to compare the snapshot against — not applied",
    };
  } else if (snapshot.shiftId !== manifest.shiftId) {
    decision = {
      applied: false,
      reason: "SHIFT_MISMATCH",
      detail: `snapshot shift ${snapshot.shiftId} !== local manifest shift ${manifest.shiftId} — not applied`,
    };
  } else if (snapshot.lastSequence < manifest.lastMaterializedSequence) {
    decision = {
      applied: false,
      reason: "OLDER_THAN_LOCAL",
      detail:
        `snapshot lastSequence ${snapshot.lastSequence} < local manifest ` +
        `lastMaterializedSequence ${manifest.lastMaterializedSequence} — stale snapshot ` +
        `logged, not applied; local active-shift state preserved`,
    };
  } else {
    decision = {
      applied: false,
      reason: "NO_PULL_PATH_M1",
      detail:
        `snapshot lastSequence ${snapshot.lastSequence} is not older than local ` +
        `lastMaterializedSequence ${manifest.lastMaterializedSequence}, but M1 has no ` +
        `snapshot-pull path or merge logic — not applied (frozen: no runtime-authority switch)`,
    };
  }

  // F4 evidence: the stale snapshot is LOGGED, not applied.
  console.info("[m1-recovery] backend snapshot decision", {
    shiftId: snapshot.shiftId,
    lastSequence: snapshot.lastSequence,
    lastEventId: snapshot.lastEventId ?? null,
    snapshotUpdatedAt: snapshot.updatedAt,
    localLastMaterializedSequence: manifest?.lastMaterializedSequence ?? null,
    decision,
  });

  return decision;
}
