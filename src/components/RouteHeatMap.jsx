import { Fragment, useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { AlertTriangle, Clock3, DollarSign, Flame, MapPin, RefreshCw, TrendingUp } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { guardedInvoke } from "@/lib/creditGuardian";

const FALLBACK_CENTER = [36.8529, -75.978];
const METRICS = [
  { id: "earnings", label: "Net/hr", icon: TrendingUp },
  { id: "payout", label: "Payout", icon: DollarSign },
  { id: "offers", label: "Offers", icon: Flame },
];

function metricValue(zone, metric) {
  if (metric === "payout") return Number(zone.projected_gross || 0);
  if (metric === "offers") return Number(zone.offer_count || 0);
  return Number(zone.net_per_hour || 0);
}

function metricDisplay(zone, metric) {
  if (metric === "payout") return `$${Number(zone.projected_gross || 0).toFixed(0)}`;
  if (metric === "offers") return String(zone.offer_count || 0);
  return `$${Number(zone.net_per_hour || 0).toFixed(0)}/hr`;
}

function heatColor(ratio) {
  if (ratio >= 0.82) return "#FF3B3B";
  if (ratio >= 0.62) return "#FF8A00";
  if (ratio >= 0.4) return "#FFD200";
  return "#AAFF00";
}

function Recenter({ center, zones }) {
  const map = useMap();
  const zoneKey = zones.map((zone) => `${zone.latitude}:${zone.longitude}`).join("|");

  useEffect(() => {
    if (zones.length === 1) {
      map.setView([zones[0].latitude, zones[0].longitude], 14);
      return;
    }
    if (zones.length > 1) {
      map.fitBounds(zones.map((zone) => [zone.latitude, zone.longitude]), {
        padding: [28, 28],
        maxZoom: 14,
      });
      return;
    }
    if (center) map.setView(center, 13);
  }, [center?.[0], center?.[1], zoneKey, map]);

  return null;
}

function freshnessLabel(source) {
  if (!source) return "Waiting for offer data";
  const age = source.age_minutes;
  if (source.freshness === "live") return "Live offer refresh";
  if (source.freshness === "recent") return age == null ? "Recent offer data" : `Updated ${age}m ago`;
  if (age == null) return "Offer freshness unknown";
  if (age < 1440) return `Stale · ${Math.max(1, Math.round(age / 60))}h old`;
  return `Stale · ${Math.max(1, Math.round(age / 1440))}d old`;
}

function currentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Device location is unavailable"));
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge: 30000,
      timeout: 12000,
    });
  });
}

// Real Route Optimizer hotspot map. Zones come only from authenticated,
// currently eligible Offer records geocoded on the server. Customer and
// drop-off locations are never sent to this visualization.
export default function RouteHeatMap({
  heightClass = "h-64",
  mode = "most_profit",
  originAddress = "",
  selectedOfferIds = [],
  refreshKey = 0,
}) {
  const [metric, setMetric] = useState("earnings");
  const [deviceCenter, setDeviceCenter] = useState(null);
  const [locationReady, setLocationReady] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [debouncedOrigin, setDebouncedOrigin] = useState(originAddress);
  const [payload, setPayload] = useState(null);
  const [flyTo, setFlyTo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let alive = true;
    currentPosition()
      .then((position) => {
        if (!alive) return;
        setDeviceCenter([
          Number(position.coords.latitude),
          Number(position.coords.longitude),
        ]);
        setLocationError("");
      })
      .catch((nextError) => {
        if (!alive) return;
        setLocationError(nextError?.message || "Precise location permission is required");
      })
      .finally(() => alive && setLocationReady(true));
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedOrigin(originAddress.trim()), 700);
    return () => window.clearTimeout(timer);
  }, [originAddress]);

  const selectedKey = useMemo(
    () => [...new Set(selectedOfferIds.map(String))].sort().join("|"),
    [selectedOfferIds],
  );
  const effectiveOriginAddress = deviceCenter ? "" : debouncedOrigin;

  useEffect(() => {
    let alive = true;
    if (!locationReady) return () => { alive = false; };

    setLoading(true);
    setError("");
    guardedInvoke(base44, "hotspot-map", {
      origin: effectiveOriginAddress ? null : {
        latitude: (deviceCenter || FALLBACK_CENTER)[0],
        longitude: (deviceCenter || FALLBACK_CENTER)[1],
      },
      origin_address: effectiveOriginAddress,
      market_state: "VA",
      feed_revision: refreshKey,
      mode,
      selected_offer_ids: selectedKey ? selectedKey.split("|") : [],
    }, {
      force: refreshTick > 0,
      userInitiated: refreshTick > 0,
    })
      .then((response) => {
        if (!alive) return;
        setPayload(response.data);
      })
      .catch((nextError) => {
        if (!alive) return;
        setPayload(null);
        setError(
          nextError?.response?.data?.error
          || nextError?.message
          || "Could not load the real hotspot map",
        );
      })
      .finally(() => alive && setLoading(false));

    return () => { alive = false; };
  }, [locationReady, deviceCenter?.[0], deviceCenter?.[1], effectiveOriginAddress, mode, selectedKey, refreshTick, refreshKey]);

  const zones = payload?.zones || [];
  const center = deviceCenter
    || (payload?.center ? [payload.center.latitude, payload.center.longitude] : null)
    || FALLBACK_CENTER;
  const maxMetric = Math.max(...zones.map((zone) => metricValue(zone, metric)), 1);
  const ranked = useMemo(
    () => [...zones].sort((a, b) => metricValue(b, metric) - metricValue(a, metric)),
    [zones, metric],
  );
  const best = ranked[0];
  const activeMetric = METRICS.find((item) => item.id === metric);

  return (
    <div className="rounded-3xl border border-primary/20 overflow-hidden glow-border">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/10 bg-black/50">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Flame className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate text-[11px] font-display tracking-[0.18em] text-primary">
              REAL OFFER HOTSPOTS
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-[9px] text-white/40">
            <Clock3 className="h-2.5 w-2.5" />
            {freshnessLabel(payload?.source)}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setRefreshTick((value) => value + 1)}
          disabled={loading}
          aria-label="Refresh real hotspot data"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary disabled:opacity-35"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1 border-b border-white/10 bg-black/35 p-1">
        {METRICS.map((item) => {
          const on = metric === item.id;
          const Icon = item.icon;
          return (
            <button
              type="button"
              key={item.id}
              onClick={() => setMetric(item.id)}
              className={`flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-bold transition-all active:scale-95 ${
                on ? "border border-primary/40 bg-primary/15 text-primary" : "border border-transparent text-white/55"
              }`}
            >
              <Icon className="h-3 w-3" />
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="relative">
        <MapContainer
          center={center}
          zoom={deviceCenter ? 13 : 4}
          className={`${heightClass} w-full`}
          zoomControl
          attributionControl
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors &copy; CARTO"
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          <Recenter center={center} zones={zones} />

          {zones.map((zone) => {
            const ratio = metricValue(zone, metric) / maxMetric;
            const color = heatColor(ratio);
            const radius = 12 + Math.min(16, Number(zone.offer_count || 1) * 3);
            const selected = Number(zone.selected_count || 0) > 0;
            return (
              <Fragment key={zone.id}>
                <CircleMarker
                  center={[zone.latitude, zone.longitude]}
                  radius={radius * 2.15}
                  pathOptions={{ color, fillColor: color, fillOpacity: 0.09, weight: 0 }}
                />
                <CircleMarker
                  center={[zone.latitude, zone.longitude]}
                  radius={radius * 1.35}
                  pathOptions={{ color, fillColor: color, fillOpacity: 0.21, weight: selected ? 2 : 0 }}
                />
                <CircleMarker
                  center={[zone.latitude, zone.longitude]}
                  radius={radius * 0.72}
                  pathOptions={{
                    color: selected ? "#00E5FF" : color,
                    fillColor: color,
                    fillOpacity: 0.68,
                    weight: selected ? 3 : 1,
                  }}
                  eventHandlers={{ click: () => setFlyTo([zone.latitude, zone.longitude]) }}
                >
                  <Tooltip direction="top" offset={[0, -5]} className="lokin-tip">
                    <b>{zone.name}</b><br />
                    {metricDisplay(zone, metric)} · {zone.offer_count} eligible offer{zone.offer_count === 1 ? "" : "s"}
                    {selected ? <><br />Included in optimized route</> : null}
                  </Tooltip>
                </CircleMarker>
              </Fragment>
            );
          })}

          {deviceCenter && (
            <>
              <CircleMarker center={deviceCenter} radius={6} pathOptions={{ color: "#00E5FF", fillColor: "#AAFF00", fillOpacity: 1, weight: 2 }} />
              <CircleMarker center={deviceCenter} radius={14} pathOptions={{ color: "#AAFF00", fillColor: "#AAFF00", fillOpacity: 0.14, weight: 0 }} />
            </>
          )}

          {flyTo && <Recenter center={flyTo} zones={[]} />}
        </MapContainer>

        <div className="absolute bottom-2 left-2 z-[500] flex items-center gap-1.5 rounded-full glass border border-white/10 px-2.5 py-1">
          <span className="text-[9px] tracking-widest text-white/50 font-display">LOW</span>
          {["#AAFF00", "#FFD200", "#FF8A00", "#FF3B3B"].map((color) => (
            <span key={color} className="h-2 w-2 rounded-full" style={{ background: color }} />
          ))}
          <span className="text-[9px] tracking-widest text-white/50 font-display">HIGH</span>
        </div>
        <div className="absolute top-2 right-2 z-[500] rounded-full glass border border-primary/30 px-2.5 py-1 text-[9px] font-bold tracking-widest text-primary">
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
                <div className="mt-2 text-sm font-bold text-white">
                  Real hotspot map unavailable
                </div>
                <div className="mt-1 text-[11px] leading-relaxed text-white/50">
                  {error || locationError || "LOKIN will not invent hotspot data."}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {!loading && !error && payload && zones.length === 0 && (
        <div className="border-t border-white/10 bg-amber-400/[0.05] px-3 py-3 text-[11px] leading-relaxed text-amber-100/75">
          No current verified Virginia offers are available within {payload.source?.radius_miles || 55} miles. Add an offer you can currently see in your delivery app; LOKIN will not invent demand.
        </div>
      )}

      {best && (
        <button
          type="button"
          onClick={() => setFlyTo([best.latitude, best.longitude])}
          className="w-full flex items-center gap-3 border-t border-white/10 bg-primary/[0.06] px-3 py-2.5 text-left active:scale-[0.99] transition-all"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-black">
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] tracking-widest text-white/40 font-display">TOP ZONE · {activeMetric.label.toUpperCase()}</div>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-white truncate">
              <MapPin className="h-3 w-3 text-primary" /> {best.name}
            </div>
            <div className="text-[10px] text-white/40">
              {best.distance_miles == null ? "Distance unavailable" : `${best.distance_miles.toFixed(1)} mi away`} · {best.offer_count} eligible offer{best.offer_count === 1 ? "" : "s"}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-display text-lg font-black leading-none" style={{ color: heatColor(metricValue(best, metric) / maxMetric) }}>
              {metricDisplay(best, metric)}
            </div>
          </div>
        </button>
      )}

      {payload?.source && (
        <div className="flex items-center justify-between gap-3 border-t border-white/8 bg-black/35 px-3 py-2 text-[9px] text-white/35">
          <span>{payload.source.located_offers}/{payload.source.eligible_offers} eligible offers mapped</span>
          <span className="truncate text-right">Mapbox geocoding · merchant pickups only</span>
        </div>
      )}
    </div>
  );
}
