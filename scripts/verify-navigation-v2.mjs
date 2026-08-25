import { matchToRouteHMM, routeCumulativeDistances } from "../src/lib/navigationGeometry.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// Test 1: ordinary forward progress.
const straight = [
  [-76.0000, 36.8500],
  [-75.9990, 36.8500],
  [-75.9980, 36.8500],
  [-75.9970, 36.8500],
];
const straightCum = routeCumulativeDistances(straight);
const first = matchToRouteHMM([-75.9994, 36.85003], straight, straightCum, {
  heading: 90,
  speedMps: 13,
  accuracyM: 6,
  timestamp: 1_000,
});
const second = matchToRouteHMM([-75.9988, 36.85002], straight, straightCum, {
  previousSnap: { ...first, timestamp: 1_000, speed_mps: 13 },
  heading: 90,
  speedMps: 13,
  accuracyM: 6,
  timestamp: 5_000,
});
assert(first && second, "online HMM matcher returned null");
assert(second.along_route_m > first.along_route_m, "online HMM matcher failed to advance along route");
assert(second.match_confidence > 0.5, "online HMM matcher confidence unexpectedly low");

// Test 2: two close parallel segments with opposite travel direction. Distance
// alone is ambiguous; heading should keep the car on the eastbound segment.
const parallel = [
  [-76.0000, 36.85000],
  [-75.9980, 36.85000], // eastbound lower road
  [-75.9980, 36.85012],
  [-76.0000, 36.85012], // westbound upper road
];
const parallelCum = routeCumulativeDistances(parallel);
const ambiguousPoint = [-75.9990, 36.850055];
const eastbound = matchToRouteHMM(ambiguousPoint, parallel, parallelCum, {
  heading: 90,
  speedMps: 12,
  accuracyM: 9,
  timestamp: 10_000,
});
assert(eastbound, "parallel-road matcher returned null");
assert(eastbound.segment_index === 0, `heading-aware matcher chose wrong parallel segment ${eastbound.segment_index}`);
assert(eastbound.heading_error_deg < 25, "heading-aware matcher ignored road direction");

// Test 3: a short noisy observation should not teleport backward through route
// history when the previous state indicates forward travel.
const previous = { ...second, timestamp: 5_000, speed_mps: 13 };
const noisy = matchToRouteHMM([-75.99945, 36.85001], straight, straightCum, {
  previousSnap: previous,
  heading: 90,
  speedMps: 13,
  accuracyM: 20,
  timestamp: 5_800,
});
assert(noisy, "continuity matcher returned null");
assert(noisy.along_route_m > first.along_route_m * 0.75, "matcher teleported implausibly backward");

console.log(JSON.stringify({
  ok: true,
  matcher: "online-hmm",
  forwardConfidence: Number(second.match_confidence.toFixed(3)),
  parallelSegment: eastbound.segment_index,
  parallelHeadingErrorDeg: Number(eastbound.heading_error_deg.toFixed(1)),
  continuityAlongRouteM: Number(noisy.along_route_m.toFixed(1)),
}, null, 2));
