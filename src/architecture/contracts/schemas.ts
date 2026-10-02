/**
 * LOKIN AI — Canonical Contracts: runtime zod schemas
 *
 * Frozen source: SPEC-001 I1 ("TypeScript + runtime validation").
 * Every type that crosses a trust boundary (client <-> backend, event
 * ingest, sync payloads, manifest parsing) is validated with these schemas
 * at the boundary. Types without runtime validation do not cross boundaries.
 */

import { z } from "zod";

const isoDateTime = z.string().datetime({ offset: true });

export const ProvenanceSchema = z.enum([
  "VERIFIED",
  "DRIVER_REPORTED",
  "ESTIMATED_MODELED",
]);

export const ShiftEventTypeSchema = z.enum([
  "SESSION_STARTED",
  "SHIFT_STARTED",
  "SHIFT_ENDED",
  "GOAL_SET",
  "OFFER_RECEIVED",
  "OFFER_EVALUATED",
  "RECOMMENDATION_MADE",
  "DRIVER_DECISION_REPORTED",
  "JOB_STARTED",
  "JOB_UPDATED",
  "JOB_COMPLETED",
  "ROUTE_UPDATED",
  "EARNINGS_UPDATED",
  "GOAL_PACE_UPDATED",
  "INTERVENTION_PROPOSED",
  "INTERVENTION_SPOKEN",
  "INTERVENTION_DEFERRED",
  "APPROVAL_REQUESTED",
  "APPROVAL_GRANTED",
  "APPROVAL_DENIED",
  "ACTION_EXECUTED",
  "RUNTIME_HEALTH_CHANGED",
  "MEMORY_CANDIDATE_CREATED",
  "MEMORY_PROMOTED",
  "MEMORY_REVOKED",
  "FACT_CORRECTED",
]);

export const ShiftEventSchema = z.object({
  eventId: z.string().uuid(),
  shiftId: z.string().min(1),
  driverId: z.string().min(1),

  sessionId: z.string().min(1),
  sequenceNumber: z.number().int().nonnegative(),

  type: ShiftEventTypeSchema,

  occurredAt: isoDateTime,
  recordedAt: isoDateTime,

  origin: z.enum(["DEVICE", "BACKEND"]),
  source: z.string().min(1),

  payload: z.unknown(),

  causationId: z.string().uuid().optional(),
  correlationId: z.string().optional(),

  syncedAt: isoDateTime.optional(),
});

export const SessionStartedPayloadSchema = z.object({
  sessionId: z.string().min(1),
  shiftId: z.string().min(1),
  sequenceOrigin: z.number().int().nonnegative(),
  previousSessionId: z.string().optional(),
  previousLastEventId: z.string().uuid().optional(),
  recoveryMode: z.enum([
    "FRESH",
    "RELAUNCH_RECOVERED",
    "RELAUNCH_INCOMPLETE",
  ]),
  manifestHash: z.string().min(1),
});

export const EventSyncBatchSchema = z.object({
  shiftId: z.string().min(1),
  sessionId: z.string().min(1),
  events: z.array(ShiftEventSchema).min(1),
});

export const EventRejectionSchema = z.object({
  eventId: z.string().uuid(),
  reason: z.string().min(1),
});

export const EventSyncAckSchema = z.object({
  acceptedEventIds: z.array(z.string().uuid()),
  alreadyPresentEventIds: z.array(z.string().uuid()),
  rejected: z.array(EventRejectionSchema),
});

export const ShiftRecoveryManifestSchema = z.object({
  shiftId: z.string().min(1),
  sessionId: z.string().min(1),

  lastMaterializedEventId: z.string().uuid(),
  lastMaterializedSequence: z.number().int().nonnegative(),

  pendingSyncEventIds: z.array(z.string().uuid()),

  activeJobIds: z.array(z.string()),

  navigation: z
    .object({
      routeId: z.string().optional(),
      destinationId: z.string().optional(),
      activeStopId: z.string().optional(),
    })
    .optional(),

  updatedAt: isoDateTime,
});

export const ArchitectureRuntimeManifestSchema = z.object({
  manifestHash: z.string().min(1),
  generatedAt: isoDateTime,
  commitSha: z.string().min(1),

  policyVersions: z.record(z.string(), z.string()),
  schemaVersions: z.record(z.string(), z.string()),
  evaluatorVersions: z.record(z.string(), z.string()),
  registryVersions: z.record(z.string(), z.string()),
});
