// GPS approach alerts for voice-annotated hazards & delivery zones (2026-11-17):
// while navigating, LOKIN watches the driver's own DRIVER_REPORTED Hazard and
// DeliveryZone records (created by the GPS voice-annotation mic) and speaks
// one honest-data warning when the driver closes on one. One alert per record
// per session; wording is always "reported here earlier" — never live data.
import { useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { haversineMeters } from "@/lib/navigationGeometry";
import { playNavCue } from "@/lib/navAudioCue";
import { speakGuidance } from "@/lib/lokinVoicePipeline";
import { subtypeLabel } from "@/lib/gpsAnnotationParser";

const ALERT_M = 120; // approach radius — larger than the 50m annotation footprint
const RELOAD_MS = 120000;

function wordingFor(rec) {
  if (rec.kind === "HAZARD" || rec.__kind === "HAZARD") return "Hazard ahead, reported here earlier.";
  const sub = rec.subtype || rec.__subtype;
  const label = subtypeLabel(sub);
  return `${label} zone ahead, reported here earlier.`;
}

export default function GpsApproachAlert({ latitude, longitude }) {
  const recordsRef = useRef([]);
  const alertedRef = useRef(new Set());
  const posRef = useRef(null);
  posRef.current =
    Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))
      ? [Number(longitude), Number(latitude)]
      : null;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [hazards, zones] = await Promise.all([
          base44.entities.Hazard.filter({}, "-created_date", 100),
          base44.entities.DeliveryZone.filter({}, "-created_date", 100),
        ]);
        if (cancelled) return;
        const withKind = (rows, kind) =>
          (rows || [])
            .filter((r) => Number.isFinite(Number(r.latitude)) && Number.isFinite(Number(r.longitude)))
            .map((r) => ({ ...r, __kind: kind }));
        recordsRef.current = [...withKind(hazards, "HAZARD"), ...withKind(zones, "DELIVERY_ZONE")];
      } catch {
        /* keep previous list; a later reload retries */
      }
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
    for (const r of recordsRef.current) {
      if (alertedRef.current.has(r.id)) continue;
      const dist = haversineMeters(pos, [Number(r.longitude), Number(r.latitude)]);
      if (dist <= ALERT_M) {
        alertedRef.current.add(r.id);
        playNavCue("imminent");
        speakGuidance(wordingFor(r));
        break; // one alert per GPS fix
      }
    }
  }, [latitude, longitude]);

  return null;
}