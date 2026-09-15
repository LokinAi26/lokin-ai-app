/**
 * verify-navigation-regressions.mjs
 * Durable regression tests for the 2026-09-15 navigation fixes
 * (Kendall's iPhone road test: inaccurate rerouting, route line through
 * buildings, backward cursor, premature arrival, endpoint glitching).
 *
 * Run: node scripts/verify-navigation-regressions.mjs
 */
import {
  matchToRouteHMM,
  routeCumulativeDistances,
  evaluateArrivalState,
  remainingRouteLine,
  haversineMeters,
} from "../src/lib/navigationGeometry.js";
import { reroutePolicy } from "../src/lib/navigationQuality.js";

function assert(condition, message) {
  if (!condition) throw new Error(`REGRESSION FAIL: ${message}`);
}
const results = {};
const check = (name, fn) => { fn(); results[name] = "pass"; };

// ---------------------------------------------------------------------------
// T1: low / null-speed course matching.
// iOS Safari reports speed as null (and heading unreliable) at low speed.
// The matcher must derive course-made-good from consecutive raw fixes so the
// snap does not latch onto an antiparallel leg (backward cursor).
// ---------------------------------------------------------------------------
check("null-speed course matching", () => {
  // Tight U-turn corridor: outbound east leg, short north jog, return west leg
  // ~10 m north of the outbound leg. iOS Safari reports null heading/speed at
  // low speed; the matcher must derive course-made-good from consecutive raw
  // fixes instead of disabling heading discipline (which latched the snap onto
  // antiparallel legs -> backward cursor, route line through buildings).
  const corridor = [
    [-76.0000, 36.85000],
    [-75.99970, 36.85000], // segment 0: outbound east
    [-75.99970, 36.85009], // segment 1: north jog
    [-76.0000, 36.85009], // segment 2: return west
  ];
  const cum = routeCumulativeDistances(corridor);
  const fix1 = [-75.99985, 36.85001]; // on the outbound leg
  const first = matchToRouteHMM(fix1, corridor, cum, {
    heading: null, speedMps: null, accuracyM: 9, timestamp: 100_000,
  });
  assert(first && first.segment_index === 0, "null-speed first fix should hold the outbound leg");
  // Noisy fix: ~12 m east of fix1 but drifted north, nearer the return leg.
  const fix2 = [-75.99972, 36.850063];
  assert(haversineMeters(fix1, fix2) > 10, "test setup: fixes must be >10 m apart for course-made-good");
  const second = matchToRouteHMM(fix2, corridor, cum, {
    previousSnap: { ...first, raw_coordinate: fix1, timestamp: 100_000, speed_mps: 0 },
    heading: null, speedMps: null, accuracyM: 9, timestamp: 104_000,
  });
  assert(second, "null-speed second fix returned null");
  assert(second.segment_index === 0,
    `null-speed snap latched onto leg ${second.segment_index} (expected 0, outbound east)`);
  assert(second.heading_error_deg < 45,
    `course-made-good ignored road direction (err ${second.heading_error_deg})`);
  results.nullSpeedSegment = second.segment_index;
});

// ---------------------------------------------------------------------------
// T2: opposing / return-route legs.
// Out-and-back route sharing a corridor: while driving outbound the snap must
// never flip to the antiparallel return leg (the ~180° wrong-direction flip).
// ---------------------------------------------------------------------------
check("opposing return legs", () => {
  const outAndBack = [
    [-76.0000, 36.85000],
    [-75.9980, 36.85000], // segment 0: outbound east
    [-75.9980, 36.85011],
    [-76.0000, 36.85011], // segment 2: return west (~12 m north)
  ];
  const cum = routeCumulativeDistances(outAndBack);
  let prev = null;
  // Drive outbound east in 5 fixes with solid heading.
  for (let k = 0; k < 5; k++) {
    const lon = -75.99980 + k * 0.00010;
    const snap = matchToRouteHMM([lon, 36.85002], outAndBack, cum, {
      previousSnap: prev,
      heading: 90, speedMps: 11, accuracyM: 7, timestamp: 200_000 + k * 4000,
    });
    assert(snap, `outbound fix ${k} returned null`);
    assert(snap.segment_index === 0,
      `outbound fix ${k} flipped to leg ${snap.segment_index} (expected 0)`);
    prev = { ...snap, raw_coordinate: [lon, 36.85002], timestamp: 200_000 + k * 4000, speed_mps: 11 };
  }
  // Same corridor, heading now null and speed null (slow traffic): course-made-good
  // from raw fixes must still hold the outbound leg.
  const slow = matchToRouteHMM([-75.99930, 36.85003], outAndBack, cum, {
    previousSnap: prev,
    heading: null, speedMps: null, accuracyM: 9, timestamp: 224_000,
  });
  assert(slow.segment_index === 0,
    `slow outbound fix flipped to leg ${slow.segment_index} (expected 0)`);
  // Route acquisition with a trustworthy compass heading but (near-)zero speed:
  // the old code disabled heading discipline entirely below 1.5 m/s, so the
  // first snap after a reroute latched onto whichever antiparallel leg was
  // nearer (inaccurate rerouting). The fix keeps heading discipline at any speed.
  const acquire = matchToRouteHMM([-75.99900, 36.850085], outAndBack, cum, {
    heading: 90, speedMps: 0, accuracyM: 9, timestamp: 300_000,
  });
  assert(acquire && acquire.segment_index === 0,
    `low-speed acquisition snapped to leg ${acquire && acquire.segment_index} (expected 0, eastbound)`);
  results.outboundFinalSegment = slow.segment_index;
  results.lowSpeedAcquisitionSegment = acquire.segment_index;
});

// ---------------------------------------------------------------------------
// T3: destination close by straight line but farther by road.
// 25 m straight-line from the destination with 800 m of driving left must
// NEVER count as arrival, no matter how many consecutive fixes agree.
// ---------------------------------------------------------------------------
check("no premature arrival", () => {
  let state = { arrivalSamples: 0, arrived: false };
  for (let k = 0; k < 6; k++) {
    state = evaluateArrivalState({
      progress: 0.50, finalDistanceM: 25, remainingRouteM: 800,
      arrivalSamples: state.arrivalSamples, arrived: state.arrived,
    });
    assert(state.arrived === false, `premature arrival on sample ${k + 1}`);
    assert(state.arrivalSamples === 0, `arrival samples accumulated on sample ${k + 1}`);
    assert(state.status === null, `unexpected status transition on sample ${k + 1}`);
  }
});

// ---------------------------------------------------------------------------
// T4: false arrival followed by continued movement.
// Two qualifying fixes arrive; then the driver keeps moving -> un-arrive with
// hysteresis, back to navigating, samples reset.
// ---------------------------------------------------------------------------
check("false arrival recovery", () => {
  let s = { arrivalSamples: 0, arrived: false };
  s = evaluateArrivalState({ progress: 0.99, finalDistanceM: 10, remainingRouteM: 20, ...s });
  assert(s.arrived === false && s.arrivalSamples === 1, "first qualifying fix should sample, not arrive");
  s = evaluateArrivalState({ progress: 0.992, finalDistanceM: 9, remainingRouteM: 18, ...s });
  assert(s.arrived === true && s.status === "arrived", "two qualifying fixes must arrive");
  // Driver blows past the pin: clearly still en route.
  s = evaluateArrivalState({
    progress: 0.90, finalDistanceM: 150, remainingRouteM: 250,
    arrivalSamples: s.arrivalSamples, arrived: s.arrived,
  });
  assert(s.arrived === false, "continued movement must un-arrive");
  assert(s.status === "navigating", "un-arrive must transition to navigating");
  assert(s.arrivalSamples === 0, "un-arrive must reset samples");
  // One ambiguous fix afterwards must not instantly re-arrive.
  s = evaluateArrivalState({
    progress: 0.905, finalDistanceM: 140, remainingRouteM: 240,
    arrivalSamples: s.arrivalSamples, arrived: s.arrived,
  });
  assert(s.arrived === false && s.status === null, "must not re-arrive on a single ambiguous fix");
  results.unarriveStatus = "navigating";
});

// ---------------------------------------------------------------------------
// T5: endpoint route-line continuity.
// The remaining line is anchored at the snapped (on-road) coordinate and keeps
// a minimum tail near the destination: no collapse to a point, no diagonal
// from a stale/raw position through buildings.
// ---------------------------------------------------------------------------
check("endpoint route-line continuity", () => {
  const coords = [];
  for (let k = 0; k < 10; k++) coords.push([-76.0000 + k * 0.0002, 36.8500 + k * 0.00002]);
  const snapCoord = [-75.99835, 36.850075]; // on-road near the end
  const tail = remainingRouteLine(snapCoord, coords, 8);
  assert(tail.length >= 4, `endpoint tail collapsed to ${tail.length} points`);
  assert(tail[0] === snapCoord, "remaining line must start at the snapped coordinate");
  const last = tail[tail.length - 1];
  assert(last[0] === coords[9][0] && last[1] === coords[9][1],
    "remaining line must preserve the destination endpoint");
  // Mid-route: contiguous downstream slice, no backward jump.
  const mid = remainingRouteLine(snapCoord, coords, 3);
  assert(mid[0] === snapCoord, "mid-route line must start at the snapped coordinate");
  assert(mid[1][0] === coords[4][0] && mid[1][1] === coords[4][1],
    "mid-route line must continue downstream without a diagonal jump");
  // Anchor-identity audit: the first point is the on-road snap, so the segment
  // from it to the next route point follows the road, not a raw-fix diagonal.
  const gapM = haversineMeters(mid[0], mid[1]);
  assert(gapM < 120, `snap-to-next-point gap implausibly large (${gapM.toFixed(1)} m)`);
  results.endpointTailPoints = tail.length;
});

// ---------------------------------------------------------------------------
// T6: reroute gate satisfiability (2026-09-15 iPhone road test).
// Kendall deviated at Newtown Rd and no reroute ever fired. Root cause: the
// policy required matchConfidence >= 0.20 for canReroute, but any fix far
// enough off-route to count (distance_m > thresholdM >= 32 m) drives the HMM
// match confidence toward 0 — the two gates were mutually exclusive, so the
// reroute was dead code. canReroute must depend on GPS fix quality only; the
// fusion usableForReroute gate in the hook remains the second layer.
// ---------------------------------------------------------------------------
check("reroute gate satisfiable off-route", () => {
  for (const accuracyM of [8, 12, 20, 30, 60]) {
    // Off-route snap: far from the route, match confidence collapsed —
    // exactly the state a deviated driver is in.
    const policy = reroutePolicy({ accuracy_m: accuracyM }, { distance_m: 500, match_confidence: 0.01 });
    assert(policy.thresholdM <= 500,
      `accuracy ${accuracyM}: 500 m off-route must exceed threshold ${policy.thresholdM}`);
    assert(policy.canReroute === true,
      `accuracy ${accuracyM}: good GPS fix off-route must allow reroute (confidence=${policy.confidence.toFixed(2)})`);
  }
  // Dead-reckoned fixes still must NOT authorize a reroute on their own.
  const dr = reroutePolicy({ accuracy_m: 10, dead_reckoned: true }, { distance_m: 500, match_confidence: 0.01 });
  assert(dr.canReroute === false, "dead-reckoned fix must not authorize a reroute");
  // Very poor GPS (confidence exp(-200/90) ~= 0.11 < 0.35) must NOT reroute.
  const bad = reroutePolicy({ accuracy_m: 200 }, { distance_m: 500, match_confidence: 0.01 });
  assert(bad.canReroute === false, "very poor GPS fix must not authorize a reroute");
  results.rerouteGate = "satisfiable";
});

console.log(JSON.stringify({ ok: true, suite: "navigation-regressions", results }, null, 2));
