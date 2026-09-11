import { DollarSign, Percent, Activity } from "lucide-react";

// Shared heat-map data + helpers used by both the Hot Spots page and the
// Route Planner heat overlay. Keeping a single source so intensity coloring,
// seeds, and metrics stay consistent across screens.

export const PLATFORMS = [
  { id: "doordash", name: "DoorDash", color: "#FF3008" },
  { id: "ubereats", name: "Uber Eats", color: "#06C167" },
  { id: "gopuff", name: "GoPuff", color: "#9B5DE5" },
  { id: "instacart", name: "Instacart", color: "#43B02A" },
];

export const METRICS = [
  { id: "earnings", label: "Earnings", unit: "$", icon: DollarSign },
  { id: "tips", label: "Tips", unit: "%", icon: Percent },
  { id: "volume", label: "Volume", unit: "", icon: Activity },
];

// Hotspot seeds: offsets (degrees) from the live map center + earning attributes.
// base = blended $/hr, tips = avg tip %, volume = relative demand 0-100, platforms = which apps run hot here.
export const SEEDS = [
  { name: "Downtown Core", dx: 0.012, dy: 0.006, base: 34, tips: 22, volume: 96, platforms: ["doordash", "ubereats", "gopuff", "instacart"] },
  { name: "Midtown Plaza", dx: -0.009, dy: 0.013, base: 31, tips: 19, volume: 88, platforms: ["doordash", "ubereats", "instacart"] },
  { name: "University Strip", dx: 0.018, dy: -0.011, base: 29, tips: 24, volume: 82, platforms: ["ubereats", "doordash", "instacart"] },
  { name: "Hospital District", dx: -0.015, dy: -0.007, base: 27, tips: 17, volume: 74, platforms: ["doordash", "instacart"] },
  { name: "Stadium Zone", dx: 0.022, dy: 0.018, base: 30, tips: 21, volume: 79, platforms: ["ubereats", "doordash", "gopuff"] },
  { name: "Riverside Shops", dx: -0.022, dy: 0.004, base: 26, tips: 16, volume: 68, platforms: ["instacart", "doordash"] },
  { name: "Tech Park Loop", dx: 0.006, dy: -0.019, base: 28, tips: 18, volume: 71, platforms: ["doordash", "ubereats", "gopuff"] },
  { name: "Old Town Square", dx: -0.004, dy: 0.019, base: 25, tips: 20, volume: 63, platforms: ["ubereats", "instacart"] },
  { name: "Harbor Point", dx: 0.026, dy: -0.016, base: 24, tips: 15, volume: 59, platforms: ["doordash", "gopuff"] },
  { name: "Greenview Mall", dx: -0.018, dy: -0.018, base: 23, tips: 14, volume: 55, platforms: ["instacart", "doordash"] },
];

export const DEFAULT_CENTER = [40.7128, -74.006];

// Color-coded intensity thresholds per metric — neon lime = coolest, red = hottest.
export const THRESHOLDS = {
  earnings: [32, 28, 25], // $/hr
  tips: [22, 18, 15], // %
  volume: [85, 72, 60], // 0-100
};

export function heatColor(metric, val) {
  const [red, orange, yellow] = THRESHOLDS[metric];
  if (val >= red) return "#FF3B3B";
  if (val >= orange) return "#FF8A00";
  if (val >= yellow) return "#FFD200";
  return "#8FE44E";
}

export function metricValue(h, metric) {
  if (metric === "tips") return h.tips;
  if (metric === "volume") return h.volume;
  return h.perHour;
}

export function metricDisplay(h, metric) {
  if (metric === "earnings") return `$${h.perHour}`;
  if (metric === "tips") return `${h.tips}%`;
  return `${h.volume}`;
}

export function haversineMi(a, b) {
  const R = 3958.8;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const la1 = (a[0] * Math.PI) / 180;
  const la2 = (b[0] * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// Build absolute hotspot objects relative to a map center.
export function buildHotspots(center) {
  return SEEDS.map((s, i) => {
    const lat = center[0] + s.dy;
    const lng = center[1] + s.dx;
    const perHour = Math.round((s.base + s.tips * 0.04) * 10) / 10;
    return { ...s, id: i, lat, lng, perHour, dist: haversineMi(center, [lat, lng]) };
  });
}