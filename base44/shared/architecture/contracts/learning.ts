/**
 * LOKIN AI — Canonical Contracts: Learning Evidence & Memory Candidates
 *
 * Frozen source: SPEC-001 Method §§12–14 (Recency-Weighted Evidence,
 * Memory Candidate lifecycle); I1.
 *
 * Learning changes strategy only through the defined promotion path.
 * Learned observations cannot silently become strategy; explicit driver
 * instructions become strategy immediately and persist until
 * changed/revoked.
 */

export interface LearningEvidence {
  evidenceId: string;

  driverId: string;
  shiftId: string;
  correlationId: string;

  attribute: {
    type: "MERCHANT" | "ZONE" | "PLATFORM" | "OFFER_PATTERN";
    value: string;
  };

  driverAction: "ACCEPT" | "DECLINE";

  evaluationContext:
    | {
        status: "EVALUATED";
        classification: "ACCEPT" | "DECLINE" | "CONDITIONAL";
        strategyVersion: number;
        evaluatorVersion: string;
        scenarioCleared?: boolean;
      }
    | {
        status: "UNEVALUATED";
        reason: string;
      };

  evidenceDirection:
    | "POSITIVE_PREFERENCE"
    | "NEGATIVE_PREFERENCE"
    | "STRATEGY_MISMATCH"
    | "NONE";

  weight: number;

  sourceEventIds: string[];
  createdAt: string;
}

export interface MemoryCandidate {
  candidateId: string;

  hypothesis: string;

  level: "ANNOTATION" | "BEHAVIOR";

  provenance: "ESTIMATED_MODELED";

  confidence: number;

  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];

  alternativeHypotheses?: string[];

  learningPolicyVersion: string;

  status:
    | "ACCUMULATING"
    | "ELIGIBLE_FOR_PROMOTION"
    | "PROMOTED"
    | "REJECTED"
    | "REVOKED";
}
