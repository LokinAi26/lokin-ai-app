---
name: lokin-security-review
description: Security review for LOKIN AI changes. Use when a change touches auth, entitlements, user data, location, voice, provider credentials, backend functions, or database access. Reports blockers, not scores.
---

# $lokin-security-review — Security Review

## Scope trigger

Activate when the change touches: authentication, authorization, payments, subscriptions/entitlements, user data, location, voice, file access, provider credentials, external integrations, backend functions, or database access.

## Review

- **Trust boundaries** — identify every boundary the change crosses (client/server, user/provider, function/database). Flag any newly introduced boundary.
- **Authorization** — enforced at the server/data layer, never trusted from the client.
- **Input validation** — validated where it enters, not just where it renders.
- **Secrets** — never hard-coded in client code; never logged. Check the diff for accidental secret inclusion.
- **Sensitive logs** — location, voice, tokens, personal, earnings, customer, and credential data must not appear in logs.
- **Account isolation** — no user's records reachable from another user's session or query.
- **Entitlement enforcement** — subscription checks enforced server-side, not UI-only.
- **Data minimization** — collect and retain only what the feature needs.
- **Abuse cases** — how could a hostile user or a compromised client misuse this change?

## Report format

- **BLOCKERS:** issues that must be fixed before release.
- **HIGH-RISK ISSUES:** serious but not release-blocking by policy.
- **NON-BLOCKING IMPROVEMENTS:** hardening worth doing.

No arbitrary security score. Every finding names the file, the problem, the impact, and the recommended correction.
