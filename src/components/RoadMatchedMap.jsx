import { useEffect, useMemo, useState } from "react";
import { Layers3, Map, Satellite } from "lucide-react";
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

function fitViewport(coords = []) {
  if (!coords.length) return null;
  const lons = coords.map((c) => Number(c[0]));
  const lats = coords.map((c) => Number(c[1]));
  const center = [(Math.min(...lons) + Math.max(...lons)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2];
  const padding = 70;
  const p0 = mercator([Math.min(...lons), Math.max(...lats)], 0);
  const p1 = mercator([Math.max(...lons), Math.min(...lats)], 0);
  const dx = Math.max(1e-9, Math.abs(p1[0] - p0[0]));
  const dy = Math.max(1e-9, Math.abs(p1[1] - p0[1]));
  const zx = Math.log2((MAP_W - padding * 2) / dx / TILE_SIZE);
  const zy = Math.log2((MAP_H - padding * 2) / dy / TILE_SIZE);
  const zoom = Math.max(2, Math.min(17.2, Math.min(zx, zy)));
  return { longitude: center[0], latitude: center[1], zoom };
}

function bucketCoord(value, step = 0.0025) {
  return Math.round(Number(value || 0) / step) * step;
}

function project(coord, viewport) {
  if (!coord || !viewport) return null;
  const center = mercator([viewport.longitude, viewport.latitude], viewport.zoom);
  const point = mercator(coord, viewport.zoom);
  const world = TILE_SIZE * (2 ** viewport.zoom);
  let dx = point[0] - center[0];
  if (dx > world / 2) dx -= world;
  if (dx < -world / 2) dx += world;
  return { x: MAP_W / 2 + dx, y: MAP_H / 2 + (point[1] - center[1]) };
}

export default function RoadMatchedMap({ routeGeometry, snappedPosition, maneuver, remainingDurationS, followDriver = true }) {
  const coords = routeGeometry?.coordinates || routeGeometry || [];
  const [style, setStyle] = useState("dark-v11");
  const [image, setImage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const viewport = useMemo(() => {
    if (!Array.isArray(coords) || coords.length < 2) return null;
    const snap = snappedPosition?.coordinate;
    if (followDriver && snap) {
      return {
        longitude: bucketCoord(snap[0]),
        latitude: bucketCoord(snap[1]),
        zoom: 16.1,
      };
    }
    return fitViewport(coords);
  }, [routeGeometry, followDriver, snappedPosition?.coordinate?.[0], snappedPosition?.coordinate?.[1]]);

  const viewportKey = viewport ? `${viewport.longitude.toFixed(4)}:${viewport.latitude.toFixed(4)}:${viewport.zoom.toFixed(2)}:${style}` : "";

  useEffect(() => {
    let alive = true;
    if (!viewport) { setImage(""); return; }
    setLoading(true);
    setError("");
    base44.functions.invoke("navigation-engine", {
      action: "static_map",
      viewport: { ...viewport, width: MAP_W, height: MAP_H, style },
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
  }, [viewportKey]);

  const routePoints = useMemo(() => {
    if (!viewport || !Array.isArray(coords)) return "";
    return coords
      .map((coord) => project(coord, viewport))
      .filter(Boolean)
      .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(" ");
  }, [routeGeometry, viewportKey]);

  const driverPoint = viewport ? project(snappedPosition?.coordinate || coords[0], viewport) : null;
  const nextPoint = snappedPosition?.segment_index != null && coords.length
    ? coords[Math.min(coords.length - 1, Number(snappedPosition.segment_index) + 1)]
    : null;
  const heading = Number.isFinite(snappedPosition?.heading)
    ? snappedPosition.heading
    : snappedPosition?.coordinate && nextPoint
      ? bearingDegrees(snappedPosition.coordinate, nextPoint)
      : 0;

  if (!viewport) return null;

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-accent/30 bg-[#111820] shadow-[0_0_40px_-20px_hsl(188_95%_50%)]">
      <div className="relative aspect-[16/10] min-h-[280px] w-full overflow-hidden bg-[#121820]">
        {image && <img src={image} alt="LOKIN real street navigation map" className="absolute inset-0 h-full w-full object-cover" draggable={false} />}
        <div className="absolute inset-0 bg-black/10 pointer-events-none" />

        {image && (
          <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="absolute inset-0 h-full w-full pointer-events-none" preserveAspectRatio="none">
            <polyline points={routePoints} fill="none" stroke="rgba(168,255,0,0.24)" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points={routePoints} fill="none" stroke="#A8FF00" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 7px rgba(168,255,0,.95))" }} />
            {driverPoint && (
              <g transform={`translate(${driverPoint.x} ${driverPoint.y}) rotate(${heading})`}>
                <circle r="22" fill="rgba(0,229,255,.18)" stroke="rgba(0,229,255,.62)" strokeWidth="3" />
                <path d="M0 -18 L11 13 L0 8 L-11 13 Z" fill="#B7FF42" stroke="#071009" strokeWidth="3" style={{ filter: "drop-shadow(0 0 5px rgba(168,255,0,.9))" }} />
              </g>
            )}
          </svg>
        )}

        <div className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/75 px-3 py-1.5 backdrop-blur">
          <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.18em] text-accent">
            <Map className="h-3.5 w-3.5" /> REAL MAP · ROAD MATCHED
          </div>
        </div>

        <div className="absolute right-3 top-3 flex gap-1 rounded-full border border-white/10 bg-black/75 p-1 backdrop-blur">
          <button type="button" onClick={() => setStyle("dark-v11")} className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${style === "dark-v11" ? "bg-primary text-black" : "text-white/60"}`}>STREET</button>
          <button type="button" onClick={() => setStyle("satellite-streets-v12")} className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${style === "satellite-streets-v12" ? "bg-primary text-black" : "text-white/60"}`}><Satellite className="inline h-3 w-3 mr-1" />SAT</button>
        </div>

        <div className="absolute bottom-3 left-3 max-w-[70%] rounded-2xl border border-primary/25 bg-black/80 px-3 py-2 backdrop-blur">
          <div className="text-[9px] tracking-[0.16em] text-primary/75">NEXT MANEUVER</div>
          <div className="mt-0.5 line-clamp-2 text-sm font-extrabold text-white">{maneuver?.maneuver?.instruction || "Follow the highlighted road"}</div>
        </div>
        <div className="absolute bottom-3 right-3 rounded-2xl border border-accent/20 bg-black/80 px-3 py-2 text-right backdrop-blur">
          <div className="text-[9px] tracking-wider text-white/40">ETA</div>
          <div className="font-display text-lg font-black text-accent">{formatDuration(remainingDurationS)}</div>
        </div>

        {(loading || error) && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#111820]/85 px-6 text-center backdrop-blur-sm">
            {loading ? (
              <div className="flex items-center gap-2 text-sm font-semibold text-accent"><Layers3 className="h-4 w-4 animate-pulse" /> Loading real Mapbox streets…</div>
            ) : (
              <div className="text-sm text-red-300">{error}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
