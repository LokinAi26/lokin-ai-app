import { trueEarningRate, zipFromAddress } from "./delivery.js";

export const EARNINGS_INTELLIGENCE_VERSION = "earnings-velocity-1.0.0";
export const EARNINGS_POLICY_VERSION = "driver-earnings-policy-1.0.0";

const TRUSTED_SOURCES = new Set(["user_entered", "user_shared", "official_api", "merchant_feed"]);
const TRUSTED_VERIFICATION = new Set(["address_verified", "platform_verified"]);

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : min));
const round = (value, places = 2) => {
  const scale = 10 ** places;
  return Math.round((Number(value) || 0) * scale) / scale;
};

function isCurrentTrustedOffer(offer, nowMs = Date.now()) {
  if (offer?.status && offer.status !== "available") return false;
  if (!TRUSTED_SOURCES.has(String(offer?.source_type || ""))) return false;
  if (!TRUSTED_VERIFICATION.has(String(offer?.verification_status || ""))) return false;
  const capturedAt = Date.parse(String(offer?.captured_at || ""));
  const expiresAt = Date.parse(String(offer?.expires_at || ""));
  if (!Number.isFinite(capturedAt) || !Number.isFinite(expiresAt)) return false;
  if (capturedAt > nowMs + 5 * 60_000) return false;
  return expiresAt > nowMs;
}

function destinationCandidates(offer, allOffers, nowMs) {
  const dropZip = zipFromAddress(offer?.dropoff_address || "");
  if (!dropZip) return [];
  return (allOffers || [])
    .filter((candidate) => String(candidate?.id || candidate?.capture_id || "") !== String(offer?.id || offer?.capture_id || ""))
    .filter((candidate) => isCurrentTrustedOffer(candidate, nowMs))
    .filter((candidate) => zipFromAddress(candidate?.pickup_address || "") === dropZip);
}

function frictionScore(offer, preferences = {}) {
  const minutes = Math.max(1, Number(offer?.est_minutes || 0));
  const itemCount = Math.max(1, Number(offer?.items_count || 1));
  const maxWait = Math.max(5, Number(preferences?.max_wait_minutes || 15));
  const complexityPenalty = Math.max(0, itemCount - 8) * 1.5;
  const durationPenalty = Math.max(0, minutes - (maxWait + 25)) * 0.65;
  return clamp(100 - complexityPenalty - durationPenalty);
}

function confidenceScore(offer) {
  const source = String(offer?.source_type || "");
  const verification = String(offer?.verification_status || "");
  if (source === "official_api" && verification === "platform_verified") return 100;
  if (source === "merchant_feed" && TRUSTED_VERIFICATION.has(verification)) return 92;
  if (["user_entered", "user_shared"].includes(source) && verification === "address_verified") return 74;
  return 45;
}

function scoreDestination(offer, candidates, preferences = {}) {
  if (!candidates.length) return 35;
  const rates = candidates.map((candidate) => trueEarningRate(candidate, preferences));
  const best = Math.max(...rates.map((rate) => Number(rate.netPerHour || 0)), 0);
  const target = Math.max(1, Number(preferences?.min_per_hour || 22));
  const countScore = clamp(candidates.length * 22);
  const qualityScore = clamp((best / target) * 75);
  return clamp(countScore * 0.45 + qualityScore * 0.55);
}

function projectedVelocity(currentOffer, candidates, preferences = {}) {
  const current = trueEarningRate(currentOffer, preferences);
  const currentMinutes = Math.max(1, Number(current.minutes || currentOffer?.est_minutes || 1));
  const remainingMinutes = Math.max(0, 60 - currentMinutes);
  const rankedNext = candidates
    .map((candidate) => ({ offer: candidate, rate: trueEarningRate(candidate, preferences) }))
    .sort((a, b) => b.rate.netPerHour - a.rate.netPerHour || b.rate.net - a.rate.net);
  const next = rankedNext[0] || null;

  let projectedNet60 = Number(current.net || 0);
  if (currentMinutes > 60) projectedNet60 = (Number(current.net || 0) / currentMinutes) * 60;
  else if (next && remainingMinutes > 0) {
    const nextMinutes = Math.max(1, Number(next.rate.minutes || next.offer?.est_minutes || 1));
    projectedNet60 += Number(next.rate.net || 0) * Math.min(1, remainingMinutes / nextMinutes);
  }

  return {
    projected_net_next_60: round(projectedNet60),
    earnings_velocity: round(projectedNet60),
    next_offer_id: next ? String(next.offer?.id || next.offer?.capture_id || "") : null,
    next_offer_merchant: next?.offer?.merchant || null,
    next_offer_net_per_hour: next ? round(next.rate.netPerHour) : null,
  };
}

export function evaluateEarningsOffer(offer, allOffers = [], preferences = {}, sealDecision = null, context = {}) {
  const nowMs = context?.now instanceof Date ? context.now.getTime() : Number(context?.now || Date.now());
  const economics = trueEarningRate(offer, preferences);
  const netPerMile = Number(offer?.miles) > 0 ? Number(economics.net || 0) / Number(offer.miles) : 0;
  const targetHourly = Math.max(1, Number(preferences?.min_per_hour || 22));
  const targetPerMile = Math.max(0.5, Number(preferences?.target_per_mile || 1.5));
  const candidates = destinationCandidates(offer, allOffers, nowMs);
  const destination = scoreDestination(offer, candidates, preferences);
  const friction = frictionScore(offer, preferences);
  const confidence = confidenceScore(offer);
  const velocity = projectedVelocity(offer, candidates, preferences);
  const hourlyScore = clamp((Number(economics.netPerHour || 0) / targetHourly) * 78);
  const mileScore = clamp((netPerMile / targetPerMile) * 78);
  const sequenceScore = clamp(candidates.length * 28 + (velocity.next_offer_net_per_hour ? (velocity.next_offer_net_per_hour / targetHourly) * 35 : 0));

  const hardPass = !isCurrentTrustedOffer(offer, nowMs) || sealDecision?.action === "PASS";
  const score = Math.round(clamp(
    hourlyScore * 0.30 +
    mileScore * 0.20 +
    destination * 0.20 +
    sequenceScore * 0.15 +
    friction * 0.10 +
    confidence * 0.05
  ));

  let action = "CONSIDER";
  if (hardPass) action = "PASS";
  else if (score >= 78 && confidence >= 55) action = "TAKE";

  const reasons = [];
  if (Number(economics.netPerHour || 0) >= targetHourly * 1.15) reasons.push(`Projected net rate ${round(economics.netPerHour)}/hr beats your target.`);
  if (netPerMile >= targetPerMile * 1.1) reasons.push(`Projected ${round(netPerMile)}/mi net is efficient.`);
  if (destination >= 70) reasons.push("Drop-off lands near verified follow-on opportunity density.");
  if (candidates.length > 0) reasons.push(`${candidates.length} current verified follow-on offer${candidates.length === 1 ? "" : "s"} match the destination ZIP.`);
  if (friction < 60) reasons.push("Order duration or complexity reduces earnings velocity.");
  if (hardPass && sealDecision?.advise?.reasons?.[0]) reasons.push(sealDecision.advise.reasons[0]);
  if (!reasons.length) reasons.push("Offer is near your configured thresholds; driver judgment is recommended.");

  return {
    engine: "LOKIN_EARNINGS_INTELLIGENCE",
    engine_version: EARNINGS_INTELLIGENCE_VERSION,
    policy_version: EARNINGS_POLICY_VERSION,
    offer_id: String(offer?.id || offer?.capture_id || ""),
    merchant: offer?.merchant || "Merchant",
    platform: offer?.platform || "other",
    action,
    score,
    confidence,
    economics: {
      projected_gross: round(economics.gross),
      projected_net: round(economics.net),
      projected_net_per_hour: round(economics.netPerHour),
      projected_net_per_mile: round(netPerMile),
      projected_minutes: round(economics.minutes, 1),
      projected_miles: round(offer?.miles, 1),
      projected_expenses: round(economics.expenses),
    },
    velocity,
    destination: {
      score: Math.round(destination),
      follow_on_count: candidates.length,
      destination_zip: zipFromAddress(offer?.dropoff_address || "") || null,
    },
    sequence: {
      score: Math.round(sequenceScore),
      next_offer_id: velocity.next_offer_id,
      next_offer_merchant: velocity.next_offer_merchant,
    },
    friction: {
      score: Math.round(friction),
      items_count: Math.max(1, Number(offer?.items_count || 1)),
    },
    explain: {
      reasons: reasons.slice(0, 5),
      requires_driver_confirmation: true,
      automatic_platform_action: false,
    },
    source: {
      source_type: offer?.source_type || "unknown",
      verification_status: offer?.verification_status || "unverified",
      expires_at: offer?.expires_at || null,
    },
  };
}

export function rankEarningsOffers(offers = [], preferences = {}, sealDecisions = [], context = {}) {
  const sealByOffer = new Map((sealDecisions || []).map((decision) => [String(decision.subject_id), decision]));
  return (offers || [])
    .map((offer) => evaluateEarningsOffer(offer, offers, preferences, sealByOffer.get(String(offer?.id || offer?.capture_id || "")) || null, context))
    .sort((a, b) => {
      const actionRank = { TAKE: 0, CONSIDER: 1, PASS: 2 };
      return actionRank[a.action] - actionRank[b.action] || b.score - a.score || b.velocity.earnings_velocity - a.velocity.earnings_velocity;
    });
}

export function buildEarningsMission(decisions = [], todayEarnings = 0, preferences = {}) {
  const dailyGoal = Math.max(0, Number(preferences?.daily_goal || 150));
  const remaining = Math.max(0, dailyGoal - Number(todayEarnings || 0));
  const top = decisions.find((decision) => decision.action !== "PASS") || decisions[0] || null;
  const velocity = Math.max(0, Number(top?.velocity?.earnings_velocity || 0));
  const minutesToGoal = remaining <= 0 ? 0 : velocity > 0 ? Math.ceil((remaining / velocity) * 60) : null;

  return {
    goal: round(dailyGoal),
    earned: round(todayEarnings),
    remaining: round(remaining),
    goal_progress_pct: dailyGoal > 0 ? Math.min(100, Math.round((Number(todayEarnings || 0) / dailyGoal) * 100)) : 100,
    current_earnings_velocity: round(velocity),
    projected_minutes_to_goal: minutesToGoal,
    top_decision: top,
    next_action: top
      ? top.action === "TAKE"
        ? `Consider ${top.merchant}; it currently has the strongest verified earnings-velocity profile.`
        : top.action === "CONSIDER"
          ? `Review ${top.merchant}; it is the best current verified option but not a high-confidence TAKE.`
          : "No current verified offer clears your configured thresholds."
      : "Add or receive a current verified offer to begin earnings optimization.",
    driver_confirmation_required: true,
    automatic_platform_action: false,
  };
}
