import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Flame, Crosshair, TrendingUp, MapPin, Navigation } from "lucide-react";

const PLATFORMS = [
  { id: "doordash", name: "DoorDash", color: "#FF3008" },
  { id: "ubereats", name: "Uber Eats", color: "#06C167" },
  { id: "gopuff", name: "GoPuff", color: "#9B5DE5" },
  { id: "instacart", name: "Instacart", color: "#43B02A" },
];

// Hotspot seeds: offsets (degrees) from the live map center + earning attributes.
// base = blended $/hr, tips = avg tip %, volume = relative demand 0-100, platforms = which apps run hot here.
const SEEDS = [
  { name: "Downtown Core", dx: 0.012, dy: 0.006, base: 34, tips: 22, volume: 96, platforms: ["doordash", "ubereats", "gopuff", "instacart"] },
  { name: "Midtown Plaza", dx: -0.009, dy: 0.013, base: 31, tips: 19, volume: 88, platforms: ["doordash", "ubereats", "instacart"] },
  { name: "University Strip", dx: 0.018, dy: -0.011, base: 29, tips: 24, volume: 82, platforms: ["ubereats", "doordash", "instacart"] },
  { name: "Hospital District", dx: -0.015, dy: -0.007, base: 27, tips: 17, volume: 74, platforms: ["doordash", "instacart"] },
  { name: "Stadium Zone", dx: 0.022, dy: 0.018, base: 30, tips: 21, volume: 79, platforms: ["ubereats", "doordash", "gopuff"] },
  { name: "Riverside Shops", dx: -0.022, dy: 0.004, base: 26, tips: 16, volume: 68, platforms: ["instacart", "doordash"] },
  { name: "Tech Park Loop", dx: 0.006, dy: -0.019, base: 28, tips: 18, volume: 71, platforms: ["doordash", "ubereats", "gopuff"] },
  { name: "Old Town Square", dx: -0.004, dy: 0.019, base: 25, tips: 20, volume: 63, platforms: ["ubereats", "instacart"] },
  { name: "Harbor Point", dx: 0.026, dy: -0.016, base: 24, tips: 15, volume: 59, platforms: ["doordash", "gopuff"] },
  { name: "Greenview Mall", dx: -0.018, dy: -0.018, base: 23, tips: 14, volume: 55, platforms: ["instacart", "doordash"] },
];

const DEFAULT_CENTER = [40.7128, -74.006]; // NYC fallback when geolocation is denied

function heatColor(perHour) {
  if (perHour >= 32) return "#FF3B3B";
  if (perHour >= 28) return "#FF8A00";
  if (perHour >= 25) return "#FFD200";
  return "#A8FF00";
}

function haversineMi(a, b) {
  const R = 3958.8;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const la1 = (a[0] * Math.PI) / 180;
  const la2 = (b[0] * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

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
  const [selected, setSelected] = useState([]); // platform ids; empty = all
  const [flyTo, setFlyTo] = useState(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCenter([pos.coords.latitude, pos.coords.longitude]),
      () => {},
      { timeout: 6000 }
    );
  }, []);

  const hotspots = useMemo(() => {
    return SEEDS.map((s, i) => {
      const lat = center[0] + s.dy;
      const lng = center[1] + s.dx;
      const perHour = s.base + (s.tips * 0.04);
      return { ...s, id: i, lat, lng, perHour: Math.round(perHour * 10) / 10, dist: haversineMi(center, [lat, lng]) };
    });
  }, [center]);

  const visible = useMemo(() => {
    if (selected.length === 0) return hotspots;
    return hotspots.filter((h) => h.platforms.some((p) => selected.includes(p)));
  }, [hotspots, selected]);

  const ranked = [...visible].sort((a, b) => b.perHour - a.perHour);
  const routePoints = ranked.slice(0, 5).map((h) => [h.lat, h.lng]);

  function togglePlatform(id) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

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

      {/* Map */}
      <div className="relative rounded-3xl border border-primary/20 overflow-hidden glow-border">
        <MapContainer center={center} zoom={13} className="h-[58vh] w-full" zoomControl={false} attributionControl={false}>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
          <Recenter center={center} />
          <FlyTo target={flyTo} />

          {/* Neon green GPS earnings route through the top 5 zones */}
          {routePoints.length >= 2 && (
            <>
              <Polyline positions={routePoints} pathOptions={{ color: "#A8FF00", weight: 11, opacity: 0.18 }} />
              <Polyline positions={routePoints} pathOptions={{ color: "#A8FF00", weight: 4, opacity: 0.95, className: "lokin-route" }} />
            </>
          )}

          {/* Heat zones — nested translucent circles simulate a radial gradient */}
          {visible.map((h) => {
            const c = heatColor(h.perHour);
            const r = 16 + h.volume / 8;
            return (
              <span key={h.id}>
                <CircleMarker center={[h.lat, h.lng]} radius={r * 2.1} pathOptions={{ color: c, fillColor: c, fillOpacity: 0.1, weight: 0 }} />
                <CircleMarker center={[h.lat, h.lng]} radius={r * 1.3} pathOptions={{ color: c, fillColor: c, fillOpacity: 0.22, weight: 0 }} />
                <CircleMarker center={[h.lat, h.lng]} radius={r * 0.7} pathOptions={{ color: c, fillColor: c, fillOpacity: 0.55, weight: 0 }}>
                  <Tooltip direction="top" offset={[0, -4]} className="lokin-tip">
                    <b>{h.name}</b> · ${h.perHour}/hr
                  </Tooltip>
                </CircleMarker>
              </span>
            );
          })}

          {/* Your location */}
          <CircleMarker center={center} radius={6} pathOptions={{ color: "#A8FF00", fillColor: "#A8FF00", fillOpacity: 1, weight: 2 }} />
          <CircleMarker center={center} radius={14} pathOptions={{ color: "#A8FF00", fillColor: "#A8FF00", fillOpacity: 0.15, weight: 0 }} />
        </MapContainer>

        {/* Legend overlay */}
        <div className="absolute bottom-2 left-2 flex items-center gap-2 rounded-full glass border border-white/10 px-2.5 py-1">
          <span className="text-[10px] tracking-widest text-white/50 font-display">COOL</span>
          <span className="h-2 w-2 rounded-full" style={{ background: "#A8FF00" }} />
          <span className="h-2 w-2 rounded-full" style={{ background: "#FFD200" }} />
          <span className="h-2 w-2 rounded-full" style={{ background: "#FF8A00" }} />
          <span className="h-2 w-2 rounded-full" style={{ background: "#FF3B3B" }} />
          <span className="text-[10px] tracking-widest text-white/50 font-display">HOT</span>
        </div>
        <div className="absolute top-2 right-2 flex items-center gap-1.5 rounded-full glass border border-primary/30 px-2.5 py-1">
          <Navigation className="h-3 w-3 text-primary" />
          <span className="text-[10px] font-bold tracking-widest text-primary">LOKIN ROUTE</span>
        </div>
      </div>

      {/* Zone ranking */}
      <div>
        <div className="text-[11px] tracking-[0.24em] text-white/40 font-display mb-2 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> TOP EARNING ZONES
        </div>
        <div className="space-y-2">
          {ranked.map((h, i) => {
            const c = heatColor(h.perHour);
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
                      ${h.perHour}
                    </div>
                    <div className="text-[9px] tracking-widest text-white/40 font-display">PER HR</div>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-3 text-[10px] text-white/50">
                  <span className="inline-flex items-center gap-1"><Crosshair className="h-3 w-3" /> {h.dist.toFixed(1)} mi</span>
                  <span>{h.tips}% avg tip</span>
                  <div className="ml-auto flex items-center gap-1.5 flex-1 max-w-[40%]">
                    <span className="text-white/40">demand</span>
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