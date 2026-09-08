import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { withDeadline } from "../base44/shared/requestDeadline.js";
import { requestRouteOptimization } from "../src/lib/routeOptimizerRequest.js";

// Fast real timers exercise never-settling dependencies without waiting 30 seconds.
const originalTimer = globalThis.setTimeout;
globalThis.setTimeout = (fn, ms, ...args) => originalTimer(fn, Math.min(ms, 20), ...args);
const never = () => new Promise(() => {});
try {
  await assert.rejects(withDeadline(never, 100, "test"), { code: "LOKIN_ROUTE_TIMEOUT" });
  assert.equal(await withDeadline(() => 42, 100, "test"), 42);

  let calls = 0;
  let release;
  const client = { functions: { invoke: () => {
    calls++;
    return new Promise(resolve => { release = resolve; });
  } } };
  const one = requestRouteOptimization(client, { mode: "fastest" });
  const two = requestRouteOptimization(client, { mode: "fastest" });
  assert.equal(one, two);
  await Promise.resolve();
  assert.equal(calls, 1);
  release({ data: { sequenced: [{ id: "stop-1" }] } });
  assert.equal((await one).data.sequenced[0].id, "stop-1");
  const timeout = requestRouteOptimization(client, { mode: "fastest" });
  await assert.rejects(timeout, { code: "LOKIN_ROUTE_TIMEOUT" });
  client.functions.invoke = async () => ({ data: { sequenced: [] } });
  assert.deepEqual((await requestRouteOptimization(client, { mode: "fastest" })).data.sequenced, []);
  client.functions.invoke = async () => { throw new Error("Data unavailable"); };
  await assert.rejects(requestRouteOptimization(client, {}), /Data unavailable/);

  // Exercise the real handler; replace remote SDK/AI and ranking dependencies only.
  const source = await readFile(new URL("../base44/functions/optimizeRoute/entry.ts", import.meta.url), "utf8");
  let ai = never;
  const offer = { id: "stop-1", status: "available", source_type: "user_entered",
    verification_status: "address_verified", captured_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 3600000).toISOString(), merchant: "Test store",
    payout: 20, miles: 2, dropoff_address: "Test destination", _score: { netPerHour: 30, gross: 20, net: 18 } };
  let offers = [offer];
  let entitiesHang = false;
  let user = { id: "driver" };
  globalThis.__optimizerTest = {
    withDeadline,
    createClientFromRequest: () => ({
      auth: { me: async () => user },
      entities: Object.fromEntries(["Offer", "DriverPreference", "BlockedCustomer", "AvoidPlace", "Earning"]
        .map(name => [name, { filter: () => entitiesHang ? never() : Promise.resolve(name === "Offer" ? offers : []) }]))
    }),
    invokeLLMWithAdmission: () => ai(),
    filterAndRank: rows => rows, rankByMode: rows => rows, sequenceByZone: rows => rows,
    totalRouteStats: rows => ({ stops: rows.length, miles: 2, net: 18, perHour: 30 }),
    trueEarningRate: () => ({}), lockInScore: () => ({ overall: 70 }),
    OPTIMIZATION_MODES: [{ value: "fastest", label: "Fastest" }],
    filterOffersForUser: rows => rows,
    evaluateOffersWithSeal: rows => rows.map(o => ({ subject_id: o.id, action: "ACCEPT" })),
    buildSealSummary: () => ({}),
  };
  const transformed = source.replace(/import\s*\{([\s\S]*?)\}\s*from\s*["'][^"']+["'];/g,
    (_, names) => `const {${names}} = globalThis.__optimizerTest;`);
  const { default: handler } = await import("data:text/javascript;base64," + Buffer.from(transformed).toString("base64"));
  const request = () => new Request("https://test.invalid", { method: "POST", body: '{"mode":"fastest"}' });
  let response = await handler(request());
  let result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.sequenced[0].id, offer.id);
  assert.equal(result.briefingSource, "route_summary");
  ai = async () => { throw new Error("AI unavailable"); };
  assert.equal((await (await handler(request())).json()).sequenced.length, 1);
  ai = async () => "AI briefing";
  assert.equal((await (await handler(request())).json()).briefingSource, "ai");
  offers = [];
  ai = () => { throw new Error("Must not request AI for empty route"); };
  assert.deepEqual((await (await handler(request())).json()).sequenced, []);
  entitiesHang = true;
  response = await handler(request());
  assert.equal(response.status, 504);
  assert.equal((await response.json()).code, "LOKIN_ROUTE_TIMEOUT");
  entitiesHang = false;
  user = null;
  assert.equal((await handler(request())).status, 401);
  console.log("PASS: deadlines, request deduplication, retry, backend errors, AI fallback, empty routes and auth.");
} finally {
  globalThis.setTimeout = originalTimer;
  delete globalThis.__optimizerTest;
}
