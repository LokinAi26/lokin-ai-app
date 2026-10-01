/**
 * LOKIN AI — Client event-sync driver (M1 WP6)
 *
 * Frozen source: SPEC-001 Method §6 (Event Sync) + I5.
 *
 * Sends pending IndexedDB events to the `syncShiftEvents` backend function
 * and advances the local sync cursor ONLY for acknowledged event IDs
 * (accepted + alreadyPresent). Rejected events keep their pending state:
 * they remain inspectable in the local log and are retried on the next run.
 *
 * The function invoker is injected so this module stays decoupled from the
 * app's Base44 client; the app-level wiring lives in src/lib/eventSyncWiring.js.
 * Never throws: all failures are reported in the SyncReport.
 */

import type {
  EventRejection,
  EventSyncAck,
  EventSyncBatch,
} from "../contracts/index.js";
import { EventSyncAckSchema } from "../contracts/index.js";
import { getOperationalStore, type OperationalStore } from "../store/index.js";

export type FunctionInvoker = (
  functionName: string,
  payload: unknown
) => Promise<unknown>;

export interface SyncReport {
  attempted: number;
  acceptedEventIds: string[];
  alreadyPresentEventIds: string[];
  rejected: EventRejection[];
  /** eventIds still pending after this run (rejected + unsent on failure) */
  remainingPending: number;
  error: string | null;
}

export interface SyncOptions {
  store?: OperationalStore;
  invoke: FunctionInvoker;
  batchSize?: number;
  functionName?: string;
}

const DEFAULT_BATCH_SIZE = 50;

export async function syncPendingEvents(options: SyncOptions): Promise<SyncReport> {
  const store = options.store ?? getOperationalStore();
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const functionName = options.functionName ?? "syncShiftEvents";

  const pending = await store.getPendingSyncEvents(batchSize);
  if (pending.length === 0) {
    return {
      attempted: 0,
      acceptedEventIds: [],
      alreadyPresentEventIds: [],
      rejected: [],
      remainingPending: 0,
      error: null,
    };
  }

  const first = pending[0];
  const batch: EventSyncBatch = {
    shiftId: first.shiftId,
    sessionId: first.sessionId,
    events: pending,
  };

  let ack: EventSyncAck;
  try {
    const raw = await options.invoke(functionName, batch);
    const parsed = EventSyncAckSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error("backend returned a malformed sync acknowledgement");
    }
    ack = parsed.data;
  } catch (error) {
    const remaining = await store.getPendingSyncEvents(batchSize);
    return {
      attempted: pending.length,
      acceptedEventIds: [],
      alreadyPresentEventIds: [],
      rejected: [],
      remainingPending: remaining.length,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  // Frozen I5 rule: only acknowledged IDs advance the cursor.
  const acknowledged = new Set([
    ...ack.acceptedEventIds,
    ...ack.alreadyPresentEventIds,
  ]);
  const pendingIds = new Set(pending.map((e) => e.eventId));
  const toMark = [...acknowledged].filter((id) => pendingIds.has(id));
  if (toMark.length > 0) {
    await store.markEventsSynced(toMark);
  }

  const remaining = await store.getPendingSyncEvents(batchSize);
  return {
    attempted: pending.length,
    acceptedEventIds: ack.acceptedEventIds,
    alreadyPresentEventIds: ack.alreadyPresentEventIds,
    rejected: ack.rejected,
    remainingPending: remaining.length,
    error: null,
  };
}
