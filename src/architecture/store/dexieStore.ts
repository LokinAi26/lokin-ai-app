/**
 * LOKIN AI — Dexie-backed OperationalStore (I2)
 *
 * PROVISIONAL DEPENDENCY (SPEC-001): Dexie 4.4.6 is contingent on the real
 * TestFlight/WKWebView device gate (M1 Scenario D). All consumers use the
 * OperationalStore interface; replacing Dexie touches only this file.
 *
 * Database: `lokin-operational`
 *   events    — primary key eventId (UUID, immutable); compound index
 *               [shiftId+sequenceNumber] for session-ordered reads
 *   manifests — primary key shiftId (one recovery manifest per shift)
 *   meta      — primary key key; tracks currentShiftId
 *
 * Atomicity: appendEventAndUpdateManifest runs inside a single Dexie
 * readwrite transaction over events+manifests+meta. Both commit or both
 * rollback — there is no state where an event exists without its manifest
 * update, or vice versa.
 */

import Dexie, { type Table } from "dexie";
import type {
  ShiftEvent,
  ShiftRecoveryManifest,
} from "../contracts/index.js";
import type { OperationalStore } from "./operationalStore.js";
import { upcastEvent } from "./upcast.js";

interface MetaRow {
  key: string;
  value: string;
}

const DB_NAME = "lokin-operational";
const CURRENT_SHIFT_KEY = "currentShiftId";

class LokinOperationalDb extends Dexie {
  events!: Table<ShiftEvent, string>;
  manifests!: Table<ShiftRecoveryManifest, string>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super(DB_NAME);
    this.version(1).stores({
      events: "eventId, shiftId, sessionId, [shiftId+sequenceNumber]",
      manifests: "shiftId",
      meta: "key",
    });
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

class DexieOperationalStore implements OperationalStore {
  private db = new LokinOperationalDb();

  async appendEventAndUpdateManifest(
    event: ShiftEvent,
    manifest: ShiftRecoveryManifest
  ): Promise<void> {
    if (event.shiftId !== manifest.shiftId) {
      throw new Error(
        `event shiftId ${event.shiftId} does not match manifest shiftId ${manifest.shiftId}`
      );
    }
    await this.db.transaction(
      "rw",
      this.db.events,
      this.db.manifests,
      this.db.meta,
      async () => {
        await this.db.events.add(event);
        await this.db.manifests.put(manifest);
        await this.db.meta.put({
          key: CURRENT_SHIFT_KEY,
          value: manifest.shiftId,
        });
      }
    );
  }

  async getShiftEvents(shiftId: string): Promise<ShiftEvent[]> {
    const rows = await this.db.events
      .where("[shiftId+sequenceNumber]")
      .between([shiftId, Dexie.minKey], [shiftId, Dexie.maxKey])
      .toArray();
    // Upcast on read: stored payloads may predate the current schema.
    // Deterministic — the same stored rows always yield the same events.
    return rows.map((row) => upcastEvent(row));
  }

  async getRecoveryManifest(): Promise<ShiftRecoveryManifest | null> {
    const current = await this.db.meta.get(CURRENT_SHIFT_KEY);
    if (!current) return null;
    const manifest = await this.db.manifests.get(current.value);
    return manifest ?? null;
  }

  async getPendingSyncEvents(limit: number): Promise<ShiftEvent[]> {
    const current = await this.db.meta.get(CURRENT_SHIFT_KEY);
    if (!current) return [];
    const rows = await this.db.events
      .where("[shiftId+sequenceNumber]")
      .between(
        [current.value, Dexie.minKey],
        [current.value, Dexie.maxKey]
      )
      .filter((event) => event.syncedAt == null)
      .limit(limit)
      .toArray();
    return rows.map((row) => upcastEvent(row));
  }

  async markEventsSynced(eventIds: string[]): Promise<void> {
    if (eventIds.length === 0) return;
    const syncedAt = nowIso();
    await this.db.events
      .where("eventId")
      .anyOf(eventIds)
      .modify({ syncedAt });
  }
}

let singleton: OperationalStore | null = null;

export function getOperationalStore(): OperationalStore {
  if (!singleton) {
    singleton = new DexieOperationalStore();
  }
  return singleton;
}

export { DexieOperationalStore };
