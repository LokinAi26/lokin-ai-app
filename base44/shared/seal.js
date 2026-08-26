import { trueEarningRate } from "./delivery.js";

export const SEAL_ENGINE_VERSION = "seal-driver-1.0.0";
export const SEAL_POLICY_VERSION = "driver-policy-1.0.0";

const TRUSTED_SOURCES = new Set(["user_entered", "user_shared", "official_api", "merchant_feed"]);
const TRUSTED_VERIFICATION = new Set(["address_verified", "platform_verified"]);
const REASON_TEXT = Object.freeze({
  STRONG_NET_HOURLY: "Strong projected net earnings per hour",
  STRONG_NET_PER_MILE: "Strong projected net earnings per mile",
  MEETS_DRIVER_GOALS: "Meets the driver's configured earnings and distance goals",
  VERIFIED_CURRENT_OFFER: "Current offer with accepted provenance and verification",
  LOW_ESTIMATED_FRICTION: "Estimated time and order complexity are manageable",
  PREFERRED_CATEGORY: "Matches an enabled delivery category",
  BEST_AVAILABLE_MATCH: "Highest SEAL score among the current eligible offers",
  BELOW_MIN_PAYOUT: "Below the driver's minimum payout",
  BELOW_NET_HOURLY_TARGET: "Below the driver's net hourly target",
  OVER_MAX_MILES: "Exceeds the driver's maximum distance",
  CATEGORY_NOT_ENABLED: "Delivery category is not enabled",
  BLOCKED_CUSTOMER: "Customer is on the driver's blocked list",
  AVOIDED_PLACE: "Pickup or drop-off matches the driver's avoid list",
  EXPIRED_OFFER: "Offer is expired or has invalid timing",
  UNTRUSTED_SOURCE: "Offer provenance or verification is insufficient",
  INVALID_ECONOMICS: "Offer is missing usable payout, mileage, or duration data",
});

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : min));
}

function round(value, places = 2) {
  const factor = 10 ** places;
  return Math.round((Number(value) || 0) * factor) / factor;
}

function normalized(value) {
  return String(value || "").trim().toLowerCase();
}

function offerTiming(offer, nowMs) {
  const captured = Date.parse(String(offer?.captured_at || ""));
  const expires = Date.parse(String(offer?.expires_at || ""));
  const capturedValid = Number.isFinite(captured) && captured <= nowMs + 5 * 60_000;
  const expiresValid = Number.isFinite(expires) && expires > nowMs;
  const ageMinutes = capturedValid ? Math.max(0, Math.round((nowMs - captured) / 60_000)) : null;
  return { capturedValid, expiresValid, ageMinutes };
}

function provenanceConfidence(offer, timing) {
  const source = String(offer?.source_type || "");
  const verification = String(offer?.verification_status || "");
  let value = 20;
  if (source === "official_api" && verification === "platform_verified") value = 100;
  else if (source === "merchant_feed" && TRUSTED_VERIFICATION.has(verification)) value = 92;
  else if (TRUSTED_SOURCES.has(source) && verification === "address_verified") value = 76;
  else if (TRUSTED_SOURCES.has(source)) value = 52;

  if (!timing.capturedValid || !timing.expiresValid) value -= 45;
  else if (timing.ageMinutes != null && timing.ageMinutes > 120) value -= 12;
  return clamp(value);
}

function completenessConfidence(offer) {
  const required = ["payout", "miles", "est_minutes", "pickup_address", "dropoff_address", "source_type", "verification_status"];
  const present = required.filter((key) => {
    const value = offer?.[key];
    return value !== "" && value !== null && value !== undefined && !(typeof value === "number" && !Number.isFinite(value));
  }).length;
  return clamp((present / required.length) * 100);
}

function matchesAvoidedPlace(offer, avoidPlaces) {
  const haystack = [offer?.merchant, offer?.pickup_address, offer?.dropoff_address, offer?.customer_name]
    .map(normalized)
    .join(" ");
  return (avoidPlaces || []).some((item) => {
    const needle = normalized(item?.name);
    return needle && haystack.includes(needle);
  });
}

function matchesBlockedCustomer(offer, blocked) {
  const customer = normalized(offer?.customer_name);
  if (!customer) return false;
  return (blocked || []).some((item) => normalized(item?.name) === customer);
}

function confidenceLabel(score) {
  if (score >= 80) return "high";
  if (score >= 55) return "medium";
  return "low";
}

export function evaluateOfferWithSeal(offer, preferences = {}, context = {}) {
  const nowMs = context.now instanceof Date ? context.now.getTime() : Number(context.now || Date.now());
  const blocked = context.blocked || [];
  const avoidPlaces = context.avoidPlaces || [];
  const acceptedCategories = new Set(preferences.accepted_categories || []);
  const timing = offerTiming(offer, nowMs);
  const economics = trueEarningRate(offer || {}, preferences || {});
  const netPerMile = Number(offer?.miles) > 0 ? economics.net / Number(offer.miles) : 0;
  const hardReasons = [];
  const reasonCodes = [];
  const uncertaintyCodes = [];

  if (!TRUSTED_SOURCES.has(String(offer?.source_type || "")) ||
      !TRUSTED_VERIFICATION.has(String(offer?.verification_status || ""))) {
    hardReasons.push("UNTRUSTED_SOURCE");
  }
  if (!timing.capturedValid || !timing.expiresValid) hardReasons.push("EXPIRED_OFFER");
  if (!Number.isFinite(Number(offer?.payout)) || Number(offer?.payout) <= 0 ||
      !Number.isFinite(Number(offer?.miles)) || Number(offer?.miles) <= 0 ||
      !Number.isFinite(Number(offer?.est_minutes)) || Number(offer?.est_minutes) <= 0) {
    hardReasons.push("INVALID_ECONOMICS");
  }
  if (acceptedCategories.size && !acceptedCategories.has(offer?.category)) hardReasons.push("CATEGORY_NOT_ENABLED");
  if (Number(offer?.payout || 0) < Number(preferences.min_payout || 0)) hardReasons.push("BELOW_MIN_PAYOUT");
  if (Number(offer?.miles || 0) > Number(preferences.max_miles || 99)) hardReasons.push("OVER_MAX_MILES");
  if (economics.netPerHour < Number(preferences.min_per_hour || 0)) hardReasons.push("BELOW_NET_HOURLY_TARGET");
  if (matchesBlockedCustomer(offer, blocked)) hardReasons.push("BLOCKED_CUSTOMER");
  if (matchesAvoidedPlace(offer, avoidPlaces)) hardReasons.push("AVOIDED_PLACE");

  const provenance = provenanceConfidence(offer, timing);
  const completeness = completenessConfidence(offer);
  const confidenceScore = clamp(provenance * 0.65 + completeness * 0.35);
  const targetHourly = Math.max(1, Number(preferences.min_per_hour || 22));
  const targetPerMile = Math.max(0.5, Number(preferences.target_per_mile || 1.5));
  const hourlyScore = clamp((economics.netPerHour / targetHourly) * 80);
  const perMileScore = clamp((netPerMile / targetPerMile) * 80);
  const preferenceFit = acceptedCategories.size === 0 || acceptedCategories.has(offer?.category) ? 100 : 0;
  const itemCount = Math.max(1, Number(offer?.items_count || 1));
  const frictionPenalty = Math.min(55, Math.max(0, itemCount - 10) * 0.8 + Math.max(0, Number(offer?.est_minutes || 0) - 45) * 0.5);
  const frictionScore = clamp(100 - frictionPenalty);
  const safetyScore = hardReasons.some((code) => ["BLOCKED_CUSTOMER", "AVOIDED_PLACE", "UNTRUSTED_SOURCE"].includes(code)) ? 0 : 100;
  const distanceScore = clamp(100 - (Number(offer?.miles || 0) / Math.max(1, Number(preferences.max_miles || 12))) * 55);

  const score = Math.round(clamp(
    hourlyScore * 0.30 +
    perMileScore * 0.25 +
    confidenceScore * 0.15 +
    frictionScore * 0.10 +
    distanceScore * 0.10 +
    preferenceFit * 0.05 +
    safetyScore * 0.05
  ));

  if (economics.netPerHour >= targetHourly * 1.15) reasonCodes.push("STRONG_NET_HOURLY");
  if (netPerMile >= targetPerMile * 1.15) reasonCodes.push("STRONG_NET_PER_MILE");
  if (!hardReasons.length) reasonCodes.push("MEETS_DRIVER_GOALS");
  if (provenance >= 70 && timing.expiresValid) reasonCodes.push("VERIFIED_CURRENT_OFFER");
  if (frictionScore >= 75) reasonCodes.push("LOW_ESTIMATED_FRICTION");
  if (preferenceFit === 100) reasonCodes.push("PREFERRED_CATEGORY");

  if (["user_entered", "user_shared"].includes(String(offer?.source_type || ""))) {
    uncertaintyCodes.push("USER_REPORTED_PAYOUT", "PLATFORM_AVAILABILITY_NOT_VERIFIED");
  }
  if (!offer?.store_hours) uncertaintyCodes.push("STORE_HOURS_UNKNOWN");
  if (Number(offer?.tip || 0) > 0 && offer?.verification_status !== "platform_verified") uncertaintyCodes.push("TIP_NOT_VERIFIED");
  if (confidenceScore < 55) uncertaintyCodes.push("LOW_DATA_CONFIDENCE");

  let action = "CONSIDER";
  if (hardReasons.length) action = "PASS";
  else if (score >= 75 && confidenceScore >= 55) action = "TAKE";

  const uniqueReasons = [...new Set([...hardReasons, ...reasonCodes])];
  return {
    engine: "LOKIN_SEAL",
    engine_version: SEAL_ENGINE_VERSION,
    policy_version: SEAL_POLICY_VERSION,
    subject_type: "offer",
    subject_id: String(offer?.id || offer?.capture_id || ""),
    action,
    score,
    confidence: confidenceLabel(confidenceScore),
    confidence_score: Math.round(confidenceScore),
    economics: {
      projected_gross: economics.gross,
      projected_expenses: economics.expenses,
      projected_net: economics.net,
      projected_net_per_hour: economics.netPerHour,
      projected_net_per_mile: round(netPerMile),
      projected_minutes: economics.minutes,
      projected_miles: round(offer?.miles),
    },
    sense: {
      source_type: offer?.source_type || "unknown",
      verification_status: offer?.verification_status || "unverified",
      captured_at: offer?.captured_at || null,
      expires_at: offer?.expires_at || null,
      age_minutes: timing.ageMinutes,
      region: offer?.region || null,
    },
    evaluate: {
      hard_gate_passed: hardReasons.length === 0,
      components: {
        net_hourly: Math.round(hourlyScore),
        net_per_mile: Math.round(perMileScore),
        confidence: Math.round(confidenceScore),
        friction: Math.round(frictionScore),
        distance: Math.round(distanceScore),
        preference_fit: Math.round(preferenceFit),
        safety: Math.round(safetyScore),
      },
    },
    advise: {
      requires_driver_confirmation: true,
      automatic_platform_action: false,
      reason_codes: uniqueReasons.slice(0, 6),
      reasons: uniqueReasons.slice(0, 6).map((code) => REASON_TEXT[code] || code),
      uncertainty_codes: [...new Set(uncertaintyCodes)].slice(0, 6),
    },
    learn: {
      feedback_expected: true,
      outcome_fields: ["actual_payout", "actual_minutes", "actual_miles", "actual_wait_minutes", "driver_rating"],
    },
  };
}

export function evaluateOffersWithSeal(offers, preferences = {}, context = {}) {
  const decisions = (offers || []).map((offer) => evaluateOfferWithSeal(offer, preferences, context));
  return decisions.sort((a, b) => {
    const actionOrder = { TAKE: 0, CONSIDER: 1, PASS: 2 };
    return (actionOrder[a.action] - actionOrder[b.action]) || b.score - a.score || b.confidence_score - a.confidence_score;
  });
}

export function buildSealSummary(decisions = []) {
  const eligible = decisions.filter((item) => item.action !== "PASS");
  const top = eligible[0] || decisions[0] || null;
  if (top && top.action !== "PASS" && !top.advise.reason_codes.includes("BEST_AVAILABLE_MATCH")) {
    top.advise.reason_codes = ["BEST_AVAILABLE_MATCH", ...top.advise.reason_codes].slice(0, 6);
    top.advise.reasons = [REASON_TEXT.BEST_AVAILABLE_MATCH, ...top.advise.reasons].slice(0, 6);
  }
  return {
    engine: "LOKIN_SEAL",
    engine_version: SEAL_ENGINE_VERSION,
    policy_version: SEAL_POLICY_VERSION,
    generated_at: new Date().toISOString(),
    counts: {
      sensed: decisions.length,
      take: decisions.filter((item) => item.action === "TAKE").length,
      consider: decisions.filter((item) => item.action === "CONSIDER").length,
      pass: decisions.filter((item) => item.action === "PASS").length,
    },
    top_decision: top,
    automatic_platform_action: false,
    driver_confirmation_required: true,
  };
}
