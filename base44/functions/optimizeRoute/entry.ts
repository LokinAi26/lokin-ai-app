import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  filterAndRank,
  sequenceByZone,
  totalRouteStats,
  scoreOffer,
} from "../../shared/delivery.js";

// AI Strategy Advisor + Route Optimizer
// Input: { originAddress?: string }
// Pulls the driver's offers + prefs + blocklist, filters & ranks by $/hr,
// sequences by zip/address, then asks the LLM for a concrete strategy briefing.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const originAddress = body.originAddress || user.address || "";

    const [allOffers, prefsList, blocked] = await Promise.all([
      base44.entities.Offer.filter({}),
      base44.entities.DriverPreference.filter({}),
      base44.entities.BlockedCustomer.filter({}),
    ]);

    const prefs = prefsList[0] || {
      accepted_categories: ["food_pickup", "grocery_shop_deliver", "grocery_pickup", "retail", "package"],
      min_payout: 6,
      max_miles: 12,
      min_per_hour: 22,
      vehicle_mpg: 26,
      gas_price: 3.45,
    };

    const ranked = filterAndRank(allOffers, prefs, blocked);
    const sequenced = sequenceByZone(ranked, originAddress);
    const stats = totalRouteStats(sequenced, prefs);

    const declined = allOffers.filter(
      (o) => !sequenced.find((s) => s.id === o.id)
    ).map((o) => ({
      merchant: o.merchant,
      payout: o.payout,
      category: o.category,
      reason: (o.payout || 0) < (prefs.min_payout || 0)
        ? `Below $${prefs.min_payout} minimum`
        : (o.miles || 0) > (prefs.max_miles || 99)
          ? `Over ${prefs.max_miles} mile max`
          : "Below target $/hr",
    }));

    // Ask the LLM for a concrete day strategy
    const briefing = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: [
        `You are an AI delivery strategy advisor for a gig driver on DoorDash-style platforms.`,
        `The driver works from origin: "${originAddress || "unknown"}".`,
        `Vehicle MPG: ${prefs.vehicle_mpg}, local gas: $${prefs.gas_price}/gal.`,
        `Driver target: at least $${prefs.min_per_hour}/hr net.`,
        ``,
        `Optimized route (${stats.stops} stops, ${stats.miles} mi, ~${stats.hours}h, $${stats.net} net, $${stats.perHour}/hr):`,
        sequenced.map((o, i) =>
          `${i + 1}. ${o.merchant} -> ${o.dropoff_address} | $${o.payout + (o.tip||0)} | ${o.miles}mi | ${o.category}`
        ).join("\n"),
        ``,
        `Declined offers: ${declined.length}.`,
        `Blocked customers: ${blocked.length}.`,
        ``,
        `Write a tight, 5-bullet strategy briefing: which offers to accept in this exact order, which to skip and why,`,
        `how the zip-code sequencing cuts drive time, and a concrete earnings target for today. Plain text, no markdown.`,
      ].join("\n"),
    });

    return Response.json({
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
        score: o._score,
      })),
      stats,
      declinedCount: declined.length,
      briefing,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}