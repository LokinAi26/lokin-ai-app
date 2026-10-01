/**
 * LOKIN AI — Canonical Contracts: Shift Recap
 *
 * Frozen source: SPEC-001 Method §§15–16 (Shift Recap Pipeline); I1.
 *
 * Recap completeness is explicit: a partial recap leads with its caveat
 * and SHALL NOT bury incompleteness after exact-looking totals.
 */

import type { Provenance } from "./provenance.js";

export interface ShiftRecapFacts {
  shiftId: string;

  earnings: {
    total: number;
    byPlatform: Record<string, number>;
  };

  goal: {
    target: number;
    achieved: number;
    percentage: number;
  };

  offers: {
    evaluated: number;
    accepted: number;
    declined: number;
    conditional: number;
  };

  interventions: {
    spoken: number;
    deferred: number;
    expiredWhileDeferred: number;
  };

  learning: {
    candidatesCreated: string[];
    promotionCandidates: string[];
  };

  aggregatorVersion: string;
  sourceEventIds: string[];
}

export interface RecapClaim<T = unknown> {
  claimId: string;

  type: "DESCRIPTIVE" | "COUNTERFACTUAL";

  value: T;

  sourceEventIds: string[];

  evaluatorResultId?: string;

  provenance: Provenance;
}

export type RecapCompleteness =
  | "COMPLETE"
  | "PARTIAL_SYNC"
  | "RECOVERED_INCOMPLETE";

export interface ShiftRecap {
  shiftId: string;

  completeness: RecapCompleteness;

  completenessDetail?: {
    pendingEventCount?: number;
    possiblyMissingEvents: boolean;
    reasonCodes: string[];
  };

  facts: ShiftRecapFacts;
  claims: RecapClaim[];
}
