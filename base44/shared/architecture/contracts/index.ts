/**
 * LOKIN AI — Canonical Contracts (barrel)
 *
 * Frozen source: SPEC-001 I1. Single shared contracts module consumed by
 * the Vite client and Base44 backend (via scripts/sync-architecture.mjs).
 * No component may create its own incompatible representation of these concepts.
 */

export * from "./provenance.ts";
export * from "./events.ts";
export * from "./context.ts";
export * from "./strategy.ts";
export * from "./attention.ts";
export * from "./runtime.ts";
export * from "./sync.ts";
export * from "./approval.ts";
export * from "./learning.ts";
export * from "./recap.ts";
export * from "./schemas.ts";
