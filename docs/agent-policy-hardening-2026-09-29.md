# Agent policy hardening — 2026-09-29

Implemented in LOKIN AI only.

- Audit/session lookup errors propagate; truncated audit history blocks authorization.
- Non-active, expired, future-dated and unknown sessions fail closed.
- Repeated request IDs return a non-executable conflict, including previously allowed requests.
- Write and external-communication flags are derived from known capabilities.
- Counters count request flags once, and decision denials once.
- AgentExecutionSession and AgentExecutionEvent schemas deny direct client create/update/delete. Backend owner-checked service-role paths remain available.
- New sessions accept authorized_targets: [{ capability, target_type, target_id }]. Actions require an exact match. Existing sessions without scopes must be replaced.
- summarize_task_costs accepts entries [{entry_id,category,amount_usd}] and successful_tasks. Categories: inference, cpu, maps, storage, database, external_api, network. Missing categories remain unknown; explicit zero is permitted when reported. Duplicate entries and invalid amounts fail validation.
- Cost summaries are caller-reported estimates, not billing evidence, and are not persisted as a billing ledger.

Validation: mocked real-handler regression tests, pure policy/cost tests, lint and backend bundling passed. Live RLS authorization and external executors were not exercised.

Remaining deployment requirements:
- Policy decisions are advisory preflight, not execution permits. No distributed serialization is claimed.
- Trusted executor must enforce atomic/single-flight admission, exact targets and session revalidation before side effects.
- Network egress firewall, credential isolation, independent monitoring, verified billing ingestion and OpenShell integration are not implemented by this patch.
- Current model evaluation endpoint differs from the September 7 checkpoint; evaluationSafety.js is absent. Prior evaluation hardening must be reconciled in a subsequent focused change.
- No customer UI, driver work session, navigation, production master or paid provider operation was changed.
