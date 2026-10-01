/**
 * M1 WP8 — observational dual-write seam.
 *
 * Frozen boundary: SPEC-001 I75 (legacy state remains authoritative) and the
 * M1 acceptance scope. This module NEVER reads legacy state for decisions
 * and NEVER writes to legacy stores. Each function takes a fully-formed
 * observation (what the legacy code just did) and appends the corresponding
 * architecture event plus the recovery-manifest update in ONE IndexedDB
 * transaction. Every function is fire-and-forget and never throws; a seam
 * failure must never change legacy behavior.
 *
 * WP8 implementation-defined decisions (additive, documented here for the
 * frozen-spec conformity review — not silent):
 *   1. Legacy work_status "off" (SESSION_STATUS.off) maps to SHIFT_ENDED.
 *      "paused" has no frozen M1 event type and is therefore NOT observed.
 *   2. Settings daily_goal maps to GOAL_SET.payload.targetEarnings — the
 *      exact field the WP4 materializer reads (SPEC-001-derived).
 *   3. Session anchoring: the event joins the CURRENT session (sessionId of
 *      the latest event in today's shift bucket, next sequenceNumber after
 *      that session's max). If the log has no events for the shift yet
 *      (legacy wrote before any Lock In observation), the event anchors to
 *      `${shiftId}:legacy` — the same legacy-session identity the v0 upcast
 *      rule establishes.
 *   4. The shift-end observation fires only on a transition INTO "off"
 *      (prev !== "off"); repeated off-sets must not duplicate SHIFT_ENDED.
 *      The guard lives at the call site, next to the WP5 working-transition
 *      hook, so the observational policy stays visible where legacy writes.
 */

import type { ShiftEvent, ShiftRecoveryManifest } from "../contracts/index.js";
import { getOperationalStore } from "../store/index.js";
import type { OperationalStore } from "../store/index.js";
import { newEventId, shiftIdFor } from "./lockInSeam.js";

export interface DualWriteObservation {
  eventId: string;
  shiftId: string;
  sessionId: string;
  sequenceNumber: number;
  appendedAt: string;
}

/**
 * Append one observational event to the current session of today's shift
 * and update the recovery manifest in the same IndexedDB transaction.
 * Never throws — callers treat the returned promise as fire-and-forget.
 *
 * The trailing `store` parameter is a test seam (defaults to the real
 * Dexie OperationalStore); production call sites never pass it.
 */
export async function appendObservationalEvent(
  driverId: string,
  type: "SHIFT_ENDED" | "GOAL_SET",
  payload: Record<string, unknown>,
  store: OperationalStore = getOperationalStore()
): Promise<DualWriteObservation> {
  const now = new Date();
  const nowIso = now.toISOString();
  const shiftId = shiftIdFor(driverId, now);

  // Resolve the current session: latest event's session, else the legacy anchor.
  const existing = await store.getShiftEvents(shiftId);
  let sessionId = `${shiftId}:legacy`;
  let nextSequence = 0;
  if (existing.length > 0) {
    const latest = existing[existing.length - 1];
    sessionId = latest.sessionId;
    for (const e of existing) {
      if (e.sessionId === sessionId && e.sequenceNumber >= nextSequence) {
        nextSequence = e.sequenceNumber + 1;
      }
    }
  }

  const event: ShiftEvent<Record<string, unknown>> = {
    eventId: newEventId(),
    shiftId,
    driverId,
    sessionId,
    sequenceNumber: nextSequence,
    type,
    occurredAt: nowIso,
    recordedAt: nowIso,
    origin: "DEVICE",
    source: "dual-write-seam",
    payload,
  };

  const prev = await store.getRecoveryManifest();
  const manifest: ShiftRecoveryManifest =
    prev && prev.shiftId === shiftId
      ? {
          ...prev,
          sessionId,
          lastMaterializedEventId: event.eventId,
          lastMaterializedSequence: nextSequence,
          pendingSyncEventIds: [...prev.pendingSyncEventIds, event.eventId],
          updatedAt: nowIso,
        }
      : {
          shiftId,
          sessionId,
          lastMaterializedEventId: event.eventId,
          lastMaterializedSequence: nextSequence,
          pendingSyncEventIds: [event.eventId],
          activeJobIds: [],
          updatedAt: nowIso,
        };

  await store.appendEventAndUpdateManifest(event, manifest);
  return {
    eventId: event.eventId,
    shiftId,
    sessionId,
    sequenceNumber: nextSequence,
    appendedAt: nowIso,
  };
}

/**
 * Observe the legacy work_status -> "off" transition (Tap Out / shift end).
 * Fire-and-forget; never throws.
 */
export async function observeShiftEnd(driverId: string): Promise<DualWriteObservation> {
  return appendObservationalEvent(driverId, "SHIFT_ENDED", {});
}

/**
 * Observe an explicit driver earnings-goal change (Settings daily_goal).
 * Emits GOAL_SET with the targetEarnings payload field the materializer
 * reads. Fire-and-forget; never throws.
 */
export async function observeGoalSet(
  driverId: string,
  targetEarnings: number
): Promise<DualWriteObservation> {
  return appendObservationalEvent(driverId, "GOAL_SET", { targetEarnings });
}
