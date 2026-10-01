/**
 * LOKIN AI — Observational seams barrel (M1 WP5, WP8)
 */

export {
  observeLockIn,
  observeRelaunch,
  shiftIdFor,
  newEventId,
  getRuntimeManifestHash,
} from "./lockInSeam.js";
export type {
  LockInObservation,
  RelaunchOutcome,
  RelaunchReport,
} from "./lockInSeam.js";
export { observeShiftEnd, observeGoalSet, appendObservationalEvent } from "./dualWrite.js";
export type { DualWriteObservation } from "./dualWrite.js";
export { considerBackendSnapshot } from "./snapshotGuard.js";
export type { BackendShiftSnapshot, SnapshotDecision } from "./snapshotGuard.js";
