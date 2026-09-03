import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Layers3 } from "lucide-react";
import { base44LiveFunctions } from "@/api/base44Client";

const ROUTE_SOURCE = "lokin-live-route";
const ROUTE_CASING = "lokin-live-route-casing";
const ROUTE_LINE = "lokin-live-route-line";

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

function styleUrl(style) {
  return `mapbox://styles/mapbox/${style === "satellite-streets-v12" ? "satellite-streets-v12" : "dark-v11"}`;
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
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": "rgba(168,255,0,0.30)",
      "line-width": ["interpolate", ["linear"], ["zoom"], 11, 8, 17, 20],
      "line-blur": 5,
    },
  });
  map.addLayer({
    id: ROUTE_LINE,
    type: "line",
    source: ROUTE_SOURCE,
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": "#A8FF00",
      "line-width": ["interpolate", ["linear"], ["zoom"], 11, 4, 17, 9],
      "line-opacity": 0.98,
    },
  });
}

function createDriverMarker() {
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
  root.style.willChange = "transform";

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
  followCenter = null,
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
  const displayedRef = useRef({
    coordinate: normalizeCoordinate(snappedPosition?.coordinate),
    bearing: Number(heading || 0),
  });
  const motionRef = useRef(null);
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");

  routeRef.current = routeGeometry;
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
          zoom: snappedPosition?.coordinate ? (perspective ? 17.8 : 16.8) : 13,
          bearing: perspective ? Number(heading || 0) : 0,
          pitch: perspective ? 58 : 0,
          antialias: false,
          attributionControl: false,
          renderWorldCopies: false,
          fadeDuration: 0,
          maxPitch: 65,
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

        map.on("style.load", () => {
          if (disposed) return;
          addNavigationLayers(map, routeRef.current);
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
    if (map.getStyle()?.sprite?.includes(style === "satellite-streets-v12" ? "satellite-streets-v12" : "dark-v11")) return;
    map.setStyle(nextUrl, { diff: true });
  }, [style]);

  useEffect(() => {
    const target = normalizeCoordinate(snappedPosition?.coordinate);
    const marker = markerRef.current;
    if (!target || !marker) return undefined;

    const now = performance.now();
    const fromCoordinate = displayedRef.current.coordinate || target;
    const fromBearing = Number(displayedRef.current.bearing || heading || 0);
    const targetBearing = shortestBearing(fromBearing, heading);
    const reportedInterval = Number(snappedPosition?.interval_ms);
    const duration = clamp(Number.isFinite(reportedInterval) ? reportedInterval : 480, 220, 850);

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
      const center = normalizeCoordinate(followCenter) || target;
      const targetZoom = perspective
        ? clamp(18.05 - Math.max(0, Number(speedMps || 0)) * 0.018, 16.9, 18.05)
        : clamp(17.1 - Math.max(0, Number(speedMps || 0)) * 0.015, 16.1, 17.1);
      map.easeTo({
        center,
        zoom: targetZoom,
        bearing: perspective ? Number(heading || 0) : 0,
        pitch: perspective ? 58 : 0,
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
    heading,
    perspective,
    followDriver,
    followCenter?.[0],
    followCenter?.[1],
    speedMps,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    const coordinate = normalizeCoordinate(displayedRef.current.coordinate || snappedPosition?.coordinate);
    if (!map || !coordinate || !loadedRef.current) return;
    interactingRef.current = false;
    window.clearTimeout(resumeTimerRef.current);
    map.easeTo({
      center: normalizeCoordinate(followCenter) || coordinate,
      zoom: perspective ? 18 : 17,
      bearing: perspective ? Number(heading || 0) : 0,
      pitch: perspective ? 58 : 0,
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

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" aria-label="LOKIN live vector navigation map" />
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
