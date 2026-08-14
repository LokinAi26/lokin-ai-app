import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Flame, Crosshair, TrendingUp, MapPin, Navigation } from "lucide-react";
import ZoneAlertMonitor from "@/components/ZoneAlertMonitor";
import {
  PLATFORMS, METRICS, DEFAULT_CENTER, buildHotspots, heatColor, metricValue, metricDisplay,
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

export default function Hotspots() {
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [selected, setSelected] = useState([]);
  const [metric, setMetric] = useState("earnings");
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

  const visible = useMemo(() => {
    if (selected.length === 0) return hotspots;
    return hotspots.filter((h) => h.platforms.some((p) => selected.includes(p)));
  }, [hotspots, selected]);

  const ranked = [...visible].sort((a, b) => metricValue(b, metric) - metricValue(a, metric));
  const routePoints = ranked.slice(0, 5).map((h) => [h.lat, h.lng]);

  function togglePlatform(id) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  const activeMetric = METRICS.find((m) => m.id === metric);

  return (
    <div className="p-4 space-y-4 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] tracking-[0.28em] text-primary/70 font-display">EARNINGS HEAT MAP</div>
          <h1 className="text-2xl font-bold font-heading metal-text">Hot Spots</h1>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5">
          <Flame className="h-4 w-4 text-primary" />
          <span className="text-xs font-bold text-primary">{visible.length} zones</span>
        </div>
      </div>

      {/* Metric selector — drives heat color + ranking */}
      <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-white/10 bg-black/40 p-1">
        {METRICS.map((m) => {
          const on = metric === m.id;
          const Icon = m.icon;
          return (
            <button
              key={m.id}
              onClick={() => setMetric(m.id)}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-all active:scale-95 ${
                on ? "bg-primary/15 text-primary border border-primary/40 glow-primary" : "text-white/55 border border-transparent"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Platform filters */}
      <div className="flex flex-wrap gap-2">
        {PLATFORMS.map((p) => {
          const on = selected.includes(p.id);
          return (
            <button
              key={p.id}
              onClick={() => togglePlatform(p.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
                on ? "border-white/20 bg-white/10 text-white" : "border-white/10 bg-white/[0.03] text-white/55"
              }`}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
              {p.name}
            </button>
          );
        })}
        {selected.length > 0 && (
          <button onClick={() => setSelected([])} className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/50 active:scale-95">
            Clear
          </button>
        )}
      </div>

      {/* Live zone-entry alerts */}
      <ZoneAlertMonitor zones={hotspots} />

      {/* Map */}
      <div className="relative rounded-3xl border border-primary/20 overflow-hidden glow-border">
        <MapContainer center={center} zoom={13} className="h-[58vh] w-full" zoomControl={false} attributionControl={false}>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
          <Recenter center={center} />
          <FlyTo target={flyTo} />

          {/* Neon green GPS earnings route through the top 5 zones */}
          {routePoints.length >= 2 && (
            <>
              <Polyline positions={routePoints} pathOptions={{ color: "#AAFF00", weight: 12, opacity: 0.2 }} />
              <Polyline positions={routePoints} pathOptions={{ color: "#AAFF00", weight: 5, opacity: 1, className: "lokin-route" }} />
            </>
          )}

          {/* Heat zones — nested translucent circles simulate a radial gradient */}
          {visible.map((h) => {
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

        {/* Legend overlay */}
        <div className="absolute bottom-2 left-2 flex items-center gap-2 rounded-full glass border border-white/10 px-2.5 py-1">
          <span className="text-[10px] tracking-widest text-white/50 font-display">LOW</span>
          <span className="h-2 w-2 rounded-full" style={{ background: "#AAFF00" }} />
          <span className="h-2 w-2 rounded-full" style={{ background: "#FFD200" }} />
          <span className="h-2 w-2 rounded-full" style={{ background: "#FF8A00" }} />
          <span className="h-2 w-2 rounded-full" style={{ background: "#FF3B3B" }} />
          <span className="text-[10px] tracking-widest text-white/50 font-display">HIGH</span>
        </div>
        <div className="absolute top-2 right-2 flex items-center gap-1.5 rounded-full glass border border-primary/30 px-2.5 py-1">
          <Navigation className="h-3 w-3 text-primary" />
          <span className="text-[10px] font-bold tracking-widest text-primary">LOKIN ROUTE</span>
        </div>
      </div>

      {/* Zone ranking */}
      <div>
        <div className="text-[11px] tracking-[0.24em] text-white/40 font-display mb-2 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> TOP ZONES · BY {activeMetric.label.toUpperCase()}
        </div>
        <div className="space-y-2">
          {ranked.map((h, i) => {
            const c = heatColor(metric, metricValue(h, metric));
            return (
              <button
                key={h.id}
                onClick={() => setFlyTo([h.lat, h.lng])}
                className="w-full text-left rounded-2xl border border-white/10 lokin-panel p-3 active:scale-[0.99] active:border-primary/40 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black font-display font-black" style={{ color: c }}>
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3 w-3 text-white/40" />
                      <span className="text-sm font-semibold text-white truncate">{h.name}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {h.platforms.map((pid) => {
                        const p = PLATFORMS.find((x) => x.id === pid);
                        return (
                          <span key={pid} className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-semibold text-white/70">
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color }} />
                            {p.name}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-display font-black text-lg leading-none" style={{ color: c }}>
                      {metricDisplay(h, metric)}
                    </div>
                    <div className="text-[9px] tracking-widest text-white/40 font-display">{activeMetric.label.toUpperCase()}</div>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-3 text-[10px] text-white/50">
                  <span className="inline-flex items-center gap-1"><Crosshair className="h-3 w-3" /> {h.dist.toFixed(1)} mi</span>
                  <span className="text-white/40">${h.perHour}/hr</span>
                  <span>{h.tips}% tip</span>
                  <div className="ml-auto flex items-center gap-1.5 flex-1 max-w-[35%]">
                    <span className="text-white/40">vol</span>
                    <div className="h-1.5 flex-1 rounded-full bg-white/8 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${h.volume}%`, background: c }} />
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="text-center text-[10px] tracking-[0.2em] text-white/30 pt-1">
        HEAT DATA IS SIMULATED · CONNECT PLATFORM APIs TO GO LIVE
      </div>
    </div>
  );
}