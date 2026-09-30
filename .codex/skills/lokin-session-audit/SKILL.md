---
name: lokin-session-audit
description: Audit LOKIN driver work-session state. Use for session persistence, restart recovery, pause/resume, and duplicate-session bugs. Runs the mandatory state-transition matrix.
---

# $lokin-session-audit — Session State Audit

## Invariants

- `active_session_count <= 1` — a driver may never have duplicate active sessions.
- Session state must survive refresh, route navigation, backgrounding, force-close, and application reopen.
- Canonical states: `inactive` → `active` → `paused` → `active` → `inactive`. Break state is distinct from paused work state unless explicitly modeled otherwise.

## Required transition tests

```
INACTIVE  → START WORK → ACTIVE
ACTIVE    → PAUSE      → PAUSED
PAUSED    → RESUME     → ACTIVE
ACTIVE / PAUSED → TAP OUT → INACTIVE
```

## Required restart matrix

```
ACTIVE   → terminate application → reopen → ACTIVE
PAUSED   → terminate application → reopen → PAUSED
INACTIVE → terminate application → reopen → INACTIVE
```

At every stage, confirm no duplicate session exists.

## Procedure

1. Locate the session state machine, its persistence layer, and its recovery path on launch.
2. Map every transition above to the code that performs it. Note where state is written, when it is flushed, and what recovery does with a partially written state.
3. Execute (or simulate with evidence) each transition and each restart row. Record the observed state after reopen, from actual behavior, not from reading the code's intent.
4. For any failure: report with `$lokin-debug` — root cause, evidence, impact, patch, regression protection.

## Rules

- Never fabricate work sessions, earnings, or activity to fill gaps in the matrix.
- Destructive transitions (Tap Out) require intentional handling — no accidental session loss on reopen.
- Persistence failures must surface an actionable error state, never silent data loss.
