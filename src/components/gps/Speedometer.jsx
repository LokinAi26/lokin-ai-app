import { useEffect, useRef, useState } from "react";
import { Gauge } from "lucide-react";
import { fetchSpeedLimit } from "@/lib/speedLimit";
import { haversineMeters } from "@/lib/navigationGeometry";

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

export default function Speedometer({ speedMps, latitude, longitude, heading }) {
  const [limit, setLimit] = useState(null); // { mph, fetched_at, road_name }
  const lastQueryRef = useRef(null);        // { lat, lon, at, ok }

  useEffect(() => {
    if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) return;
    const now = Date.now();
    const last = lastQueryRef.current;
    if (last) {
      const moved = haversineMeters(last.lat, last.lon, latitude, longitude);
      // Cooldown since the last attempt, unless the driver moved well past it.
      if (now - last.at < (last.ok ? QUERY_MIN_INTERVAL_MS : FAILED_RETRY_MS) && moved < QUERY_MOVE_M) return;
      // A fresh on-screen limit is only refreshed after real movement.
      if (limit && now - limit.fetched_at < LIMIT_STALE_MS && moved < QUERY_MOVE_M) return;
    }
    lastQueryRef.current = { lat: latitude, lon: longitude, at: now };
    let alive = true;
    fetchSpeedLimit(latitude, longitude, heading)
      .then((res) => {
        if (!alive) return;
        lastQueryRef.current = { lat: latitude, lon: longitude, at: Date.now(), ok: Boolean(res) };
        setLimit(res ? { mph: res.speed_limit_mph, fetched_at: Date.now(), road_name: res.road_name } : null);
      })
      .catch(() => {
        if (alive) lastQueryRef.current.ok = false;
      });
    return () => { alive = false; };
  }, [latitude, longitude, limit, heading]);

  const known = Number.isFinite(Number(speedMps));
  const mph = known ? Math.max(0, Math.round(Number(speedMps) * MPS_TO_MPH)) : null;
  const displayLimit = limit && Date.now() - limit.fetched_at < LIMIT_STALE_MS ? limit : null;
  const overLimit = Boolean(displayLimit && mph != null && mph > displayLimit.mph + 4);

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
          <span className="text-[6px] font-bold leading-tight tracking-tight">SPEED</span>
          <span className="text-[6px] font-bold leading-tight tracking-tight">LIMIT</span>
          <span className="font-display text-xl font-black leading-none">{displayLimit.mph}</span>
        </div>
      )}
    </div>
  );
}