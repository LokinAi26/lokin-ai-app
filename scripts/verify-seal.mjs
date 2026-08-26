import assert from "node:assert/strict";
import { buildSealSummary, evaluateOfferWithSeal, evaluateOffersWithSeal } from "../base44/shared/seal.js";

const now = new Date("2026-08-26T02:00:00.000Z");
const preferences = {
  accepted_categories: ["food_pickup", "grocery_shop_deliver"],
  min_payout: 6,
  max_miles: 12,
  min_per_hour: 22,
  target_per_mile: 1.5,
  vehicle_mpg: 28,
  gas_price: 3.4,
  mileage_cost: 0.25,
};

function offer(overrides = {}) {
  return {
    id: "offer-1",
    merchant: "Verified Merchant",
    category: "food_pickup",
    payout: 24,
    tip: 0,
    miles: 7,
    est_minutes: 32,
    pickup_address: "100 Main St, Virginia Beach, VA 23451",
    dropoff_address: "200 Oceanfront Ave, Virginia Beach, VA 23451",
    state_code: "VA",
    region: "Virginia Beach, VA",
    source_type: "user_entered",
    verification_status: "address_verified",
    captured_at: "2026-08-26T01:55:00.000Z",
    expires_at: "2026-08-26T03:00:00.000Z",
    status: "available",
    ...overrides,
  };
}

const strong = evaluateOfferWithSeal(offer(), preferences, { now, blocked: [], avoidPlaces: [] });
assert.equal(strong.action, "TAKE");
assert.equal(strong.evaluate.hard_gate_passed, true);
assert.equal(strong.advise.requires_driver_confirmation, true);
assert.equal(strong.advise.automatic_platform_action, false);
assert.ok(strong.score >= 75);
assert.ok(strong.advise.uncertainty_codes.includes("USER_REPORTED_PAYOUT"));

const weak = evaluateOfferWithSeal(
  offer({ id: "offer-2", payout: 5, miles: 20, est_minutes: 75 }),
  preferences,
  { now, blocked: [], avoidPlaces: [] },
);
assert.equal(weak.action, "PASS");
assert.ok(weak.advise.reason_codes.includes("BELOW_MIN_PAYOUT"));
assert.ok(weak.advise.reason_codes.includes("OVER_MAX_MILES"));

const expired = evaluateOfferWithSeal(
  offer({ id: "offer-3", expires_at: "2026-08-26T01:59:00.000Z" }),
  preferences,
  { now, blocked: [], avoidPlaces: [] },
);
assert.equal(expired.action, "PASS");
assert.ok(expired.advise.reason_codes.includes("EXPIRED_OFFER"));

const blocked = evaluateOfferWithSeal(
  offer({ id: "offer-4", customer_name: "Blocked Rider" }),
  preferences,
  { now, blocked: [{ name: "Blocked Rider" }], avoidPlaces: [] },
);
assert.equal(blocked.action, "PASS");
assert.ok(blocked.advise.reason_codes.includes("BLOCKED_CUSTOMER"));

const decisions = evaluateOffersWithSeal(
  [offer(), offer({ id: "offer-2", payout: 5, miles: 20, est_minutes: 75 })],
  preferences,
  { now, blocked: [], avoidPlaces: [] },
);
const summary = buildSealSummary(decisions);
assert.equal(summary.engine, "LOKIN_SEAL");
assert.equal(summary.counts.take, 1);
assert.equal(summary.counts.pass, 1);
assert.equal(summary.top_decision.subject_id, "offer-1");
assert.equal(summary.driver_confirmation_required, true);
assert.equal(summary.automatic_platform_action, false);

console.log("LOKIN SEAL verification passed");
