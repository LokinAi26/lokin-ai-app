// LOKIN SEAL decision engine — deterministic, explainable, and credit-free.
const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const round = (value, digits = 1) => {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
};

function freshnessScore(opportunity, nowMs = Date.now()) {
  const verifiedMs = new Date(opportunity?.verified_at || 0).getTime();
  const expiresMs = new Date(opportunity?.expires_at || 0).getTime();
  if (!Number.isFinite(verifiedMs) || opportunity?.live_status !== "live") return 0;
  if (Number.isFinite(expiresMs) && expiresMs > 0 && nowMs > expiresMs) return 0;
  const ageHours = Math.max(0, (nowMs - verifiedMs) / 3_600_000);
  return clamp(100 - (ageHours / 6) * 100);
}

function vehicleFit(opportunity, preferences) {
  const required = opportunity?.role_type || "any";
  const available = preferences?.vehicle_type || (preferences?.user_type === "trucker" ? "box_truck" : "personal_car");
  return required === "any" || required === available ? 100 : 0;
}

export function calculateSealDecision(opportunity, preferences = {}, nowMs = Date.now()) {
  const hours = Number(opportunity?.est_weekly_hours) > 0 ? Number(opportunity.est_weekly_hours) : 30;
  const miles = Number(opportunity?.est_weekly_miles) > 0 ? Number(opportunity.est_weekly_miles) : 250;
  const payRate = Number(opportunity?.pay_amount) || 0;
  const mileageCost = Number(preferences?.mileage_cost) > 0 ? Number(preferences.mileage_cost) : 0.67;
  const grossWeekly = payRate * hours;
  const vehicleCostWeekly = miles * mileageCost;
  const netWeekly = grossWeekly - vehicleCostWeekly;
  const netPerHour = hours > 0 ? netWeekly / hours : 0;
  const milesPerShift = miles / Math.max(1, hours / 8);

  const minPerHour = Number(preferences?.min_per_hour) > 0 ? Number(preferences.min_per_hour) : 22;
  const weeklyGoal = Number(preferences?.weekly_goal) > 0 ? Number(preferences.weekly_goal) : 850;
  const maxMiles = Number(preferences?.max_miles) > 0 ? Number(preferences.max_miles) : 12;

  const economics = clamp((netPerHour / minPerHour) * 100);
  const goalFit = clamp((netWeekly / weeklyGoal) * 100);
  const mileageFit = milesPerShift <= maxMiles ? 100 : clamp((maxMiles / milesPerShift) * 100);
  const vehicle = vehicleFit(opportunity, preferences);
  const freshness = freshnessScore(opportunity, nowMs);
  const sourceConfidence = opportunity?.source_url && opportunity?.apply_url
    ? (opportunity?.pay_source === "advertised" ? 100 : 75)
    : 0;

  const score = round(
    economics * 0.35 +
    goalFit * 0.20 +
    mileageFit * 0.15 +
    vehicle * 0.15 +
    freshness * 0.10 +
    sourceConfidence * 0.05
  );

  const blockers = [];
  if (freshness === 0) blockers.push("Opportunity is stale or unverified.");
  if (vehicle === 0) blockers.push("Vehicle requirement does not match your saved vehicle.");
  if (!opportunity?.apply_url || !opportunity?.source_url) blockers.push("A verified source or application link is missing.");
  if (payRate <= 0) blockers.push("Published pay is unavailable, so profitability confidence is limited.");

  const confidence = round(
    (freshness * 0.35) +
    (sourceConfidence * 0.35) +
    (payRate > 0 ? 20 : 0) +
    (Number(opportunity?.est_weekly_miles) > 0 ? 10 : 0)
  );

  const recommendation = blockers.some((item) => /stale|Vehicle requirement|source/i.test(item))
    ? "avoid"
    : score >= 80
      ? "strong_match"
      : score >= 65
        ? "consider"
        : "low_match";

  return {
    seal_version: "1.0.0",
    opportunity_id: opportunity?.id,
    score,
    confidence,
    recommendation,
    sense: {
      live_status: opportunity?.live_status || "unverified",
      verified_at: opportunity?.verified_at || null,
      pay_rate: round(payRate, 2),
      weekly_hours: round(hours, 1),
      weekly_miles: round(miles, 1),
      source_confidence: round(sourceConfidence),
    },
    evaluate: {
      estimated_gross_weekly: round(grossWeekly, 2),
      estimated_vehicle_cost_weekly: round(vehicleCostWeekly, 2),
      estimated_net_weekly: round(netWeekly, 2),
      estimated_net_per_hour: round(netPerHour, 2),
      estimated_miles_per_shift: round(milesPerShift, 1),
      factors: {
        economics: round(economics),
        weekly_goal_fit: round(goalFit),
        mileage_fit: round(mileageFit),
        vehicle_fit: round(vehicle),
        freshness: round(freshness),
      },
      blockers,
    },
    advise: {
      action: recommendation,
      requires_driver_authorization: true,
      explanation: blockers.length
        ? blockers.join(" ")
        : `Estimated $${round(netPerHour, 2)}/hr net and $${round(netWeekly, 2)}/week net against your saved goals.`,
    },
  };
}

export function rankSealOpportunities(opportunities, preferences = {}, nowMs = Date.now()) {
  return opportunities
    .map((opportunity) => ({ opportunity, decision: calculateSealDecision(opportunity, preferences, nowMs) }))
    .sort((a, b) => b.decision.score - a.decision.score || b.decision.confidence - a.decision.confidence);
}
