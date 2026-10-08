// Regression checks for the store geofence that drives the item locator
// auto-open (src/lib/storeGeofence.js). Overpass is stubbed; no network.
import {
  checkStoreGeofence,
  reportStoreArrival,
  resetStoreGeofence,
  subscribeStoreGeofence,
} from "../src/lib/storeGeofence.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// ~1e-5 deg latitude is ~1.11 m.
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
function reset() {
  resetStoreGeofence();
  events.length = 0;
}

// 1. Arrival at a store that OSM places >80 m away (big supercenter whose
// center is deep in the building): the visit must survive the next GPS fixes
// instead of firing an immediate exit that closed the prompt.
reset();
stores = [{ type: "way", id: 1, center: offset(150), tags: { shop: "supermarket", name: "Walmart Supercenter" } }];
{
  const p = offset(0);
  reportStoreArrival("Walmart Supercenter", p.lat, p.lon);
}
assert(events[0] === "enter:arrival:walmart-supercenter", `arrival must enter, got ${events}`);
assert(events[1] === "settled:arrival:walmart-supercenter", `arrival must settle immediately, got ${events}`);
await fix(5, 1_000);
await fix(15, 6_000);
assert(!events.some((e) => e.startsWith("exit")), `arrival visit must not exit on nearby fixes, got ${events}`);
await fix(400, 60_000);
assert(events.includes("exit:arrival:walmart-supercenter"), `walking 400 m away must exit, got ${events}`);

// 2. Walking into a store: enter at the radius, then settle once after the
// dwell at walking pace.
reset();
stores = [{ type: "node", id: 2, lat: offset(0).lat, lon: offset(0).lon, tags: { shop: "supermarket", name: "Food Lion" } }];
await fix(70, 0);
assert(events.join() === "enter:n2", `entry must fire enter, got ${events}`);
await fix(50, 10_000);
assert(!events.includes("settled:n2"), "must not settle before the dwell time");
await fix(30, 21_000);
assert(events.includes("settled:n2"), `walking-pace dwell must settle, got ${events}`);
await fix(20, 40_000);
assert(events.filter((e) => e === "settled:n2").length === 1, "settled fires once per visit");

// 3. Driving past at ~25 m/s: enter fires, but the visit never settles and
// it exits once past the radius.
reset();
for (let i = 0; i <= 6; i += 1) await fix(75 - i * 50, i * 2_000);
assert(events[0] === "enter:n2", `drive-by enters, got ${events}`);
assert(!events.some((e) => e.startsWith("settled")), `drive-by must not settle, got ${events}`);
assert(events.includes("exit:n2"), `drive-by must exit, got ${events}`);

// 4. Neighbouring stores: GPS drift that makes a neighbour "nearest" must not
// bounce the visit (exit then re-enter re-announced the store).
reset();
stores = [
  { type: "node", id: 3, lat: offset(0).lat, lon: offset(0).lon, tags: { shop: "supermarket", name: "Aldi" } },
  { type: "node", id: 4, lat: offset(60).lat, lon: offset(60).lon, tags: { shop: "convenience", name: "7-Eleven" } },
];
await fix(5, 0);
await fix(40, 5_000); // now nearer the neighbour, still well inside Aldi's exit radius
await fix(10, 10_000);
assert(events.join() === "enter:n3", `neighbour drift must not exit/re-enter, got ${events}`);

console.log("store geofence checks passed");
