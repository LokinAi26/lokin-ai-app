// Traffic-delay hotspot alerts (2026-10-07): while the driver is navigating,
// LOKIN watches the driver's own logged TrafficDelay records (live-ETA
// slowdowns and voice reports, RLS-scoped to the driver) and speaks one
// honest-data alert when they come within 250 m of a hotspot logged in the
// last 3 days. One alert per hotspot per session; the wording is always
// "reported here earlier" — never presented as live traffic data.
import { useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { haversineMeters } from "@/lib/navigationGeometry";
import { playNavCue } from "@/lib/navAudioCue";
import { speakGuidance } from "@/lib/lokinVoicePipeline";

const ALERT_M = 250;
const MAX_AGE_DAYS = 3;
const RELOAD_MS = 120000;

export default function TrafficDelayHotspotAlert({ latitude, longitude }) {
  const delaysRef = useRef([]);
  const alertedRef = useRef(new Set());
  const posRef = useRef(null);
  posRef.current =
    Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))
      ? [Number(longitude), Number(latitude)]
      : null;

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      base44.entities.TrafficDelay.filter({}, "-created_date", 100)
        .then((rows) => {
          if (cancelled) return;
          const cutoff = Date.now() - MAX_AGE_DAYS * 86400000;
          delaysRef.current = rows.filter((r) => {
            const t = r.reported_at
              ? new Date(r.reported_at).getTime()
              : r.created_date
                ? new Date(r.created_date).getTime()
                : 0;
            return Number.isFinite(Number(r.latitude)) && Number.isFinite(Number(r.longitude)) && t >= cutoff;
          });
        })
        .catch(() => {});
    };
    load();
    const timer = window.setInterval(load, RELOAD_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const pos = posRef.current;
    if (!pos) return;
    for (const d of delaysRef.current) {
      if (alertedRef.current.has(d.id)) continue;
      const dist = haversineMeters(pos, [Number(d.longitude), Number(d.latitude)]);
      if (dist <= ALERT_M) {
        alertedRef.current.add(d.id);
        playNavCue("imminent");
        const mins = Number(d.delay_minutes) > 0
          ? ` A slowdown of about ${Math.round(Number(d.delay_minutes))} minute${Math.round(Number(d.delay_minutes)) === 1 ? "" : "s"} was reported here recently.`
          : " A traffic slowdown was reported here recently.";
        speakGuidance(`Known delay area ahead.${mins}`);
        break; // one alert per GPS fix
      }
    }
  }, [latitude, longitude]);

  return null;
}