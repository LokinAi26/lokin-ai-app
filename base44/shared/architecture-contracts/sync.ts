/**
 * LOKIN AI — Canonical Contracts: Event Sync
 *
 * Frozen source: SPEC-001 Method §6 (Event Sync) + I5.
 *
 * Provenance notes:
 * - EventSyncBatch: identical in Method §6 and I5.
 * - EventSyncAck: canonical per Method §6 (acceptedEventIds /
 *   alreadyPresentEventIds / rejected). Only acknowledged event IDs advance
 *   the relevant local sync cursor. A rejected event remains visible to
 *   recovery/sync logic; rejection cannot silently remove it from local
 *   history.
 * - EventRejection: referenced but not field-defined in the Method; shape
 *   taken from frozen I5's rejected element { eventId, reason }.
 */

import type { ShiftEvent } from "./events.js";

export interface EventSyncBatch {
  shiftId: string;
  sessionId: string;

  events: ShiftEvent[];
}

export interface EventRejection {
  eventId: string;
  reason: string;
}

export interface EventSyncAck {
  acceptedEventIds: string[];
  alreadyPresentEventIds: string[];
  rejected: EventRejection[];
}
