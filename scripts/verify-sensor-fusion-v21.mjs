import assert from "node:assert/strict";
import { deadReckoningEnvelope, reroutePolicy } from "../src/lib/navigationQuality.js";
import { matchToRouteHMM, routeCumulativeDistances } from "../src/lib/navigationGeometry.js";

function tunnelScenario() {
  const at15 = deadReckoningEnvelope(6, 15);
  const at20 = deadReckoningEnvelope(6, 20);
  const at21 = deadReckoningEnvelope(6, 21);
  assert.equal(at15.usableForMapContinuity, true, "15s tunnel gap should retain bounded map continuity");
  assert.equal(at20.usableForMapContinuity, true, "20s tunnel boundary should remain bounded/visible");
  assert.equal(at21.usableForMapContinuity, false, "dead reckoning must stop beyond calibrated maximum age");
  const policy = reroutePolicy({ accuracy_m: at15.uncertaintyM, confidence: at15.confidence, dead_reckoned: true }, { match_confidence: 0.7 });
  assert.equal(policy.canReroute, false, "dead-reckoned tunnel samples must not cause network reroutes");
  return { confidenceAt15s: at15.confidence, uncertaintyAt15sM: at15.uncertaintyM };
}

function urbanCanyonScenario() {
  const policy = reroutePolicy({ accuracy_m: 45, confidence: 0.55, dead_reckoned: false }, { match_confidence: 0.31 });
  assert.ok(policy.thresholdM >= 100, "urban canyon threshold should expand under poor accuracy/match confidence");
  assert.ok(policy.requiredSamples >= 5, "urban canyon must require repeated evidence before rerouting");
  assert.equal(policy.canReroute, true, "a real absolute anchor may eventually confirm a reroute");
  return policy;
}

function highwayParallelRoadScenario() {
  const route = [
    [-75.9800, 36.8500],
    [-75.9700, 36.8500],
    [-75.9600, 36.8500],
    [-75.9500, 36.8500],
  ];
  const cumulative = routeCumulativeDistances(route);
  const first = matchToRouteHMM([-75.976, 36.85003], route, cumulative, { heading: 90, speedMps: 25, accuracyM: 7, timestamp: 1_000 });
  const second = matchToRouteHMM([-75.968, 36.85004], route, cumulative, { previousSnap: { ...first, timestamp: 1_000, speed_mps: 25 }, heading: 90, speedMps: 25, accuracyM: 8, timestamp: 2_800 });
  assert.ok(second.along_route_m > first.along_route_m, "highway matcher must preserve forward continuity");
  assert.ok(second.match_confidence > 0.5, "highway match confidence should remain useful");
  return { firstSegment: first.segment_index, secondSegment: second.segment_index, confidence: second.match_confidence };
}

function goodAnchorScenario() {
  const policy = reroutePolicy({ accuracy_m: 7, confidence: 0.93, dead_reckoned: false }, { match_confidence: 0.91 });
  assert.equal(policy.requiredSamples, 3, "clean absolute anchors should permit fast confirmed rerouting");
  assert.ok(policy.thresholdM <= 40, "clean anchors should retain tight off-route threshold");
  return policy;
}

const results = {
  ok: true,
  tunnelGarage: tunnelScenario(),
  urbanCanyon: urbanCanyonScenario(),
  highwayParallelRoad: highwayParallelRoadScenario(),
  cleanAnchor: goodAnchorScenario(),
};
console.log(JSON.stringify(results, null, 2));
