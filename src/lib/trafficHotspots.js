// Traffic-delay hotspot clustering (2026-10-08): groups the driver's logged
// TrafficDelay records (TrafficLog) into map hotspots. Reports within 150 m of
// a cluster merge into it; an area with 2+ reports is "frequent" and renders
// as a red pin on the GPS map. Pure geometry from real logged records —
// nothing is estimated or invented.
import { haversineMeters } from "@/lib/navigationGeometry";

export const HOTSPOT_CLUSTER_M = 150;
export const FREQUENT_THRESHOLD = 2;
export const MAX_AGE_DAYS = 7;

function hotspotTimestamp(r) {
  const t = r?.reported_at
    ? new Date(r.reported_at).getTime()
    : r?.created_date
      ? new Date(r.created_date).getTime()
      : 0;
  return Number.isFinite(t) ? t : 0;
}

// Greedy merge: each record joins the first cluster within reach, and the
// cluster centroid is the running average of its members' coordinates.
export function clusterTrafficDelays(delays) {
  const cutoff = Date.now() - MAX_AGE_DAYS * 86400000;
  const clusters = [];
  for (const d of Array.isArray(delays) ? delays : []) {
    if (hotspotTimestamp(d) < cutoff) continue;
    const lat = Number(d?.latitude);
    const lon = Number(d?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const coord = [lon, lat];
    let target = null;
    for (const c of clusters) {
      if (haversineMeters(c.coordinate, coord) <= HOTSPOT_CLUSTER_M) {
        target = c;
        break;
      }
    }
    if (!target) {
      clusters.push({ latSum: lat, lonSum: lon, count: 1, totalDelay: Number(d.delay_minutes) || 0 });
      continue;
    }
    target.latSum += lat;
    target.lonSum += lon;
    target.count += 1;
    target.totalDelay += Number(d.delay_minutes) || 0;
  }
  return clusters.map((c) => {
    const count = c.count;
    const frequent = count >= FREQUENT_THRESHOLD;
    return {
      coordinate: [c.lonSum / count, c.latSum / count],
      count,
      avg_delay_minutes: Math.round(c.totalDelay / count),
      frequent,
    };
  });
}

// GeoJSON FeatureCollection for the map layer (and the fallback SVG).
export function hotspotFeatureCollection(hotspots) {
  return {
    type: "FeatureCollection",
    features: (Array.isArray(hotspots) ? hotspots : [])
      .filter((h) => Array.isArray(h?.coordinate) && h.coordinate.length === 2)
      .map((h) => ({
        type: "Feature",
        properties: {
          count: Number(h.count) || 1,
          avg_delay_minutes: Number(h.avg_delay_minutes) || 0,
          frequent: h.frequent === true,
          label: `×${Number(h.count) || 1} · ${Math.round(Number(h.avg_delay_minutes) || 0)}m avg`,
        },
        geometry: { type: "Point", coordinates: [Number(h.coordinate[0]), Number(h.coordinate[1])] },
      })),
  };
}