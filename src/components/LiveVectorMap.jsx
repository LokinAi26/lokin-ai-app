import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Layers3 } from "lucide-react";
import { base44LiveFunctions } from "@/api/base44Client";
import {
  rendererInterpolationBudgetMs,
  shouldAcceptNavigationSample,
} from "@/lib/navigationPerformance";
import { mapArchitect, baggz247Master, meshBuilder } from "@/lib/mapArchitect";
import { retailExtrusion } from "@/lib/retailExtrusion";

const ROUTE_SOURCE = "lokin-live-route";
const ROUTE_CASING = "lokin-live-route-casing";
const ROUTE_LINE = "lokin-live-route-line";
const LOKIN_NEON_ROUTE = "#8FE44E";
// Cinematic art direction lock (2026-09-25): the route core is LOKIN Green
// #8FE44E — the single brand green, glowing against the dusk grade.
// Stop pins keep the same green so they read as markers, not route.
const STOPS_SOURCE = "lokin-delivery-stops";
const STOPS_INK = "#06100A";
const STOPS_FONT = ["Noto Sans Regular"];

// AERIAL mode is daytime satellite photography. The dusk treatment below is
// what makes it read as night: a dark fill above the raster (but below the
// basemap's labels) plus a touch of desaturation. NIGHT vector mode is
// untouched by all of this.
const DUSK_SOURCE = "lokin-dusk-overlay";
const DUSK_LAYER = "lokin-dusk-overlay";
const DUSK_FILL_COLOR = "#050914";
const DUSK_FILL_OPACITY = 0.45;
const WORLD_POLYGON = {
  type: "Feature",
  properties: {},
  geometry: {
    type: "Polygon",
    coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]],
  },
};

function isAerialStyle(style) {
  return style === "satellite-streets-v12";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value)));
}

function normalizeCoordinate(value) {
  if (!Array.isArray(value) || value.length < 2) return null;
  const longitude = Number(value[0]);
  const latitude = Number(value[1]);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  return [longitude, latitude];
}

function shortestBearing(from, to) {
  const start = Number.isFinite(Number(from)) ? Number(from) : 0;
  const end = Number.isFinite(Number(to)) ? Number(to) : start;
  return start + ((((end - start) % 360) + 540) % 360) - 180;
}

function lerp(from, to, progress) {
  return Number(from) + (Number(to) - Number(from)) * progress;
}

function interpolateCoordinate(from, to, progress) {
  return [lerp(from[0], to[0], progress), lerp(from[1], to[1], progress)];
}

function driverLockOffset(map, perspective) {
  if (!perspective) return [0, 0];
  const viewportHeight = Number(map?.getContainer?.()?.clientHeight || 0);
  return [0, Math.round(clamp(viewportHeight * 0.17, 72, 140))];
}

function styleUrl(style) {
  return style === "satellite-streets-v12"
    ? "mapbox://styles/mapbox/standard-satellite"
    : "mapbox://styles/mapbox/standard";
}

function configureImmersiveStyle(map, style) {
  // Keep the basemap quiet while driving: buildings stay for spatial context,
  // but landmark models, trees, and POI labels are muted so the glowing route
  // is the dominant feature of the view.
  const settings = {
    lightPreset: style === "satellite-streets-v12" ? "dusk" : "night",
    show3dObjects: true,
    show3dBuildings: true,
    show3dTrees: false,
    show3dLandmarks: false,
    show3dFacades: false,
    showPointOfInterestLabels: false,
  };
  Object.entries(settings).forEach(([property, value]) => {
    try {
      map.setConfigProperty("basemap", property, value);
    } catch {
      // Older cached style fragments may not expose every Standard setting.
    }
  });
}

function routeFeature(routeGeometry) {
  const coordinates = (routeGeometry?.coordinates || routeGeometry || [])
    .map(normalizeCoordinate)
    .filter(Boolean);
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates,
    },
  };
}

// Active delivery stops: each point carries its position in the optimized
// (fastest, fuel-saving) sequence. Nearby stops visually merge into a lime
// cluster bubble while the map is zoomed out; zooming in splits them back
// into individually numbered pins so the efficient order always reads.
function stopsFeatureCollection(stops) {
  const features = (Array.isArray(stops) ? stops : [])
    .map((stop) => {
      const coordinate = normalizeCoordinate(stop?.coordinate);
      if (!coordinate) return null;
      return {
        type: "Feature",
        properties: {
          sequence: Number(stop?.sequence) || 0,
        },
        geometry: { type: "Point", coordinates: coordinate },
      };
    })
    .filter(Boolean);
  return { type: "FeatureCollection", features };
}

function addDeliveryStopLayers(map, stops) {
  const data = stopsFeatureCollection(stops);
  if (map.getSource(STOPS_SOURCE)) {
    map.getSource(STOPS_SOURCE).setData(data);
    return;
  }
  map.addSource(STOPS_SOURCE, {
    type: "geojson",
    data,
    cluster: true,
    clusterRadius: 46,
    clusterMaxZoom: 15,
  });
  map.addLayer({
    id: "lokin-stop-cluster-halo",
    type: "circle",
    source: STOPS_SOURCE,
    slot: "top",
    filter: ["has", "point_count"],
    paint: {
      "circle-color": LOKIN_NEON_ROUTE,
      "circle-opacity": 0.24,
      "circle-blur": 0.85,
      "circle-radius": ["step", ["get", "point_count"], 15, 3, 20, 6, 24],
    },
  });
  map.addLayer({
    id: "lokin-stop-cluster",
    type: "circle",
    source: STOPS_SOURCE,
    slot: "top",
    filter: ["has", "point_count"],
    paint: {
      "circle-color": LOKIN_NEON_ROUTE,
      "circle-radius": ["step", ["get", "point_count"], 10, 3, 12, 6, 14],
      "circle-stroke-color": STOPS_INK,
      "circle-stroke-width": 2.5,
    },
  });
  map.addLayer({
    id: "lokin-stop-cluster-count",
    type: "symbol",
    source: STOPS_SOURCE,
    slot: "top",
    filter: ["has", "point_count"],
    layout: {
      "text-field": ["get", "point_count"],
      "text-font": STOPS_FONT,
      "text-size": 11,
      "text-allow-overlap": true,
    },
    paint: { "text-color": STOPS_INK },
  });
  map.addLayer({
    id: "lokin-stop-pin",
    type: "circle",
    source: STOPS_SOURCE,
    slot: "top",
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-color": LOKIN_NEON_ROUTE,
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 5.5, 17, 8.5],
      "circle-stroke-color": STOPS_INK,
      "circle-stroke-width": 2.5,
      "circle-opacity": 0.98,
    },
  });
  map.addLayer({
    id: "lokin-stop-number",
    type: "symbol",
    source: STOPS_SOURCE,
    slot: "top",
    filter: ["!", ["has", "point_count"]],
    layout: {
      "text-field": ["get", "sequence"],
      "text-font": STOPS_FONT,
      "text-size": 11,
      "text-allow-overlap": true,
      "text-ignore-placement": true,
    },
    paint: { "text-color": STOPS_INK },
  });
}

function addNavigationLayers(map, routeGeometry) {
  const data = routeFeature(routeGeometry);
  if (map.getSource(ROUTE_SOURCE)) {
    map.getSource(ROUTE_SOURCE).setData(data);
    return;
  }

  map.addSource(ROUTE_SOURCE, {
    type: "geojson",
    data,
    lineMetrics: true,
  });
  // Neon glow halo under the route (bloom for true LOKIN Green neon).
  map.addLayer({
    id: "lokin-live-route-glow",
    type: "line",
    source: ROUTE_SOURCE,
    slot: "top",
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": LOKIN_NEON_ROUTE,
      "line-opacity": 0.55,
      "line-width": ["interpolate", ["linear"], ["zoom"], 11, 18, 17, 30],
      "line-blur": 5,
    },
  });
  map.addLayer({
    id: ROUTE_CASING,
    type: "line",
    source: ROUTE_SOURCE,
    slot: "top",
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      // Thin dark edge for definition — narrow so the neon dominates.
      "line-color": "#060B04",
      "line-opacity": 0.95,
      "line-width": ["interpolate", ["linear"], ["zoom"], 11, 10, 17, 16],
    },
  });
  map.addLayer({
    id: ROUTE_LINE,
    type: "line",
    source: ROUTE_SOURCE,
    slot: "top",
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": LOKIN_NEON_ROUTE,
      "line-width": ["interpolate", ["linear"], ["zoom"], 11, 7, 17, 13],
      "line-opacity": 1,
      "line-blur": 0,
    },
  });
}

// ---------- Cinematic art direction (locked 2026-09-25) ----------
// Real-data cinematic grade for the GPS map: golden-hour dusk light, real
// terrain elevation, warm atmospheric haze. All real Mapbox sources — no
// invented geometry. Applied only in cinematic mode so the everyday driving
// view is untouched.
const TERRAIN_SOURCE = "lokin-cinematic-terrain";
const CINEMATIC_FOG = {
  color: "#e8c9a0",
  "high-color": "#f6ddb4",
  "horizon-blend": 0.1,
  "space-color": "#0a0f24",
  "star-intensity": 0.12,
  range: [0.6, 12],
};

function applyCinematicGrade(map, enabled, style) {
  if (!map || typeof map.setConfigProperty !== "function") return;
  try {
    if (enabled) {
      map.setConfigProperty("basemap", "lightPreset", "dusk");
      if (!map.getSource(TERRAIN_SOURCE)) {
        map.addSource(TERRAIN_SOURCE, {
          type: "raster-dem",
          url: "mapbox://mapbox.mapbox-terrain-dem-v1",
          tileSize: 512,
          maxzoom: 14,
        });
      }
      map.setTerrain({ source: TERRAIN_SOURCE, exaggeration: 1.15 });
      if (typeof map.setFog === "function") map.setFog(CINEMATIC_FOG);
    } else {
      // Restore the standard immersive treatment for this style.
      configureImmersiveStyle(map, style);
      try {
        map.setTerrain(null);
      } catch {
        // Terrain may never have applied (token scope); nothing to clear.
      }
      try {
        if (typeof map.setFog === "function") map.setFog(null);
      } catch {
        // No fog was set; nothing to clear.
      }
    }
  } catch {
    // Grade is decorative: a token without terrain scope or an older style
    // fragment must never break navigation. The map keeps working ungraded.
  }
}

function applyDuskTreatment(map, aerial) {
  if (!map || typeof map.getStyle !== "function") return;
  try {
    if (!map.getSource(DUSK_SOURCE)) {
      map.addSource(DUSK_SOURCE, { type: "geojson", data: WORLD_POLYGON });
    }
    if (!map.getLayer(DUSK_LAYER)) {
      const layers = map.getStyle()?.layers || [];
      const firstSymbol = layers.find((layer) => layer.type === "symbol");
      const duskLayer = {
        id: DUSK_LAYER,
        type: "fill",
        source: DUSK_SOURCE,
        paint: {
          "fill-color": DUSK_FILL_COLOR,
          "fill-opacity": DUSK_FILL_OPACITY,
        },
      };
      // Insert just under the first label layer: the satellite raster gets
      // darkened while road labels, the glow route (slot top), and DOM
      // markers stay crisp on top.
      if (firstSymbol) map.addLayer(duskLayer, firstSymbol.id);
      else map.addLayer(duskLayer);
    }
    map.setLayoutProperty(DUSK_LAYER, "visibility", aerial ? "visible" : "none");
    (map.getStyle()?.layers || [])
      .filter((layer) => layer.type === "raster")
      .forEach((layer) => {
        try {
          map.setPaintProperty(layer.id, "raster-saturation", aerial ? -0.25 : 0);
        } catch {
          // Standard-style basemap layers may reject paint overrides.
        }
      });
  } catch {
    // Style not ready yet; the next style load re-applies.
  }
}

function createDriverMarker() {
  if (typeof document !== "undefined" && !document.getElementById("lokin-marker-pulse-keyframes")) {
    const styleTag = document.createElement("style");
    styleTag.id = "lokin-marker-pulse-keyframes";
    styleTag.textContent = "@keyframes lokin-marker-pulse{0%{transform:scale(.55);opacity:.9}70%{transform:scale(1.3);opacity:0}100%{transform:scale(1.3);opacity:0}}";
    document.head.appendChild(styleTag);
  }

  const root = document.createElement("div");
  root.setAttribute("aria-label", "Current road-matched location");
  root.style.width = "48px";
  root.style.height = "48px";
  root.style.borderRadius = "999px";
  root.style.border = "3px solid rgba(143,228,78,.8)";
  root.style.background = "rgba(143,228,78,.15)";
  root.style.boxShadow = "0 0 0 5px rgba(143,228,78,.08), 0 0 18px rgba(143,228,78,.45)";
  root.style.display = "grid";
  root.style.placeItems = "center";
  root.style.position = "relative";
  root.style.willChange = "transform";

  const pulse = document.createElement("div");
  pulse.style.position = "absolute";
  pulse.style.inset = "-9px";
  pulse.style.borderRadius = "999px";
  pulse.style.border = "2px solid rgba(143,228,78,.55)";
  pulse.style.animation = "lokin-marker-pulse 2.2s ease-out infinite";
  pulse.style.pointerEvents = "none";
  root.appendChild(pulse);

  const arrow = document.createElement("div");
  arrow.style.width = "0";
  arrow.style.height = "0";
  arrow.style.borderLeft = "10px solid transparent";
  arrow.style.borderRight = "10px solid transparent";
  arrow.style.borderBottom = "29px solid #B7FF42";
  arrow.style.filter = "drop-shadow(0 0 5px rgba(143,228,78,.95)) drop-shadow(0 1px 0 #071009)";
  arrow.style.transform = "translateY(-2px)";
  root.appendChild(arrow);
  return root;
}

// Destination beam: a vertical LOKIN-green light pillar marking the route
// destination. Pure DOM/CSS over the real map — no 3D geometry invented.
function createDestinationBeam() {
  if (typeof document !== "undefined" && !document.getElementById("lokin-beam-keyframes")) {
    const styleTag = document.createElement("style");
    styleTag.id = "lokin-beam-keyframes";
    styleTag.textContent = "@keyframes lokin-beam-flicker{0%,100%{opacity:.92}50%{opacity:.62}}";
    document.head.appendChild(styleTag);
  }
  const root = document.createElement("div");
  root.setAttribute("aria-label", "Destination");
  root.style.position = "relative";
  root.style.width = "30px";
  root.style.height = "150px";
  root.style.background = "linear-gradient(to top, rgba(143,228,78,.9), rgba(143,228,78,.28) 55%, rgba(143,228,78,0))";
  root.style.filter = "drop-shadow(0 0 12px rgba(143,228,78,.8))";
  root.style.animation = "lokin-beam-flicker 3.2s ease-in-out infinite";
  root.style.pointerEvents = "none";
  const base = document.createElement("div");
  base.style.position = "absolute";
  base.style.bottom = "-10px";
  base.style.left = "50%";
  base.style.width = "46px";
  base.style.height = "46px";
  base.style.transform = "translateX(-50%)";
  base.style.borderRadius = "999px";
  base.style.border = "3px solid rgba(143,228,78,.85)";
  base.style.background = "rgba(143,228,78,.18)";
  root.appendChild(base);
  return root;
}

// Keep the destination beam pinned to the route's end (the real destination).
// The beamRef lives on the component; this helper is called on style load and
// whenever the route geometry changes.
function updateDestinationBeam(map, beamRef, routeGeometry) {
  if (!map) return;
  const coordinates = routeFeature(routeGeometry).geometry.coordinates;
  if (coordinates.length < 2) {
    beamRef.current?.remove();
    beamRef.current = null;
    return;
  }
  const destination = coordinates[coordinates.length - 1];
  if (beamRef.current) {
    beamRef.current.setLngLat(destination);
  } else {
    beamRef.current = new mapboxgl.Marker({
      element: createDestinationBeam(),
      anchor: "bottom",
    })
      .setLngLat(destination)
      .addTo(map);
  }
}

// FPS meter for the cinematic mode — the 30 FPS shipping gate, measured live.
function CinematicFpsMeter() {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    let frames = 0;
    let raf = 0;
    let last = performance.now();
    const loop = (now) => {
      frames += 1;
      if (now - last >= 500) {
        setFps(Math.round((frames * 1000) / (now - last)));
        frames = 0;
        last = now;
      }
      raf = window.requestAnimationFrame(loop);
    };
    raf = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="absolute bottom-3 left-3 z-20 rounded-md border border-accent/30 bg-black/75 px-2 py-1 font-mono text-[10px] font-bold tracking-widest text-accent backdrop-blur">
      {fps} FPS
    </div>
  );
}

export default function LiveVectorMap({
  routeGeometry,
  deliveryStops = [],
  snappedPosition,
  perspective = false,
  followDriver = true,
  style = "dark-v11",
  style3d = true,
  quality = "balanced",
  heading = 0,
  speedMps = 0,
  resetRevision = 0,
  onReady,
  onUnavailable,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const beamRef = useRef(null);
  const orbitRef = useRef(null);
  const animationRef = useRef(null);
  const routeRef = useRef(routeGeometry);
  const stopsRef = useRef(deliveryStops);
  const callbacksRef = useRef({ onReady, onUnavailable });
  const loadedRef = useRef(false);
  const interactingRef = useRef(false);
  const resumeTimerRef = useRef(null);
  const horizonGestureRef = useRef({ active: false, pointerId: null, startY: 0, startPitch: 78, startZoom: 16.6 });
  const preferredPitchRef = useRef(perspective ? 78 : 0);
  const styleRef = useRef(style);
  const style3dRef = useRef(style3d);
  const qualityRef = useRef(quality);
  const displayedRef = useRef({
    coordinate: normalizeCoordinate(snappedPosition?.coordinate),
    bearing: Number(heading || 0),
  });
  const motionRef = useRef(null);
  const lastAppliedRenderSampleRef = useRef(null);
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const [cameraPitch, setCameraPitch] = useState(perspective ? 78 : 0);
  // Cinematic art direction mode (locked 2026-09-25): dusk grade, real
  // terrain, warm haze, orbit camera, destination beam, FPS meter.
  // Defaults on in perspective view so the staged look is immediately visible.
  const [cinematic, setCinematic] = useState(perspective);
  const cinematicRef = useRef(perspective);
  cinematicRef.current = cinematic;
  // Honest retail data-service status: idle | loading | ready | error.
  const [retailStatus, setRetailStatus] = useState("idle");

  routeRef.current = routeGeometry;
  stopsRef.current = deliveryStops;
  styleRef.current = style;
  style3dRef.current = style3d;
  qualityRef.current = quality;
  callbacksRef.current = { onReady, onUnavailable };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;
    let disposed = false;
    let startupTimer = null;
    let map = null;
    // Honest retail data-service status (error pill, auto-retrying).
    const offRetailStatus = retailExtrusion.onStatus(setRetailStatus);

    async function start() {
      // Startup watchdog FIRST: the map_config fetch below can hang
      // indefinitely (the invoke has no client-side timeout), so the timer
      // must be armed before any await — never after it.
      let timedOut = false;
      startupTimer = window.setTimeout(() => {
        if (disposed || loadedRef.current) return;
        timedOut = true;
        map?.remove();
        mapRef.current = null;
        setStatus("fallback");
        callbacksRef.current.onUnavailable?.("Live map startup exceeded 10 seconds");
      }, 10000);
      try {
        const response = await base44LiveFunctions.functions.invoke("navigation-engine", { action: "map_config" });
        const config = response?.data?.map_config;
        const accessToken = String(config?.access_token || "").trim();
        if (!accessToken.startsWith("pk.")) {
          throw new Error("A restricted Mapbox public token is required for live vector navigation");
        }
        // A late-resolving config after the watchdog fired must not build a
        // map behind the fallback UI.
        if (disposed || timedOut || !containerRef.current) return;

        mapboxgl.accessToken = accessToken;
        const initial = normalizeCoordinate(snappedPosition?.coordinate)
          || normalizeCoordinate(routeRef.current?.coordinates?.[0])
          || [-76.0528, 36.8529];

        map = new mapboxgl.Map({
          container: containerRef.current,
          style: styleUrl(style),
          center: initial,
          zoom: snappedPosition?.coordinate ? (perspective ? 16.6 : 16.8) : 13,
          bearing: Number(heading || 0),
          pitch: perspective ? 78 : 0,
          antialias: true,
          attributionControl: false,
          renderWorldCopies: false,
          fadeDuration: 0,
          maxPitch: 80,
          minZoom: 2,
          maxZoom: 19,
          cooperativeGestures: false,
        });
        mapRef.current = map;
        map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");

        const markerElement = createDriverMarker();
        markerRef.current = new mapboxgl.Marker({
          element: markerElement,
          anchor: "center",
          rotationAlignment: "map",
          pitchAlignment: "map",
        }).setLngLat(initial).setRotation(Number(heading || 0)).addTo(map);

        const markInteraction = () => {
          interactingRef.current = true;
          window.clearTimeout(resumeTimerRef.current);
        };
        const scheduleResume = () => {
          window.clearTimeout(resumeTimerRef.current);
          resumeTimerRef.current = window.setTimeout(() => {
            interactingRef.current = false;
          }, 4500);
        };
        map.on("dragstart", markInteraction);
        map.on("rotatestart", markInteraction);
        map.on("pitchstart", markInteraction);
        map.on("zoomstart", (event) => {
          if (event?.originalEvent) markInteraction();
        });
        map.on("moveend", scheduleResume);
        map.on("moveend", () => {
          if (disposed) return;
          retailExtrusion.refresh(map.getBounds());
        });
        map.on("pitch", (event) => {
          const nextPitch = clamp(map.getPitch(), 0, 80);
          setCameraPitch(nextPitch);
          if (event?.originalEvent) preferredPitchRef.current = nextPitch;
        });

        map.on("style.load", () => {
          if (disposed) return;
          configureImmersiveStyle(map, styleRef.current);
          addNavigationLayers(map, routeRef.current);
          addDeliveryStopLayers(map, stopsRef.current);
          retailExtrusion.reapplyAfterStyleLoad();
          if (style3dRef.current && qualityRef.current !== "performance") {
            meshBuilder.alignWithRoute(routeRef.current);
          }
          applyDuskTreatment(map, isAerialStyle(styleRef.current));
          applyCinematicGrade(map, cinematicRef.current, styleRef.current);
          updateDestinationBeam(map, beamRef, routeRef.current);
          if (!loadedRef.current) {
            loadedRef.current = true;
            window.clearTimeout(startupTimer);
            setStatus("ready");
            callbacksRef.current.onReady?.();
          }
        });

        map.on("load", () => {
          if (disposed) return;
          mapArchitect.map = map;
          baggz247Master.map = map;
          baggz247Master.registerSignatureLandmarks();
          baggz247Master.registerBatch2Landmarks();
          baggz247Master.registerBatch3Landmarks();
          baggz247Master.startAnimatedTraffic();
          meshBuilder.map = map;
          if (style3dRef.current && qualityRef.current !== "performance") {
            mapArchitect.enable3DBuildings();
            mapArchitect.enable3DLandmarks();
            mapArchitect.setQuality(qualityRef.current);
            baggz247Master.enhanceVisibleArea(map.getBounds());
            meshBuilder.startAnimations();
          }
          retailExtrusion.map = map;
          retailExtrusion.setEnabled(style3dRef.current && qualityRef.current !== "performance");
        });

        map.on("error", (event) => {
          if (disposed || loadedRef.current) return;
          const reason = event?.error?.message || "Live vector map failed to initialize";
          setMessage(reason);
        });
      } catch (error) {
        if (disposed || timedOut) return;
        const reason = error?.response?.data?.error || error?.message || "Live vector map is unavailable";
        setMessage(reason);
        setStatus("fallback");
        callbacksRef.current.onUnavailable?.(reason);
      }
    }

    start();
    return () => {
      disposed = true;
      offRetailStatus?.();
      window.clearTimeout(startupTimer);
      window.clearTimeout(resumeTimerRef.current);
      if (animationRef.current != null) window.cancelAnimationFrame(animationRef.current);
      if (orbitRef.current != null) window.cancelAnimationFrame(orbitRef.current);
      markerRef.current?.remove();
      markerRef.current = null;
      beamRef.current?.remove();
      beamRef.current = null;
      mapArchitect.destroy();
      baggz247Master.destroy();
      meshBuilder.destroy();
      retailExtrusion.destroy();
      map?.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const apply = () => {
      addNavigationLayers(map, routeGeometry);
      updateDestinationBeam(map, beamRef, routeGeometry);
      if (style3dRef.current && qualityRef.current !== "performance") {
        meshBuilder.alignWithRoute(routeGeometry);
      }
    };
    if (map.isStyleLoaded()) apply();
    else map.once("style.load", apply);
  }, [routeGeometry]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const apply = () => addDeliveryStopLayers(map, deliveryStops);
    if (map.isStyleLoaded()) apply();
    else map.once("style.load", apply);
  }, [deliveryStops]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    mapArchitect.setQuality(!style3d ? "performance" : quality);
    retailExtrusion.setEnabled(style3d && quality !== "performance");
  }, [style3d, quality]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const nextUrl = styleUrl(style);
    map.setStyle(nextUrl, { diff: true });
    // Diff updates keep custom layers, but the dusk treatment must follow the
    // new style's layer stack, so re-apply once the style settles.
    map.once("styledata", () => {
      const live = mapRef.current;
      if (!live) return;
      applyDuskTreatment(live, isAerialStyle(style));
      applyCinematicGrade(live, cinematicRef.current, style);
    });
  }, [style]);

  // Cinematic mode: apply the grade immediately and run the slow orbit camera.
  // The orbit pauses while the user is interacting and yields to the normal
  // follow camera the moment cinematic mode is switched off.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    applyCinematicGrade(map, cinematic, styleRef.current);
    if (orbitRef.current != null) window.cancelAnimationFrame(orbitRef.current);
    if (!cinematic) {
      orbitRef.current = null;
      return undefined;
    }
    let last = performance.now();
    const orbit = (now) => {
      orbitRef.current = window.requestAnimationFrame(orbit);
      const live = mapRef.current;
      if (!live || interactingRef.current) {
        last = now;
        return;
      }
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const driver = displayedRef.current.coordinate;
      if (driver) live.setCenter(driver);
      live.setBearing((live.getBearing() + dt * 2.4 + 360) % 360);
      live.setPitch(70 + Math.sin(now / 3200) * 5);
    };
    orbitRef.current = window.requestAnimationFrame(orbit);
    return () => {
      if (orbitRef.current != null) window.cancelAnimationFrame(orbitRef.current);
      orbitRef.current = null;
    };
  }, [cinematic, status]);

  useEffect(() => {
    const target = normalizeCoordinate(snappedPosition?.coordinate);
    const marker = markerRef.current;
    if (!target || !marker) return undefined;
    if (!shouldAcceptNavigationSample(snappedPosition, lastAppliedRenderSampleRef.current)) return undefined;
    lastAppliedRenderSampleRef.current = snappedPosition;

    const now = performance.now();
    const fromCoordinate = displayedRef.current.coordinate || target;
    const fromBearing = Number(displayedRef.current.bearing || heading || 0);
    const targetBearing = shortestBearing(fromBearing, heading);
    const duration = rendererInterpolationBudgetMs(snappedPosition);

    motionRef.current = {
      fromCoordinate,
      targetCoordinate: target,
      fromBearing,
      targetBearing,
      startedAt: now,
      duration,
    };

    if (animationRef.current != null) window.cancelAnimationFrame(animationRef.current);
    const tick = (time) => {
      const motion = motionRef.current;
      if (!motion || !markerRef.current) return;
      const linear = clamp((time - motion.startedAt) / motion.duration, 0, 1);
      const eased = linear * linear * (3 - 2 * linear);
      const coordinate = interpolateCoordinate(motion.fromCoordinate, motion.targetCoordinate, eased);
      const bearing = lerp(motion.fromBearing, motion.targetBearing, eased);
      displayedRef.current = { coordinate, bearing };
      markerRef.current.setLngLat(coordinate).setRotation(bearing);

      if (linear < 1) {
        animationRef.current = window.requestAnimationFrame(tick);
      } else {
        animationRef.current = null;
      }
    };
    animationRef.current = window.requestAnimationFrame(tick);

    const map = mapRef.current;
    if (map && loadedRef.current && followDriver && !interactingRef.current && !cinematicRef.current) {
      // 4D cinematic follow: default zoom ~16.5 with a slight speed-based pull-back.
      // Suppressed in cinematic mode — the orbit camera owns the frame there.
      const targetZoom = perspective
        ? clamp(16.8 - Math.max(0, Number(speedMps || 0)) * 0.012, 16.0, 16.8)
        : clamp(17.1 - Math.max(0, Number(speedMps || 0)) * 0.015, 16.1, 17.1);
      map.easeTo({
        center: target,
        offset: driverLockOffset(map, perspective),
        zoom: targetZoom,
        bearing: Number(heading || 0),
        pitch: perspective ? preferredPitchRef.current : 0,
        duration,
        easing: (value) => value * value * (3 - 2 * value),
        essential: true,
      });
    }

    return () => {
      if (animationRef.current != null) {
        window.cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [
    snappedPosition?.coordinate?.[0],
    snappedPosition?.coordinate?.[1],
    snappedPosition?.timestamp,
    snappedPosition?.seq,
    heading,
    perspective,
    followDriver,
    speedMps,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    const coordinate = normalizeCoordinate(displayedRef.current.coordinate || snappedPosition?.coordinate);
    if (!map || !coordinate || !loadedRef.current) return;
    interactingRef.current = false;
    preferredPitchRef.current = perspective ? 78 : 0;
    setCameraPitch(preferredPitchRef.current);
    window.clearTimeout(resumeTimerRef.current);
    map.easeTo({
      center: coordinate,
      offset: driverLockOffset(map, perspective),
      zoom: perspective ? 16.6 : 17,
      bearing: perspective ? Number(heading || 0) : 0,
      pitch: perspective ? 78 : 0,
      duration: 420,
      essential: true,
    });
  }, [resetRevision]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current || followDriver) return;
    const coordinates = routeFeature(routeGeometry).geometry.coordinates;
    if (coordinates.length < 2) return;
    const bounds = coordinates.reduce(
      (result, coordinate) => result.extend(coordinate),
      new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]),
    );
    map.fitBounds(bounds, { padding: 64, duration: 650, maxZoom: 16.5 });
  }, [followDriver, routeGeometry]);

  function beginHorizonGesture(event) {
    const map = mapRef.current;
    if (!perspective || !map || !loadedRef.current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    window.clearTimeout(resumeTimerRef.current);
    interactingRef.current = true;
    horizonGestureRef.current = {
      active: true,
      pointerId: event.pointerId,
      startY: event.clientY,
      startPitch: map.getPitch(),
      startZoom: map.getZoom(),
    };
  }

  function moveHorizonGesture(event) {
    const map = mapRef.current;
    const gesture = horizonGestureRef.current;
    if (!map || !gesture.active || gesture.pointerId !== event.pointerId) return;
    event.preventDefault();
    const deltaY = event.clientY - gesture.startY;
    const nextPitch = clamp(gesture.startPitch + deltaY * 0.32, 20, 80);
    const nextZoom = clamp(gesture.startZoom - (nextPitch - gesture.startPitch) * 0.012, 15.8, 19);
    preferredPitchRef.current = nextPitch;
    setCameraPitch(nextPitch);
    map.jumpTo({ pitch: nextPitch, zoom: nextZoom });
  }

  function endHorizonGesture(event) {
    const gesture = horizonGestureRef.current;
    if (!gesture.active || gesture.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    horizonGestureRef.current = { ...gesture, active: false, pointerId: null };
    window.clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = window.setTimeout(() => {
      interactingRef.current = false;
    }, 900);
  }

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" aria-label="LOKIN live vector navigation map" />
      {perspective && status === "ready" && (
        <button
          type="button"
          aria-label="Pull down or push up to adjust the horizon"
          className="absolute left-1/2 top-24 z-20 -translate-x-1/2 touch-none select-none rounded-full border border-accent/30 bg-black/75 px-3 py-2 text-[9px] font-extrabold tracking-[0.12em] text-accent shadow-lg backdrop-blur active:border-primary/60 active:text-primary"
          onPointerDown={beginHorizonGesture}
          onPointerMove={moveHorizonGesture}
          onPointerUp={endHorizonGesture}
          onPointerCancel={endHorizonGesture}
        >
          <span className="mr-1.5 inline-block h-1 w-6 rounded-full bg-primary/80 align-middle" />
          PULL HORIZON · {Math.round(cameraPitch)}°
        </button>
      )}
      {status === "ready" && (
        <button
          type="button"
          aria-label={cinematic ? "Turn off cinematic camera" : "Turn on cinematic camera"}
          onClick={() => setCinematic((value) => !value)}
          className={`absolute right-3 top-3 z-20 rounded-full border px-3 py-2 text-[9px] font-extrabold tracking-[0.12em] shadow-lg backdrop-blur transition-colors ${
            cinematic
              ? "border-accent/60 bg-accent/20 text-accent"
              : "border-white/20 bg-black/75 text-white/70"
          }`}
        >
          CINEMATIC {cinematic ? "ON" : "OFF"}
        </button>
      )}
      {cinematic && status === "ready" && <CinematicFpsMeter />}
      {status === "loading" && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#111820]">
          <div className="flex items-center gap-2 text-xs font-semibold text-accent">
            <Layers3 className="h-4 w-4 animate-pulse" />
            STARTING LIVE VECTOR MAP
          </div>
        </div>
      )}
      {status === "fallback" && message && (
        <div className="absolute inset-x-4 top-4 z-10 rounded-xl border border-amber-300/25 bg-black/85 px-3 py-2 text-center text-[10px] text-amber-200">
          {message}
        </div>
      )}
      {retailStatus === "error" && (
        <div className="absolute inset-x-4 top-16 z-10 rounded-xl border border-amber-300/25 bg-black/85 px-3 py-2 text-center text-[10px] text-amber-200">
          Store map data unavailable · retrying
        </div>
      )}
    </div>
  );
}