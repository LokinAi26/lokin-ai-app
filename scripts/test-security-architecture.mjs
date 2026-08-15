import { validateSecurityEnvelope, requiresStepUp } from '../src/lib/lokinSecurityEnvelope.js';
import { getAttackSurfaceSummary } from '../src/lib/lokinAttackSurfaceRegistry.js';

const cases = [
  ['good api envelope', { method:'POST', bodyBytes:1200, timeoutMs:5000, retryCount:1, scope:'offers:read', tenantId:'merchant_1', idempotencyKey:'abcDEF1234567890' }, true],
  ['reject method', { method:'TRACE' }, false],
  ['reject huge body', { method:'POST', bodyBytes:1000001 }, false],
  ['reject timeout', { method:'GET', timeoutMs:60000 }, false],
  ['reject retry flood', { method:'GET', retryCount:5 }, false],
  ['reject bad scope', { scope:'../../root' }, false],
  ['reject bad tenant', { tenantId:'tenant/escape' }, false],
  ['reject bad idempotency', { idempotencyKey:'short' }, false],
  ['reject capability overflow', { capabilities:Array.from({length:21},(_,i)=>`c${i}`) }, false],
];
let passed = 0;
for (const [name,input,expected] of cases) {
  const got = validateSecurityEnvelope(input).ok;
  if (got === expected) passed++; else console.error(`FAIL ${name}: expected ${expected}, got ${got}`);
}
const summary = getAttackSurfaceSummary();
if (summary.total >= 10 && summary.critical >= 5) passed++; else console.error('FAIL attack surface registry summary');
if (requiresStepUp('payments','create') && requiresStepUp('external_commands','tap_out') && !requiresStepUp('apis','read')) passed++; else console.error('FAIL step-up policy');
const total = cases.length + 2;
console.log(`Security architecture corpus: ${passed}/${total} passed`);
if (passed !== total) process.exit(1);
