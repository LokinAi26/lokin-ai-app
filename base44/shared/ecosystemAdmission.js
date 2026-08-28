import { scheduleWorkload, ECOSYSTEM_FABRIC_VERSION } from './ecosystemWorkloadFabric.js';

const ACTIVE = new Set(['running','admitted','admitted_failover']);
const TERMINAL_SUCCESS = new Set(['completed']);
const DEDUPE_WINDOW_MS = 30_000;
const MAX_HISTORY = 250;
const n = (v, f = 0) => Number.isFinite(Number(v)) ? Number(v) : f;
const nowIso = () => new Date().toISOString();

function stableHash(value) {
  const s = typeof value === 'string' ? value : JSON.stringify(value ?? null);
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

function clientEntities(base44) {
  return base44?.asServiceRole?.entities || base44?.entities;
}

async function recentDecisions(base44) {
  const entities = clientEntities(base44);
  if (!entities?.EcosystemWorkloadDecision) return [];
  try { return await entities.EcosystemWorkloadDecision.filter({}, '-decided_at', MAX_HISTORY) || []; }
  catch { return []; }
}

function snapshotFromRows(rows, now = Date.now()) {
  const engineLoad = { pulse:0, forge:0, atlas:0, sentinel:0, governor:0 };
  const completedIdempotencyKeys = [];
  for (const row of rows || []) {
    const decided = Date.parse(row?.decided_at || row?.created_date || '');
    const leaseEnd = Date.parse(row?.lease_expires_at || '');
    if (ACTIVE.has(String(row?.status || '')) && row?.accepted === true && Number.isFinite(leaseEnd) && leaseEnd > now && engineLoad[row.engine_id] != null) {
      engineLoad[row.engine_id] += 1;
    }
    if (TERMINAL_SUCCESS.has(String(row?.status || '')) && Number.isFinite(decided) && now - decided <= DEDUPE_WINDOW_MS && row?.idempotency_key) {
      completedIdempotencyKeys.push(String(row.idempotency_key));
    }
  }
  return { engineLoad, completedIdempotencyKeys };
}

function operationKey(workload, windowMs = DEDUPE_WINDOW_MS) {
  if (workload?.idempotencyKey || workload?.idempotency_key) return String(workload.idempotencyKey || workload.idempotency_key);
  const bucket = Math.floor(Date.now() / Math.max(1_000, windowMs));
  return `${String(workload?.type || 'operation')}:${stableHash({ workload, bucket })}`;
}

export class EcosystemAdmissionError extends Error {
  constructor(decision) {
    super(`LOKIN workload ${decision?.status || 'rejected'}: ${decision?.reason || 'admission denied'}`);
    this.name = 'EcosystemAdmissionError';
    this.code = 'LOKIN_ECOSYSTEM_ADMISSION_DENIED';
    this.status = decision?.status || 'deferred';
    this.retryAfterMs = n(decision?.retryAfterMs, 0);
    this.decision = decision;
  }
}

export async function admitEcosystemOperation(base44, workload = {}) {
  const rows = await recentDecisions(base44);
  const snapshot = snapshotFromRows(rows);
  const idempotencyKey = operationKey(workload, workload?.dedupeWindowMs || DEDUPE_WINDOW_MS);
  const normalized = { ...workload, idempotencyKey };
  const decision = scheduleWorkload(normalized, snapshot);
  const entities = clientEntities(base44);
  let record = null;
  const decidedAt = nowIso();
  const leaseExpiresAt = decision.accepted
    ? new Date(Date.now() + Math.max(5_000, n(decision.leaseMs, 5_000))).toISOString()
    : null;
  if (entities?.EcosystemWorkloadDecision) {
    const payload = {
      workload_id: String(decision.workloadId || normalized.id || idempotencyKey).slice(0,240),
      idempotency_key: idempotencyKey.slice(0,240),
      source_app: String(workload.sourceApp || workload.source_app || 'LOKIN').slice(0,120),
      domain: String(workload.domain || '').slice(0,120),
      workload_type: String(workload.type || workload.category || 'operation').slice(0,120),
      operation: String(workload.operation || '').slice(0,180),
      provider: String(workload.provider || '').slice(0,120),
      ...(decision.engineId ? { engine_id: decision.engineId } : {}),
      ...(decision.engineName ? { engine_name: decision.engineName } : {}),
      status: decision.accepted ? 'running' : decision.status,
      accepted: !!decision.accepted,
      priority: n(workload.priority, 50),
      ...(Number.isFinite(Number(decision.score)) ? { score:Number(decision.score) } : {}),
      reason: String(decision.reason || '').slice(0,500),
      ...(decision.leaseMs ? { lease_ms:n(decision.leaseMs) } : {}),
      ...(decision.retryAfterMs ? { retry_after_ms:n(decision.retryAfterMs) } : {}),
      ...(leaseExpiresAt ? { lease_expires_at:leaseExpiresAt } : {}),
      decision_version: decision.decisionVersion || ECOSYSTEM_FABRIC_VERSION,
      decided_at: decidedAt,
    };
    try { record = await entities.EcosystemWorkloadDecision.create(payload); } catch {}
  }
  if (!decision.accepted) throw new EcosystemAdmissionError(decision);
  return { ...decision, idempotencyKey, recordId:record?.id || null, leaseExpiresAt };
}

export async function completeEcosystemOperation(base44, lease, outcome = {}) {
  if (!lease?.recordId) return;
  const entities = clientEntities(base44);
  if (!entities?.EcosystemWorkloadDecision) return;
  const success = outcome.success !== false;
  const patch = {
    status: success ? 'completed' : 'failed',
    accepted: true,
    completed_at: nowIso(),
    actual_cost: Math.max(0, n(outcome.actualCost ?? outcome.actual_cost, 0)),
    error: success ? '' : String(outcome.error || 'operation failed').slice(0,500),
  };
  try { await entities.EcosystemWorkloadDecision.update(lease.recordId, patch); } catch {}
}

export async function withEcosystemAdmission(base44, workload, operation) {
  const lease = await admitEcosystemOperation(base44, workload);
  try {
    const result = await operation(lease);
    await completeEcosystemOperation(base44, lease, { success:true, actualCost:result?.actualCost ?? result?.actual_cost ?? result?.estimatedCost ?? 0 });
    return result;
  } catch (error) {
    await completeEcosystemOperation(base44, lease, { success:false, error:error?.message || String(error) });
    throw error;
  }
}

export async function invokeLLMWithAdmission(base44, args, meta = {}) {
  return withEcosystemAdmission(base44, {
    sourceApp: meta.sourceApp || 'LOKIN AI', domain: meta.domain || 'ai', type:'ai_inference', operation:'InvokeLLM', provider:'base44_core_llm',
    priority: n(meta.priority, 55), estimatedMs:n(meta.estimatedMs, 8_000), estimatedCost:n(meta.estimatedCost, 1), tags:['credits','ai', ...(meta.tags || [])],
    idempotencyKey: meta.idempotencyKey || `llm:${stableHash(args)}:${Math.floor(Date.now() / DEDUPE_WINDOW_MS)}`,
  }, () => base44.asServiceRole.integrations.Core.InvokeLLM(args));
}

export async function generateImageWithAdmission(base44, args, meta = {}) {
  return withEcosystemAdmission(base44, {
    sourceApp: meta.sourceApp || 'LOKIN', domain: meta.domain || 'production', type:'image_generation', operation:'GenerateImage', provider:'base44_core_image',
    priority:n(meta.priority, 60), estimatedMs:n(meta.estimatedMs, 30_000), estimatedCost:n(meta.estimatedCost, 1), background:meta.background === true, tags:['credits','production','media', ...(meta.tags || [])],
    idempotencyKey: meta.idempotencyKey || `image:${stableHash(args)}:${Math.floor(Date.now() / DEDUPE_WINDOW_MS)}`,
  }, () => base44.asServiceRole.integrations.Core.GenerateImage(args));
}

export async function generateSpeechWithAdmission(base44, args, meta = {}) {
  return withEcosystemAdmission(base44, {
    sourceApp: meta.sourceApp || 'LOKIN', domain: meta.domain || 'voice', type:'speech_generation', operation:'GenerateSpeech', provider:'base44_core_tts',
    priority:n(meta.priority, 70), estimatedMs:n(meta.estimatedMs, 12_000), estimatedCost:n(meta.estimatedCost, 1), realtime:meta.realtime === true, tags:['credits','voice', ...(meta.tags || [])],
    idempotencyKey: meta.idempotencyKey || `speech:${stableHash(args)}:${Math.floor(Date.now() / DEDUPE_WINDOW_MS)}`,
  }, () => base44.asServiceRole.integrations.Core.GenerateSpeech(args));
}

function classifyFetch(url, init = {}, meta = {}) {
  const u = String(url || '').toLowerCase();
  const method = String(init?.method || 'GET').toUpperCase();
  const realtime = meta.realtime === true || /mapbox|hereapi|routing|directions|geocode/.test(u);
  const heavy = /transcode|assemble|mix|render|generate|upload/.test(u);
  const sync = /uber|printful|printify|shopify|catalog|sync|oauth/.test(u);
  return {
    sourceApp: meta.sourceApp || 'LOKIN', domain: meta.domain || (realtime ? 'navigation' : heavy ? 'production' : sync ? 'sync' : 'provider'),
    type: meta.type || (heavy ? 'provider_heavy' : sync ? 'provider_sync' : 'provider_request'), operation:`HTTP_${method}`, provider:meta.provider || (() => { try { return new URL(String(url)).hostname; } catch { return 'external_provider'; } })(),
    priority:n(meta.priority, realtime ? 90 : heavy ? 65 : 45), estimatedMs:n(meta.estimatedMs, realtime ? 4_000 : heavy ? 90_000 : 15_000), estimatedCost:n(meta.estimatedCost, 0), realtime, background:meta.background === true || sync,
    tags:[realtime ? 'realtime' : '', heavy ? 'production' : '', sync ? 'scheduled' : '', ...(meta.tags || [])].filter(Boolean),
    dedupeWindowMs: method === 'GET' ? 1_000 : 30_000,
    requestFingerprint: stableHash({ url:String(url), method, body:String(init?.body || '') }),
  };
}

export async function fetchWithAdmission(base44, url, init = {}, meta = {}) {
  const workload = classifyFetch(url, init, meta);
  const lease = await admitEcosystemOperation(base44, workload);
  try {
    const response = await fetch(url, init);
    await completeEcosystemOperation(base44, lease, { success:response.ok, error:response.ok ? '' : `HTTP ${response.status}` });
    return response;
  } catch (error) {
    await completeEcosystemOperation(base44, lease, { success:false, error:error?.message || String(error) });
    throw error;
  }
}
