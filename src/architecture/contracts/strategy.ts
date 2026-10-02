/**
 * LOKIN AI — Canonical Contracts: Strategy & Deterministic Evaluation
 *
 * Frozen source: SPEC-001 Method §§7–9 (Strategy versioning, Deterministic
 * Economic Authority, Exact and Scenario Evaluation); I1.
 *
 * Deterministic evaluators own economics. LLMs explain and orchestrate.
 * Every historical economic evaluation records the strategy version used;
 * a later recap never evaluates historical decisions against today's
 * strategy.
 */

import type { Assumption, Provenance } from "./provenance.js";

export interface StrategyValue<T> {
  value: T;

  source:
    | "SYSTEM_DEFAULT"
    | "DRIVER_DECLARED"
    | "DRIVER_CONFIRMED_LEARNING";

  provenance:
    | "DRIVER_REPORTED"
    | "ESTIMATED_MODELED";
}

export interface StrategyInstruction {
  instructionId: string;

  type:
    | "MERCHANT"
    | "ZONE"
    | "PLATFORM"
    | "ROUTING"
    | "OFFER";

  rule: string;

  source:
    | "DRIVER_DECLARED"
    | "DRIVER_CONFIRMED_LEARNING";

  active: boolean;
}

export interface DriverStrategy {
  strategyId: string;
  driverId: string;
  version: number;

  thresholds: {
    minimumProfitPerHour?: StrategyValue<number>;
    maximumMiles?: StrategyValue<number>;
    minimumPayout?: StrategyValue<number>;
  };

  instructions: StrategyInstruction[];

  createdAt: string;
  supersedesVersion?: number;
}

export interface EvaluatorResult<T> {
  evaluator: string;
  evaluatorVersion: string;

  evaluatedAt: string;

  inputs: unknown;
  assumptions: Assumption[];

  result: T;

  provenance: Provenance;
  correlationId: string;
}

export type OfferClassification =
  | "ACCEPT"
  | "DECLINE"
  | "CONDITIONAL"
  | "INSUFFICIENT_DATA"
  | "EVALUATOR_UNAVAILABLE";
