import assert from 'node:assert/strict';
import fs from 'node:fs';
import { authorizeCapability } from '../base44/shared/capabilityBroker.js';
import { defaultAgentBudgets, evaluateAgentSession } from '../base44/shared/agentCircuitBreaker.js';
import { normalizeOffer, pruneNulls } from '../base44/shared/offerNormalizer.js';
import { authorizePhysicalCapability } from '../base44/shared/physicalCapabilityBroker.js';

const created = new Date().toISOString();
const session = {
  status: 'ACTIVE',
  created_at: created,
  budgets: defaultAgentBudgets({ max_calls: 3, max_denials: 1, max_writes: 1, max_external_communications: 1, max_credential_accesses: 0, max_duration_ms: 3600000 }),
};

const readAllowed = authorizeCapability({ capability: 'data.read' }, { scopes: ['data:read'] });
assert.equal(evaluateAgentSession(session, [], { capability: 'data.read' }, readAllowed).allowed, true);

const twoPriorCalls = [
  { event_type: 'ACTION_REQUESTED', decision: 'INFO', metadata: {} },
  { event_type: 'ACTION_REQUESTED', decision: 'INFO', metadata: {} },
];
const finalAllowed = evaluateAgentSession(session, twoPriorCalls, { capability: 'data.read' }, readAllowed);
assert.equal(finalAllowed.allowed, true, 'third call must be within max_calls=3');
const threePriorCalls = [...twoPriorCalls, { event_type: 'ACTION_REQUESTED', decision: 'INFO', metadata: {} }];
const overCallBudget = evaluateAgentSession(session, threePriorCalls, { capability: 'data.read' }, readAllowed);
assert.equal(overCallBudget.decision, 'FREEZE');
assert.equal(overCallBudget.reason, 'CALL_BUDGET_EXCEEDED');

const privilege = evaluateAgentSession(session, [], { capability: 'agent.privilege.escalate' }, { allowed: false, decision: 'REQUIRE_APPROVAL', reason: 'VERIFIED_OWNER_APPROVAL_REQUIRED' });
assert.equal(privilege.decision, 'FREEZE');
assert.equal(privilege.reason, 'PRIVILEGE_ESCALATION_ATTEMPT');

const instructionWrite = evaluateAgentSession(session, [], { capability: 'agent.persistent_instructions.write', persistent_instruction_write: true, instruction_validation_passed: false }, { allowed: false, decision: 'REQUIRE_APPROVAL', reason: 'VERIFIED_OWNER_APPROVAL_REQUIRED' });
assert.equal(instructionWrite.decision, 'FREEZE');
assert.equal(instructionWrite.reason, 'UNVALIDATED_PERSISTENT_INSTRUCTION_WRITE');

const unexpectedExternal = evaluateAgentSession(session, [], { capability: 'agent.external_communication', unexpected_external_communication: true }, { allowed: true, decision: 'ALLOW' });
assert.equal(unexpectedExternal.decision, 'FREEZE');
assert.equal(unexpectedExternal.reason, 'UNEXPECTED_EXTERNAL_COMMUNICATION');

const incomplete = normalizeOffer({
  id: 'offer-incomplete', platform: 'spark', merchant: 'Store', pickup_address: 'A', source_type: 'user_entered', verification_status: 'unverified', captured_at: created,
}, { owner_user_id: 'u1' });
assert.equal(incomplete.economics.gross, null);
assert.equal(incomplete.economics.expected_net, null);
assert.equal(incomplete.economics.expected_net_per_hour, null);
assert.equal(incomplete.route.offer_miles, null);
assert.ok(incomplete.confidence < 0.7, 'incomplete unverified offer should have low confidence');

const complete = normalizeOffer({
  id: 'offer-complete', platform: 'uber_eats', merchant: 'Store', payout: 20, tip: 5, miles: 10, est_minutes: 30,
  pickup_address: 'A', dropoff_address: 'B', source_type: 'official_api', verification_status: 'platform_verified', items_count: 4, captured_at: created,
}, { owner_user_id: 'u1', operator_type: 'AUTONOMOUS', deadhead_miles: 2, operating_cost_per_mile: 0.5, daily_goal: 100, current_earnings: 20, route_compatibility: 0.8 });
assert.equal(complete.operator_type, 'AUTONOMOUS');
assert.equal(complete.route.total_miles, 12);
assert.equal(complete.economics.gross, 25);
assert.equal(complete.economics.estimated_expenses, 6);
assert.equal(complete.economics.expected_net, 19);
assert.equal(complete.economics.expected_net_per_hour, 38);
assert.equal(complete.economics.gross_per_mile, 2.08);
assert.equal(pruneNulls({ a: null, b: { c: null, d: 1 } }).b.d, 1);
assert.equal('a' in pruneNulls({ a: null, b: 1 }), false);

const speed = authorizePhysicalCapability({ capability: 'vision.vehicle_speed.read' }, { vehicle_moving: true, speed_mph: 35 });
assert.equal(speed.allowed, true);
const safety = authorizePhysicalCapability({ capability: 'vision.safety_system.modify' }, { vehicle_moving: false });
assert.equal(safety.allowed, false);
assert.equal(safety.reason, 'CAPABILITY_PROHIBITED');
const finance = authorizePhysicalCapability({ capability: 'vision.financial_transaction.execute' }, { vehicle_moving: false });
assert.equal(finance.decision, 'REQUIRE_CONFIRMATION');
const unlock = authorizePhysicalCapability({ capability: 'vision.vehicle.unlock' }, { vehicle_moving: false });
assert.equal(unlock.decision, 'REQUIRE_HARDWARE_AUTH');
const navMovingChange = authorizePhysicalCapability({ capability: 'vision.navigation.start', user_intent_verified: true, destination_changed: true }, { vehicle_moving: true, speed_mph: 25 });
assert.equal(navMovingChange.decision, 'REQUIRE_CONFIRMATION');
const navStable = authorizePhysicalCapability({ capability: 'vision.navigation.start', user_intent_verified: true, destination_changed: false }, { vehicle_moving: true, speed_mph: 25 });
assert.equal(navStable.allowed, true);

const policyEndpoint = fs.readFileSync(new URL('../base44/functions/lokin-policy-control/entry.ts', import.meta.url), 'utf8');
assert.match(policyEndpoint, /approval_verified:false/, 'agent path must not self-approve high-risk capability requests');
assert.match(policyEndpoint, /request_id/, 'agent authorization must support idempotency keys');
assert.match(policyEndpoint, /direct_hardware_execution:false/, 'physical policy endpoint must not directly execute hardware commands');
assert.match(policyEndpoint, /TaskObservation/, 'policy blocks must feed Task Observer');

const localIngest = fs.readFileSync(new URL('../base44/functions/ingest-local-offer/entry.ts', import.meta.url), 'utf8');
const providerIngest = fs.readFileSync(new URL('../base44/functions/ingest-authorized-provider-offer/entry.ts', import.meta.url), 'utf8');
assert.match(localIngest, /NormalizedOffer/, 'local offers must create normalized projection');
assert.match(providerIngest, /NormalizedOffer/, 'signed provider offers must create normalized projection');
assert.match(providerIngest, /OPERATOR_TYPES/, 'authorized provider offers must preserve valid operator type');

console.log(JSON.stringify({
  agent_session_breaker: 'PASS',
  persistent_instruction_guard: 'PASS',
  external_communication_guard: 'PASS',
  normalized_offer_truthfulness: 'PASS',
  operator_neutral_schema: 'PASS',
  physical_capability_policy: 'PASS',
  ingestion_projection: 'PASS',
}, null, 2));
