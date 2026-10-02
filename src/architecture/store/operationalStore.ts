/**
 * LOKIN AI — Operational Store interface (I2)
 *
 * Frozen source: SPEC-001 I1–I2. The event append and recovery-manifest
 * update MUST share one IndexedDB transaction (both commit or both
 * rollback). Consumers code against this interface, never against Dexie
 * directly — the Dexie dependency is provisional per the SPEC-001 device
 * gate and is replaceable behind this interface.
 */

import type { ShiftEvent, ShiftRecoveryManifest } from "../contracts/index.js";

export interface OperationalStore {
  appendEventAndUpdateManifest(
    event: ShiftEvent,
    manifest: ShiftRecoveryManifest
  ): Promise<void>;

  getShiftEvents(shiftId: string): Promise<ShiftEvent[]>;
  getRecoveryManifest(): Promise<ShiftRecoveryManifest | null>;

  getPendingSyncEvents(limit: number): Promise<ShiftEvent[]>;
  markEventsSynced(eventIds: string[]): Promise<void>;
}
