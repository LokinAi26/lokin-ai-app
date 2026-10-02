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

export default async function getDoorPin(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const address = normalizeAddress(body.address);
    const zip_code = normalizeZipCode(body.zip_code);

    if (zip_code && !isVirginiaZipCode(zip_code)) {
      return Response.json(address ? null : []);
    }

    const driver_id = String(user.id);
    let rows: any[] = [];

    if (address) {
      rows = await base44.asServiceRole.entities.DoorPin.filter({ address, driver_id }, "-updated_date", 1, 0);
      console.log("[getDoorPin] single lookup", { driver_id, address, found: rows.length > 0 });
      return Response.json(rows[0] || null);
    }

    if (zip_code) {
      rows = await base44.asServiceRole.entities.DoorPin.filter({ driver_id, zip_code }, "-updated_date", 200, 0);
    } else {
      rows = await base44.asServiceRole.entities.DoorPin.filter({ driver_id }, "-updated_date", 200, 0);
    }

    console.log("[getDoorPin] list lookup", { driver_id, zip_code: zip_code || null, count: rows.length });
    return Response.json(rows);
  } catch (error) {
    console.error("[getDoorPin] failed", error);
    return Response.json({ error: error instanceof Error ? error.message : "Failed to fetch door pins" }, { status: 500 });
  }
}
