import { useEffect, useMemo, useState } from "react";
import { Crosshair, Layers3, Map, Minus, Plus, Satellite } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { bearingDegrees, formatDuration } from "@/lib/navigationGeometry";

const MAP_W = 640;
const MAP_H = 420;
const TILE_SIZE = 512;

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

function project(coord, viewport, width = MAP_W, height = MAP_H) {
  if (!coord || !viewport) return null;
  const center = mercator([viewport.longitude, viewport.latitude], viewport.zoom);
  const point = mercator(coord, viewport.zoom);
  const world = TILE_SIZE * (2 ** viewport.zoom);
  let dx = point[0] - center[0];
  if (dx > world / 2) dx -= world;
  if (dx < -world / 2) dx += world;
  return { x: width / 2 + dx, y: height / 2 + (point[1] - center[1]) };
}

export default function RoadMatchedMap({ routeGeometry, snappedPosition, maneuver, remainingDurationS, followDriver = true, perspective = false, fullscreen = false }) {
  const coords = routeGeometry?.coordinates || routeGeometry || [];
  const defaultStyle = perspective ? "satellite-streets-v12" : "dark-v11";
  const [style, setStyle] = useState(defaultStyle);
  const [image, setImage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [zoomOffset, setZoomOffset] = useState(0);
  const renderW = fullscreen ? 640 : MAP_W;
  const renderH = fullscreen ? 960 : MAP_H;

  const nextPoint = snappedPosition?.segment_index != null && coords.length
    ? coords[Math.min(coords.length - 1, Number(snappedPosition.segment_index) + 1)]
    : null;
  const heading = Number.isFinite(snappedPosition?.heading)
    ? snappedPosition.heading
    : snappedPosition?.coordinate && nextPoint
      ? bearingDegrees(snappedPosition.coordinate, nextPoint)
      : 0;

  useEffect(() => {
    setStyle(defaultStyle);
    setZoomOffset(0);
  }, [perspective]);

  const viewport = useMemo(() => {
    if (!Array.isArray(coords) || coords.length < 2) return null;
    const snap = snappedPosition?.coordinate;
    if (followDriver && snap) {
      return {
        longitude: bucketCoord(snap[0], perspective ? 0.0012 : 0.0025),
        latitude: bucketCoord(snap[1], perspective ? 0.0012 : 0.0025),
        zoom: Math.max(13.5, Math.min(18.5, (perspective ? 17.8 : 16.6) + zoomOffset)),
        bearing: perspective ? Math.round(heading / 5) * 5 : 0,
        pitch: perspective ? 58 : 0,
      };
    }
    const fitted = fitViewport(coords, renderW, renderH);
    return fitted ? { ...fitted, zoom: Math.max(2, Math.min(18.5, fitted.zoom + zoomOffset)), bearing: perspective ? Math.round(heading / 5) * 5 : 0, pitch: perspective ? 50 : 0 } : null;
  }, [routeGeometry, followDriver, perspective, heading, zoomOffset, snappedPosition?.coordinate?.[0], snappedPosition?.coordinate?.[1]]);

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
        route_geometry: perspective ? routeGeometry : null,
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
  }, [viewportKey, perspective, routeGeometry]);

  const routePoints = useMemo(() => {
    if (!viewport || !Array.isArray(coords)) return "";
    return coords
      .map((coord) => project(coord, viewport, renderW, renderH))
      .filter(Boolean)
      .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(" ");
  }, [routeGeometry, viewportKey]);

  const driverPoint = perspective
    ? { x: renderW / 2, y: renderH * 0.72 }
    : viewport ? project(snappedPosition?.coordinate || coords[0], viewport, renderW, renderH) : null;

  if (!viewport) return null;

  return (
    <div className={`relative overflow-hidden bg-[#111820] ${fullscreen ? "h-[100dvh] rounded-none border-0 shadow-none" : "rounded-[2rem] border border-accent/30 shadow-[0_0_40px_-20px_hsl(188_95%_50%)]"}`}>
      <div className={`relative w-full overflow-hidden bg-[#121820] ${fullscreen ? "h-full" : perspective ? "aspect-[4/5] min-h-[430px]" : "aspect-[16/10] min-h-[280px]"}`}>
        {image && <img src={image} alt="LOKIN real street navigation map" className="absolute inset-0 h-full w-full object-cover" draggable={false} />}
        <div className="absolute inset-0 bg-black/10 pointer-events-none" />

        {image && (
          <svg viewBox={`0 0 ${renderW} ${renderH}`} className="absolute inset-0 h-full w-full pointer-events-none" preserveAspectRatio="none">
            {!perspective && <polyline points={routePoints} fill="none" stroke="rgba(168,255,0,0.24)" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" />}
            {!perspective && <polyline points={routePoints} fill="none" stroke="#A8FF00" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 7px rgba(168,255,0,.95))" }} />}
            {driverPoint && (
              <g transform={`translate(${driverPoint.x} ${driverPoint.y}) rotate(${perspective ? 0 : heading})`}>
                <circle r="22" fill="rgba(0,229,255,.18)" stroke="rgba(0,229,255,.62)" strokeWidth="3" />
                <path d="M0 -18 L11 13 L0 8 L-11 13 Z" fill="#B7FF42" stroke="#071009" strokeWidth="3" style={{ filter: "drop-shadow(0 0 5px rgba(168,255,0,.9))" }} />
              </g>
            )}
          </svg>
        )}

        <div className={`absolute left-3 rounded-full border border-white/15 bg-black/75 px-3 py-1.5 backdrop-blur ${fullscreen ? "top-[calc(6.25rem+env(safe-area-inset-top))]" : "top-3"}`}>
          <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.18em] text-accent">
            <Map className="h-3.5 w-3.5" /> {perspective ? "REAL 4D MAP · ROAD MATCHED" : "REAL MAP · ROAD MATCHED"}
          </div>
        </div>

        <div className={`absolute right-3 flex gap-1 rounded-full border border-white/10 bg-black/75 p-1 backdrop-blur ${fullscreen ? "top-[calc(6.25rem+env(safe-area-inset-top))]" : "top-3"}`}>
          {perspective ? (
            <div className="rounded-full bg-primary px-2.5 py-1 text-[9px] font-extrabold text-black"><Satellite className="inline h-3 w-3 mr-1" />SATELLITE HD</div>
          ) : (
            <>
              <button type="button" onClick={() => setStyle("dark-v11")} className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${style === "dark-v11" ? "bg-primary text-black" : "text-white/60"}`}>STREET</button>
              <button type="button" onClick={() => setStyle("satellite-streets-v12")} className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${style === "satellite-streets-v12" ? "bg-primary text-black" : "text-white/60"}`}><Satellite className="inline h-3 w-3 mr-1" />SAT</button>
            </>
          )}
        </div>

        {perspective && <div className={`absolute left-3 rounded-full border border-accent/20 bg-black/70 px-2.5 py-1 text-[9px] font-bold tracking-[0.14em] text-accent backdrop-blur ${fullscreen ? "top-[calc(9rem+env(safe-area-inset-top))]" : "top-12"}`}>58° PITCH · HEADING UP</div>}

        <div className={`absolute right-3 z-20 flex flex-col gap-1 ${fullscreen ? "top-[calc(9rem+env(safe-area-inset-top))]" : perspective ? "top-24" : "top-14"}`}>
          <button type="button" aria-label="Zoom in" onClick={() => setZoomOffset((z) => Math.min(2, z + 0.6))} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-black/80 text-white shadow-lg backdrop-blur active:scale-95"><Plus className="h-4 w-4" /></button>
          <button type="button" aria-label="Zoom out" onClick={() => setZoomOffset((z) => Math.max(-2, z - 0.6))} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-black/80 text-white shadow-lg backdrop-blur active:scale-95"><Minus className="h-4 w-4" /></button>
          <button type="button" aria-label="Reset and follow driver" onClick={() => { setZoomOffset(0); setStyle(defaultStyle); }} className={`flex items-center justify-center rounded-xl border border-primary/30 bg-black/85 text-primary shadow-lg backdrop-blur active:scale-95 ${fullscreen ? "h-10 px-2" : "h-10 w-10"}`}><Crosshair className="h-4 w-4" />{fullscreen && <span className="ml-1 text-[8px] font-extrabold">RESET</span>}</button>
        </div>

        <div className={`absolute left-3 max-w-[70%] rounded-2xl border border-primary/25 bg-black/80 px-3 py-2 backdrop-blur ${fullscreen ? "bottom-[calc(1rem+env(safe-area-inset-bottom))]" : "bottom-3"}`}>
          <div className="text-[9px] tracking-[0.16em] text-primary/75">NEXT MANEUVER</div>
          <div className="mt-0.5 line-clamp-2 text-sm font-extrabold text-white">{maneuver?.maneuver?.instruction || "Follow the highlighted road"}</div>
        </div>
        <div className={`absolute right-3 rounded-2xl border border-accent/20 bg-black/80 px-3 py-2 text-right backdrop-blur ${fullscreen ? "bottom-[calc(1rem+env(safe-area-inset-bottom))]" : "bottom-3"}`}>
          <div className="text-[9px] tracking-wider text-white/40">ETA</div>
          <div className="font-display text-lg font-black text-accent">{formatDuration(remainingDurationS)}</div>
        </div>

        {(loading || error) && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#111820]/85 px-6 text-center backdrop-blur-sm">
            {loading ? (
              <div className="flex items-center gap-2 text-sm font-semibold text-accent"><Layers3 className="h-4 w-4 animate-pulse" /> {perspective ? "Loading real 4D Mapbox view…" : "Loading real Mapbox streets…"}</div>
            ) : (
              <div className="text-sm text-red-300">{error}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
