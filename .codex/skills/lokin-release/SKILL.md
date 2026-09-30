---
name: lokin-release
description: Release gate for LOKIN AI. Use before any TestFlight or production release. Runs the acceptance checklist; human approval remains the final gate.
---

# $lokin-release — Release Gate

## Pre-release checks

Run each check and report pass/fail with evidence. Do not mark a check passed unless it actually ran successfully.

- [ ] Acceptance criteria for the release satisfied.
- [ ] Regression tests pass; existing tests remain passing.
- [ ] Type checks and lint pass where configured.
- [ ] Build succeeds.
- [ ] Critical integration tests pass (auth, entitlements, session persistence, routing, navigation state, earnings calculations, provider normalization, permissions, account isolation).
- [ ] Security blockers resolved (see `$lokin-security-review` when the release touched a scoped area).
- [ ] No accidental secrets in the diff or logs.
- [ ] No unintended files changed — diff reviewed file by file.
- [ ] Migration impact checked (schema changes, stored-state format changes, backward compatibility).
- [ ] Native permissions checked (location, microphone, motion — declared and requested correctly).
- [ ] Error states verified: loading, success, empty, error, offline, permission denied, retry — no indefinite spinners.
- [ ] Observability sufficient for the changed areas (errors observable by engineering).
- [ ] Release notes prepared.

## Rules

- Human approval remains the final production-deployment gate. This skill reports readiness; it never authorizes a release.
- Never weaken a valid test to make the gate pass.
- Remaining risks are listed explicitly — a release with known risks is acceptable only when the risks are named and accepted by the human.
