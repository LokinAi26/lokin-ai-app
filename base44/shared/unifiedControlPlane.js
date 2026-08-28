// LOKIN Unified Memory + Continuity Control Plane v1
// Deterministic, hash-addressed state shared by LOKIN AI and LOKIN Productions.

export const CONTROL_PLANE_VERSION = 'LOKIN_CONTROL_PLANE_V1';

const VALID_SCOPES = new Set(['ECOSYSTEM','APP','WORKSPACE','PROJECT','PRODUCTION','SHOT','USER']);
const VALID_TYPES = new Set(['MEMORY','DECISION','REFERENCE','ASSET_LOCK','WORKFLOW','CHECKPOINT','POLICY','HEALTH','CONFIG']);
const SCOPE_WEIGHT = Object.freeze({ ECOSYSTEM:100, APP:200, WORKSPACE:300, PROJECT:400, USER:450, PRODUCTION:500, SHOT:600 });
const now = () => new Date().toISOString();
const text = (v, max = 4000) => String(v ?? '').trim().slice(0, max);
const number = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((out, key) => {
      if (value[key] !== undefined) out[key] = canonicalize(value[key]);
      return out;
    }, {});
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export async function sha256Value(value) {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function normalizeCanonicalKey(value) {
  const key = text(value, 320).toLowerCase().replace(/[^a-z0-9._:/-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!key) throw new Error('CANONICAL_KEY_REQUIRED');
  return key;
}

function stateApi(base44) { return base44.asServiceRole.entities.LokinControlState; }
function eventApi(base44) { return base44.asServiceRole.entities.LokinControlEvent; }
function ownerOf(actor = {}, input = {}) { return text(input.owner_user_id || actor.userId || actor.id, 180); }
function isAdmin(actor = {}) { return text(actor.role).toLowerCase() === 'admin' || actor.service === true; }
function scopeIdentity(row = {}) { return `${text(row.scope).toUpperCase()}:${text(row.scope_id)}`; }
function expired(row) { return !!row?.expires_at && Number.isFinite(Date.parse(row.expires_at)) && Date.parse(row.expires_at) <= Date.now(); }

async function writeEvent(base44, payload = {}) {
  const event = {
    event_id: text(payload.event_id || crypto.randomUUID(), 180),
    canonical_key: text(payload.canonical_key, 320),
    state_id: text(payload.state_id, 180),
    event_type: text(payload.event_type || 'HEALTH', 40),
    source_app: text(payload.source_app || 'LOKIN', 100),
    owner_user_id: text(payload.owner_user_id, 180),
    actor_user_id: text(payload.actor_user_id, 180),
    correlation_id: text(payload.correlation_id, 180),
    idempotency_key: text(payload.idempotency_key, 256),
    content_sha256: text(payload.content_sha256, 128),
    result: text(payload.result || 'OK', 120),
    details: payload.details && typeof payload.details === 'object' ? payload.details : {},
    occurred_at: payload.occurred_at || now(),
  };
  return eventApi(base44).create(event).catch(() => null);
}

export function chooseControlState(rows = [], scopeChain = []) {
  const chain = Array.isArray(scopeChain) ? scopeChain.map((x, index) => ({ scope:text(x?.scope).toUpperCase(), scope_id:text(x?.scope_id), rank:10000-index*100 })) : [];
  const chainMap = new Map(chain.map((x) => [`${x.scope}:${x.scope_id}`, x.rank]));
  const candidates = rows.filter((row) => row?.status === 'ACTIVE' && !expired(row)).map((row) => {
    const explicit = chainMap.get(scopeIdentity(row));
    const rank = explicit ?? (SCOPE_WEIGHT[text(row.scope).toUpperCase()] || 0);
    const lock = row.lock_mode === 'EXACT_HASH' ? 30 : row.lock_mode === 'APPROVED' ? 20 : row.immutable ? 10 : 0;
    return { row, rank, lock };
  }).filter((x) => !chain.length || chainMap.has(scopeIdentity(x.row)) || x.row.scope === 'ECOSYSTEM' || x.row.scope === 'APP');
  candidates.sort((a,b) => (b.rank-a.rank) || (b.lock-a.lock) || (number(b.row.version)-number(a.row.version)) || (number(b.row.confidence)-number(a.row.confidence)) || (Date.parse(b.row.activated_at || 0)-Date.parse(a.row.activated_at || 0)));
  if (!candidates.length) return { state:null, conflict:false, candidates:[] };
  const first = candidates[0];
  const peers = candidates.filter((x) => x.rank === first.rank && scopeIdentity(x.row) === scopeIdentity(first.row) && number(x.row.version) === number(first.row.version));
  const hashes = new Set(peers.map((x) => text(x.row.content_sha256)).filter(Boolean));
  return { state:first.row, conflict:hashes.size > 1, candidates:candidates.map((x) => x.row), conflict_states:hashes.size > 1 ? peers.map((x) => x.row.id) : [] };
}

export async function putControlState(base44, input = {}, actor = {}) {
  const canonicalKey = normalizeCanonicalKey(input.canonical_key);
  const namespace = text(input.namespace || 'lokin', 100).toLowerCase();
  const scope = text(input.scope || 'USER', 30).toUpperCase();
  const stateType = text(input.state_type || 'CONFIG', 30).toUpperCase();
  if (!VALID_SCOPES.has(scope)) throw new Error('INVALID_CONTROL_SCOPE');
  if (!VALID_TYPES.has(stateType)) throw new Error('INVALID_CONTROL_STATE_TYPE');
  const scopeId = text(input.scope_id, 180);
  const ownerUserId = ownerOf(actor, input);
  if (!ownerUserId && !isAdmin(actor)) throw new Error('GLOBAL_CONTROL_STATE_ADMIN_REQUIRED');
  const content = input.content && typeof input.content === 'object' && !Array.isArray(input.content) ? input.content : { value: input.content ?? null };
  const contentHash = await sha256Value(content);
  if (input.content_sha256 && text(input.content_sha256) !== contentHash) throw new Error('CONTROL_CONTENT_HASH_MISMATCH');
  const idempotencyKey = text(input.idempotency_key, 256);
  const api = stateApi(base44);

  if (idempotencyKey) {
    const prior = await api.filter({ idempotency_key:idempotencyKey }, '-updated_date', 1).catch(() => []);
    if (prior?.[0]) return { state:prior[0], idempotent:true, created:false, version:prior[0].version, content_sha256:prior[0].content_sha256 };
  }

  const active = await api.filter({ canonical_key:canonicalKey, namespace, scope, scope_id:scopeId, status:'ACTIVE' }, '-updated_date', 100).catch(() => []);
  const distinct = new Set((active || []).map((row) => text(row.content_sha256)).filter(Boolean));
  if (distinct.size > 1) {
    await writeEvent(base44, { canonical_key:canonicalKey, event_type:'CONFLICT', source_app:input.source_app, owner_user_id:ownerUserId, actor_user_id:actor.userId || actor.id, correlation_id:input.correlation_id, result:'FAIL_CLOSED', details:{ active_state_ids:active.map((x) => x.id), hashes:[...distinct] } });
    throw new Error('CONTROL_STATE_CONFLICT');
  }
  const latest = (active || []).sort((a,b) => number(b.version)-number(a.version))[0] || null;
  if (latest?.content_sha256 === contentHash) {
    await writeEvent(base44, { canonical_key:canonicalKey, state_id:latest.id, event_type:'PUT', source_app:input.source_app, owner_user_id:ownerUserId, actor_user_id:actor.userId || actor.id, correlation_id:input.correlation_id, idempotency_key:idempotencyKey, content_sha256:contentHash, result:'IDEMPOTENT' });
    return { state:latest, idempotent:true, created:false, version:latest.version, content_sha256:contentHash };
  }
  if (latest?.immutable === true && input.confirm_unlock !== true) throw new Error('CONTROL_STATE_LOCKED');
  if (latest?.immutable === true && input.confirm_unlock === true && !isAdmin(actor)) throw new Error('CONTROL_STATE_UNLOCK_ADMIN_REQUIRED');

  const maxVersion = (active || []).reduce((m, row) => Math.max(m, number(row.version, 0)), 0);
  const nextVersion = Math.max(1, maxVersion + 1);
  for (const row of active || []) {
    await api.update(row.id, { status:'SUPERSEDED' });
    await writeEvent(base44, { canonical_key:canonicalKey, state_id:row.id, event_type:'SUPERSEDE', source_app:input.source_app, owner_user_id:ownerUserId, actor_user_id:actor.userId || actor.id, correlation_id:input.correlation_id, content_sha256:row.content_sha256, result:'SUPERSEDED', details:{ next_version:nextVersion } });
  }

  const record = await api.create({
    canonical_key:canonicalKey,
    namespace,
    scope,
    scope_id:scopeId,
    state_type:stateType,
    source_app:text(input.source_app || 'LOKIN', 100),
    owner_user_id:ownerUserId,
    resource_type:text(input.resource_type, 100),
    resource_id:text(input.resource_id, 180),
    version:nextVersion,
    status:'ACTIVE',
    immutable:input.immutable === true,
    lock_mode:['NONE','APPROVED','EXACT_HASH'].includes(input.lock_mode) ? input.lock_mode : (input.immutable ? 'APPROVED' : 'NONE'),
    content,
    content_sha256:contentHash,
    confidence:Math.max(0, Math.min(1, number(input.confidence, 1))),
    evidence_count:Math.max(0, Math.floor(number(input.evidence_count, 1))),
    parent_state_id:text(input.parent_state_id, 180),
    supersedes_state_id:text(latest?.id, 180),
    correlation_id:text(input.correlation_id, 180),
    idempotency_key:idempotencyKey,
    activated_at:input.activated_at || now(),
    ...(input.expires_at ? { expires_at:input.expires_at } : {}),
    provenance:{ control_plane_version:CONTROL_PLANE_VERSION, ...(input.provenance || {}) },
  });
  await writeEvent(base44, { canonical_key:canonicalKey, state_id:record.id, event_type:'PUT', source_app:record.source_app, owner_user_id:ownerUserId, actor_user_id:actor.userId || actor.id, correlation_id:record.correlation_id, idempotency_key:idempotencyKey, content_sha256:contentHash, result:'ACTIVE', details:{ scope, scope_id:scopeId, version:nextVersion, state_type:stateType, immutable:record.immutable } });
  return { state:record, idempotent:false, created:true, version:nextVersion, content_sha256:contentHash };
}

export async function resolveControlState(base44, input = {}, actor = {}) {
  const canonicalKey = normalizeCanonicalKey(input.canonical_key);
  const namespace = text(input.namespace || 'lokin', 100).toLowerCase();
  const query = { canonical_key:canonicalKey, namespace, status:'ACTIVE' };
  const rows = await stateApi(base44).filter(query, '-updated_date', 200).catch(() => []);
  const visible = isAdmin(actor) ? rows : rows.filter((row) => text(row.owner_user_id) === text(actor.userId || actor.id));
  const resolution = chooseControlState(visible, input.scope_chain || []);
  if (resolution.conflict) {
    await writeEvent(base44, { canonical_key:canonicalKey, event_type:'CONFLICT', source_app:input.source_app, owner_user_id:text(actor.userId || actor.id), actor_user_id:actor.userId || actor.id, result:'FAIL_CLOSED', details:{ conflict_states:resolution.conflict_states } });
    return { ...resolution, resolved:false, error:'CONTROL_STATE_CONFLICT', version:CONTROL_PLANE_VERSION };
  }
  await writeEvent(base44, { canonical_key:canonicalKey, state_id:resolution.state?.id, event_type:'RESOLVE', source_app:input.source_app, owner_user_id:resolution.state?.owner_user_id || text(actor.userId || actor.id), actor_user_id:actor.userId || actor.id, result:resolution.state ? 'RESOLVED' : 'NOT_FOUND', content_sha256:resolution.state?.content_sha256, details:{ scope_chain:input.scope_chain || [] } });
  return { resolved:!!resolution.state, state:resolution.state || null, candidates:input.include_candidates ? resolution.candidates : undefined, conflict:false, version:CONTROL_PLANE_VERSION };
}

export async function createControlCheckpoint(base44, input = {}, actor = {}) {
  const namespace = text(input.namespace || 'lokin', 100).toLowerCase();
  const rows = await stateApi(base44).filter({ namespace, status:'ACTIVE' }, '-updated_date', 500).catch(() => []);
  const visible = isAdmin(actor) ? rows : rows.filter((row) => text(row.owner_user_id) === text(actor.userId || actor.id));
  const members = visible.filter((row) => row.state_type !== 'CHECKPOINT' && !expired(row)).map((row) => ({ id:row.id, canonical_key:row.canonical_key, scope:row.scope, scope_id:row.scope_id || '', version:row.version, content_sha256:row.content_sha256, immutable:row.immutable === true })).sort((a,b) => `${a.canonical_key}:${a.scope}:${a.scope_id}`.localeCompare(`${b.canonical_key}:${b.scope}:${b.scope_id}`));
  const manifestSha = await sha256Value(members);
  const name = normalizeCanonicalKey(input.name || `checkpoint-${Date.now()}`);
  const result = await putControlState(base44, {
    canonical_key:`checkpoint:${name}`,
    namespace,
    scope:input.scope || (isAdmin(actor) ? 'APP' : 'USER'),
    scope_id:text(input.scope_id || (isAdmin(actor) ? input.source_app : actor.userId || actor.id)),
    state_type:'CHECKPOINT',
    source_app:input.source_app,
    owner_user_id:isAdmin(actor) ? text(input.owner_user_id) : text(actor.userId || actor.id),
    immutable:true,
    lock_mode:'EXACT_HASH',
    idempotency_key:text(input.idempotency_key || `checkpoint:${name}:${manifestSha}`, 256),
    content:{ name, manifest_sha256:manifestSha, member_count:members.length, members, created_at:now(), control_plane_version:CONTROL_PLANE_VERSION },
    provenance:{ checkpoint:true },
  }, actor);
  await writeEvent(base44, { canonical_key:result.state.canonical_key, state_id:result.state.id, event_type:'CHECKPOINT', source_app:input.source_app, owner_user_id:result.state.owner_user_id, actor_user_id:actor.userId || actor.id, content_sha256:result.state.content_sha256, result:'CREATED', details:{ manifest_sha256:manifestSha, member_count:members.length } });
  return { ...result, manifest_sha256:manifestSha, member_count:members.length };
}

export async function controlPlaneHealth(base44, input = {}, actor = {}) {
  const namespace = text(input.namespace || 'lokin', 100).toLowerCase();
  const rows = await stateApi(base44).filter({ namespace, status:'ACTIVE' }, '-updated_date', 500).catch(() => []);
  const visible = isAdmin(actor) ? rows : rows.filter((row) => text(row.owner_user_id) === text(actor.userId || actor.id));
  const groups = new Map();
  let expiredCount = 0;
  for (const row of visible) {
    if (expired(row)) expiredCount += 1;
    const key = `${row.canonical_key}|${scopeIdentity(row)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const conflicts = [];
  const duplicates = [];
  for (const [key, group] of groups) {
    if (group.length > 1) duplicates.push({ key, state_ids:group.map((x) => x.id) });
    if (new Set(group.map((x) => text(x.content_sha256))).size > 1) conflicts.push({ key, state_ids:group.map((x) => x.id), hashes:[...new Set(group.map((x) => text(x.content_sha256)))] });
  }
  const score = Math.max(0, 100 - conflicts.length*25 - duplicates.length*8 - expiredCount*2);
  const status = conflicts.length ? 'action_required' : (duplicates.length || expiredCount ? 'warning' : 'healthy');
  await writeEvent(base44, { event_type:'HEALTH', source_app:input.source_app, owner_user_id:isAdmin(actor) ? '' : text(actor.userId || actor.id), actor_user_id:actor.userId || actor.id, result:status.toUpperCase(), details:{ active_states:visible.length, conflicts:conflicts.length, duplicates:duplicates.length, expired:expiredCount, score } });
  return { status, health_score:score, active_states:visible.length, conflicts, duplicates, expired:expiredCount, version:CONTROL_PLANE_VERSION };
}

export async function revokeControlState(base44, stateId, actor = {}, sourceApp = 'LOKIN') {
  const api = stateApi(base44);
  const state = await api.get(text(stateId, 180)).catch(() => null);
  if (!state) throw new Error('CONTROL_STATE_NOT_FOUND');
  if (!isAdmin(actor) && text(state.owner_user_id) !== text(actor.userId || actor.id)) throw new Error('CONTROL_STATE_FORBIDDEN');
  if (state.immutable === true && !isAdmin(actor)) throw new Error('CONTROL_STATE_REVOKE_ADMIN_REQUIRED');
  const updated = await api.update(state.id, { status:'REVOKED' });
  await writeEvent(base44, { canonical_key:state.canonical_key, state_id:state.id, event_type:'REVOKE', source_app:sourceApp, owner_user_id:state.owner_user_id, actor_user_id:actor.userId || actor.id, content_sha256:state.content_sha256, result:'REVOKED' });
  return updated;
}

export function exportControlEnvelope(state) {
  if (!state) throw new Error('CONTROL_STATE_REQUIRED');
  return {
    protocol:CONTROL_PLANE_VERSION,
    canonical_key:state.canonical_key,
    namespace:state.namespace,
    scope:state.scope,
    scope_id:state.scope_id || '',
    state_type:state.state_type,
    source_app:state.source_app,
    owner_user_id:state.owner_user_id || '',
    resource_type:state.resource_type || '',
    resource_id:state.resource_id || '',
    immutable:state.immutable === true,
    lock_mode:state.lock_mode || 'NONE',
    content:state.content || {},
    content_sha256:state.content_sha256,
    confidence:number(state.confidence, 1),
    evidence_count:number(state.evidence_count, 1),
    correlation_id:state.correlation_id || '',
    activated_at:state.activated_at,
    expires_at:state.expires_at || '',
    provenance:{ ...(state.provenance || {}), exported_state_id:state.id, exported_version:state.version },
  };
}

export async function importControlEnvelope(base44, envelope = {}, actor = {}) {
  if (envelope.protocol !== CONTROL_PLANE_VERSION) throw new Error('CONTROL_PROTOCOL_VERSION_MISMATCH');
  const observed = await sha256Value(envelope.content || {});
  if (observed !== text(envelope.content_sha256)) throw new Error('CONTROL_ENVELOPE_HASH_MISMATCH');
  const result = await putControlState(base44, { ...envelope, idempotency_key:text(envelope.idempotency_key || `sync:${envelope.source_app}:${envelope.canonical_key}:${observed}`, 256), provenance:{ ...(envelope.provenance || {}), imported_at:now(), protocol:CONTROL_PLANE_VERSION } }, { ...actor, service:true });
  await writeEvent(base44, { canonical_key:result.state.canonical_key, state_id:result.state.id, event_type:'SYNC', source_app:envelope.source_app, owner_user_id:result.state.owner_user_id, actor_user_id:actor.userId || actor.id || 'bridge', content_sha256:observed, result:result.idempotent ? 'IDEMPOTENT' : 'IMPORTED', details:{ protocol:CONTROL_PLANE_VERSION } });
  return result;
}
