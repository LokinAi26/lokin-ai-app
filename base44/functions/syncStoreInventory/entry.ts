import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { supportedStoreApis, syncFromStoreApi } from "../../shared/storeApiRegistry.ts";

const CACHE_TTL_MS = 60 * 60 * 1000;
const syncCache = new Map<string, { expiresAt: number; payload: any }>();

function cacheKey(source: string, storeCode: string) {
  return `${source.toLowerCase()}::${storeCode.toLowerCase()}`;
}

function sanitizeSource(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export default async function syncStoreInventory(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const store_api_source = sanitizeSource(body.store_api_source);
    const store_location_code = String(body.store_location_code || "").trim();
    const api_key_id = String(body.api_key_id || "").trim() || undefined;

    if (!store_api_source) return Response.json({ error: "store_api_source is required" }, { status: 400 });
    if (!store_location_code) return Response.json({ error: "store_location_code is required" }, { status: 400 });
    if (!supportedStoreApis().includes(store_api_source)) {
      return Response.json({
        error: `Unsupported store_api_source "${store_api_source}"`,
        supported_sources: supportedStoreApis(),
      }, { status: 400 });
    }

    const key = cacheKey(store_api_source, store_location_code);
    const now = Date.now();
    const cache = syncCache.get(key);
    if (cache && cache.expiresAt > now) {
      console.log("[syncStoreInventory] cache hit", { source: store_api_source, store_location_code });
      return Response.json(cache.payload);
    }

    const remote = await syncFromStoreApi(store_api_source, { store_location_code, api_key_id });
    const items = Array.isArray(remote.items) ? remote.items : [];
    const existing = await base44.asServiceRole.entities.LocatorItem.filter({ store: store_location_code }, "-updated_date", 1000, 0);
    const existingByKey = new Map<string, any>();
    for (const row of existing) {
      const k = String(row.barcode || row.item_code || row.name || "").toLowerCase();
      if (!k) continue;
      existingByKey.set(k, row);
    }

    const failed_items: string[] = [];
    let synced_count = 0;
    const last_sync = new Date().toISOString();

    for (const item of items) {
      try {
        const keyPart = String(item.barcode || item.item_code || item.name || "").toLowerCase();
        if (!keyPart) continue;
        const payload = {
          name: String(item.name || "Unnamed item"),
          barcode: item.barcode || null,
          item_code: item.item_code || null,
          aisle: item.aisle || null,
          shelf: item.shelf || null,
          department: item.department || null,
          price: item.price == null ? null : Number(item.price),
          inventory_count: item.inventory_count == null ? null : Number(item.inventory_count),
          inventory_source: store_api_source,
          inventory_updated_at: last_sync,
          store: store_location_code,
          store_api_source,
          store_api_sync_status: "synced",
          store_api_last_sync: last_sync,
        };
        const existingItem = existingByKey.get(keyPart);
        if (existingItem?.id) await base44.asServiceRole.entities.LocatorItem.update(existingItem.id, payload);
        else await base44.asServiceRole.entities.LocatorItem.create(payload);
        synced_count += 1;
      } catch (error) {
        failed_items.push(String(item?.name || item?.barcode || item?.item_code || "unknown_item"));
        console.error("[syncStoreInventory] item failed", error);
      }
    }

    const payload = {
      synced_count,
      failed_items,
      last_sync,
      store: store_location_code,
      source: store_api_source,
      cache_ttl_ms: CACHE_TTL_MS,
    };
    syncCache.set(key, { expiresAt: now + CACHE_TTL_MS, payload });
    console.log("[syncStoreInventory] completed", payload);
    return Response.json(payload);
  } catch (error) {
    console.error("[syncStoreInventory] failed", error);
    return Response.json({ error: error instanceof Error ? error.message : "Failed to sync store inventory" }, { status: 500 });
  }
}
