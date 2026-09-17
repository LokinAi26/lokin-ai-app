export const CAPABILITY_BROKER_VERSION = 'LOKIN_CAPABILITY_BROKER_V1';

const POLICIES = Object.freeze({
  'ai.infer': { risk: 'LOW', approval: false, scopes: ['ai:invoke'] },
  'speech.transcribe': { risk: 'MEDIUM', approval: false, scopes: ['speech:transcribe'] },
  'data.read': { risk: 'LOW', approval: false, scopes: ['data:read'] },
  'data.write': { risk: 'MEDIUM', approval: false, scopes: ['data:write'] },
  'production.preview': { risk: 'MEDIUM', approval: false, scopes: ['production:preview'] },
  'production.master.modify': { risk: 'HIGH', approval: true, scopes: ['production:master:write'] },
  'production.publish': { risk: 'HIGH', approval: true, scopes: ['production:publish'] },
  'infrastructure.modify': { risk: 'HIGH', approval: true, scopes: ['infrastructure:write'] },
  'credential.access': { risk: 'HIGH', approval: true, scopes: ['credential:use'] },
  'agent.external_communication': { risk: 'MEDIUM', approval: false, scopes: ['external:communicate'] },
  'agent.persistent_instructions.write': { risk: 'HIGH', approval: true, scopes: ['agent:instructions:write'] },
  'agent.privilege.escalate': { risk: 'HIGH', approval: true, scopes: ['agent:privilege:escalate'] },
  'asset.delete': { risk: 'HIGH', approval: true, scopes: ['asset:delete'] },
});

const text = (value, max = 300) => String(value || '').trim().slice(0, max);

export function authorizeCapability(request = {}, actor = {}) {
  const capability = text(request.capability);
  const policy = POLICIES[capability];
  if (!policy) return { allowed: false, decision: 'DENY', reason: 'UNKNOWN_CAPABILITY', capability, version: CAPABILITY_BROKER_VERSION };
  const actorScopes = new Set(Array.isArray(actor.scopes) ? actor.scopes.map(String) : []);
  const missing = policy.scopes.filter((scope) => !actorScopes.has(scope) && actor.service !== true);
  if (missing.length) return { allowed: false, decision: 'DENY', reason: 'MISSING_SCOPE', missing_scopes: missing, capability, risk: policy.risk, version: CAPABILITY_BROKER_VERSION };
  if (request.target_locked === true && capability !== 'data.read' && capability !== 'production.preview') {
    return { allowed: false, decision: 'DENY', reason: 'TARGET_LOCKED', capability, risk: policy.risk, version: CAPABILITY_BROKER_VERSION };
  }
  if (policy.approval && request.approval_verified !== true) {
    return { allowed: false, decision: 'REQUIRE_APPROVAL', reason: 'VERIFIED_OWNER_APPROVAL_REQUIRED', capability, risk: policy.risk, version: CAPABILITY_BROKER_VERSION };
  }
  return {
    allowed: true,
    decision: 'ALLOW',
    reason: 'POLICY_PASS',
    capability,
    risk: policy.risk,
    granted_scopes: policy.scopes,
    constraints: { idempotency_required: policy.risk !== 'LOW', audit_required: true, sandbox_required: policy.risk === 'HIGH' },
    version: CAPABILITY_BROKER_VERSION,
  };
}

export function listCapabilityPolicies() {
  return Object.entries(POLICIES).map(([capability, policy]) => ({ capability, ...policy }));
}
