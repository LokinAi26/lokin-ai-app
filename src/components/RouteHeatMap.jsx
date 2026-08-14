import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Flame, Navigation, TrendingUp, MapPin } from "lucide-react";
import {
  METRICS, DEFAULT_CENTER, buildHotspots, heatColor, metricValue, metricDisplay,
} from "@/lib/heatData";

function Recenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, 13);
  }, [center, map]);
  return null;
}

function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, 15, { duration: 0.6 });
  }, [target, map]);
  return null;
}

// Interactive earnings heat overlay for the Route Planner. Color-coded
// intensity (neon-lime cool → red hot) shows where delivery volume is
// strongest, plus a neon-green "LOKIN route" drawn through the top zones so
// you can see exactly where the best volume is along your planned run.
export default function RouteHeatMap({ heightClass = "h-60" }) {
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [metric, setMetric] = useState("volume");
  const [flyTo, setFlyTo] = useState(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCenter([pos.coords.latitude, pos.coords.longitude]),
      () => {},
      { timeout: 6000 }
    );
  }, []);

  const hotspots = useMemo(() => buildHotspots(center), [center]);
  const ranked = [...hotspots].sort((a, b) => metricValue(b, metric) - metricValue(a, metric));
  const routePoints = ranked.slice(0, 5).map((h) => [h.lat, h.lng]);
  const best = ranked[0];
  const activeMetric = METRICS.find((m) => m.id === metric);

  return (
    <div className="rounded-3xl border border-primary/20 overflow-hidden glow-border">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-black/40">
        <div className="flex items-center gap-1.5">
          <Flame className="h-4 w-4 text-primary" />
          <span className="text-[11px] font-display tracking-[0.22em] text-primary">EARNINGS HEAT MAP</span>
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-xl border border-white/10 bg-black/40 p-0.5">
          {METRICS.map((m) => {
            const on = metric === m.id;
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                onClick={() => setMetric(m.id)}
                className={`flex items-center justify-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold transition-all active:scale-95 ${
                  on ? "bg-primary/15 text-primary border border-primary/40" : "text-white/55 border border-transparent"
                }`}
              >
                <Icon className="h-3 w-3" />
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative">
        <MapContainer center={center} zoom={13} className={`${heightClass} w-full`} zoomControl={false} attributionControl={false}>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
          <Recenter center={center} />
          <FlyTo target={flyTo} />

          {/* Neon green route through the top-volume zones */}
          {routePoints.length >= 2 && (
            <>
              <Polyline positions={routePoints} pathOptions={{ color: "#AAFF00", weight: 12, opacity: 0.18 }} />
              <Polyline positions={routePoints} pathOptions={{ color: "#AAFF00", weight: 5, opacity: 1, className: "lokin-route" }} />
            </>
          )}

          {/* Heat zones — nested translucent circles = radial glow */}
          {hotspots.map((h) => {
            const c = heatColor(metric, metricValue(h, metric));
            const r = 16 + h.volume / 8;
            return (
              <span key={h.id}>
                <CircleMarker center={[h.lat, h.lng]} radius={r * 2.1} pathOptions={{ color: c, fillColor: c, fillOpacity: 0.1, weight: 0 }} />
                <CircleMarker center={[h.lat, h.lng]} radius={r * 1.3} pathOptions={{ color: c, fillColor: c, fillOpacity: 0.22, weight: 0 }} />
                <CircleMarker center={[h.lat, h.lng]} radius={r * 0.7} pathOptions={{ color: c, fillColor: c, fillOpacity: 0.55, weight: 0 }}>
                  <Tooltip direction="top" offset={[0, -4]} className="lokin-tip">
                    <b>{h.name}</b> · {metricDisplay(h, metric)} {activeMetric.label.toLowerCase()}
                  </Tooltip>
                </CircleMarker>
              </span>
            );
          })}

          {/* Your location */}
          <CircleMarker center={center} radius={6} pathOptions={{ color: "#AAFF00", fillColor: "#AAFF00", fillOpacity: 1, weight: 2 }} />
          <CircleMarker center={center} radius={14} pathOptions={{ color: "#AAFF00", fillColor: "#AAFF00", fillOpacity: 0.15, weight: 0 }} />
        </MapContainer>

        {/* Legend */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full glass border border-white/10 px-2.5 py-1">
          <span className="text-[9px] tracking-widest text-white/50 font-display">LOW</span>
          <span className="h-2 w-2 rounded-full" style={{ background: "#AAFF00" }} />
          <span className="h-2 w-2 rounded-full" style={{ background: "#FFD200" }} />
          <span className="h-2 w-2 rounded-full" style={{ background: "#FF8A00" }} />
          <span className="h-2 w-2 rounded-full" style={{ background: "#FF3B3B" }} />
          <span className="text-[9px] tracking-widest text-white/50 font-display">HIGH</span>
        </div>
        <div className="absolute top-2 right-2 flex items-center gap-1.5 rounded-full glass border border-primary/30 px-2.5 py-1">
          <Navigation className="h-3 w-3 text-primary" />
          <span className="text-[9px] font-bold tracking-widest text-primary">LOKIN ROUTE</span>
        </div>
      </div>

      {/* Best-volume strip */}
      {best && (
        <button
          onClick={() => setFlyTo([best.lat, best.lng])}
          className="w-full flex items-center gap-3 border-t border-white/10 bg-primary/[0.06] px-3 py-2.5 text-left active:scale-[0.99] transition-all"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-black">
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] tracking-widest text-white/40 font-display">BEST VOLUME NOW</div>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-white truncate">
              <MapPin className="h-3 w-3 text-primary" /> {best.name}
            </div>
          </div>
          <div className="text-right">
            <div className="font-display font-black text-lg leading-none" style={{ color: heatColor(metric, metricValue(best, metric)) }}>
              {metricDisplay(best, metric)}
            </div>
            <div className="text-[9px] tracking-widest text-white/40 font-display">{activeMetric.label.toUpperCase()}</div>
          </div>
        </button>
      )}
    </div>
  );
}