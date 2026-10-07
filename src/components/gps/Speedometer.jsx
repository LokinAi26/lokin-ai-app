import { useEffect, useRef, useState } from "react";
import { Gauge } from "lucide-react";
import { fetchSpeedLimit } from "@/lib/speedLimit";
import { haversineMeters } from "@/lib/navigationGeometry";
import { playNavCue } from "@/lib/navAudioCue";

// Real-time digital speedometer + posted speed limit for the GPS HUD.
// Speed comes from the device GPS fix feed (nav.rawPosition.speed_mps) —
// never estimated. An unknown GPS speed renders "—", not 0. The speed limit
// is live OSM data, re-queried only when the driver moves or it goes stale,
// and renders as nothing at all when OSM can't answer (fail-safe).
const MPS_TO_MPH = 2.236936;
const QUERY_MOVE_M = 150;      // re-query after moving this far
const QUERY_MIN_INTERVAL_MS = 12000;
const FAILED_RETRY_MS = 60000;
const LIMIT_STALE_MS = 360000; // OSM limit older than 6 min is dropped

export default function Speedometer({ speedMps, latitude, longitude, variant = "card" }) {
  const [limit, setLimit] = useState(null); // { mph, fetched_at, road_name }
  const lastQueryRef = useRef(null);        // { lat, lon, at, ok }
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // The position changes on every GPS fix (~1 Hz) while an Overpass lookup
  // takes seconds, so the request must outlive effect re-runs: one lookup at
  // a time, and its answer lands as long as the gauge is still mounted.
  useEffect(() => {
    if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) return;
    if (inFlightRef.current) return;
    const now = Date.now();
    const last = lastQueryRef.current;
    if (last) {
      // haversineMeters takes [lon, lat] pairs; four bare numbers made this NaN,
      // so every GPS fix re-queried OSM.
      const moved = haversineMeters([last.lon, last.lat], [longitude, latitude]);
      // Cooldown since the last attempt, unless the driver moved well past it.
      if (now - last.at < (last.ok ? QUERY_MIN_INTERVAL_MS : FAILED_RETRY_MS) && moved < QUERY_MOVE_M) return;
      // A fresh on-screen limit is only refreshed after real movement.
      if (limit && now - limit.fetched_at < LIMIT_STALE_MS && moved < QUERY_MOVE_M) return;
    }
    const query = { lat: latitude, lon: longitude, at: now, ok: true };
    lastQueryRef.current = query;
    inFlightRef.current = true;
    fetchSpeedLimit(latitude, longitude)
      .then((res) => {
        query.ok = Boolean(res);
        query.at = Date.now();
        if (mountedRef.current) setLimit(res ? { mph: res.speed_limit_mph, fetched_at: Date.now(), road_name: res.road_name } : null);
      })
      .catch(() => { query.ok = false; })
      .finally(() => { inFlightRef.current = false; });
  }, [latitude, longitude, limit]);

  // A missing GPS speed arrives as null; Number(null) is 0, which would show
  // a moving car as "0 MPH". Unknown renders as "—".
  const known = speedMps != null && Number.isFinite(Number(speedMps));
  const mph = known ? Math.max(0, Math.round(Number(speedMps) * MPS_TO_MPH)) : null;
  const displayLimit = limit && Date.now() - limit.fetched_at < LIMIT_STALE_MS ? limit : null;
  const overLimit = Boolean(displayLimit && mph != null && mph > displayLimit.mph);

  // Speeding alert (2026-10-07): one subtle haptic pulse + soft chime the
  // moment the driver crosses the posted limit, re-armed only after they
  // drop back to it — GPS jitter can never re-fire it mid-speeding.
  const alertedRef = useRef(false);
  useEffect(() => {
    if (!overLimit) {
      alertedRef.current = false;
      return;
    }
    if (alertedRef.current) return;
    alertedRef.current = true;
    try {
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        navigator.vibrate(reduced ? [20] : [35, 70, 35]);
      }
    } catch {
      // The OS can refuse vibration; a silent no-op is fine.
    }
    playNavCue("speeding");
  }, [overLimit]);

  // Compact floating gauge for the full-screen navigation HUD.
  if (variant === "hud") {
    return (
      <div className="pointer-events-none flex items-center gap-2">
        <div
          className={`flex h-16 w-16 flex-col items-center justify-center rounded-2xl border bg-black/85 shadow-lg backdrop-blur ${overLimit ? "border-red-500/80" : "border-accent/40"}`}
          aria-live="polite"
          aria-label={mph != null ? `Speed ${mph} miles per hour` : "Speed unavailable"}
        >
          <span className={`font-display text-2xl font-black leading-none ${overLimit ? "text-red-400" : "text-white"}`}>{mph != null ? mph : "—"}</span>
          <span className="mt-0.5 text-[9px] font-bold tracking-[0.12em] text-white/50">MPH</span>
        </div>
        {displayLimit && (
          <div
            className="flex h-14 w-12 flex-col items-center justify-center rounded-lg border-[3px] border-black bg-white text-black shadow-lg"
            role="img"
            aria-label={`Posted speed limit ${displayLimit.mph} miles per hour, from OpenStreetMap`}
          >
            <span className="text-[8px] font-bold leading-tight">SPEED</span>
            <span className="text-[8px] font-bold leading-tight">LIMIT</span>
            <span className="font-display text-lg font-black leading-none">{displayLimit.mph}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-accent/40 bg-accent/10 glow-cyan">
          <Gauge className="h-5 w-5 text-accent" />
        </div>
        <div className="min-w-0">
          <div className="lokin-kicker lokin-kicker-cyan">SPEED</div>
          <div
            className={`font-display text-3xl font-black leading-none ${overLimit ? "text-red-400" : "metal-text"}`}
            aria-live="polite"
            aria-label={mph != null ? `Speed ${mph} miles per hour` : "Speed unavailable"}
          >
            {mph != null ? mph : "—"}
            <span className="ml-1 align-middle text-xs font-bold text-white/45">MPH</span>
          </div>
        </div>
      </div>
      {displayLimit && (
        <div
          className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border-[3px] border-red-500 bg-white text-black"
          role="img"
          aria-label={`Posted speed limit ${displayLimit.mph} miles per hour, from OpenStreetMap`}
          title={`Posted limit · OpenStreetMap${displayLimit.road_name ? ` · ${displayLimit.road_name}` : ""}`}
        >
          <span className="text-[8px] font-bold leading-tight tracking-tight">SPEED</span>
          <span className="text-[8px] font-bold leading-tight tracking-tight">LIMIT</span>
          <span className="font-display text-xl font-black leading-none">{displayLimit.mph}</span>
        </div>
      )}
    </div>
  );
}