import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

const ALLOWED_SOURCES = new Set(["official_api", "carrier_feed", "broker_feed"]);
const ALLOWED_EQUIPMENT = new Set(["dry_van", "reefer", "flatbed", "step_deck", "power_only", "box_truck", "cargo_van", "other"]);

function clean(value: unknown, max = 400): string {
  return String(value ?? "").trim().slice(0, max);
}

function number(value: unknown, min = 0, max = 1_000_000): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(min, Math.min(max, parsed));
}

function safeDate(value: unknown): string | undefined {
  const raw = clean(value, 80);
  if (!raw) return undefined;
  const ts = Date.parse(raw);
  return Number.isFinite(ts) ? new Date(ts).toISOString() : undefined;
}

function normalizeLoad(input: any) {
  const sourceType = clean(input?.source_type, 40);
  const captureId = clean(input?.capture_id, 160);
  const pickupAddress = clean(input?.pickup_address, 320);
  const dropoffAddress = clean(input?.dropoff_address, 320);
  const loadedMiles = number(input?.loaded_miles, 0, 10_000);
  const totalRate = number(input?.total_rate, 0, 1_000_000);
  if (!ALLOWED_SOURCES.has(sourceType)) throw new Error("source_type must be official_api, carrier_feed, or broker_feed");
  if (!captureId) throw new Error("capture_id is required for idempotency");
  if (!pickupAddress || !dropoffAddress || loadedMiles <= 0 || totalRate <= 0) {
    throw new Error("pickup_address, dropoff_address, loaded_miles, and total_rate are required");
  }
  const equipment = clean(input?.equipment_type, 40);
  const capturedAt = safeDate(input?.captured_at) || new Date().toISOString();
  const expiresAt = safeDate(input?.expires_at) || new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
  if (Date.parse(expiresAt) <= Date.parse(capturedAt)) throw new Error("expires_at must be after captured_at");

  return {
    source_type: sourceType,
    source_reference: clean(input?.source_reference, 160),
    capture_id: captureId,
    verification_status: ["source_verified", "rate_verified"].includes(input?.verification_status) ? input.verification_status : "source_verified",
    scope_user_id: clean(input?.scope_user_id, 100),
    scope_usdot_number: clean(input?.scope_usdot_number, 32),
    broker_name: clean(input?.broker_name, 180),
    broker_mc_number: clean(input?.broker_mc_number, 40),
    shipper_name: clean(input?.shipper_name, 180),
    commodity: clean(input?.commodity, 180),
    equipment_type: ALLOWED_EQUIPMENT.has(equipment) ? equipment : "other",
    weight_lbs: number(input?.weight_lbs, 0, 200_000),
    hazmat: Boolean(input?.hazmat),
    pickup_address: pickupAddress,
    pickup_window_start: safeDate(input?.pickup_window_start),
    pickup_window_end: safeDate(input?.pickup_window_end),
    dropoff_address: dropoffAddress,
    delivery_window_start: safeDate(input?.delivery_window_start),
    delivery_window_end: safeDate(input?.delivery_window_end),
    loaded_miles: loadedMiles,
    deadhead_miles: number(input?.deadhead_miles, 0, 3_000),
    linehaul_amount: number(input?.linehaul_amount ?? totalRate, 0, 1_000_000),
    fuel_surcharge: number(input?.fuel_surcharge, 0, 100_000),
    accessorial_amount: number(input?.accessorial_amount, 0, 100_000),
    total_rate: totalRate,
    status: "available",
    captured_at: capturedAt,
    expires_at: expiresAt,
    notes: clean(input?.notes, 1200),
  };
}

export default async function(req: Request) {
  try {
    if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
    const configuredSecret = Deno.env.get("LOKIN_FREIGHT_FEED_SECRET");
    if (!configuredSecret) {
      console.error("freight-feed-ingest: LOKIN_FREIGHT_FEED_SECRET is not configured");
      return Response.json({ error: "Freight feed ingestion is not configured" }, { status: 503 });
    }
    const suppliedSecret = req.headers.get("x-lokin-freight-secret") || "";
    if (!suppliedSecret || suppliedSecret !== configuredSecret) {
      return Response.json({ error: "Unauthorized freight feed" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const inputs = Array.isArray(body?.loads) ? body.loads : body ? [body] : [];
    if (!inputs.length) return Response.json({ error: "One load or a loads array is required" }, { status: 400 });
    if (inputs.length > 100) return Response.json({ error: "Maximum 100 loads per request" }, { status: 413 });

    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole;
    const accepted = [];
    const duplicates = [];
    const rejected = [];

    for (let index = 0; index < inputs.length; index += 1) {
      try {
        const load = normalizeLoad(inputs[index]);
        const existing = await db.entities.FreightLoad.filter({ capture_id: load.capture_id });
        if (existing?.[0]) {
          duplicates.push({ index, capture_id: load.capture_id, id: existing[0].id });
          continue;
        }
        const created = await db.entities.FreightLoad.create(load);
        accepted.push({ index, capture_id: load.capture_id, id: created.id });
      } catch (error) {
        rejected.push({ index, error: error instanceof Error ? error.message : "Invalid load" });
      }
    }

    return Response.json({
      ok: rejected.length === 0,
      accepted,
      duplicates,
      rejected,
      counts: { accepted: accepted.length, duplicates: duplicates.length, rejected: rejected.length },
    }, { status: rejected.length ? 207 : 200 });
  } catch (error) {
    console.error("freight-feed-ingest error", error);
    return Response.json({ error: "Freight feed ingestion failed" }, { status: 500 });
  }
}
