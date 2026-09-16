import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Layers3 } from "lucide-react";
import { base44LiveFunctions } from "@/api/base44Client";
import {
  rendererInterpolationBudgetMs,
  shouldAcceptNavigationSample,
} from "@/lib/navigationPerformance";

const ROUTE_SOURCE = "lokin-live-route";
const ROUTE_CASING = "lokin-live-route-casing";
const ROUTE_LINE = "lokin-live-route-line";
const LOKIN_NEON_ROUTE = "#8FE44E";

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
      // Dark casing under the neon line: the active route reads clearly over
      // night basemaps and busy satellite texture while driving.
      "line-color": "#060B04",
      "line-opacity": 0.92,
      "line-width": ["interpolate", ["linear"], ["zoom"], 11, 13, 17, 26],
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
      "line-color": "#8FE44E",
      "line-width": ["interpolate", ["linear"], ["zoom"], 11, 7, 17, 13],
      "line-opacity": 1,
      "line-blur": 2,
    },
  });
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
  root.style.border = "3px solid rgba(0,229,255,.72)";
  root.style.background = "rgba(0,229,255,.15)";
  root.style.boxShadow = "0 0 0 5px rgba(0,229,255,.08), 0 0 18px rgba(0,229,255,.45)";
  root.style.display = "grid";
  root.style.placeItems = "center";
  root.style.position = "relative";
  root.style.willChange = "transform";

  const pulse = document.createElement("div");
  pulse.style.position = "absolute";
  pulse.style.inset = "-9px";
  pulse.style.borderRadius = "999px";
  pulse.style.border = "2px solid rgba(0,229,255,.55)";
  pulse.style.animation = "lokin-marker-pulse 2.2s ease-out infinite";
  pulse.style.pointerEvents = "none";
  root.appendChild(pulse);

  const arrow = document.createElement("div");
  arrow.style.width = "0";
  arrow.style.height = "0";
  arrow.style.borderLeft = "10px solid transparent";
  arrow.style.borderRight = "10px solid transparent";
  arrow.style.borderBottom = "29px solid #B7FF42";
  arrow.style.filter = "drop-shadow(0 0 5px rgba(168,255,0,.95)) drop-shadow(0 1px 0 #071009)";
  arrow.style.transform = "translateY(-2px)";
  root.appendChild(arrow);
  return root;
}

export default function LiveVectorMap({
  routeGeometry,
  snappedPosition,
  perspective = false,
  followDriver = true,
  style = "dark-v11",
  heading = 0,
  speedMps = 0,
  resetRevision = 0,
  onReady,
  onUnavailable,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const animationRef = useRef(null);
  const routeRef = useRef(routeGeometry);
  const callbacksRef = useRef({ onReady, onUnavailable });
  const loadedRef = useRef(false);
  const interactingRef = useRef(false);
  const resumeTimerRef = useRef(null);
  const horizonGestureRef = useRef({ active: false, pointerId: null, startY: 0, startPitch: 78, startZoom: 16.6 });
  const preferredPitchRef = useRef(perspective ? 78 : 0);
  const styleRef = useRef(style);
  const displayedRef = useRef({
    coordinate: normalizeCoordinate(snappedPosition?.coordinate),
    bearing: Number(heading || 0),
  });
  const motionRef = useRef(null);
  const lastAppliedRenderSampleRef = useRef(null);
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const [cameraPitch, setCameraPitch] = useState(perspective ? 78 : 0);

  routeRef.current = routeGeometry;
  styleRef.current = style;
  callbacksRef.current = { onReady, onUnavailable };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;
    let disposed = false;
    let startupTimer = null;
    let map = null;

    async function start() {
      try {
        const response = await base44LiveFunctions.functions.invoke("navigation-engine", { action: "map_config" });
        const config = response?.data?.map_config;
        const accessToken = String(config?.access_token || "").trim();
        if (!accessToken.startsWith("pk.")) {
          throw new Error("A restricted Mapbox public token is required for live vector navigation");
        }
        if (disposed || !containerRef.current) return;

        mapboxgl.accessToken = accessToken;
        const initial = normalizeCoordinate(snappedPosition?.coordinate)
          || normalizeCoordinate(routeRef.current?.coordinates?.[0])
          || [-76.0528, 36.8529];

        map = new mapboxgl.Map({
          container: containerRef.current,
          style: styleUrl(style),
          center: initial,
          zoom: snappedPosition?.coordinate ? (perspective ? 16.6 : 16.8) : 13,
          bearing: perspective ? Number(heading || 0) : 0,
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
        map.on("pitch", (event) => {
          const nextPitch = clamp(map.getPitch(), 0, 80);
          setCameraPitch(nextPitch);
          if (event?.originalEvent) preferredPitchRef.current = nextPitch;
        });

        map.on("style.load", () => {
          if (disposed) return;
          configureImmersiveStyle(map, styleRef.current);
          addNavigationLayers(map, routeRef.current);
          applyDuskTreatment(map, isAerialStyle(styleRef.current));
          if (!loadedRef.current) {
            loadedRef.current = true;
            window.clearTimeout(startupTimer);
            setStatus("ready");
            callbacksRef.current.onReady?.();
          }
        });

        map.on("error", (event) => {
          if (disposed || loadedRef.current) return;
          const reason = event?.error?.message || "Live vector map failed to initialize";
          setMessage(reason);
        });

        startupTimer = window.setTimeout(() => {
          if (disposed || loadedRef.current) return;
          map?.remove();
          mapRef.current = null;
          setStatus("fallback");
          callbacksRef.current.onUnavailable?.("Live map startup exceeded 10 seconds");
        }, 10000);
      } catch (error) {
        if (disposed) return;
        const reason = error?.response?.data?.error || error?.message || "Live vector map is unavailable";
        setMessage(reason);
        setStatus("fallback");
        callbacksRef.current.onUnavailable?.(reason);
      }
    }

    start();
    return () => {
      disposed = true;
      window.clearTimeout(startupTimer);
      window.clearTimeout(resumeTimerRef.current);
      if (animationRef.current != null) window.cancelAnimationFrame(animationRef.current);
      markerRef.current?.remove();
      markerRef.current = null;
      map?.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const apply = () => addNavigationLayers(map, routeGeometry);
    if (map.isStyleLoaded()) apply();
    else map.once("style.load", apply);
  }, [routeGeometry]);

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
    });
  }, [style]);

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
    if (map && loadedRef.current && followDriver && !interactingRef.current) {
      // 4D cinematic follow: default zoom ~16.5 with a slight speed-based pull-back.
      const targetZoom = perspective
        ? clamp(16.8 - Math.max(0, Number(speedMps || 0)) * 0.012, 16.0, 16.8)
        : clamp(17.1 - Math.max(0, Number(speedMps || 0)) * 0.015, 16.1, 17.1);
      map.easeTo({
        center: target,
        offset: driverLockOffset(map, perspective),
        zoom: targetZoom,
        bearing: perspective ? Number(heading || 0) : 0,
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
    </div>
  );
}