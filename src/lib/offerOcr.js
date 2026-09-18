import { base44 } from "@/api/base44Client";
import { guardedInvoke } from "@/lib/creditGuardian";
import { screenshotToDataUrl } from "@/lib/earningsOcr";

// Client helper for the delivery-offer evaluation pipeline.
// Flow: driver snaps an offer screen -> image is downscaled locally ->
// external-ai-gateway (task: offer_ocr) returns { parsed, ... } ->
// evaluateOffer() scores $/mile and $/hour against the driver's thresholds.

// Dasher-tuned defaults: $1/mi floor, $2/mi strong; $20/hr floor, $30/hr strong.
const DEFAULT_THRESHOLDS = { minPerMile: 1.0, targetPerMile: 2.0, minPerHour: 20.0, targetPerHour: 30.0 };
const THRESHOLD_KEY = "lokin_offer_thresholds";

export function loadOfferThresholds() {
  try {
    const raw = JSON.parse(localStorage.getItem(THRESHOLD_KEY) || "null");
    if (!raw || typeof raw !== "object") return { ...DEFAULT_THRESHOLDS };
    const out = { ...DEFAULT_THRESHOLDS };
    for (const k of Object.keys(DEFAULT_THRESHOLDS)) {
      const v = Number(raw[k]);
      if (Number.isFinite(v) && v > 0) out[k] = v;
    }
    return out;
  } catch {
    return { ...DEFAULT_THRESHOLDS };
  }
}

export function saveOfferThresholds(t) {
  try {
    localStorage.setItem(THRESHOLD_KEY, JSON.stringify(t));
  } catch { /* storage unavailable — thresholds just won't persist */ }
}

// Ask the gateway to parse the offer screenshot. Returns { parsed, reply,
// engine, model, usage } where parsed is { amount, platform, miles, minutes,
// merchant, destination, stops, peak_pay, confidence, note }.
export async function parseOfferScreenshot(dataUrl) {
  const m = /^data:([^;]+);base64,(.+)$/s.exec(String(dataUrl || ""));
  if (!m) throw new Error("Could not read that image. Try another screenshot.");
  const res = await guardedInvoke(
    base44,
    "external-ai-gateway",
    {
      task: "offer_ocr",
      engine: "gemini",
      message: "Parse this delivery offer screenshot into JSON.",
      images: [{ mimeType: m[1], data: m[2] }],
    },
    { userInitiated: true }
  );
  const payload = res?.data || res || {};
  if (payload?.error) throw new Error(payload.error);
  return payload;
}

// Normalize the model's JSON into display/evaluation-ready values.
export function normalizeParsedOffer(parsed) {
  const p = parsed && typeof parsed === "object" ? parsed : {};
  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
  };
  const str = (v) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 120) : "");
  return {
    amount: num(p.amount),
    platform: str(p.platform),
    miles: num(p.miles),
    minutes: num(p.minutes),
    merchant: str(p.merchant),
    destination: str(p.destination),
    stops: Number.isFinite(Number(p.stops)) && Number(p.stops) > 0 ? Math.round(Number(p.stops)) : null,
    peak_pay: p.peak_pay === true,
    confidence: p.confidence || "low",
    note: str(p.note),
  };
}

// Score the offer: $/mile and $/hour vs thresholds. When miles are missing but
// minutes are present, estimate distance at ~0.55 mi/min (city driving) so a
// verdict is still possible — flagged as an estimate.
export function evaluateOffer(offer, thresholds) {
  const t = thresholds || DEFAULT_THRESHOLDS;
  const o = offer || {};
  const amount = Number(o.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { verdict: "unknown", perMile: null, perHour: null, reasons: ["LOKIN could not read a payout amount from this screenshot."], estimatedMiles: false };
  }
  let miles = Number(o.miles);
  let estimatedMiles = false;
  const minutes = Number(o.minutes);
  if (!(Number.isFinite(miles) && miles > 0)) {
    if (Number.isFinite(minutes) && minutes > 0) {
      miles = Math.round(minutes * 0.55 * 10) / 10;
      estimatedMiles = true;
    }
  }
  const hasMiles = Number.isFinite(miles) && miles > 0;
  const hasMinutes = Number.isFinite(minutes) && minutes > 0;
  const perMile = hasMiles ? Math.round((amount / miles) * 100) / 100 : null;
  const perHour = hasMinutes ? Math.round((amount / (minutes / 60)) * 100) / 100 : null;

  const reasons = [];
  let verdict;
  if (perMile === null && perHour === null) {
    verdict = "unknown";
    reasons.push("LOKIN could not read miles or time from this screenshot — review the offer manually.");
  } else {
    const milePass = perMile !== null && perMile >= t.minPerMile;
    const mileStrong = perMile !== null && perMile >= t.targetPerMile;
    const hourPass = perHour !== null && perHour >= t.minPerHour;
    const hourStrong = perHour !== null && perHour >= t.targetPerHour;
    if (mileStrong && hourStrong) {
      verdict = "strong_take";
      reasons.push("Beats both your per-mile and per-hour targets.");
    } else if (milePass && hourPass) {
      verdict = "take";
      reasons.push("Clears both your minimums.");
    } else if (milePass || hourPass) {
      verdict = "borderline";
      if (milePass) reasons.push(`$/mi is fine ($${perMile.toFixed(2)}) but $/hr misses your $${t.minPerHour} floor.`);
      else reasons.push(`$/hr is fine ($${perHour.toFixed(2)}) but $/mi misses your $${t.minPerMile.toFixed(2)} floor.`);
    } else {
      verdict = "skip";
      const parts = [];
      if (perMile !== null) parts.push(`$${perMile.toFixed(2)}/mi (floor $${t.minPerMile.toFixed(2)})`);
      if (perHour !== null) parts.push(`$${perHour.toFixed(2)}/hr (floor $${t.minPerHour})`);
      reasons.push(`Below both minimums: ${parts.join(", ")}.`);
    }
    if (estimatedMiles) reasons.push("Miles estimated from time shown — treat $/mi as approximate.");
    if (o.peak_pay) reasons.push("Peak pay is on this offer — that is baked into the payout.");
    if (o.stops && o.stops > 1) reasons.push(`${o.stops} stops — factor in extra dropoff time the screen may not show.`);
  }

  return { verdict, perMile, perHour, reasons, estimatedMiles };
}

export const VERDICT_META = {
  strong_take: { label: "STRONG TAKE", tone: "take" },
  take: { label: "TAKE IT", tone: "take" },
  borderline: { label: "BORDERLINE", tone: "borderline" },
  skip: { label: "SKIP", tone: "skip" },
  unknown: { label: "NEEDS REVIEW", tone: "borderline" },
};

export { screenshotToDataUrl };
