export const OFFER_NORMALIZER_VERSION = 'LOKIN_NORMALIZED_OFFER_V1';
export const OPERATOR_TYPES = Object.freeze(['HUMAN','HUMAN_ASSISTED','REMOTE','AUTONOMOUS']);

const text = (value, max = 320) => String(value ?? '').trim().slice(0, max);
const finiteOrNull = (value) => value === '' || value == null || !Number.isFinite(Number(value)) ? null : Number(value);
const round = (value, places = 2) => value == null ? null : Math.round(Number(value) * (10 ** places)) / (10 ** places);
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value)));

function sourceConfidence(offer) {
  if (offer?.verification_status === 'platform_verified') return 0.95;
  if (offer?.verification_status === 'address_verified') return 0.72;
  if (offer?.source_type === 'merchant_feed' || offer?.source_type === 'official_api') return 0.85;
  if (offer?.source_type === 'user_shared') return 0.55;
  return 0.48;
}

export function pruneNulls(value) {
  if (Array.isArray(value)) return value.map(pruneNulls).filter((item) => item !== null && item !== undefined);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== null && item !== undefined).map(([key, item]) => [key, pruneNulls(item)]));
  }
  return value;
}

export function normalizeOffer(offer = {}, context = {}) {
  const payout = finiteOrNull(offer.payout);
  const tip = finiteOrNull(offer.tip);
  const miles = finiteOrNull(offer.miles);
  const deadheadMiles = finiteOrNull(context.deadhead_miles);
  const estMinutes = finiteOrNull(offer.est_minutes);
  const operatingCostPerMile = finiteOrNull(context.operating_cost_per_mile);
  const currentTotal = finiteOrNull(context.current_earnings);
  const dailyGoal = finiteOrNull(context.daily_goal);

  const totalMiles = miles == null ? null : Math.max(0, miles) + Math.max(0, deadheadMiles || 0);
  const gross = payout == null ? null : Math.max(0, payout) + Math.max(0, tip || 0);
  const estimatedExpenses = totalMiles != null && operatingCostPerMile != null
    ? Math.max(0, totalMiles) * Math.max(0, operatingCostPerMile)
    : null;
  const expectedNet = gross != null && estimatedExpenses != null ? gross - estimatedExpenses : null;
  const expectedNetPerHour = expectedNet != null && estMinutes != null && estMinutes > 0 ? expectedNet / (estMinutes / 60) : null;
  const grossPerMile = gross != null && totalMiles != null && totalMiles > 0 ? gross / totalMiles : null;
  const goalContribution = dailyGoal != null && dailyGoal > 0 && gross != null
    ? clamp(gross / Math.max(0.01, dailyGoal - Math.max(0, currentTotal || 0)), 0, 1)
    : null;

  const operator = OPERATOR_TYPES.includes(String(context.operator_type || '').toUpperCase())
    ? String(context.operator_type).toUpperCase()
    : 'HUMAN';
  const routeCompatibility = finiteOrNull(context.route_compatibility);
  const itemCount = finiteOrNull(offer.items_count);
  const itemComplexity = itemCount == null ? null : itemCount <= 3 ? 'LOW' : itemCount <= 20 ? 'MEDIUM' : 'HIGH';

  const completenessSignals = [payout, miles, estMinutes, offer.pickup_address, offer.dropoff_address, offer.platform].filter((v) => v !== null && v !== undefined && String(v).trim() !== '').length;
  const confidence = clamp(sourceConfidence(offer) * 0.7 + (completenessSignals / 6) * 0.3, 0, 1);

  return {
    source_offer_id: text(offer.id, 180) || null,
    owner_user_id: text(offer.owner_user_id || context.owner_user_id, 180) || null,
    provider: text(offer.platform, 60) || 'other',
    provider_offer_id: text(offer.provider_event_id || offer.capture_id || offer.source_reference, 240) || null,
    service_type: text(offer.category, 80) || null,
    merchant: text(offer.merchant, 180) || null,
    pickup_address: text(offer.pickup_address, 400) || null,
    dropoff_address: text(offer.dropoff_address, 400) || null,
    cargo_or_passenger_type: text(context.cargo_or_passenger_type, 80) || 'CARGO',
    vehicle_requirement: text(context.vehicle_requirement, 100) || null,
    operator_type: operator,
    route: {
      offer_miles: round(miles, 2),
      deadhead_miles: round(deadheadMiles, 2),
      total_miles: round(totalMiles, 2),
      estimated_minutes: round(estMinutes, 1),
      route_compatibility: routeCompatibility == null ? null : clamp(routeCompatibility, 0, 1),
    },
    economics: {
      gross: round(gross, 2),
      estimated_expenses: round(estimatedExpenses, 2),
      expected_net: round(expectedNet, 2),
      expected_net_per_hour: round(expectedNetPerHour, 2),
      gross_per_mile: round(grossPerMile, 2),
      goal_contribution: goalContribution == null ? null : round(goalContribution, 4),
    },
    item_complexity: itemComplexity,
    confidence: round(confidence, 4),
    provenance: {
      source_type: text(offer.source_type, 60) || null,
      verification_status: text(offer.verification_status, 60) || 'unverified',
      source_reference: text(offer.source_reference, 240) || null,
      disclosure: text(offer.source_disclosure, 1000) || null,
    },
    observed_at: text(offer.captured_at || offer.source_received_at, 80) || null,
    expires_at: text(offer.expires_at, 80) || null,
    version: OFFER_NORMALIZER_VERSION,
  };
}
