// Mapbox layer chrome for GPS voice annotations (SPEC-002 section 6).
// Provisional: dashed amber outline (#FFB020 — the existing hazard amber) with
// the "DRIVER_REPORTED — tap to confirm" label. Confirmed: solid amber outline,
// provenance label stays. Nothing else on the map is touched.
import { ANNOTATION_KINDS, subtypeLabel } from "@/lib/gpsAnnotationParser";

export const ANNO_SOURCE = "lokin-gps-annotations";
export const ANNO_LINE_PROVISIONAL = "lokin-gps-anno-line-provisional";
export const ANNO_LINE_CONFIRMED = "lokin-gps-anno-line-confirmed";
export const ANNO_LABEL = "lokin-gps-anno-label";
export const ANNO_COLOR = "#FFB020";
export const ANNO_RADIUS_M = 50;
export const ANNO_CONFIRM_PROMPT = "DRIVER_REPORTED — TAP TO CONFIRM";

export function mapAnnotationLabel(kind, subtype, status) {
  const type = kind === ANNOTATION_KINDS.HAZARD ? "HAZARD" : subtypeLabel(subtype);
  return status === "confirmed" ? `${type} · DRIVER_REPORTED` : `${type} · ${ANNO_CONFIRM_PROMPT}`;
}

// A real 50m circle around the driver's GPS fix — computed geometry from a
// real position, never invented. No position → no feature (caller's job).
export function annotationCircleFeature(annotation) {
  const [lng, lat] = annotation.coordinate;
  const mPerDegLat = 110574;
  const mPerDegLng = 111320 * Math.cos((lat * Math.PI) / 180) || 1;
  const steps = 64;
  const ring = [];
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * Math.PI * 2;
    ring.push([
      lng + (Math.sin(theta) * ANNO_RADIUS_M) / mPerDegLng,
      lat + (Math.cos(theta) * ANNO_RADIUS_M) / mPerDegLat,
    ]);
  }
  return {
    type: "Feature",
    properties: {
      localId: annotation.localId,
      kind: annotation.kind,
      subtype: annotation.subtype || "",
      status: annotation.status,
      label: mapAnnotationLabel(annotation.kind, annotation.subtype, annotation.status),
    },
    geometry: { type: "Polygon", coordinates: [ring] },
  };
}

export function ensureAnnotationLayers(map) {
  if (!map || typeof map.getSource !== "function") return;
  if (!map.getSource(ANNO_SOURCE)) {
    map.addSource(ANNO_SOURCE, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }
  if (!map.getLayer(ANNO_LINE_PROVISIONAL)) {
    map.addLayer({
      id: ANNO_LINE_PROVISIONAL,
      type: "line",
      source: ANNO_SOURCE,
      filter: ["==", ["get", "status"], "provisional"],
      paint: {
        "line-color": ANNO_COLOR,
        "line-opacity": 0.95,
        "line-width": ["interpolate", ["linear"], ["zoom"], 13, 2, 17, 3.5],
        "line-dasharray": [1.5, 1.5],
      },
    });
  }
  if (!map.getLayer(ANNO_LINE_CONFIRMED)) {
    map.addLayer({
      id: ANNO_LINE_CONFIRMED,
      type: "line",
      source: ANNO_SOURCE,
      filter: ["==", ["get", "status"], "confirmed"],
      paint: {
        "line-color": ANNO_COLOR,
        "line-opacity": 0.95,
        "line-width": ["interpolate", ["linear"], ["zoom"], 13, 2, 17, 3.5],
      },
    });
  }
  if (!map.getLayer(ANNO_LABEL)) {
    map.addLayer({
      id: ANNO_LABEL,
      type: "symbol",
      source: ANNO_SOURCE,
      minzoom: 12,
      layout: {
        "text-field": ["get", "label"],
        "text-font": ["Noto Sans Regular"],
        "text-size": 10,
        "text-offset": [0, -1.8],
        "text-allow-overlap": true,
        "text-ignore-placement": true,
      },
      paint: {
        "text-color": ANNO_COLOR,
        "text-halo-color": "#050505",
        "text-halo-width": 1.2,
      },
    });
  }
}

export function syncAnnotations(map, annotations) {
  if (!map || typeof map.getSource !== "function") return;
  ensureAnnotationLayers(map);
  const source = map.getSource(ANNO_SOURCE);
  if (!source) return;
  source.setData({
    type: "FeatureCollection",
    features: annotations.map(annotationCircleFeature),
  });
  // Route and stop layers rebuild with the default top slot, so keep the
  // annotation chrome pinned above them on every sync.
  try {
    for (const id of [ANNO_LABEL, ANNO_LINE_CONFIRMED, ANNO_LINE_PROVISIONAL]) {
      if (map.getLayer(id)) map.moveLayer(id);
    }
  } catch {
    // Style mid-swap; the next sync re-applies.
  }
}