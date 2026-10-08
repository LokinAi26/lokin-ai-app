// Regression checks for the store geofence that drives the item locator
// auto-open (src/lib/storeGeofence.js). Overpass is stubbed; no network.
import {
  canAutoOpenItemLocator,
  checkStoreGeofence,
  reportNavigationActive,
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
const NAV = {};
function reset() {
  resetStoreGeofence();
  reportNavigationActive(NAV, false);
  mem.clear();
  events.length = 0;
}
const settled = () => [...new Set(events.filter((e) => e.startsWith("settled")))];
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
await walk(8_000, 16_000, (t) => t / 2_000);
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
await walk(16_000, 34_000, () => -6); // stopped
assert(settled().length === 1, `arrival settles soon after the car stops, got ${events}`);

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
await walk(6_000, 26_000, (t) => 30 - (t - 6_000) / 2_000);
assert(settled().join() === "settled:n5", `arrival after approach must settle, got ${events}`);
assert(canAutoOpenItemLocator({ pathname: "/ai-gps", storeId: "n5", now: 26_000 }), "arrived visit may auto-open");

// 3a. Arrival settled during a wait in the lot, then the car creeps into a
// space at 1.4 m/s: the gate must refuse within a couple of fixes.
reset();
stores = [];
{
  const p = offset(0);
  reportStoreArrival("Kroger", p.lat, p.lon, 0);
}
await walk(2_000, 18_000, () => 0);
assert(settled().length === 1, `waiting in the lot settles the arrival, got ${events}`);
assert(canAutoOpenItemLocator({ pathname: "/", now: 18_000 }), "gate open while stopped");
await walk(20_000, 22_000, (t) => ((t - 18_000) / 1_000) * 1.4);
assert(!canAutoOpenItemLocator({ pathname: "/", now: 22_000 }), "creeping at 1.4 m/s after an arrival settle blocks the switch");
await walk(24_000, 50_000, (t) => ((t - 18_000) / 1_000) * 1.4);
assert(!canAutoOpenItemLocator({ pathname: "/", now: 50_000 }), "the dwell starts over after moving off, not from the earlier wait");

// 3b. Parking-lot crawl at ~2.2 m/s (8 km/h) after arrival, for a full
// minute: neither the arrival nor the walking-pace dwell settles.
reset();
stores = [];
{
  const p = offset(0);
  reportStoreArrival("Kroger", p.lat, p.lon, 0);
}
await walk(2_000, 60_000, (t) => (t / 1_000) * 2.2 - 66); // -62..+66 m at 2.2 m/s
assert(settled().length === 0, `a parking-lot crawl after arrival must not settle, got ${events}`);

// 3c. Arrival at a store other than the one the visit holds: hands over.
reset();
stores = [nodeStore(6, 0, "Shell Food Mart")];
await fix(60, 0);
assert(events.join() === "enter:n6", `corner shop entered, got ${events}`);
{
  const p = offset(170);
  reportStoreArrival("Aldi", p.lat, p.lon, 10_000);
}
assert(events.join() === "enter:n6,exit:n6,enter:arrival:aldi", `arrival elsewhere must hand over, got ${events}`);

// 3c2. Same store, two positions: parking 120 m from the map point and
// walking in keeps one visit, both ways round.
reset();
stores = [{ type: "way", id: 9, center: offset(120), tags: { shop: "supermarket", name: "Walmart Supercenter" } }];
{
  const p = offset(0);
  reportStoreArrival("Walmart Supercenter", p.lat, p.lon, 0);
}
await walk(2_000, 40_000, (t) => t / 400); // walk 100 m toward the building
assert(events.filter((e) => e.startsWith("enter")).length === 1, `walking in must not start a second visit, got ${events}`);
reset();
await fix(40, 0); // geofence enters the map point from 80 m out
{
  const p = offset(-10);
  reportStoreArrival("Walmart Supercenter, 123 Main St", p.lat, p.lon, 2_000);
}
assert(events.join() === "enter:w9", `same-name arrival 130 m from the map point upgrades the visit, got ${events}`);

// 3d. Geofence handover: held store fell out of its enter radius and another
// store is now within its own.
reset();
stores = [nodeStore(7, 0, "Shell Food Mart"), nodeStore(8, 150, "Aldi")];
await fix(70, 0);
await fix(140, 8_000);
assert(events.join() === "enter:n7,exit:n7,enter:n8", `geofence must hand over to the nearer store, got ${events}`);

// 4. Walking in without navigation: settles once after the full dwell at
// walking pace.
reset();
stores = [nodeStore(2, 0, "Food Lion")];
await walk(0, 40_000, (t) => 70 - t / 1_000); // 1 m/s
assert(settled().length === 0, "must not settle before the dwell time");
await walk(42_000, 60_000, () => 25);
assert(settled().join() === "settled:n2", `walking-pace dwell must settle, got ${events}`);
assert(events.filter((e) => e === "settled:n2").length > 1, "settled repeats on each fix so a held switch is retried");
assert(canAutoOpenItemLocator({ pathname: "/", storeId: "n2", now: 60_000 }), "settled walk-in may auto-open");
assert(!canAutoOpenItemLocator({ pathname: "/locator", storeId: "n2", now: 60_000 }), "never re-open from the locator");
reportNavigationActive(NAV, true); // e.g. Vision HUD or AI GPS guiding
assert(!canAutoOpenItemLocator({ pathname: "/vision-hud", storeId: "n2", now: 60_000 }), "never auto-opens while navigation is guiding");
reportNavigationActive(NAV, false);
assert(canAutoOpenItemLocator({ pathname: "/vision-hud", storeId: "n2", now: 60_000 }), "allowed again once guidance stops");
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

// 6b. Sparse indoor fixes (one every 12 s): still settles, and the gate agrees.
reset();
await fix(70, 0);
for (let t = 12_000; t <= 72_000; t += 12_000) await fix(70 - t / 2_000, t);
assert(settled().join() === "settled:n2", `sparse fixes must settle, got ${events}`);
assert(canAutoOpenItemLocator({ pathname: "/", storeId: "n2", now: 72_000 }), "gate must agree with a sparse-fix settle");

// 6c. A replayed old fix (foreground re-check) is not a new stationary fix.
reset();
await walk(0, 10_000, (t) => 78 - (t / 1_000) * 3); // 3 m/s, not walking pace
const replay = offset(48);
for (let i = 0; i < 30; i += 1) checkStoreGeofence(replay.lat, replay.lon, 10_000);
await flush();
await flush();
assert(settled().length === 0, `replayed fixes must not create a dwell, got ${events}`);

// 7. Neighbouring stores: drift that makes a neighbour "nearest" must not
// bounce the visit (exit then re-enter re-announced the store).
reset();
stores = [nodeStore(3, 0, "Aldi"), { ...nodeStore(4, 60, "7-Eleven"), tags: { shop: "convenience", name: "7-Eleven" } }];
await fix(5, 0);
await fix(40, 5_000);
await fix(10, 10_000);
assert(events.join() === "enter:n3", `neighbour drift must not exit/re-enter, got ${events}`);

console.log("store geofence checks passed");
