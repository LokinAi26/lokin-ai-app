// Regression checks for the store geofence that drives the item locator
// auto-open (src/lib/storeGeofence.js). Overpass is stubbed; no network.
import {
  canAutoOpenItemLocator,
  checkStoreGeofence,
  reportStoreArrival,
  resetStoreGeofence,
  setStoreGeofenceEnabled,
  subscribeStoreGeofence,
} from "../src/lib/storeGeofence.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// Node has no localStorage; give the enabled toggle somewhere to live.
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};

const BASE = { lat: 36.85, lon: -76.28 };
const offset = (metersNorth) => ({ lat: BASE.lat + metersNorth / 111_320, lon: BASE.lon });

let stores = [];
globalThis.fetch = async () => ({
  ok: true,
  json: async () => ({ elements: stores }),
});

const events = [];
subscribeStoreGeofence((evt) => events.push(`${evt.type}:${evt.store?.id ?? "-"}`));

const flush = () => new Promise((r) => setTimeout(r, 0));
async function fix(metersNorth, t) {
  const p = offset(metersNorth);
  checkStoreGeofence(p.lat, p.lon, t);
  await flush();
  await flush();
}
// Fixes every 2 s from t0 to t1 (inclusive), position from posAt(t).
async function walk(t0, t1, posAt) {
  for (let t = t0; t <= t1; t += 2_000) await fix(posAt(t), t);
}
function reset() {
  resetStoreGeofence();
  mem.clear();
  events.length = 0;
}
const settled = () => events.filter((e) => e.startsWith("settled"));
const nodeStore = (id, metersNorth, name) => {
  const p = offset(metersNorth);
  return { type: "node", id, lat: p.lat, lon: p.lon, tags: { shop: "supermarket", name } };
};

// 1. Arrival at a store OSM places >80 m away (big supercenter): the visit
// must survive the next fixes (it used to exit at once and close the
// prompt), then settle after a short walking-pace dwell.
reset();
stores = [{ type: "way", id: 1, center: offset(150), tags: { shop: "supermarket", name: "Walmart Supercenter" } }];
{
  const p = offset(0);
  reportStoreArrival("Walmart Supercenter", p.lat, p.lon, 0);
}
assert(events.join() === "enter:arrival:walmart-supercenter", `arrival must enter, got ${events}`);
await walk(2_000, 6_000, (t) => t / 2_000); // 1 m every 2 s
assert(settled().length === 0, "arrival must not settle before its dwell");
await walk(8_000, 12_000, (t) => t / 2_000);
assert(!events.some((e) => e.startsWith("exit")), `arrival visit must not exit on nearby fixes, got ${events}`);
assert(settled().join() === "settled:arrival:walmart-supercenter", `arrival must settle, got ${events}`);
await fix(400, 60_000);
assert(events.includes("exit:arrival:walmart-supercenter"), `walking 400 m away must exit, got ${events}`);

// 2. Arrival while still rolling through the lot (~6 m/s) does not settle.
reset();
{
  const p = offset(0);
  reportStoreArrival("Walmart Supercenter", p.lat, p.lon, 0);
}
await walk(2_000, 14_000, (t) => (t / 1_000) * 6 - 90); // -78..-6 m, 6 m/s
assert(settled().length === 0, `rolling arrival must not settle, got ${events}`);

// 3. Geofence caught the approach first, then navigation arrived: the
// arrival must upgrade the open visit (it used to be ignored).
reset();
stores = [nodeStore(5, 0, "Food Lion")];
await walk(0, 4_000, (t) => 78 - (t / 1_000) * 10); // driving in at 10 m/s
assert(events.join() === "enter:n5", `approach must enter, got ${events}`);
{
  const p = offset(30);
  reportStoreArrival("Food Lion", p.lat, p.lon, 6_000);
}
await walk(6_000, 16_000, (t) => 30 - (t - 6_000) / 2_000);
assert(settled().join() === "settled:n5", `arrival after approach must settle, got ${events}`);
assert(
  canAutoOpenItemLocator({ pathname: "/ai-gps", search: "?focus=locked&nav=1", storeId: "n5", now: 16_000 }),
  "arrived visit may auto-open even on the navigation screen",
);

// 4. Walking in without navigation: settles once after the full dwell at
// walking pace.
reset();
stores = [nodeStore(2, 0, "Food Lion")];
await walk(0, 40_000, (t) => 70 - t / 1_000); // 1 m/s
assert(settled().length === 0, "must not settle before the dwell time");
await walk(42_000, 60_000, () => 25);
assert(settled().join() === "settled:n2", `walking-pace dwell must settle, got ${events}`);
assert(canAutoOpenItemLocator({ pathname: "/", storeId: "n2", now: 60_000 }), "settled walk-in may auto-open");
assert(!canAutoOpenItemLocator({ pathname: "/locator", storeId: "n2", now: 60_000 }), "never re-open from the locator");
assert(
  !canAutoOpenItemLocator({ pathname: "/ai-gps", search: "?focus=locked&nav=1", storeId: "n2", now: 60_000 }),
  "a dwell alone never auto-opens during active navigation",
);
assert(!canAutoOpenItemLocator({ pathname: "/", storeId: "n2", now: 120_000 }), "stale fixes block auto-open");
setStoreGeofenceEnabled(false);
assert(!canAutoOpenItemLocator({ pathname: "/", storeId: "n2", now: 60_000 }), "auto-open toggle off blocks it");
setStoreGeofenceEnabled(true);

// 5. Driving past at ~25 m/s: no settle, exits past the radius.
reset();
await walk(0, 12_000, (t) => 75 - (t / 1_000) * 25);
assert(events[0] === "enter:n2", `drive-by enters, got ${events}`);
assert(settled().length === 0, `drive-by must not settle, got ${events}`);
assert(events.includes("exit:n2"), `drive-by must exit, got ${events}`);

// 6. Driving in, then stuck at a light for 30 s inside the radius: the
// driving segment is still within the dwell window, so no settle.
reset();
await walk(0, 6_000, (t) => 78 - (t / 1_000) * 12); // 12 m/s to 6 m
await walk(8_000, 38_000, () => 6); // stopped 30 s
assert(settled().length === 0, `a short stop in traffic must not settle, got ${events}`);
// Moving off again: the gate refuses even though the stop was long.
await walk(40_000, 46_000, (t) => 6 - ((t - 38_000) / 1_000) * 12);
assert(!canAutoOpenItemLocator({ pathname: "/", storeId: "n2", now: 46_000 }), "moving again blocks auto-open");

// 7. Neighbouring stores: drift that makes a neighbour "nearest" must not
// bounce the visit (exit then re-enter re-announced the store).
reset();
stores = [nodeStore(3, 0, "Aldi"), { ...nodeStore(4, 60, "7-Eleven"), tags: { shop: "convenience", name: "7-Eleven" } }];
await fix(5, 0);
await fix(40, 5_000);
await fix(10, 10_000);
assert(events.join() === "enter:n3", `neighbour drift must not exit/re-enter, got ${events}`);

console.log("store geofence checks passed");
