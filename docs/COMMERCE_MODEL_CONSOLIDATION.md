# LOKIN Commerce Model Consolidation

## Audit result

A static dependency scan found 329 commerce-oriented entity schemas. Only `CommerceCommand` currently has direct application-code references in `src`, backend functions/shared modules, workflows, MCP config, docs, or scripts. The remaining 328 schemas are not directly referenced by the current codebase.

This does **not** mean the 328 schemas are safe to delete. They may contain persisted records, historical data, external integrations, or future migration value. The consolidation policy is therefore preserve-first and fail-closed.

## Authoritative Commerce Intelligence Core

All NEW commerce backend work should use the canonical models below rather than create more overlapping schemas:

- `CommerceCommand` — operator/admin command queue.
- `CommerceAuditLog` — authoritative administrative audit trail.
- `CommerceWebhookReceipt` — provider webhook receipt/idempotency ledger.
- `CommerceDeadLetter` — failed/unprocessable commerce events.
- `CommerceOrderSnapshot` — normalized Shopify order state.
- `CommerceProductMapping` — Shopify ↔ Printful/Printify product/variant linkage.
- `CommerceNotificationQueue` — outbound customer/admin message queue.
- `LokinCommerceSecurityEvent` — commerce security events.
- `LokinCommerceRegistry` — provider/resource registry.
- `LokinCommercePolicy` — runtime commerce policy values.
- `LokinCommerceProviderHealth` — normalized provider health state.
- `LokinCommerceTrace` — request/latency/success trace telemetry.
- `LokinCommerceCoreVersion` — singleton metadata identifying the active core contract/version.

The machine-readable registry lives at `base44/shared/commerceModelRegistry.ts`.

## Data protection status

The following core candidates were explicitly probed and currently returned no records at audit time: `CommerceCommand`, `CommerceAuditLog`, `CommerceWebhookReceipt`, `CommerceOrderSnapshot`, `CommerceProductMapping`, `CommerceNotificationQueue`, `CommerceDeadLetter`, and the accidental `CommerceAudit2` model.

Even for models with zero records, schema deletion is deferred until a complete production data audit can certify no hidden/external dependency exists. This avoids accidental loss caused by treating a source-code reference scan as a database dependency scan.

## Consolidation tiers

### Tier A — authoritative core
Use for all new writes and new backend features. The thirteen models listed above.

### Tier B — preserved legacy/data candidates
Every other commerce-oriented entity remains physically preserved. Existing records, if any, remain untouched. New code should not create new writes to these models unless a migration plan promotes that model into Tier A.

### Tier C — obvious duplicate/experimental schemas
Examples include `CommerceAudit2` and the many `LokinCommerce*State`, `*Metric`, `*Signal`, `*Counter`, `*Polish*`, and `*Evolution*` schemas. They are treated as dormant legacy models, not active architecture. They stay preserved until their record count and dependency status are proven safe for archival/removal.

## Rules going forward

1. Do not create another commerce entity when a Tier A model can represent the data.
2. Do not delete a legacy model without both a zero-record check and a dependency scan.
3. Provider events must be traceable with a LOKIN request/trace ID.
4. Sensitive operational models remain admin-RLS protected.
5. Checkout, payment, fulfillment, shipment, delivery, refund, and customer communication remain separate state transitions.
6. Failed provider events go to the dead-letter path rather than being silently discarded.
7. Webhooks must be idempotent and recorded before side effects are considered complete.
8. Shopify remains the checkout/payment authority; Printful/Printify remain fulfillment authorities; LOKIN is the orchestration/intelligence layer.

## CommerceCommand-driven Schema Guard

LOKIN Commerce Intelligence Core v1.1 adds a preserve-first schema auditor at `base44/functions/commerce-schema-auditor/entry.ts`. The Commerce Command Center now creates explicit `CommerceCommand` records for each scan batch and invokes the auditor in bounded batches of at most 25 schemas.

The generated dependency manifest at `base44/shared/commerceSchemaManifest.ts` records the current commerce schema estate and static code/backend reference evidence. Each runtime scan writes or updates one `CommerceSchemaAudit` record with record-presence evidence, dependency count, classification, recommendation, scan version, and timestamp.

Classification is fail-closed:

- `core` — authoritative model; keep.
- `dependency` — active direct reference exists; keep.
- `data` — persisted record exists; keep and migrate only after field-level verification.
- `candidate` — zero records and zero direct references; preserve for a second-pass dependency certification.
- `error` — runtime verification could not be completed; keep and investigate.

Automatic deletion is intentionally disabled. A `candidate` is **not** a deletion approval. Removal requires a second dependency scan, confirmed zero-record state, migration/backfill review, checkpoint, and explicit targeted cleanup.

## Migration strategy

Future cleanup runs in small batches through Schema Guard: inventory records for a legacy schema, map its fields to a Tier A destination, migrate records with verification, freeze new writes, observe for a stability window, then archive/remove only after a final dependency scan. Never bulk-delete the legacy model family in one operation.
