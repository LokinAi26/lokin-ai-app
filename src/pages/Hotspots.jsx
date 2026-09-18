import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Flame, Crosshair, TrendingUp, MapPin, RefreshCw, AlertTriangle, Clock3, PackageSearch } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { guardedInvoke } from "@/lib/creditGuardian";
import ZoneAlertMonitor from "@/components/ZoneAlertMonitor";
import HeadHereBeacon, { pickHeadZones } from "@/components/hotspots/HeadHereBeacon";
import { METRICS, heatColor, metricValue, metricDisplay } from "@/lib/heatData";
import { CARTO_KEYLESS_TILE_URL, getBasemapTileUrl } from "@/lib/basemap";

// Real hotspots only. Zones come from the authenticated hotspot-map function,
// which aggregates currently eligible Offer records geocoded on the server.
// No seeded sample zones, no model estimates — when there is no offer data
// the page says so honestly instead of inventing demand.

const FALLBACK_CENTER = [36.8529, -75.978]; // Virginia Beach
const REAL_METRICS = METRICS.filter((m) => m.id === "earnings" || m.id === "volume");

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

function freshnessLabel(source) {
  if (!source) return "WAITING FOR OFFER DATA";
  const age = source.age_minutes;
  if (source.freshness === "live") return "LIVE OFFER DATA";
  if (source.freshness === "recent") return age == null ? "RECENT OFFER DATA" : `UPDATED ${age}M AGO`;
  if (age == null) return "OFFER FRESHNESS UNKNOWN";
  if (age < 1440) return `STALE · ${Math.max(1, Math.round(age / 60))}H OLD`;
  return `STALE · ${Math.max(1, Math.round(age / 1440))}D OLD`;
}

export default function Hotspots() {
  const [deviceCenter, setDeviceCenter] = useState(null);
  const [metric, setMetric] = useState("earnings");
  const [flyTo, setFlyTo] = useState(null);
  const [tileUrl, setTileUrl] = useState(CARTO_KEYLESS_TILE_URL);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let alive = true;
    getBasemapTileUrl().then((url) => { if (alive) setTileUrl(url); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setDeviceCenter([pos.coords.latitude, pos.coords.longitude]),
      () => {},
      { timeout: 6000 }
    );
  }, []);

  const origin = deviceCenter || FALLBACK_CENTER;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    guardedInvoke(base44, "hotspot-map", {
      origin: { latitude: origin[0], longitude: origin[1] },
      origin_address: "",
      market_state: "VA",
      feed_revision: refreshTick,
      mode: "most_profit",
      selected_offer_ids: [],
    }, {
      force: refreshTick > 0,
      userInitiated: refreshTick > 0,
    })
      .then((response) => { if (alive) setPayload(response.data); })
      .catch((nextError) => {
        if (!alive) return;
        setPayload(null);
        setError(
          nextError?.response?.data?.error
          || nextError?.message
          || "Could not load real hotspot data"
        );
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [origin[0], origin[1], refreshTick]);

  // Normalize real server zones into the shape the map, beacon, and alert
  // monitor consume: perHour = real net $/hr, volume = real offer count
  // scaled 0–100, dist = real miles from the server (may be null).
  const zones = useMemo(() => {
    const raw = payload?.zones || [];
    const maxCount = Math.max(1, ...raw.map((z) => Number(z.offer_count || 0)));
    return raw.map((z) => ({
      id: z.id,
      name: z.name,
      lat: Number(z.latitude),
      lng: Number(z.longitude),
      perHour: Number(z.net_per_hour || 0),
      volume: Math.round((Number(z.offer_count || 0) / maxCount) * 100),
      offer_count: Number(z.offer_count || 0),
      dist: z.distance_miles == null ? null : Number(z.distance_miles),
      seal_score: z.seal_score,
      seal_confidence: z.seal_confidence,
      projected_gross: z.projected_gross,
    }));
  }, [payload]);

  const ranked = useMemo(
    () => [...zones].sort((a, b) => metricValue(b, metric) - metricValue(a, metric)),
    [zones, metric]
  );
  const headZones = useMemo(() => pickHeadZones(zones, metric, 3), [zones, metric]);
  const leadZone = headZones[0];
  const activeMetric = METRICS.find((m) => m.id === metric);

  return (
    <div className="p-4 space-y-4 pb-8">
      <div className="lokin-kicker lokin-kicker-lime">ZONES</div>
      <div className="flex items-center justify-between -mt-2">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] tracking-[0.28em] text-primary/70 font-display">
            <Clock3 className="h-3 w-3" /> {freshnessLabel(payload?.source)}
          </div>
          <h1 className="text-2xl font-bold font-heading metal-text">Hotspots</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5">
            <Flame className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold text-primary">{zones.length} live zone{zones.length === 1 ? "" : "s"}</span>
          </div>
          <button
            type="button"
            onClick={() => setRefreshTick((v) => v + 1)}
            disabled={loading}
            aria-label="Refresh real hotspot data"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-primary disabled:opacity-35"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Metric selector — drives heat color + ranking */}
      <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-white/10 bg-black/40 p-1">
        {REAL_METRICS.map((m) => {
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

      {/* Live zone-entry alerts — real zones only */}
      <ZoneAlertMonitor zones={zones} />

      {/* Busiest areas near you — where to head for more orders */}
      {!loading && !error && zones.length > 0 && (
        <HeadHereBeacon zones={zones} center={origin} metric={metric} onFocus={(coords) => setFlyTo(coords)} />
      )}

      {/* Map */}
      <div className="relative rounded-3xl border border-primary/20 overflow-hidden glow-border">
        <MapContainer center={origin} zoom={13} className="h-[58vh] w-full" zoomControl={false} attributionControl={false}>
          <TileLayer url={tileUrl} />
          <Recenter center={origin} />
          <FlyTo target={flyTo} />

          {ranked.map((h) => {
            const c = heatColor(metric, metricValue(h, metric));
            const r = 12 + Math.min(16, (h.offer_count || 1) * 3);
            return (
              <span key={h.id}>
                <CircleMarker center={[h.lat, h.lng]} radius={r * 2.1} pathOptions={{ color: c, fillColor: c, fillOpacity: 0.1, weight: 0 }} />
                <CircleMarker center={[h.lat, h.lng]} radius={r * 1.3} pathOptions={{ color: c, fillColor: c, fillOpacity: 0.22, weight: 0 }} />
                <CircleMarker center={[h.lat, h.lng]} radius={r * 0.7} pathOptions={{ color: c, fillColor: c, fillOpacity: 0.55, weight: 0 }}>
                  <Tooltip direction="top" offset={[0, -4]} className="lokin-tip">
                    <b>{h.name}</b> · ${h.perHour.toFixed(1)}/hr net · {h.offer_count} offer{h.offer_count === 1 ? "" : "s"}
                  </Tooltip>
                </CircleMarker>
              </span>
            );
          })}

          {/* Your location */}
          <CircleMarker center={origin} radius={6} pathOptions={{ color: "#8FE44E", fillColor: "#8FE44E", fillOpacity: 1, weight: 2 }} />
          <CircleMarker center={origin} radius={14} pathOptions={{ color: "#8FE44E", fillColor: "#8FE44E", fillOpacity: 0.15, weight: 0 }} />

          {/* Beam to the busiest nearby zone */}
          {leadZone && (
            <span>
              <Polyline
                positions={[[origin[0], origin[1]], [leadZone.lat, leadZone.lng]]}
                pathOptions={{ color: heatColor(metric, metricValue(leadZone, metric)), weight: 10, opacity: 0.16 }}
              />
              <Polyline
                positions={[[origin[0], origin[1]], [leadZone.lat, leadZone.lng]]}
                pathOptions={{ color: heatColor(metric, metricValue(leadZone, metric)), weight: 2.5, opacity: 0.95, dashArray: "2 9", lineCap: "round" }}
              />
            </span>
          )}
        </MapContainer>

        {/* Legend overlay */}
        <div className="absolute bottom-2 left-2 z-[500] flex items-center gap-2 rounded-full glass border border-white/10 px-2.5 py-1">
          <span className="text-[10px] tracking-widest text-white/50 font-display">LOW</span>
          <span className="h-2 w-2 rounded-full" style={{ background: "#8FE44E" }} />
          <span className="h-2 w-2 rounded-full" style={{ background: "#FFD200" }} />
          <span className="h-2 w-2 rounded-full" style={{ background: "#FF8A00" }} />
          <span className="h-2 w-2 rounded-full" style={{ background: "#FF3B3B" }} />
          <span className="text-[10px] tracking-widest text-white/50 font-display">HIGH</span>
        </div>
        <div className="absolute top-2 right-2 z-[500] rounded-full glass border border-primary/30 px-2.5 py-1 text-[10px] font-bold tracking-widest text-primary">
          PICKUPS · NOT CUSTOMER LOCATIONS
        </div>

        {(loading || error) && (
          <div className="absolute inset-0 z-[600] flex items-center justify-center bg-black/72 p-6 text-center backdrop-blur-sm">
            {loading ? (
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <RefreshCw className="h-4 w-4 animate-spin" /> Building real offer hotspots…
              </div>
            ) : (
              <div className="max-w-sm">
                <AlertTriangle className="mx-auto h-5 w-5 text-amber-300" />
                <div className="mt-2 text-sm font-bold text-white">Real hotspot map unavailable</div>
                <div className="mt-1 text-[11px] leading-relaxed text-white/50">
                  {error || "LOKIN will not invent hotspot data."}
                </div>
                <button
                  type="button"
                  onClick={() => setRefreshTick((v) => v + 1)}
                  className="mt-3 rounded-xl border border-primary/40 bg-primary/15 px-4 py-2 text-xs font-bold text-primary active:scale-95"
                >
                  Try again
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Honest empty state — never invent demand */}
      {!loading && !error && zones.length === 0 && (
        <div className="lokin-card p-5 text-center">
          <PackageSearch className="mx-auto h-8 w-8 text-primary" />
          <div className="mt-2 text-sm font-bold text-white">No offer data yet</div>
          <div className="mt-1 text-[11px] leading-relaxed text-white/55">
            Your real heat map builds as you evaluate offers. Nothing here is estimated or simulated.
          </div>
          <Link
            to="/"
            className="mt-3 inline-block rounded-xl border border-primary/40 bg-primary/15 px-4 py-2 text-xs font-bold text-primary active:scale-95"
          >
            Evaluate offers on Home
          </Link>
        </div>
      )}

      {/* Zone ranking — real zones only */}
      {!loading && !error && zones.length > 0 && (
        <div>
          <div className="lokin-kicker mb-2 flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-primary" /> LIVE ZONES · BY {activeMetric.label.toUpperCase()}
          </div>
          <div className="space-y-2">
            {ranked.map((h, i) => {
              const c = heatColor(metric, metricValue(h, metric));
              return (
                <button
                  key={h.id}
                  onClick={() => setFlyTo([h.lat, h.lng])}
                  className="w-full text-left lokin-card p-3 active:scale-[0.99] transition-all"
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
                      <div className="mt-1 text-[10px] text-white/45">
                        {h.offer_count} eligible offer{h.offer_count === 1 ? "" : "s"}
                        {h.seal_score != null && <span className="text-white/25"> · SEAL {h.seal_score}/100</span>}
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
                    <span className="inline-flex items-center gap-1">
                      <Crosshair className="h-3 w-3" /> {h.dist == null ? "—" : `${h.dist.toFixed(1)} mi`}
                    </span>
                    <span className="text-white/40">${h.perHour.toFixed(1)}/hr net</span>
                    <div className="ml-auto flex items-center gap-1.5 flex-1 max-w-[35%]">
                      <span className="text-white/40">vol</span>
                      <div className="h-1.5 flex-1 rounded-full bg-white/8 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, h.volume)}%`, background: c }} />
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="text-center text-[10px] tracking-[0.2em] text-white/30 pt-1">
        REAL OFFER RECORDS · LOKIN SEAL · MAPBOX — PICKUP ZONES ONLY
      </div>
    </div>
  );
}
