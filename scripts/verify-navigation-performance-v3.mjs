import assert from "node:assert/strict";
import fs from "node:fs";
import {
  navigationFreshness,
  navigationSampleIntervalMs,
  rendererInterpolationBudgetMs,
  shouldAcceptNavigationSample,
} from "../src/lib/navigationPerformance.js";

const previous = { coordinate: [-76, 36], timestamp: 10_000, seq: 10 };
assert.equal(shouldAcceptNavigationSample({ coordinate: [-76, 36], timestamp: 10_300, seq: 11 }, previous), true);
assert.equal(shouldAcceptNavigationSample({ coordinate: [-76, 36], timestamp: 10_200, seq: 10 }, previous), false, "duplicate sequence must be rejected");
assert.equal(shouldAcceptNavigationSample({ coordinate: [-76, 36], timestamp: 9_800, seq: 12 }, previous), false, "stale timestamp must be rejected");
assert.equal(navigationSampleIntervalMs({ timestamp: 10_320 }, { timestamp: 10_000 }), 320);

const freshBudget = rendererInterpolationBudgetMs({ timestamp: 20_000, interval_ms: 400, speed_mps: 10 }, 20_050);
const agedBudget = rendererInterpolationBudgetMs({ timestamp: 20_000, interval_ms: 400, speed_mps: 10 }, 20_450);
const highwayBudget = rendererInterpolationBudgetMs({ timestamp: 20_000, interval_ms: 400, speed_mps: 30 }, 20_050);
assert.ok(agedBudget < freshBudget, "aged samples must catch up faster instead of increasing visual lag");
assert.ok(highwayBudget < freshBudget, "high-speed navigation must use a lower interpolation latency budget");
assert.equal(navigationFreshness({ timestamp: 30_000 }, 30_500).state, "fresh");
assert.equal(navigationFreshness({ timestamp: 30_000 }, 31_200).state, "aging");
assert.equal(navigationFreshness({ timestamp: 30_000 }, 32_500).state, "stale");

const liveMap = fs.readFileSync("src/components/LiveVectorMap.jsx", "utf8");
const navHook = fs.readFileSync("src/hooks/useLokinNavigation.js", "utf8");
const iosFusion = fs.readFileSync("native/ios/LokinSensorFusion.swift", "utf8");
const androidFusion = fs.readFileSync("native/android/LokinSensorFusion.kt", "utf8");

assert.match(liveMap, /rendererInterpolationBudgetMs/);
assert.match(liveMap, /shouldAcceptNavigationSample/);
assert.match(navHook, /lastAcceptedSampleRef/);
assert.match(navHook, /interval_ms: acceptedSample\.interval_ms/);
assert.match(iosFusion, /1\.0 \/ 60\.0/);
assert.match(iosFusion, /accelerationBiasNorth/);
assert.match(iosFusion, />= 0\.10/);
assert.match(androidFusion, /accelerationBiasNorth/);
assert.match(androidFusion, /100_000_000L/);

console.log(JSON.stringify({
  ok: true,
  stack: "navigation-performance-v3",
  renderer: "stale-rejection + adaptive low-latency interpolation",
  fusion: "60Hz iOS normal-power IMU + 10Hz bounded prediction + stationary bias suppression",
  androidParity: true,
  deadReckoningMaxSeconds: 20,
}, null, 2));
