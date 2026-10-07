// GPS voice annotation parser (SPEC-002 section 6, Phase 4).
// Simple keyword matching only — no AI service, no guessing. When no keyword
// matches, the caller must ask the driver which type instead of assuming.

export const ANNOTATION_KINDS = {
  HAZARD: "HAZARD",
  DELIVERY_ZONE: "DELIVERY_ZONE",
};

export const ZONE_SUBTYPES = [
  { value: "DROP_OFF", label: "DROP OFF" },
  { value: "PICKUP", label: "PICKUP" },
  { value: "STAGING", label: "STAGING" },
];

// All four choices the driver is offered when the transcript matches nothing.
export const ANNOTATION_CHOICES = [
  { kind: "HAZARD", subtype: null, label: "HAZARD" },
  ...ZONE_SUBTYPES.map((s) => ({ kind: "DELIVERY_ZONE", subtype: s.value, label: s.label })),
];

export function subtypeLabel(subtype) {
  return ZONE_SUBTYPES.find((s) => s.value === subtype)?.label || "DELIVERY ZONE";
}

export function annotationTypeLabel(kind, subtype) {
  if (kind === "HAZARD") return "HAZARD";
  if (kind === "DELIVERY_ZONE") return subtypeLabel(subtype);
  return "";
}

// Returns { kind, subtype } — either may be null. `subtype: null` with a
// matched zone kind means "delivery zone" was said without a sub-type, so the
// driver must pick one (never guessed).
export function parseAnnotationTranscript(text) {
  const t = String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return { kind: null, subtype: null };
  // Spec: "starts with hazard" → HAZARD entity. Hazard keywords ("gate code",
  // "restricted", …) match anywhere in the note — drivers say the words mid-
  // sentence, not as a command.
  if (/^hazard\b/.test(t)) return { kind: "HAZARD", subtype: null };
  if (/\bgate\s?code\b/.test(t)) return { kind: "HAZARD", subtype: null };
  if (/\brestricted\b/.test(t)) return { kind: "HAZARD", subtype: null };
  if (/\bprivate\s?property\b/.test(t)) return { kind: "HAZARD", subtype: null };
  if (/\bno\s?access\b/.test(t)) return { kind: "HAZARD", subtype: null };
  if (/\bdo\s?not\s?enter\b/.test(t)) return { kind: "HAZARD", subtype: null };
  if (/\bdrop\s?off\b/.test(t)) return { kind: "DELIVERY_ZONE", subtype: "DROP_OFF" };
  if (/\bpick\s?up\b/.test(t)) return { kind: "DELIVERY_ZONE", subtype: "PICKUP" };
  if (/\bstaging\b/.test(t)) return { kind: "DELIVERY_ZONE", subtype: "STAGING" };
  if (/\bdelivery zone\b/.test(t)) return { kind: "DELIVERY_ZONE", subtype: null };
  return { kind: null, subtype: null };
}