import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

function finite(value: unknown, label: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a finite number`);
  return parsed;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export default async function reportItemLocation(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const itemId = String(body.item_id || "").trim();
    const latitude = finite(body.driver_latitude, "driver_latitude");
    const longitude = finite(body.driver_longitude, "driver_longitude");
    const confidence = clamp(Math.round(finite(body.confidence, "confidence")), 1, 5);
    const confidenceWeight = confidence / 5;

    if (!itemId) return Response.json({ error: "item_id is required" }, { status: 400 });

    const item = await base44.asServiceRole.entities.LocatorItem.get(itemId).catch(() => null);
    if (!item?.id) return Response.json({ error: "LocatorItem not found" }, { status: 404 });

    const previousCount = Number(item.driver_reports_count || 0);
    const previousWeight = Math.max(previousCount, 0);
    const nextWeight = previousWeight + confidenceWeight;

    const previousMapX = Number(item.map_x);
    const previousMapY = Number(item.map_y);
    const observedMapX = longitude;
    const observedMapY = latitude;

    const map_x =
      Number.isFinite(previousMapX) && nextWeight > 0
        ? (previousMapX * previousWeight + observedMapX * confidenceWeight) / nextWeight
        : observedMapX;
    const map_y =
      Number.isFinite(previousMapY) && nextWeight > 0
        ? (previousMapY * previousWeight + observedMapY * confidenceWeight) / nextWeight
        : observedMapY;

    const updated = await base44.asServiceRole.entities.LocatorItem.update(item.id, {
      aisle: body.aisle == null ? item.aisle : String(body.aisle).trim().slice(0, 50),
      shelf: body.shelf == null ? item.shelf : String(body.shelf).trim().slice(0, 50),
      map_x,
      map_y,
      map_verified: true,
      driver_reports_count: previousCount + 1,
      report_count: Number(item.report_count || 0) + 1,
      last_driver_report: new Date().toISOString(),
      reported_by: String(user.id),
      verification: "driver_report",
    });

    console.log("[reportItemLocation] updated", { driver_id: user.id, item_id: item.id, confidence });
    return Response.json(updated);
  } catch (error) {
    console.error("[reportItemLocation] failed", error);
    return Response.json({ error: error instanceof Error ? error.message : "Failed to report item location" }, { status: 500 });
  }
}
