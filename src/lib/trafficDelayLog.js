import { base44 } from "@/api/base44Client";

// Traffic-delay logging (2026-10-03): every announced or voice-reported
// slowdown is recorded with its location, magnitude and day part, so the
// driver can later review which areas to avoid at which hours.

export function dayPartForDate(d = new Date()) {
  const h = d.getHours();
  if (h >= 6 && h < 11) return "morning";
  if (h >= 11 && h < 14) return "lunch";
  if (h >= 14 && h < 17) return "afternoon";
  if (h >= 17 && h < 20) return "dinner";
  if (h >= 20 && h < 22) return "evening";
  return "late_night";
}

export const DAY_PART_LABELS = {
  morning: "Morning",
  lunch: "Lunch",
  afternoon: "Afternoon",
  dinner: "Dinner",
  evening: "Evening",
  late_night: "Late Night",
};

// Pulls the street name out of a navigation maneuver instruction such as
// "Turn right onto Colley Avenue" → "Colley Avenue".
export function streetFromInstruction(instruction = "") {
  const m = String(instruction).match(/\b(?:onto|on|continue (?:on|onto)|heading toward)\s+(.+)$/i);
  if (!m) return "";
  return m[1].replace(/[.!,].*$/, "").trim().slice(0, 60);
}

// Fire-and-forget: a logging failure must never disturb navigation audio.
// The same area in the same day part within 20 minutes counts as one
// ongoing slowdown — no duplicate records.
export function logTrafficDelay({ coordinate, streetName, delayMinutes, source = "auto_warning" }) {
  try {
    const street = String(streetName || "").trim();
    const area = street || (Array.isArray(coordinate) ? `${Number(coordinate[0]).toFixed(3)}, ${Number(coordinate[1]).toFixed(3)}` : "");
    const now = Date.now();
    const dedupeKey = `lokin_delay_log_${area}_${dayPartForDate()}`;
    const last = Number(localStorage.getItem(dedupeKey) || 0);
    if (area && now - last < 20 * 60 * 1000) return;
    if (area) localStorage.setItem(dedupeKey, String(now));
    base44.entities.TrafficDelay.create({
      area: area || "unknown area",
      latitude: Number.isFinite(Number(coordinate?.[0])) ? Number(coordinate[0]) : null,
      longitude: Number.isFinite(Number(coordinate?.[1])) ? Number(coordinate[1]) : null,
      delay_minutes: Math.max(1, Math.round(Number(delayMinutes) || 1)),
      day_part: dayPartForDate(),
      source,
      reported_at: new Date().toISOString(),
    }).catch(() => {});
  } catch {}
}