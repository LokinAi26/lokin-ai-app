import assert from 'node:assert/strict';
import {
  CONTROL_PLANE_VERSION,
  canonicalJson,
  chooseControlState,
  sha256Value,
} from '../base44/shared/unifiedControlPlane.js';

const base = {
  status: 'ACTIVE',
  activated_at: '2026-08-27T00:00:00.000Z',
  immutable: false,
  lock_mode: 'NONE',
  version: 1,
  confidence: 1,
};

assert.equal(CONTROL_PLANE_VERSION, 'LOKIN_CONTROL_PLANE_V1');
assert.equal(canonicalJson({ b: 2, a: 1 }), canonicalJson({ a: 1, b: 2 }));
assert.equal(await sha256Value({ b: 2, a: 1 }), await sha256Value({ a: 1, b: 2 }));

const resolved = chooseControlState([
  { ...base, id: 'app', scope: 'APP', scope_id: 'lokin-ai', content_sha256: 'a' },
  { ...base, id: 'user', scope: 'USER', scope_id: 'u1', content_sha256: 'b' },
  { ...base, id: 'shot', scope: 'SHOT', scope_id: 's1', content_sha256: 'c', immutable: true, lock_mode: 'EXACT_HASH' },
], [
  { scope: 'SHOT', scope_id: 's1' },
  { scope: 'USER', scope_id: 'u1' },
  { scope: 'APP', scope_id: 'lokin-ai' },
]);
assert.equal(resolved.state.id, 'shot');
assert.equal(resolved.conflict, false);

const conflict = chooseControlState([
  { ...base, id: 'x1', scope: 'USER', scope_id: 'u1', content_sha256: 'hash-1' },
  { ...base, id: 'x2', scope: 'USER', scope_id: 'u1', content_sha256: 'hash-2' },
]);
assert.equal(conflict.conflict, true);
assert.deepEqual(new Set(conflict.conflict_states), new Set(['x1', 'x2']));

const expired = chooseControlState([
  { ...base, id: 'expired', scope: 'USER', scope_id: 'u1', content_sha256: 'x', expires_at: '2020-01-01T00:00:00.000Z' },
  { ...base, id: 'live', scope: 'APP', scope_id: 'lokin-ai', content_sha256: 'y' },
]);
assert.equal(expired.state.id, 'live');

console.log('LOKIN control-plane verification: PASS');
