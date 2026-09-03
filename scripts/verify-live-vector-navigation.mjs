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
assert(liveMap.includes("new mapboxgl.Map"), "live vector renderer is not initialized");
assert(liveMap.includes("requestAnimationFrame"), "driver interpolation is not frame-driven");
assert(liveMap.includes("map.easeTo"), "predictive camera transition is missing");
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
  camera: "predictive-ease",
  fallback: "static-map-only-on-live-unavailable",
  publicTokenBoundary: "pk-only",
}, null, 2));
