/**
 * LOKIN AI — Event sync barrel (M1 WP6)
 */

export { decideIngest } from "./ingest.js";
export type { IngestDecision } from "./ingest.js";
export { syncPendingEvents } from "./eventSync.js";
export type { FunctionInvoker, SyncOptions, SyncReport } from "./eventSync.js";
