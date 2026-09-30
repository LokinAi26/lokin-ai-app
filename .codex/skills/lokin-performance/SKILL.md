---
name: lokin-performance
description: Performance review for LOKIN AI. Use for GPS, map rendering, realtime state, route optimization, large lists, and network-heavy features. Baseline before optimizing; no claimed win without measurement.
---

# $lokin-performance — Performance Review

## Rule zero

Establish evidence before optimization. Do not claim a performance improvement without measurement when measurement is reasonably available.

## Baseline

Before changing anything, measure the current state with the tools available: frame rate, render counts, request counts and latency, location update frequency, CPU/memory where observable. Record the numbers — the baseline is the contract the fix is judged against.

## Inspect

- Excessive or redundant renders; duplicated component state updates.
- Duplicate or overlapping network requests; un-batched calls.
- Blocking synchronous work on the interaction path.
- Polling that should be event-driven; stale intervals and listeners.
- Memory growth: unreleased listeners, growing caches, unbounded arrays.
- Unnecessary serialization / deserialization.
- Map rendering: layer count, re-render triggers, tile/asset weight.
- Location listeners: update frequency vs. what the feature actually needs.
- Cache strategy: what is cached, what invalidates, what is re-fetched.

## Verify

Re-run the baseline measurement after the change. Report before/after numbers. If measurement is not reasonably available, say so explicitly and do not claim an improvement — describe the change as a risk reduction with its reasoning.

## Rules

- Driver safety first: a "faster" map that drops position accuracy or reroutes late is a regression, not an optimization.
- Prefer removing work over making work faster: fewer requests, fewer renders, fewer listeners.
