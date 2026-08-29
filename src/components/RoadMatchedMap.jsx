import { useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, Layers3, Map, Satellite } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { bearingDegrees, formatDuration, haversineMeters } from "@/lib/navigationGeometry";

const MAP_W = 640;
const MAP_H = 420;
const TILE_SIZE = 512;

function formatCompactDuration(seconds) {
  const value = Math.max(0, Number(seconds || 0));
  if (value > 0 && value < 60) return "<1m";
  const minutes = Math.max(0, Math.round(value / 60));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h${remainder}m` : `${hours}h`;
}

function mercator(coord, zoom) {
  const lon = Number(coord?.[0] || 0);
  const lat = Math.max(-85.05112878, Math.min(85.05112878, Number(coord?.[1] || 0)));
  const sin = Math.sin((lat * Math.PI) / 180);
  const scale = TILE_SIZE * (2 ** zoom);
  return [
    ((lon + 180) / 360) * scale,
    (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  ];
}

function unmercator(point, zoom) {
  const scale = TILE_SIZE * (2 ** zoom);
  const x = Number(point?.[0] || 0);
  const y = Number(point?.[1] || 0);
  const longitude = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const latitude = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return [longitude, Math.max(-85.05112878, Math.min(85.05112878, latitude))];
}

function fitViewport(coords = [], width = MAP_W, height = MAP_H) {
  if (!coords.length) return null;
  const lons = coords.map((c) => Number(c[0]));
  const lats = coords.map((c) => Number(c[1]));
  const center = [(Math.min(...lons) + Math.max(...lons)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2];
  const padding = 70;
  const p0 = mercator([Math.min(...lons), Math.max(...lats)], 0);
  const p1 = mercator([Math.max(...lons), Math.min(...lats)], 0);
  const dx = Math.max(1e-9, Math.abs(p1[0] - p0[0]));
  const dy = Math.max(1e-9, Math.abs(p1[1] - p0[1]));
  const zx = Math.log2((width - padding * 2) / dx / TILE_SIZE);
  const zy = Math.log2((height - padding * 2) / dy / TILE_SIZE);
  const zoom = Math.max(2, Math.min(17.2, Math.min(zx, zy)));
  return { longitude: center[0], latitude: center[1], zoom };
}

function bucketCoord(value, step = 0.0025) {
  return Math.round(Number(value || 0) / step) * step;
}

function interpolateCoord(a, b, t) {
  const clamped = Math.max(0, Math.min(1, Number(t || 0)));
  return [
    Number(a?.[0] || 0) + (Number(b?.[0] || 0) - Number(a?.[0] || 0)) * clamped,
    Number(a?.[1] || 0) + (Number(b?.[1] || 0) - Number(a?.[1] || 0)) * clamped,
  ];
}

function pointAheadOnRoute(routeCoords = [], distanceM = 0) {
  if (!Array.isArray(routeCoords) || !routeCoords.length) return null;
  if (routeCoords.length === 1 || distanceM <= 0) return routeCoords[0];
  let remaining = Number(distanceM || 0);
  for (let i = 0; i < routeCoords.length - 1; i += 1) {
    const a = routeCoords[i];
    const b = routeCoords[i + 1];
    const segmentM = haversineMeters(a, b);
    if (!Number.isFinite(segmentM) || segmentM <= 0) continue;
    if (remaining <= segmentM) return interpolateCoord(a, b, remaining / segmentM);
    remaining -= segmentM;
  }
  return routeCoords[routeCoords.length - 1];
}

function project(coord, viewport, width = MAP_W, height = MAP_H) {
  if (!coord || !viewport) return null;
  const center = mercator([viewport.longitude, viewport.latitude], viewport.zoom);
  const point = mercator(coord, viewport.zoom);
  const world = TILE_SIZE * (2 ** viewport.zoom);
  let dx = point[0] - center[0];
  if (dx > world / 2) dx -= world;
  if (dx < -world / 2) dx += world;
  const dy = point[1] - center[1];
  const bearingRad = (Number(viewport.bearing || 0) * Math.PI) / 180;
  const cos = Math.cos(bearingRad);
  const sin = Math.sin(bearingRad);
  // Mapbox bearing rotates the map clockwise. Rotate world-space offsets by the
  // inverse camera bearing so our SVG route/driver overlay stays road-aligned.
  const screenDx = dx * cos + dy * sin;
  const screenDy = -dx * sin + dy * cos;
  return { x: width / 2 + screenDx, y: height / 2 + screenDy };
}

export default function RoadMatchedMap({ routeGeometry, snappedPosition, maneuver, remainingDurationS, followDriver = true, perspective = false, fullscreen = false, onResetFollow = null, etaLiveTraffic = false, navigationStatus = "navigating" }) {
  const coords = routeGeometry?.coordinates || routeGeometry || [];
  const defaultStyle = perspective ? "satellite-streets-v12" : "dark-v11";
  const [style, setStyle] = useState(defaultStyle);
  const [image, setImage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [zoomOffset, setZoomOffset] = useState(0);
  const [gestureScale, setGestureScale] = useState(1);
  const [manualCenter, setManualCenter] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const pinchRef = useRef({ distance: 0, scale: 1 });
  const dragRef = useRef({ active: false, moved: false, startX: 0, startY: 0, dx: 0, dy: 0, viewport: null });
  const renderW = fullscreen ? 640 : MAP_W;
  const renderH = fullscreen ? 960 : MAP_H;
  const hudSafeX = fullscreen ? "max(0.65rem, env(safe-area-inset-left))" : "0.5rem";
  const arrived = navigationStatus === "arrived";
  const rerouting = navigationStatus === "rerouting";
  const headingForward = fullscreen && followDriver;

  const nextPoint = snappedPosition?.segment_index != null && coords.length
    ? coords[Math.min(coords.length - 1, Number(snappedPosition.segment_index) + 1)]
    : null;

  const activeCoords = useMemo(() => {
    if (!followDriver || !snappedPosition?.coordinate || !coords.length) return coords;
    const segmentIndex = Math.max(0, Math.min(coords.length - 2, Number(snappedPosition.segment_index || 0)));
    return [snappedPosition.coordinate, ...coords.slice(segmentIndex + 1)];
  }, [routeGeometry, followDriver, snappedPosition?.segment_index, snappedPosition?.coordinate?.[0], snappedPosition?.coordinate?.[1]]);

  const activeRouteGeometry = useMemo(() => ({ type: "LineString", coordinates: activeCoords }), [activeCoords]);
  // Navigation orientation follows the matched road segment first. Raw device
  // heading can be noisy or briefly reversed at low speed, which made the map
  // appear to show the route behind the driver even though geometry was valid.
  const heading = snappedPosition?.coordinate && nextPoint
    ? bearingDegrees(snappedPosition.coordinate, nextPoint)
    : Number.isFinite(snappedPosition?.heading)
      ? snappedPosition.heading
      : 0;
  const speedMps = Math.max(0, Number(snappedPosition?.speed_mps ?? snappedPosition?.speed ?? 0));
  const lookAheadM = perspective
    ? Math.max(85, Math.min(220, 90 + speedMps * 5.2))
    : Math.max(55, Math.min(155, 55 + speedMps * 4.0));
  const followCenter = useMemo(
    () => pointAheadOnRoute(activeCoords, lookAheadM) || snappedPosition?.coordinate || null,
    [activeRouteGeometry, lookAheadM, snappedPosition?.coordinate?.[0], snappedPosition?.coordinate?.[1]],
  );

  useEffect(() => {
    setStyle(defaultStyle);
    setZoomOffset(0);
    setManualCenter(null);
    setDragOffset({ x: 0, y: 0 });
    dragRef.current = { active: false, moved: false, startX: 0, startY: 0, dx: 0, dy: 0, viewport: null };
  }, [perspective]);

  const viewport = useMemo(() => {
    if (!Array.isArray(coords) || coords.length < 2) return null;
    const snap = snappedPosition?.coordinate;
    const cameraBearing = (perspective || headingForward) ? Math.round(heading / 5) * 5 : 0;
    if (followDriver && snap) {
      const anchor = followCenter || snap;
      // Keep the driver in the lower navigation field while reserving the upper
      // field for the road ahead. A fine bucket limits Static Images requests
      // without the 15–40 m camera jumps produced by the old coarse grid.
      const cameraStep = perspective ? 0.00004 : 0.00005;
      const autoLongitude = bucketCoord(anchor[0], cameraStep);
      const autoLatitude = bucketCoord(anchor[1], cameraStep);
      return {
        longitude: Number(manualCenter?.longitude ?? autoLongitude),
        latitude: Number(manualCenter?.latitude ?? autoLatitude),
        zoom: Math.max(13.5, Math.min(18.5, (perspective ? 18.0 : 16.9) + zoomOffset)),
        bearing: cameraBearing,
        pitch: perspective ? 58 : 0,
      };
    }
    const fitted = fitViewport(coords, renderW, renderH);
    if (!fitted) return null;
    return {
      ...fitted,
      longitude: Number(manualCenter?.longitude ?? fitted.longitude),
      latitude: Number(manualCenter?.latitude ?? fitted.latitude),
      zoom: Math.max(2, Math.min(18.5, fitted.zoom + zoomOffset)),
      bearing: cameraBearing,
      pitch: perspective ? 50 : 0,
    };
  }, [routeGeometry, followDriver, perspective, headingForward, heading, zoomOffset, manualCenter?.longitude, manualCenter?.latitude, followCenter?.[0], followCenter?.[1], snappedPosition?.coordinate?.[0], snappedPosition?.coordinate?.[1]]);

  const viewportKey = viewport ? `${viewport.longitude.toFixed(4)}:${viewport.latitude.toFixed(4)}:${viewport.zoom.toFixed(2)}:${Number(viewport.bearing || 0).toFixed(0)}:${Number(viewport.pitch || 0).toFixed(0)}:${style}:${perspective ? "4d" : "2d"}` : "";

  useEffect(() => {
    let alive = true;
    if (!viewport) { setImage(""); return; }
    setLoading(true);
    setError("");
    base44.functions.invoke("navigation-engine", {
      action: "static_map",
      viewport: {
        ...viewport,
        width: renderW,
        height: fullscreen ? renderH : perspective ? 700 : MAP_H,
        style,
        retina: true,
        route_geometry: perspective ? activeRouteGeometry : null,
        driver_coordinate: perspective ? snappedPosition?.coordinate || null : null,
      },
    }).then((response) => {
      if (!alive) return;
      const dataUrl = response.data?.map?.data_url || "";
      if (!dataUrl) throw new Error("Map provider returned no basemap image");
      setImage(dataUrl);
    }).catch((e) => {
      if (!alive) return;
      setError(e?.response?.data?.error || e?.message || "Could not load the real street basemap");
    }).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [viewportKey, perspective, activeRouteGeometry]);

  const routePoints = useMemo(() => {
    if (!viewport || !Array.isArray(activeCoords)) return "";
    return activeCoords
      .map((coord) => project(coord, viewport, renderW, renderH))
      .filter(Boolean)
      .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(" ");
  }, [activeRouteGeometry, viewportKey]);

  // Flat MAP mode uses the local SVG projection. 4D uses a Mapbox-native
  // marker embedded in the same pitched static image as the route, eliminating
  // the detached/hidden driver marker seen when the 4D camera was panned.
  const driverPoint = perspective
    ? null
    : viewport ? project(snappedPosition?.coordinate || coords[0], viewport, renderW, renderH) : null;
  const markerRotation = heading - Number(viewport?.bearing || 0);

  function touchDistance(touches) {
    if (!touches || touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }

  function onTouchStart(e) {
    if (e.touches?.length === 2) {
      dragRef.current.active = false;
      setDragOffset({ x: 0, y: 0 });
      const distance = touchDistance(e.touches);
      pinchRef.current = { distance, scale: 1 };
      return;
    }
    if (e.touches?.length !== 1 || !viewport) return;
    const touch = e.touches[0];
    dragRef.current = {
      active: true,
      moved: false,
      startX: touch.clientX,
      startY: touch.clientY,
      dx: 0,
      dy: 0,
      viewport: { ...viewport },
    };
  }

  function onTouchMove(e) {
    if (e.touches?.length === 2 && pinchRef.current.distance) {
      e.preventDefault();
      const scale = Math.max(0.62, Math.min(1.7, touchDistance(e.touches) / pinchRef.current.distance));
      pinchRef.current.scale = scale;
      setGestureScale(scale);
      return;
    }
    if (e.touches?.length !== 1 || !dragRef.current.active) return;
    e.preventDefault();
    const touch = e.touches[0];
    const dx = touch.clientX - dragRef.current.startX;
    const dy = touch.clientY - dragRef.current.startY;
    dragRef.current.dx = dx;
    dragRef.current.dy = dy;
    if (Math.hypot(dx, dy) >= 4) dragRef.current.moved = true;
    setDragOffset({ x: dx, y: dy });
  }

  function finishPinch() {
    if (!pinchRef.current.distance) return;
    const scale = pinchRef.current.scale || 1;
    const zoomDelta = Math.log2(scale);
    if (Math.abs(zoomDelta) > 0.03) {
      setZoomOffset((z) => Math.max(-2, Math.min(2, z + zoomDelta)));
    }
    pinchRef.current = { distance: 0, scale: 1 };
    setGestureScale(1);
  }

  function finishPan() {
    const drag = dragRef.current;
    if (!drag.active) return;
    dragRef.current.active = false;
    setDragOffset({ x: 0, y: 0 });
    if (!drag.moved || !drag.viewport) return;
    const startCenter = mercator([drag.viewport.longitude, drag.viewport.latitude], drag.viewport.zoom);
    const bearingRad = (Number(drag.viewport.bearing || 0) * Math.PI) / 180;
    const cos = Math.cos(bearingRad);
    const sin = Math.sin(bearingRad);
    const worldDx = drag.dx * cos - drag.dy * sin;
    const worldDy = drag.dx * sin + drag.dy * cos;
    const nextCenter = unmercator([startCenter[0] - worldDx, startCenter[1] - worldDy], drag.viewport.zoom);
    setManualCenter({ longitude: nextCenter[0], latitude: nextCenter[1] });
  }

  function finishGesture() {
    finishPan();
    finishPinch();
  }

  function resetView() {
    setManualCenter(null);
    setDragOffset({ x: 0, y: 0 });
    setZoomOffset(0);
    setGestureScale(1);
    pinchRef.current = { distance: 0, scale: 1 };
    dragRef.current = { active: false, moved: false, startX: 0, startY: 0, dx: 0, dy: 0, viewport: null };
    setStyle(defaultStyle);
    onResetFollow?.();
  }

  if (!viewport) return null;

  return (
    <div className={`relative box-border overflow-hidden bg-[#111820] ${fullscreen ? "h-[100dvh] w-full max-w-full rounded-none border-0 shadow-none" : "rounded-[2rem] border border-accent/30 shadow-[0_0_40px_-20px_hsl(188_95%_50%)]"}`}>
      <div
        className={`relative w-full max-w-full overflow-hidden bg-[#121820] ${fullscreen ? "h-full" : perspective ? "aspect-[4/5] min-h-[430px]" : "aspect-[16/10] min-h-[280px]"}`}
        style={{ touchAction: "none" }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={finishGesture}
        onTouchCancel={finishGesture}
      >
        <div
          className="absolute inset-0 will-change-transform"
          style={{ transform: `translate(${dragOffset.x}px, ${dragOffset.y}px) scale(${gestureScale})`, transformOrigin: "50% 55%", transition: gestureScale === 1 && dragOffset.x === 0 && dragOffset.y === 0 ? "transform 160ms ease-out" : "none" }}
        >
          {image && <img src={image} alt="LOKIN real street navigation map" className="absolute inset-0 h-full w-full object-cover" draggable={false} />}
          <div className="absolute inset-0 bg-black/10 pointer-events-none" />

          {image && (
            <svg viewBox={`0 0 ${renderW} ${renderH}`} className="absolute inset-0 h-full w-full pointer-events-none" preserveAspectRatio="none">
              {!perspective && <polyline points={routePoints} fill="none" stroke="rgba(168,255,0,0.24)" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" />}
              {!perspective && <polyline points={routePoints} fill="none" stroke="#A8FF00" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 7px rgba(168,255,0,.95))" }} />}
              {driverPoint && (
                <g transform={`translate(${driverPoint.x} ${driverPoint.y}) rotate(${markerRotation})`}>
                  <circle r="22" fill="rgba(0,229,255,.18)" stroke="rgba(0,229,255,.62)" strokeWidth="3" />
                  <path d="M0 -18 L11 13 L0 8 L-11 13 Z" fill="#B7FF42" stroke="#071009" strokeWidth="3" style={{ filter: "drop-shadow(0 0 5px rgba(168,255,0,.9))" }} />
                </g>
              )}
            </svg>
          )}
        </div>

        {!fullscreen && (
          <>
            <div className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/75 px-3 py-1.5 backdrop-blur">
              <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.18em] text-accent">
                <Map className="h-3.5 w-3.5" /> {perspective ? "REAL 4D MAP · ROAD MATCHED" : "REAL MAP · ROAD MATCHED"}
              </div>
            </div>
            <div className="absolute right-3 top-3 flex gap-1 rounded-full border border-white/10 bg-black/75 p-1 backdrop-blur">
              {perspective ? (
                <div className="rounded-full bg-primary px-2.5 py-1 text-[9px] font-extrabold text-black"><Satellite className="inline h-3 w-3 mr-1" />SATELLITE HD</div>
              ) : (
                <>
                  <button type="button" onClick={() => setStyle("dark-v11")} className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${style === "dark-v11" ? "bg-primary text-black" : "text-white/60"}`}>STREET</button>
                  <button type="button" onClick={() => setStyle("satellite-streets-v12")} className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${style === "satellite-streets-v12" ? "bg-primary text-black" : "text-white/60"}`}><Satellite className="inline h-3 w-3 mr-1" />SAT</button>
                </>
              )}
            </div>
            {perspective && <div className="absolute left-3 top-12 rounded-full border border-accent/20 bg-black/70 px-2.5 py-1 text-[9px] font-bold tracking-[0.14em] text-accent backdrop-blur">58° PITCH · HEADING UP</div>}
            <div className={`absolute right-3 z-20 flex flex-col items-end gap-1 ${perspective ? "top-24" : "top-14"}`}>
              <div className="rounded-xl border border-white/10 bg-black/75 px-2.5 py-1.5 text-[8px] font-bold tracking-[0.08em] text-white/70 backdrop-blur">DRAG · PINCH</div>
              <button type="button" aria-label="Reset and follow driver" onClick={resetView} className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-black/85 text-primary shadow-lg backdrop-blur active:scale-95"><Crosshair className="h-4 w-4" /></button>
            </div>
          </>
        )}

        {fullscreen && (Math.abs(zoomOffset) > 0.03 || manualCenter) && (
          <button type="button" aria-label="Return to live driver follow" onClick={resetView} className="absolute right-3 top-[calc(5.25rem+env(safe-area-inset-top))] z-30 flex h-10 w-10 items-center justify-center rounded-full border border-primary/40 bg-black/80 text-primary shadow-lg backdrop-blur active:scale-95"><Crosshair className="h-4 w-4" /></button>
        )}

        {rerouting && (
          <div className={`absolute left-1/2 z-30 -translate-x-1/2 rounded-full border border-amber-300/30 bg-black/85 px-3 py-1.5 text-[9px] font-extrabold tracking-[0.12em] text-amber-200 backdrop-blur ${fullscreen ? "top-[calc(4.9rem+env(safe-area-inset-top))]" : "top-14"}`}>
            REROUTING · CONFIRMING ROAD
          </div>
        )}

        <div
          className={`absolute z-30 flex min-w-0 items-end gap-2 ${fullscreen ? "bottom-[calc(0.75rem+env(safe-area-inset-bottom))]" : "bottom-3"}`}
          style={fullscreen ? { left: hudSafeX, right: "max(0.65rem, env(safe-area-inset-right))" } : { left: "0.5rem", right: "0.5rem" }}
        >
          <div className={`min-w-0 flex-1 overflow-hidden rounded-2xl border bg-black/84 px-3 py-2 backdrop-blur ${arrived ? "border-primary/45" : "border-primary/25"}`}>
            <div className="truncate text-[9px] tracking-[0.16em] text-primary/75">{arrived ? "ARRIVED" : "NEXT MANEUVER"}</div>
            <div className="mt-0.5 line-clamp-2 break-words text-[clamp(0.78rem,3.6vw,1rem)] font-extrabold leading-tight text-white">{arrived ? "Destination reached" : maneuver?.maneuver?.instruction || "Follow the highlighted road"}</div>
          </div>
          <div className={`w-[clamp(76px,23vw,96px)] shrink-0 overflow-hidden rounded-2xl border bg-black/84 px-2.5 py-2 text-right backdrop-blur ${arrived ? "border-primary/30" : "border-accent/20"}`}>
            <div className="truncate text-[7px] tracking-[0.06em] text-white/45">{arrived ? "STATUS" : fullscreen && etaLiveTraffic ? "LIVE" : etaLiveTraffic ? "LIVE ETA" : "ETA"}</div>
            <div className={`truncate font-display font-black ${arrived ? "text-sm text-primary" : "text-[clamp(1rem,5vw,1.35rem)] text-accent"}`}>{arrived ? "DONE" : fullscreen ? formatCompactDuration(remainingDurationS) : formatDuration(remainingDurationS)}</div>
          </div>
        </div>

        {!image && (loading || error) && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#111820]/85 px-6 text-center backdrop-blur-sm">
            {loading ? (
              <div className="flex items-center gap-2 text-sm font-semibold text-accent"><Layers3 className="h-4 w-4 animate-pulse" /> {perspective ? "Loading real 4D Mapbox view…" : "Loading real Mapbox streets…"}</div>
            ) : (
              <div className="text-sm text-red-300">{error}</div>
            )}
          </div>
        )}
        {!fullscreen && image && loading && (
          <div className="absolute bottom-24 left-1/2 z-30 -translate-x-1/2 rounded-full border border-accent/20 bg-black/75 px-3 py-1.5 text-[9px] font-bold tracking-[0.1em] text-accent backdrop-blur"><Layers3 className="mr-1 inline h-3 w-3 animate-pulse" />REFINING SATELLITE</div>
        )}
        {image && error && <div className="absolute bottom-24 left-1/2 z-30 -translate-x-1/2 rounded-full border border-red-400/20 bg-black/80 px-3 py-1.5 text-[9px] text-red-300 backdrop-blur">{error}</div>}
      </div>
    </div>
  );
}
