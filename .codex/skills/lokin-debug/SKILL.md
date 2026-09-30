---
name: lokin-debug
description: Root-cause protocol for LOKIN AI defects. Use for any bug investigation — observe, reproduce, trace, falsify hypotheses, then patch the smallest safe change. Invoke with $lokin-debug or when a task names a defect.
---

# $lokin-debug — Root-Cause Protocol

You are debugging the LOKIN AI production application. Do not patch symptoms before identifying the responsible execution path.

## Protocol

1. **OBSERVE** — Read the report. Record expected vs. actual behavior in the reporter's words.
2. **REPRODUCE** — Establish current behavior from evidence. Build a reproducer first when practical. For stateful/session bugs, reproduce against the restart matrix (see `$lokin-session-audit`).
3. **TRACE** — Identify the execution path: entry point, state ownership, services, APIs, persistence, navigation, native dependencies. Read the actual code.
4. **FORM HYPOTHESES** — State candidate causes, each with evidence for and against.
5. **FALSIFY** — Eliminate hypotheses against evidence (logs, state transitions, network behavior, test runs). The first guessed explanation does not automatically become the patch.
6. **IDENTIFY ROOT CAUSE** — Exact technical reason.
7. **PATCH** — Smallest safe correction, inside an explicit change boundary (files expected to change / files that must not). Stop and explain before expanding scope.
8. **REGRESSION TEST** — Add or update a test that fails without the patch.
9. **REVIEW** — Re-inspect the diff for unrelated changes, swallowed exceptions, fake data, and secret exposure.

## Rules

- Prefer existing abstractions, design systems, state-management patterns, and API clients. Avoid speculative architecture, duplicate services, silent fallbacks, and hidden state mutations.
- Never invent earnings, stops, offers, route data, provider data, or user activity to make a bug reproducible.
- Errors must resolve into an actionable state — never an indefinite spinner.
- Never claim a command, test, or build succeeded unless it actually ran.

## Report format

- **ROOT CAUSE:** exact technical reason.
- **EVIDENCE:** files, functions, logs, state transitions, network behavior, test evidence.
- **IMPACT:** what behavior the defect affects.
- **PATCH:** smallest safe correction.
- **REGRESSION PROTECTION:** tests or assertions preventing recurrence.
- **REMAINING RISKS:** only unresolved issues.
- **RECOMMENDED NEXT ACTION:** one highest-leverage follow-up.
