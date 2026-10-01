/**
 * LOKIN AI — Deterministic Materializer (I3)
 *
 * Frozen source: SPEC-001 Method §§2–5 (Canonical Replay Ordering,
 * Correction Conflict Resolution, Immutable Corrections §10); I3.
 *
 * Pipeline:
 *   ShiftEvent[]
 *     -> canonical ordering
 *     -> apply corrections
 *     -> reduce events
 *     -> LiveContext
 *
 * The reducer is pure and deterministic: the same ordered event set MUST
 * produce the same LiveContext locally and backend-side. This is the SHARED
 * implementation consumed by both (see scripts/sync-architecture.mjs).
 *
 * Determinism rules enforced here:
 * - No wall-clock reads, no randomness, no unordered-map iteration in any
 *   output-affecting path.
 * - Timestamps are NEVER authoritative ordering evidence (device clocks drift).
 * - Canonical order: (1) causal depth via causationId, (2) sequenceNumber
 *   within the same session, (3) deterministic cross-session resolution
 *   (sessionId lexicographic, then sequenceNumber), (4) occurredAt,
 *   (5) stable eventId tiebreak.
 * - Corrections: FACT_CORRECTED with FactCorrectedPayload; an explicit
 *   causal descendant wins over an ancestor; within a session the higher
 *   sequenceNumber wins; concurrent cross-session corrections resolve by
 *   the eventId tiebreak AND record the conflict (never pretend certainty).
 */

import type {
  ApprovalRequest,
  AttentionState,
  ContextValue,
  FactCorrectedPayload,
  LiveContext,
  Provenance,
  ShiftEvent,
} from "../contracts/index.ts";

export interface CorrectionConflict {
  correctedEventId: string;
  field: string;
  winningEventId: string;
  losingEventId: string;
}

export interface MaterializeResult {
  context: LiveContext;
  conflicts: CorrectionConflict[];
}

const MATERIALIZER_SOURCE = "materializer:init";

function cv<T>(
  value: T,
  provenance: Provenance = "ESTIMATED_MODELED"
): ContextValue<T> {
  return {
    value,
    provenance,
    observedAt: new Date(0).toISOString(),
    source: MATERIALIZER_SOURCE,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(
  payload: unknown,
  field: string
): string | undefined {
  if (!isRecord(payload)) return undefined;
  const v = payload[field];
  return typeof v === "string" ? v : undefined;
}

function readNumber(
  payload: unknown,
  field: string
): number | undefined {
  if (!isRecord(payload)) return undefined;
  const v = payload[field];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/** Causal depth: 0 for roots; 1 + depth of the causation target otherwise. Cycle-safe. */
function causalDepth(
  event: ShiftEvent,
  byId: Map<string, ShiftEvent>
): number {
  let depth = 0;
  const seen = new Set<string>([event.eventId]);
  let current = event.causationId;
  while (current) {
    if (seen.has(current)) break;
    seen.add(current);
    const parent = byId.get(current);
    if (!parent) break;
    depth += 1;
    current = parent.causationId;
  }
  return depth;
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Canonical ordering (frozen §4). Deterministic total order over any
 * finite event set.
 */
export function canonicalOrder(events: ShiftEvent[]): ShiftEvent[] {
  const byId = new Map(events.map((e) => [e.eventId, e]));
  const depths = new Map(events.map((e) => [e.eventId, causalDepth(e, byId)]));
  return [...events].sort((a, b) => {
    const da = depths.get(a.eventId) ?? 0;
    const db = depths.get(b.eventId) ?? 0;
    if (da !== db) return da - db;
    if (a.sessionId === b.sessionId) {
      if (a.sequenceNumber !== b.sequenceNumber)
        return a.sequenceNumber - b.sequenceNumber;
    } else {
      const s = compareStrings(a.sessionId, b.sessionId);
      if (s !== 0) return s;
      if (a.sequenceNumber !== b.sequenceNumber)
        return a.sequenceNumber - b.sequenceNumber;
    }
    const t = compareStrings(a.occurredAt, b.occurredAt);
    if (t !== 0) return t;
    return compareStrings(a.eventId, b.eventId);
  });
}

function deepSet(
  target: Record<string, unknown>,
  path: string,
  value: unknown
): void {
  const parts = path.split(".");
  let node = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i] as string;
    const next = node[part];
    if (!isRecord(next)) {
      node[part] = {};
    }
    node = node[part] as Record<string, unknown>;
  }
  node[parts[parts.length - 1] as string] = value;
}

/** True when `descendant` causally descends from `ancestorId`. */
function descendsFrom(
  descendant: ShiftEvent,
  ancestorId: string,
  byId: Map<string, ShiftEvent>
): boolean {
  const seen = new Set<string>();
  let current = descendant.causationId;
  while (current && !seen.has(current)) {
    if (current === ancestorId) return true;
    seen.add(current);
    current = byId.get(current)?.causationId;
  }
  return false;
}

function isFactCorrectedPayload(
  value: unknown
): value is FactCorrectedPayload {
  if (!isRecord(value)) return false;
  return (
    typeof value["correctedEventId"] === "string" &&
    typeof value["field"] === "string" &&
    "newValue" in value
  );
}

interface WinningCorrection {
  event: ShiftEvent;
  payload: FactCorrectedPayload;
}

/**
 * Apply corrections (frozen §5 + §10). Returns the effective event list —
 * original events with winning corrections applied to their payloads —
 * plus recorded conflicts.
 */
export function applyCorrections(ordered: ShiftEvent[]): {
  events: ShiftEvent[];
  conflicts: CorrectionConflict[];
} {
  const byId = new Map(ordered.map((e) => [e.eventId, e]));
  const winners = new Map<string, WinningCorrection>();
  const conflicts: CorrectionConflict[] = [];

  for (const event of ordered) {
    if (event.type !== "FACT_CORRECTED") continue;
    if (!isFactCorrectedPayload(event.payload)) continue;
    const key = `${event.payload.correctedEventId}::${event.payload.field}`;
    const incumbent = winners.get(key);
    if (!incumbent) {
      winners.set(key, { event, payload: event.payload });
      continue;
    }

    let winner: WinningCorrection = incumbent;
    let loser: WinningCorrection = { event, payload: event.payload };
    let contested = true;

    if (descendsFrom(event, incumbent.event.eventId, byId)) {
      winner = { event, payload: event.payload };
      loser = incumbent;
      contested = false;
    } else if (descendsFrom(incumbent.event, event.eventId, byId)) {
      contested = false;
    } else if (event.sessionId === incumbent.event.sessionId) {
      if (event.sequenceNumber !== incumbent.event.sequenceNumber) {
        winner =
          event.sequenceNumber > incumbent.event.sequenceNumber
            ? { event, payload: event.payload }
            : incumbent;
        loser = winner === incumbent ? { event, payload: event.payload } : incumbent;
        contested = false;
      }
    } else {
      // Concurrent cross-session: stable eventId tiebreak, record conflict.
      winner =
        compareStrings(event.eventId, incumbent.event.eventId) > 0
          ? { event, payload: event.payload }
          : incumbent;
      loser = winner === incumbent ? { event, payload: event.payload } : incumbent;
    }

    winners.set(key, winner);
    // Record a conflict ONLY when resolution was genuinely contested:
    // concurrent cross-session corrections, or same-session corrections at
    // the same sequenceNumber with no causal link. Authoritative resolutions
    // (causal descendant, higher sequenceNumber) carry semantic certainty
    // and are not conflicts.
    if (contested) {
      conflicts.push({
        correctedEventId: event.payload.correctedEventId,
        field: event.payload.field,
        winningEventId: winner.event.eventId,
        losingEventId: loser.event.eventId,
      });
    }
  }

  const events = ordered.map((event) => {
    const corrections = [...winners.values()].filter(
      (w) => w.payload.correctedEventId === event.eventId
    );
    if (corrections.length === 0) return event;
    const payload = isRecord(event.payload)
      ? { ...event.payload }
      : { value: event.payload };
    for (const c of corrections) {
      deepSet(payload, c.payload.field, c.payload.newValue);
    }
    return { ...event, payload };
  });

  // Correction events themselves do not reduce into state.
  return {
    events: events.filter((e) => e.type !== "FACT_CORRECTED"),
    conflicts,
  };
}

function emptyContext(): LiveContext {
  return {
    shift: { shiftId: "", status: "IDLE" },
    goal: { currentEarnings: cv(0) },
    location: {},
    navigation: {},
    offers: {},
    activeJobs: {},
    attention: { state: cv<AttentionState>("UNKNOWN") },
    runtime: { health: "RECOVERING" },
    pendingApprovals: [],
    strategy: {
      strategyId: "",
      driverId: "",
      version: 0,
      thresholds: {},
      instructions: [],
      createdAt: new Date(0).toISOString(),
    },
    materializedThroughVersion: 0,
  };
}

/**
 * Reduce canonically-ordered, correction-applied events into LiveContext.
 *
 * M1 scope: shift/session lifecycle, goal, jobs, navigation identifiers,
 * runtime health, approvals. Offer evaluation, intervention policy,
 * memory/strategy events are parsed deterministically but do not yet
 * mutate LiveContext — their reduction is an M2–M6 extension point.
 * Unhandled event types are ignored deterministically (same input always
 * yields the same output); ignoring is not silent loss, because the event
 * log remains the complete immutable history.
 */
function reduceEvents(ordered: ShiftEvent[]): LiveContext {
  const ctx = emptyContext();
  let maxSequence = 0;

  for (const event of ordered) {
    maxSequence = Math.max(maxSequence, event.sequenceNumber);
    const payload = event.payload;
    const at = event.occurredAt;

    switch (event.type) {
      case "SESSION_STARTED":
      case "SHIFT_STARTED": {
        ctx.shift.shiftId = event.shiftId;
        ctx.shift.status = "ACTIVE";
        ctx.shift.startedAt = at;
        break;
      }
      case "SHIFT_ENDED": {
        ctx.shift.status = "ENDING";
        break;
      }
      case "GOAL_SET": {
        const target = readNumber(payload, "targetEarnings");
        if (target !== undefined) {
          ctx.goal.targetEarnings = {
            value: target,
            provenance: "DRIVER_REPORTED",
            observedAt: at,
            source: event.source,
          };
        }
        const endTime = readString(payload, "targetEndTime");
        if (endTime !== undefined) {
          ctx.goal.targetEndTime = {
            value: endTime,
            provenance: "DRIVER_REPORTED",
            observedAt: at,
            source: event.source,
          };
        }
        break;
      }
      case "EARNINGS_UPDATED": {
        const total = readNumber(payload, "total");
        if (total !== undefined) {
          const provenance: Provenance =
            readString(payload, "provenance") === "VERIFIED"
              ? "VERIFIED"
              : "DRIVER_REPORTED";
          ctx.goal.currentEarnings = {
            value: total,
            provenance,
            observedAt: at,
            source: event.source,
          };
        }
        break;
      }
      case "GOAL_PACE_UPDATED": {
        const pace = readString(payload, "paceStatus");
        if (
          pace === "AHEAD" ||
          pace === "ON_PACE" ||
          pace === "BEHIND" ||
          pace === "UNKNOWN"
        ) {
          ctx.goal.paceStatus = {
            value: pace,
            provenance: "ESTIMATED_MODELED",
            observedAt: at,
            source: event.source,
          };
        }
        break;
      }
      case "JOB_STARTED": {
        const jobId = readString(payload, "jobId") ?? event.correlationId ?? event.eventId;
        ctx.activeJobs[jobId] = { jobId };
        break;
      }
      case "JOB_UPDATED": {
        const jobId = readString(payload, "jobId") ?? event.correlationId;
        if (jobId && ctx.activeJobs[jobId]) {
          ctx.activeJobs[jobId] = { ...ctx.activeJobs[jobId], jobId };
        }
        break;
      }
      case "JOB_COMPLETED": {
        const jobId = readString(payload, "jobId") ?? event.correlationId;
        if (jobId) delete ctx.activeJobs[jobId];
        break;
      }
      case "ROUTE_UPDATED": {
        const miles = readNumber(payload, "remainingDistanceMiles");
        if (miles !== undefined) {
          ctx.navigation.remainingDistanceMiles = {
            value: miles,
            provenance: "ESTIMATED_MODELED",
            observedAt: at,
            source: event.source,
          };
        }
        const minutes = readNumber(payload, "remainingDurationMinutes");
        if (minutes !== undefined) {
          ctx.navigation.remainingDurationMinutes = {
            value: minutes,
            provenance: "ESTIMATED_MODELED",
            observedAt: at,
            source: event.source,
          };
        }
        ctx.navigation.routeUpdatedAt = at;
        break;
      }
      case "RUNTIME_HEALTH_CHANGED": {
        const health = readString(payload, "health");
        if (
          health === "ONLINE" ||
          health === "AI_UNAVAILABLE" ||
          health === "BACKEND_UNAVAILABLE" ||
          health === "OFFLINE" ||
          health === "RECOVERING"
        ) {
          ctx.runtime.health = health;
        }
        break;
      }
      case "APPROVAL_REQUESTED": {
        if (isRecord(payload)) {
          ctx.pendingApprovals.push({
            approvalId: readString(payload, "approvalId") ?? event.eventId,
            correlationId: event.correlationId ?? event.eventId,
            toolId: readString(payload, "toolId") ?? "unknown",
            toolVersion: readString(payload, "toolVersion") ?? "0",
            materialParameters: payload["materialParameters"] ?? null,
            parameterHash: readString(payload, "parameterHash") ?? "",
            status: "PENDING",
            requestedAt: at,
            expiresAt:
              readString(payload, "expiresAt") ?? at,
          });
        }
        break;
      }
      case "APPROVAL_GRANTED":
      case "APPROVAL_DENIED": {
        const approvalId = readString(payload, "approvalId");
        const found = ctx.pendingApprovals.find(
          (a) => a.approvalId === approvalId
        );
        if (found) {
          found.status =
            event.type === "APPROVAL_GRANTED" ? "APPROVED" : "DENIED";
          if (event.type === "APPROVAL_GRANTED") found.grantedAt = at;
        }
        break;
      }
      default:
        // M2–M6 extension point: parsed deterministically, no state
        // mutation in M1. The event log remains the complete history.
        break;
    }
  }

  ctx.materializedThroughVersion = maxSequence;
  return ctx;
}

/**
 * materialize(events): the frozen I3 contract. Pure and deterministic.
 */
export function materialize(events: ShiftEvent[]): LiveContext {
  const ordered = canonicalOrder(events);
  const { events: effective } = applyCorrections(ordered);
  return reduceEvents(effective);
}

/**
 * Full pipeline with correction-conflict evidence (for diagnostics and
 * the M1 evidence record; conflicts do not alter determinism).
 */
export function materializeWithEvidence(events: ShiftEvent[]): MaterializeResult {
  const ordered = canonicalOrder(events);
  const { events: effective, conflicts } = applyCorrections(ordered);
  return { context: reduceEvents(effective), conflicts };
}
