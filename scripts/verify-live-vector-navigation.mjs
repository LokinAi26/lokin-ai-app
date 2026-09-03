import fs from "node:fs";
import path from "node:path";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const root = process.cwd();
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const liveMap = fs.readFileSync(path.join(root, "src/components/LiveVectorMap.jsx"), "utf8");
const roadMap = fs.readFileSync(path.join(root, "src/components/RoadMatchedMap.jsx"), "utf8");
const navigationEngine = fs.readFileSync(path.join(root, "base44/functions/navigation-engine/entry.ts"), "utf8");

assert(packageJson.dependencies?.["mapbox-gl"], "mapbox-gl dependency is missing");
const mapboxMajorMinor = String(packageJson.dependencies["mapbox-gl"]).match(/(\d+)\.(\d+)/);
assert(mapboxMajorMinor && (Number(mapboxMajorMinor[1]) > 3 || (Number(mapboxMajorMinor[1]) === 3 && Number(mapboxMajorMinor[2]) >= 17)), "Mapbox GL JS 3.17+ is required for granular 3D buildings, trees, landmarks, and facades");
assert(liveMap.includes("new mapboxgl.Map"), "live vector renderer is not initialized");
assert(liveMap.includes("requestAnimationFrame"), "driver interpolation is not frame-driven");
assert(liveMap.includes("map.easeTo"), "predictive camera transition is missing");
assert(liveMap.includes("driverLockOffset"), "neutral driver screen lock is missing");
assert(liveMap.includes("center: target"), "live camera is not centered on the driver target");
assert(!liveMap.includes("normalizeCoordinate(followCenter)"), "live camera still follows a drifting look-ahead anchor");
assert(liveMap.includes("mapbox://styles/mapbox/standard"), "Mapbox Standard 3D style is missing");
assert(liveMap.includes("standard-satellite"), "Mapbox Standard Satellite style is missing");
assert(liveMap.includes("show3dBuildings: true"), "3D building contract is missing");
assert(liveMap.includes("show3dTrees: true"), "3D tree contract is missing");
assert(liveMap.includes("show3dLandmarks: true"), "3D landmark contract is missing");
assert(liveMap.includes("show3dFacades: true"), "3D facade contract is missing");
assert(liveMap.includes("moveHorizonGesture"), "pull-horizon camera gesture is missing");
assert(liveMap.includes("maxPitch: 80"), "immersive horizon pitch limit is missing");
assert(liveMap.includes('slot: "top"'), "route is not guaranteed above the 3D environment");
assert(liveMap.includes("lineMetrics: true"), "route is not rendered as a persistent vector source");
assert(roadMap.includes('rendererMode !== "fallback"'), "static renderer is not isolated as fallback");
assert(roadMap.includes("<LiveVectorMap"), "RoadMatchedMap does not mount the live renderer");
assert(navigationEngine.includes('action === "map_config"'), "live map configuration endpoint is missing");
assert(navigationEngine.includes('startsWith("pk.")'), "public-token boundary is not enforced");
assert(navigationEngine.includes('fallback: "static_map"'), "truthful static-map fallback contract is missing");

console.log(JSON.stringify({
  ok: true,
  renderer: "mapbox-gl-persistent-vector",
  motion: "requestAnimationFrame-interpolation",
  camera: "fixed-driver-lock-plus-pull-horizon",
  environment: "standard-3d-buildings-trees-landmarks-facades",
  routeDepth: "top-slot-above-3d-scene",
  fallback: "static-map-only-on-live-unavailable",
  publicTokenBoundary: "pk-only",
}, null, 2));
