/**
 * LOKIN AI — Idempotent backend ingestion decision (M1 WP6)
 *
 * Frozen source: SPEC-001 Method §6 (Event Sync) + I5.
 *
 * Pure function, shared client + backend. The Deno backend function
 * (base44/functions/syncShiftEvents) calls decideIngest with the set of
 * eventIds already stored server-side, persists only the accepted events,
 * and returns the EventSyncAck. The F3 fixture exercises this module
 * directly to prove retry-safety. Event origin follows the frozen schema:
 * DEVICE or BACKEND.
 *
 * Frozen rule: only accepted/already-present event IDs may advance the
 * local sync cursor. A rejected event remains in local history —
 * inspectable and retryable.
 */

import type { EventRejection, EventSyncBatch, ShiftEvent } from "../contracts/index.ts";
import { ShiftEventSchema } from "../contracts/index.ts";

export interface IngestDecision {
  accepted: ShiftEvent[];
  alreadyPresentEventIds: string[];
  rejected: EventRejection[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Partition a batch into accepted / already-present / rejected.
 *
 * - An event that fails schema validation is rejected with a reason.
 * - An eventId already in `existingEventIds` (or duplicated within the
 *   batch) is reported as already-present — never re-inserted.
 * - Everything else is accepted for persistence.
 *
 * Deterministic: output depends only on the batch contents and the
 * existing-id set, in batch order.
 */
export function decideIngest(
  batch: EventSyncBatch,
  existingEventIds: Set<string> | readonly string[]
): IngestDecision {
  const seen = new Set(existingEventIds);
  const accepted: ShiftEvent[] = [];
  const alreadyPresentEventIds: string[] = [];
  const rejected: EventRejection[] = [];

  const events = Array.isArray(batch?.events) ? batch.events : [];
  for (const raw of events) {
    const parsed = ShiftEventSchema.safeParse(raw);
    if (!parsed.success) {
      const eventId =
        isRecord(raw) && typeof raw.eventId === "string" ? raw.eventId : "unknown";
      const firstIssue = parsed.error.issues[0];
      rejected.push({
        eventId,
        reason: `schema validation failed${firstIssue ? `: ${firstIssue.path.join(".") || "(root)"} ${firstIssue.message}` : ""}`,
      });
      continue;
    }
    const event = parsed.data as ShiftEvent;
    if (seen.has(event.eventId)) {
      alreadyPresentEventIds.push(event.eventId);
      continue;
    }
    seen.add(event.eventId);
    accepted.push(event);
  }

  return { accepted, alreadyPresentEventIds, rejected };
}
