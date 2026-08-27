import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { secrets } from "base44:runtime";
import { recordMeasuredOutcome } from "../../shared/outcomeLearning.js";
import {
  getValidUberAccessToken,
  UBER_API_BASE,
  UBER_PROVIDER_KEY,
} from "../../shared/uberDriverOAuth.ts";

const PAGE_SIZE = 50;
const MAX_RECORDS = 250;

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max);
}

function number(value: unknown, fallback = 0) {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function isoFromUnixSeconds(value: unknown) {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : null;
}

function localDayPart(iso: string) {
  const hour = new Date(iso).getHours();
  if (hour < 10) return "morning";
  if (hour < 14) return "lunch";
  if (hour < 17) return "afternoon";
  if (hour < 22) return "dinner";
  return "late_night";
}

function slug(value: unknown) {
  return clean(value, 100).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "unknown_market";
}

function pickupWaitMinutes(trip: any) {
  const changes = Array.isArray(trip?.status_changes) ? trip.status_changes : [];
  const arrived = changes.find((row: any) => row?.status === "driver_arrived")?.timestamp;
  const began = changes.find((row: any) => row?.status === "trip_began")?.timestamp ?? trip?.pickup?.timestamp;
  if (!Number.isFinite(Number(arrived)) || !Number.isFinite(Number(began))) return null;
  return Math.max(0, (Number(began) - Number(arrived)) / 60);
}

async function uberGet(path: string, token: string, params: Record<string, string | number> = {}) {
  const url = new URL(`${UBER_API_BASE}${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error: any = new Error(data?.message || data?.error || `Uber API request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function fetchCollection(path: string, key: string, token: string, fromTime: number, toTime: number) {
  const records: any[] = [];
  let offset = 0;
  let reportedCount = Infinity;
  while (records.length < Math.min(MAX_RECORDS, reportedCount)) {
    const data = await uberGet(path, token, { limit: PAGE_SIZE, offset, from_time: fromTime, to_time: toTime });
    const page = Array.isArray(data?.[key]) ? data[key] : [];
    reportedCount = Math.max(0, number(data?.count, page.length));
    records.push(...page.slice(0, Math.max(0, MAX_RECORDS - records.length)));
    if (page.length < PAGE_SIZE || records.length >= reportedCount || records.length >= MAX_RECORDS) break;
    offset += page.length;
  }
  return records;
}

async function upsertActivity(base44: any, userId: string, values: any) {
  const existing = await base44.asServiceRole.entities.DriverPlatformActivity.filter({
    user_id: userId,
    provider: UBER_PROVIDER_KEY,
    record_type: values.record_type,
    external_id: values.external_id,
  });
  if (existing?.[0]) {
    return await base44.asServiceRole.entities.DriverPlatformActivity.update(existing[0].id, values);
  }
  return await base44.asServiceRole.entities.DriverPlatformActivity.create(values);
}

async function upsertDailyEarnings(base44: any, payments: any[], trips: any[]) {
  const byDay = new Map<string, any>();
  for (const payment of payments) {
    const iso = isoFromUnixSeconds(payment?.event_time);
    if (!iso) continue;
    const date = iso.slice(0, 10);
    const row = byDay.get(date) || { amount: 0, base_pay: 0, bonuses: 0, adjustments: 0, trips: 0, miles: 0 };
    const amount = number(payment?.amount);
    row.amount += amount;
    if (payment?.category === "fare") row.base_pay += amount;
    else if (payment?.category === "promotion") row.bonuses += amount;
    else row.adjustments += amount;
    byDay.set(date, row);
  }
  for (const trip of trips) {
    if (trip?.status !== "completed") continue;
    const iso = isoFromUnixSeconds(trip?.dropoff?.timestamp || trip?.pickup?.timestamp);
    if (!iso) continue;
    const date = iso.slice(0, 10);
    const row = byDay.get(date) || { amount: 0, base_pay: 0, bonuses: 0, adjustments: 0, trips: 0, miles: 0 };
    row.trips += 1;
    row.miles += Math.max(0, number(trip?.distance));
    byDay.set(date, row);
  }

  let updated = 0;
  for (const [date, row] of byDay.entries()) {
    const existing = await base44.entities.Earning.filter({ date, platform: "uber_driver_api" });
    const values = {
      date,
      amount: Number(row.amount.toFixed(2)),
      base_pay: Number(row.base_pay.toFixed(2)),
      tips: 0,
      bonuses: Number(row.bonuses.toFixed(2)),
      adjustments: Number(row.adjustments.toFixed(2)),
      trips: row.trips,
      miles: Number(row.miles.toFixed(2)),
      platform: "uber_driver_api",
    };
    if (existing?.[0]) await base44.entities.Earning.update(existing[0].id, values);
    else await base44.entities.Earning.create(values);
    updated += 1;
  }
  return updated;
}

export default async function uberDriverSync(req: Request) {
  const base44 = createClientFromRequest(req);
  let user: any = null;
  try {
    user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const days = Math.min(90, Math.max(1, Math.round(number(body?.days, 30))));
    const toTime = Math.floor(Date.now() / 1000);
    const fromTime = toTime - days * 24 * 60 * 60;
    const userId = String(user.id);

    const [{ accessToken }, preferenceRows] = await Promise.all([
      getValidUberAccessToken(base44, userId, secrets),
      base44.entities.DriverPreference.filter({}),
    ]);
    const preferences = preferenceRows?.[0] || {};

    const [profile, trips, payments] = await Promise.all([
      uberGet("/partners/me", accessToken),
      fetchCollection("/partners/trips", "trips", accessToken, fromTime, toTime),
      fetchCollection("/partners/payments", "payments", accessToken, fromTime, toTime),
    ]);
    const syncedAt = new Date().toISOString();

    if (profile?.driver_id) {
      await upsertActivity(base44, userId, {
        user_id: userId,
        provider: UBER_PROVIDER_KEY,
        record_type: "profile",
        external_id: clean(profile.driver_id, 500),
        status: clean(profile.activation_status, 80),
        occurred_at: syncedAt,
        synced_at: syncedAt,
        metadata_json: JSON.stringify({
          rating: Number.isFinite(Number(profile.rating)) ? Number(profile.rating) : null,
          activation_status: clean(profile.activation_status, 80),
          source: "uber_driver_api",
          pii_excluded: true,
        }),
      });
    }

    const paymentByTrip = new Map<string, any[]>();
    for (const payment of payments) {
      const externalId = clean(payment?.payment_id, 300);
      if (!externalId) continue;
      const tripId = clean(payment?.trip_id, 300);
      await upsertActivity(base44, userId, {
        user_id: userId,
        provider: UBER_PROVIDER_KEY,
        record_type: "payment",
        external_id: externalId,
        trip_id: tripId,
        category: clean(payment?.category, 80),
        amount: number(payment?.amount),
        currency_code: clean(payment?.currency_code, 20),
        occurred_at: isoFromUnixSeconds(payment?.event_time) || syncedAt,
        synced_at: syncedAt,
        metadata_json: JSON.stringify({
          breakdown: payment?.breakdown || {},
          rider_fees: payment?.rider_fees || {},
          source: "uber_driver_api",
        }),
      });
      if (tripId) paymentByTrip.set(tripId, [...(paymentByTrip.get(tripId) || []), payment]);
    }

    let learned = 0;
    let duplicates = 0;
    let completedTrips = 0;
    for (const trip of trips) {
      const tripId = clean(trip?.trip_id, 300);
      if (!tripId) continue;
      const occurredAt = isoFromUnixSeconds(trip?.dropoff?.timestamp || trip?.pickup?.timestamp) || syncedAt;
      const waitMinutes = pickupWaitMinutes(trip);
      const activity = await upsertActivity(base44, userId, {
        user_id: userId,
        provider: UBER_PROVIDER_KEY,
        record_type: "trip",
        external_id: tripId,
        trip_id: tripId,
        fare: Math.max(0, number(trip?.fare)),
        distance_miles: Math.max(0, number(trip?.distance)),
        duration_seconds: Math.max(0, number(trip?.duration)),
        wait_minutes: waitMinutes == null ? undefined : Number(waitMinutes.toFixed(2)),
        status: clean(trip?.status, 80),
        city_name: clean(trip?.start_city?.display_name, 160),
        currency_code: clean(trip?.currency_code, 20),
        occurred_at: occurredAt,
        synced_at: syncedAt,
        metadata_json: JSON.stringify({
          surge_multiplier: number(trip?.surge_multiplier, 1),
          source: "uber_driver_api",
          status_changes: Array.isArray(trip?.status_changes) ? trip.status_changes : [],
        }),
      });

      if (trip?.status !== "completed") continue;
      completedTrips += 1;
      const linkedPayments = paymentByTrip.get(tripId) || [];
      const linkedPayout = linkedPayments.reduce((sum, row) => sum + number(row?.amount), 0);
      const payout = linkedPayments.length ? linkedPayout : Math.max(0, number(trip?.fare));
      const miles = Math.max(0, number(trip?.distance));
      const minutes = Math.max(0, number(trip?.duration) / 60);
      const mileageCost = Math.max(0, number(preferences?.mileage_cost, 0.67));
      const estimatedOperatingCost = miles * mileageCost;
      const estimatedNet = payout - estimatedOperatingCost;
      const netPerHour = minutes > 0 ? Math.max(0, estimatedNet) / (minutes / 60) : 0;
      const dollarsPerMile = miles > 0 ? payout / miles : 0;
      const city = clean(trip?.start_city?.display_name, 160) || "unknown market";
      const strategyKey = `uber_driver:${slug(city)}:${localDayPart(occurredAt)}`;
      const result = await recordMeasuredOutcome(base44, userId, {
        outcome_type: "delivery",
        strategy_key: strategyKey,
        platform: "uber_driver",
        gross_earnings: payout,
        tips: 0,
        miles,
        duration_minutes: minutes,
        net_per_hour: netPerHour,
        dollars_per_mile: dollarsPerMile,
        occurred_at: occurredAt,
        source_provider: UBER_PROVIDER_KEY,
        source_external_id: tripId,
        source_sync_key: `${UBER_PROVIDER_KEY}:trip:${tripId}`,
        metadata: {
          source: "uber_driver_api",
          payout_source: linkedPayments.length ? "linked_payments" : "trip_fare_fallback",
          payment_records: linkedPayments.length,
          estimated_operating_cost: Number(estimatedOperatingCost.toFixed(2)),
          estimated_net: Number(estimatedNet.toFixed(2)),
          wait_minutes: waitMinutes,
          city,
          currency_code: clean(trip?.currency_code, 20),
          trip_status: clean(trip?.status, 80),
          classification: "Uber Driver API does not by itself prove this trip was an Uber Eats delivery; LOKIN stores it as uber_driver activity.",
        },
      }, { preferences });
      if (result.duplicate) duplicates += 1;
      if (result.learned) learned += 1;
      await base44.asServiceRole.entities.DriverPlatformActivity.update(activity.id, { learned_at: syncedAt });
    }

    const earningDays = await upsertDailyEarnings(base44, payments, trips);
    const connectionRows = await base44.entities.DriverPlatformConnection.filter({ user_id: userId, platform_name: UBER_PROVIDER_KEY });
    const connection = connectionRows?.[0] || null;
    if (connection) {
      await base44.entities.DriverPlatformConnection.update(connection.id, {
        status: connection.approval_state === "approved" ? "connected" : "pending",
        authorization_state: "authorized",
        can_sync_profile: true,
        can_sync_trips: true,
        can_sync_payments: true,
        can_ingest_live_offers: false,
        can_ingest_partner_orders: false,
        external_account_ref: clean(profile?.driver_id, 500),
        last_sync_at: syncedAt,
        last_checked_at: syncedAt,
        last_error: "",
      });
    }

    return Response.json({
      ok: true,
      provider: UBER_PROVIDER_KEY,
      window_days: days,
      counts: {
        trips_received: trips.length,
        completed_trips: completedTrips,
        payments_received: payments.length,
        new_outcomes_learned: learned,
        duplicate_outcomes_skipped: duplicates,
        earning_days_updated: earningDays,
      },
      profile: profile?.driver_id ? {
        driver_id: clean(profile.driver_id, 500),
        rating: Number.isFinite(Number(profile.rating)) ? Number(profile.rating) : null,
        activation_status: clean(profile.activation_status, 80),
      } : null,
      learning: {
        engine_version: 3,
        source: "uber_driver_api",
        idempotent: true,
        earnings_net_hour_uses_mileage_cost: true,
      },
      safety: {
        automatic_platform_action: false,
        live_offer_access: false,
        driver_confirmation_required: true,
      },
      synced_at: syncedAt,
    });
  } catch (error: any) {
    console.error("uber-driver-sync error", error);
    if (user?.id) {
      try {
        const rows = await base44.entities.DriverPlatformConnection.filter({ user_id: String(user.id), platform_name: UBER_PROVIDER_KEY });
        if (rows?.[0]) {
          await base44.entities.DriverPlatformConnection.update(rows[0].id, {
            status: Number(error?.status) === 401 ? "expired" : "error",
            authorization_state: Number(error?.status) === 401 ? "expired" : rows[0].authorization_state,
            last_checked_at: new Date().toISOString(),
            last_error: clean(error?.message || "Uber sync failed", 500),
          });
        }
      } catch (updateError) {
        console.error("uber-driver-sync status update failed", updateError);
      }
    }
    return Response.json({ error: error?.message || "Uber Driver sync failed", code: "UBER_DRIVER_SYNC_FAILED" }, { status: Number(error?.status) === 401 ? 401 : 500 });
  }
}
