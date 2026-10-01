/**
 * LOKIN AI — Canonical Contracts: Attention
 *
 * Frozen source: SPEC-001 Method (Voice, Attention & Safety Controller),
 * I1. UNKNOWN is not safe: it suppresses/defers non-urgent proactive
 * speech rather than being treated as SAFE_TO_SPEAK.
 */

export type AttentionState =
  | "SAFE_TO_SPEAK"
  | "LIMITED"
  | "HIGH_ATTENTION"
  | "UNKNOWN";
