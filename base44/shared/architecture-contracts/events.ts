/**
 * LOKIN AI — Canonical Contracts: ShiftEvent
 *
 * Frozen source: SPEC-001 Method §§2–4, 10 (Immutable Corrections),
 * Session-Scoped Ordering + Session Anchoring amendments; I1, I5.
 *
 * ShiftEventType = the §2 locked list, plus FACT_CORRECTED (§10 amendment)
 * and SESSION_STARTED (Session Anchoring amendment).
 *
 * ShiftEvent = the final amended form: session-scoped ordering via
 * sessionId + sequenceNumber (monotonic within a session; no
 * client-generated global shift sequence).
 */

export type ShiftEventType =
  | "SESSION_STARTED"
  | "SHIFT_STARTED"
  | "SHIFT_ENDED"
  | "GOAL_SET"
  | "OFFER_RECEIVED"
  | "OFFER_EVALUATED"
  | "RECOMMENDATION_MADE"
  | "DRIVER_DECISION_REPORTED"
  | "JOB_STARTED"
  | "JOB_UPDATED"
  | "JOB_COMPLETED"
  | "ROUTE_UPDATED"
  | "EARNINGS_UPDATED"
  | "GOAL_PACE_UPDATED"
  | "INTERVENTION_PROPOSED"
  | "INTERVENTION_SPOKEN"
  | "INTERVENTION_DEFERRED"
  | "APPROVAL_REQUESTED"
  | "APPROVAL_GRANTED"
  | "APPROVAL_DENIED"
  | "ACTION_EXECUTED"
  | "RUNTIME_HEALTH_CHANGED"
  | "MEMORY_CANDIDATE_CREATED"
  | "MEMORY_PROMOTED"
  | "MEMORY_REVOKED"
  | "FACT_CORRECTED";

export interface ShiftEvent<T = unknown> {
  eventId: string; // UUID, immutable
  shiftId: string;
  driverId: string;

  sessionId: string;
  sequenceNumber: number; // monotonic within the session

  type: ShiftEventType;

  occurredAt: string; // ISO-8601
  recordedAt: string; // ISO-8601

  origin: "DEVICE" | "BACKEND";
  source: string;

  payload: T;

  causationId?: string; // event causing this event
  correlationId?: string; // entire decision chain

  syncedAt?: string; // ISO-8601, set once acknowledged
}

/**
 * Minimum payload contract for SESSION_STARTED.
 * Frozen source: SPEC-001 Method §3 (Session Anchoring): "The event records
 * at minimum the sessionId, shiftId, session sequence origin, previous known
 * session/event when available, and runtime recovery mode." Plus the
 * ArchitectureRuntimeManifest hash (I59–I72; M1 required evidence).
 */
export interface SessionStartedPayload {
  sessionId: string;
  shiftId: string;
  sequenceOrigin: number;
  previousSessionId?: string;
  previousLastEventId?: string;
  recoveryMode:
    | "FRESH"
    | "RELAUNCH_RECOVERED"
    | "RELAUNCH_INCOMPLETE";
  manifestHash: string; // ArchitectureRuntimeManifest hash
}
