/**
 * LOKIN AI — Operational Store barrel (I2)
 */

export type { OperationalStore } from "./operationalStore.js";
export { getOperationalStore, DexieOperationalStore } from "./dexieStore.js";
export { upcastEvent, EVENT_SCHEMA_VERSION } from "./upcast.js";
