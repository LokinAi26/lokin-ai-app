// Truthful capability registry for driver-platform data sources.
// This registry describes what LOKIN may prepare for; it does not grant provider access.

export const DRIVER_PROVIDER_REGISTRY = Object.freeze({
  uber_eats: Object.freeze({
    key: "uber_eats",
    label: "Uber / Uber Eats",
    access_mode: "oauth_limited_access",
    default_status: "approval_required",
    approval_required: true,
    capabilities: Object.freeze({ profile: true, trips: true, payments: true, live_offers: false, partner_orders: false }),
    disclosure: "Uber Driver API access is limited and requires provider approval plus driver OAuth authorization. LOKIN prepares profile, trip, and payment synchronization; this adapter does not claim a live offer-acceptance feed.",
  }),
  doordash: Object.freeze({
    key: "doordash",
    label: "DoorDash",
    access_mode: "marketplace_partner",
    default_status: "approval_required",
    approval_required: true,
    capabilities: Object.freeze({ profile: false, trips: false, payments: false, live_offers: false, partner_orders: true }),
    disclosure: "DoorDash Marketplace access is partner-controlled and merchant/order oriented. LOKIN does not claim access to a public live Dasher offer feed.",
  }),
  instacart: Object.freeze({
    key: "instacart",
    label: "Instacart",
    access_mode: "connect_partner",
    default_status: "approval_required",
    approval_required: true,
    capabilities: Object.freeze({ profile: false, trips: false, payments: false, live_offers: false, partner_orders: true }),
    disclosure: "Instacart Connect is a retailer/fulfillment integration surface. LOKIN does not claim access to a public live Shopper batch stream.",
  }),
  spark: Object.freeze({
    key: "spark",
    label: "Walmart Spark",
    access_mode: "manual_until_official",
    default_status: "manual_only",
    approval_required: true,
    capabilities: Object.freeze({ profile: false, trips: false, payments: false, live_offers: false, partner_orders: false }),
    disclosure: "No public driver-offer API is configured for LOKIN. Verified user capture remains the active path until an approved official integration is available.",
  }),
  amazon_flex: Object.freeze({
    key: "amazon_flex",
    label: "Amazon Flex",
    access_mode: "manual_until_official",
    default_status: "manual_only",
    approval_required: true,
    capabilities: Object.freeze({ profile: false, trips: false, payments: false, live_offers: false, partner_orders: false }),
    disclosure: "LOKIN has no approved Amazon Flex driver-offer adapter configured. Use verified user capture until an official integration is authorized.",
  }),
  grubhub: Object.freeze({
    key: "grubhub",
    label: "Grubhub Driver",
    access_mode: "manual_until_official",
    default_status: "manual_only",
    approval_required: true,
    capabilities: Object.freeze({ profile: false, trips: false, payments: false, live_offers: false, partner_orders: false }),
    disclosure: "LOKIN has no approved Grubhub driver-offer adapter configured. Use verified user capture until an official integration is authorized.",
  }),
  shipt: Object.freeze({
    key: "shipt",
    label: "Shipt",
    access_mode: "manual_until_official",
    default_status: "manual_only",
    approval_required: true,
    capabilities: Object.freeze({ profile: false, trips: false, payments: false, live_offers: false, partner_orders: false }),
    disclosure: "LOKIN has no approved Shipt driver-offer adapter configured. Use verified user capture until an official integration is authorized.",
  }),
  roadie: Object.freeze({
    key: "roadie",
    label: "Roadie",
    access_mode: "manual_until_official",
    default_status: "manual_only",
    approval_required: true,
    capabilities: Object.freeze({ profile: false, trips: false, payments: false, live_offers: false, partner_orders: false }),
    disclosure: "LOKIN has no approved Roadie driver-offer adapter configured. Use verified user capture until an official integration is authorized.",
  }),
});

export function normalizeDriverProviderKey(value) {
  const key = String(value || "").trim().toLowerCase();
  if (key === "walmart_spark") return "spark";
  if (key === "uber" || key === "ubereats") return "uber_eats";
  return key;
}

export function getDriverProvider(key) {
  return DRIVER_PROVIDER_REGISTRY[normalizeDriverProviderKey(key)] || null;
}

export function driverProviderList() {
  return Object.values(DRIVER_PROVIDER_REGISTRY);
}

export function providerSafetyContract() {
  return Object.freeze({
    driver_confirmation_required: true,
    automatic_platform_action: false,
    automatic_acceptance: false,
    automatic_decline: false,
    gps_spoofing: false,
    platform_scraping: false,
    acceptance_bypass: false,
  });
}
