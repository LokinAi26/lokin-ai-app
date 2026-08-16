import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  filterAndRank,
  rankByMode,
  sequenceByZone,
  totalRouteStats,
  trueEarningRate,
  lockInScore,
  OPTIMIZATION_MODES,
} from "../../shared/delivery.js";

// LOKIN AI — Route Optimizer + Strategy Advisor
// Input: { originAddress?: string, mode?: string }
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const originAddress = body.originAddress || user.address || "";
    const mode = OPTIMIZATION_MODES.some((m) => m.value === body.mode) ? body.mode : "most_profit";

    const [allOffers, prefsList, blocked, avoidPlaces, earnings] = await Promise.all([
      base44.entities.Offer.filter({}),
      base44.entities.DriverPreference.filter({}),
      base44.entities.BlockedCustomer.filter({}),
      base44.entities.AvoidPlace.filter({}),
      base44.entities.Earning.filter({}),
    ]);

    const prefs = prefsList[0] || {
      accepted_categories: ["food_pickup", "grocery_shop_deliver", "grocery_pickup", "retail", "package"],
      min_payout: 6, max_miles: 12, min_per_hour: 22,
      vehicle_mpg: 26, gas_price: 3.45, mileage_cost: 0.67,
      daily_goal: 150, daily_hours_goal: 8,
      optimization_mode: mode,
    };

    const today = new Date().toISOString().slice(0, 10);
    const todays = earnings.filter((e) => e.date === today);
    const todayEarnings = todays.reduce((s, e) => s + (e.amount || 0), 0);
    const todayMiles = todays.reduce((s, e) => s + (e.miles || 0), 0);

    const eligible = filterAndRank(allOffers, prefs, blocked, avoidPlaces);
    const ranked = rankByMode(eligible, mode, originAddress);
    const sequenced = sequenceByZone(ranked, originAddress);
    const stats = totalRouteStats(sequenced, prefs, originAddress);

    const avgPerHour = sequenced.length
      ? sequenced.reduce((s, o) => s + o._score.netPerHour, 0) / sequenced.length
      : 0;

    const score = lockInScore({
      todayEarnings,
      dailyGoal: prefs.daily_goal || 150,
      netPerHour: stats.perHour,
      targetPerHour: prefs.min_per_hour || 22,
      hoursWorked: todays.reduce((s, e) => s + (e.trips || 0), 0) * 0.25,
      hoursGoal: prefs.daily_hours_goal || 8,
      miles: stats.miles || todayMiles,
      net: stats.net || todayEarnings,
      avgPerHour,
      routeEfficiency: stats.efficiency,
    });

    const declined = allOffers
      .filter((o) => !sequenced.find((s) => s.id === o.id))
      .map((o) => ({
        merchant: o.merchant,
        payout: o.payout,
        category: o.category,
        reason:
          (o.payout || 0) < (prefs.min_payout || 0)
            ? `Below $${prefs.min_payout} minimum`
            : (o.miles || 0) > (prefs.max_miles || 99)
              ? `Over ${prefs.max_miles} mile max`
              : "Below target net $/hr",
      }));

    const modeLabel = OPTIMIZATION_MODES.find((m) => m.value === mode)?.label || "Most Profit";

    // Route math is deterministic and intentionally AI-free. This keeps home,
    // active-delivery and background refreshes from spending an LLM/integration
    // call. A rich strategy briefing is generated only when the user explicitly
    // requests AI strategy/reasoning.
    const next = sequenced[0];
    const remaining = Math.max(0, (prefs.daily_goal || 150) - todayEarnings);
    const briefing = next
      ? `Next: ${next.merchant} · $${next._score.net.toFixed(2)} est. net · $${next._score.netPerHour.toFixed(2)}/hr. $${remaining.toFixed(2)} remains to today's goal.`
      : remaining > 0
        ? `No eligible offers right now. $${remaining.toFixed(2)} remains to today's goal.`
        : `Daily goal reached. Stay selective and protect your net $/hr.`;

    return Response.json({
      mode,
      sequenced: sequenced.map((o) => ({
        id: o.id,
        merchant: o.merchant,
        category: o.category,
        payout: o.payout,
        tip: o.tip,
        miles: o.miles,
        est_minutes: o.est_minutes,
        pickup_address: o.pickup_address,
        dropoff_address: o.dropoff_address,
        sequence: o.sequence,
        rate: o._score,
      })),
      stats,
      lockInScore: score,
      declinedCount: declined.length,
      todayEarnings,
      briefing,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}