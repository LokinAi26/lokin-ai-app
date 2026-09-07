import fs from "node:fs";
import assert from "node:assert/strict";

const preview = fs.readFileSync("src/components/SatelliteRoutePreview.jsx", "utf8");
const planner = fs.readFileSync("src/pages/RoutePlanner.jsx", "utf8");
assert.ok(!planner.includes("M30 130 C 80 110"), "Route Planner must not show a fixed decorative route as an optimized route");
assert.equal((planner.match(/<SatelliteRoutePreview\b/g) || []).length, 1, "Use one real route preview");
const body = preview.split("  useEffect(() => {")[1]?.split('  }, [addresses.join("|")]);')[0];
assert.ok(body, "Preview effect must be available for lifecycle verification");
const run = new Function("addresses", "setRoute", "setOrigin", "setError", "setLoading", "currentPosition", "base44LiveFunctions", body);
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

function start(addresses, position) {
  const state = { route: { old: true }, origin: { old: true }, error: "old error", loading: false, calls: 0 };
  const cleanup = run(addresses,
    value => { state.route = value; },
    value => { state.origin = value; },
    value => { state.error = value; },
    value => { state.loading = value; },
    position,
    { functions: { invoke: async () => {
      state.calls++;
      return { data: { route: { geometry: { coordinates: [[1, 2], [3, 4]] } } } };
    } } });
  return { state, cleanup };
}

let resolvePosition;
const cancelled = start(["New destination"], () => new Promise(resolve => { resolvePosition = resolve; }));
assert.equal(cancelled.state.route, null, "Clear prior route before requesting a new location");
assert.equal(cancelled.state.origin, null);
assert.equal(cancelled.state.loading, true);
assert.equal(cancelled.state.error, "");
cancelled.cleanup();
resolvePosition({ coords: { longitude: 1, latitude: 2 } });
await tick();
assert.equal(cancelled.state.calls, 0, "Cancelled GPS requests must not start paid/provider route lookups");
assert.equal(cancelled.state.route, null);

const empty = start([], () => { throw Error("Location must not be requested for empty stops"); });
assert.equal(empty.state.loading, false);
assert.equal(empty.state.route, null);
const denied = start(["Destination"], () => Promise.reject(Error("Location denied")));
await tick();
assert.equal(denied.state.error, "Location denied");
assert.equal(denied.state.loading, false);
assert.equal(denied.state.route, null);
const success = start(["Destination"], () => Promise.resolve({ coords: { longitude: 1, latitude: 2 } }));
await tick();
assert.equal(success.state.calls, 1);
assert.equal(success.state.loading, false);
assert.equal(success.state.route.geometry.coordinates.length, 2);
console.log("PASS: real route preview, stale-route clearing, cancellation, empty stops, location denial, successful routing.");
