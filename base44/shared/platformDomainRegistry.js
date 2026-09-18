// LOKIN Platform Domain Registry v1
// Canonical service-boundary manifest for the LOKIN mobility intelligence platform.

export const LOKIN_PLATFORM_VERSION = 'LOKIN_PLATFORM_V1';

export const LOKIN_PLATFORM_DOMAINS = Object.freeze({
  driver: Object.freeze({
    key: 'driver',
    label: 'Driver Operations',
    mission: 'Own driver work state, sessions, goals, mileage, safety context, and continuity.',
    owns: Object.freeze([
      'DriverPreference',
      'DriverSession',
      'DriverContinuity',
      'DriverContextState',
      'DriverContextEvent',
      'MileageLog',
      'Earning',
    ]),
    commands: Object.freeze(['lock_in', 'pause', 'resume', 'tap_out']),
    depends_on: Object.freeze(['control', 'intelligence']),
  }),

  navigation: Object.freeze({
    key: 'navigation',
    label: 'Navigation & Route Intelligence',
    mission: 'Own map rendering, route optimization, road matching, sensor fusion, rerouting, telemetry, and navigation quality.',
    owns: Object.freeze([
      'NavigationSessionV2',
      'NavigationTelemetryBatch',
      'NavigationQualityEvent',
      'NavigationRerouteDecision',
      'NavigationFusionPolicy',
      'NavigationDriftMetric',
      'NavigationRecoveryEvent',
      'NavigationDeviceProfile',
    ]),
    commands: Object.freeze(['open_route', 'optimize_route', 'start_navigation', 'recenter']),
    depends_on: Object.freeze(['control', 'intelligence', 'native']),
  }),

  intelligence: Object.freeze({
    key: 'intelligence',
    label: 'LOKIN Intelligence',
    mission: 'Own Ask LOKIN, recommendation policy, LOKIN Seal, learning, model routing, outcome learning, and evidence confidence.',
    owns: Object.freeze([
      'SealDecision',
      'SealFeedback',
      'LokinLearningEvent',
      'LokinLearningProfile',
      'LokinLearningMemory',
      'LokinOutcomeLearning',
      'CopilotEvent',
      'CopilotRecommendation',
      'AIModelEvaluation',
    ]),
    commands: Object.freeze(['ask', 'evaluate_offer', 'recommend', 'explain']),
    depends_on: Object.freeze(['control']),
  }),

  providers: Object.freeze({
    key: 'providers',
    label: 'Provider & Integration Fabric',
    mission: 'Normalize approved external driver, merchant, delivery, and platform data into LOKIN without fabricating provider capabilities.',
    owns: Object.freeze([
      'DriverPlatformConnection',
      'DriverPlatformActivity',
      'DriverOAuthCredential',
      'Offer',
      'GigTask',
      'MerchantOrder',
      'IntegrationHealth',
      'LokinIntegrationState',
      'LokinIntegrationAudit',
    ]),
    commands: Object.freeze(['connect_provider', 'sync_provider', 'ingest_offer', 'disconnect_provider']),
    depends_on: Object.freeze(['control']),
  }),

  commerce: Object.freeze({
    key: 'commerce',
    label: 'Commerce & Oasis',
    mission: 'Own LOKIN Commerce, storefront orchestration, fulfillment, product intelligence, Oasis design/production, and provider-neutral commerce workflows.',
    owns: Object.freeze([
      'LokinCommerceRegistry',
      'LokinCommerceOrderMetric',
      'LokinCommerceDecision',
      'LokinCommerceSystemEvent',
      'OasisProject',
      'OasisDesignAsset',
      'OasisProductionJob',
      'OasisApproval',
      'OasisAssetLineage',
    ]),
    commands: Object.freeze(['commerce_status', 'create_product', 'produce_asset', 'fulfill_order']),
    depends_on: Object.freeze(['control', 'intelligence', 'providers']),
  }),

  native: Object.freeze({
    key: 'native',
    label: 'Native Runtime & LOKIN Vision',
    mission: 'Own iOS/Android native packaging, location bridges, sensor fusion runtime, App Intents, universal links, and LOKIN Vision XR interfaces.',
    owns: Object.freeze([
      'ProductionNativeConfig',
      'NavigationNativeBuildStatus',
      'LokinVisionTelemetry',
    ]),
    commands: Object.freeze(['native_location', 'native_intent', 'vision_hud', 'deep_link']),
    depends_on: Object.freeze(['control']),
  }),

  control: Object.freeze({
    key: 'control',
    label: 'Unified Control Plane',
    mission: 'Own canonical state, policy, capabilities, auditability, idempotency, checkpoints, platform health, and cross-domain orchestration.',
    owns: Object.freeze([
      'LokinControlState',
      'LokinControlEvent',
      'LokinCommandRun',
      'CapabilityDecision',
      'SystemHealthEvent',
      'FeatureFlag',
    ]),
    commands: Object.freeze(['resolve_state', 'put_state', 'checkpoint', 'authorize_capability', 'health']),
    depends_on: Object.freeze([]),
  }),
});

export const LOKIN_PLATFORM_INVARIANTS = Object.freeze({
  provider_neutral: true,
  verified_data_only: true,
  no_fabricated_offers: true,
  driver_confirmation_required: true,
  automatic_provider_acceptance: false,
  canonical_session_state: true,
  centralized_capability_authorization: true,
  audit_high_risk_actions: true,
  idempotency_for_state_mutations: true,
  native_and_web_share_domain_contracts: true,
});

export function getPlatformDomain(key) {
  return LOKIN_PLATFORM_DOMAINS[String(key || '').trim().toLowerCase()] || null;
}

export function listPlatformDomains() {
  return Object.values(LOKIN_PLATFORM_DOMAINS);
}

export function platformTopology() {
  return listPlatformDomains().map((domain) => ({
    key: domain.key,
    label: domain.label,
    depends_on: [...domain.depends_on],
    owns_count: domain.owns.length,
    command_count: domain.commands.length,
  }));
}

export function validatePlatformTopology() {
  const keys = new Set(Object.keys(LOKIN_PLATFORM_DOMAINS));
  const errors = [];

  for (const domain of listPlatformDomains()) {
    for (const dependency of domain.depends_on) {
      if (!keys.has(dependency)) {
        errors.push(`${domain.key}:UNKNOWN_DEPENDENCY:${dependency}`);
      }
      if (dependency === domain.key) {
        errors.push(`${domain.key}:SELF_DEPENDENCY`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    version: LOKIN_PLATFORM_VERSION,
    domain_count: keys.size,
  };
}
