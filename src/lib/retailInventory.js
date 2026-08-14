// LOKIN retail inventory normalization layer.
// Keeps the Item Locator UI retailer-agnostic so approved merchant feeds can plug in
// without rewriting the driver experience. Never label data LIVE unless the source
// supplied a timestamp/status confirming it.

export const INVENTORY_SOURCE_LABELS = {
  merchant_api: "Merchant live feed",
  partner_feed: "Partner inventory feed",
  store_feed: "Store inventory feed",
  shopify: "Merchant Shopify inventory",
  lokin_catalog: "LOKIN catalog",
  unknown: "Inventory source unavailable",
};

export function normalizeInventoryItem(raw = {}) {
  const count = Number.isFinite(Number(raw.inventory_count)) ? Number(raw.inventory_count) : null;
  const status = raw.inventory_status || (count == null ? "unknown" : count <= 0 ? "out_of_stock" : count <= 3 ? "low_stock" : "in_stock");
  return {
    ...raw,
    inventory_count: count,
    inventory_status: status,
    inventory_source: raw.inventory_source || "unknown",
    inventory_source_label: INVENTORY_SOURCE_LABELS[raw.inventory_source] || INVENTORY_SOURCE_LABELS.unknown,
    inventory_verified: Boolean(raw.last_inventory_update && raw.inventory_source && raw.inventory_source !== "lokin_catalog" && raw.inventory_source !== "unknown"),
  };
}

export function inventoryFreshness(iso) {
  if (!iso) return { label: "Update time unavailable", fresh: false };
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return { label: "Recently updated", fresh: true };
  const min = Math.floor(ms / 60000);
  if (min < 2) return { label: "Updated just now", fresh: true };
  if (min < 60) return { label: `Updated ${min} min ago`, fresh: min <= 15 };
  const hr = Math.floor(min / 60);
  return { label: `Updated ${hr}h ago`, fresh: false };
}
