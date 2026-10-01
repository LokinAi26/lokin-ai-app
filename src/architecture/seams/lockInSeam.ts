/**
 * LOKIN AI — Lock In / relaunch observational seams (M1 WP5)
 *
 * Frozen source: SPEC-001 M1 required evidence ("The Lock In seam writes the
 * same SESSION_STARTED event the relaunch path reads; a cold relaunch MUST
 * reconstruct equivalent active-shift state").
 *
 * I75 BOUNDARY — READ CAREFULLY: these seams are OBSERVATIONAL ONLY.
 * DriverPreference.work_status remains the sole session-restore authority.
 * These functions only append to / read from the IndexedDB event log and
 * report equivalence. They never mutate legacy state, never navigate, never
 * alter UI, and never throw into their callers. All callers invoke them
 * fire-and-forget with a catch.
 */

import type {
  SessionStartedPayload,
  ShiftEvent,
  ShiftRecoveryManifest,
} from "../contracts/index.js";
import { getOperationalStore } from "../store/index.js";
import { materialize } from "../materializer/index.js";
import { EVENT_SCHEMA_VERSION } from "../store/index.js";

export interface LockInObservation {
  eventId: string;
  shiftId: string;
  sessionId: string;
  appendedAt: string;
}

export type RelaunchOutcome =
  | "equivalent"
  | "expected-divergence"
  | "divergent"
  | "no-prior-log";

export interface RelaunchReport {
  outcome: RelaunchOutcome;
  legacyStatus: string;
  materializedStatus: string | null;
  shiftId: string | null;
  goalTarget: number | null;
  activeJobCount: number | null;
  hasNavigationIdentifiers: boolean;
  notes: string[];
}

/**
 * M1 shift bucket: one shift per driver per local calendar day.
 * Deterministic — the same driver on the same day always maps to the
 * same shiftId, so Lock In and relaunch agree without coordination.
 */
export function shiftIdFor(driverId: string, at: Date = new Date()): string {
  const y = at.getFullYear();
  const m = String(at.getMonth() + 1).padStart(2, "0");
  const d = String(at.getDate()).padStart(2, "0");
  return `${driverId}:${y}-${m}-${d}`;
}

function newEventId(): string {
  // Local untyped view: avoids `in`-narrowing quirks on the global crypto type.
  const c = (
    typeof crypto !== "undefined" ? crypto : undefined
  ) as unknown as
    | { randomUUID?: () => string; getRandomValues?: (a: Uint8Array) => Uint8Array }
    | undefined;
  if (c?.randomUUID) return c.randomUUID();
  if (c?.getRandomValues) {
    const bytes = c.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  // Non-cryptographic last resort (observational M1 seam only).
  return `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12, "0").slice(-12)}`;
}

/**
 * Runtime manifest hash for the SESSION_STARTED payload.
 *
 * M1: SHA-256 over stable build constants (app id + event schema version).
 * WP7 replaces this with the hash of the full build-time
 * ArchitectureRuntimeManifest. The FNV-1a fallback only engages outside a
 * secure context and is labeled in the digest input so a hash produced by
 * the fallback can never be confused with a SHA-256 one.
 */
export async function getRuntimeManifestHash(): Promise<string> {
  const appId =
    (import.meta as unknown as { env?: Record<string, string> }).env
      ?.["VITE_BASE44_APP_ID"] ?? "dev";
  const input = JSON.stringify({
    appId,
    eventSchemaVersion: EVENT_SCHEMA_VERSION,
  });
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`sha256:${input}`)
    );
    return [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  let h = 0x811c9dc5;
  const labeled = `fnv1a:${input}`;
  for (let i = 0; i < labeled.length; i++) {
    h ^= labeled.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `fnv1a-${(h >>> 0).toString(16).padStart(8, "0")}`;
}

/**
 * Lock In seam: append SESSION_STARTED + recovery manifest atomically.
 * Called on the optimistic work_status -> "working" transition (the product's
 * session-start semantic). Fire-and-forget; never throws.
 */
export async function observeLockIn(
  driverId: string
): Promise<LockInObservation> {
  const store = getOperationalStore();
  const now = new Date();
  const nowIso = now.toISOString();
  const shiftId = shiftIdFor(driverId, now);
  const sessionId = newEventId();
  const manifestHash = await getRuntimeManifestHash();

  const payload: SessionStartedPayload = {
    sessionId,
    shiftId,
    sequenceOrigin: 0,
    recoveryMode: "FRESH",
    manifestHash,
  };

  const event: ShiftEvent<SessionStartedPayload> = {
    eventId: newEventId(),
    shiftId,
    driverId,
    sessionId,
    sequenceNumber: 0,
    type: "SESSION_STARTED",
    occurredAt: nowIso,
    recordedAt: nowIso,
    origin: "DEVICE",
    source: "lock-in-seam",
    payload,
  };

  const manifest: ShiftRecoveryManifest = {
    shiftId,
    sessionId,
    lastMaterializedEventId: event.eventId,
    lastMaterializedSequence: 0,
    pendingSyncEventIds: [event.eventId],
    activeJobIds: [],
    updatedAt: nowIso,
  };

  await store.appendEventAndUpdateManifest(event, manifest);
  return { eventId: event.eventId, shiftId, sessionId, appendedAt: nowIso };
}

/**
 * Relaunch bootstrap: read the log, materialize, compare against the legacy
 * restored status. Observational — returns a report, changes nothing.
 */
export async function observeRelaunch(
  driverId: string,
  legacyStatus: string
): Promise<RelaunchReport> {
  const notes: string[] = [];
  const store = getOperationalStore();
  const manifest = await store.getRecoveryManifest();

  if (!manifest) {
    return {
      outcome: "no-prior-log",
      legacyStatus,
      materializedStatus: null,
      shiftId: null,
      goalTarget: null,
      activeJobCount: null,
      hasNavigationIdentifiers: false,
      notes: ["no recovery manifest in IndexedDB (first run or pre-M1 install)"],
    };
  }

  const events = await store.getShiftEvents(manifest.shiftId);
  const ctx = materialize(events);
  const materializedStatus = ctx.shift.status;

  // Expected materialized status for each legacy restore value.
  // "paused" has no frozen event type in M1, so any materialized status is
  // an expected divergence — legacy remains authoritative.
  const expected =
    legacyStatus === "working"
      ? "ACTIVE"
      : legacyStatus === "off"
        ? "IDLE"
        : null;

  let outcome: RelaunchOutcome;
  if (expected === null) {
    outcome = "expected-divergence";
    notes.push(
      `legacy status "${legacyStatus}" has no frozen M1 event equivalent; materialized "${materializedStatus}" recorded for inspection only`
    );
  } else if (materializedStatus === expected) {
    outcome = "equivalent";
  } else {
    outcome = "divergent";
    notes.push(
      `legacy "${legacyStatus}" restored but materialized "${materializedStatus}" (expected "${expected}"); legacy remains authoritative under I75`
    );
  }

  if (manifest.shiftId !== shiftIdFor(driverId)) {
    notes.push(
      `manifest shift ${manifest.shiftId} is not today's bucket ${shiftIdFor(driverId)} — relaunch after midnight or a prior-day session`
    );
  }

  return {
    outcome,
    legacyStatus,
    materializedStatus,
    shiftId: manifest.shiftId,
    goalTarget: ctx.goal.targetEarnings?.value ?? null,
    activeJobCount: Object.keys(ctx.activeJobs).length,
    hasNavigationIdentifiers: Boolean(
      manifest.navigation?.routeId ||
        manifest.navigation?.destinationId ||
        manifest.navigation?.activeStopId
    ),
    notes,
  };
}
