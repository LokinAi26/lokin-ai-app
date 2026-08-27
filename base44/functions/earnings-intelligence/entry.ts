import { createClientFromRequest } from "npm:@base44/sdk";
import { evaluateOffersWithSeal } from "../../shared/seal.js";
import {
  buildEarningsMission,
  EARNINGS_INTELLIGENCE_VERSION,
  EARNINGS_POLICY_VERSION,
  rankEarningsOffers,
} from "../../shared/earningsIntelligence.js";

const TRUSTED_SOURCES = new Set(["user_entered", "user_shared", "official_api", "merchant_feed"]);
const TRUSTED_VERIFICATION = new Set(["address_verified", "platform_verified"]);

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

function isCurrentTrustedOffer(offer: any, nowMs = Date.now()) {
  if (offer?.status && offer.status !== "available") return false;
  if (!TRUSTED_SOURCES.has(String(offer?.source_type || ""))) return false;
  if (!TRUSTED_VERIFICATION.has(String(offer?.verification_status || ""))) return false;
  const capturedAt = Date.parse(String(offer?.captured_at || ""));
  const expiresAt = Date.parse(String(offer?.expires_at || ""));
  if (!Number.isFinite(capturedAt) || !Number.isFinite(expiresAt)) return false;
  if (capturedAt > nowMs + 5 * 60_000) return false;
  return expiresAt > nowMs;
}

function decisionKey(userId: string, decision: any) {
  return [
    "earnings",
    EARNINGS_INTELLIGENCE_VERSION,
    userId,
    decision?.offer_id || "unknown",
    decision?.source?.expires_at || "no-expiry",
  ].join(":").slice(0, 480);
}

export default async function earningsIntelligence(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return json({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);

    const body = await req.json().catch(() => ({}));
    const persist = body?.persist !== false;
    const now = new Date();

    const [allOffers, preferenceRows, earnings, blocked, avoidPlaces] = await Promise.all([
      base44.entities.Offer.filter({ status: "available" }),
      base44.entities.DriverPreference.filter({}),
      base44.entities.Earning.filter({}),
      base44.entities.BlockedCustomer.filter({}),
      base44.entities.AvoidPlace.filter({}),
    ]);

    const preferences = preferenceRows[0] || {
      accepted_categories: ["food_pickup", "grocery_shop_deliver", "grocery_pickup", "retail", "package"],
      min_payout: 6,
      max_miles: 12,
      min_per_hour: 22,
      target_per_mile: 1.5,
      vehicle_mpg: 26,
      gas_price: 3.45,
      mileage_cost: 0.67,
      daily_goal: 150,
      max_wait_minutes: 15,
    };

    const today = now.toISOString().slice(0, 10);
    const todayEarnings = earnings
      .filter((row: any) => row.date === today)
      .reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0);

    if (preferences.earnings_intelligence_enabled === false) {
      return json({
        ok: true,
        disabled: true,
        engine: "LOKIN_EARNINGS_INTELLIGENCE",
        engine_version: EARNINGS_INTELLIGENCE_VERSION,
        policy_version: EARNINGS_POLICY_VERSION,
        generated_at: now.toISOString(),
        mission: {
          goal: Number(preferences.daily_goal || 150),
          earned: Number(todayEarnings.toFixed(2)),
          remaining: Number(Math.max(0, Number(preferences.daily_goal || 150) - todayEarnings).toFixed(2)),
          goal_progress_pct: Math.min(100, Math.round((todayEarnings / Math.max(1, Number(preferences.daily_goal || 150))) * 100)),
          current_earnings_velocity: 0,
          projected_minutes_to_goal: null,
          top_decision: null,
          next_action: "Earnings Intelligence is turned off in Settings.",
          driver_confirmation_required: true,
          automatic_platform_action: false,
        },
        decisions: [],
        safety: {
          driver_confirmation_required: true,
          automatic_platform_action: false,
          gps_spoofing: false,
          platform_scraping: false,
          acceptance_bypass: false,
        },
        disclosure: "Earnings Intelligence is disabled by the driver.",
      });
    }

    const currentOffers = allOffers.filter((offer: any) => isCurrentTrustedOffer(offer, now.getTime())).slice(0, 40);
    const sealDecisions = evaluateOffersWithSeal(currentOffers, preferences, {
      blocked,
      avoidPlaces,
      mode: String(body?.mode || preferences.optimization_mode || "most_profit"),
      now,
    });
    const decisions = rankEarningsOffers(currentOffers, preferences, sealDecisions, { now });
    const mission = buildEarningsMission(decisions, todayEarnings, preferences);

    if (persist && decisions.length) {
      for (const decision of decisions.slice(0, 10)) {
        const key = decisionKey(String(user.id), decision);
        const existing = await base44.asServiceRole.entities.EarningsDecision.filter({ decision_key: key });
        if (existing[0]) continue;
        await base44.asServiceRole.entities.EarningsDecision.create({
          user_id: String(user.id),
          decision_key: key,
          offer_id: decision.offer_id,
          merchant: decision.merchant,
          platform: decision.platform,
          action: decision.action,
          score: decision.score,
          confidence_score: decision.confidence,
          projected_net: decision.economics.projected_net,
          projected_net_per_hour: decision.economics.projected_net_per_hour,
          projected_net_per_mile: decision.economics.projected_net_per_mile,
          earnings_velocity: decision.velocity.earnings_velocity,
          destination_score: decision.destination.score,
          sequence_score: decision.sequence.score,
          friction_score: decision.friction.score,
          goal_remaining: mission.remaining,
          projected_minutes_to_goal: mission.projected_minutes_to_goal,
          explanation: decision.explain.reasons.join(" "),
          decision_snapshot: decision,
          engine_version: EARNINGS_INTELLIGENCE_VERSION,
          policy_version: EARNINGS_POLICY_VERSION,
          driver_confirmation_required: true,
          automatic_platform_action: false,
          created_at_external: now.toISOString(),
          expires_at: decision.source.expires_at || null,
        });
      }
    }

    return json({
      ok: true,
      engine: "LOKIN_EARNINGS_INTELLIGENCE",
      engine_version: EARNINGS_INTELLIGENCE_VERSION,
      policy_version: EARNINGS_POLICY_VERSION,
      generated_at: now.toISOString(),
      mission,
      decisions,
      source: {
        active_verified_offers: currentOffers.length,
        excluded_untrusted_or_expired: Math.max(0, allOffers.length - currentOffers.length),
        market: preferences.region || "Virginia-first",
        provenance: "Only authenticated user-entered/shared offers, authorized official APIs, and merchant feeds with accepted verification are evaluated.",
      },
      safety: {
        driver_confirmation_required: true,
        automatic_platform_action: false,
        gps_spoofing: false,
        platform_scraping: false,
        acceptance_bypass: false,
      },
      disclosure: "LOKIN advises and prioritizes verified opportunities. It does not automatically accept, decline, intercept, spoof, or manipulate third-party platform offers.",
    });
  } catch (error) {
    console.error("earnings-intelligence error", error);
    return json({
      error: error instanceof Error ? error.message : "Earnings Intelligence failed",
      code: "EARNINGS_INTELLIGENCE_FAILED",
    }, 500);
  }
}
