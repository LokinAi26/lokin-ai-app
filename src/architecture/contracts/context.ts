/**
 * LOKIN AI — Canonical Contracts: LiveContext
 *
 * Frozen source: SPEC-001 Method §3 (LiveContext Materialized View) plus
 * the §11 amendment adding `strategy: DriverStrategy`; §§4–5
 * (OfferContext, Recommendation record); I1.
 *
 * LiveContext represents NOW, reconstructed from events plus current
 * sensor/runtime information. It is a materialized view — the immutable
 * event log remains the source of truth.
 */

import type { ContextValue } from "./provenance.js";
import type { ApprovalRequest } from "./approval.js";
import type { AttentionState } from "./attention.js";
import type { DriverStrategy } from "./strategy.js";
import type { RuntimeHealth } from "./runtime.js";

/**
 * SPEC-001 gap: referenced but not field-defined in frozen text.
 * Minimal structural shape; refinement requires a documented delta.
 */
export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/**
 * SPEC-001 gap: referenced but not field-defined in frozen text.
 * Minimal structural shape; refinement requires a documented delta.
 */
export interface LocationRef {
  label?: string;
  geoPoint?: GeoPoint;
  placeId?: string;
}

/**
 * SPEC-001 gap: referenced but not field-defined in frozen text.
 * Minimal structural shape; refinement requires a documented delta.
 */
export interface DecisionReason {
  code: string;
  detail?: string;
}

export interface OfferContext {
  offerId: string;
  platform: ContextValue<string>;

  payout?: ContextValue<number>;
  estimatedMiles?: ContextValue<number>;
  displayedMinutes?: ContextValue<number>;

  pickup?: ContextValue<LocationRef>;
  dropoff?: ContextValue<LocationRef>;

  itemCount?: ContextValue<number>;
  expiresAt?: ContextValue<string>;

  evaluation?: OfferEvaluation;
}

export interface OfferEvaluation {
  recommendation: "ACCEPT" | "DECLINE" | "NEUTRAL";

  estimatedProfit?: ContextValue<number>;
  estimatedProfitPerHour?: ContextValue<number>;
  estimatedCost?: ContextValue<number>;
  estimatedTotalMinutes?: ContextValue<number>;

  evaluatedAt: string;
  evaluatorVersion: string;

  reasons: DecisionReason[];
}

export interface Recommendation {
  recommendationId: string;
  correlationId: string;
  offerId: string;

  recommendation: "ACCEPT" | "DECLINE" | "NEUTRAL";

  evaluatorVersion: string;
  strategyVersion: number;
  evaluatedAt: string;

  reasons: DecisionReason[];
}

/**
 * SPEC-001 gap: referenced in LiveContext but not field-defined in frozen
 * text. Minimal structural shape; refinement requires a documented delta.
 */
export interface JobContext {
  jobId: string;

  /** Extension point for the future frozen JobContext definition. */
  [key: string]: unknown;
}

export interface LiveContext {
  shift: {
    shiftId: string;
    status: "IDLE" | "ACTIVE" | "PAUSED" | "ENDING";
    startedAt?: string;
  };

  goal: {
    targetEarnings?: ContextValue<number>;
    currentEarnings: ContextValue<number>;
    remaining?: ContextValue<number>;
    targetEndTime?: ContextValue<string>;
    requiredHourlyRate?: ContextValue<number>;
    paceStatus?: ContextValue<"AHEAD" | "ON_PACE" | "BEHIND" | "UNKNOWN">;
  };

  location: {
    current?: ContextValue<GeoPoint>;
    heading?: ContextValue<number>;
    speed?: ContextValue<number>;
  };

  navigation: {
    destination?: ContextValue<GeoPoint>;
    remainingDistanceMiles?: ContextValue<number>;
    remainingDurationMinutes?: ContextValue<number>;
    routeUpdatedAt?: string;
  };

  offers: Record<string, OfferContext>;
  activeJobs: Record<string, JobContext>;

  attention: {
    state: ContextValue<AttentionState>;
    deferNonUrgentUntil?: string;
  };

  runtime: {
    health: RuntimeHealth;
    lastBackendSyncAt?: string;
    lastAIAvailableAt?: string;
  };

  pendingApprovals: ApprovalRequest[];

  strategy: DriverStrategy;

  materializedThroughVersion: number;
}
