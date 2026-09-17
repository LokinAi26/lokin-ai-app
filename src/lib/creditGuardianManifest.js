// LOKIN Credit Guardian — authoritative routing classification for active Base44 function calls.
// Keep transactional/auth/security writes live. Cache read-heavy calls. Externalize AI only through secured backend providers.
export const CREDIT_GUARDIAN_MANIFEST = {
  "create-checkout": { tier: "MISSION_CRITICAL", ttl: 0, reason: "transactional checkout" },
  "driver-dispatch": { tier: "MISSION_CRITICAL", ttl: 0, reason: "live dispatch mutations/state" },
  "printful-oauth-callback": { tier: "MISSION_CRITICAL", ttl: 0, reason: "OAuth security flow" },
  "printful-oauth-connect": { tier: "MISSION_CRITICAL", ttl: 0, reason: "OAuth security flow" },
  "my-lokin-orders": { tier: "CACHE", ttl: 60000, reason: "customer order read" },
  "shopify-catalog": { tier: "CACHE", ttl: 300000, reason: "commerce catalog/order reads" },
  "printful-catalog": { tier: "CACHE", ttl: 300000, reason: "fulfillment/catalog reads" },
  "printful-tools": { tier: "CACHE", ttl: 600000, reason: "template/catalog reads" },
  "commerce-health": { tier: "CACHE", ttl: 300000, reason: "provider health telemetry" },
  "commerce-schema-auditor": { tier: "ON_DEMAND", ttl: 0, reason: "admin maintenance only" },
  "printify-catalog": { tier: "CACHE", ttl: 600000, reason: "inventory/catalog reads" },
  "printify-stock-alert": { tier: "ON_DEMAND", ttl: 0, reason: "explicit alert configuration" },
  "optimizeRoute": { tier: "ON_DEMAND", ttl: 120000, reason: "high-value route intelligence; dedupe identical requests" },
  "seal-evaluate": { tier: "ON_DEMAND", ttl: 0, reason: "deterministic, explainable driver decision with optional audit persistence" },
  "seal-feedback": { tier: "MISSION_CRITICAL", ttl: 0, reason: "driver-confirmed outcome write feeding the SEAL learning loop" },
  "hotspot-map": { tier: "CACHE", ttl: 120000, reason: "real merchant pickup geocoding; refresh at most every two minutes" },
  "ingest-local-offer": { tier: "MISSION_CRITICAL", ttl: 0, reason: "validated current-offer write with Virginia address verification" },
  "findRoadStops": { tier: "ON_DEMAND", ttl: 300000, reason: "location search" },
  "findMechanic": { tier: "ON_DEMAND", ttl: 600000, reason: "explicit local lookup" },
  "getUpcomingShifts": { tier: "CACHE", ttl: 300000, reason: "schedule read" },
  "getTicker": { tier: "CACHE", ttl: 300000, reason: "read-only ticker" },
  "scanOpportunities": { tier: "ON_DEMAND", ttl: 900000, reason: "expensive scan; user-triggered/batched" },
  "external-ai-gateway": { tier: "EXTERNAL_PROVIDER", ttl: 0, reason: "owner-controlled AI provider behind Base44 secure backend" },
  "voice-pipeline": { tier: "EXTERNAL_PROVIDER", ttl: 0, reason: "owner-controlled voice transcription + speech via secure backend" },
  "lokinAssistant": { tier: "EXTERNALIZE", ttl: 0, reason: "legacy Base44 AI path; migrate to external-ai-gateway" },
  "lokinSupport": { tier: "EXTERNALIZE", ttl: 0, reason: "support AI candidate for owner-controlled provider" },
  "aiTextAssist": { tier: "EXTERNALIZE", ttl: 0, reason: "frequent generative AI call" },
  "motivationCoach": { tier: "EXTERNALIZE", ttl: 300000, reason: "nonessential generative AI" },
  "tax-advisor": { tier: "ON_DEMAND", ttl: 0, reason: "sensitive advisory; explicit request only" },
  "locateItem": { tier: "ON_DEMAND", ttl: 300000, reason: "explicit item lookup" },
};

export function guardianPolicyFor(name) {
  return CREDIT_GUARDIAN_MANIFEST[name] || { tier: "ON_DEMAND", ttl: 0, reason: "unclassified defaults fail conservative" };
}