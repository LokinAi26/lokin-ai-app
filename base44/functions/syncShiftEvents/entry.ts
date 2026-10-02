/**
 * syncShiftEvents — idempotent shift-event ingestion (M1 WP6).
 *
 * Frozen source: SPEC-001 Method §6 (Event Sync) + I5.
 *
 * Accepts an EventSyncBatch, validates it against the canonical zod
 * contracts (shared with the client), and partitions it with the shared
 * decideIngest() decision function:
 *   - accepted: persisted to ShiftEventRecord (service role only)
 *   - alreadyPresent: eventId already stored — acknowledged, never duplicated
 *   - rejected: failed schema validation — reported with a reason
 *
 * Returns the frozen EventSyncAck. The client advances its local sync
 * cursor only for acknowledged event IDs.
 */

import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import {
  EventSyncAckSchema,
  EventSyncBatchSchema,
} from "../../shared/architecture/contracts/schemas.ts";
import { decideIngest } from "../../shared/architecture/sync/ingest.ts";

const MAX_BATCH_EVENTS = 200;

export default async function syncShiftEvents(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const raw = await req.json().catch(() => null);
    const batchParsed = EventSyncBatchSchema.safeParse(raw);
    if (!batchParsed.success) {
      return Response.json(
        { error: "Invalid EventSyncBatch", issues: batchParsed.error.issues },
        { status: 400 }
      );
    }
    const batch = batchParsed.data;
    if (batch.events.length > MAX_BATCH_EVENTS) {
      return Response.json(
        { error: `Batch exceeds ${MAX_BATCH_EVENTS} events` },
        { status: 400 }
      );
    }

    // Driver-scoped: a batch may only carry the caller's own driver id.
    const driverId = String(user.id);
    const foreign = batch.events.find((e: any) => e.driverId && String(e.driverId) !== driverId);
    if (foreign) {
      return Response.json(
        { error: "Batch contains events for a different driver" },
        { status: 403 }
      );
    }

    const store = base44.asServiceRole.entities.ShiftEventRecord;
    const existingRows =
      (await store.filter({ shift_id: batch.shiftId }, undefined, 1000).catch(() => [])) || [];
    const existingIds = new Set(
      (Array.isArray(existingRows) ? existingRows : []).map((row: any) => String(row.event_id))
    );

    const decision = decideIngest(batch, existingIds);

    for (const event of decision.accepted) {
      await store.create({
        event_id: event.eventId,
        shift_id: event.shiftId,
        session_id: event.sessionId,
        driver_id: driverId,
        type: event.type,
        sequence_number: event.sequenceNumber,
        occurred_at: event.occurredAt,
        recorded_at: event.recordedAt,
        origin: event.origin,
        source: event.source,
        payload: event.payload ?? {},
      });
    }

    const ack = {
      acceptedEventIds: decision.accepted.map((e) => e.eventId),
      alreadyPresentEventIds: decision.alreadyPresentEventIds,
      rejected: decision.rejected,
    };
    const ackParsed = EventSyncAckSchema.safeParse(ack);
    if (!ackParsed.success) {
      return Response.json({ error: "Internal acknowledgement error" }, { status: 500 });
    }
    return Response.json(ackParsed.data);
  } catch (error) {
    console.error("syncShiftEvents failed:", error?.message || error);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
