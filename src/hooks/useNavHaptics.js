import { useEffect, useRef } from "react";

// Haptic approach cue (2026-09-27): fires a short Web Vibration pulse each
// time the driver crosses into a closer zone of the upcoming turn. Zones get
// stronger as the street/exit nears, so the cue escalates from a light tap at
// 400 m to a firm pulse right at the turn. Each zone fires at most once per
// maneuver, so GPS jitter can never re-trigger it.
const APPROACH_ZONES = [
  { maxM: 400, pattern: [20] },
  { maxM: 200, pattern: [25, 70, 25] },
  { maxM: 90, pattern: [35, 60, 50] },
  { maxM: 25, pattern: [50, 50, 110] },
];

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export default function useNavHaptics(maneuver) {
  const lastFiredRef = useRef({ id: "", zone: -1 });

  useEffect(() => {
    const canVibrate = typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
    if (!canVibrate) return;
    const distance = Number(maneuver?.distance_from_driver_m);
    if (!Number.isFinite(distance)) return;

    const id = `${maneuver?.leg_index ?? "x"}-${maneuver?.step_index ?? "y"}`;
    const last = lastFiredRef.current;
    if (last.id !== id) {
      last.id = id;
      last.zone = -1;
    }

    // Deepest zone reached so far for this maneuver.
    let zone = -1;
    for (let i = 0; i < APPROACH_ZONES.length; i += 1) {
      if (distance <= APPROACH_ZONES[i].maxM) zone = i;
    }
    if (zone <= last.zone) return;

    // A turn that appears already close (new route) fires only its deepest
    // zone's pattern — the whole ladder never cascades at once.
    const pattern = prefersReducedMotion() ? [15] : APPROACH_ZONES[zone].pattern;
    try {
      navigator.vibrate(pattern);
    } catch {
      // The OS can refuse vibrations; a silent no-op is fine.
    }
    last.zone = zone;
  }, [maneuver?.distance_from_driver_m, maneuver?.leg_index, maneuver?.step_index]);
}