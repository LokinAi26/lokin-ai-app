// LOKIN Commerce Intelligence Core — authoritative model registry.
//
// This file is the source-of-truth for NEW commerce backend work.
// Existing legacy schemas are intentionally preserved until a data migration proves
// they contain no records and no external dependencies. Do not add new writes to a
// legacy model simply because a similarly named schema exists.

export const COMMERCE_CORE_MODELS = Object.freeze({
  command: "CommerceCommand",
  audit: "CommerceAuditLog",
  webhookReceipt: "CommerceWebhookReceipt",
  deadLetter: "CommerceDeadLetter",
  orderSnapshot: "CommerceOrderSnapshot",
  productMapping: "CommerceProductMapping",
  notificationQueue: "CommerceNotificationQueue",
  securityEvent: "LokinCommerceSecurityEvent",
  registry: "LokinCommerceRegistry",
  policy: "LokinCommercePolicy",
  providerHealth: "LokinCommerceProviderHealth",
  trace: "LokinCommerceTrace",
  coreVersion: "LokinCommerceCoreVersion",
});

export const COMMERCE_CORE_VERSION = "1.0.0";

export const COMMERCE_MODEL_POLICY = Object.freeze({
  writeNewCommerceDataOnlyToCoreModels: true,
  preserveUnknownLegacyData: true,
  deleteLegacySchemasWithoutDataAudit: false,
  requireAdminRlsForOperationalModels: true,
  requireTraceIdForProviderOperations: true,
});

export function isCoreCommerceModel(name: string) {
  return Object.values(COMMERCE_CORE_MODELS).includes(name as any);
}
