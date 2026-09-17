export const AGENT_CIRCUIT_BREAKER_VERSION = 'LOKIN_AGENT_CIRCUIT_BREAKER_V1';

export const AGENT_SESSION_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  FROZEN: 'FROZEN',
  REVOKED: 'REVOKED',
  COMPLETED: 'COMPLETED',
  EXPIRED: 'EXPIRED',
});

const HARD_FREEZE_CAPABILITIES = new Set([
  'agent.privilege.escalate',
  'agent.persistent_instructions.write_unvalidated',
  'agent.external_communication.unexpected',
]);

const text = (value, max = 300) => String(value ?? '').trim().slice(0, max);
const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function defaultAgentBudgets(input = {}) {
  return Object.freeze({
    max_calls: Math.max(1, Math.min(500, Math.floor(num(input.max_calls, 80)))),
    max_denials: Math.max(1, Math.min(25, Math.floor(num(input.max_denials, 5)))),
    max_writes: Math.max(0, Math.min(100, Math.floor(num(input.max_writes, 20)))),
    max_external_communications: Math.max(0, Math.min(100, Math.floor(num(input.max_external_communications, 20)))),
    max_credential_accesses: Math.max(0, Math.min(10, Math.floor(num(input.max_credential_accesses, 0)))),
    max_duration_ms: Math.max(60_000, Math.min(24 * 60 * 60 * 1000, Math.floor(num(input.max_duration_ms, 60 * 60 * 1000)))),
  });
}

export function summarizeAgentEvents(events = []) {
  const counters = {
    calls: 0,
    denials: 0,
    writes: 0,
    external_communications: 0,
    credential_accesses: 0,
    privilege_escalations: 0,
    persistent_instruction_writes: 0,
  };
  for (const event of events || []) {
    if (event?.event_type === 'ACTION_REQUESTED') counters.calls += 1;
    if (event?.decision === 'DENY' || event?.decision === 'FREEZE') counters.denials += 1;
    if (event?.metadata?.is_write === true) counters.writes += 1;
    if (event?.metadata?.external_communication === true) counters.external_communications += 1;
    if (event?.metadata?.credential_access === true) counters.credential_accesses += 1;
    if (event?.metadata?.privilege_escalation === true) counters.privilege_escalations += 1;
    if (event?.metadata?.persistent_instruction_write === true) counters.persistent_instruction_writes += 1;
  }
  return counters;
}

export function evaluateAgentSession(session = {}, events = [], request = {}, capabilityDecision = {}) {
  const now = Number.isFinite(Number(request.now_ms)) ? Number(request.now_ms) : Date.now();
  const status = text(session.status, 30) || AGENT_SESSION_STATUS.ACTIVE;
  if (status !== AGENT_SESSION_STATUS.ACTIVE) {
    return { allowed: false, decision: 'DENY', freeze: false, reason: `SESSION_${status}`, status, version: AGENT_CIRCUIT_BREAKER_VERSION };
  }

  const created = Date.parse(String(session.created_at || ''));
  const budgets = defaultAgentBudgets(session.budgets || {});
  if (!Number.isFinite(created) || now - created > budgets.max_duration_ms) {
    return { allowed: false, decision: 'FREEZE', freeze: true, reason: 'SESSION_EXPIRED', status: AGENT_SESSION_STATUS.FROZEN, version: AGENT_CIRCUIT_BREAKER_VERSION };
  }

  const capability = text(request.capability, 180);
  const flags = {
    is_write: request.is_write === true,
    external_communication: request.external_communication === true,
    credential_access: capability === 'credential.access' || request.credential_access === true,
    privilege_escalation: capability === 'agent.privilege.escalate' || request.privilege_escalation === true,
    persistent_instruction_write: capability.startsWith('agent.persistent_instructions.write') || request.persistent_instruction_write === true,
  };

  if (HARD_FREEZE_CAPABILITIES.has(capability) || flags.privilege_escalation) {
    return { allowed: false, decision: 'FREEZE', freeze: true, reason: 'PRIVILEGE_ESCALATION_ATTEMPT', status: AGENT_SESSION_STATUS.FROZEN, flags, version: AGENT_CIRCUIT_BREAKER_VERSION };
  }
  if (flags.persistent_instruction_write && request.instruction_validation_passed !== true) {
    return { allowed: false, decision: 'FREEZE', freeze: true, reason: 'UNVALIDATED_PERSISTENT_INSTRUCTION_WRITE', status: AGENT_SESSION_STATUS.FROZEN, flags, version: AGENT_CIRCUIT_BREAKER_VERSION };
  }
  if (request.unexpected_external_communication === true) {
    return { allowed: false, decision: 'FREEZE', freeze: true, reason: 'UNEXPECTED_EXTERNAL_COMMUNICATION', status: AGENT_SESSION_STATUS.FROZEN, flags: { ...flags, external_communication: true }, version: AGENT_CIRCUIT_BREAKER_VERSION };
  }

  const current = summarizeAgentEvents(events);
  const projected = {
    calls: current.calls + 1,
    denials: current.denials + (capabilityDecision.allowed === true ? 0 : 1),
    writes: current.writes + (flags.is_write ? 1 : 0),
    external_communications: current.external_communications + (flags.external_communication ? 1 : 0),
    credential_accesses: current.credential_accesses + (flags.credential_access ? 1 : 0),
  };

  const limitReason = projected.calls > budgets.max_calls ? 'CALL_BUDGET_EXCEEDED'
    : projected.denials > budgets.max_denials ? 'DENIAL_BUDGET_EXCEEDED'
    : projected.writes > budgets.max_writes ? 'WRITE_BUDGET_EXCEEDED'
    : projected.external_communications > budgets.max_external_communications ? 'EXTERNAL_COMMUNICATION_BUDGET_EXCEEDED'
    : projected.credential_accesses > budgets.max_credential_accesses ? 'CREDENTIAL_ACCESS_BUDGET_EXCEEDED'
    : '';
  if (limitReason) {
    return { allowed: false, decision: 'FREEZE', freeze: true, reason: limitReason, status: AGENT_SESSION_STATUS.FROZEN, counters: projected, budgets, flags, version: AGENT_CIRCUIT_BREAKER_VERSION };
  }

  if (capabilityDecision.allowed !== true) {
    return { allowed: false, decision: capabilityDecision.decision === 'REQUIRE_APPROVAL' ? 'REQUIRE_APPROVAL' : 'DENY', freeze: false, reason: capabilityDecision.reason || 'CAPABILITY_DENIED', status: AGENT_SESSION_STATUS.ACTIVE, counters: projected, budgets, flags, version: AGENT_CIRCUIT_BREAKER_VERSION };
  }

  return { allowed: true, decision: 'ALLOW', freeze: false, reason: 'SESSION_AND_CAPABILITY_PASS', status: AGENT_SESSION_STATUS.ACTIVE, counters: projected, budgets, flags, version: AGENT_CIRCUIT_BREAKER_VERSION };
}
