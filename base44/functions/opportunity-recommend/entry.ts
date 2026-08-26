// LOKIN SEAL — deterministic opportunity ranking.
// Sense → Evaluate → Advise/Act → Learn. Actions always require driver authorization.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const round = (value, digits = 1) => {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
};

function freshnessScore(opportunity, nowMs) {
  const verifiedMs = new Date(opportunity?.verified_at || 0).getTime();
  const expiresMs = new Date(opportunity?.expires_at || 0).getTime();
  if (!Number.isFinite(verifiedMs) || opportunity?.live_status !== "live") return 0;
  if (Number.isFinite(expiresMs) && expiresMs > 0 && nowMs > expiresMs) return 0;
  return clamp(100 - (Math.max(0, nowMs - verifiedMs) / 21_600_000) * 100);
}

function scoreOpportunity(opportunity, preferences, nowMs) {
  const hours = Number(opportunity?.est_weekly_hours) > 0 ? Number(opportunity.est_weekly_hours) : 30;
  const miles = Number(opportunity?.est_weekly_miles) > 0 ? Number(opportunity.est_weekly_miles) : 250;
  const payRate = Number(opportunity?.pay_amount) || 0;
  const mileageCost = Number(preferences?.mileage_cost) > 0 ? Number(preferences.mileage_cost) : 0.67;
  const minPerHour = Number(preferences?.min_per_hour) > 0 ? Number(preferences.min_per_hour) : 22;
  const weeklyGoal = Number(preferences?.weekly_goal) > 0 ? Number(preferences.weekly_goal) : 850;
  const maxMiles = Number(preferences?.max_miles) > 0 ? Number(preferences.max_miles) : 12;
  const driverVehicle = preferences?.vehicle_type || (preferences?.user_type === "trucker" ? "box_truck" : "personal_car");

  const grossWeekly = payRate * hours;
  const vehicleCostWeekly = miles * mileageCost;
  const netWeekly = grossWeekly - vehicleCostWeekly;
  const netPerHour = hours > 0 ? netWeekly / hours : 0;
  const milesPerShift = miles / Math.max(1, hours / 8);

  const factors = {
    economics: clamp((netPerHour / minPerHour) * 100),
    weekly_goal_fit: clamp((netWeekly / weeklyGoal) * 100),
    mileage_fit: milesPerShift <= maxMiles ? 100 : clamp((maxMiles / milesPerShift) * 100),
    vehicle_fit: opportunity?.role_type === "any" || opportunity?.role_type === driverVehicle ? 100 : 0,
    freshness: freshnessScore(opportunity, nowMs),
    source_confidence: opportunity?.source_url && opportunity?.apply_url
      ? (opportunity?.pay_source === "advertised" ? 100 : 75)
      : 0,
  };

  const score = round(
    factors.economics * 0.35 +
    factors.weekly_goal_fit * 0.20 +
    factors.mileage_fit * 0.15 +
    factors.vehicle_fit * 0.15 +
    factors.freshness * 0.10 +
    factors.source_confidence * 0.05
  );

  const blockers = [];
  if (factors.freshness === 0) blockers.push("Stale or unverified opportunity");
  if (factors.vehicle_fit === 0) blockers.push("Vehicle requirement mismatch");
  if (!opportunity?.source_url || !opportunity?.apply_url) blockers.push("Verified source or application link missing");
  if (payRate <= 0) blockers.push("Published pay unavailable");

  const confidence = round(
    factors.freshness * 0.35 +
    factors.source_confidence * 0.35 +
    (payRate > 0 ? 20 : 0) +
    (Number(opportunity?.est_weekly_miles) > 0 ? 10 : 0)
  );
  const hardBlocked = factors.freshness === 0 || factors.vehicle_fit === 0 || factors.source_confidence === 0;
  const action = hardBlocked ? "avoid" : score >= 80 ? "strong_match" : score >= 65 ? "consider" : "low_match";

  return {
    opportunity_id: opportunity.id,
    title: opportunity.title,
    company: opportunity.company || opportunity.platform || "",
    seal_version: "1.0.0",
    score,
    confidence,
    sense: {
      live_status: opportunity.live_status || "unverified",
      verified_at: opportunity.verified_at || null,
      pay_rate: round(payRate, 2),
      weekly_hours: round(hours, 1),
      weekly_miles: round(miles, 1),
    },
    evaluate: {
      estimated_gross_weekly: round(grossWeekly, 2),
      estimated_vehicle_cost_weekly: round(vehicleCostWeekly, 2),
      estimated_net_weekly: round(netWeekly, 2),
      estimated_net_per_hour: round(netPerHour, 2),
      estimated_miles_per_shift: round(milesPerShift, 1),
      factors: Object.fromEntries(Object.entries(factors).map(([key, value]) => [key, round(value)])),
      blockers,
    },
    advise: {
      action,
      requires_driver_authorization: true,
      explanation: blockers.length
        ? blockers.join(". ")
        : `Estimated $${round(netPerHour, 2)}/hr net and $${round(netWeekly, 2)}/week net against your saved goals.`,
    },
  };
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const ids = Array.isArray(body.opportunity_ids) ? body.opportunity_ids.filter(Boolean).slice(0, 20) : [];
    const suppliedGoals = body.goals && typeof body.goals === "object" ? body.goals : {};

    const storedPreferences = await base44.entities.DriverPreference.filter({}).catch(() => []);
    const preferences = { ...(storedPreferences[0] || {}), ...suppliedGoals };

    const all = await base44.entities.OpportunityScan.list("-verified_at", 250);
    const opportunities = ids.length ? all.filter((opportunity) => ids.includes(opportunity.id)) : all.slice(0, 12);
    if (!opportunities.length) {
      return Response.json({ error: "No opportunities to compare" }, { status: 400 });
    }

    const ranked = opportunities
      .map((opportunity) => scoreOpportunity(opportunity, preferences, Date.now()))
      .sort((a, b) => b.score - a.score || b.confidence - a.confidence);

    const top = ranked[0];
    return Response.json({
      ok: true,
      engine: "SEAL",
      seal_version: "1.0.0",
      top_match_id: top.opportunity_id,
      top_match_index: opportunities.findIndex((opportunity) => opportunity.id === top.opportunity_id) + 1,
      recommendation: `${top.title} is the highest-ranked option at ${top.score}/100 with ${top.confidence}% data confidence. ${top.advise.explanation}`,
      requires_driver_authorization: true,
      ranked,
      alternatives: ranked.slice(1, 4).map((item) => ({
        opportunity_id: item.opportunity_id,
        index: opportunities.findIndex((opportunity) => opportunity.id === item.opportunity_id) + 1,
        score: item.score,
        reason: `${item.title}: ${item.advise.action.replace("_", " ")} · ${item.score}/100`,
      })),
    });
  } catch (error) {
    console.error("opportunity-recommend error:", error);
    return Response.json({ error: error?.message || "SEAL recommendation failed" }, { status: 500 });
  }
}
