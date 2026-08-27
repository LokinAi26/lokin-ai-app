import assert from "node:assert/strict";
import fs from "node:fs";
import { recordMeasuredOutcome } from "../base44/shared/outcomeLearning.js";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const oauth = read("base44/shared/uberDriverOAuth.ts");
const connect = read("base44/functions/uber-driver-oauth-connect/entry.ts");
const callback = read("base44/functions/uber-driver-oauth-callback/entry.ts");
const sync = read("base44/functions/uber-driver-sync/entry.ts");
const status = read("base44/functions/driver-platform-status/entry.ts");
const page = read("src/pages/DriverPlatforms.jsx");
const app = read("src/App.jsx");
const deletion = read("base44/functions/delete-account/entry.ts");

assert.match(oauth, /partner\.accounts/);
assert.match(oauth, /partner\.trips/);
assert.match(oauth, /partner\.payments/);
assert.doesNotMatch(oauth, /request\.rides|partner\.vehicles/);
assert.match(oauth, /AES-GCM/);
assert.match(oauth, /LOKIN_OAUTH_TOKEN_ENCRYPTION_KEY/);
assert.match(connect, /approval_required_for_public_use:\s*true/);
assert.match(connect, /automatic_platform_action:\s*false/);
assert.match(callback, /tokens_exposed_to_client:\s*false/);
assert.match(callback, /\/partners\/me/);
assert.match(sync, /\/partners\/trips/);
assert.match(sync, /\/partners\/payments/);
assert.match(sync, /limit:\s*PAGE_SIZE/);
assert.match(sync, /MAX_RECORDS\s*=\s*250/);
assert.match(sync, /source_sync_key:\s*`\$\{UBER_PROVIDER_KEY\}:trip:\$\{tripId\}`/);
assert.match(sync, /mileage_cost/);
assert.match(sync, /platform:\s*"uber_driver"/);
assert.match(sync, /live_offer_access:\s*false/);
assert.match(status, /credential_present/);
assert.match(status, /connect_available/);
assert.match(status, /sync_available/);
assert.match(page, /CONNECT UBER DRIVER/);
assert.match(page, /SYNC LAST 30 DAYS/);
assert.match(app, /driver-platforms\/uber\/callback/);
assert.match(deletion, /DriverOAuthCredential/);
assert.match(deletion, /DriverPlatformActivity/);

const stores = Object.fromEntries([
  "LokinOutcomeLearning",
  "LokinStrategyPerformance",
  "LokinLearningMemory",
  "LokinLearningEvent",
  "LokinLearningProfile",
].map((name) => [name, []]));
let sequence = 1;

function matches(row, query = {}) {
  return Object.entries(query).every(([key, value]) => row?.[key] === value);
}

function api(name) {
  return {
    async filter(query = {}, _sort = "", limit = 500) {
      return stores[name].filter((row) => matches(row, query)).slice(0, limit);
    },
    async create(data) {
      const row = { id: `${name}-${sequence++}`, ...data };
      stores[name].push(row);
      return row;
    },
    async update(id, data) {
      const index = stores[name].findIndex((row) => row.id === id);
      assert.notEqual(index, -1, `Missing ${name} row ${id}`);
      stores[name][index] = { ...stores[name][index], ...data };
      return stores[name][index];
    },
  };
}

const entities = new Proxy({}, { get: (_target, name) => api(String(name)) });
const base44 = { asServiceRole: { entities } };
const preferences = { min_per_hour: 22, target_per_mile: 1.5 };
const input = {
  outcome_type: "delivery",
  strategy_key: "uber_driver:test_market:dinner",
  platform: "uber_driver",
  gross_earnings: 24,
  miles: 8,
  duration_minutes: 35,
  net_per_hour: 31,
  dollars_per_mile: 3,
  source_provider: "uber_eats",
  source_external_id: "trip-123",
  source_sync_key: "uber_eats:trip:trip-123",
  occurred_at: "2026-08-27T22:00:00.000Z",
  metadata: { source: "test" },
};

const first = await recordMeasuredOutcome(base44, "user-1", input, { preferences });
const second = await recordMeasuredOutcome(base44, "user-1", input, { preferences });
assert.equal(first.learned, true);
assert.equal(second.duplicate, true);
assert.equal(second.learned, false);
assert.equal(stores.LokinOutcomeLearning.length, 1);
assert.equal(stores.LokinStrategyPerformance.length, 1);
assert.equal(stores.LokinStrategyPerformance[0].sample_count, 1);
assert.equal(stores.LokinLearningEvent.length, 1);

console.log(JSON.stringify({
  uber_scopes_minimized: "PASS",
  token_encryption: "PASS",
  limited_access_guardrail: "PASS",
  sync_pagination: "PASS",
  outcome_idempotency: "PASS",
  account_deletion_purge: "PASS",
}, null, 2));
