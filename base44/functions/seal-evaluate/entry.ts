import { createClientFromRequest } from "npm:@base44/sdk";
import {
  buildSealSummary,
  evaluateOffersWithSeal,
  SEAL_ENGINE_VERSION,
} from "../../shared/seal.js";

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

function decisionKey(userId: string, decision: any) {
  const capturedAt = decision?.sense?.captured_at || "unknown";
  return ["seal", SEAL_ENGINE_VERSION, userId, decision.subject_id, capturedAt].join(":").slice(0, 480);
}

export default async function sealEvaluate(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return json({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);

    const body = await req.json().catch(() => ({}));
    const ids = new Set(
      Array.isArray(body?.offer_ids)
        ? body.offer_ids.slice(0, 30).map((value: unknown) => String(value))
        : [],
    );
    const persist = body?.persist !== false;

    const [allOffers, preferenceRows, blocked, avoidPlaces] = await Promise.all([
      base44.entities.Offer.filter({ status: "available" }),
      base44.entities.DriverPreference.filter({}),
      base44.entities.BlockedCustomer.filter({}),
      base44.entities.AvoidPlace.filter({}),
    ]);

    const preferences = preferenceRows[0] || {
      accepted_categories: ["food_pickup", "grocery_shop_deliver", "grocery_pickup", "retail", "package"],
      min_payout: 6,
      max_miles: 12,
      min_per_hour: 22,
      vehicle_mpg: 26,
      gas_price: 3.45,
      mileage_cost: 0.67,
    };
    const offers = ids.size ? allOffers.filter((offer: any) => ids.has(String(offer.id))) : allOffers.slice(0, 30);
    if (!offers.length) return json({ error: "No current offers to evaluate", code: "NO_OFFERS" }, 400);

    const decisions = evaluateOffersWithSeal(offers, preferences, {
      blocked,
      avoidPlaces,
      mode: String(body?.mode || preferences.optimization_mode || "most_profit"),
      now: new Date(),
    });

    const persisted: Record<string, string> = {};
    if (persist) {
      for (const decision of decisions) {
        const key = decisionKey(String(user.id), decision);
        const existing = await base44.asServiceRole.entities.SealDecision.filter({ decision_key: key });
        let row = existing[0];
        if (!row) {
          row = await base44.asServiceRole.entities.SealDecision.create({
            user_id: String(user.id),
            decision_key: key,
            subject_type: decision.subject_type,
            subject_id: decision.subject_id,
            action: decision.action,
            score: decision.score,
            confidence: decision.confidence,
            confidence_score: decision.confidence_score,
            projected_gross: decision.economics.projected_gross,
            projected_net: decision.economics.projected_net,
            projected_net_per_hour: decision.economics.projected_net_per_hour,
            projected_net_per_mile: decision.economics.projected_net_per_mile,
            reason_codes: decision.advise.reason_codes,
            uncertainty_codes: decision.advise.uncertainty_codes,
            sense_snapshot: decision.sense,
            evaluation_snapshot: decision.evaluate,
            engine_version: decision.engine_version,
            policy_version: decision.policy_version,
            driver_confirmation_required: true,
            created_at_external: new Date().toISOString(),
            expires_at: decision.sense.expires_at || null,
          });
        }
        persisted[decision.subject_id] = String(row.id);
      }
    }

    return json({
      ok: true,
      seal: buildSealSummary(decisions),
      decisions: decisions.map((decision: any) => ({
        ...decision,
        decision_id: persisted[decision.subject_id] || null,
      })),
      disclosure: "SEAL advises only. It does not accept or decline third-party platform offers.",
    });
  } catch (error) {
    console.error("seal-evaluate error", error);
    return json({
      error: error instanceof Error ? error.message : "SEAL evaluation failed",
      code: "SEAL_EVALUATION_FAILED",
    }, 500);
  }
}
