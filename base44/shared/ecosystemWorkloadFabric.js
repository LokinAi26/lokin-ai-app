// LOKIN ECOSYSTEM QUINT ENGINE FABRIC v2.0
// A provider-agnostic workload scheduler shared by LOKIN AI, LOKIN Productions,
// LOKIN Vision, commerce, driver, and operations workloads. It does not invent
// compute capacity; it makes admission, priority, fairness, and recovery choices
// from the live capacity/health snapshot supplied by each runtime.

export const ECOSYSTEM_FABRIC_VERSION = 'LOKIN_ECOSYSTEM_QUINT_V2';

export const ECOSYSTEM_ENGINES = Object.freeze({
  pulse: Object.freeze({
    id: 'pulse',
    name: 'LOKIN Pulse',
    mission: 'Protect ultra-low-latency interactive work: navigation, voice, dispatch, Vision HUD, safety-critical user interactions.',
    reserve: 0.20,
    maxShare: 0.34,
    affinity: ['navigation', 'voice', 'dispatch', 'vision', 'realtime'],
  }),
  forge: Object.freeze({
    id: 'forge',
    name: 'LOKIN Forge',
    mission: 'Drive high-throughput compute: renders, media transforms, catalog batches, ingestion, indexing, and large background jobs.',
    reserve: 0.18,
    maxShare: 0.42,
    affinity: ['production', 'render', 'media', 'batch', 'ingestion'],
  }),
  atlas: Object.freeze({
    id: 'atlas',
    name: 'LOKIN Atlas',
    mission: 'Protect memory, canonical identity, context, references, state lineage, and continuity-sensitive decisions.',
    reserve: 0.16,
    maxShare: 0.32,
    affinity: ['memory', 'continuity', 'context', 'identity', 'reference'],
  }),
  sentinel: Object.freeze({
    id: 'sentinel',
    name: 'LOKIN Sentinel',
    mission: 'Own verification, QC, security, compliance, retries, incident recovery, and fail-closed enforcement.',
    reserve: 0.20,
    maxShare: 0.30,
    affinity: ['qc', 'verification', 'security', 'compliance', 'recovery', 'incident'],
  }),
  governor: Object.freeze({
    id: 'governor',
    name: 'LOKIN Governor',
    mission: 'Optimize cost, credits, quotas, provider capacity, backpressure, maintenance, and non-urgent scheduled work.',
    reserve: 0.16,
    maxShare: 0.36,
    affinity: ['cost', 'credits', 'capacity', 'maintenance', 'scheduled', 'commerce'],
  }),
});

const ENGINE_LIST = Object.values(ECOSYSTEM_ENGINES);
const ENGINE_IDS = new Set(ENGINE_LIST.map((e) => e.id));
const n = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, n(value)));
const clamp01 = (value) => clamp(value, 0, 1);
const lower = (value) => String(value || '').trim().toLowerCase();

function normalizeTags(workload) {
  const values = [
    workload?.type,
    workload?.domain,
    workload?.category,
    workload?.source,
    ...(Array.isArray(workload?.tags) ? workload.tags : []),
  ];
  return [...new Set(values.map(lower).filter(Boolean))];
}

function tagMatches(tags, needle) {
  const q = lower(needle);
  return tags.some((tag) => tag === q || tag.includes(q));
}

function urgencyScore(workload, nowMs) {
  const priority = clamp(workload?.priority ?? 50, 0, 100);
  const deadline = n(workload?.deadlineMs ?? workload?.deadline_ms, 0);
  if (!deadline) return priority;
  const remaining = deadline - nowMs;
  if (remaining <= 0) return Math.min(100, priority + 35);
  if (remaining <= 5_000) return Math.min(100, priority + 30);
  if (remaining <= 30_000) return Math.min(100, priority + 20);
  if (remaining <= 5 * 60_000) return Math.min(100, priority + 10);
  return priority;
}

export function normalizeWorkload(workload = {}, index = 0, nowMs = Date.now()) {
  const tags = normalizeTags(workload);
  const attempts = Math.max(0, Math.floor(n(workload.attempts ?? workload.retryCount ?? workload.retry_count, 0)));
  const priority = clamp(workload.priority ?? 50, 0, 100);
  const estimatedMs = Math.max(1, n(workload.estimatedMs ?? workload.estimated_ms, 1_000));
  const estimatedCost = Math.max(0, n(workload.estimatedCost ?? workload.estimated_cost, 0));
  const deadlineMs = n(workload.deadlineMs ?? workload.deadline_ms, 0) || null;
  const explicitEngine = lower(workload.preferredEngine ?? workload.preferred_engine);
  const realtime = workload.realtime === true || workload.latencyCritical === true || tags.some((t) => ['realtime', 'navigation', 'voice', 'dispatch', 'vision'].some((x) => t.includes(x)));
  const continuityCritical = workload.continuityCritical === true || workload.referenceLocked === true || tags.some((t) => ['continuity', 'identity', 'reference', 'memory', 'context'].some((x) => t.includes(x)));
  const qualityCritical = workload.qualityCritical === true || workload.failClosed === true || tags.some((t) => ['qc', 'verification', 'security', 'compliance'].some((x) => t.includes(x)));
  const failedBefore = attempts > 0 || workload.failedBefore === true || /fail|error|incident|recover/.test(lower(workload.status));
  const background = workload.background === true || tags.some((t) => ['batch', 'maintenance', 'scheduled', 'background'].some((x) => t.includes(x)));
  const id = String(workload.id || workload.workloadId || `workload-${nowMs}-${index}`);
  const idempotencyKey = String(workload.idempotencyKey || workload.idempotency_key || id);

  return {
    ...workload,
    id,
    idempotencyKey,
    tags,
    attempts,
    priority,
    estimatedMs,
    estimatedCost,
    deadlineMs,
    explicitEngine: ENGINE_IDS.has(explicitEngine) ? explicitEngine : null,
    realtime,
    continuityCritical,
    qualityCritical,
    failedBefore,
    background,
    urgency: urgencyScore({ priority, deadlineMs }, nowMs),
  };
}

function normalizeEngineState(snapshot = {}) {
  const loads = snapshot.engineLoad || snapshot.engine_load || {};
  const health = snapshot.engineHealth || snapshot.engine_health || {};
  const capacity = snapshot.engineCapacity || snapshot.engine_capacity || {};
  const normalized = {};

  for (const engine of ENGINE_LIST) {
    const h = health[engine.id] || {};
    const rawLoad = Math.max(0, n(loads[engine.id], 0));
    const maxConcurrency = Math.max(1, n(capacity[engine.id] ?? h.maxConcurrency ?? h.max_concurrency, 4));
    const availableSlots = Math.max(0, n(h.availableSlots ?? h.available_slots, maxConcurrency - rawLoad));
    const healthScore = clamp(h.healthScore ?? h.health_score ?? 100, 0, 100);
    const circuit = String(h.circuitState ?? h.circuit_state ?? 'CLOSED').toUpperCase();
    normalized[engine.id] = {
      load: rawLoad,
      maxConcurrency,
      availableSlots: Math.min(maxConcurrency, availableSlots),
      healthScore,
      circuit,
      latencyMs: Math.max(0, n(h.latencyMs ?? h.latency_ms, 0)),
      errorRate: clamp01(h.errorRate ?? h.error_rate ?? 0),
    };
  }
  return normalized;
}

function duplicateKeySet(snapshot = {}) {
  const raw = snapshot.recentIdempotencyKeys || snapshot.recent_idempotency_keys || snapshot.completedIdempotencyKeys || [];
  return new Set(Array.isArray(raw) ? raw.map(String) : []);
}

function affinityScore(engine, workload) {
  let score = 0;
  for (const affinity of engine.affinity) {
    if (tagMatches(workload.tags, affinity)) score += 20;
  }
  return Math.min(score, 60);
}

function baseScores(workload) {
  return {
    pulse: 20 + (workload.realtime ? 85 : 0) + (tagMatches(workload.tags, 'navigation') ? 30 : 0) + (tagMatches(workload.tags, 'voice') ? 25 : 0),
    forge: 24 + (workload.background ? 30 : 0) + (tagMatches(workload.tags, 'production') ? 70 : 0) + (tagMatches(workload.tags, 'render') ? 65 : 0) + (tagMatches(workload.tags, 'batch') ? 35 : 0),
    atlas: 22 + (workload.continuityCritical ? 90 : 0) + (tagMatches(workload.tags, 'memory') ? 45 : 0) + (tagMatches(workload.tags, 'context') ? 35 : 0),
    sentinel: 20 + (workload.qualityCritical ? 70 : 0) + (workload.failedBefore ? 100 : 0) + (workload.attempts * 25) + (tagMatches(workload.tags, 'security') ? 35 : 0),
    governor: 26 + (workload.background ? 24 : 0) + (tagMatches(workload.tags, 'commerce') ? 22 : 0) + (tagMatches(workload.tags, 'cost') ? 50 : 0) + (tagMatches(workload.tags, 'credits') ? 55 : 0),
  };
}

function hardRoute(workload) {
  if (workload.explicitEngine) return { engineId: workload.explicitEngine, reason: 'explicit_engine', failClosed: false };
  if (workload.failedBefore) return { engineId: 'sentinel', reason: 'retry_or_failed_workload', failClosed: false };
  if (workload.qualityCritical && !workload.realtime) return { engineId: 'sentinel', reason: 'fail_closed_quality_or_security', failClosed: true };
  if (workload.continuityCritical && !workload.realtime) return { engineId: 'atlas', reason: 'canonical_continuity_or_memory', failClosed: true };
  if (workload.realtime) return { engineId: 'pulse', reason: 'latency_critical', failClosed: false };
  return null;
}

function engineAvailable(state) {
  return state.circuit !== 'OPEN' && state.healthScore >= 35 && state.availableSlots > 0 && state.load < state.maxConcurrency;
}

function scoreEngine(engine, workload, state, totalLoad) {
  if (!engineAvailable(state)) return -Infinity;
  const base = baseScores(workload)[engine.id] + affinityScore(engine, workload);
  const loadShare = state.load / Math.max(1, totalLoad);
  const utilization = state.load / Math.max(1, state.maxConcurrency);
  const overShare = Math.max(0, loadShare - engine.maxShare);
  const healthBonus = state.healthScore * 0.42;
  const slotBonus = (state.availableSlots / Math.max(1, state.maxConcurrency)) * 28;
  const latencyPenalty = Math.min(25, state.latencyMs / 250);
  const reliabilityPenalty = state.errorRate * 65;
  const utilizationPenalty = utilization * 38;
  const fairnessPenalty = overShare * 140;
  const urgencyBonus = workload.urgency * (engine.id === 'pulse' ? 0.26 : 0.10);
  const costPenalty = engine.id === 'forge' ? Math.min(18, workload.estimatedCost * 0.6) : 0;
  return base + healthBonus + slotBonus + urgencyBonus - latencyPenalty - reliabilityPenalty - utilizationPenalty - fairnessPenalty - costPenalty;
}

function bestAvailableFallback(workload, states, disallow = new Set()) {
  const totalLoad = Object.values(states).reduce((sum, state) => sum + state.load, 0);
  let best = null;
  for (const engine of ENGINE_LIST) {
    if (disallow.has(engine.id)) continue;
    const state = states[engine.id];
    const score = scoreEngine(engine, workload, state, totalLoad);
    if (!best || score > best.score) best = { engine, state, score };
  }
  return best && Number.isFinite(best.score) ? best : null;
}

function leaseFor(workload, state) {
  const estimate = Math.max(1_000, workload.estimatedMs);
  const healthFactor = state.healthScore >= 85 ? 1.25 : state.healthScore >= 65 ? 1.5 : 1.9;
  return Math.round(clamp(estimate * healthFactor, 5_000, 15 * 60_000));
}

export function scheduleWorkload(workloadInput = {}, snapshot = {}, index = 0) {
  const nowMs = n(snapshot.nowMs ?? snapshot.now_ms, Date.now());
  const workload = normalizeWorkload(workloadInput, index, nowMs);
  const states = normalizeEngineState(snapshot);
  const duplicateKeys = duplicateKeySet(snapshot);

  if (duplicateKeys.has(workload.idempotencyKey)) {
    return {
      accepted: false,
      status: 'duplicate',
      workloadId: workload.id,
      idempotencyKey: workload.idempotencyKey,
      decisionVersion: ECOSYSTEM_FABRIC_VERSION,
      reason: 'idempotency_key_already_completed',
    };
  }

  const hard = hardRoute(workload);
  if (hard) {
    const preferred = ECOSYSTEM_ENGINES[hard.engineId];
    const state = states[hard.engineId];
    if (preferred && engineAvailable(state)) {
      return {
        accepted: true,
        status: 'admitted',
        workloadId: workload.id,
        idempotencyKey: workload.idempotencyKey,
        engineId: preferred.id,
        engineName: preferred.name,
        score: 1000,
        reason: hard.reason,
        leaseMs: leaseFor(workload, state),
        decisionVersion: ECOSYSTEM_FABRIC_VERSION,
      };
    }
    if (hard.failClosed) {
      return {
        accepted: false,
        status: 'deferred',
        workloadId: workload.id,
        idempotencyKey: workload.idempotencyKey,
        reason: `${hard.reason}_protected_engine_unavailable`,
        retryAfterMs: Math.round(clamp(1_500 + state.load * 750 + workload.attempts * 1_500, 1_500, 60_000)),
        decisionVersion: ECOSYSTEM_FABRIC_VERSION,
      };
    }
    const fallback = bestAvailableFallback(workload, states, new Set([hard.engineId]));
    if (fallback) {
      return {
        accepted: true,
        status: 'admitted_failover',
        workloadId: workload.id,
        idempotencyKey: workload.idempotencyKey,
        engineId: fallback.engine.id,
        engineName: fallback.engine.name,
        score: Number(fallback.score.toFixed(3)),
        reason: `${hard.reason}_primary_unavailable_failover`,
        leaseMs: leaseFor(workload, fallback.state),
        decisionVersion: ECOSYSTEM_FABRIC_VERSION,
      };
    }
  } else {
    const best = bestAvailableFallback(workload, states);
    if (best) {
      return {
        accepted: true,
        status: 'admitted',
        workloadId: workload.id,
        idempotencyKey: workload.idempotencyKey,
        engineId: best.engine.id,
        engineName: best.engine.name,
        score: Number(best.score.toFixed(3)),
        reason: 'dynamic_health_capacity_fairness_balance',
        leaseMs: leaseFor(workload, best.state),
        decisionVersion: ECOSYSTEM_FABRIC_VERSION,
      };
    }
  }

  const minLoad = Math.min(...Object.values(states).map((s) => s.load));
  return {
    accepted: false,
    status: 'deferred',
    workloadId: workload.id,
    idempotencyKey: workload.idempotencyKey,
    reason: 'all_engines_saturated_unhealthy_or_circuit_open',
    retryAfterMs: Math.round(clamp(1_500 + minLoad * 750 + workload.attempts * 1_500, 1_500, 60_000)),
    decisionVersion: ECOSYSTEM_FABRIC_VERSION,
  };
}

export function balanceWorkloads(workloads = [], snapshot = {}) {
  const nowMs = n(snapshot.nowMs ?? snapshot.now_ms, Date.now());
  const states = normalizeEngineState(snapshot);
  const sorted = (Array.isArray(workloads) ? workloads : [])
    .map((item, index) => ({ item, index, normalized: normalizeWorkload(item, index, nowMs) }))
    .sort((a, b) => (b.normalized.urgency - a.normalized.urgency)
      || ((a.normalized.deadlineMs || Infinity) - (b.normalized.deadlineMs || Infinity))
      || (a.index - b.index));

  const workingLoad = Object.fromEntries(Object.entries(states).map(([id, state]) => [id, state.load]));
  const results = [];
  const seen = new Set(duplicateKeySet(snapshot));

  for (const row of sorted) {
    const localSnapshot = {
      ...snapshot,
      nowMs,
      engineLoad: workingLoad,
      engineHealth: Object.fromEntries(Object.entries(states).map(([id, state]) => [id, {
        healthScore: state.healthScore,
        circuitState: state.circuit,
        latencyMs: state.latencyMs,
        errorRate: state.errorRate,
        maxConcurrency: state.maxConcurrency,
        availableSlots: Math.max(0, state.maxConcurrency - workingLoad[id]),
      }])),
      recentIdempotencyKeys: [...seen],
    };
    const decision = scheduleWorkload(row.item, localSnapshot, row.index);
    results.push({ ...decision, originalIndex: row.index });
    if (decision.accepted && decision.engineId) {
      workingLoad[decision.engineId] = (workingLoad[decision.engineId] || 0) + 1;
      seen.add(decision.idempotencyKey);
    }
  }

  return {
    version: ECOSYSTEM_FABRIC_VERSION,
    generatedAt: new Date(nowMs).toISOString(),
    engines: ENGINE_LIST.map((engine) => ({ ...engine, finalLoad: workingLoad[engine.id] || 0 })),
    decisions: results.sort((a, b) => a.originalIndex - b.originalIndex),
    admitted: results.filter((r) => r.accepted).length,
    deferred: results.filter((r) => r.status === 'deferred').length,
    duplicates: results.filter((r) => r.status === 'duplicate').length,
  };
}

export function ecosystemEngineSummary() {
  return ENGINE_LIST.map((engine) => ({ ...engine }));
}
