import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { isVirginiaZipCode, normalizeZipCode } from "../../shared/virginia.ts";

function normalizeAddress(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b(apt|apartment|unit|suite|ste|bldg|building|floor|fl|room|rm)\s*\.?\s*[a-z0-9-]+\b/g, " ")
    .replace(/#\s*[a-z0-9-]+\b/g, " ")
    .replace(/\b\d{5}(?:-\d{4})?\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function finiteNumber(value: unknown, field: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${field} must be a finite number`);
  return parsed;
}

export default async function saveDoorPin(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const address = normalizeAddress(body.address);
    const zip_code = normalizeZipCode(body.zip_code);
    const gps_latitude = finiteNumber(body.latitude, "latitude");
    const gps_longitude = finiteNumber(body.longitude, "longitude");
    const map_x = body.map_x == null ? null : finiteNumber(body.map_x, "map_x");
    const map_y = body.map_y == null ? null : finiteNumber(body.map_y, "map_y");
    const precise_location_description = String(body.description || "").trim().slice(0, 200);
    const source = String(body.source || "manual").toLowerCase() === "auto" ? "auto" : "manual";

    if (!address) {
      return Response.json({ error: "address is required" }, { status: 400 });
    }
    if (zip_code && !isVirginiaZipCode(zip_code)) {
      return Response.json({ error: "zip_code must be a Virginia ZIP code" }, { status: 400 });
    }

    const driver_id = String(user.id);
    const existing = await base44.asServiceRole.entities.DoorPin.filter({ address, driver_id }, "-updated_date", 1, 0);
    const now = new Date().toISOString();

    let saved;
    if (existing?.[0]?.id) {
      const row = existing[0];
      const verified_by_delivery_count = Number(row.verified_by_delivery_count || row.confirmations || 0) + 1;
      saved = await base44.asServiceRole.entities.DoorPin.update(row.id, {
        address,
        zip_code: zip_code || row.zip_code || null,
        gps_latitude,
        gps_longitude,
        map_x,
        map_y,
        precise_location_description,
        last_updated: now,
        driver_id,
        verified_by_delivery_count,
        address_key: address,
        display_address: String(body.address || "").trim() || row.display_address || "",
        latitude: gps_latitude,
        longitude: gps_longitude,
        source,
        confirmations: verified_by_delivery_count,
        updated_at: now,
      });
    } else {
      saved = await base44.asServiceRole.entities.DoorPin.create({
        address,
        zip_code: zip_code || null,
        gps_latitude,
        gps_longitude,
        map_x,
        map_y,
        precise_location_description,
        last_updated: now,
        created_at: now,
        driver_id,
        verified_by_delivery_count: 1,
        address_key: address,
        display_address: String(body.address || "").trim(),
        latitude: gps_latitude,
        longitude: gps_longitude,
        source,
        confirmations: 1,
      });
    }

    console.log("[saveDoorPin] upserted", { driver_id, address, id: saved?.id });
    return Response.json(saved);
  } catch (error) {
    console.error("[saveDoorPin] failed", error);
    return Response.json({ error: error instanceof Error ? error.message : "Failed to save door pin" }, { status: 500 });
  }
}
