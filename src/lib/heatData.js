import { DollarSign, Percent, Activity } from "lucide-react";

// Shared heat-map helpers used by the Hot Spots page and related overlays.
// These are pure display helpers (color coding, metric formatting) that run
// against REAL server-provided offer zones only. Simulated seed data was
// purged before the App Store 1.0 review build.

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
