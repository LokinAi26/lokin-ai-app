import assert from 'node:assert/strict';
import { routeModel, evaluateResponse } from '../base44/shared/modelRouter.js';
import { chooseSpeechProvider, nextCircuitState } from '../base44/shared/speechRouter.js';
import { authorizeCapability } from '../base44/shared/capabilityBroker.js';
import { createFreshEvaluationSuite } from '../base44/shared/dynamicEvaluation.js';
import { adapterStatus, buildGatewayPlan } from '../base44/shared/externalIntelligenceAdapters.js';
import { searchMemoryRows, memoryTimeline, getMemoryObservations } from '../base44/shared/memoryRetrieval.js';

const route = routeModel([
  { id:'reliable', enabled:true, capabilities:['code'], metrics:{ quality:.9, failure_rate:.01, p95_latency_ms:1200, cost_per_task_usd:.03 } },
  { id:'disabled', enabled:false, capabilities:['code'], metrics:{ quality:1, failure_rate:0 } }
], { required_capability:'code', max_failure_rate:.05 });
assert.equal(route.selected.id, 'reliable');

const evaluated = evaluateResponse({ id:'json', expect_json:true, required_terms:['ok'] }, '{"ok":true}', 120, .01);
assert.equal(evaluated.pass, true);

const speech = chooseSpeechProvider([
  { id:'configured', configured:true, enabled:true, languages:['en'], streaming:true, health_score:.9 },
  { id:'missing-secret', configured:false, enabled:true, languages:['*'] }
], { language:'en', streaming:true });
assert.equal(speech.selected.id, 'configured');
assert.equal(nextCircuitState({ consecutive_failures:2, failure_threshold:3 }, { success:false }).circuit_state, 'OPEN');

assert.equal(authorizeCapability({ capability:'production.publish', approval_verified:false }, { scopes:['production:publish'] }).allowed, false);
assert.equal(authorizeCapability({ capability:'production.publish', approval_verified:true }, { scopes:['production:publish'] }).allowed, true);
assert.equal(authorizeCapability({ capability:'data.write', target_locked:true }, { scopes:['data:write'] }).allowed, false);

const suite = createFreshEvaluationSuite({ seed:'verification-seed' });
assert.equal(suite.tasks.length, 4);
assert.equal(new Set(suite.tasks.map(x => x.category)).size, 4);

const adapters = adapterStatus({});
assert.equal(adapters.omniroute.status, 'SETUP_REQUIRED');
assert.equal(adapters.headroom.status, 'SETUP_REQUIRED');
assert.equal(adapters.claude_code.status, 'SETUP_REQUIRED');
assert.equal(adapters.claude_mem.status, 'NATIVE_PATTERN');
assert.equal(adapters.task_observer.auto_apply, false);
assert.equal(buildGatewayPlan({}, {}).status, 'SETUP_REQUIRED');

const rows = [
  { id:'a', memory_type:'decision', topic:'route policy', summary:'avoid tolls', occurred_at:'2026-01-01T00:00:00Z' },
  { id:'b', event_type:'correction', topic:'voice command', result:'confirm destination', occurred_at:'2026-01-02T00:00:00Z' }
];
assert.equal(searchMemoryRows(rows, 'tolls')[0].id, 'a');
assert.equal(memoryTimeline(rows, 'b', 1).length, 2);
assert.equal(getMemoryObservations(rows, ['a']).length, 1);

console.log('LOKIN AI evolution controls: PASS');
