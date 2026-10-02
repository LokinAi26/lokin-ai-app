/**
 * LOKIN AI — Canonical Contracts: Provenance
 *
 * Frozen source: SPEC-001 Method §§1–3 (Provenance model), I1.
 * This file is frozen architecture. Do not edit without a documented
 * delta against SPEC-001 (affected IDs, rationale/evidence, compatibility
 * and migration impact, verification requirements, version/manifest
 * implications).
 */

export type Provenance =
  | "VERIFIED"
  | "DRIVER_REPORTED"
  | "ESTIMATED_MODELED";

export interface ContextValue<T> {
  value: T;
  provenance: Provenance;

  observedAt: string;
  source: string;

  confidence?: number;
  staleAfterMs?: number;
}

export interface Assumption<T = unknown> {
  field: string;
  assumedValue: T;
  provenance: "ESTIMATED_MODELED";
  reason: string;
}
