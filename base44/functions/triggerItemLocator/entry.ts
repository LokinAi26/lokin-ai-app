import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { isVirginiaZipCode, normalizeZipCode } from "../../shared/virginia.ts";

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

function finite(value: unknown, label: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a finite number`);
  return parsed;
}

export default async function triggerItemLocator(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const driver_latitude = finite(body.driver_latitude, "driver_latitude");
    const driver_longitude = finite(body.driver_longitude, "driver_longitude");
    const store_zip_code = normalizeZipCode(body.store_zip_code);

    if (store_zip_code && !isVirginiaZipCode(store_zip_code)) {
      return Response.json({ triggered: false });
    }

    const items = await base44.asServiceRole.entities.LocatorItem.filter({}, "-updated_date", 500, 0);
    let bestStore: { name: string; distance: number } | null = null;

    for (const item of items) {
      const geofenceLat = Number(item?.geofence_latitude);
      const geofenceLon = Number(item?.geofence_longitude);
      if (!Number.isFinite(geofenceLat) || !Number.isFinite(geofenceLon)) continue;
      if (store_zip_code && normalizeZipCode(item?.zip_code) !== store_zip_code) continue;

      const radius = Number(item?.geofence_radius_meters);
      const maxRadius = Number.isFinite(radius) && radius > 0 ? radius : 1.5;
      const distance = haversineMeters(driver_latitude, driver_longitude, geofenceLat, geofenceLon);
      if (distance > maxRadius) continue;

      const name = String(item?.store || "Store");
      if (!bestStore || distance < bestStore.distance) bestStore = { name, distance };
    }

    if (!bestStore) {
      console.log("[triggerItemLocator] not triggered", { driver_id: user.id, store_zip_code: store_zip_code || null });
      return Response.json({ triggered: false });
    }

    const storeItems = items.filter((item) => String(item?.store || "Store") === bestStore?.name);
    console.log("[triggerItemLocator] triggered", {
      driver_id: user.id,
      store_name: bestStore.name,
      item_count: storeItems.length,
      distance_meters: bestStore.distance,
    });

    return Response.json({
      triggered: true,
      store_name: bestStore.name,
      item_count: storeItems.length,
      items: storeItems,
    });
  } catch (error) {
    console.error("[triggerItemLocator] failed", error);
    return Response.json({ error: error instanceof Error ? error.message : "Failed to trigger item locator" }, { status: 500 });
  }
}
