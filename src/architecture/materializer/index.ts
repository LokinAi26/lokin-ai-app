/**
 * LOKIN AI — Deterministic Materializer barrel (I3)
 *
 * materialize(events): the frozen I3 contract — pure, deterministic
 * event-log -> LiveContext reduction, shared by client and backend.
 */

export {
  canonicalOrder,
  applyCorrections,
  materialize,
  materializeWithEvidence,
} from "./materializer.js";
export type { CorrectionConflict, MaterializeResult } from "./materializer.js";
