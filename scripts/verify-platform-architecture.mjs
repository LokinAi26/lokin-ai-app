import {
  LOKIN_PLATFORM_VERSION,
  LOKIN_PLATFORM_DOMAINS,
  LOKIN_PLATFORM_INVARIANTS,
  validatePlatformTopology,
} from '../base44/shared/platformDomainRegistry.js';

const requiredDomains = ['control', 'driver', 'navigation', 'intelligence', 'providers', 'commerce', 'native'];
const errors = [];

for (const key of requiredDomains) {
  if (!LOKIN_PLATFORM_DOMAINS[key]) errors.push(`MISSING_DOMAIN:${key}`);
}

const topology = validatePlatformTopology();
if (!topology.valid) errors.push(...topology.errors);

if (LOKIN_PLATFORM_DOMAINS.control.depends_on.length !== 0) {
  errors.push('CONTROL_PLANE_MUST_BE_ROOT');
}

if (LOKIN_PLATFORM_INVARIANTS.no_fabricated_offers !== true) {
  errors.push('NO_FABRICATED_OFFERS_INVARIANT_REQUIRED');
}

if (LOKIN_PLATFORM_INVARIANTS.canonical_session_state !== true) {
  errors.push('CANONICAL_SESSION_STATE_INVARIANT_REQUIRED');
}

if (LOKIN_PLATFORM_INVARIANTS.centralized_capability_authorization !== true) {
  errors.push('CENTRAL_CAPABILITY_AUTHORIZATION_REQUIRED');
}

const ownership = new Map();
for (const domain of Object.values(LOKIN_PLATFORM_DOMAINS)) {
  for (const entity of domain.owns) {
    const owners = ownership.get(entity) || [];
    owners.push(domain.key);
    ownership.set(entity, owners);
  }
}

for (const [entity, owners] of ownership.entries()) {
  if (owners.length > 1) errors.push(`DUPLICATE_PRIMARY_OWNERSHIP:${entity}:${owners.join(',')}`);
}

if (errors.length) {
  console.error(JSON.stringify({
    ok: false,
    version: LOKIN_PLATFORM_VERSION,
    errors,
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  version: LOKIN_PLATFORM_VERSION,
  domains: requiredDomains.length,
  invariants: Object.keys(LOKIN_PLATFORM_INVARIANTS).length,
  owned_entities: ownership.size,
  topology,
}, null, 2));
